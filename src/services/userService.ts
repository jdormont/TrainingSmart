import { supabase } from './supabaseClient';
import type { UserContentProfile } from '../types';

export interface WizardData {
  training_goal: string;
  weekly_hours: number;
  coach_persona: string;
}

export interface ContentProfileSeed {
  goals: string[];
  interests: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced';
}

function mapWizardToContentProfile(trainingGoal: string): ContentProfileSeed {
  switch (trainingGoal) {
    case 'Event Prep':
      return {
        goals: ['race strategy', 'peak performance'],
        interests: ['racing', 'race preparation', 'events'],
        skill_level: 'intermediate'
      };

    case 'General Fitness':
      return {
        goals: ['consistency', 'health'],
        interests: ['lifestyle', 'nutrition', 'general fitness'],
        skill_level: 'beginner'
      };

    case 'Performance/Speed':
      return {
        goals: ['power', 'speed'],
        interests: ['training science', 'interval training', 'tech'],
        skill_level: 'advanced'
      };

    case 'Weight Loss':
      return {
        goals: ['weight management', 'metabolism'],
        interests: ['nutrition', 'indoor cycling', 'health'],
        skill_level: 'beginner'
      };

    default:
      return {
        goals: ['fitness improvement'],
        interests: ['general fitness'],
        skill_level: 'beginner'
      };
  }
}

export async function completeOnboarding(wizardData: WizardData): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { training_goal, weekly_hours, coach_persona } = wizardData;

  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({
      training_goal,
      weekly_hours,
      coach_persona,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  if (profileError) {
    throw new Error(`Failed to update user profile: ${profileError.message}`);
  }

  const { data: existingContentProfile, error: checkError } = await supabase
    .from('content_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check content profile: ${checkError.message}`);
  }

  if (!existingContentProfile) {
    const contentSeed = mapWizardToContentProfile(training_goal);

    const { error: contentProfileError } = await supabase
      .from('content_profiles')
      .insert({
        user_id: user.id,
        interests: contentSeed.interests,
        goals: contentSeed.goals,
        skill_level: contentSeed.skill_level,
        activity_types: [],
        favorite_creators: [],
        preferred_content_types: ['video', 'article'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (contentProfileError) {
      throw new Error(`Failed to create content profile: ${contentProfileError.message}`);
    }

    console.log('Content profile seeded successfully with:', contentSeed);
  } else {
    console.log('Content profile already exists, skipping seed');
  }
}

export async function getUserOnboardingStatus(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('training_goal')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to check onboarding status:', error);
    return false;
  }

  return profile?.training_goal != null;
}
