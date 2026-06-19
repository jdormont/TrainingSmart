// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { useBackgroundSync } from './useBackgroundSync';
import { supabase } from '../services/supabaseClient';
import { stravaCacheService } from '../services/stravaCacheService';
import { trainingPlansService } from '../services/trainingPlansService';
import { ouraApi } from '../services/ouraApi';

vi.mock('../services/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    }
  }
}));

vi.mock('../services/stravaCacheService', () => ({
  stravaCacheService: {
    getCacheStatus: vi.fn(),
    getActivities: vi.fn()
  }
}));

vi.mock('../services/trainingPlansService', () => ({
  trainingPlansService: {
    reconcileWorkoutsWithStrava: vi.fn()
  }
}));

vi.mock('../services/ouraApi', () => ({
  ouraApi: {
    isAuthenticated: vi.fn(),
    syncOuraToDatabase: vi.fn()
  }
}));

const invalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries } as unknown as QueryClient)
  };
});

describe('useBackgroundSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    } as any);
    vi.mocked(ouraApi.isAuthenticated).mockResolvedValue(false);
    vi.mocked(trainingPlansService.reconcileWorkoutsWithStrava).mockResolvedValue({
      autoLinkedCount: 0,
      suggestedCount: 0
    });
  });

  it('triggers a full sync when the Strava cache is stale', async () => {
    vi.mocked(stravaCacheService.getCacheStatus).mockResolvedValue({
      activitiesAge: undefined
    } as any);

    renderHook(() => useBackgroundSync());

    await waitFor(() => {
      expect(stravaCacheService.getActivities).toHaveBeenCalledWith(true, 50);
    });
    expect(trainingPlansService.reconcileWorkoutsWithStrava).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['dashboard-data'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['plan-data'] });
  });

  it('skips fetching fresh activities but still runs reconciliation when cache is fresh', async () => {
    vi.mocked(stravaCacheService.getCacheStatus).mockResolvedValue({
      activitiesAge: 1000
    } as any);

    renderHook(() => useBackgroundSync());

    await waitFor(() => {
      expect(trainingPlansService.reconcileWorkoutsWithStrava).toHaveBeenCalledTimes(1);
    });
    expect(stravaCacheService.getActivities).not.toHaveBeenCalled();
  });

  it('skips a second reconciliation pass on a rapid repeat tab-focus event within the cooldown window', async () => {
    vi.mocked(stravaCacheService.getCacheStatus).mockResolvedValue({
      activitiesAge: 1000
    } as any);

    renderHook(() => useBackgroundSync());

    await waitFor(() => {
      expect(trainingPlansService.reconcileWorkoutsWithStrava).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(trainingPlansService.reconcileWorkoutsWithStrava).toHaveBeenCalledTimes(1);
  });

  it('only syncs Oura data when ouraApi.isAuthenticated() resolves true', async () => {
    vi.mocked(stravaCacheService.getCacheStatus).mockResolvedValue({
      activitiesAge: undefined
    } as any);
    vi.mocked(ouraApi.isAuthenticated).mockResolvedValue(true);

    renderHook(() => useBackgroundSync());

    await waitFor(() => {
      expect(ouraApi.syncOuraToDatabase).toHaveBeenCalledWith('user-123');
    });
  });
});
