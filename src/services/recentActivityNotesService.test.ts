import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recentActivityNotesService } from './recentActivityNotesService';
import { supabase } from './supabaseClient';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn() },
  },
}));

describe('recentActivityNotesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockChain).forEach(fn => {
      if (typeof fn === 'function' && 'mockReturnValue' in fn) fn.mockReturnValue(mockChain);
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);
    vi.setSystemTime(new Date('2026-08-02T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('list', () => {
    it('filters to the last 30 days by default', async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });

      await recentActivityNotesService.list();

      expect(mockChain.gte).toHaveBeenCalledWith('note_date', '2026-07-03');
    });

    it('respects a custom window', async () => {
      mockChain.order.mockResolvedValueOnce({ data: [], error: null });
      await recentActivityNotesService.list(7);
      expect(mockChain.gte).toHaveBeenCalledWith('note_date', '2026-07-26');
    });

    it('maps rows to camelCase notes', async () => {
      mockChain.order.mockResolvedValueOnce({
        data: [{ id: 'n1', note: 'New segment PR', note_date: '2026-08-01', source: 'chat', created_at: '2026-08-01T00:00:00.000Z' }],
        error: null,
      });
      const result = await recentActivityNotesService.list();
      expect(result).toEqual([
        expect.objectContaining({ id: 'n1', note: 'New segment PR', noteDate: '2026-08-01', source: 'chat' }),
      ]);
    });
  });

  describe('add', () => {
    it('defaults note_date to today when not provided', async () => {
      mockChain.single.mockResolvedValueOnce({
        data: { id: 'n1', note: 'Felt strong today', note_date: '2026-08-02', source: 'chat', created_at: '2026-08-02T00:00:00.000Z' },
        error: null,
      });

      await recentActivityNotesService.add('Felt strong today');

      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Felt strong today', note_date: '2026-08-02', source: 'chat' }),
      );
    });
  });

  describe('pruneExpired', () => {
    it('deletes rows older than the window as storage hygiene, not for correctness', async () => {
      mockChain.lt.mockResolvedValueOnce({ data: null, error: null });

      await recentActivityNotesService.pruneExpired();

      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.lt).toHaveBeenCalledWith('note_date', '2026-07-03');
    });
  });
});
