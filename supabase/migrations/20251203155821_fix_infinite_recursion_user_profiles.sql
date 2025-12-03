/*
  # Fix infinite recursion in user_profiles policies
  
  1. Problem
    - "Admins can read all profiles" policy creates infinite recursion
    - It queries user_profiles to check if user is admin
    - That query triggers RLS which queries user_profiles again = infinite loop
  
  2. Solution
    - Create a helper function that checks admin status with SECURITY DEFINER
    - Use this function in policies to avoid recursion
    - Recreate the admin policies with the new function
*/

-- Drop the problematic admin policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- Create a helper function to check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- This function runs with definer rights, bypassing RLS
  SELECT is_admin INTO is_admin_user
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN COALESCE(is_admin_user, false);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin() TO anon;

-- Recreate admin policies with the new function (no recursion)
CREATE POLICY "Admins can read all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (is_user_admin() OR auth.uid() = user_id);

CREATE POLICY "Admins can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());
