import { describe, it, expect } from 'vitest';
import {
  calculateWeeklyStats,
  calculateTrainingLoad,
  getActivityTypeBreakdown,
  getRecentPerformanceTrend,
  calculatePowerTSS,
  estimateTSSFromPowerSummary,
  estimateTSSFromHR,
  estimateActivityTSS,
  buildDailyTssSeries,
  calculateCtlAtlSeries,
  DEFAULT_THRESHOLD_HR,
} from './dataProcessing';
import type { StravaActivity } from '../types';

const makeActivity = (
  dateStr: string,
  type = 'Ride',
  movingTimeSecs = 3600,
  distanceMeters = 30000,
  elevationGain = 100,
  avgHr: number | undefined = 150,
): StravaActivity => ({
  id: Math.random(),
  name: 'Test Activity',
  distance: distanceMeters,
  moving_time: movingTimeSecs,
  elapsed_time: movingTimeSecs,
  total_elevation_gain: elevationGain,
  type,
  sport_type: type,
  start_date: `${dateStr}T10:00:00Z`,
  start_date_local: `${dateStr}T10:00:00`,
  timezone: 'UTC',
  average_speed: 8,
  max_speed: 12,
  average_heartrate: avgHr,
  max_heartrate: 180,
  kudos_count: 0,
  comment_count: 0,
  athlete_count: 1,
  photo_count: 0,
  map: { id: '1', summary_polyline: '', resource_state: 2 },
});

const todayIso = (): string => new Date().toISOString().split('T')[0];

describe('calculateWeeklyStats', () => {
  it('returns zeros for an empty activity list', () => {
    const stats = calculateWeeklyStats([]);
    expect(stats.totalDistance).toBe(0);
    expect(stats.totalTime).toBe(0);
    expect(stats.totalElevation).toBe(0);
    expect(stats.activityCount).toBe(0);
    expect(stats.activities).toHaveLength(0);
  });

  it('includes activities that fall within the current week', () => {
    const today = todayIso();
    const stats = calculateWeeklyStats([makeActivity(today, 'Ride', 3600, 30000, 50)]);
    expect(stats.activityCount).toBe(1);
    expect(stats.totalDistance).toBe(30000);
    expect(stats.totalTime).toBe(3600);
    expect(stats.totalElevation).toBe(50);
  });

  it('excludes activities from a previous year', () => {
    const stats = calculateWeeklyStats([makeActivity('2020-01-01')]);
    expect(stats.activityCount).toBe(0);
    expect(stats.totalDistance).toBe(0);
  });

  it('sums distance, time, and elevation across multiple in-week activities', () => {
    const today = todayIso();
    const activities = [
      makeActivity(today, 'Ride', 3600, 20000, 200),
      makeActivity(today, 'Run', 1800, 8000, 50),
    ];
    const stats = calculateWeeklyStats(activities);
    expect(stats.activityCount).toBe(2);
    expect(stats.totalDistance).toBe(28000);
    expect(stats.totalTime).toBe(5400);
    expect(stats.totalElevation).toBe(250);
  });

  it('returns a weekStart date', () => {
    const stats = calculateWeeklyStats([]);
    expect(stats.weekStart).toBeInstanceOf(Date);
  });
});

describe('calculateTrainingLoad', () => {
  it('returns 0 for an empty activity list', () => {
    expect(calculateTrainingLoad([])).toBe(0);
  });

  it('uses 1.0 intensity factor when heart rate is absent', () => {
    const act = makeActivity(todayIso(), 'Ride', 7200, 30000, 100, undefined);
    // 7200s = 2h × 1.0 = 2.0
    expect(calculateTrainingLoad([act])).toBeCloseTo(2.0, 5);
  });

  it('scales load with heart rate relative to 150 bpm baseline', () => {
    const hardRide = makeActivity(todayIso(), 'Ride', 3600, 30000, 100, 180); // factor 1.2
    const easyRide = makeActivity(todayIso(), 'Ride', 3600, 30000, 100, 120); // factor 0.8
    expect(calculateTrainingLoad([hardRide])).toBeGreaterThan(calculateTrainingLoad([easyRide]));
  });

  it('caps heart rate factor at 1.5', () => {
    // HR 250 → 250/150 = 1.67 → capped at 1.5
    const maxHrRide = makeActivity(todayIso(), 'Ride', 3600, 0, 0, 250);
    expect(calculateTrainingLoad([maxHrRide])).toBeCloseTo(1.5, 5);
  });

  it('accumulates load across multiple activities', () => {
    const a1 = makeActivity(todayIso(), 'Ride', 3600, 0, 0, undefined); // 1h * 1.0 = 1
    const a2 = makeActivity(todayIso(), 'Run', 7200, 0, 0, undefined);  // 2h * 1.0 = 2
    expect(calculateTrainingLoad([a1, a2])).toBeCloseTo(3.0, 5);
  });
});

