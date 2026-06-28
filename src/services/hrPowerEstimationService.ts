import type { DetailedWorkoutMetrics } from '../types';

// Shared with calculateHeartRateEfficiencyBins in stravaCacheService.ts so the
// per-ride bucketing (real watts) and the cross-ride aggregation (this file)
// can never drift apart.
export const HR_POWER_BUCKET_DEFINITIONS = [
  { name: '100-130W', min: 100, max: 130 },
  { name: '130-160W', min: 130, max: 160 },
  { name: '160-190W', min: 160, max: 190 },
  { name: '190-220W', min: 190, max: 220 },
  { name: '220W+', min: 220, max: 9999 }
];

export const HR_CURVE_LOOKBACK_DAYS = 180;
export const HR_RECENCY_HALF_LIFE_DAYS = 60;
export const MIN_INDOOR_RIDES = 4;
export const MIN_TOTAL_SECONDS = 3600;
export const MIN_BUCKET_SECONDS = 120;
export const MIN_SURVIVING_BUCKETS = 2;

export interface IndoorPowerRideRow {
  start_date_local: string;
  device_watts?: boolean;
  detailed_metrics?: DetailedWorkoutMetrics | null;
}

export interface HrPowerBucketAgg {
  bucket: string;
  bucketMinWatts: number;
  bucketMaxWatts: number;
  bucketMidWatts: number;
  avgHr: number;
  totalSeconds: number;
  rideCount: number;
}

export interface PersonalHrPowerCurve {
  buckets: HrPowerBucketAgg[];
  sampleRideCount: number;
  totalSeconds: number;
  builtAt: string;
  lookbackDays: number;
}

/**
 * Aggregates each rider's own indoor (real power meter) rides into a personal
 * HR->power curve. Pure/testable: takes already-fetched rows, does no I/O.
 *
 * Each indoor ride's HR-per-bucket is itself subject to within-ride cardiac
 * drift; aggregating across rides partially averages this out but doesn't
 * correct for it. Riders whose qualifying indoor rides are mostly long will
 * see the model skew toward "drifted" HR, slightly over-estimating power for
 * short efforts. Not corrected in v1.
 */
export function aggregateHrPowerCurve(
  rows: IndoorPowerRideRow[],
  opts?: { now?: Date }
): PersonalHrPowerCurve | null {
  const now = opts?.now ?? new Date();

  const qualifying = rows.filter(
    r => r.device_watts === true && (r.detailed_metrics?.heartrate_efficiency?.avg_hr_at_power_buckets?.length ?? 0) > 0
  );

  if (qualifying.length < MIN_INDOOR_RIDES) return null;

  const bucketAccum = new Map<string, { weightedHrSum: number; weightSum: number; totalSeconds: number; rideCount: number }>();
  for (const def of HR_POWER_BUCKET_DEFINITIONS) {
    bucketAccum.set(def.name, { weightedHrSum: 0, weightSum: 0, totalSeconds: 0, rideCount: 0 });
  }

  for (const row of qualifying) {
    const ageDays = Math.max(0, (now.getTime() - new Date(row.start_date_local).getTime()) / 86400000);
    const recencyFactor = Math.pow(0.5, ageDays / HR_RECENCY_HALF_LIFE_DAYS);

    for (const b of row.detailed_metrics!.heartrate_efficiency!.avg_hr_at_power_buckets!) {
      const accum = bucketAccum.get(b.bucket);
      if (!accum || b.seconds <= 0) continue;
      const weight = b.seconds * recencyFactor;
      accum.weightedHrSum += weight * b.avg_hr;
      accum.weightSum += weight;
      accum.totalSeconds += b.seconds;
      accum.rideCount += 1;
    }
  }

  const totalSecondsAllBuckets = Array.from(bucketAccum.values()).reduce((acc, b) => acc + b.totalSeconds, 0);
  if (totalSecondsAllBuckets < MIN_TOTAL_SECONDS) return null;

  const survivingBuckets: HrPowerBucketAgg[] = [];
  for (const def of HR_POWER_BUCKET_DEFINITIONS) {
    const accum = bucketAccum.get(def.name)!;
    if (accum.totalSeconds < MIN_BUCKET_SECONDS || accum.weightSum <= 0) continue;
    survivingBuckets.push({
      bucket: def.name,
      bucketMinWatts: def.min,
      bucketMaxWatts: def.max,
      bucketMidWatts: def.min + 15,
      avgHr: Math.round(accum.weightedHrSum / accum.weightSum),
      totalSeconds: accum.totalSeconds,
      rideCount: accum.rideCount
    });
  }

  if (survivingBuckets.length < MIN_SURVIVING_BUCKETS) return null;

  return {
    buckets: survivingBuckets,
    sampleRideCount: qualifying.length,
    totalSeconds: totalSecondsAllBuckets,
    builtAt: now.toISOString(),
    lookbackDays: HR_CURVE_LOOKBACK_DAYS
  };
}

/**
 * Estimates a per-second watts series from a per-second HR series using
 * piecewise-linear interpolation over the personal HR->power curve's
 * (avgHr, bucketMidWatts) points. HR outside the rider's known range is
 * clamped to the nearest bucket's wattage rather than extrapolated -- the
 * simplest/safest default, though it flattens estimated power at the
 * extremes (an outdoor effort harder than anything ridden indoors will be
 * under-estimated). `hrCoveragePct` reports what fraction of valid HR
 * samples fell inside the known range, so low-confidence estimates can be
 * flagged downstream.
 */
export function estimatePowerSeriesFromHr(
  hrData: number[],
  curve: PersonalHrPowerCurve
): { estimatedWatts: number[] | null; hrCoveragePct: number } {
  const points = [...curve.buckets]
    .sort((a, b) => a.avgHr - b.avgHr)
    .map(b => ({ hr: b.avgHr, watts: b.bucketMidWatts }));

  if (points.length < 2) return { estimatedWatts: null, hrCoveragePct: 0 };

  const minHr = points[0].hr;
  const maxHr = points[points.length - 1].hr;

  const estimatedWatts: number[] = new Array(hrData.length);
  let validCount = 0;
  let inRangeCount = 0;

  for (let i = 0; i < hrData.length; i++) {
    const hr = hrData[i];
    if (!hr || hr <= 0) {
      estimatedWatts[i] = 0;
      continue;
    }
    validCount++;

    if (hr <= minHr) {
      estimatedWatts[i] = points[0].watts;
      continue;
    }
    if (hr >= maxHr) {
      estimatedWatts[i] = points[points.length - 1].watts;
      continue;
    }

    inRangeCount++;
    let segIdx = 0;
    for (let j = 0; j < points.length - 1; j++) {
      if (hr >= points[j].hr && hr <= points[j + 1].hr) {
        segIdx = j;
        break;
      }
    }
    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];
    const t = (hr - p0.hr) / (p1.hr - p0.hr);
    estimatedWatts[i] = p0.watts + t * (p1.watts - p0.watts);
  }

  const hrCoveragePct = validCount > 0 ? parseFloat(((inRangeCount / validCount) * 100).toFixed(1)) : 0;
  return { estimatedWatts, hrCoveragePct };
}
