import { describe, it, expect } from 'vitest';
import {
  calculateNormalizedPower,
  calculatePowerCurve,
  calculateHeartRateEfficiencyBins,
  calculateCardiacDecoupling,
  calculateElevationPowerProfile,
  isEnrichableActivityType,
  prioritizeForEnrichment
} from './stravaCacheService';
import type { StravaActivity } from '../types';

describe('StravaCacheService Algorithms', () => {
  describe('calculateNormalizedPower', () => {
    it('returns 0 for empty or short watts streams', () => {
      expect(calculateNormalizedPower([])).toBe(0);
      expect(calculateNormalizedPower(Array(29).fill(200))).toBe(0);
    });

    it('calculates NP correctly for steady state watts', () => {
      // 30 seconds of 200W
      expect(calculateNormalizedPower(Array(30).fill(200))).toBe(200);
      // 100 seconds of 200W
      expect(calculateNormalizedPower(Array(100).fill(200))).toBe(200);
    });

    it('calculates NP correctly for variable watts', () => {
      // Create a variable pattern
      const watts = [
        ...Array(30).fill(100),
        ...Array(30).fill(300),
        ...Array(30).fill(100),
        ...Array(30).fill(300),
      ];
      const np = calculateNormalizedPower(watts);
      // We expect NP to be higher than average power (average is 200W)
      expect(np).toBeGreaterThan(200);
      // Verify math value
      expect(np).toBeCloseTo(222, 1);
    });
  });

  describe('calculatePowerCurve', () => {
    it('calculates peak power curve values correctly', () => {
      const watts = Array(1500).fill(200);
      
      // Inject peaks
      // 5s peak at 800W
      for (let i = 100; i < 105; i++) {
        watts[i] = 800;
      }
      
      // 1m (60s) peak at 400W (including the 5s of 800W)
      for (let i = 105; i < 160; i++) {
        watts[i] = 364;
      }

      const curve = calculatePowerCurve(watts);
      expect(curve['1s']).toBe(800);
      expect(curve['5s']).toBe(800);
      expect(curve['1m']).toBe(400); // 5*800 + 55*364 = 24020 / 60 = 400
      expect(curve['5m']).toBe(240); // (24020 + 240*200) / 300 = 72020 / 300 = 240
    });

    it('includes the extended duration set (15s/30s/2m/10m/60m)', () => {
      const watts = Array(1500).fill(200);
      const curve = calculatePowerCurve(watts);
      expect(Object.keys(curve)).toEqual(
        expect.arrayContaining(['1s', '5s', '15s', '30s', '1m', '2m', '5m', '10m', '20m', '60m'])
      );
      // Steady 200W for less than 60m, so 60m should be 0 (insufficient samples)
      expect(curve['60m']).toBe(0);
      expect(curve['15s']).toBe(200);
      expect(curve['30s']).toBe(200);
      expect(curve['2m']).toBe(200);
      expect(curve['10m']).toBe(200);
    });
  });

  describe('calculateHeartRateEfficiencyBins', () => {
    it('returns empty array for mismatched or empty streams', () => {
      expect(calculateHeartRateEfficiencyBins([], [])).toEqual([]);
      expect(calculateHeartRateEfficiencyBins([100], [])).toEqual([]);
      expect(calculateHeartRateEfficiencyBins([100], [120, 130])).toEqual([]);
    });

    it('calculates efficiency factor for valid buckets with >= 30 samples', () => {
      // 30 seconds of 150W at 120 bpm
      const watts = Array(30).fill(150);
      const hr = Array(30).fill(120);

      const bins = calculateHeartRateEfficiencyBins(watts, hr);
      expect(bins).toHaveLength(1);
      expect(bins[0]).toEqual({
        bucket: '130-160W',
        avg_hr: 120,
        seconds: 30,
        efficiency_factor: 1.25 // 150 / 120 = 1.25
      });
    });

    it('ignores buckets with less than 30 samples', () => {
      // 29 seconds of 150W at 120 bpm
      const watts = Array(29).fill(150);
      const hr = Array(29).fill(120);

      const bins = calculateHeartRateEfficiencyBins(watts, hr);
      expect(bins).toEqual([]);
    });
  });

  describe('isEnrichableActivityType', () => {
    it('matches the exact Ride and Run types', () => {
      expect(isEnrichableActivityType('Ride')).toBe(true);
      expect(isEnrichableActivityType('Run')).toBe(true);
    });

    it('matches Strava ride/run variants, including VirtualRide', () => {
      expect(isEnrichableActivityType('VirtualRide')).toBe(true);
      expect(isEnrichableActivityType('EBikeRide')).toBe(true);
      expect(isEnrichableActivityType('GravelRide')).toBe(true);
      expect(isEnrichableActivityType('MountainBikeRide')).toBe(true);
      expect(isEnrichableActivityType('TrailRun')).toBe(true);
      expect(isEnrichableActivityType('VirtualRun')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isEnrichableActivityType('virtualride')).toBe(true);
      expect(isEnrichableActivityType('RIDE')).toBe(true);
    });

    it('rejects non-ride/run types and undefined', () => {
      expect(isEnrichableActivityType('WeightTraining')).toBe(false);
      expect(isEnrichableActivityType('Yoga')).toBe(false);
      expect(isEnrichableActivityType('Hike')).toBe(false);
      expect(isEnrichableActivityType(undefined)).toBe(false);
      expect(isEnrichableActivityType('')).toBe(false);
    });
  });

  describe('calculateElevationPowerProfile', () => {
    it('returns empty array for mismatched or empty streams', () => {
      expect(calculateElevationPowerProfile([], [])).toEqual([]);
      expect(calculateElevationPowerProfile([100], [])).toEqual([]);
      expect(calculateElevationPowerProfile([100], [1, 2])).toEqual([]);
    });

    it('buckets power by grade and ignores buckets with fewer than 30 samples', () => {
      // 30 seconds flat at 200W, 30 seconds climbing (6%) at 280W
      const watts = [...Array(30).fill(200), ...Array(30).fill(280)];
      const grade = [...Array(30).fill(1), ...Array(30).fill(6)];

      const profile = calculateElevationPowerProfile(watts, grade);
      expect(profile).toHaveLength(2);

      const flat = profile.find(p => p.grade_bucket === 'Flat (0-2%)');
      const climbing = profile.find(p => p.grade_bucket === 'Climbing (5-8%)');
      expect(flat).toEqual({ grade_bucket: 'Flat (0-2%)', avg_power: 200, seconds: 30 });
      expect(climbing).toEqual({ grade_bucket: 'Climbing (5-8%)', avg_power: 280, seconds: 30 });
    });

    it('includes avg_hr when a matching heart rate stream is provided', () => {
      const watts = Array(30).fill(250);
      const grade = Array(30).fill(7);
      const hr = Array(30).fill(165);

      const profile = calculateElevationPowerProfile(watts, grade, hr);
      expect(profile).toEqual([
        { grade_bucket: 'Climbing (5-8%)', avg_power: 250, avg_hr: 165, seconds: 30 }
      ]);
    });

    it('classifies negative grade as downhill', () => {
      const watts = Array(30).fill(120);
      const grade = Array(30).fill(-4);

      const profile = calculateElevationPowerProfile(watts, grade);
      expect(profile).toEqual([
        { grade_bucket: 'Downhill', avg_power: 120, seconds: 30 }
      ]);
    });
  });

  describe('calculateCardiacDecoupling', () => {
    it('returns null for short workouts < 600 seconds', () => {
      const watts = Array(599).fill(200);
      const hr = Array(599).fill(150);
      expect(calculateCardiacDecoupling(watts, hr)).toBeNull();
    });

    it('calculates positive drift (aerobic decoupling) correctly', () => {
      // 300 seconds of first half: 200W at 150 bpm (EF = 1.33)
      // 300 seconds of second half: 200W at 165 bpm (EF = 1.21)
      const watts = Array(600).fill(200);
      const hr = [
        ...Array(300).fill(150),
        ...Array(300).fill(165)
      ];

      const decoupling = calculateCardiacDecoupling(watts, hr);
      expect(decoupling).not.toBeNull();
      // EF1 = 200 / 150 = 1.3333
      // EF2 = 200 / 165 = 1.2121
      // drift = ((1.3333 - 1.2121) / 1.3333) * 100 = (0.1212 / 1.3333) * 100 = 9.09% ~ 9.1%
      expect(decoupling!.drift_percentage).toBeCloseTo(9.1, 1);
      expect(decoupling!.first_half_avg_hr).toBe(150);
      expect(decoupling!.second_half_avg_hr).toBe(165);
    });

    it('calculates negative drift correctly when heart rate drops', () => {
      // 300 seconds of first half: 200W at 160 bpm (EF = 1.25)
      // 300 seconds of second half: 200W at 150 bpm (EF = 1.33)
      const watts = Array(600).fill(200);
      const hr = [
        ...Array(300).fill(160),
        ...Array(300).fill(150)
      ];

      const decoupling = calculateCardiacDecoupling(watts, hr);
      expect(decoupling).not.toBeNull();
      // EF1 = 200 / 160 = 1.25
      // EF2 = 200 / 150 = 1.3333
      // drift = ((1.25 - 1.3333) / 1.25) * 100 = (-0.0833 / 1.25) * 100 = -6.66% ~ -6.7%
      expect(decoupling!.drift_percentage).toBeCloseTo(-6.7, 1);
    });
  });

  describe('prioritizeForEnrichment', () => {
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };

    const makeActivity = (id: number, daysAgoCount: number, movingTimeMin: number): StravaActivity => ({
      id,
      name: `Activity ${id}`,
      distance: 30000,
      moving_time: movingTimeMin * 60,
      elapsed_time: movingTimeMin * 60,
      total_elevation_gain: 100,
      type: 'Ride',
      sport_type: 'Ride',
      start_date: daysAgo(daysAgoCount),
      start_date_local: daysAgo(daysAgoCount),
      timezone: '(GMT+00:00) UTC',
      average_speed: 8,
      max_speed: 12,
      kudos_count: 0,
      comment_count: 0,
      athlete_count: 1,
      photo_count: 0,
      map: { id: '1', summary_polyline: '', resource_state: 2 },
    });

    it('puts >60min rides within the 6-week window ahead of shorter/older rides', () => {
      const shortOlder = makeActivity(1, 5, 30); // 30min, 5 days ago
      const longRecentInWindow = makeActivity(2, 1, 90); // 90min, 1 day ago - also the most recent
      const longOldOutsideWindow = makeActivity(3, 60, 90); // 90min, 60 days ago (outside 6wk window)

      const result = prioritizeForEnrichment([shortOlder, longRecentInWindow, longOldOutsideWindow]);

      expect(result[0].id).toBe(2); // the qualifying long+recent ride goes first
    });

    it('falls back to newest-first when no rides qualify as Economy candidates', () => {
      const older = makeActivity(1, 10, 20);
      const newer = makeActivity(2, 1, 20);

      const result = prioritizeForEnrichment([older, newer]);

      expect(result.map(a => a.id)).toEqual([2, 1]);
    });

    it('does not mutate the input array', () => {
      const a = makeActivity(1, 1, 90);
      const b = makeActivity(2, 2, 30);
      const input = [a, b];

      prioritizeForEnrichment(input);

      expect(input).toEqual([a, b]);
    });

    it('always enriches the most recent activity first, even when it is not an Economy candidate and a backlog of qualifying long rides exists', () => {
      const todayShortRide = makeActivity(99, 0, 20); // 20min, today - not an Economy candidate
      const backlog = [1, 2, 3, 4, 5].map(id => makeActivity(id, id + 1, 90)); // 90min rides within the 6wk window

      const result = prioritizeForEnrichment([...backlog, todayShortRide]);

      expect(result[0].id).toBe(99);
    });
  });
});
