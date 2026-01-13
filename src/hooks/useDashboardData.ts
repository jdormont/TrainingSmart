import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { stravaCacheService } from '../services/stravaCacheService';
import { weeklyInsightService, WeeklyInsight, HealthMetrics } from '../services/weeklyInsightService';
import { healthMetricsService } from '../services/healthMetricsService';
import { dailyMetricsService } from '../services/dailyMetricsService';
import { trainingPlansService } from '../services/trainingPlansService';
import { streakService, UserStreak } from '../services/streakService';
import { ouraApi } from '../services/ouraApi';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import {
  MOCK_ATHLETE,
  MOCK_ACTIVITIES,
  MOCK_WEEKLY_STATS,
  MOCK_SLEEP_DATA,
  MOCK_READINESS_DATA,
  MOCK_DAILY_METRIC,
  MOCK_WEEKLY_INSIGHT,
  MOCK_HEALTH_METRICS,
  MOCK_NEXT_WORKOUT
} from '../data/mockDashboardData';
import type { StravaAthlete, StravaActivity, Workout, DailyMetric, OuraSleepData, OuraReadinessData, WeeklyStats } from '../types';

interface DashboardData {
  athlete: StravaAthlete | null;
  activities: StravaActivity[];
  weeklyStats: WeeklyStats | null;
  sleepData: OuraSleepData | null;
  readinessData: OuraReadinessData | null;
  dailyMetric: DailyMetric | null;
  dailyMetrics: DailyMetric[];
  weeklyInsight: WeeklyInsight | null;
  healthMetrics: HealthMetrics | null;
  nextWorkout: Workout | null;
  userStreak: UserStreak | null;
  isStravaConnected: boolean;
  isDemoMode: boolean;
  currentUserId: string;
}

