import { describe, it, expect } from 'vitest';
import { selectBestPowerCurve, selectPowerCurveComparison } from './powerCurveSelectors';
import type { StravaActivity } from '../types';

const daysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const createActivity = (
  startDateLocal: string,
  powerCurve?: Record<string, number>
): StravaActivity => ({
  id: Math.random(),
  name: 'Test Ride',
  distance: 10000,
  moving_time: 3600,
  elapsed_time: 3600,
  total_elevation_gain: 0,
  type: 'Ride',
  sport_type: 'Ride',
  start_date: startDateLocal,
  start_date_local: startDateLocal,
  timezone: '(GMT-05:00) America/New_York',
  average_speed: 5,
  max_speed: 6,
  kudos_count: 0,
  comment_count: 0,
  athlete_count: 1,
  photo_count: 0,
  map: { id: '1', summary_polyline: '', resource_state: 2 },
  detailed_metrics: powerCurve ? { power_curve: powerCurve as never } : undefined
});

describe('selectBestPowerCurve', () => {
  it('returns an empty array when no activities have power curve data', () => {
    const activities = [createActivity(daysAgo(1))];
    expect(selectBestPowerCurve(activities)).toEqual([]);
  });

  it('picks the best value per duration across multiple activities', () => {
    const activities = [
      createActivity(daysAgo(1), { '5s': 500, '1m': 300 }),
      createActivity(daysAgo(2), { '5s': 600, '5m': 250 }),
    ];

    const curve = selectBestPowerCurve(activities);
    expect(curve.find(p => p.duration === '5s')?.watts).toBe(600);
    expect(curve.find(p => p.duration === '1m')?.watts).toBe(300);
    expect(curve.find(p => p.duration === '5m')?.watts).toBe(250);
  });

  it('omits durations with no data across all activities', () => {
    const activities = [createActivity(daysAgo(1), { '5s': 500 })];
    const curve = selectBestPowerCurve(activities);
    expect(curve.map(p => p.duration)).toEqual(['5s']);
  });
});

describe('selectPowerCurveComparison', () => {
  it('separates activities into a recent window and a prior window', () => {
    const activities = [
      createActivity(daysAgo(5), { '5s': 600 }),  // recent (within 30 days)
      createActivity(daysAgo(45), { '5s': 500 }), // prior (30-60 days ago)
      createActivity(daysAgo(90), { '5s': 900 }), // outside both windows
    ];

    const comparison = selectPowerCurveComparison(activities, 30, 60);
    const fiveSec = comparison.find(p => p.duration === '5s');
    expect(fiveSec?.recent).toBe(600);
    expect(fiveSec?.prior).toBe(500);
  });

  it('returns an empty array when no activities have power curve data in either window', () => {
    const activities = [createActivity(daysAgo(1))];
    expect(selectPowerCurveComparison(activities)).toEqual([]);
  });

  it('still includes a duration if only one of the two windows has data', () => {
    const activities = [createActivity(daysAgo(5), { '20m': 220 })];
    const comparison = selectPowerCurveComparison(activities, 30, 60);
    const twentyMin = comparison.find(p => p.duration === '20m');
    expect(twentyMin).toEqual({ duration: '20m', seconds: 1200, recent: 220, prior: 0 });
  });
});
