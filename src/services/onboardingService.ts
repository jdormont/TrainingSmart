import { supabase } from './supabaseClient';
import { goalsService } from './goalsService';
import { athleteProfileService } from './athleteProfileService';
import type { ActivityMixItem, ActivityType, CoachSpecialization, FitnessLevel, FitnessMode, OnboardingProfile } from '../types';

export const GOAL_OPTIONS = [
  { value: 'get_back_into_it', label: 'Get back into it', description: "I've had a break and want to rebuild consistency" },
  { value: 'train_for_event', label: 'Train for an event', description: 'Race, competition, or a specific goal date' },
  { value: 'build_strength', label: 'Build strength', description: 'Lift more, move better, get stronger' },
  { value: 'stay_consistent', label: 'Stay consistent', description: 'Show up regularly and keep momentum' },
  { value: 'explore_activities', label: 'Explore new activities', description: "I want to try things I haven't done before" },
] as const;

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  bike: 'Cycling', run: 'Running', strength: 'Strength training',
  yoga: 'Yoga', hiking: 'Hiking', swim: 'Swimming', rest: 'Rest',
};

const FITNESS_LABELS: Record<FitnessLevel, string> = {
  beginner: 'just getting started',
  returning: 'getting back into it after time away',
  intermediate: 'trains regularly and is comfortable pushing',
  advanced: 'well-trained and performance-focused',
};

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

/**
 * Seeds the new lifecycle-tracked coach memory (an active goal + durable
 * athlete_profile traits) from conversational onboarding answers, so a new
 * user's stated goal/constraints/preferences get the same structured
 * treatment the AI coach gives goals created later via chat or Settings.
 *
 * Best-effort: onboarding completion itself (saveOnboardingProfile) must
 * already have succeeded before this runs, and a failure here should never
 * block the user from reaching their dashboard — errors are logged, not thrown.
 */
export const seedCoachMemoryFromOnboarding = async (answers: {
  primary_goal: string;
  optional_event: string;
  activity_mix: ActivityMixItem[];
  weekly_availability_days: number;
  weekly_availability_duration: number;
  fitness_level: FitnessLevel;
}): Promise<void> => {
  const goalOption = GOAL_OPTIONS.find(o => o.value === answers.primary_goal);
  const goalTitle = goalOption?.label ?? answers.primary_goal;

  try {
    await goalsService.createActiveGoal({
      title: goalTitle,
      description: answers.optional_event || undefined,
      source: 'onboarding',
    });
  } catch (error) {
    console.error('Failed to create active goal from onboarding:', error);
  }

  const workoutTypes = [...answers.activity_mix]
    .sort((a, b) => a.priority - b.priority)
    .map(a => ACTIVITY_LABELS[a.type] ?? a.type);
  const topActivities = workoutTypes.slice(0, 2).join(' and ');
  const fitnessDescription = FITNESS_LABELS[answers.fitness_level] ?? answers.fitness_level;

  const narrative = `New TrainingSmart user, ${fitnessDescription}. Trains ${answers.weekly_availability_days}x/week, `
    + `~${answers.weekly_availability_duration} min/session${topActivities ? `, prioritizing ${topActivities}` : ''}.`;

  try {
    await athleteProfileService.editProfile({
      constraints: {
        timeAvailability: `${answers.weekly_availability_days} days/week, ${answers.weekly_availability_duration} min/session`,
      },
      preferences: {
        workoutTypes,
      },
      narrative,
    });
  } catch (error) {
    console.error('Failed to seed athlete profile from onboarding:', error);
  }
};
