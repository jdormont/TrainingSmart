import { describe, it, expect } from 'vitest';
import {
  formatDate,
  filterActivitiesByDays,
  calculateMetricsForPeriod,
  buildHistoricalSummary,
  buildMilestonesSummary,
  buildActivitiesTable
} from './openaiApi';
import type { StravaActivity } from '../types';

describe('OpenAIService Prompt Helpers', () => {
  const createActivity = (
    date: string,
    movingTimeSeconds: number,
    distanceMeters: number,
    type = 'Ride',
    avgHr = 150,
    maxHr = 180,
    avgWatts = 200,
    maxWatts = 300
  ): StravaActivity => ({
    id: Math.random(),
    name: `Test Ride on ${date}`,
    distance: distanceMeters,
    moving_time: movingTimeSeconds,
    elapsed_time: movingTimeSeconds,
    total_elevation_gain: 100, // 328.084 feet
    type,
    sport_type: type,
    start_date: `${date}T10:00:00Z`,
    start_date_local: `${date}T10:00:00`,
    timezone: '(GMT-05:00) America/New_York',
    average_speed: distanceMeters / movingTimeSeconds,
    max_speed: (distanceMeters / movingTimeSeconds) * 1.2,
    average_heartrate: avgHr,
    max_heartrate: maxHr,
    average_watts: avgWatts,
    max_watts: maxWatts,
    device_watts: true,
    kudos_count: 0,
    comment_count: 0,
    athlete_count: 1,
    photo_count: 0,
    map: { id: '1', summary_polyline: '', resource_state: 2 }
  });

  const getRelativeDateStr = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  describe('formatDate', () => {
    it('formats valid ISO dates correctly', () => {
      expect(formatDate('2026-05-27T18:00:00')).toBe('May 27');
      expect(formatDate('2026-12-01')).toBe('Dec 1');
    });

    it('returns N/A for invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('N/A');
    });
  });

  describe('filterActivitiesByDays', () => {
    it('filters activities within the specified days lookback', () => {
      const activities = [
        createActivity(getRelativeDateStr(2), 3600, 10000), // 2 days ago
        createActivity(getRelativeDateStr(10), 3600, 10000), // 10 days ago
        createActivity(getRelativeDateStr(45), 3600, 10000), // 45 days ago
      ];

      const filtered7 = filterActivitiesByDays(activities, 7);
      expect(filtered7.length).toBe(1);

      const filtered30 = filterActivitiesByDays(activities, 30);
      expect(filtered30.length).toBe(2);

      const filtered90 = filterActivitiesByDays(activities, 90);
      expect(filtered90.length).toBe(3);
    });
  });

  describe('calculateMetricsForPeriod', () => {
    it('calculates metrics correctly', () => {
      const activities = [
        createActivity(getRelativeDateStr(1), 3600, 16093.4, 'Ride', 140, 160, 200, 300), // 10 miles, 1 hour
        createActivity(getRelativeDateStr(2), 7200, 32186.8, 'Ride', 160, 180, 240, 400), // 20 miles, 2 hours
      ];

      const metrics = calculateMetricsForPeriod(activities, true);
      expect(metrics.count).toBe(2);
      expect(metrics.distanceMi).toBeCloseTo(30.0, 1);
      expect(metrics.durationHrs).toBeCloseTo(3.0, 1);
      expect(metrics.avgHr).toBe(150); // (140 + 160) / 2
      expect(metrics.avgPwr).toBe(220); // (200 + 240) / 2
    });
  });

  describe('buildHistoricalSummary', () => {
    it('builds a proper historical summary string', () => {
      const activities = [
        createActivity(getRelativeDateStr(2), 3600, 16093.4, 'Ride', 140, 160, 200, 300), // 10 miles, 1 hour (Last 7 days)
        createActivity(getRelativeDateStr(15), 7200, 32186.8, 'Ride', 160, 180, 240, 400), // 20 miles, 2 hours (Last 30 days)
      ];

      const summary = buildHistoricalSummary(activities, true);
      expect(summary).toContain('Last 7 Days**: 1 activities');
      expect(summary).toContain('Last 30 Days**: 2 activities');
      expect(summary).toContain('Last 90 Days**: 2 activities');
      expect(summary).toContain('Weekly Averages');
    });
  });

  describe('buildMilestonesSummary', () => {
    it('builds milestone highlights correctly', () => {
      const activities = [
        createActivity(getRelativeDateStr(2), 3600, 16093.4, 'Ride', 140, 160, 200, 300), // 10 miles, 1 hour
        createActivity(getRelativeDateStr(15), 7200, 48280.2, 'Ride', 160, 180, 250, 500), // 30 miles, 2 hours, higher power/HR
      ];

      const milestones = buildMilestonesSummary(activities, true);
      expect(milestones).toContain('Longest Distance**: 30.0 mi');
      expect(milestones).toContain('Longest Duration**: 2h 0m');
      expect(milestones).toContain('Peak Average Power**: 250w');
      expect(milestones).toContain('Peak Max Power**: 500w');
      expect(milestones).toContain('Highest Average HR**: 160 bpm');
    });
  });

  describe('buildActivitiesTable', () => {
    it('builds a Markdown table with the expected columns', () => {
      const activities = [
        createActivity(getRelativeDateStr(1), 3600, 16093.4, 'Ride', 140, 160, 200, 300),
      ];

      const table = buildActivitiesTable(activities, true);
      expect(table).toContain('| Date | Type | Distance | Duration | Elev Gain | Avg HR | Avg Power | Max Power |');
      expect(table).toContain('| Ride |');
      expect(table).toContain('10.0 mi');
      expect(table).toContain('1h 0m');
      expect(table).toContain('140 bpm');
      expect(table).toContain('200w');
      expect(table).toContain('300w');
    });

    it('appends detailed metrics appendix when present', () => {
      const activity = createActivity(getRelativeDateStr(1), 3600, 16093.4, 'Ride', 140, 160, 200, 300);
      activity.detailed_metrics = {
        normalized_power: 230,
        variability_index: 1.15,
        power_curve: {
          '1s': 600,
          '5s': 550,
          '1m': 380,
          '5m': 280,
          '20m': 220
        },
        time_in_zones: {
          power: [
            { zone: 1, min: 0, max: 100, seconds: 600, percentage: 16.7 },
            { zone: 2, min: 100, max: 200, seconds: 2400, percentage: 66.7 },
            { zone: 3, min: 200, max: 300, seconds: 600, percentage: 16.7 },
          ]
        },
        laps: [
          { lap_index: 1, distance: 8000, moving_time: 1800, avg_power: 190, avg_hr: 135, elevation_gain: 50 },
          { lap_index: 2, distance: 8093.4, moving_time: 1800, avg_power: 210, avg_hr: 145, elevation_gain: 50 }
        ]
      };

      const table = buildActivitiesTable([activity], true);
      expect(table).toContain('### Detailed Activity Metrics');
      expect(table).toContain('Normalized Power (NP):** 230W');
      expect(table).toContain('VI: 1.15');
      expect(table).toContain('Power Curve peaks:** 5s: 550W, 1m: 380W');
      expect(table).toContain('Power Zones:** Z1: 17%, Z2: 67%, Z3: 17%');
      expect(table).toContain('Lap 1: 30m 0s, Avg Power: 190W, Avg HR: 135 bpm');
    });
  });
});
