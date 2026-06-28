import type { StravaActivity, WeeklyStats } from '../types';
import { startOfWeek, endOfWeek } from 'date-fns';

export const calculateWeeklyStats = (activities: StravaActivity[]): WeeklyStats => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Filter activities for current week
  const weekActivities = activities.filter(activity => {
    // Strip Z to force local time parsing
    const dateStr = activity.start_date_local.endsWith('Z')
      ? activity.start_date_local.slice(0, -1)
      : activity.start_date_local;
    const activityDate = new Date(dateStr);
    return activityDate >= weekStart && activityDate <= weekEnd;
  });

  // Calculate totals
  const totals = weekActivities.reduce(
    (acc, activity) => ({
      distance: acc.distance + activity.distance,
      time: acc.time + activity.moving_time,
      elevation: acc.elevation + (activity.total_elevation_gain || 0),
    }),
    { distance: 0, time: 0, elevation: 0 }
  );

  return {
    weekStart,
    totalDistance: totals.distance,
    totalTime: totals.time,
    totalElevation: totals.elevation,
    activityCount: weekActivities.length,
    activities: weekActivities,
  };
};

export const calculateTrainingLoad = (activities: StravaActivity[]): number => {
  // Simple training load calculation based on time and intensity
  return activities.reduce((load, activity) => {
    const timeHours = activity.moving_time / 3600;
    const intensityFactor = activity.average_heartrate ?
      Math.min(activity.average_heartrate / 150, 1.5) : 1.0;
    return load + (timeHours * intensityFactor);
  }, 0);
};

export const getActivityTypeBreakdown = (activities: StravaActivity[]) => {
  const breakdown = activities.reduce((acc, activity) => {
    const type = activity.type;
    if (!acc[type]) {
      acc[type] = { count: 0, distance: 0, time: 0 };
    }
    acc[type].count += 1;
    acc[type].distance += activity.distance;
    acc[type].time += activity.moving_time;
    return acc;
  }, {} as Record<string, { count: number; distance: number; time: number }>);

  return Object.entries(breakdown).map(([type, data]) => ({
    type,
    ...data,
  }));
};

export const getRecentPerformanceTrend = (activities: StravaActivity[], activityType?: string) => {
  let filteredActivities = activities;

  if (activityType) {
    filteredActivities = activities.filter(a => a.type === activityType);
  }

  // Sort by date (most recent first)
  const sortedActivities = filteredActivities
    .sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime())
    .slice(0, 10); // Last 10 activities

  return sortedActivities.map(activity => ({
    date: activity.start_date_local,
    pace: activity.average_speed,
    distance: activity.distance,
    duration: activity.moving_time,
  }));
};

// ─────────────────────────────────────────────
// TSS / CTL / ATL ("Form") estimation
// ─────────────────────────────────────────────

// No LTHR/max-HR field exists on user_profiles today; this is a documented
// population-average fallback for the HR-only TSS path, and the weakest
// link in that path's accuracy.
export const DEFAULT_THRESHOLD_HR = 170;

const CTL_TIME_CONSTANT_DAYS = 42; // Chronic Training Load ("Fitness") - standard Coggan constant
const ATL_TIME_CONSTANT_DAYS = 7;  // Acute Training Load ("Fatigue") - standard Coggan constant

/**
 * Standard Coggan power-based TSS: TSS = (duration_sec * NP * IF) / (FTP * 3600) * 100,
 * where IF = NP / FTP. 1hr @ NP=FTP yields exactly TSS=100 by definition.
 */
export const calculatePowerTSS = (durationSec: number, np: number, ftp: number): number => {
  if (ftp <= 0 || np <= 0 || durationSec <= 0) return 0;
  const intensityFactor = np / ftp;
  return (durationSec * np * intensityFactor) / (ftp * 3600) * 100;
};

/**
 * Power-summary TSS: uses weighted_average_watts (or average_watts) as an NP
 * proxy for activities that weren't enriched with stream-derived NP.
 */
