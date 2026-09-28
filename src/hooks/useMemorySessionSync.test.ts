// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMemorySessionSync } from './useMemorySessionSync';
import { athleteProfileService } from '../services/athleteProfileService';
import { goalsService } from '../services/goalsService';
import { recentActivityNotesService } from '../services/recentActivityNotesService';
import { memoryRollupService } from '../services/memoryRollupService';
import { chatMemorySyncStateService } from '../services/chatMemorySyncStateService';
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

vi.mock('../services/memoryRollupService', () => ({
  memoryRollupService: {
    buildRollup: vi.fn(),
  },
}));

vi.mock('../services/chatMemorySyncStateService', () => ({
  chatMemorySyncStateService: {
    getSyncedMessageCount: vi.fn(),
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

// Renders the hook and flushes the async on-activation catch-up check
// (chatMemorySyncStateService.getSyncedMessageCount + a possible sync) that
// now fires on mount, so subsequent assertions see a settled state.
async function renderAndFlush(...args: Parameters<typeof useMemorySessionSync>) {
  const result = renderHook(({ a }: { a: Parameters<typeof useMemorySessionSync> }) => useMemorySessionSync(...a), {
    initialProps: { a: args },
  });
  await act(async () => {});
  return result;
}

describe('useMemorySessionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(athleteProfileService.mergeFromSession).mockResolvedValue(emptyMergeResult);
    vi.mocked(goalsService.getActiveGoal).mockResolvedValue(null);
    vi.mocked(recentActivityNotesService.pruneExpired).mockResolvedValue(undefined);
    vi.mocked(memoryRollupService.buildRollup).mockResolvedValue(undefined);
    vi.mocked(chatMemorySyncStateService.getSyncedMessageCount).mockResolvedValue(0);
    setVisibility('visible');
  });

  it('does nothing in demo mode', async () => {
    const session = buildSession('s1', 3);
    await renderAndFlush(session, true, []);

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
    expect(chatMemorySyncStateService.getSyncedMessageCount).not.toHaveBeenCalled();
  });

  it('does nothing when there is no active session', async () => {
    await renderAndFlush(null, false, []);

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('catches up immediately on activation when the session already has an unsynced backlog', async () => {
    const session = buildSession('s1', 2);

    await renderAndFlush(session, false, []);

    expect(chatMemorySyncStateService.getSyncedMessageCount).toHaveBeenCalledWith('s1');
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, undefined);
  });

  it('does not catch up on activation when the persisted watermark already covers the session', async () => {
    vi.mocked(chatMemorySyncStateService.getSyncedMessageCount).mockResolvedValue(2);
    const session = buildSession('s1', 2);

    await renderAndFlush(session, false, []);

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('catches up on only the backlog beyond a partially-persisted watermark', async () => {
    vi.mocked(chatMemorySyncStateService.getSyncedMessageCount).mockResolvedValue(1);
    const session = buildSession('s1', 2);

    await renderAndFlush(session, false, []);

    // 2 total - 1 already synced = 1 new message, below the threshold of 2.
    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('syncs when the tab is hidden and the new-message threshold is met', async () => {
    const session = buildSession('s1', 2);
    await renderAndFlush(session, false, []);

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, undefined);
    expect(recentActivityNotesService.pruneExpired).toHaveBeenCalledTimes(1);
  });

  it('does not sync when fewer than the minimum new user messages have arrived', async () => {
    const session = buildSession('s1', 1);
    await renderAndFlush(session, false, []);

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('does not re-sync on a second hidden event with no new user messages', async () => {
    const session = buildSession('s1', 2);
    await renderAndFlush(session, false, []);
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

  it('does not advance the watermark when the merge fails, so the backlog is retried on the next trigger', async () => {
    const session = buildSession('s1', 2);
    vi.mocked(athleteProfileService.mergeFromSession).mockRejectedValueOnce(new Error('edge function failed'));

    await renderAndFlush(session, false, []);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);

    vi.mocked(athleteProfileService.mergeFromSession).mockResolvedValue(emptyMergeResult);

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Same 2 messages, still unsynced after the failure — retried, not skipped.
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(2);
  });

  it('syncs again once enough additional user messages have arrived in the same session', async () => {
    let session = buildSession('s1', 2);
    const { rerender } = await renderAndFlush(session, false, []);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);

    session = buildSession('s1', 4);
    rerender({ a: [session, false, []] });

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(2);
  });

  it('syncs the outgoing session when the active session is switched', async () => {
    const sessionA = buildSession('a', 2);
    // Below the sync threshold so switching to it doesn't independently
    // trigger its own activation catch-up, keeping this test focused on the
    // outgoing session's flush-on-switch behavior.
    const sessionB = buildSession('b', 1);
    const { rerender } = await renderAndFlush(sessionA, false, []);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    vi.mocked(athleteProfileService.mergeFromSession).mockClear();

    await act(async () => {
      rerender({ a: [sessionB, false, []] });
    });

    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('syncs on unmount', async () => {
    const session = buildSession('s1', 2);
    const { unmount } = await renderAndFlush(session, false, []);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    vi.mocked(athleteProfileService.mergeFromSession).mockClear();

    await act(async () => {
      unmount();
    });

    // Already fully synced by the activation catch-up — unmount finds nothing new.
    expect(athleteProfileService.mergeFromSession).not.toHaveBeenCalled();
  });

  it('syncs on unmount when messages arrived after the activation catch-up settled', async () => {
    let session = buildSession('s1', 0);
    const { rerender, unmount } = await renderAndFlush(session, false, []);

    session = buildSession('s1', 2);
    rerender({ a: [session, false, []] });

    await act(async () => {
      unmount();
    });

    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledTimes(1);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, undefined);
  });

  it('builds the memory rollup from the latest daily metrics and passes the result through to the sync call', async () => {
    const session = buildSession('s1', 2);
    const dailyMetrics = [
      { user_id: 'u1', date: '2026-06-20', recovery_score: 80 },
      { user_id: 'u1', date: '2026-06-21', recovery_score: 60 },
    ];
    const rollup = { periodDays: 2, activityCount: 5, avgRecoveryScore: 70, recoveryTrend: 'stable' as const };
    vi.mocked(memoryRollupService.buildRollup).mockResolvedValue(rollup);

    await renderAndFlush(session, false, dailyMetrics as any);

    expect(memoryRollupService.buildRollup).toHaveBeenCalledWith(dailyMetrics);
    expect(athleteProfileService.mergeFromSession).toHaveBeenCalledWith('s1', session.messages, rollup);
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

    await renderAndFlush(session, false, []);

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

    await renderAndFlush(session, false, []);

    const stored = JSON.parse(localStorage.getItem('pending_memory_suggestions') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ type: 'ftp_report', watts: 220, effectiveDate: '2026-08-01', note: 'Ramp test' });
  });
});
