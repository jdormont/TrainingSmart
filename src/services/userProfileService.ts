import { supabase } from './supabaseClient';

export interface UserProfile {
  training_goal?: string;
  weekly_hours?: number;
  coach_persona?: string;
  gender?: string;
  age_bucket?: string;
}

export interface ContentProfile {
  interests: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'pro';
  goals: string[];
  activity_types: string[];
  favorite_creators: string[];
  preferred_content_types: string[];
}

export const COACH_PERSONAS = [
  { value: 'supportive', label: 'Supportive', description: 'Gentle and encouraging' },
  { value: 'drill_sergeant', label: 'Drill Sergeant', description: 'Direct and demanding' },
  { value: 'analytical', label: 'Analytical', description: 'Data-focused and precise' }
];

export const TRAINING_GOALS = [
  { value: 'event_prep', label: 'Event Prep', description: 'Race preparation and peak performance' },
  { value: 'general_fitness', label: 'General Fitness', description: 'Health and consistency' },
  { value: 'performance', label: 'Performance/Speed', description: 'Power and speed development' },
  { value: 'weight_loss', label: 'Weight Loss', description: 'Weight management and metabolism' }
];

export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'pro', label: 'Pro' }
];

export const AVAILABLE_INTERESTS = [
  'Nutrition',
  'Hill Climbing',
  'Tech & Gear',
  'Racing',
  'Endurance',
  'Speed Work',
  'Recovery',
  'Bike Maintenance',
  'Training Science',
  'Mental Performance',
  'Injury Prevention',
  'Weight Loss',
  'Group Rides',
  'Time Trials',
  'Bike Fitting'
];

export const userProfileService = {
  async getUserProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_profiles')
      .select('training_goal, weekly_hours, coach_persona, gender, age_bucket')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateUserProfile(profile: Partial<UserProfile>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_profiles')
      .update({
        ...profile,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async getContentProfile(): Promise<ContentProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('content_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async updateContentProfile(profile: Partial<ContentProfile>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existingProfile } = await supabase
      .from('content_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingProfile) {
      const { error } = await supabase
        .from('content_profiles')
        .update({
          ...profile,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('content_profiles')
        .insert({
          user_id: user.id,
          ...profile
        });

      if (error) throw error;
    }
  }
};
