/*
  # Add approval requirement to existing tables

  1. Helper Function
    - `is_user_approved()` - Checks if current user has APPROVED status
    - Returns true if user is approved, false otherwise

  2. Policy Updates
    - Update all main data tables to require APPROVED status for access
    - Users must be approved before they can access any app data
    - Admins are always approved by default (from trigger)

  3. Tables Updated
    - chat_sessions, chat_messages, training_plans, workouts
    - google_calendar_tokens, user_tokens, user_settings
    - content_profiles, content_feedback, content_cache
    - weekly_insights, strava_athlete_cache, strava_activities_cache

  4. Important Notes
    - Only APPROVED users can read, insert, update, or delete data
    - First user is auto-approved and becomes admin
    - All policies now check approval status before allowing access
*/

-- Helper function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND status = 'APPROVED'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update chat_sessions policies
DROP POLICY IF EXISTS "Users can read own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON chat_sessions;

CREATE POLICY "Approved users can read own sessions"
  ON chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own sessions"
  ON chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own sessions"
  ON chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can delete own sessions"
  ON chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

-- Update chat_messages policies
DROP POLICY IF EXISTS "Users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can create own messages" ON chat_messages;

CREATE POLICY "Approved users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

-- Update training_plans policies
DROP POLICY IF EXISTS "Users can read own plans" ON training_plans;
DROP POLICY IF EXISTS "Users can create own plans" ON training_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON training_plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON training_plans;

CREATE POLICY "Approved users can read own plans"
  ON training_plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own plans"
  ON training_plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own plans"
  ON training_plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can delete own plans"
  ON training_plans FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

-- Update workouts policies
DROP POLICY IF EXISTS "Users can read own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can create own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON workouts;

CREATE POLICY "Approved users can read own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can delete own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

-- Update user_tokens policies
DROP POLICY IF EXISTS "Users can read own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Users can manage own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Users can create own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON user_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON user_tokens;

CREATE POLICY "Approved users can read own tokens"
  ON user_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own tokens"
  ON user_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own tokens"
  ON user_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can delete own tokens"
  ON user_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

-- Update user_settings policies
DROP POLICY IF EXISTS "Users can read own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;

CREATE POLICY "Approved users can read own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

-- Update content_profiles policies (existing policies)
DROP POLICY IF EXISTS "Users can read own content profile" ON content_profiles;
DROP POLICY IF EXISTS "Users can manage own content profile" ON content_profiles;
DROP POLICY IF EXISTS "Users can create own content profile" ON content_profiles;
DROP POLICY IF EXISTS "Users can update own content profile" ON content_profiles;

CREATE POLICY "Approved users can read own content profile"
  ON content_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own content profile"
  ON content_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own content profile"
  ON content_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

-- Update strava cache policies
DROP POLICY IF EXISTS "Users can read own strava cache" ON strava_athlete_cache;
DROP POLICY IF EXISTS "Users can manage own strava cache" ON strava_athlete_cache;
DROP POLICY IF EXISTS "Users can create own strava cache" ON strava_athlete_cache;
DROP POLICY IF EXISTS "Users can update own strava cache" ON strava_athlete_cache;

CREATE POLICY "Approved users can read own strava cache"
  ON strava_athlete_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own strava cache"
  ON strava_athlete_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own strava cache"
  ON strava_athlete_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

DROP POLICY IF EXISTS "Users can read own activities cache" ON strava_activities_cache;
DROP POLICY IF EXISTS "Users can manage own activities cache" ON strava_activities_cache;
DROP POLICY IF EXISTS "Users can create own activities cache" ON strava_activities_cache;
DROP POLICY IF EXISTS "Users can update own activities cache" ON strava_activities_cache;

CREATE POLICY "Approved users can read own activities cache"
  ON strava_activities_cache FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own activities cache"
  ON strava_activities_cache FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can update own activities cache"
  ON strava_activities_cache FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved())
  WITH CHECK (auth.uid() = user_id AND is_user_approved());