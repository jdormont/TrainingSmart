/*
  # Rebuild user_profiles policies without recursion
  
  1. Problem
    - Previous policies had circular dependencies causing infinite recursion
    - Need clean policies that don't reference user_profiles within themselves
  
  2. Solution
    - Drop ALL existing policies on user_profiles
    - Create simple, non-recursive policies
    - Use helper functions only where safe (for update operations)
*/

-- Drop ALL existing policies on user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Simple read policy - users can only read their own profile (no recursion)
CREATE POLICY "users_read_own"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Simple update policy - users can update their own profile
CREATE POLICY "users_update_own"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin update policy - admins can update any profile (uses helper function safely for UPDATE)
CREATE POLICY "admins_update_all"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());
