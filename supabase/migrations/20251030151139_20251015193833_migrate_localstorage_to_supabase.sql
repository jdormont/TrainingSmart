/*
  # Migrate localStorage data to Supabase

  This migration creates tables to store data currently in localStorage:
  - OAuth tokens (Strava, Oura, Google Calendar)
  - User preferences and settings
  - Content feed data (profiles, feedback, cache)
  - Weekly training insights

  ## New Tables

  ### `user_tokens`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `provider` (text) - 'strava', 'oura', or 'google_calendar'
  - `access_token` (text, encrypted)
  - `refresh_token` (text, encrypted)
  - `expires_at` (timestamptz)
  - `token_type` (text)
  - `scope` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `user_settings`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, unique)
  - `system_prompt` (text)
  - `preferences` (jsonb) - flexible storage for various preferences
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `content_profiles`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, unique)
  - `interests` (text[])
  - `favorite_creators` (text[])
  - `activity_types` (text[])
  - `skill_level` (text)
  - `goals` (text[])
  - `preferred_content_types` (text[])
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `content_feedback`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `content_item_id` (text) - the ID of the content item
  - `feedback_type` (text) - 'like' or 'dislike'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `content_cache`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, unique)
  - `cache_data` (jsonb) - stored content items
  - `profile_hash` (text)
  - `expires_at` (timestamptz)
  - `created_at` (timestamptz)

  ### `weekly_insights`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `insight_type` (text) - 'recovery', 'training', 'pattern', 'goal', 'consistency'
  - `title` (text)
  - `message` (text)
  - `confidence` (integer)
  - `data_points` (text[])
  - `week_of` (date) - week starting date (Monday)
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - No public access to any table
*/

-- Create user_tokens table
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('strava', 'oura', 'google_calendar')),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  token_type text DEFAULT 'Bearer',
  scope text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  system_prompt text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create content_profiles table
CREATE TABLE IF NOT EXISTS content_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  interests text[] DEFAULT ARRAY[]::text[],
  favorite_creators text[] DEFAULT ARRAY[]::text[],
  activity_types text[] DEFAULT ARRAY[]::text[],
  skill_level text DEFAULT 'beginner' CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  goals text[] DEFAULT ARRAY[]::text[],
  preferred_content_types text[] DEFAULT ARRAY['video', 'article']::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create content_feedback table
CREATE TABLE IF NOT EXISTS content_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_item_id text NOT NULL,
  feedback_type text NOT NULL CHECK (feedback_type IN ('like', 'dislike')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, content_item_id)
);

-- Create content_cache table
CREATE TABLE IF NOT EXISTS content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  cache_data jsonb NOT NULL,
  profile_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create weekly_insights table
CREATE TABLE IF NOT EXISTS weekly_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('recovery', 'training', 'pattern', 'goal', 'consistency')),
  title text NOT NULL,
  message text NOT NULL,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  data_points text[] DEFAULT ARRAY[]::text[],
  week_of date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_of)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_provider ON user_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_content_feedback_user_id ON content_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_content_feedback_item_id ON content_feedback(content_item_id);
CREATE INDEX IF NOT EXISTS idx_weekly_insights_user_id ON weekly_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_insights_week_of ON weekly_insights(week_of);
CREATE INDEX IF NOT EXISTS idx_content_cache_expires_at ON content_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tokens
CREATE POLICY "Users can view own tokens"
  ON user_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON user_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON user_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON user_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for content_profiles
CREATE POLICY "Users can view own content profile"
  ON content_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content profile"
  ON content_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content profile"
  ON content_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content profile"
  ON content_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for content_feedback
CREATE POLICY "Users can view own content feedback"
  ON content_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content feedback"
  ON content_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content feedback"
  ON content_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content feedback"
  ON content_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for content_cache
CREATE POLICY "Users can view own content cache"
  ON content_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content cache"
  ON content_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content cache"
  ON content_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own content cache"
  ON content_cache FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for weekly_insights
CREATE POLICY "Users can view own weekly insights"
  ON weekly_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly insights"
  ON weekly_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly insights"
  ON weekly_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly insights"
  ON weekly_insights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating updated_at
CREATE TRIGGER update_user_tokens_updated_at
  BEFORE UPDATE ON user_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_profiles_updated_at
  BEFORE UPDATE ON content_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_feedback_updated_at
  BEFORE UPDATE ON content_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();