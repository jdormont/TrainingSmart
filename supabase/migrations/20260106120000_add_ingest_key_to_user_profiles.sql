/*
  # Add ingest_key to user_profiles

  1. Changes
    - Add `ingest_key` column to `user_profiles` table
      - Type: UUID
      - Default: gen_random_uuid()
      - Constraint: UNIQUE, NOT NULL
    
  2. Security
    - No specific RLS needed as this is for backend verification, but users can read their own key via existing policies.
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'ingest_key'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN ingest_key uuid DEFAULT gen_random_uuid() NOT NULL;

    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_ingest_key_key UNIQUE (ingest_key);
    
    CREATE INDEX IF NOT EXISTS idx_user_profiles_ingest_key ON user_profiles(ingest_key);
  END IF;
END $$;
