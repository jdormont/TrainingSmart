/*
  # Persistent memory-sync watermark for chat sessions

  useMemorySessionSync folds a chat session's new messages into the athlete's
  durable profile (athlete_profile) once enough new user messages accumulate.
  The "how many messages have already been folded in" watermark previously
  lived only in an in-memory React ref: reset on every page load/remount, and
  — more importantly — advanced optimistically *before* the merge call
  resolved, so a failed merge (network error, edge function failure) still
  marked those messages as synced and they were never retried.

  1. Changes
    - `chat_sessions.memory_synced_message_count` — the number of user
      messages in this session already folded into athlete_profile. Written
      by athleteProfileService.mergeFromSession only after a merge succeeds,
      so a failure leaves the previous (correct) watermark in place for retry.
      Read by useMemorySessionSync on session activation to detect and
      immediately catch up on a backlog that accumulated without a clean
      sync (browser crash/force-quit, a session that ended one message short
      of the sync threshold, another device).

  2. Notes
    - Defaults to 0 for existing rows, meaning any session with unsynced
      messages already in the DB will simply be caught up (or re-processed if
      already fully reflected in athlete_profile — the merge is idempotent
      enough in practice; harmless if occasionally redundant).
*/

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS memory_synced_message_count integer NOT NULL DEFAULT 0;
