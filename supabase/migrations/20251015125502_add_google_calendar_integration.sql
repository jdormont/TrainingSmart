/*
  # Google Calendar Integration

  1. New Tables
    - `google_calendar_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `access_token` (text, encrypted token for Google API)
      - `refresh_token` (text, encrypted refresh token)
      - `expires_at` (timestamptz, token expiration timestamp)
      - `created_at` (timestamptz, when connection was established)
      - `updated_at` (timestamptz, last token refresh)

  2. Changes to Existing Tables
    - `workouts`
      - Add `google_calendar_event_id` (text, nullable) - stores Google Calendar event ID

  3. Security
    - Enable RLS on `google_calendar_tokens` table
    - Add policy for users to read only their own tokens
    - Add policy for users to insert their own tokens
    - Add policy for users to update their own tokens
    - Add policy for users to delete their own tokens

  4. Indexes
    - Add index on `google_calendar_tokens.user_id` for faster lookups
    - Add index on `workouts.google_calendar_event_id` for sync tracking
*/

-- Create google_calendar_tokens table
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Add google_calendar_event_id to workouts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'google_calendar_event_id'
  ) THEN
    ALTER TABLE workouts ADD COLUMN google_calendar_event_id text;
  END IF;
END $$;

-- Enable RLS on google_calendar_tokens
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for google_calendar_tokens
CREATE POLICY "Users can read own calendar tokens"
  ON google_calendar_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar tokens"
  ON google_calendar_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar tokens"
  ON google_calendar_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar tokens"
  ON google_calendar_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id
  ON google_calendar_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_workouts_google_calendar_event_id
  ON workouts(google_calendar_event_id)
  WHERE google_calendar_event_id IS NOT NULL;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_google_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_google_calendar_tokens_updated_at ON google_calendar_tokens;
CREATE TRIGGER set_google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_google_calendar_tokens_updated_at();
