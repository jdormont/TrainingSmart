import type { StravaActivity } from '../types';

export const POWER_CURVE_DURATIONS: { key: string; seconds: number }[] = [
  { key: '1s', seconds: 1 },
  { key: '5s', seconds: 5 },
  { key: '15s', seconds: 15 },
  { key: '30s', seconds: 30 },
  { key: '1m', seconds: 60 },
  { key: '2m', seconds: 120 },
  { key: '5m', seconds: 300 },
  { key: '10m', seconds: 600 },
  { key: '20m', seconds: 1200 },
  { key: '60m', seconds: 3600 },
];

export interface PowerCurvePoint {
  duration: string;
  seconds: number;
  watts: number;
}

/** Best power seen for each duration across a set of activities. */
export function selectBestPowerCurve(activities: StravaActivity[]): PowerCurvePoint[] {
  return POWER_CURVE_DURATIONS.map(({ key, seconds }) => {
    let best = 0;
    for (const activity of activities) {
      const value = activity.detailed_metrics?.power_curve?.[key as keyof NonNullable<
        NonNullable<StravaActivity['detailed_metrics']>['power_curve']
      >];
      if (typeof value === 'number' && value > best) best = value;
    }
    return { duration: key, seconds, watts: best };
  }).filter(p => p.watts > 0);
}

export interface PowerCurveComparisonPoint {
  duration: string;
  seconds: number;
  recent: number;
  prior: number;
}

/**
 * Compares best power-per-duration between a recent window and the window before it,
 * so the dashboard can show training growth rather than just a single-ride snapshot.
 */
export function selectPowerCurveComparison(
  activities: StravaActivity[],
  recentDays = 30,
  priorRangeDays = 60
): PowerCurveComparisonPoint[] {
  const now = Date.now();
  const recentCutoff = now - recentDays * 24 * 60 * 60 * 1000;
  const priorCutoff = now - priorRangeDays * 24 * 60 * 60 * 1000;

  const recentActivities: StravaActivity[] = [];
  const priorActivities: StravaActivity[] = [];

  for (const activity of activities) {
    const t = new Date(activity.start_date_local).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= recentCutoff) {
      recentActivities.push(activity);
    } else if (t >= priorCutoff) {
      priorActivities.push(activity);
    }
  }

  const recentCurve = selectBestPowerCurve(recentActivities);
  const priorCurve = selectBestPowerCurve(priorActivities);

  return POWER_CURVE_DURATIONS.map(({ key, seconds }) => ({
    duration: key,
    seconds,
    recent: recentCurve.find(p => p.duration === key)?.watts || 0,
    prior: priorCurve.find(p => p.duration === key)?.watts || 0,
  })).filter(p => p.recent > 0 || p.prior > 0);
}
