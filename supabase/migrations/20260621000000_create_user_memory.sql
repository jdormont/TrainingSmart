/*
  # User memory for the AI coach

  Persistent, per-user "memory" that combines chat-derived facts (goals,
  constraints, preferences, notable patterns) with a freeform narrative
  the LLM maintains across chat sessions. Updated via the
  openai-update-memory edge function after a chat session goes idle/closes,
  merging the new session's facts into the existing record rather than
  overwriting it. Also user-visible/editable from Settings.

  1. New Tables
    - `user_memory` — one row per user, structured + narrative memory
    - `user_memory_audit` — lightweight change log (one row per update)

  2. Security
    - RLS enabled on both tables, scoped to `auth.uid() = user_id`
*/

CREATE TABLE IF NOT EXISTS user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  notable_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative text NOT NULL DEFAULT '',
  previous_narrative text,
  confidence_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_session_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_memory_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  change_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_memory_owner_select" ON user_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_memory_owner_insert" ON user_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_owner_update" ON user_memory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memory_owner_delete" ON user_memory
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "user_memory_audit_owner_select" ON user_memory_audit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_memory_audit_owner_insert" ON user_memory_audit
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_memory_audit_user
  ON user_memory_audit(user_id, created_at DESC);
