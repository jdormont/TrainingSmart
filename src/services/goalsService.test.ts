import { describe, it, expect, vi, beforeEach } from 'vitest';
import { goalsService } from './goalsService';
import { supabase } from './supabaseClient';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));

function goalRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'goal-1',
    user_id: 'user-123',
    status: 'active',
    title: 'Century ride',
    description: null,
    target_date: '2026-09-22',
    block_start_date: null,
    block_end_date: null,
    event_type: null,
    success_criteria: [],
    confidence_score: null,
    source: 'manual',
    source_session_ids: [],
    closed_at: null,
    closed_reason: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('goalsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockChain).forEach(fn => {
      if (typeof fn === 'function' && 'mockReturnValue' in fn) fn.mockReturnValue(mockChain);
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);
  });

  describe('getActiveGoal', () => {
    it('returns the active goal mapped to camelCase', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: goalRow(), error: null });

      const result = await goalsService.getActiveGoal();

      expect(mockChain.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toMatchObject({ id: 'goal-1', title: 'Century ride', status: 'active', targetDate: '2026-09-22' });
    });

    it('returns null when there is no active goal', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await goalsService.getActiveGoal();
      expect(result).toBeNull();
    });

    it('returns null without querying when unauthenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);
      const result = await goalsService.getActiveGoal();
      expect(result).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('listGoalHistory', () => {
    it('excludes the active goal — filters by status != active', async () => {
      mockChain.limit.mockResolvedValueOnce({
        data: [goalRow({ id: 'goal-2', status: 'completed', closed_at: '2026-08-01T00:00:00.000Z' })],
        error: null,
      });

      const result = await goalsService.listGoalHistory();

      expect(mockChain.neq).toHaveBeenCalledWith('status', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
    });
  });

  describe('createActiveGoal', () => {
    it('inserts a new active goal with the given fields', async () => {
      mockChain.single.mockResolvedValueOnce({ data: goalRow({ title: 'New goal' }), error: null });

      await goalsService.createActiveGoal({ title: 'New goal', targetDate: '2026-09-22' });

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123', status: 'active', title: 'New goal', target_date: '2026-09-22', source: 'manual' }),
      );
    });

    it('defaults source to manual when not specified', async () => {
      mockChain.single.mockResolvedValueOnce({ data: goalRow(), error: null });
      await goalsService.createActiveGoal({ title: 'Century ride' });
      expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual' }));
    });
  });

  describe('updateActiveGoal', () => {
    it('only scopes the update to active rows for the given id', async () => {
      mockChain.single.mockResolvedValueOnce({ data: goalRow({ target_date: '2026-10-01' }), error: null });

      await goalsService.updateActiveGoal('goal-1', { targetDate: '2026-10-01' });

      expect(mockChain.eq).toHaveBeenCalledWith('id', 'goal-1');
      expect(mockChain.eq).toHaveBeenCalledWith('status', 'active');
      expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ target_date: '2026-10-01' }));
    });
  });

  describe('closeGoal', () => {
    it('sets status, closed_at, and closed_reason', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: goalRow({ status: 'completed', closed_at: '2026-08-02T00:00:00.000Z', closed_reason: 'Finished!' }),
        error: null,
      });

      const result = await goalsService.closeGoal('goal-1', 'completed', 'Finished!');

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', closed_reason: 'Finished!' }),
      );
      expect(result.status).toBe('completed');
      expect(result.closedReason).toBe('Finished!');
    });
  });

  describe('replaceActiveGoal', () => {
    it('calls the close_and_create_goal RPC and returns both the created and closed goal', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: goalRow({ id: 'goal-new', title: 'Next goal' }),
        error: null,
      } as any);
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: goalRow({ id: 'goal-1', status: 'completed' }),
        error: null,
      });

      const result = await goalsService.replaceActiveGoal(
        { title: 'Next goal' },
        { goalId: 'goal-1', status: 'completed', reason: 'Done' },
      );

      expect(supabase.rpc).toHaveBeenCalledWith('close_and_create_goal', expect.objectContaining({
        p_user_id: 'user-123',
        p_close_goal_id: 'goal-1',
        p_close_status: 'completed',
        p_new_title: 'Next goal',
      }));
      expect(result.created.id).toBe('goal-new');
      expect(result.closed?.status).toBe('completed');
    });

    it('creates a goal with no closure when none is provided', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: goalRow({ id: 'goal-new' }), error: null } as any);

      const result = await goalsService.replaceActiveGoal({ title: 'First goal' });

      expect(supabase.rpc).toHaveBeenCalledWith('close_and_create_goal', expect.objectContaining({ p_close_goal_id: null }));
      expect(result.closed).toBeNull();
    });
  });
});
