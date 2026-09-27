import { startOfDay, subDays } from 'date-fns';
import { supabase } from './supabaseClient';
import { stravaCacheService } from './stravaCacheService';
import { healthMetricsService, HealthDimensionDetail } from './healthMetricsService';
import { ftpHistoryService } from './ftpHistoryService';
import type { DailyMetric, MemoryRollupInput, StravaAthlete } from '../types';

const DEFAULT_PERIOD_DAYS = 14;
const MIN_SCHEDULED_FOR_ADHERENCE_FLAG = 3;
const LOW_ADHERENCE_THRESHOLD_PCT = 60;
const MAX_NOTABLE_FLAGS = 5;

const HEALTH_DIMENSION_LABELS: Record<string, string> = {
  load: 'Training load',
  consistency: 'Consistency',
  endurance: 'Endurance',
  intensity: 'Intensity',
  efficiency: 'Efficiency',
};

interface RecoverySignal {
  periodDays: number;
  avgRecoveryScore?: number;
  recoveryTrend?: MemoryRollupInput['recoveryTrend'];
}

function buildRecoverySignal(dailyMetrics: DailyMetric[]): RecoverySignal | undefined {
  if (dailyMetrics.length === 0) return undefined;

  const recoveryScores = dailyMetrics
    .map(m => m.recovery_score)
    .filter((s): s is number => typeof s === 'number');

  if (recoveryScores.length === 0) {
    return { periodDays: dailyMetrics.length };
  }

  const avgRecoveryScore = Math.round(
    recoveryScores.reduce((sum, s) => sum + s, 0) / recoveryScores.length,
  );

  const half = Math.floor(recoveryScores.length / 2);
  const recentAvg = recoveryScores.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(half, 1);
  const olderAvg = recoveryScores.slice(half).reduce((s, v) => s + v, 0) / Math.max(recoveryScores.length - half, 1);
  const recoveryTrend: MemoryRollupInput['recoveryTrend'] =
    recentAvg - olderAvg > 5 ? 'improving' : olderAvg - recentAvg > 5 ? 'declining' : 'stable';

  return { periodDays: dailyMetrics.length, avgRecoveryScore, recoveryTrend };
}

/**
 * Plan adherence over the rollup window — scheduled workouts whose date has
 * already passed, bucketed by status. A 'planned' workout with a past date
 * is a missed workout (never marked completed or skipped).
 */
async function buildPlanAdherence(periodDays: number): Promise<MemoryRollupInput['planAdherence'] | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined;

  const today = startOfDay(new Date());
  const startDate = subDays(today, periodDays);

  const { data, error } = await supabase
    .from('workouts')
    .select('status')
    .eq('user_id', user.id)
    .gte('scheduled_date', startDate.toISOString().split('T')[0])
    .lte('scheduled_date', today.toISOString().split('T')[0]);

  if (error) {
    console.error('Error fetching workouts for plan-adherence rollup:', error);
    return undefined;
  }
  if (!data || data.length === 0) return undefined;

  const scheduledCount = data.length;
  const completedCount = data.filter(w => w.status === 'completed').length;
  const skippedCount = data.filter(w => w.status === 'skipped').length;

  return {
    scheduledCount,
    completedCount,
    skippedCount,
    adherencePct: Math.round((completedCount / scheduledCount) * 100),
  };
}

interface ActivitySignals {
  activityCount: number;
  weeklyVolumeTrend?: MemoryRollupInput['weeklyVolumeTrend'];
  healthMetricsSnapshot?: MemoryRollupInput['healthMetricsSnapshot'];
  decliningDimensionFlags: string[];
}

/**
 * Real activity/training-load signal, derived from the same cached Strava
 * activities and health-metrics calculator the dashboard already uses —
 * this is what actually observed behavior (not just chat text) looks like.
 */
