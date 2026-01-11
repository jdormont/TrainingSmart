import React, { useState, useEffect } from 'react';

import { stravaCacheService } from '../services/stravaCacheService';
import { ouraApi } from '../services/ouraApi';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { ActivityCard } from '../components/dashboard/ActivityCard';
import { ActivityDetailModal } from '../components/dashboard/ActivityDetailModal';
import { DashboardHero } from '../components/dashboard/DashboardHero';
import { AnalyticsContainer } from '../components/dashboard/AnalyticsContainer';
import { SmartWorkoutPreview } from '../components/dashboard/SmartWorkoutPreview';
import { WorkoutDetailModal } from '../components/dashboard/WorkoutDetailModal';
import { IntakeWizard } from '../components/onboarding/IntakeWizard';
import { weeklyInsightService } from '../services/weeklyInsightService';
import { healthMetricsService } from '../services/healthMetricsService';
import { dailyMetricsService } from '../services/dailyMetricsService';
import { trainingPlansService } from '../services/trainingPlansService';
import { streakService, UserStreak } from '../services/streakService';
import { StreakWidget } from '../components/dashboard/StreakWidget';
import { StreakCelebration, CelebrationType } from '../components/common/StreakCelebration';
import { getUserOnboardingStatus } from '../services/userService';
import type { StravaActivity, StravaAthlete, WeeklyStats, OuraSleepData, OuraReadinessData, DailyMetric, Workout } from '../types';
import type { WeeklyInsight, HealthMetrics } from '../services/weeklyInsightService';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { MessageCircle, ChevronDown, ChevronUp, Calendar, Link2Off, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/constants';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';
import { analytics } from '../lib/analytics';

import { supabase } from '../services/supabaseClient';

interface AuthError {
  message?: string;
  response?: {
    status?: number;
  };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [displayedActivities, setDisplayedActivities] = useState<StravaActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [sleepData, setSleepData] = useState<OuraSleepData | null>(null);
  const [readinessData, setReadinessData] = useState<OuraReadinessData | null>(null);
  const [dailyMetric, setDailyMetric] = useState<DailyMetric | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [nextWorkout, setNextWorkout] = useState<Workout | null>(null);
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null);
  const [celebration, setCelebration] = useState<CelebrationType>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [isStravaConnected, setIsStravaConnected] = useState(false);

  // Onboarding wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const INITIAL_ACTIVITIES_COUNT = 5;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch athlete data and recent activities from cache
        let athleteData: StravaAthlete;
        let activitiesData: StravaActivity[];

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        setCurrentUserId(user.id);

        try {
          const streakData = await streakService.getStreak(user.id);
          console.log('Dashboard loaded streak:', streakData);
          setUserStreak(streakData);
        } catch (err) {
          console.warn('Failed to load streak:', err);
        }

        try {
          [athleteData, activitiesData] = await Promise.all([
            stravaCacheService.getAthlete(),
            stravaCacheService.getActivities(false, 100)
          ]);
        } catch (error: unknown) {
          const authError = error as AuthError;
          // If we get an authentication error, show the ghost dashboard
          if (authError?.message?.includes('authenticated') ||
            authError?.message?.includes('token') ||
            authError?.response?.status === 401 ||
            authError?.response?.status === 403) {
            console.log('Strava not connected:', authError.message);
            setIsStravaConnected(false);
            setLoading(false);
            return;
          }
          // Re-throw other errors
          throw authError;
        }

        // If we got here, we're connected
        setIsStravaConnected(true);
        setAthlete(athleteData);
        setActivities(activitiesData);
        setDisplayedActivities(activitiesData.slice(0, INITIAL_ACTIVITIES_COUNT));

        // Sync Streak from Activities + Manual Workouts (Backfill if 0)
        try {
          // Fetch manual completed workouts
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
            streakService.syncFromHistory(user.id, historyItems).then(syncedStreak => {
              if (syncedStreak) {
                console.log('Dashboard: Streaks synced from history (Strava + Manual)');
                setUserStreak(syncedStreak);
              }
            });
          }
        } catch (syncErr) {
          console.warn('Dashboard: Failed to sync streak history:', syncErr);
        }

        // Calculate weekly stats
        const stats = calculateWeeklyStats(activitiesData);
        setWeeklyStats(stats);

        // Fetch Oura data if authenticated
        if (await ouraApi.isAuthenticated()) {
          console.log('Oura is authenticated, fetching recovery data...');
          try {
            console.log('=== OURA DATA FETCH DEBUG ===');
            const [recentSleep, recentReadiness] = await Promise.all([
              ouraApi.getRecentSleepData(),
              ouraApi.getRecentReadinessData()
            ]);

            console.log('Oura data fetched:', {
              sleepRecords: recentSleep.length,
              readinessRecords: recentReadiness.length
            });

            console.log('Raw sleep data array:', recentSleep);
            console.log('Raw readiness data array:', recentReadiness);

            if (recentSleep.length > 0) {
              // Find the most recent sleep data by date
              const latestSleep = recentSleep.reduce((latest, current) => {
                return new Date(current.day) > new Date(latest.day) ? current : latest;
              });
              console.log('Latest sleep record:', latestSleep);
              console.log('Sleep data fields:', Object.keys(latestSleep));
              setSleepData(latestSleep);
              console.log('Sleep data set in state');
            } else {
              console.log('No sleep data available');
            }

            if (recentReadiness.length > 0) {
              // Find the most recent readiness data by date
              const latestReadiness = recentReadiness.reduce((latest, current) => {
                return new Date(current.day) > new Date(latest.day) ? current : latest;
              });
              console.log('Latest readiness record:', latestReadiness);
              console.log('Readiness data fields:', Object.keys(latestReadiness));
              setReadinessData(latestReadiness);
              console.log('Readiness data set in state');
            } else {
              console.log('No readiness data available');
            }

            console.log('=== END OURA DATA FETCH ===');
          } catch (err: unknown) {
            const ouraError = err as Error;
            console.error('Failed to fetch Oura data:', ouraError);
            console.error('Oura error details:', {
              message: ouraError.message,
              stack: ouraError.stack
            });
          }
        } else {
          console.log('Oura is not authenticated, skipping recovery data fetch');
        }

        // Fetch daily metrics if no Oura data (or as primary source now)
        // We always fetch daily metrics now for the Bio-Aware Insight
        let recentMetrics: DailyMetric[] = [];
        try {
          console.log('Fetching daily metrics...');
          recentMetrics = await dailyMetricsService.getRecentMetrics(30);
          setDailyMetrics(recentMetrics);

          if (recentMetrics.length > 0) {
            // Sort by date desc just to be sure
            const sorted = [...recentMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            console.log('Daily metrics found:', sorted.length);
            setDailyMetric(sorted[0]);
          } else {
            console.log('No daily metrics available');
          }
        } catch (metricsError) {
          console.error('Failed to fetch daily metrics:', metricsError);
        }

        // Generate weekly insight
        await generateWeeklyInsight(athleteData, activitiesData, recentMetrics);

        // Generate health metrics
        await generateHealthMetrics(athleteData, activitiesData);

        // Fetch next workout
        try {
          const next = await trainingPlansService.getNextUpcomingWorkout();
          setNextWorkout(next);
        } catch (err) {
          console.error('Failed to fetch next workout:', err);
        }

        // Fetch streak data
        await fetchStreakData(user.id);

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        const errorMessage = (err as Error).message;

        if (errorMessage.includes('rate limit')) {
          setError(errorMessage);
        } else {
          setError('Failed to load your training data. Please try refreshing the page.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Midnight / Focus check
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getUser().then(({ data }) => {
          if (data.user) fetchStreakData(data.user.id);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const fetchStreakData = async (userId: string) => {
    try {
      // Use local date for client-side truth
      const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const streak = await streakService.validateAndSyncLikely(userId, localDate);
      setUserStreak(streak);
    } catch (err) {
      console.error('Failed to fetch streak:', err);
    }
  };

  const handleStreakUpdate = (newStreak: UserStreak) => {
    // Check for celebration
    if (userStreak) {
      if (newStreak.streak_freezes > userStreak.streak_freezes) {
        setCelebration('freeze_earned');
      } else if (newStreak.current_streak > userStreak.current_streak) {
        setCelebration('increment');
      }
    }
    setUserStreak(newStreak);
  };


  useEffect(() => {
    if (showAllActivities) {
      setDisplayedActivities(activities);
    } else {
      setDisplayedActivities(activities.slice(0, INITIAL_ACTIVITIES_COUNT));
    }
  }, [showAllActivities, activities]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const isOnboarded = await getUserOnboardingStatus();
        setShowWizard(!isOnboarded);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  const handleWizardComplete = () => {
    setShowWizard(false);
    window.location.reload();
  };

  const generateWeeklyInsight = async (athleteData: StravaAthlete, activitiesData: StravaActivity[], metrics: DailyMetric[] = []) => {
    try {
      setInsightLoading(true);
      console.log('Generating weekly insight...');

      // Get Oura data for insight generation
      let sleepDataForInsight: OuraSleepData[] = [];
      let readinessDataForInsight: OuraReadinessData[] = [];

      if (await ouraApi.isAuthenticated()) {
        try {
          const [sleepArray, readinessArray] = await Promise.all([
            ouraApi.getRecentSleepData(),
            ouraApi.getRecentReadinessData()
          ]);
          sleepDataForInsight = sleepArray;
          readinessDataForInsight = readinessArray;
        } catch (ouraError) {
          console.warn('Could not load Oura data for insight generation:', ouraError);
        }
      }

      const insight = await weeklyInsightService.generateWeeklyInsight(
        athleteData,
        activitiesData,
        sleepDataForInsight,
        readinessDataForInsight,
        metrics
      );

      setWeeklyInsight(insight);
      console.log('Weekly insight generated:', insight);
    } catch (error) {
      console.error('Failed to generate weekly insight:', error);
    } finally {
      setInsightLoading(false);
    }
  };

  const generateHealthMetrics = async (athleteData: StravaAthlete, activitiesData: StravaActivity[]) => {
    try {
      console.log('Generating health metrics...');

      // Get Oura data for health metrics
      let sleepDataForHealth: OuraSleepData[] = [];
      let readinessDataForHealth: OuraReadinessData[] = [];

      if (await ouraApi.isAuthenticated()) {
        try {
          const [sleepArray, readinessArray] = await Promise.all([
            ouraApi.getRecentSleepData(),
            ouraApi.getRecentReadinessData()
          ]);
          sleepDataForHealth = sleepArray;
          readinessDataForHealth = readinessArray;
        } catch (ouraError) {
          console.warn('Could not load Oura data for health metrics:', ouraError);
        }
      }

      const metrics = healthMetricsService.calculateHealthMetrics(
        athleteData,
        activitiesData,
        sleepDataForHealth,
        readinessDataForHealth
      );

      setHealthMetrics(metrics);
      console.log('Health metrics generated:', metrics);
    } catch (error) {
      console.error('Failed to generate health metrics:', error);
    }
  };

  const handleRefreshInsight = async () => {
    if (!athlete || !activities.length) return;

    // Clear cache and regenerate
    weeklyInsightService.clearCache();
    weeklyInsightService.clearCache();
    await generateWeeklyInsight(athlete, activities, dailyMetrics);
  };

  // Find similar activities for comparison
  const getSimilarActivities = (activity: StravaActivity): StravaActivity[] => {
    return activities.filter(a =>
      a.id !== activity.id &&
      a.type === activity.type &&
      Math.abs(a.distance - activity.distance) < (activity.distance * 0.3) // Within 30% of distance
    ).slice(0, 10); // Limit to 10 for comparison
  };

  const handleActivityClick = (activity: StravaActivity) => {
    analytics.track('activity_card_clicked', { type: activity.type, id: activity.id });
    setSelectedActivity(activity);
  };

  const handleCloseModal = () => {
    setSelectedActivity(null);
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Your Training Data
          </h2>
          <p className="text-gray-600">
            Fetching your latest activities from Strava...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Unable to Load Data
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
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

  if (!loading && !isStravaConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to TrainingSmart AI! 👋
            </h1>
            <p className="text-gray-600">
              Connect your Strava account to start analyzing your training data
            </p>
          </div>

          {/* Action Header - Disabled State */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => { }}
                className="w-full opacity-50 cursor-not-allowed"
                disabled
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Chat with AI Coach
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Demo Mode</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => { }}
                className="w-full opacity-50 cursor-not-allowed"
                disabled
              >
                <Calendar className="w-5 h-5 mr-2" />
                Generate New Plan
                <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Demo Mode</span>
              </Button>
            </div>
          </div>

          {/* Ghost Dashboard - Locked Analytics Section */}
          <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
            {/* Grayed Out Background */}
            <div className="absolute inset-0 bg-gray-50 opacity-50 z-0"></div>

            {/* Skeleton/Placeholder Charts */}
            <div className="relative z-0 p-6 opacity-30">
              <div className="mb-8">
                <div className="h-64 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            </div>

            {/* Centered Action Card Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-white rounded-xl shadow-xl border-2 border-gray-300 p-8 max-w-md mx-4 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="p-4 bg-orange-50 rounded-full">
                    <Link2Off className="w-12 h-12 text-orange-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Training Data Offline
                </h3>
                <p className="text-gray-600 mb-6">
                  Connect your Strava account to unlock AI analysis and performance trends.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate(ROUTES.SETTINGS)}
                  className="w-full"
                >
                  <Activity className="w-5 h-5 mr-2" />
                  Connect Strava
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  Your data stays private and secure
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Why Connect Strava?
            </h3>
            <ul className="space-y-2 text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>AI-powered training insights based on your actual performance</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Personalized coaching recommendations and training plans</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Track your progress over time with detailed analytics</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">✓</span>
                <span>Optimize your training with recovery and performance metrics</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Intake Wizard Modal - Always render if needed */}
        {showWizard && !checkingOnboarding && (
          <IntakeWizard onComplete={handleWizardComplete} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NetworkErrorBanner />
      <StreakCelebration
        type={celebration}
        details={{ streak: userStreak?.current_streak, freezes: userStreak?.streak_freezes }}
        onClose={() => setCelebration(null)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage (Left/Top) */}
          <div className="lg:col-span-2 space-y-6">
              <div className="lg:hidden mb-6">
                <SmartWorkoutPreview
                  nextWorkout={nextWorkout}
                  dailyMetrics={dailyMetric}
                  onWorkoutGenerated={(workout) => {
                    setNextWorkout(workout);
                    fetchStreakData(currentUserId);
                  }}
                  onViewDetails={setSelectedWorkout}
                />
              </div>
              <DashboardHero
                athlete={athlete}
                weeklyInsight={weeklyInsight}
                weeklyStats={weeklyStats}
                onRefreshInsight={handleRefreshInsight}
                insightLoading={insightLoading}
              />

            <AnalyticsContainer
              activities={activities}
              athlete={athlete}
              healthMetrics={healthMetrics}
              sleepData={sleepData}
              readinessData={readinessData}
              dailyMetric={dailyMetric}
              loading={loading}
            />
          </div>


          {/* Right Rail (Recent Activities) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="hidden lg:block">
              <SmartWorkoutPreview
                nextWorkout={nextWorkout}
                dailyMetrics={dailyMetric}
                onWorkoutGenerated={(workout) => {
                  setNextWorkout(workout);
                  fetchStreakData(currentUserId);
                }}
                onViewDetails={setSelectedWorkout}
              />
            </div>
            <StreakWidget
              streak={userStreak}
              isRestDay={(() => {
                if (!nextWorkout) return true; // No upcoming workout at all -> Rest/Free
                const todayStr = new Date().toLocaleDateString('en-CA');
                const workoutDateStr = nextWorkout.scheduledDate.toISOString().split('T')[0];
                const isToday = workoutDateStr === todayStr;

                if (!isToday) return true; // Next workout is in future -> Today is Rest
                return nextWorkout.intensity === 'recovery' || nextWorkout.type === 'rest';
              })()}
              onStreakUpdate={handleStreakUpdate}
              userId={currentUserId}
            />

            <div className="sticky top-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900">Recent Activities</h2>
                <span className="text-sm text-gray-500">
                  {displayedActivities.length} / {activities.length}
                </span>
              </div>

              {activities.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="text-gray-400 text-6xl mb-4">🏃</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Activities Found
                  </h3>
                  <p className="text-gray-600">
                    Start tracking your workouts on Strava to see them here!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedActivities.map((activity: StravaActivity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      onClick={() => handleActivityClick(activity)}
                    />
                  ))}

                  {activities.length > INITIAL_ACTIVITIES_COUNT && (
                    <div className="text-center pt-2">
                      <button
                        onClick={() => setShowAllActivities(!showAllActivities)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm w-full justify-center"
                      >
                        {showAllActivities ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-2" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-2" />
                            Load More
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity Detail Modal */}
        {selectedActivity && (
          <ActivityDetailModal
            activity={selectedActivity}
            similarActivities={getSimilarActivities(selectedActivity)}
            onClose={handleCloseModal}
          />
        )}

        {/* Workout Detail Modal */}
        {selectedWorkout && (
          <WorkoutDetailModal
            workout={selectedWorkout}
            onClose={() => setSelectedWorkout(null)}
          />
        )}

        {/* Intake Wizard Modal */}
        {showWizard && !checkingOnboarding && (
          <IntakeWizard onComplete={handleWizardComplete} />
        )}
      </div>
    </div>
  );
};