import { describe, it, expect, vi, beforeEach } from 'vitest';
import { athleteProfileService } from './athleteProfileService';
import { supabase } from './supabaseClient';
import { goalsService } from './goalsService';
import { recentActivityNotesService } from './recentActivityNotesService';
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
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('./goalsService', () => ({
  goalsService: {
    getActiveGoal: vi.fn(),
    updateActiveGoal: vi.fn(),
  },
}));

vi.mock('./recentActivityNotesService', () => ({
  recentActivityNotesService: {
    add: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

function profileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    user_id: 'user-123',
    constraints: { injuries: ['left knee'] },
    preferences: { workoutTypes: ['endurance'] },
    notable_patterns: [],
    narrative: 'Training consistently, managing a left knee injury.',
    previous_narrative: null,
    confidence_scores: { constraints: 70, preferences: 60 },
    source_session_ids: ['session-1'],
    updated_at: '2026-06-20T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

const userMessages: ChatMessage[] = [
  { id: 'm1', role: 'user', content: 'My knee is feeling better now', timestamp: new Date() },
];

function edgeResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    profile: {
      constraints: {},
      preferences: { workoutTypes: ['endurance'] },
      notablePatterns: [],
      narrative: 'Training consistently. Knee injury has resolved.',
      confidenceScores: { constraints: 50, preferences: 60 },
    },
    recentActivityNotes: [],
    activeGoalPatch: null,
    goalCompletionSuggested: null,
    ftpReportSuggested: null,
    changeSummary: 'Resolved left knee injury based on user report.',
    ...overrides,
  };
}

describe('athleteProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockChain).forEach(fn => {
      if (typeof fn === 'function' && 'mockReturnValue' in fn) fn.mockReturnValue(mockChain);
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);
    vi.mocked(goalsService.getActiveGoal).mockResolvedValue(null);
  });

  describe('getProfile', () => {
    it('returns null when no profile row exists', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await athleteProfileService.getProfile();
      expect(result).toBeNull();
    });

    it('maps a DB row to the camelCase AthleteProfile shape', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: profileRow(), error: null });
      const result = await athleteProfileService.getProfile();
      expect(result).toMatchObject({
        userId: 'user-123',
        constraints: { injuries: ['left knee'] },
        notablePatterns: [],
      });
      // Goals are not part of AthleteProfile — they live in the goals table.
      expect(result).not.toHaveProperty('goals');
    });
  });

  describe('mergeFromSession', () => {
    it('merges durable profile facts and writes an audit row, without touching goals', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => edgeResponse() });
      mockChain.single.mockResolvedValueOnce({
        data: profileRow({ constraints: {}, narrative: 'Training consistently. Knee injury has resolved.' }),
        error: null,
      });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });

      const result = await athleteProfileService.mergeFromSession('session-2', userMessages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.supabase.co/functions/v1/openai-update-memory',
        expect.objectContaining({ method: 'POST' }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.existingProfile).not.toHaveProperty('goals');

      expect(result.profile.narrative).toBe('Training consistently. Knee injury has resolved.');
      expect(result.goalCompletionSuggested).toBeNull();
      expect(result.ftpReportSuggested).toBeNull();
      expect(goalsService.updateActiveGoal).not.toHaveBeenCalled();
    });

    it('never closes or creates a goal itself — only surfaces goalCompletionSuggested for user confirmation', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => edgeResponse({ goalCompletionSuggested: { reason: 'Athlete said the trip is done' } }),
      });
      mockChain.single.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });
      vi.mocked(goalsService.getActiveGoal).mockResolvedValue({
        id: 'goal-1',
        title: 'England trip',
      } as any);

      const result = await athleteProfileService.mergeFromSession('session-2', userMessages);

      expect(result.goalCompletionSuggested).toEqual({ reason: 'Athlete said the trip is done' });
      // The service surfaces the suggestion but never calls a close/create goal method itself.
      expect(goalsService.updateActiveGoal).not.toHaveBeenCalled();
    });

    it('applies a narrow activeGoalPatch to the existing active goal when returned', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => edgeResponse({ activeGoalPatch: { targetDate: '2026-10-01' } }),
      });
      mockChain.single.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });
      vi.mocked(goalsService.getActiveGoal).mockResolvedValue({ id: 'goal-1', title: 'Century ride' } as any);
      vi.mocked(goalsService.updateActiveGoal).mockResolvedValue({} as any);

      await athleteProfileService.mergeFromSession('session-2', userMessages);

      expect(goalsService.updateActiveGoal).toHaveBeenCalledWith('goal-1', { targetDate: '2026-10-01' });
    });

    it('adds returned recentActivityNotes additively', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => edgeResponse({ recentActivityNotes: [{ note: 'New segment PR', noteDate: '2026-08-01' }] }),
      });
      mockChain.single.mockResolvedValueOnce({ data: profileRow(), error: null });
      mockChain.insert.mockResolvedValueOnce({ data: null, error: null });
      vi.mocked(recentActivityNotesService.add).mockResolvedValue({} as any);

      await athleteProfileService.mergeFromSession('session-2', userMessages);

      expect(recentActivityNotesService.add).toHaveBeenCalledWith('New segment PR', '2026-08-01', 'chat', 'session-2');
    });

    it('throws when no user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);
      await expect(
        athleteProfileService.mergeFromSession('session-2', userMessages),
      ).rejects.toThrow('User not authenticated');
    });

    it('throws when the edge function responds with a non-ok status', async () => {
      mockChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Profile update failed' }) });

      await expect(
        athleteProfileService.mergeFromSession('session-2', userMessages),
      ).rejects.toThrow('Profile update failed');
    });
  });

  describe('clearProfile', () => {
    it('deletes the athlete_profile row for the authenticated user', async () => {
      mockChain.eq.mockResolvedValueOnce({ data: null, error: null });
      await athleteProfileService.clearProfile();
      expect(supabase.from).toHaveBeenCalledWith('athlete_profile');
      expect(mockChain.delete).toHaveBeenCalled();
    });
  });
});