async function buildActivitySignals(periodDays: number): Promise<ActivitySignals | undefined> {
  const activities = await stravaCacheService.getActivitiesForStats(Math.max(periodDays, 35)).catch(err => {
    console.error('Error fetching activities for memory rollup:', err);
    return [];
  });

  if (activities.length === 0) {
    return { activityCount: 0, decliningDimensionFlags: [] };
  }

  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 7);
  const twoWeeksAgo = subDays(today, 14);

  const thisWeekHours = activities
    .filter(a => new Date(a.start_date_local) >= weekAgo)
    .reduce((sum, a) => sum + a.moving_time, 0) / 3600;
  const lastWeekHours = activities
    .filter(a => {
      const d = new Date(a.start_date_local);
      return d >= twoWeeksAgo && d < weekAgo;
    })
    .reduce((sum, a) => sum + a.moving_time, 0) / 3600;

  const pctChange = lastWeekHours > 0
    ? Math.round(((thisWeekHours - lastWeekHours) / lastWeekHours) * 100)
    : 0;

  const weeklyVolumeTrend = {
    thisWeek: Math.round(thisWeekHours * 10) / 10,
    lastWeek: Math.round(lastWeekHours * 10) / 10,
    pctChange,
  };

  let healthMetricsSnapshot: MemoryRollupInput['healthMetricsSnapshot'];
  const decliningDimensionFlags: string[] = [];

  try {
    const ftp = await ftpHistoryService.getCurrentFtp().catch(() => null);
    const metrics = healthMetricsService.calculateHealthMetrics(
      {} as StravaAthlete,
      activities,
      [],
      [],
      ftp?.ftpWatts,
    );

    healthMetricsSnapshot = {
      load: metrics.load,
      consistency: metrics.consistency,
      endurance: metrics.endurance,
      intensity: metrics.intensity,
      efficiency: metrics.efficiency,
    };

    (Object.entries(metrics.details) as Array<[string, HealthDimensionDetail]>).forEach(([key, detail]) => {
      if (detail.trend === 'declining') {
        const label = HEALTH_DIMENSION_LABELS[key] ?? key;
        decliningDimensionFlags.push(`${label} declining: ${detail.suggestion}`);
      }
    });
  } catch (err) {
    console.error('Failed to compute health-metrics snapshot for memory rollup:', err);
  }

  return {
    activityCount: activities.length,
    weeklyVolumeTrend,
    healthMetricsSnapshot,
    decliningDimensionFlags,
  };
}

function buildNotableFlags(
  planAdherence: MemoryRollupInput['planAdherence'] | undefined,
  recovery: RecoverySignal | undefined,
  decliningDimensionFlags: string[],
): string[] {
  const flags: string[] = [];

  if (
    planAdherence &&
    planAdherence.scheduledCount >= MIN_SCHEDULED_FOR_ADHERENCE_FLAG &&
    planAdherence.adherencePct < LOW_ADHERENCE_THRESHOLD_PCT
  ) {
    flags.push(
      `Only ${planAdherence.completedCount}/${planAdherence.scheduledCount} scheduled workouts completed this period (${planAdherence.adherencePct}%)`,
    );
  }

  if (recovery?.recoveryTrend === 'declining') {
    flags.push('Recovery score trending down over the rollup window');
  }

  flags.push(...decliningDimensionFlags);

  return flags.slice(0, MAX_NOTABLE_FLAGS);
}

export const memoryRollupService = {
  /**
   * Builds the rollup injected into AI memory-merge calls (chat session sync,
   * history-backfill draft). Combines the recovery signal from already-fetched
   * DailyMetric rows with plan adherence, activity volume, and health-metrics
   * trend data pulled live — so notablePatterns can be learned from what the
   * athlete actually did, not only from what they say in chat.
   *
   * Each sub-signal degrades independently (a Strava-less or workout-less
   * account still gets a recovery-only rollup) and the whole call resolves to
   * undefined only when there is nothing at all to report.
   */
  async buildRollup(dailyMetrics: DailyMetric[], periodDaysOverride?: number): Promise<MemoryRollupInput | undefined> {
    const recovery = buildRecoverySignal(dailyMetrics);
    const periodDays = periodDaysOverride ?? recovery?.periodDays ?? DEFAULT_PERIOD_DAYS;

    const [planAdherence, activitySignals] = await Promise.all([
      buildPlanAdherence(periodDays).catch(err => {
        console.error('Error building plan-adherence signal for memory rollup:', err);
        return undefined;
      }),
      buildActivitySignals(periodDays).catch(err => {
        console.error('Error building activity signals for memory rollup:', err);
        return undefined;
      }),
    ]);

    if (!recovery && !planAdherence && !activitySignals) return undefined;

    const notableFlags = buildNotableFlags(planAdherence, recovery, activitySignals?.decliningDimensionFlags ?? []);

    return {
      periodDays,
      activityCount: activitySignals?.activityCount ?? 0,
      weeklyVolumeTrend: activitySignals?.weeklyVolumeTrend,
      avgRecoveryScore: recovery?.avgRecoveryScore,
      recoveryTrend: recovery?.recoveryTrend,
      healthMetricsSnapshot: activitySignals?.healthMetricsSnapshot,
      planAdherence,
      notableFlags: notableFlags.length > 0 ? notableFlags : undefined,
    };
  },
};
