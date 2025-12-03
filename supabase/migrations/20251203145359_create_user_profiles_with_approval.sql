/*
  # Create user profiles table with approval system

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key) - Unique profile identifier
      - `user_id` (uuid, references auth.users) - Links to auth user
      - `full_name` (text) - User's full name
      - `status` (text) - PENDING, APPROVED, or REJECTED
      - `is_admin` (boolean) - Admin flag
      - `created_at` (timestamptz) - Profile creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `user_profiles` table
    - Users can read their own profile
    - Admins can read all profiles

  3. Important Notes
    - First user will automatically become admin (handled in next migration)
    - New users start with PENDING status by default
    - Status can only be PENDING, APPROVED, or REJECTED
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT 'User',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  is_admin boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin);