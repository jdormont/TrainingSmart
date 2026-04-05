import { supabase } from './supabaseClient';
import { userProfileService } from './userProfileService';
import type { ActivityMixItem, CoachSpecialization, FitnessLevel, FitnessMode, OnboardingProfile } from '../types';

/**
 * Determines coach specialization and fitness mode from onboarding answers.
 * Priority order:
 *   1. beginner/returning fitness level → comeback + re_engager
 *   2. low availability (≤3 days/week) → re_engager mode (specialization still derived below)
 *   3. primary activities = strength/yoga → strength_mobility
 *   4. primary activities = run/bike → endurance
 *   5. fallback → general_fitness
 */
export const assignCoachSpecialization = (answers: {
  fitness_level: FitnessLevel;
  activity_mix: ActivityMixItem[];
  weekly_availability_days: number;
}): { coach_specialization: CoachSpecialization; fitness_mode: FitnessMode } => {
  const { fitness_level, activity_mix, weekly_availability_days } = answers;

  // Re-engager cases
  if (fitness_level === 'beginner' || fitness_level === 'returning') {
    return { coach_specialization: 'comeback', fitness_mode: 're_engager' };
  }

  const fitness_mode: FitnessMode = weekly_availability_days <= 3 ? 're_engager' : 'performance';

  // Derive specialization from top-priority activity
  const strengthMobilityTypes = new Set(['strength', 'yoga']);
  const enduranceTypes = new Set(['run', 'bike', 'hiking']);

  const sorted = [...activity_mix].sort((a, b) => a.priority - b.priority);
  const topActivity = sorted[0]?.type;

  if (topActivity && strengthMobilityTypes.has(topActivity)) {
    return { coach_specialization: 'strength_mobility', fitness_mode };
  }
  if (topActivity && enduranceTypes.has(topActivity)) {
    return { coach_specialization: 'endurance', fitness_mode };
  }

  return { coach_specialization: 'general_fitness', fitness_mode };
};

/**
 * Saves all conversational onboarding answers to user_profiles and marks
 * the flow as completed. Derives and persists coach_specialization + fitness_mode.
 */
export const saveOnboardingProfile = async (
  userId: string,
  answers: Omit<OnboardingProfile, 'coach_specialization' | 'fitness_mode'>
): Promise<{ coach_specialization: CoachSpecialization; fitness_mode: FitnessMode }> => {
  const derived = assignCoachSpecialization({
    fitness_level: answers.fitness_level,
    activity_mix: answers.activity_mix,
    weekly_availability_days: answers.weekly_availability_days,
  });

  const { error } = await supabase
    .from('user_profiles')
    .update({
      primary_goal: answers.primary_goal,
      activity_mix: answers.activity_mix,
      weekly_availability_days: answers.weekly_availability_days,
      weekly_availability_duration: answers.weekly_availability_duration,
      fitness_level: answers.fitness_level,
      coach_specialization: derived.coach_specialization,
      fitness_mode: derived.fitness_mode,
      conversational_onboarding_completed: true,
      conversational_onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
  return derived;
};

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
