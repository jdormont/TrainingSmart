import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subDays } from 'date-fns';
import { memoryRollupService } from './memoryRollupService';
import { supabase } from './supabaseClient';
import { stravaCacheService } from './stravaCacheService';
import { healthMetricsService } from './healthMetricsService';
import { ftpHistoryService } from './ftpHistoryService';
import type { DailyMetric, StravaActivity } from '../types';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('./stravaCacheService', () => ({
  stravaCacheService: {
    getActivitiesForStats: vi.fn(),
  },
}));

vi.mock('./healthMetricsService', () => ({
  healthMetricsService: {
    calculateHealthMetrics: vi.fn(),
  },
}));

vi.mock('./ftpHistoryService', () => ({
  ftpHistoryService: {
    getCurrentFtp: vi.fn(),
  },
}));

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1,
    start_date_local: new Date().toISOString(),
    moving_time: 3600,
    distance: 30000,
    ...overrides,
  } as StravaActivity;
}

function healthMetricsResult(overrides: Partial<Record<string, unknown>> = {}) {
  const dimension = (trend: 'improving' | 'stable' | 'declining' = 'stable', suggestion = '') => ({
    score: 75,
    components: [],
    trend,
    suggestion,
  });
  return {
    load: 75,
    consistency: 75,
    endurance: 75,
    intensity: 75,
    efficiency: 75,
    overallScore: 75,
    lastUpdated: new Date(),
    dataQuality: 'good' as const,
    details: {
      load: dimension(),
      consistency: dimension(),
      endurance: dimension(),
      intensity: dimension(),
      efficiency: dimension(),
    },
    profile: {} as any,
    ...overrides,
  };
}

describe('memoryRollupService.buildRollup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockChain).forEach(fn => {
      if (typeof fn === 'function' && 'mockReturnValue' in fn) fn.mockReturnValue(mockChain);
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);
    mockChain.lte.mockResolvedValue({ data: [], error: null });
    vi.mocked(stravaCacheService.getActivitiesForStats).mockResolvedValue([]);
    vi.mocked(ftpHistoryService.getCurrentFtp).mockResolvedValue(null);
    vi.mocked(healthMetricsService.calculateHealthMetrics).mockReturnValue(healthMetricsResult() as any);
  });

  it('computes recovery average and trend from daily metrics', async () => {
    const dailyMetrics: DailyMetric[] = [
      { user_id: 'u1', date: '2026-06-20', recovery_score: 80 },
      { user_id: 'u1', date: '2026-06-19', recovery_score: 80 },
      { user_id: 'u1', date: '2026-06-18', recovery_score: 50 },
      { user_id: 'u1', date: '2026-06-17', recovery_score: 50 },
    ];

    const result = await memoryRollupService.buildRollup(dailyMetrics);

    expect(result).toMatchObject({ periodDays: 4, avgRecoveryScore: 65, recoveryTrend: 'improving' });
  });

  it('computes plan adherence from workouts scheduled in the period and flags low adherence', async () => {
    mockChain.lte.mockResolvedValue({
      data: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'skipped' },
        { status: 'planned' },
        { status: 'planned' },
      ],
      error: null,
    });

    const result = await memoryRollupService.buildRollup([]);

    expect(result?.planAdherence).toEqual({
      scheduledCount: 5,
      completedCount: 2,
      skippedCount: 1,
      adherencePct: 40,
    });
    expect(result?.notableFlags).toContain(
      'Only 2/5 scheduled workouts completed this period (40%)',
    );
  });

  it('does not flag adherence when too few workouts were scheduled to be meaningful', async () => {
    mockChain.lte.mockResolvedValue({
      data: [{ status: 'skipped' }, { status: 'planned' }],
      error: null,
    });

    const result = await memoryRollupService.buildRollup([]);

    expect(result?.notableFlags ?? []).not.toContainEqual(expect.stringContaining('scheduled workouts completed'));
  });

  it('computes activity count and this-week-vs-last-week volume trend from cached activities', async () => {
    const now = new Date();
    vi.mocked(stravaCacheService.getActivitiesForStats).mockResolvedValue([
      activity({ start_date_local: subDays(now, 1).toISOString(), moving_time: 3600 }),
      activity({ start_date_local: subDays(now, 2).toISOString(), moving_time: 3600 }),
      activity({ start_date_local: subDays(now, 10).toISOString(), moving_time: 3600 }),
    ]);

    const result = await memoryRollupService.buildRollup([]);

    expect(result?.activityCount).toBe(3);
    expect(result?.weeklyVolumeTrend).toEqual({ thisWeek: 2, lastWeek: 1, pctChange: 100 });
  });

  it('surfaces a notableFlag and snapshot score when a health-metrics dimension is declining', async () => {
    vi.mocked(stravaCacheService.getActivitiesForStats).mockResolvedValue([activity()]);
    vi.mocked(healthMetricsService.calculateHealthMetrics).mockReturnValue(
      healthMetricsResult({
        details: {
          load: { score: 75, components: [], trend: 'stable', suggestion: '' },
          consistency: { score: 75, components: [], trend: 'stable', suggestion: '' },
          endurance: { score: 75, components: [], trend: 'stable', suggestion: '' },
          intensity: { score: 75, components: [], trend: 'stable', suggestion: '' },
          efficiency: { score: 50, components: [], trend: 'declining', suggestion: 'Efficiency Loss (-3.2%). Fatigue or detraining detected.' },
        },
      }) as any,
    );

    const result = await memoryRollupService.buildRollup([]);

    expect(result?.healthMetricsSnapshot).toMatchObject({ efficiency: 75 });
    expect(result?.notableFlags).toContain(
      'Efficiency declining: Efficiency Loss (-3.2%). Fatigue or detraining detected.',
    );
  });

  it('degrades gracefully when the activities fetch fails, still returning the recovery and adherence signal', async () => {
    vi.mocked(stravaCacheService.getActivitiesForStats).mockRejectedValue(new Error('network error'));
    mockChain.lte.mockResolvedValue({ data: [{ status: 'completed' }, { status: 'completed' }, { status: 'planned' }], error: null });

    const result = await memoryRollupService.buildRollup([
      { user_id: 'u1', date: '2026-06-20', recovery_score: 80 },
    ]);

    expect(result?.avgRecoveryScore).toBe(80);
    expect(result?.planAdherence?.scheduledCount).toBe(3);
    expect(result?.activityCount).toBe(0);
  });

  it('flags a declining recovery trend', async () => {
    const dailyMetrics: DailyMetric[] = [
      { user_id: 'u1', date: '2026-06-20', recovery_score: 40 },
      { user_id: 'u1', date: '2026-06-19', recovery_score: 40 },
      { user_id: 'u1', date: '2026-06-18', recovery_score: 80 },
      { user_id: 'u1', date: '2026-06-17', recovery_score: 80 },
    ];

    const result = await memoryRollupService.buildRollup(dailyMetrics);

    expect(result?.recoveryTrend).toBe('declining');
    expect(result?.notableFlags).toContain('Recovery score trending down over the rollup window');
  });
});
