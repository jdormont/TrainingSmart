/*
  # Weekly reviews + user timezone

  1. New Tables
    - `weekly_reviews` — one row per user per completed Monday-Sunday week.
      `adherence_score` is computed deterministically client-side
      (adherenceService); the LLM only writes `review_text` from the stats.
      `adherence_score` is NULL for weeks with no scheduled workouts.
      `review_text` is NULL when text generation failed; it is retried on the
      next app load without recomputing or duplicating the row.

  2. Changes
    - `user_profiles.timezone` — IANA zone captured from the browser, used to
      decide where a training week starts and ends.

  3. Security
    - RLS on `weekly_reviews`, scoped to `auth.uid() = user_id`.
*/

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  adherence_score integer CHECK (adherence_score IS NULL OR (adherence_score >= 0 AND adherence_score <= 100)),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reviews_user_week_unique UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_reviews_user_week_idx
  ON weekly_reviews (user_id, week_start DESC);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly reviews"
  ON weekly_reviews FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly reviews"
  ON weekly_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly reviews"
  ON weekly_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS timezone text;
