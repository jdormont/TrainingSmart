import { useEffect, useRef } from 'react';
import { userMemoryService } from '../services/userMemoryService';
import type { ChatSession, DailyMetric, MemoryRollupInput } from '../types';

const MIN_NEW_USER_MESSAGES_TO_SYNC = 2;

function buildRollup(dailyMetrics: DailyMetric[]): MemoryRollupInput | undefined {
  if (dailyMetrics.length === 0) return undefined;

  const recoveryScores = dailyMetrics
    .map(m => m.recovery_score)
    .filter((s): s is number => typeof s === 'number');

  if (recoveryScores.length === 0) {
    return { periodDays: dailyMetrics.length, activityCount: 0 };
  }

  const avgRecoveryScore = Math.round(
    recoveryScores.reduce((sum, s) => sum + s, 0) / recoveryScores.length,
  );

  const half = Math.floor(recoveryScores.length / 2);
  const recentAvg = recoveryScores.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(half, 1);
  const olderAvg = recoveryScores.slice(half).reduce((s, v) => s + v, 0) / Math.max(recoveryScores.length - half, 1);
  const recoveryTrend: MemoryRollupInput['recoveryTrend'] =
    recentAvg - olderAvg > 5 ? 'improving' : olderAvg - recentAvg > 5 ? 'declining' : 'stable';

  return {
    periodDays: dailyMetrics.length,
    activityCount: 0,
    avgRecoveryScore,
    recoveryTrend,
  };
}

/**
 * Folds the active chat session's new messages into the user's persistent
 * coach memory whenever the session goes idle: tab hidden, session switched,
 * or this component unmounts. No server cron exists, so this client-side
 * trigger is the only update path (mirrors useBackgroundSync's model).
 */
export function useMemorySessionSync(
  activeSession: ChatSession | null,
  isDemo: boolean,
  dailyMetrics: DailyMetric[] = [],
) {
  const syncedMessageCountRef = useRef<Record<string, number>>({});
  const latestSessionRef = useRef(activeSession);
  const latestDailyMetricsRef = useRef(dailyMetrics);
  latestSessionRef.current = activeSession;
  latestDailyMetricsRef.current = dailyMetrics;

  useEffect(() => {
    if (isDemo || !activeSession) return;

    const sessionId = activeSession.id;

    const sync = () => {
      const session = latestSessionRef.current;
      if (!session || session.id !== sessionId) return;

      const lastSynced = syncedMessageCountRef.current[sessionId] ?? 0;
      const newUserMessages = session.messages.filter(m => m.role === 'user').length;

      if (newUserMessages - lastSynced < MIN_NEW_USER_MESSAGES_TO_SYNC) return;

      syncedMessageCountRef.current[sessionId] = newUserMessages;

      userMemoryService
        .updateMemoryFromSession(sessionId, session.messages, buildRollup(latestDailyMetricsRef.current))
        .catch(err => console.error('Failed to sync memory for session', sessionId, err));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, isDemo]);
}
