/*
  # Multi-Modal Athlete Expansion — Phase 1: Foundation

  ## Summary
  Adds the database fields required to support conversational onboarding,
  coach specialization, fitness mode, and expanded activity types for the
  multi-modal athlete feature set.

  ## Changes

  ### user_profiles
  New columns to capture conversational onboarding answers and derived settings:
  - `primary_goal`                      — conversational goal framing (freeform text)
  - `activity_mix`                      — ordered array of {type, priority} objects (jsonb)
  - `weekly_availability_days`          — realistic training days per week (2–7)
  - `weekly_availability_duration`      — typical session length in minutes
  - `fitness_level`                     — self-assessed fitness (beginner/returning/intermediate/advanced)
  - `coach_specialization`              — assigned coach type (endurance/strength_mobility/general_fitness/comeback)
  - `fitness_mode`                      — dashboard/plan mode (performance/re_engager)
  - `conversational_onboarding_completed`      — whether new v2 onboarding has been completed
  - `conversational_onboarding_completed_at`   — timestamp of completion

  Note: existing `training_goal`, `weekly_hours`, and `coach_persona` columns are
  preserved unchanged. The new fields represent the richer conversational onboarding
  profile and are distinct from the legacy wizard fields.

  ### workouts
  - Expand `type` CHECK constraint to include 'yoga' and 'hiking'
  - Add `activity_metadata` jsonb column for activity-specific fields
    (e.g. sets/reps for strength, yoga style/duration, hiking elevation,
    running pace zones). No existing rows are affected.

  ## Security
  Existing RLS policies cover all new columns. No new policies required.
*/

-- ============================================================
-- 1. user_profiles — new onboarding + specialization columns
-- ============================================================

DO $$
BEGIN
  -- Primary goal from conversational onboarding (freeform or selected option)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'primary_goal'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN primary_goal text;
  END IF;

  -- Ordered activity mix: [{type: "cycling", priority: 1}, {type: "strength", priority: 2}]
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'activity_mix'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN activity_mix jsonb;
  END IF;

  -- How many days per week the user can realistically train (2–7)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'weekly_availability_days'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN weekly_availability_days smallint;
  END IF;

  -- Typical session length in minutes (e.g. 20, 30, 45, 60, 90)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'weekly_availability_duration'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN weekly_availability_duration smallint;
  END IF;

  -- Self-assessed fitness level from onboarding
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'fitness_level'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN fitness_level text
      CHECK (fitness_level IN ('beginner', 'returning', 'intermediate', 'advanced'));
  END IF;

  -- AI coach specialization assigned during onboarding; user can change at any time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'coach_specialization'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN coach_specialization text
      CHECK (coach_specialization IN ('endurance', 'strength_mobility', 'general_fitness', 'comeback'));
  END IF;

  -- Dashboard and plan mode derived from onboarding answers
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'fitness_mode'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN fitness_mode text DEFAULT 'performance'
      CHECK (fitness_mode IN ('performance', 're_engager'));
  END IF;

  -- Whether the user has completed the new conversational onboarding flow
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'conversational_onboarding_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN conversational_onboarding_completed boolean DEFAULT false NOT NULL;
  END IF;

  -- Timestamp of when conversational onboarding was completed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'conversational_onboarding_completed_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN conversational_onboarding_completed_at timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN user_profiles.primary_goal IS 'Conversational goal framing from onboarding (e.g. "get fit again", "train for an event")';
COMMENT ON COLUMN user_profiles.activity_mix IS 'Ordered activity preferences from onboarding: [{type: "cycling", priority: 1}, ...]';
COMMENT ON COLUMN user_profiles.weekly_availability_days IS 'Realistic training days per week (2–7) from onboarding';
COMMENT ON COLUMN user_profiles.weekly_availability_duration IS 'Typical session length in minutes from onboarding';
COMMENT ON COLUMN user_profiles.fitness_level IS 'Self-assessed fitness level: beginner, returning, intermediate, advanced';
COMMENT ON COLUMN user_profiles.coach_specialization IS 'AI coach type: endurance, strength_mobility, general_fitness, comeback';
COMMENT ON COLUMN user_profiles.fitness_mode IS 'Dashboard/plan rendering mode: performance or re_engager';
COMMENT ON COLUMN user_profiles.conversational_onboarding_completed IS 'True once the user has completed the conversational onboarding flow (v2)';
COMMENT ON COLUMN user_profiles.conversational_onboarding_completed_at IS 'Timestamp when conversational onboarding was completed';


-- ============================================================
-- 2. workouts — expand type constraint + add activity_metadata
-- ============================================================

-- Drop the existing type check constraint and replace it with an expanded version
-- that includes 'yoga' and 'hiking'. Existing rows are unaffected — all current
-- values (run, bike, swim, strength, rest) remain valid.
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_type_check;

ALTER TABLE workouts ADD CONSTRAINT workouts_type_check
  CHECK (type IN ('run', 'bike', 'swim', 'strength', 'rest', 'yoga', 'hiking'));

-- Add a jsonb column for activity-specific metadata.
-- Examples by type:
--   strength: {"sets": 3, "reps": 10, "exercises": ["squat", "deadlift"]}
--   yoga:     {"style": "vinyasa", "instructor": "..."}
--   hiking:   {"elevation_gain_m": 450, "trail_name": "..."}
--   run:      {"pace_zones": {"z1_min": 10, "z2_min": 8}}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'activity_metadata'
  ) THEN
    ALTER TABLE workouts ADD COLUMN activity_metadata jsonb;
  END IF;
END $$;

COMMENT ON COLUMN workouts.activity_metadata IS 'Activity-specific metadata (sets/reps for strength, style for yoga, elevation for hiking, pace zones for run)';
COMMENT ON COLUMN workouts.type IS 'Workout type: run, bike, swim, strength, rest, yoga, hiking';
