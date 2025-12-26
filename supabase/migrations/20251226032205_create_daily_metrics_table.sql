/*
  # Create daily_metrics table for Apple Health data

  1. New Tables
    - `daily_metrics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `date` (date, the day these metrics are for)
      - `sleep_minutes` (integer, total sleep in minutes)
      - `resting_hr` (integer, resting heart rate)
      - `hrv` (integer, heart rate variability in ms)
      - `recovery_score` (integer, calculated score 0-100)
      - `created_at` (timestamptz, when record was created)
      - `updated_at` (timestamptz, when record was last updated)

  2. Indexes
    - Unique constraint on (user_id, date) to prevent duplicate entries per day
    - Index on user_id for efficient queries

  3. Security
    - Enable RLS on `daily_metrics` table
    - Add policies for authenticated users to manage their own data
    - Users can read, insert, update, and delete only their own metrics
*/

-- Create the daily_metrics table
CREATE TABLE IF NOT EXISTS daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sleep_minutes integer NOT NULL CHECK (sleep_minutes >= 0),
  resting_hr integer NOT NULL CHECK (resting_hr >= 30 AND resting_hr <= 200),
  hrv integer NOT NULL CHECK (hrv >= 0 AND hrv <= 300),
  recovery_score integer NOT NULL CHECK (recovery_score >= 0 AND recovery_score <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT daily_metrics_user_date_unique UNIQUE (user_id, date)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_id ON daily_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, date DESC);

-- Enable Row Level Security
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own daily metrics
CREATE POLICY "Users can read own daily metrics"
  ON daily_metrics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own daily metrics
CREATE POLICY "Users can insert own daily metrics"
  ON daily_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own daily metrics
CREATE POLICY "Users can update own daily metrics"
  ON daily_metrics
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own daily metrics
CREATE POLICY "Users can delete own daily metrics"
  ON daily_metrics
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_daily_metrics_updated_at_trigger ON daily_metrics;
CREATE TRIGGER update_daily_metrics_updated_at_trigger
  BEFORE UPDATE ON daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_metrics_updated_at();