/*
  # Remove recursive admin read policy
  
  1. Problem
    - "Admins can read all profiles" calls is_user_admin()
    - is_user_admin() reads from user_profiles
    - This triggers RLS which calls the policy again = infinite recursion
  
  2. Solution
    - Remove "Admins can read all profiles" for SELECT
    - Keep only "Users can read own profile" for SELECT (no recursion)
    - Keep admin UPDATE policy (it won't cause recursion on SELECT queries)
*/

-- Remove the recursive policy
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;

-- Keep "Users can read own profile" - it has no recursion
-- Keep "Admins can update all profiles" - it only affects UPDATEs, not SELECTs
