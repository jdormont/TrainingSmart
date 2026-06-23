import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userMemoryService } from './userMemoryService';
import { supabase } from './supabaseClient';
import type { ChatMessage } from '../types';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

function memoryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: 'user-123',
    goals: ['Finish a century ride'],
    constraints: { injuries: ['left knee'] },
    preferences: { workoutTypes: ['endurance'] },
    notable_patterns: [],
    narrative: 'Training for a century ride, managing a left knee injury.',
    previous_narrative: null,
    confidence_scores: { goals: 0.8, constraints: 0.7, preferences: 0.6 },
    source_session_ids: ['session-1'],
    updated_at: '2026-06-20T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const userMessages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'My knee is feeling better now', timestamp: new Date() },
];

describe('userMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChain.select.mockReturnValue(mockChain);
    mockChain.upsert.mockReturnValue(mockChain);
    mockChain.insert.mockReturnValue(mockChain);
    mockChain.delete.mockReturnValue(mockChain);
    mockChain.eq.mockReturnValue(mockChain);
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);
  });

  describe('getMemory', () => {
    it('returns null when no memory row exists', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await userMemoryService.getMemory();
      expect(result).toBeNull();
    });

    it('maps a DB row to the camelCase UserMemory shape', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: memoryRow(), error: null });

      const result = await userMemoryService.getMemory();
      expect(result).toMatchObject({
        userId: 'user-123',
        goals: ['Finish a century ride'],
        constraints: { injuries: ['left knee'] },
        notablePatterns: [],
      });
    });

    it('returns null without querying when no user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);

      const result = await userMemoryService.getMemory();
      expect(result).toBeNull();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('updateMemoryFromSession', () => {
    it('reconciles a resolved injury: merges AI response, preserves previous_narrative, and writes an audit row', async () => {
      // getMemory() call inside updateMemoryFromSession
      mockChain.maybeSingle.mockResolvedValueOnce({ data: memoryRow(), error: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          goals: ['Finish a century ride'],
          constraints: {},
          preferences: { workoutTypes: ['endurance'] },
          notablePatterns: [],
          narrative: 'Training for a century ride. Knee injury has resolved.',
          confidenceScores: { goals: 0.9, constraints: 0.5, preferences: 0.6 },
          changeSummary: 'Resolved left knee injury based on user report.',
        }),
      });

      const updatedRow = memoryRow({
        constraints: {},
        narrative: 'Training for a century ride. Knee injury has resolved.',
        previous_narrative: 'Training for a century ride, managing a left knee injury.',
      });
      mockChain.single.mockResolvedValueOnce({ data: updatedRow, error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await userMemoryService.updateMemoryFromSession('session-2', userMessages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.supabase.co/functions/v1/openai-update-memory',
        expect.objectContaining({ method: 'POST' }),
      );

      const upsertPayload = mockChain.upsert.mock.calls[0][0];
      expect(upsertPayload.constraints).toEqual({});
      expect(upsertPayload.previous_narrative).toBe('Training for a century ride, managing a left knee injury.');
      expect(upsertPayload.source_session_ids).toEqual(['session-1', 'session-2']);

      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        session_id: 'session-2',
        change_summary: 'Resolved left knee injury based on user report.',
      });

      expect(result.narrative).toBe('Training for a century ride. Knee injury has resolved.');
    });

    it('reconciles a changed goal: existing goals are replaced by the merged AI response', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: memoryRow(), error: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          goals: ['Train for a gran fondo instead'],
          constraints: { injuries: ['left knee'] },
          preferences: { workoutTypes: ['endurance'] },
          notablePatterns: [],
          narrative: 'Switched goal from a century ride to a gran fondo.',
          confidenceScores: { goals: 0.85, constraints: 0.7, preferences: 0.6 },
          changeSummary: 'User changed their primary goal.',
        }),
      });

      mockChain.single.mockResolvedValueOnce({
        data: memoryRow({ goals: ['Train for a gran fondo instead'] }),
        error: null,
      });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await userMemoryService.updateMemoryFromSession('session-2', userMessages);

      const upsertPayload = mockChain.upsert.mock.calls[0][0];
      expect(upsertPayload.goals).toEqual(['Train for a gran fondo instead']);
      expect(result.goals).toEqual(['Train for a gran fondo instead']);
    });

    it('caps source_session_ids at the most recent 20 entries', async () => {
      const manySessions = Array.from({ length: 20 }, (_, i) => `session-${i}`);
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: memoryRow({ source_session_ids: manySessions }),
        error: null,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          goals: [],
          constraints: {},
          preferences: {},
          notablePatterns: [],
          narrative: '',
          confidenceScores: { goals: 0, constraints: 0, preferences: 0 },
          changeSummary: '',
        }),
      });

      mockChain.single.mockResolvedValueOnce({ data: memoryRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

      await userMemoryService.updateMemoryFromSession('session-new', userMessages);

      const upsertPayload = mockChain.upsert.mock.calls[0][0];
      expect(upsertPayload.source_session_ids).toHaveLength(20);
      expect(upsertPayload.source_session_ids[upsertPayload.source_session_ids.length - 1]).toBe('session-new');
      expect(upsertPayload.source_session_ids).not.toContain('session-0');
    });

    it('logs but does not throw when the audit insert fails', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: memoryRow(), error: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          goals: [],
          constraints: {},
          preferences: {},
          notablePatterns: [],
          narrative: '',
          confidenceScores: { goals: 0, constraints: 0, preferences: 0 },
          changeSummary: '',
        }),
      });
      mockChain.single.mockResolvedValueOnce({ data: memoryRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      await expect(
        userMemoryService.updateMemoryFromSession('session-2', userMessages),
      ).resolves.toBeDefined();
    });

    it('throws when the edge function responds with a non-ok status', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Memory update failed' }),
      });

      await expect(
        userMemoryService.updateMemoryFromSession('session-2', userMessages),
      ).rejects.toThrow('Memory update failed');
    });

    it('throws when no user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);

      await expect(
        userMemoryService.updateMemoryFromSession('session-2', userMessages),
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('applyDraft', () => {
    it('persists a reviewed draft and writes an audit row with no session_id', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const draft = {
        goals: ['Finish a century ride'],
        constraints: {},
        preferences: {},
        notablePatterns: [],
        narrative: 'Initial narrative from chat history.',
        confidenceScores: { goals: 0.5, constraints: 0.5, preferences: 0.5 },
        changeSummary: 'Initial memory generated from chat history',
      };

      mockChain.single.mockResolvedValueOnce({ data: memoryRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await userMemoryService.applyDraft(draft, ['session-1']);

      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        session_id: null,
        change_summary: 'Initial memory generated from chat history',
      });
      expect(result.userId).toBe('user-123');
    });
  });

  describe('clearMemory', () => {
    it('deletes the user_memory row for the authenticated user', async () => {
      mockChain.eq.mockResolvedValueOnce({ data: null, error: null });

      await userMemoryService.clearMemory();

      expect(supabase.from).toHaveBeenCalledWith('user_memory');
      expect(mockChain.delete).toHaveBeenCalled();
    });
  });
});
