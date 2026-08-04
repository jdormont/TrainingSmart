// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemorySessionSync } from './useMemorySessionSync';
import { athleteProfileService } from '../services/athleteProfileService';
import { goalsService } from '../services/goalsService';
import { recentActivityNotesService } from '../services/recentActivityNotesService';
import type { ChatSession } from '../types';

vi.mock('../services/athleteProfileService', () => ({
  athleteProfileService: {
    mergeFromSession: vi.fn(),
  },
}));

vi.mock('../services/goalsService', () => ({
  goalsService: {
    getActiveGoal: vi.fn(),
  },
}));

vi.mock('../services/recentActivityNotesService', () => ({
  recentActivityNotesService: {
    pruneExpired: vi.fn(),
  },
}));

function buildSession(id: string, userMessageCount: number): ChatSession {
  return {
    id,
    name: `Session ${id}`,
    messages: Array.from({ length: userMessageCount }, (_, i) => ({
      id: `${id}-m${i}`,
      role: 'user' as const,
      content: `message ${i}`,
      timestamp: new Date(),
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

const emptyMergeResult = { profile: {} as any, goalCompletionSuggested: null, ftpReportSuggested: null };

describe('useMemorySessionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(athleteProfileService.mergeFromSession).mockResolvedValue(emptyMergeResult);
    vi.mocked(goalsService.getActiveGoal).mockResolvedValue(null);
    vi.mocked(recentActivityNotesService.pruneExpired).mockResolvedValue(undefined);
    setVisibility('visible');
  });

  it('does nothing in demo mode', async () => {
    const session = buildSession('s1', 3);
    renderHook(() => useMemorySessionSync(session, true, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active session', async () => {
    renderHook(() => useMemorySessionSync(null, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('syncs when the tab is hidden and the new-message threshold is met', async () => {
    const session = buildSession('s1', 2);
    renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, undefined);
    expect(recentActivityNotesService.pruneExpired).toHaveBeenCalledTimes(1);
  });

  it('does not sync when fewer than the minimum new user messages have arrived', async () => {
    const session = buildSession('s1', 1);
    renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('does not re-sync on a second hidden event with no new user messages', async () => {
    const session = buildSession('s1', 2);
    renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
  });

  it('syncs again once enough additional user messages have arrived in the same session', async () => {
    let session = buildSession('s1', 2);
    const { rerender } = renderHook(
      ({ s }: { s: ChatSession }) => useMemorySessionSync(s, false, []),
      { initialProps: { s: session } },
    );

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);

    session = buildSession('s1', 4);
    rerender({ s: session });

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(2);
  });

  it('syncs the outgoing session when the active session is switched', async () => {
    const sessionA = buildSession('a', 2);
    const sessionB = buildSession('b', 2);
    const { rerender } = renderHook(
      ({ s }: { s: ChatSession }) => useMemorySessionSync(s, false, []),
      { initialProps: { s: sessionA } },
    );

    await act(async () => {
      rerender({ s: sessionB });
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('a', sessionA.messages, undefined);
  });

  it('syncs on unmount', async () => {
    const session = buildSession('s1', 2);
    const { unmount } = renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      unmount();
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, undefined);
  });

  it('builds a recovery rollup from daily metrics and passes it through to the sync call', async () => {
    const session = buildSession('s1', 2);
    const dailyMetrics = [
      { user_id: 'u1', date: '2026-06-20', recovery_score: 80 },
      { user_id: 'u1', date: '2026-06-21', recovery_score: 60 },
    ];
    renderHook(() => useMemorySessionSync(session, false, dailyMetrics as any));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith(
      's1',
      session.messages,
      expect.objectContaining({ periodDays: 2, avgRecoveryScore: 70 }),
    );
  });

  it('queues a pending goal-completion suggestion without closing the goal', async () => {
    const session = buildSession('s1', 2);
    vi.mocked(athleteProfileService.mergeFromSession).mockResolvedValue({
      profile: {} as any,
      goalCompletionSuggested: { reason: 'Athlete mentioned finishing the event' },
      ftpReportSuggested: null,
    });
    vi.mocked(goalsService.getActiveGoal).mockResolvedValue({
      id: 'goal-1',
      title: 'Century ride',
    } as any);

    renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const stored = JSON.parse(localStorage.getItem('pending_memory_suggestions') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      type: 'goal_completion',
      goalId: 'goal-1',
      goalTitle: 'Century ride',
      reason: 'Athlete mentioned finishing the event',
    });
  });

  it('queues a pending FTP report suggestion', async () => {
    const session = buildSession('s1', 2);
    localStorage.clear();
    vi.mocked(athleteProfileService.mergeFromSession).mockResolvedValue({
      profile: {} as any,
      goalCompletionSuggested: null,
      ftpReportSuggested: { watts: 220, effectiveDate: '2026-08-01', note: 'Ramp test' },
    });

    renderHook(() => useMemorySessionSync(session, false, []));

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    const stored = JSON.parse(localStorage.getItem('pending_memory_suggestions') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: 'ftp_report', watts: 220, effectiveDate: '2026-08-01', note: 'Ramp test' });
  });
});