describe('getActivityTypeBreakdown', () => {
  it('returns an empty array for no activities', () => {
    expect(getActivityTypeBreakdown([])).toEqual([]);
  });

  it('groups activities by type with correct counts', () => {
    const activities = [
      makeActivity(todayIso(), 'Run'),
      makeActivity(todayIso(), 'Run'),
      makeActivity(todayIso(), 'Ride'),
    ];
    const breakdown = getActivityTypeBreakdown(activities);
    const run = breakdown.find(b => b.type === 'Run')!;
    const ride = breakdown.find(b => b.type === 'Ride')!;
    expect(run.count).toBe(2);
    expect(ride.count).toBe(1);
  });

  it('sums distance and time per type', () => {
    const activities = [
      makeActivity(todayIso(), 'Ride', 3600, 30000),
      makeActivity(todayIso(), 'Ride', 1800, 15000),
    ];
    const breakdown = getActivityTypeBreakdown(activities);
    const ride = breakdown.find(b => b.type === 'Ride')!;
    expect(ride.distance).toBe(45000);
    expect(ride.time).toBe(5400);
  });

  it('handles multiple distinct types', () => {
    const activities = [
      makeActivity(todayIso(), 'Run'),
      makeActivity(todayIso(), 'Ride'),
      makeActivity(todayIso(), 'Swim'),
    ];
    const breakdown = getActivityTypeBreakdown(activities);
    expect(breakdown).toHaveLength(3);
  });
});

describe('getRecentPerformanceTrend', () => {
  it('returns an empty array for no activities', () => {
    expect(getRecentPerformanceTrend([])).toEqual([]);
  });

  it('returns at most 10 activities', () => {
    const activities = Array.from({ length: 15 }, (_, i) =>
      makeActivity(`2024-01-${String(i + 1).padStart(2, '0')}`)
    );
    expect(getRecentPerformanceTrend(activities)).toHaveLength(10);
  });

  it('sorts results with the most recent activity first', () => {
    const activities = [
      makeActivity('2024-01-01'),
      makeActivity('2024-01-03'),
      makeActivity('2024-01-02'),
    ];
    const trend = getRecentPerformanceTrend(activities);
    expect(trend[0].date).toBe('2024-01-03T10:00:00');
    expect(trend[2].date).toBe('2024-01-01T10:00:00');
  });

  it('filters by activity type when provided', () => {
    const activities = [
      makeActivity(todayIso(), 'Run'),
      makeActivity(todayIso(), 'Ride'),
      makeActivity(todayIso(), 'Run'),
    ];
    const trend = getRecentPerformanceTrend(activities, 'Run');
    expect(trend).toHaveLength(2);
    trend.forEach(t => expect(t.pace).toBeDefined());
  });

  it('includes pace, distance, and duration in each result', () => {
    const [trend] = getRecentPerformanceTrend([makeActivity(todayIso())]);
    expect(trend).toHaveProperty('date');
    expect(trend).toHaveProperty('pace');
    expect(trend).toHaveProperty('distance');
    expect(trend).toHaveProperty('duration');
  });
});

describe('calculatePowerTSS', () => {
  it('returns exactly 100 for 1 hour at NP == FTP (definitional anchor)', () => {
    expect(calculatePowerTSS(3600, 200, 200)).toBeCloseTo(100, 5);
  });

  it('scales with duration and intensity factor', () => {
    // 2h @ NP=250, FTP=200 -> IF=1.25 -> (7200*250*1.25)/(200*3600)*100 = 312.5
    expect(calculatePowerTSS(7200, 250, 200)).toBeCloseTo(312.5, 5);
  });

  it('returns 0 for invalid inputs', () => {
    expect(calculatePowerTSS(0, 200, 200)).toBe(0);
    expect(calculatePowerTSS(3600, 0, 200)).toBe(0);
    expect(calculatePowerTSS(3600, 200, 0)).toBe(0);
  });
});

describe('estimateTSSFromPowerSummary', () => {
  it('prefers weighted_average_watts over average_watts as the NP proxy', () => {
    const tss = estimateTSSFromPowerSummary(3600, 220, 180, 200);
    expect(tss).toBeCloseTo(calculatePowerTSS(3600, 220, 200), 5);
  });

  it('falls back to average_watts when weighted_average_watts is absent', () => {
    const tss = estimateTSSFromPowerSummary(3600, undefined, 180, 200);
    expect(tss).toBeCloseTo(calculatePowerTSS(3600, 180, 200), 5);
  });

  it('returns 0 when no power data is present', () => {
    expect(estimateTSSFromPowerSummary(3600, undefined, undefined, 200)).toBe(0);
  });
});

