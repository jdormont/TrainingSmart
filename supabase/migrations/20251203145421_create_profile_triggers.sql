/*
  # Create automatic profile creation and first admin setup

  1. Functions
    - `handle_new_user()` - Automatically creates profile when user signs up
      - Extracts full_name from user metadata
      - Sets initial status to PENDING
      - Sets is_admin to false initially
    
    - `make_first_user_admin()` - Makes first user an admin automatically
      - Checks if this is the first user profile
      - If yes, upgrades to admin and approves immediately
      - Subsequent users remain pending until approved

  2. Triggers
    - `on_auth_user_created` - Fires when new user signs up
    - `on_profile_created` - Fires after profile is created

  3. Important Notes
    - First user becomes admin automatically with APPROVED status
    - All other users start as PENDING and need manual approval
    - Uses SECURITY DEFINER to bypass RLS for system operations
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name, status, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'PENDING',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.make_first_user_admin()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.user_profiles;

  IF user_count = 1 THEN
    UPDATE public.user_profiles
    SET is_admin = true, status = 'APPROVED', updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_created ON public.user_profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.make_first_user_admin();