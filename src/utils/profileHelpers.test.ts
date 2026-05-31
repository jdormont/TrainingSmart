import { describe, it, expect } from 'vitest';
import { calculateLoad, calculateConsistency } from './profileHelpers';
import type { StravaActivity } from '../types';

/**
 * Creates a StravaActivity with start_date_local set to N days ago at 10:00.
 * Using 10:00 ensures the activity always falls strictly inside a day window
 * rather than on a midnight boundary.
 */
const makeActivity = (daysAgo: number, durationMinutes: number): StravaActivity => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dateStr = d.toISOString().split('T')[0];
  return {
    id: Math.random(),
    name: 'Test',
    distance: 20000,
    moving_time: durationMinutes * 60,
    elapsed_time: durationMinutes * 60,
    total_elevation_gain: 0,
    type: 'Ride',
    sport_type: 'Ride',
    start_date: `${dateStr}T10:00:00Z`,
    start_date_local: `${dateStr}T10:00:00`,
    timezone: 'UTC',
    average_speed: 8,
    max_speed: 12,
    average_heartrate: 150,
    max_heartrate: 180,
    kudos_count: 0,
    comment_count: 0,
    athlete_count: 1,
    photo_count: 0,
    map: { id: '1', summary_polyline: '', resource_state: 2 },
  };
};

describe('calculateLoad', () => {
  it('returns Maintenance Mode when there are no activities (ratio defaults to 1.0)', () => {
    const result = calculateLoad([]);
    // chronicLoad = 0 (≤ 10), acuteLoad = 0 → ratio = 1.0 → 0.95–1.10 band → score 85
    expect(result.score).toBe(85);
    expect(result.suggestion).toContain('Maintenance Mode');
  });

  it('scores 100 for a perfect growth-zone ratio (1.10–1.30)', () => {
    const activities: StravaActivity[] = [];
    // Older chronic load: 4 activities × 60 min/week for 5 weeks (days 7–38)
    for (let w = 0; w < 5; w++) {
      for (let d = 1; d <= 4; d++) {
        activities.push(makeActivity(7 + w * 7 + d, 60));
      }
    }
    // Acute load: 5 activities × 60 min in current week (days 1–5)
    for (let d = 1; d <= 5; d++) {
      activities.push(makeActivity(d, 60));
    }
    // Chronic = (1200 older + 300 acute) / 42 * 7 = 250 min/wk
    // Acute = 300 min/wk  →  ratio = 1.2  →  score = 100
    const result = calculateLoad(activities);
    expect(result.score).toBe(100);
    expect(result.suggestion).toContain('Perfect Growth Zone');
  });

  it('scores 85 for a maintenance ratio (0.95–1.10)', () => {
    const activities: StravaActivity[] = [];
    // Steady 5 × 60 min/week for 6 full weeks (days 1–42)
    for (let w = 0; w < 6; w++) {
      for (let d = 1; d <= 5; d++) {
        activities.push(makeActivity(w * 7 + d, 60));
      }
    }
    // Acute ≈ Chronic → ratio ≈ 1.0 → Maintenance
    const result = calculateLoad(activities);
    expect(result.score).toBe(85);
    expect(result.suggestion).toContain('Maintenance Mode');
  });

  it('scores 50 (Danger Zone) for a ratio > 1.45 caused by a large sudden spike', () => {
    const activities: StravaActivity[] = [];
    // Low chronic baseline: 1 × 30 min per week for 5 weeks
    for (let w = 1; w <= 5; w++) activities.push(makeActivity(w * 7, 30));
    // Sudden spike: 7 × 120 min this week
    for (let d = 1; d <= 7; d++) activities.push(makeActivity(d, 120));
    const result = calculateLoad(activities);
    expect(result.score).toBe(50);
    expect(result.suggestion).toContain('Danger Zone');
  });

  it('returns exactly three named components', () => {
    const result = calculateLoad([]);
    expect(result.components).toHaveLength(3);
    const names = result.components.map(c => c.name);
    expect(names).toContain('Acute Load (7d)');
    expect(names).toContain('Chronic Load (42d)');
    expect(names).toContain('A:C Ratio');
  });

  it('returns a valid trend value', () => {
    const result = calculateLoad([]);
    expect(['improving', 'stable', 'declining']).toContain(result.trend);
  });
});

describe('calculateConsistency', () => {
  it('scores 100 (Machine-like) for a perfectly steady schedule', () => {
    const activities: StravaActivity[] = [];
    // 4 training days per week for each of 8 weeks (days 1–4, 8–11, …)
    for (let w = 0; w < 8; w++) {
      for (let d = 1; d <= 4; d++) {
        activities.push(makeActivity(w * 7 + d, 60));
      }
    }
    const result = calculateConsistency(activities);
    expect(result.score).toBe(100);
    expect(result.suggestion).toContain('Machine-like');
  });

  it('scores 50 (Erratic) for alternating full/empty weeks', () => {
    const activities: StravaActivity[] = [];
    // Even weeks: 7 days active; odd weeks: rest
    for (let w = 0; w < 8; w++) {
      if (w % 2 === 0) {
        for (let d = 1; d <= 7; d++) {
          activities.push(makeActivity(w * 7 + d, 30));
        }
      }
    }
    const result = calculateConsistency(activities);
    expect(result.score).toBe(50);
    expect(result.suggestion).toContain('Erratic');
  });

  it('returns exactly two components', () => {
    const result = calculateConsistency([]);
    expect(result.components).toHaveLength(2);
    const names = result.components.map(c => c.name);
    expect(names).toContain('Avg Days/Week');
    expect(names).toContain('Variability');
  });

  it('returns a valid trend value', () => {
    const result = calculateConsistency([]);
    expect(['improving', 'stable', 'declining']).toContain(result.trend);
  });

  it('returns zero avg days per week with no activities', () => {
    const result = calculateConsistency([]);
    const avgComp = result.components.find(c => c.name === 'Avg Days/Week')!;
    expect(parseFloat(avgComp.value)).toBe(0);
  });
});
