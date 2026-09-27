import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatMemorySyncStateService } from './chatMemorySyncStateService';
import { supabase } from './supabaseClient';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}));

describe('chatMemorySyncStateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.select.mockReturnValue(mockChain);
    mockChain.update.mockReturnValue(mockChain);
  });

  describe('getSyncedMessageCount', () => {
    it('returns the persisted watermark for the session', async () => {
      mockChain.eq.mockReturnValueOnce(mockChain);
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { memory_synced_message_count: 4 }, error: null });

      const result = await chatMemorySyncStateService.getSyncedMessageCount('session-1');

      expect(supabase.from).toHaveBeenCalledWith('chat_sessions');
      expect(result).toBe(4);
    });

    it('returns 0 when the row has no watermark yet', async () => {
      mockChain.eq.mockReturnValueOnce(mockChain);
      mockChain.maybeSingle.mockResolvedValueOnce({ data: { memory_synced_message_count: null }, error: null });

      const result = await chatMemorySyncStateService.getSyncedMessageCount('session-1');

      expect(result).toBe(0);
    });

    it('returns 0 and logs instead of throwing when the query errors', async () => {
      mockChain.eq.mockReturnValueOnce(mockChain);
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('db error') });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await chatMemorySyncStateService.getSyncedMessageCount('session-1');

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('setSyncedMessageCount', () => {
    it('updates the watermark for the session', async () => {
      mockChain.eq.mockResolvedValueOnce({ error: null });

      await chatMemorySyncStateService.setSyncedMessageCount('session-1', 6);

      expect(supabase.from).toHaveBeenCalledWith('chat_sessions');
      expect(mockChain.update).toHaveBeenCalledWith({ memory_synced_message_count: 6 });
    });

    it('throws when the update fails, so the caller does not treat it as persisted', async () => {
      mockChain.eq.mockResolvedValueOnce({ error: new Error('db error') });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(chatMemorySyncStateService.setSyncedMessageCount('session-1', 6)).rejects.toThrow('db error');

      consoleSpy.mockRestore();
    });
  });
});
