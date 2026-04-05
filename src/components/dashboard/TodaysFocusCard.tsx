import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Activity, 
  Map, 
  Battery, 
  HeartPulse, 
  Sparkles
} from 'lucide-react';
import type { DailyMetric, CoachSpecialization, Workout } from '../../types';

interface TodaysFocusCardProps {
  dailyMetric: DailyMetric | null;
  coachSpecialization?: CoachSpecialization;
  isDemoMode?: boolean;
}

export const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({
  dailyMetric,
  coachSpecialization,
  isDemoMode = false
}) => {
  const { userProfile } = useAuth();
  const [recentWorkout, setRecentWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentWorkout = async () => {
      if (isDemoMode) {
        setRecentWorkout({
          id: 'demo-workout',
          name: 'Demo Ride',
          type: 'bike',
          description: '',
          duration: 45,
          intensity: 'hard',
          scheduledDate: new Date(Date.now() - 86400000), // Yesterday
          completed: true,
          status: 'completed'
        });
        setLoading(false);
        return;
      }

      if (!userProfile?.user_id) {
        setLoading(false);
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userProfile.user_id)
          .lt('scheduled_date', today) // Strictly before today
          .order('scheduled_date', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setRecentWorkout({
            ...data,
            scheduledDate: new Date(data.scheduled_date + 'T00:00:00'),
          } as Workout);
        }
      } catch (err) {
        // Silently fail and downgrade gracefully
        console.warn('Failed to fetch recent workout for focus card:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentWorkout();
  }, [userProfile?.user_id, isDemoMode]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 animate-pulse">
        <div className="h-5 bg-slate-800 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-800 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  // Synthesis Logic
  const recoveryScore = dailyMetric?.recovery_score ?? null;
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday...
  
  // Calculate days since last workout
  let daysSinceLastSession = 0;
  let lastSessionYesterday = false;
  if (recentWorkout) {
    const lastDate = recentWorkout.scheduledDate.getTime();
    const today = new Date().setHours(0,0,0,0);
    daysSinceLastSession = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    lastSessionYesterday = daysSinceLastSession === 1;
  }

  const isLowRecovery = recoveryScore !== null && recoveryScore < 60;
  const isHighRecovery = recoveryScore !== null && recoveryScore > 80;
  const wasHighIntensity = recentWorkout?.intensity === 'hard';

  let headline = "Consistency is what counts today";
  let explanation = "Keep moving to maintain your training habit.";
  let suggestion = "20-30 min session of your choice";
  let Icon = Sparkles;
  let iconColor = "text-blue-400";

  if (isLowRecovery) {
    headline = "Take it easy today";
    explanation = `Your recovery is lower than usual (${recoveryScore}%). Listen to your body and avoid pushing too hard.`;
    suggestion = "15-20 min mobility or easy walk";
    Icon = Battery;
    iconColor = "text-red-400";
    if (coachSpecialization === 'strength_mobility') {
      suggestion = "15-20 min dedicated stretching and mobility";
    }
  } else if (isHighRecovery && daysSinceLastSession >= 2) {
    headline = "Good day to push";
    explanation = `Your recovery is excellent (${recoveryScore}%) and you're well rested from your last session.`;
    suggestion = "45-60 min effort building session";
    Icon = HeartPulse;
    iconColor = "text-green-400";
    if (coachSpecialization === 'endurance') {
      suggestion = "45-60 min threshold intervals";
    }
  } else if (lastSessionYesterday && wasHighIntensity) {
    headline = "Mobility work would serve you well";
    explanation = "You had a hard session yesterday. Active recovery will help your muscles bounce back faster.";
    suggestion = "25 min yoga or active recovery spin";
    Icon = Activity;
    iconColor = "text-orange-400";
  } else if (dayOfWeek === 0 || dayOfWeek === 6) {
    headline = "Enjoy the weekend";
    explanation = "It's a great time to get outside or do something fun.";
    suggestion = "Long unstructured activity (e.g., hiking or long ride)";
    Icon = Map;
    iconColor = "text-purple-400";
  } else {
    // Default fallback, but try to nuance with existing data
    if (recoveryScore) {
      explanation = `Your recovery is steady at ${recoveryScore}%.`;
      suggestion = "A 20-30 min session of your choice";
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4 shadow-sm relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-6 -top-6 opacity-5 pointer-events-none">
        <Icon className="w-32 h-32" />
      </div>

      <div className="flex items-start mb-3">
        <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 mr-3 flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-slate-200 font-semibold text-lg leading-tight mb-1">{headline}</h3>
          <p className="text-slate-400 text-sm">{explanation}</p>
        </div>
      </div>
      
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mb-0.5">Suggested</span>
          <span className="text-slate-300 font-medium text-sm">{suggestion}</span>
        </div>
        <div className="text-xs text-slate-500 text-right max-w-[120px] leading-tight flex items-center">
          Based on your recovery + recent activity
        </div>
      </div>
    </div>
  );
};
