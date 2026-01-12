import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { stravaCacheService } from '../services/stravaCacheService';
import type { StravaActivity } from '../types';

interface ContentProfile {
  interests: string[];
  goals: string[];
  skill_level: 'beginner' | 'intermediate' | 'advanced';
  activity_types: string[];
  favorite_creators: string[];
  preferred_content_types: string[];
}

interface UserProfile {
  training_goal?: string;
  coach_persona?: string;
  weekly_hours?: number;
}

interface LearnData {
  activities: StravaActivity[];
  contentProfile: ContentProfile | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
}

export const useLearnData = () => {
  const fetchLearnData = async (): Promise<LearnData> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Return empty/guest state or throw? LearnPage threw error.
        // Let's return unauthenticated state and let UI handle it, or throw if strict.
        // LearnPage logic threw "User not authenticated".
        throw new Error('User not authenticated');
    }

    const [profileData, contentData, activitiesData] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('training_goal, coach_persona, weekly_hours')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('content_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      stravaCacheService.getActivities(false, 30)
    ]);

    if (profileData.error) {
      console.error('Error loading user profile:', profileData.error);
    }

    if (contentData.error) {
      console.error('Error loading content profile:', contentData.error);
    }

    return {
      activities: activitiesData,
      contentProfile: contentData.data,
      userProfile: profileData.data,
      isAuthenticated: true
    };
  };

  return useQuery({
    queryKey: ['learn-data'],
    queryFn: fetchLearnData,
    staleTime: 300000, // 5 mins
    retry: false
  });
};
