import { supabase } from './supabaseClient';
import { userProfileService } from './userProfileService';

export const getUserOnboardingStatus = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // Treat unauthenticated as "no onboarding needed" for now to avoid blocking

    // Check if user has specific onboarding flag or profile data
    // Fetch profile and check for critical onboarding fields
    const profile = await userProfileService.getUserProfile();
    
    // Check if profile exists AND has key onboarding fields populated
    // We check training_goal or coach_persona as indicators of completed wizard
    if (!profile) return false;

    return !!(profile.training_goal || profile.coach_persona);
  } catch (error) {
    console.warn('Error checking onboarding status:', error);
    return true; // Default to onboarded to avoid blocking on error
  }
};
