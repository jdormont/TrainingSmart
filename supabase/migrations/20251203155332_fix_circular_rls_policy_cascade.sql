/*
  # Fix circular RLS policy issue with CASCADE
  
  1. Problem
    - The is_user_approved() function can't read user_profiles due to RLS
    - This creates a circular dependency where policies can't check approval
  
  2. Solution
    - Drop is_user_approved() CASCADE to remove all dependent policies
    - Recreate function with proper SECURITY DEFINER and explicit grants
    - Recreate all policies with the fixed function
*/

-- Drop the function and all dependent policies
DROP FUNCTION IF EXISTS public.is_user_approved() CASCADE;

-- Recreate the function with proper permissions
CREATE OR REPLACE FUNCTION public.is_user_approved()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
DECLARE
  user_status text;
BEGIN
  -- This function runs with definer rights, bypassing RLS
  SELECT status INTO user_status
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(user_status = 'APPROVED', false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_approved() TO anon;

-- Recreate chat_sessions policies
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

-- Recreate chat_messages policies
CREATE POLICY "Approved users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_user_approved());

CREATE POLICY "Approved users can create own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_user_approved());

-- Recreate training_plans policies
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

-- Recreate workouts policies
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

-- Recreate user_tokens policies
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

-- Recreate user_settings policies
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

-- Recreate content_profiles policies
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

-- Recreate strava_athlete_cache policies
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

-- Recreate strava_activities_cache policies
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
