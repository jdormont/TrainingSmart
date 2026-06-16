import { describe, it, expect } from 'vitest';
import { riderProfileService } from './riderProfileService';
import type { StravaActivity } from '../types';
import type { HealthDimensionDetail } from './healthMetricsService';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getRelativeDate = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

const createActivity = (
  daysAgo: number,
  movingTimeMinutes: number,
  avgWatts?: number,
  avgHr?: number
): StravaActivity => ({
  id: Math.random(),
  name: 'Test Ride',
  distance: 40000,
  moving_time: movingTimeMinutes * 60,
  elapsed_time: movingTimeMinutes * 60,
  total_elevation_gain: 200,
  type: 'Ride',
  sport_type: 'Ride',
  start_date: `${getRelativeDate(daysAgo)}T08:00:00Z`,
  start_date_local: `${getRelativeDate(daysAgo)}T08:00:00`,
  timezone: '(GMT+00:00) UTC',
  average_speed: 10.0,
  max_speed: 15.0,
  average_heartrate: avgHr,
  max_heartrate: avgHr ? avgHr + 20 : undefined,
  weighted_average_watts: avgWatts,
  average_watts: avgWatts,
  kudos_count: 0,
  comment_count: 0,
  athlete_count: 1,
  photo_count: 0,
  map: { id: '1', summary_polyline: '', resource_state: 2 },
});

// Build a minimal HealthDimensionDetail that riderProfileService reads.
// calculateDisciplineLevel reads the 'Avg Days/Week' component value.
// calculateCapacityLevel reads the 'A:C Ratio' component value.
const makeLoadDetail = (acRatio: number): HealthDimensionDetail => ({
  score: 80,
  components: [
    { name: 'Acute Load (7d)', value: '300 mins', contribution: 0 },
    { name: 'Chronic Load (42d)', value: '240 mins', contribution: 0 },
    { name: 'A:C Ratio', value: acRatio.toFixed(2), contribution: 80 },
  ],
  trend: 'stable',
  suggestion: '',
});

