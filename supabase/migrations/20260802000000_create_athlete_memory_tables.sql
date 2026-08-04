/*
  # Athlete memory restructure — durable profile, goal lifecycle, FTP history

  Replaces the flat `user_memory` table (goals-as-string-array, no lifecycle,
  narrative-only FTP references) with four focused tables so the AI coach can
  never again present a closed goal as current:

  1. New Tables
    - `athlete_profile` — durable traits (constraints, preferences, notable
      patterns, narrative). One row per user. Successor to the non-goal
      parts of `user_memory`.
    - `goals` — lifecycle-tracked goals. A partial unique index enforces at
      most one `status = 'active'` row per user, so "only one active goal"
      is a database guarantee rather than an application convention.
    - `ftp_history` — append-only time series of FTP values with source and
      confidence, replacing the single overwritten `user_profiles.ftp`
      scalar as the source of trend/history data.
    - `recent_activity_notes` — rolling window of short dated observations
      (e.g. segment PRs). Expiry is enforced by callers filtering on
      `note_date`, not by a cron job (this project has none).

  2. Security
    - RLS enabled on all four tables, scoped to `auth.uid() = user_id`,
      mirroring the `user_memory` policy pattern.

  3. Notes
    - `user_memory` / `user_memory_audit` are left untouched by this
      migration — they are deprecated in application code but not dropped,
      pending a follow-up once the new tables have run in production.
*/

CREATE TABLE IF NOT EXISTS athlete_profile (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  title text NOT NULL,
  description text,
  target_date date,
  block_start_date date,
  block_end_date date,
  event_type text,
  success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score integer CHECK (confidence_score BETWEEN 0 AND 100),
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'manual', 'onboarding', 'backfill')),
  source_session_ids uuid[] NOT NULL DEFAULT '{}',
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_one_active_per_user
  ON goals(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_goals_user_status_updated
  ON goals(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS ftp_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ftp_watts numeric NOT NULL CHECK (ftp_watts > 0 AND ftp_watts < 1000),
  effective_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('manual', 'chat_reported', 'zwift_test', 'strava_estimate', 'heuristic')),
  confidence text NOT NULL DEFAULT 'confirmed' CHECK (confidence IN ('confirmed', 'estimated')),
  note text,
  source_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ftp_history_user_date_source_unique UNIQUE (user_id, effective_date, source)
);

CREATE INDEX IF NOT EXISTS idx_ftp_history_user_date
  ON ftp_history(user_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS recent_activity_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'system')),
  source_session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recent_activity_notes_user_date
  ON recent_activity_notes(user_id, note_date DESC);

ALTER TABLE athlete_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ftp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_activity_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "athlete_profile_owner_select" ON athlete_profile
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "athlete_profile_owner_insert" ON athlete_profile
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "athlete_profile_owner_update" ON athlete_profile
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "athlete_profile_owner_delete" ON athlete_profile
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "goals_owner_select" ON goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goals_owner_insert" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_owner_update" ON goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_owner_delete" ON goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "ftp_history_owner_select" ON ftp_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ftp_history_owner_insert" ON ftp_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recent_activity_notes_owner_select" ON recent_activity_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "recent_activity_notes_owner_insert" ON recent_activity_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recent_activity_notes_owner_delete" ON recent_activity_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION close_and_create_goal(
  p_user_id uuid,
  p_close_goal_id uuid,
  p_close_status text,
  p_close_reason text,
  p_new_title text,
  p_new_description text,
  p_new_target_date date,
  p_new_block_start_date date,
  p_new_block_end_date date,
  p_new_event_type text,
  p_new_success_criteria jsonb,
  p_new_source text
)
RETURNS goals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_goal goals;
BEGIN
  IF p_close_goal_id IS NOT NULL THEN
    UPDATE goals
    SET status = p_close_status,
        closed_reason = p_close_reason,
        closed_at = now(),
        updated_at = now()
    WHERE id = p_close_goal_id AND user_id = p_user_id AND status = 'active';
  END IF;

  INSERT INTO goals (
    user_id, status, title, description, target_date,
    block_start_date, block_end_date, event_type,
    success_criteria, source
  ) VALUES (
    p_user_id, 'active', p_new_title, p_new_description, p_new_target_date,
    p_new_block_start_date, p_new_block_end_date, p_new_event_type,
    COALESCE(p_new_success_criteria, '[]'::jsonb), COALESCE(p_new_source, 'manual')
  )
  RETURNING * INTO new_goal;

  RETURN new_goal;
END;
$$;
