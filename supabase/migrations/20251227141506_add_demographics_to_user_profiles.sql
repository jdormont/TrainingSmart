/*
  # Add demographic fields to user_profiles

  1. Changes
    - Add `gender` column to user_profiles (text, optional)
    - Add `age_bucket` column to user_profiles (text, optional)
    - Add index for performance
  
  2. Purpose
    These fields enable age and gender-adjusted calibration of health metrics,
    recovery scores, and HRV assessments for more accurate personalized recommendations.
    
  3. Security
    - Fields are optional and can be updated by the user
    - Existing RLS policies control access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN gender text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'age_bucket'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN age_bucket text;
  END IF;
END $$;

COMMENT ON COLUMN user_profiles.gender IS 'User gender for calibrated health metrics (male, female, other, prefer_not_to_say)';
COMMENT ON COLUMN user_profiles.age_bucket IS 'User age range for calibrated health metrics (18-24, 25-34, 35-44, 45-54, 55-64, 65+)';