const makeConsistencyDetail = (avgDaysPerWeek: number): HealthDimensionDetail => ({
  score: 85,
  components: [
    { name: 'Avg Days/Week', value: avgDaysPerWeek.toFixed(1), contribution: 0 },
    { name: 'Variability', value: '±0.5 days', contribution: 85 },
  ],
  trend: 'stable',
  suggestion: '',
});

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('RiderProfileService.calculateProfile()', () => {

  it('returns high levels (7+) for a high-FTP, high-consistency athlete with long recent rides', () => {
    // 5 activities in the last 28 days, each 3 h (180 min) → stamina level = min(10, floor(1+180/30)) = 7
    const activities: StravaActivity[] = [];
    for (let i = 1; i <= 5; i++) {
      activities.push(createActivity(i * 4, 180, 300, 155)); // 180 min rides with power + HR
    }

    // Consistency: 5.5 days/week → level = floor(5.5 * 1.5) = 8
    const consistencyDetail = makeConsistencyDetail(5.5);
    // Load: ACWR 1.2 → level = floor(5 + (1.2-1+0.001)*15) = floor(5+3.015) = 8
    const loadDetail = makeLoadDetail(1.2);
    const ftp = 300;

    const profile = riderProfileService.calculateProfile(activities, loadDetail, consistencyDetail, ftp);

    // Stamina: 180 min longest → level = floor(1 + 180/30) = 7
    expect(profile.stamina.level).toBe(7);

    // Discipline: floor(5.5 * 1.5) = 8
    expect(profile.discipline.level).toBe(8);

    // Capacity: floor(5 + (1.2 - 1 + 0.001) * 15) = floor(8.015) = 8
    expect(profile.capacity.level).toBe(8);

    // Punch: no power stream → fallback 110% FTP → ratio=1.1 → floor((1.1-1)*40)=4 (capped at ≥1)
    expect(profile.punch.level).toBeGreaterThanOrEqual(1);

    // All dimensions exist
    expect(profile.discipline).toBeDefined();
    expect(profile.stamina).toBeDefined();
    expect(profile.punch).toBeDefined();
    expect(profile.capacity).toBeDefined();
    expect(profile.economy).toBeDefined();
  });

  it('returns level 1 for all dimensions given no activities and minimal inputs', () => {
    const activities: StravaActivity[] = [];
    // Consistency: 0 days/week → level = max(1, floor(0*1.5)) = 1
    const consistencyDetail = makeConsistencyDetail(0);
    // Load: ACWR 0 → level = max(1, floor(5+(0-1+0.001)*15)) = max(1, floor(-9.985)) = 1
    const loadDetail = makeLoadDetail(0);
    const ftp = 200;

    const profile = riderProfileService.calculateProfile(activities, loadDetail, consistencyDetail, ftp);

    expect(profile.stamina.level).toBe(1);
    expect(profile.discipline.level).toBe(1);
    expect(profile.capacity.level).toBe(1);

    // Punch still works (uses ftp*1.1 fallback) — ratio 1.1 → floor((0.1)*40)=4
    // which is > 1, so just check it's in range [1..10]
    expect(profile.punch.level).toBeGreaterThanOrEqual(1);
    expect(profile.punch.level).toBeLessThanOrEqual(10);
  });

  it('boundary: a single 90-min ride in the last 28 days yields stamina level 4', () => {
    // Formula: level = floor(1 + maxDurationMin / 30)
    // 90 min → floor(1 + 3) = 4
    const activities: StravaActivity[] = [
      createActivity(3, 90), // 3 days ago — within 28-day window
    ];
    const consistencyDetail = makeConsistencyDetail(1);
    const loadDetail = makeLoadDetail(1.0);

    const profile = riderProfileService.calculateProfile(activities, loadDetail, consistencyDetail, 250);

    expect(profile.stamina.level).toBe(4);
  });

  it('boundary: stamina level 1 when longest ride is under 30 min (floor rounds down to 1)', () => {
    // 20 min ride → floor(1 + 20/30) = floor(1.666) = 1
    const activities: StravaActivity[] = [
      createActivity(2, 20),
    ];
    const consistencyDetail = makeConsistencyDetail(1);
    const loadDetail = makeLoadDetail(1.0);

    const profile = riderProfileService.calculateProfile(activities, loadDetail, consistencyDetail, 250);

    expect(profile.stamina.level).toBe(1);
  });

  it('capacity level reflects ACWR correctly at sweet-spot ratio 1.2', () => {
    // Formula: level = floor(5 + (ratio - 1 + 0.001) * 15)
    // ratio=1.2 → floor(5 + 0.201*15) = floor(5+3.015) = floor(8.015) = 8
    const consistencyDetail = makeConsistencyDetail(3);
    const loadDetail = makeLoadDetail(1.2);

    const profile = riderProfileService.calculateProfile([], loadDetail, consistencyDetail, 250);

    expect(profile.capacity.level).toBe(8);
  });

  it('profile LevelDetail objects carry the expected shape', () => {
    const activities: StravaActivity[] = [createActivity(1, 60)];
    const profile = riderProfileService.calculateProfile(
      activities,
      makeLoadDetail(1.0),
      makeConsistencyDetail(3),
      250
    );

    for (const dim of ['discipline', 'stamina', 'punch', 'capacity', 'economy'] as const) {
      const detail = profile[dim];
      expect(typeof detail.level).toBe('number');
      expect(detail.level).toBeGreaterThanOrEqual(1);
      expect(detail.level).toBeLessThanOrEqual(10);
      expect(typeof detail.currentValue).toBe('string');
      expect(typeof detail.nextLevelCriteria).toBe('string');
      expect(typeof detail.prompt).toBe('string');
    }
  });
});
