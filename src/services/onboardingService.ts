import { supabase } from './supabaseClient';
import { userProfileService } from './userProfileService';

export const getUserOnboardingStatus = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return true; // Treat unauthenticated as "no onboarding needed" for now to avoid blocking

    // Check if user has specific onboarding flag or profile data
    // For now, assuming if profile exists, they are onboarded
    const profile = await userProfileService.getUserProfile();
    return !!profile;
  } catch (error) {
    console.warn('Error checking onboarding status:', error);
    return true; // Default to onboarded to avoid blocking
  }
};
