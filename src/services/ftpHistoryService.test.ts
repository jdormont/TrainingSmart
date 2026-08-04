import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ftpHistoryService } from './ftpHistoryService';
import { supabase } from './supabaseClient';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: { getUser: vi.fn() },
  },
}));

function ftpRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ftp-1',
    ftp_watts: 210,
    effective_date: '2026-06-19',
    source: 'zwift_test',
    confidence: 'confirmed',
    note: 'Ramp test',
    created_at: '2026-06-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('ftpHistoryService', () => {
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

  describe('getCurrentFtp', () => {
    it('orders by effective_date desc, preferring confirmed over estimated on ties', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: ftpRow(), error: null });

      const result = await ftpHistoryService.getCurrentFtp();

      expect(mockChain.order).toHaveBeenCalledWith('effective_date', { ascending: false });
      expect(mockChain.order).toHaveBeenCalledWith('confidence', { ascending: true });
      expect(result).toMatchObject({ ftpWatts: 210, effectiveDate: '2026-06-19', confidence: 'confirmed' });
    });

    it('returns null when no FTP has ever been recorded', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await ftpHistoryService.getCurrentFtp();
      expect(result).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('maps rows to camelCase entries ordered newest first', async () => {
      mockChain.limit.mockResolvedValueOnce({
        data: [ftpRow(), ftpRow({ id: 'ftp-0', ftp_watts: 208, effective_date: '2026-03-01' })],
        error: null,
      });

      const result = await ftpHistoryService.listHistory();

      expect(result).toHaveLength(2);
      expect(result[0].ftpWatts).toBe(210);
      expect(result[1].ftpWatts).toBe(208);
    });
  });

  describe('recordFtp', () => {
    it('upserts on (user_id, effective_date, source) so re-recording the same day/source overwrites', async () => {
      mockChain.single.mockResolvedValueOnce({ data: ftpRow(), error: null });

      await ftpHistoryService.recordFtp({
        ftpWatts: 210,
        effectiveDate: '2026-06-19',
        source: 'zwift_test',
        note: 'Ramp test',
      });

      expect(mockChain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123', ftp_watts: 210, effective_date: '2026-06-19', source: 'zwift_test', confidence: 'confirmed' }),
        { onConflict: 'user_id,effective_date,source' },
      );
    });

    it('defaults confidence to confirmed when not specified', async () => {
      mockChain.single.mockResolvedValueOnce({ data: ftpRow(), error: null });
      await ftpHistoryService.recordFtp({ ftpWatts: 220, effectiveDate: '2026-08-01', source: 'chat_reported' });
      expect(mockChain.upsert).toHaveBeenCalledWith(expect.objectContaining({ confidence: 'confirmed' }), expect.anything());
    });

    it('throws when no user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);
      await expect(
        ftpHistoryService.recordFtp({ ftpWatts: 210, effectiveDate: '2026-06-19', source: 'manual' }),
      ).rejects.toThrow('User not authenticated');
    });
  });
});
