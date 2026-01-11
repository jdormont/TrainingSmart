import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ContentFeed } from '../components/home/ContentFeed';
import { supabase } from '../services/supabaseClient';

import { stravaCacheService } from '../services/stravaCacheService';
import { ROUTES } from '../utils/constants';
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

export const LearnPage: React.FC = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [contentProfile, setContentProfile] = useState<ContentProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
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
        } else {
          setUserProfile(profileData.data);
        }

        if (contentData.error) {
          console.error('Error loading content profile:', contentData.error);
        } else {
          setContentProfile(contentData.data);
        }

        setActivities(activitiesData);
      } catch (err) {
        console.error('Failed to load Learn page data:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const getPageTitle = (): string => {
    if (userProfile?.training_goal) {
      return `Curated for Your ${userProfile.training_goal}`;
    }
    return 'Discover Content for You';
  };

  const getPageDescription = (): string => {
    if (!contentProfile) {
      return 'Personalized cycling content based on your training';
    }

    const interests = contentProfile.interests.slice(0, 3).join(', ');
    const goals = contentProfile.goals.slice(0, 2).join(' and ');

    if (interests && goals) {
      return `Focusing on ${interests} to help you achieve ${goals}`;
    } else if (interests) {
      return `Content about ${interests}`;
    } else if (goals) {
      return `Helping you achieve ${goals}`;
    }

    return 'Personalized cycling content based on your training';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
          <h2 className="text-xl font-semibold text-slate-50 mb-2">
            Loading Your Learning Hub
          </h2>
          <p className="text-slate-400">
            Personalizing content based on your preferences...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 rounded-lg shadow-md p-6 border border-slate-800">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-slate-50 mb-2">
              Unable to Load Content
            </h2>
            <p className="text-slate-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
            <div className="flex items-start space-x-3 flex-1">
              <div className="bg-orange-500/10 p-2 md:p-3 rounded-lg flex-shrink-0 mt-1 md:mt-0">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-50 flex items-center flex-wrap">
                  {getPageTitle()}
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 ml-2 text-orange-400 flex-shrink-0" />
                </h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">
                  {getPageDescription()}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(ROUTES.SETTINGS)}
              className="flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-slate-300 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors w-full md:w-auto"
            >
              <Settings className="w-4 h-4" />
              <span>Edit Preferences</span>
            </button>
          </div>

          {contentProfile && (
            <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-4">
              <div className="flex flex-wrap gap-6 text-sm">
                {contentProfile.skill_level && (
                  <div>
                    <span className="text-slate-500 mr-2">Level:</span>
                    <span className="font-medium text-slate-200 capitalize">
                      {contentProfile.skill_level}
                    </span>
                  </div>
                )}
                {contentProfile.interests.length > 0 && (
                  <div>
                    <span className="text-slate-500 mr-2">Interests:</span>
                    <span className="font-medium text-slate-200">
                      {contentProfile.interests.slice(0, 4).join(', ')}
                    </span>
                  </div>
                )}
                {contentProfile.goals.length > 0 && (
                  <div>
                    <span className="text-slate-500 mr-2">Goals:</span>
                    <span className="font-medium text-slate-200">
                      {contentProfile.goals.slice(0, 3).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <ContentFeed activities={activities} />
      </div>
    </div>
  );
};
