/*
  # Add onboarding fields to user_profiles

  1. Changes
    - Add `training_goal` column (text, optional)
    - Add `weekly_hours` column (integer, optional)
    - Add `coach_persona` column (text, optional)

  2. Purpose
    These fields capture initial onboarding wizard data to personalize the user experience
    and seed content recommendations. When a user completes the intake wizard, these fields
    enable immediate personalization without requiring a content preferences chat session.

  3. Training Goal Options
    - "Event Prep" - Race preparation and peak performance
    - "General Fitness" - Health and consistency
    - "Performance/Speed" - Power and speed development
    - "Weight Loss" - Weight management and metabolism

  4. Coach Persona Options
    - "Supportive" - Gentle and encouraging
    - "Drill Sergeant" - Direct and demanding
    - "Analytical" - Data-focused and precise

  5. Security
    - Fields are optional and updated during onboarding
    - Existing RLS policies control access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'training_goal'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN training_goal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'weekly_hours'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN weekly_hours integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'coach_persona'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN coach_persona text;
  END IF;
END $$;

COMMENT ON COLUMN user_profiles.training_goal IS 'User primary training goal from onboarding wizard';
COMMENT ON COLUMN user_profiles.weekly_hours IS 'Available weekly training hours from onboarding wizard';
COMMENT ON COLUMN user_profiles.coach_persona IS 'Preferred AI coach communication style from onboarding wizard';