export const useDashboardData = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isDemo = searchParams.get('demo') === 'true';

  const fetchDashboardData = async (): Promise<DashboardData> => {
    // === DEMO MODE ===
    if (isDemo) {
      return {
        athlete: MOCK_ATHLETE,
        activities: MOCK_ACTIVITIES,
        weeklyStats: MOCK_WEEKLY_STATS,
        sleepData: MOCK_SLEEP_DATA,
        readinessData: MOCK_READINESS_DATA,
        dailyMetric: MOCK_DAILY_METRIC,
        dailyMetrics: [MOCK_DAILY_METRIC],
        weeklyInsight: MOCK_WEEKLY_INSIGHT,
        healthMetrics: MOCK_HEALTH_METRICS,
        nextWorkout: MOCK_NEXT_WORKOUT,
        userStreak: {
          user_id: 'demo',
          current_streak: 5,
          longest_streak: 12,
          streak_freezes: 2,
          last_activity_date: new Date().toISOString(),
          streak_history: []
        },
        isStravaConnected: true,
        isDemoMode: true,
        currentUserId: 'demo'
      };
    }

    // === REAL DATA ===
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Fetch Basic Data (Athlete, Activities, Streak)
    let athleteData: StravaAthlete;
    let activitiesData: StravaActivity[];
    let streakData: UserStreak | null = null;

    try {
      [athleteData, activitiesData] = await Promise.all([
        stravaCacheService.getAthlete(),
        stravaCacheService.getActivities(false, 100)
      ]);
    } catch (error: any) {
      if (error?.message?.includes('authenticated') || error?.message?.includes('No valid access token') || error?.response?.status === 401) {
        console.log('Strava not connected');
        // Return mostly empty data structure for disconnected state
        return {
           athlete: null, activities: [], weeklyStats: null, sleepData: null, readinessData: null,
           dailyMetric: null, dailyMetrics: [], weeklyInsight: null, healthMetrics: null, nextWorkout: null,
           userStreak: null, isStravaConnected: false, isDemoMode: false, currentUserId: user.id
        };
      }
       throw error;
    }

    // 2. Fetch Streak & Sync if needed
    try {
      streakData = await streakService.getStreak(user.id);
      
      // Sync from history if needed
      const { data: manualWorkouts } = await supabase
        .from('workouts')
        .select('scheduled_date')
        .eq('user_id', user.id)
        .eq('completed', true);

      const historyItems = [
        ...activitiesData.map(a => ({ date: a.start_date_local, type: 'activity' as const, source: 'strava' as const })),
        ...(manualWorkouts || []).map(w => ({ date: w.scheduled_date, type: 'activity' as const, source: 'manual' as const }))
      ];

      if (historyItems.length > 0) {
        const syncedStreak = await streakService.syncFromHistory(user.id, historyItems);
        if (syncedStreak) streakData = syncedStreak;
      }
    } catch (err) {
      console.warn('Failed to load streak:', err);
    }
    
    // Also validate todays streak
    const localDate = new Date().toLocaleDateString('en-CA');
    const validatedStreak = await streakService.validateAndSyncLikely(user.id, localDate);
    if(validatedStreak) streakData = validatedStreak;


    // 3. Derived Stats
    const weeklyStats = calculateWeeklyStats(activitiesData);

    // 4. Recovery Data (Oura) & Metrics
    let sleepData: OuraSleepData | null = null;
    let readinessData: OuraReadinessData | null = null;
    
    if (await ouraApi.isAuthenticated()) {
      try {
        const [recentSleep, recentReadiness] = await Promise.all([
          ouraApi.getRecentSleepData(),
          ouraApi.getRecentReadinessData()
        ]);
        
        if (recentSleep.length > 0) {
           sleepData = recentSleep.reduce((latest, current) => 
            new Date(current.day) > new Date(latest.day) ? current : latest
          );
        }
        if (recentReadiness.length > 0) {
           readinessData = recentReadiness.reduce((latest, current) => 
            new Date(current.day) > new Date(latest.day) ? current : latest
           );
        }
      } catch (err) {
        console.warn('Failed to fetch Oura data:', err);
      }
    }

    // 5. Daily Metrics
    let recentMetrics: DailyMetric[] = [];
    let dailyMetric: DailyMetric | null = null;
    try {
      recentMetrics = await dailyMetricsService.getRecentMetrics(30);
      if (recentMetrics.length > 0) {
         // Sort by date desc
         const sorted = [...recentMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
         dailyMetric = sorted[0];
      }
    } catch (e) {
      console.error('Failed to fetch metrics', e);
    }

    // 6. Insights & Health Metrics
    // Note: We might want these to be their own queries if slow, but for now bundling is fine for "dashboard data"
    let weeklyInsight: WeeklyInsight | null = null;
    let healthMetrics: HealthMetrics | null = null;
    
    // We generate these on the fly or fetch cached - services handle caching usually? 
    // Actually weeklyInsightService.generateWeeklyInsight likely calls OpenAI so it might be slow.
    // Ideally we should cache this RESULT. But useQuery handles caching of the whole blob.
    // Getting raw data for insight generation needs Oura lists again if not passed
    
    // Simplification: Re-fetch arrays for insight generation (mirrors original logic)
    /* 
       Original logic fetched arrays for insight independently. 
       Let's reuse what we have if possible, or just let the service handle it. 
       The function generateWeeklyInsight takes arrays.
    */
    
    let sleepArray: OuraSleepData[] = [];
    let readinessArray: OuraReadinessData[] = [];
    if(sleepData) {
       // We only fetched "recent" above but didn't keep the array.
       // Let's optimize: Fetch arrays ONCE above.
       // Re-factoring step 4 above...
       try {
        if (await ouraApi.isAuthenticated()) {
           [sleepArray, readinessArray] = await Promise.all([
              ouraApi.getRecentSleepData(),
              ouraApi.getRecentReadinessData()
           ]);
        }
       } catch(e) { console.warn(e) }
    }

    try {
      weeklyInsight = await weeklyInsightService.generateWeeklyInsight(
        athleteData,
        activitiesData,
        sleepArray,
        readinessArray,
        recentMetrics
      );
    } catch (e) { console.warn('Insight failed', e); }

    try {
      healthMetrics = healthMetricsService.calculateHealthMetrics(
        athleteData,
        activitiesData,
        sleepArray,
        readinessArray
      );
    } catch(e) { console.warn('Health metrics failed', e); }


    // 7. Next Workout
    let nextWorkout: Workout | null = null;
    try {
      nextWorkout = await trainingPlansService.getNextUpcomingWorkout();
    } catch(e) { console.warn('Next workout failed', e); }


    return {
      athlete: athleteData,
      activities: activitiesData,
      weeklyStats,
      sleepData,
      readinessData,
      dailyMetric,
      dailyMetrics: recentMetrics,
      weeklyInsight,
      healthMetrics,
      nextWorkout,
      userStreak: streakData,
      isStravaConnected: true,
      isDemoMode: false,
      currentUserId: user.id
    };
  };

  return useQuery({
    queryKey: ['dashboard-data', isDemo ? 'demo' : 'user'], // simple key for now, userId handled inside or relies on auth state stability
    queryFn: fetchDashboardData,
    staleTime: 300000, // 5 mins
    retry: false // Don't retry auth errors
  });
};
