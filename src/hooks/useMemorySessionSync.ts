import { useEffect, useRef } from 'react';
import { athleteProfileService } from '../services/athleteProfileService';
import { goalsService } from '../services/goalsService';
import { recentActivityNotesService } from '../services/recentActivityNotesService';
import { memoryRollupService } from '../services/memoryRollupService';
import { chatMemorySyncStateService } from '../services/chatMemorySyncStateService';
import { addPendingSuggestion } from '../utils/pendingMemorySuggestions';
import type { ChatSession, DailyMetric } from '../types';

const MIN_NEW_USER_MESSAGES_TO_SYNC = 2;

/**
 * Folds the active chat session's new messages into the user's persistent
 * athlete profile whenever the session goes idle: tab hidden, session switched,
 * this component unmounts, or (to catch up on a backlog left by a crashed tab,
 * a session that ended one message short of the sync threshold, or another
 * device) the session first becomes active. No server cron exists, so these
 * client-side triggers are the only update path (mirrors useBackgroundSync's
 * model).
 *
 * The "how far synced" watermark is persisted server-side per session (see
 * chatMemorySyncStateService) and only ever advanced *after* a merge
 * succeeds — never optimistically beforehand — so a failed merge (network
 * error, edge function failure) leaves the backlog in place to retry on the
 * next trigger, instead of silently losing it. The in-memory ref below is
 * just a same-mount cache of that server value to avoid re-fetching it on
 * every trigger within one page view.
 *
 * Any goal-completion or FTP-report suggestions the AI surfaces are queued as
 * confirm-first pending suggestions (see utils/pendingMemorySuggestions.ts) —
 * never applied automatically. Expired recent-activity-notes rows are pruned
 * opportunistically in the same sync.
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

      try {
        const rollup = await memoryRollupService.buildRollup(latestDailyMetricsRef.current);
        const [result] = await Promise.all([
          athleteProfileService.mergeFromSession(sessionId, session.messages, rollup),
          recentActivityNotesService.pruneExpired(),
        ]);

        // Advance the local cache only after the merge (which durably persists
        // the same watermark server-side) has actually succeeded.
        syncedMessageCountRef.current[sessionId] = newUserMessages;

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
        // Watermark intentionally left untouched — this session's backlog is
        // retried on the next trigger instead of being silently dropped.
      }
    };

    const catchUpOnActivation = async () => {
      if (syncedMessageCountRef.current[sessionId] !== undefined) return;
      const persisted = await chatMemorySyncStateService.getSyncedMessageCount(sessionId).catch(err => {
        console.error('Failed to read memory sync watermark for session', sessionId, err);
        return 0;
      });
      syncedMessageCountRef.current[sessionId] = persisted;
      await sync();
    };

    catchUpOnActivation();

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
