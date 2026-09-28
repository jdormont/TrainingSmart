import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCoachingTool, COACHING_TOOLS } from './coachingTools';
import { stravaCacheService } from './stravaCacheService';
import { healthMetricsService } from './healthMetricsService';
import type { StravaActivity } from '../types';

vi.mock('./stravaCacheService', () => ({
  stravaCacheService: {
    getActivitiesForStats: vi.fn(),
    getPowerCurveRollup: vi.fn(),
    getDecouplingTrend: vi.fn(),
  },
}));

vi.mock('./healthMetricsService', () => ({
  healthMetricsService: {
    calculateLoad: vi.fn(),
  },
}));

describe('COACHING_TOOLS', () => {
  it('declares exactly the three tools by name', () => {
    expect(COACHING_TOOLS.map(t => t.name)).toEqual(['get_load_ratio', 'get_power_curve', 'get_decoupling_trend']);
  });

  it('gives every tool a non-trivial description and an object input schema', () => {
    for (const tool of COACHING_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }
  });
});

describe('executeCoachingTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves get_load_ratio from the acute:chronic component of calculateLoad', async () => {
    vi.mocked(stravaCacheService.getActivitiesForStats).mockResolvedValue([] as StravaActivity[]);
    vi.mocked(healthMetricsService.calculateLoad).mockReturnValue({
      score: 100,
      trend: 'improving',
      suggestion: 'Perfect Growth Zone (1.1 - 1.3). You are building fitness.',
      components: [
        { name: 'Acute Load (7d)', value: '300 mins', contribution: 0 },
        { name: 'A:C Ratio', value: '1.20', contribution: 100 },
      ],
    });

    const result = await executeCoachingTool({ id: 'call-1', name: 'get_load_ratio', input: {} });

    expect(stravaCacheService.getActivitiesForStats).toHaveBeenCalledWith(60);
    expect(JSON.parse(result)).toEqual({
      acuteChronicRatio: 1.2,
      trend: 'improving',
      assessment: 'Perfect Growth Zone (1.1 - 1.3). You are building fitness.',
    });
  });

  it('passes a windowDays input through to get_power_curve', async () => {
    vi.mocked(stravaCacheService.getPowerCurveRollup).mockResolvedValue({
      windowDays: 30,
      curve: { '5m': 260 },
      activityCount: 5,
    });

    const result = await executeCoachingTool({ id: 'call-2', name: 'get_power_curve', input: { windowDays: 30 } });

    expect(stravaCacheService.getPowerCurveRollup).toHaveBeenCalledWith(30);
    expect(JSON.parse(result)).toMatchObject({ windowDays: 30, curve: { '5m': 260 } });
  });

  it('calls get_power_curve with no window override when input omits windowDays', async () => {
    vi.mocked(stravaCacheService.getPowerCurveRollup).mockResolvedValue({
      windowDays: 90,
      curve: {},
      activityCount: 0,
    });

    await executeCoachingTool({ id: 'call-3', name: 'get_power_curve', input: {} });

    expect(stravaCacheService.getPowerCurveRollup).toHaveBeenCalledWith(undefined);
  });

  it('ignores a non-positive windowDays input rather than passing it through', async () => {
    vi.mocked(stravaCacheService.getDecouplingTrend).mockResolvedValue({
      windowDays: 60,
      recentAvgDriftPct: null,
      priorAvgDriftPct: null,
      trend: 'insufficient_data',
      rideCount: 0,
    });

    await executeCoachingTool({ id: 'call-4', name: 'get_decoupling_trend', input: { windowDays: -5 } });

    expect(stravaCacheService.getDecouplingTrend).toHaveBeenCalledWith(undefined);
  });

  it('returns a JSON error object for an unknown tool name instead of throwing', async () => {
    const result = await executeCoachingTool({ id: 'call-5', name: 'get_weather', input: {} });

    expect(JSON.parse(result)).toEqual({ error: 'Unknown tool: get_weather' });
  });

  it('returns a JSON error object instead of throwing when the underlying service call fails', async () => {
    vi.mocked(stravaCacheService.getPowerCurveRollup).mockRejectedValue(new Error('network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await executeCoachingTool({ id: 'call-6', name: 'get_power_curve', input: {} });

    expect(JSON.parse(result)).toEqual({ error: 'network error' });
    consoleSpy.mockRestore();
  });
});
