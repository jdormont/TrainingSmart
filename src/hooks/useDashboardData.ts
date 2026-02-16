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
  sleepHistory: OuraSleepData[];
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
        sleepHistory: Array(30).fill(MOCK_SLEEP_DATA), // Mock history
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
      // Split Fetch: 5 full + 90 stats
      const [athlete, recentActivities, historyStats] = await Promise.all([
        stravaCacheService.getAthlete(),
        stravaCacheService.getActivities(false, 5),
        stravaCacheService.getActivitiesForStats(90)
      ]);
      
      athleteData = athlete;

      // Merge: Recent ones take precedence
      const recentIds = new Set(recentActivities.map(a => a.id));
      activitiesData = [
        ...recentActivities,
        ...historyStats.filter(a => !recentIds.has(a.id))
      ].sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime());

    } catch (error: any) {
      if (error?.message?.includes('authenticated') || error?.message?.includes('No valid access token') || error?.response?.status === 401) {
        console.log('Strava not connected');
        // Return mostly empty data structure for disconnected state
        return {
           athlete: null, activities: [], weeklyStats: null, sleepData: null, sleepHistory: [], readinessData: null,
           dailyMetric: null, dailyMetrics: [], weeklyInsight: null, healthMetrics: null, nextWorkout: null,
           userStreak: null, isStravaConnected: false, isDemoMode: false, currentUserId: user.id
        };
      }
       throw error;
    }

    // 2. Fetch Streak 
    try {
      streakData = await streakService.getStreak(user.id);
      
      // Only initial backfill if never initialized or empty
      if (!streakData || (streakData.current_streak === 0 && streakData.streak_history.length === 0)) {
         
        // Fetch manual workouts
        const { data: manualWorkouts } = await supabase
            .from('workouts')
            .select('scheduled_date')
            .eq('user_id', user.id)
            .eq('completed', true);

        // Merge Strava activities and manual workouts for streak calculation
        const streakActivities = [
            ...activitiesData.map(a => ({ date: a.start_date_local, type: 'activity' as const, source: 'strava' as const })),
            ...(manualWorkouts || []).map(w => ({ date: w.scheduled_date, type: 'activity' as const, source: 'manual' as const }))
        ];

        try {
            const streak = await streakService.syncFromHistory(user.id, streakActivities);
            if (streak) streakData = streak;
        } catch (err) {
             console.warn('Failed to calculate streak:', err);
        }
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

    // 5. Recovery Data (Oura) & Metrics
    // STRATEGY: 
    // 1. Fetch from 'daily_metrics' table (Stored Data)
    // 2. Trigger Oura Sync (Background) to ensure freshness
    
    let sleepData: OuraSleepData | null = null;
    let readinessData: OuraReadinessData | null = null;
    let dailyMetric: DailyMetric | null = null;
    let recentMetrics: DailyMetric[] = []; // Initialize here

    try {
      // A. Fetch stored metrics (Source of Truth)
      recentMetrics = await dailyMetricsService.getRecentMetrics(30);
      
      // B. Background/Blocking Sync (If Oura Connected)
      // We check auth inside syncOuraToDatabase anyway, but check here to avoid overhead
      const isOuraConnected = await ouraApi.isAuthenticated();
      // Ref to track if we've already attempted background sync this session
      // This prevents infinite loops if Oura API returns data but not for "today"
      if (isOuraConnected && !isDemo) {
          const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
          const hasTodayData = recentMetrics.some(m => m.date === today && m.source === 'oura');

          // We use a window-level variable or query data check to avoid re-triggering on every render
          // Since this is inside a queryFn, it runs every time the query invalidates.
          // We need to be careful. The queryFn logic itself is stateless between runs unless we use external state.
          // HOWEVER, invalidateQueries re-runs this function.
          
          // Better approach: Check if we just synced. 
          // But simpler: If we are missing today's data, we sync. 
          // To fix the loop: valid Oura sync usually brings today's data. 
          // If it DOESN'T, we shouldn't keep retrying instantly.
          
          // Let's stick to the boolean return AND check if 'today' was actually in the synced data?
          // No, 'didSync' is generic.
          
          // Let's use a session storage key to rate limit the auto-sync?
          const lastSyncKey = `oura-sync-${user.id}-${today}`;
          const lastSync = sessionStorage.getItem(lastSyncKey);
          
          if (!hasTodayData && !lastSync) {
             console.log('⏳ Triggering background Oura sync...');
             sessionStorage.setItem(lastSyncKey, 'true'); // Mark as attempted immediately
             
             // NON-BLOCKING Sync
             ouraApi.syncOuraToDatabase(user.id, undefined, undefined)
                .then((didSync) => {
                    if (didSync) {
                      console.log('✅ Background Oura sync complete. Invalidating queries.');
                      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
                    } else {
                      console.log('ℹ️ Oura sync finished (no new data). No invalidation.');
                    }
                })
                .catch(e => {
                    console.warn('Background Oura sync failed:', e);
                    sessionStorage.removeItem(lastSyncKey); // Allow retry on error
                });
          }

          
          // Fetch existing data immediately from DB
          // This will be used to populate sleepData/readinessData and the sleepArray/readinessArray
          // If the background sync completes, the query will be invalidated and refetched with fresh data.
          recentMetrics = await dailyMetricsService.getRecentMetrics(30);
      }

      if (recentMetrics.length > 0) {
         // Sort by date desc
         const sorted = [...recentMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
         // Find the latest record that has actual data (not just empty row)
         dailyMetric = sorted.find(m => (m.sleep_minutes || 0) > 0 || (m.recovery_score || 0) > 0) || sorted[0];
         
         // Map DailyMetric back to Oura structures for UI compatibility if needed
         // (Or we update UI to use DailyMetric directly - Phase 2)
         // For now, let's create synthetic Oura objects if missing, so existing UI works
         if (dailyMetric && dailyMetric.source === 'oura') {
             sleepData = {
                 id: dailyMetric.id || 'db-synced',
                 day: dailyMetric.date,
                 total_sleep_duration: (dailyMetric.sleep_minutes || 0) * 60,
                 efficiency: dailyMetric.sleep_efficiency || 0,
                 deep_sleep_duration: (dailyMetric.deep_sleep_minutes || 0) * 60,
                 rem_sleep_duration: (dailyMetric.rem_sleep_minutes || 0) * 60,
                 light_sleep_duration: (dailyMetric.light_sleep_minutes || 0) * 60,
                 average_hrv: dailyMetric.hrv || 0,
                 lowest_heart_rate: dailyMetric.resting_hr || 0,
                 average_breath: dailyMetric.respiratory_rate || 0,
                 temperature_deviation: dailyMetric.temperature_deviation,
                 // Defaults for fields we don't store yet
                 bedtime_start: '', bedtime_end: '', latency: 0, awake_time: 0, restless_periods: 0, 
                 sleep_score_delta: 0, average_heart_rate: 0, time_in_bed: 0
             };
             readinessData = {
                 id: dailyMetric.id || 'db-synced',
                 day: dailyMetric.date,
                 score: dailyMetric.recovery_score || 0,
                 temperature_deviation: dailyMetric.temperature_deviation || 0,
                 // Defaults
                 temperature_trend_deviation: 0, timestamp: '', contributors: {}
             };
         }
      }

    } catch (e) {
      console.error('Failed to fetch/sync recovery data', e);
    }


    // 5. Insights & Health Metrics (Remaining Logic)
    let weeklyInsight: WeeklyInsight | null = null;
    let healthMetrics: HealthMetrics | null = null;
    
    // We construct arrays from dailyMetrics for calculation
    // This allows insights to work offline using stored data
    const sleepArray: OuraSleepData[] = recentMetrics
        .filter(m => m.source === 'oura')
        .map(m => ({
            id: m.id || '',
            day: m.date,
            total_sleep_duration: (m.sleep_minutes || 0) * 60,
            efficiency: m.sleep_efficiency || 0,
            average_hrv: m.hrv || 0,
            lowest_heart_rate: m.resting_hr || 0,
            average_breath: m.respiratory_rate || 0,
            // ... minimal fields needed for insights
            bedtime_start: '', bedtime_end: '', latency: 0, awake_time: 0, light_sleep_duration: 0,
            deep_sleep_duration: 0, rem_sleep_duration: 0, restless_periods: 0, sleep_score_delta: 0,
            average_heart_rate: 0, time_in_bed: 0
        }));

    const readinessArray: OuraReadinessData[] = recentMetrics
        .filter(m => m.source === 'oura')
        .map(m => ({
            id: m.id || '',
            day: m.date,
            score: m.recovery_score || 0,
            temperature_deviation: m.temperature_deviation || 0,
            temperature_trend_deviation: 0, timestamp: '', contributors: {}
        }));


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


    // 6. Next Workout
    let nextWorkout: Workout | null = null;
    try {
      nextWorkout = await trainingPlansService.getNextUpcomingWorkout();
    } catch(e) { console.warn('Next workout failed', e); }


    return {
      athlete: athleteData,
      activities: activitiesData,
      weeklyStats,
      sleepData,
      sleepHistory: sleepArray,
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
    queryKey: ['dashboard-data', isDemo ? 'demo' : 'user'], 
    queryFn: fetchDashboardData,
    staleTime: 300000, // 5 mins
    retry: false 
  });
};
