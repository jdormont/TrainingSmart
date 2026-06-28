import { describe, it, expect } from 'vitest';
import {
  aggregateHrPowerCurve,
  estimatePowerSeriesFromHr,
  MIN_INDOOR_RIDES,
  type IndoorPowerRideRow,
  type PersonalHrPowerCurve
} from './hrPowerEstimationService';

describe('hrPowerEstimationService', () => {
  const daysAgo = (n: number) => {
    const d = new Date('2026-06-28T00:00:00Z');
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  const makeIndoorRide = (
    daysAgoCount: number,
    buckets: { bucket: string; avg_hr: number; seconds: number; efficiency_factor: number }[],
    deviceWatts = true
  ): IndoorPowerRideRow => ({
    start_date_local: daysAgo(daysAgoCount),
    device_watts: deviceWatts,
    detailed_metrics: {
      heartrate_efficiency: {
        avg_hr_at_power_buckets: buckets
      }
    }
  });

  const fullBucketSet = (hrOffset = 0) => [
    { bucket: '100-130W', avg_hr: 120 + hrOffset, seconds: 600, efficiency_factor: 1 },
    { bucket: '130-160W', avg_hr: 135 + hrOffset, seconds: 600, efficiency_factor: 1 },
    { bucket: '160-190W', avg_hr: 150 + hrOffset, seconds: 600, efficiency_factor: 1 },
    { bucket: '190-220W', avg_hr: 165 + hrOffset, seconds: 600, efficiency_factor: 1 }
  ];

  describe('aggregateHrPowerCurve', () => {
    it('returns null when there are fewer than MIN_INDOOR_RIDES qualifying rides', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES - 1 }, (_, i) => makeIndoorRide(i, fullBucketSet()));
      expect(aggregateHrPowerCurve(rows)).toBeNull();
    });

    it('ignores rides without device_watts (estimated power on Strava)', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES + 2 }, (_, i) => makeIndoorRide(i, fullBucketSet(), false));
      expect(aggregateHrPowerCurve(rows)).toBeNull();
    });

    it('builds a curve from enough qualifying indoor rides', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES }, (_, i) => makeIndoorRide(i, fullBucketSet()));
      const curve = aggregateHrPowerCurve(rows);

      expect(curve).not.toBeNull();
      expect(curve!.sampleRideCount).toBe(MIN_INDOOR_RIDES);
      expect(curve!.buckets.length).toBe(4);
      expect(curve!.buckets.find(b => b.bucket === '100-130W')?.avgHr).toBe(120);
    });

    it('drops buckets with fewer than 120 total seconds across all rides', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES }, (_, i) =>
        makeIndoorRide(i, [
          ...fullBucketSet(),
          { bucket: '220W+', avg_hr: 180, seconds: 20, efficiency_factor: 1 }
        ])
      );
      const curve = aggregateHrPowerCurve(rows);
      expect(curve!.buckets.find(b => b.bucket === '220W+')).toBeUndefined();
    });

    it('returns null when combined bucket-seconds is below MIN_TOTAL_SECONDS', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES }, (_, i) =>
        makeIndoorRide(i, [
          { bucket: '100-130W', avg_hr: 120, seconds: 150, efficiency_factor: 1 },
          { bucket: '130-160W', avg_hr: 135, seconds: 150, efficiency_factor: 1 }
        ])
      );
      expect(aggregateHrPowerCurve(rows)).toBeNull();
    });

    it('returns null when fewer than MIN_SURVIVING_BUCKETS buckets survive the 120s floor', () => {
      const rows = Array.from({ length: MIN_INDOOR_RIDES }, (_, i) =>
        makeIndoorRide(i, [{ bucket: '100-130W', avg_hr: 120, seconds: 1000, efficiency_factor: 1 }])
      );
      expect(aggregateHrPowerCurve(rows)).toBeNull();
    });

    it('weights more recent rides higher than older rides (recency-weighted avg_hr)', () => {
      const recentRow = makeIndoorRide(1, [
        { bucket: '100-130W', avg_hr: 110, seconds: 600, efficiency_factor: 1 },
        { bucket: '130-160W', avg_hr: 125, seconds: 600, efficiency_factor: 1 },
        { bucket: '160-190W', avg_hr: 140, seconds: 600, efficiency_factor: 1 }
      ]);
      const oldRows = Array.from({ length: MIN_INDOOR_RIDES - 1 }, () =>
        makeIndoorRide(179, [
          { bucket: '100-130W', avg_hr: 130, seconds: 600, efficiency_factor: 1 },
          { bucket: '130-160W', avg_hr: 145, seconds: 600, efficiency_factor: 1 },
          { bucket: '160-190W', avg_hr: 160, seconds: 600, efficiency_factor: 1 }
        ])
      );
      const curve = aggregateHrPowerCurve([recentRow, ...oldRows], { now: new Date('2026-06-28T00:00:00Z') });
      // The recent ride's lower HR should pull the weighted average below the
      // simple unweighted average of 110 and 130 (=120).
      expect(curve!.buckets.find(b => b.bucket === '100-130W')!.avgHr).toBeLessThan(120);
    });
  });

  describe('estimatePowerSeriesFromHr', () => {
    const curve: PersonalHrPowerCurve = {
      buckets: [
        { bucket: '100-130W', bucketMinWatts: 100, bucketMaxWatts: 130, bucketMidWatts: 115, avgHr: 120, totalSeconds: 600, rideCount: 4 },
        { bucket: '130-160W', bucketMinWatts: 130, bucketMaxWatts: 160, bucketMidWatts: 145, avgHr: 140, totalSeconds: 600, rideCount: 4 },
        { bucket: '160-190W', bucketMinWatts: 160, bucketMaxWatts: 190, bucketMidWatts: 175, avgHr: 160, totalSeconds: 600, rideCount: 4 }
      ],
      sampleRideCount: 4,
      totalSeconds: 1800,
      builtAt: new Date().toISOString(),
      lookbackDays: 180
    };

    it('interpolates watts linearly between known HR points', () => {
      const { estimatedWatts, hrCoveragePct } = estimatePowerSeriesFromHr([130], curve);
      // Halfway between 120bpm/115W and 140bpm/145W -> 130W
      expect(estimatedWatts![0]).toBeCloseTo(130, 0);
      expect(hrCoveragePct).toBe(100);
    });

    it('clamps to the lowest bucket for HR below the known range', () => {
      const { estimatedWatts, hrCoveragePct } = estimatePowerSeriesFromHr([90], curve);
      expect(estimatedWatts![0]).toBe(115);
      expect(hrCoveragePct).toBe(0);
    });

    it('clamps to the highest bucket for HR above the known range', () => {
      const { estimatedWatts, hrCoveragePct } = estimatePowerSeriesFromHr([200], curve);
      expect(estimatedWatts![0]).toBe(175);
      expect(hrCoveragePct).toBe(0);
    });

    it('treats missing/zero HR samples as zero watts and excludes them from coverage', () => {
      const { estimatedWatts, hrCoveragePct } = estimatePowerSeriesFromHr([0, 130, 130], curve);
      expect(estimatedWatts![0]).toBe(0);
      expect(hrCoveragePct).toBe(100);
    });

    it('returns null estimatedWatts when the curve has fewer than 2 buckets', () => {
      const tinyCurve: PersonalHrPowerCurve = {
        ...curve,
        buckets: [curve.buckets[0]]
      };
      const result = estimatePowerSeriesFromHr([120], tinyCurve);
      expect(result.estimatedWatts).toBeNull();
      expect(result.hrCoveragePct).toBe(0);
    });
  });
});
