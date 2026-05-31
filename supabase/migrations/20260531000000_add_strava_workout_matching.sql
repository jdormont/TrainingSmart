-- Migration: Activity Reconciliation (Strava Matching)
-- Adds columns to link workouts to Strava activities and store matching confidence scores

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS strava_activity_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS activity_match_score NUMERIC(5,2) CHECK (activity_match_score >= 0 AND activity_match_score <= 100),
  ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS match_metadata JSONB,
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_workouts_strava_activity ON workouts(strava_activity_id);
CREATE INDEX IF NOT EXISTS idx_workouts_auto_matched ON workouts(auto_matched) WHERE strava_activity_id IS NOT NULL;