describe('estimateTSSFromHR', () => {
  it('returns exactly 100 for 1 hour at avgHr == thresholdHr (definitional anchor)', () => {
    expect(estimateTSSFromHR(3600, 170, 170)).toBeCloseTo(100, 5);
  });

  it('scales quadratically with intensity ratio', () => {
    // 1h @ HR=150% of threshold -> ratio=1.5 -> 1 * 1.5^2 * 100 = 225
    expect(estimateTSSFromHR(3600, 255, 170)).toBeCloseTo(225, 5);
  });

  it('returns 0 for invalid or missing inputs', () => {
    expect(estimateTSSFromHR(3600, undefined, 170)).toBe(0);
    expect(estimateTSSFromHR(3600, 150, 0)).toBe(0);
    expect(estimateTSSFromHR(0, 150, 170)).toBe(0);
  });
});

describe('estimateActivityTSS priority dispatch', () => {
  const withDetailedNP = (np: number): StravaActivity => ({
    ...makeActivity(todayIso(), 'Ride', 3600),
    detailed_metrics: { normalized_power: np },
  });

  it('prefers real stream-derived NP over power-summary fields', () => {
    const activity: StravaActivity = {
      ...withDetailedNP(210),
      weighted_average_watts: 180,
      average_watts: 170,
    };
    const tss = estimateActivityTSS(activity, 200, DEFAULT_THRESHOLD_HR);
    expect(tss).toBeCloseTo(calculatePowerTSS(3600, 210, 200), 5);
  });

  it('falls back to power-summary fields when no real NP exists', () => {
    const activity: StravaActivity = {
      ...makeActivity(todayIso(), 'Ride', 3600),
      weighted_average_watts: 190,
    };
    const tss = estimateActivityTSS(activity, 200, DEFAULT_THRESHOLD_HR);
    expect(tss).toBeCloseTo(calculatePowerTSS(3600, 190, 200), 5);
  });

  it('falls back to HR when no power data exists at all', () => {
    const activity = makeActivity(todayIso(), 'Ride', 3600, 30000, 100, 170);
    const tss = estimateActivityTSS(activity, 200, 170);
    expect(tss).toBeCloseTo(estimateTSSFromHR(3600, 170, 170), 5);
  });

  it('returns 0 when neither power nor HR data exists', () => {
    const activity: StravaActivity = { ...makeActivity(todayIso(), 'Ride', 3600), average_heartrate: undefined };
    expect(estimateActivityTSS(activity, 200, DEFAULT_THRESHOLD_HR)).toBe(0);
  });
});

describe('buildDailyTssSeries', () => {
  it('fills rest days with explicit 0 entries rather than skipping them', () => {
    const activity = { ...makeActivity(todayIso(), 'Ride', 3600), weighted_average_watts: 200 };
    const series = buildDailyTssSeries([activity], 200, DEFAULT_THRESHOLD_HR, 7);
    expect(series).toHaveLength(7);
    expect(series.filter(v => v === 0)).toHaveLength(6);
    expect(series[series.length - 1]).toBeCloseTo(100, 5);
  });

  it('returns an all-zero series for no activities', () => {
    const series = buildDailyTssSeries([], 200, DEFAULT_THRESHOLD_HR, 10);
    expect(series).toEqual(Array(10).fill(0));
  });
});

describe('calculateCtlAtlSeries', () => {
  it('keeps both series at 0 for an all-zero input', () => {
    const { ctl, atl } = calculateCtlAtlSeries(Array(30).fill(0));
    expect(ctl.every(v => v === 0)).toBe(true);
    expect(atl.every(v => v === 0)).toBe(true);
  });

  it('converges both series toward a constant daily TSS, with ATL converging faster', () => {
    const dailyTss = Array(90).fill(50);
    const { ctl, atl } = calculateCtlAtlSeries(dailyTss);
    const finalCtl = ctl[ctl.length - 1];
    const finalAtl = atl[atl.length - 1];

    // ATL (7d constant) should be much closer to the steady-state value of 50 than CTL (42d constant)
    expect(Math.abs(finalAtl - 50)).toBeLessThan(Math.abs(finalCtl - 50));
    expect(finalCtl).toBeGreaterThan(0);
    expect(finalCtl).toBeLessThanOrEqual(50);
  });

  it('moves ATL more than CTL in response to a single isolated spike', () => {
    const dailyTss = [...Array(30).fill(0), 200, ...Array(10).fill(0)];
    const { ctl, atl } = calculateCtlAtlSeries(dailyTss);
    const spikeIndex = 30;
    expect(atl[spikeIndex]).toBeGreaterThan(ctl[spikeIndex]);
  });
});
