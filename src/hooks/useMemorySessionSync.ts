import { useEffect, useRef } from 'react';
import { athleteProfileService } from '../services/athleteProfileService';
import { goalsService } from '../services/goalsService';
import { recentActivityNotesService } from '../services/recentActivityNotesService';
import { memoryRollupService } from '../services/memoryRollupService';
import { addPendingSuggestion } from '../utils/pendingMemorySuggestions';
import type { ChatSession, DailyMetric } from '../types';

const MIN_NEW_USER_MESSAGES_TO_SYNC = 2;

/**
 * Folds the active chat session's new messages into the user's persistent
 * athlete profile whenever the session goes idle: tab hidden, session switched,
 * or this component unmounts. No server cron exists, so this client-side
 * trigger is the only update path (mirrors useBackgroundSync's model).
 *
 * Any goal-completion or FTP-report suggestions the AI surfaces are queued as
 * confirm-first pending suggestions (see utils/pendingMemorySuggestions.ts) —
 * never applied automatically. Expired recent-activity-notes rows are pruned
 * opportunistically in the same idle callback.
 */
export function useMemorySessionSync(
  activeSession: ChatSession | null,
  isDemo: boolean,
  dailyMetrics: DailyMetric[] = [],
) {
  const syncedMessageCountRef = useRef<Record<string, number>>({});
  const sessionSnapshotsRef = useRef<Record<string, ChatSession>>({});
  const latestDailyMetricsRef = useRef(dailyMetrics);
  if (activeSession) sessionSnapshotsRef.current[activeSession.id] = activeSession;
  latestDailyMetricsRef.current = dailyMetrics;

  useEffect(() => {
    if (isDemo || !activeSession) return;

    const sessionId = activeSession.id;

    const sync = async () => {
      const session = sessionSnapshotsRef.current[sessionId];
      if (!session) return;

      const lastSynced = syncedMessageCountRef.current[sessionId] ?? 0;
      const newUserMessages = session.messages.filter(m => m.role === 'user').length;

      if (newUserMessages - lastSynced < MIN_NEW_USER_MESSAGES_TO_SYNC) return;

      syncedMessageCountRef.current[sessionId] = newUserMessages;

      try {
        const rollup = await memoryRollupService.buildRollup(latestDailyMetricsRef.current);
        const [result] = await Promise.all([
          athleteProfileService.mergeFromSession(sessionId, session.messages, rollup),
          recentActivityNotesService.pruneExpired(),
        ]);

        if (result.goalCompletionSuggested) {
          const activeGoal = await goalsService.getActiveGoal();
          if (activeGoal) {
            addPendingSuggestion({
              type: 'goal_completion',
              goalId: activeGoal.id,
              goalTitle: activeGoal.title,
              reason: result.goalCompletionSuggested.reason,
            });
          }
        }

        if (result.ftpReportSuggested) {
          addPendingSuggestion({
            type: 'ftp_report',
            watts: result.ftpReportSuggested.watts,
            effectiveDate: result.ftpReportSuggested.effectiveDate,
            note: result.ftpReportSuggested.note,
          });
        }
      } catch (err) {
        console.error('Failed to sync athlete profile for session', sessionId, err);
      }
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
