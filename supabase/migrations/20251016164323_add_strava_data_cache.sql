/*
  # Strava Data Caching Schema

  1. New Tables
    - `strava_athlete_cache`
      - `user_id` (uuid, primary key, foreign key to auth.users)
      - `athlete_data` (jsonb) - Cached athlete data from Strava
      - `last_fetched` (timestamp) - When data was last fetched
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `strava_activities_cache`
      - `id` (bigint, primary key) - Strava activity ID
      - `user_id` (uuid, foreign key to auth.users)
      - `activity_data` (jsonb) - Full activity data from Strava
      - `start_date` (timestamp) - Activity start date for easy querying
      - `activity_type` (text) - Type of activity (Ride, Run, etc.)
      - `distance` (numeric) - Distance in meters
      - `moving_time` (integer) - Moving time in seconds
      - `last_fetched` (timestamp) - When this activity was last synced
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own cached data
    - Policies for SELECT, INSERT, UPDATE, DELETE based on user_id

  3. Indexes
    - Index on user_id for fast user-specific queries
    - Index on start_date for date-based filtering
    - Index on last_fetched for cache invalidation

  4. Important Notes
    - This caching layer reduces Strava API calls from ~100 per page load to ~2-3
    - Data is refreshed only when stale (>15 minutes old)
    - Respects Strava's rate limits: 100 requests per 15 minutes, 1000 per day
*/

-- Create strava_athlete_cache table
CREATE TABLE IF NOT EXISTS strava_athlete_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_data jsonb NOT NULL,
  last_fetched timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create strava_activities_cache table
CREATE TABLE IF NOT EXISTS strava_activities_cache (
  id bigint PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_data jsonb NOT NULL,
  start_date timestamptz NOT NULL,
  activity_type text NOT NULL,
  distance numeric NOT NULL DEFAULT 0,
  moving_time integer NOT NULL DEFAULT 0,
  last_fetched timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_strava_athlete_cache_last_fetched ON strava_athlete_cache(last_fetched);
CREATE INDEX IF NOT EXISTS idx_strava_activities_cache_user_id ON strava_activities_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_cache_start_date ON strava_activities_cache(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_strava_activities_cache_last_fetched ON strava_activities_cache(last_fetched);

-- Enable Row Level Security
ALTER TABLE strava_athlete_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_activities_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for strava_athlete_cache
CREATE POLICY "Users can view their own athlete cache"
  ON strava_athlete_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own athlete cache"
  ON strava_athlete_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own athlete cache"
  ON strava_athlete_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own athlete cache"
  ON strava_athlete_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for strava_activities_cache
CREATE POLICY "Users can view their own activities cache"
  ON strava_activities_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activities cache"
  ON strava_activities_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities cache"
  ON strava_activities_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities cache"
  ON strava_activities_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_strava_athlete_cache_updated_at
  BEFORE UPDATE ON strava_athlete_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strava_activities_cache_updated_at
  BEFORE UPDATE ON strava_activities_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