export const estimateTSSFromPowerSummary = (
  durationSec: number,
  weightedAvgWatts: number | undefined,
  avgWatts: number | undefined,
  ftp: number
): number => {
  const npProxy = weightedAvgWatts || avgWatts || 0;
  if (npProxy <= 0) return 0;
  return calculatePowerTSS(durationSec, npProxy, ftp);
};

/**
 * HR-based TSS fallback for activities with no power data at all. 1hr @
 * avgHr=thresholdHr yields exactly TSS=100, matching the power-based anchor.
 */
export const estimateTSSFromHR = (
  durationSec: number,
  avgHr: number | undefined,
  thresholdHr: number
): number => {
  if (!avgHr || avgHr <= 0 || thresholdHr <= 0 || durationSec <= 0) return 0;
  const durationHours = durationSec / 3600;
  const intensityRatio = avgHr / thresholdHr;
  return durationHours * Math.pow(intensityRatio, 2) * 100;
};

/**
 * Per-activity TSS with priority fallback: real NP (enriched rides) ->
 * HR-modeled NP (rides with no power meter but enough indoor-ride history to
 * model one) -> power-summary fields -> HR -> 0 (e.g. rest day or unscored
 * activity type).
 */
export const estimateActivityTSS = (activity: StravaActivity, ftp: number, thresholdHr: number): number => {
  const np = activity.detailed_metrics?.normalized_power;
  if (np && np > 0) {
    return calculatePowerTSS(activity.moving_time, np, ftp);
  }
  const estimatedNp = activity.detailed_metrics?.estimated_normalized_power;
  if (estimatedNp && estimatedNp > 0) {
    return calculatePowerTSS(activity.moving_time, estimatedNp, ftp);
  }
  if (activity.weighted_average_watts || activity.average_watts) {
    return estimateTSSFromPowerSummary(activity.moving_time, activity.weighted_average_watts, activity.average_watts, ftp);
  }
  if (activity.average_heartrate) {
    return estimateTSSFromHR(activity.moving_time, activity.average_heartrate, thresholdHr);
  }
  return 0;
};

/**
 * Buckets activities into a daily TSS series for the trailing `days` window,
 * ending today, with explicit 0 entries for rest days (required so the EMA
 * decays correctly - skipping gaps would understate fatigue/fitness decay).
 */
export const buildDailyTssSeries = (
  activities: StravaActivity[],
  ftp: number,
  thresholdHr: number,
  days: number
): number[] => {
  const dayKey = (d: Date) => d.toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tssByDay = new Map<string, number>();
  for (const activity of activities) {
    const dateStr = activity.start_date_local.endsWith('Z')
      ? activity.start_date_local.slice(0, -1)
      : activity.start_date_local;
    const key = dayKey(new Date(dateStr));
    const tss = estimateActivityTSS(activity, ftp, thresholdHr);
    tssByDay.set(key, (tssByDay.get(key) || 0) + tss);
  }

  const series: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    series.push(tssByDay.get(dayKey(d)) || 0);
  }
  return series;
};

/**
 * Computes CTL/ATL via exponentially-weighted moving average over a
 * day-by-day TSS series (oldest -> newest, one entry per calendar day,
 * 0 for rest days). Returns the full series; the last entry is "current".
 */
export const calculateCtlAtlSeries = (dailyTss: number[]): { ctl: number[]; atl: number[] } => {
  const ctlSeries: number[] = [];
  const atlSeries: number[] = [];
  let ctl = 0;
  let atl = 0;

  for (const tss of dailyTss) {
    ctl = ctl + (tss - ctl) * (1 / CTL_TIME_CONSTANT_DAYS);
    atl = atl + (tss - atl) * (1 / ATL_TIME_CONSTANT_DAYS);
    ctlSeries.push(ctl);
    atlSeries.push(atl);
  }

  return { ctl: ctlSeries, atl: atlSeries };
};