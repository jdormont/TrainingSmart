import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardData } from '../hooks/useDashboardData';

import { weeklyInsightService } from '../services/weeklyInsightService';
import {
  StravaActivity,
  Workout
} from '../types';
import {
  Activity as ActivityIcon,
  Calendar,
  MessageCircle,
  Eye,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import { trainingPlansService } from '../services/trainingPlansService'; // Import service
import { SmartWorkoutPickerModal } from '../components/plans/SmartWorkoutPickerModal'; // Import Modal

import { DashboardHero } from '../components/dashboard/DashboardHero';
import { AnalyticsContainer } from '../components/dashboard/AnalyticsContainer';
import { ActivityCard } from '../components/dashboard/ActivityCard';
import { WorkoutDetailModal } from '../components/dashboard/WorkoutDetailModal';
import { ActivityDetailModal } from '../components/dashboard/ActivityDetailModal';
import { IntakeWizard } from '../components/onboarding/IntakeWizard'; // Import IntakeWizard
import { getUserOnboardingStatus } from '../services/onboardingService';
import { useAuth } from '../contexts/AuthContext';
import type { CoachSpecialization, FitnessMode } from '../types';
import { SmartWorkoutPreview } from '../components/dashboard/SmartWorkoutPreview';
import { TodaysFocusCard } from '../components/dashboard/TodaysFocusCard';
import { ConsistencyHeatmap } from '../components/dashboard/ConsistencyHeatmap';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton';
import { ROUTES } from '../utils/constants';
import { analytics } from '../lib/analytics';
import { Button } from '../components/common/Button';
import { StreakWidget } from '../components/dashboard/StreakWidget';
// import { StreakCelebration } from '../components/dashboard/StreakCelebration';
import { LevelUpModal } from '../components/common/LevelUpModal';
import { milestoneService } from '../services/milestoneService';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';
import { WorkoutAdjustmentChips } from '../components/dashboard/WorkoutAdjustmentChips';



const COACH_BADGE: Record<CoachSpecialization, { label: string; emoji: string }> = {
  endurance:         { label: 'Endurance Coach',          emoji: '🚴' },
  strength_mobility: { label: 'Strength & Mobility Coach', emoji: '💪' },
  general_fitness:   { label: 'General Fitness Coach',    emoji: '⚡' },
  comeback:          { label: 'Comeback Coach',           emoji: '🌱' },
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  const fitnessMode = (userProfile?.fitness_mode ?? 'performance') as FitnessMode;
  const coachSpecialization = userProfile?.coach_specialization as CoachSpecialization | undefined;
  const isReEngager = fitnessMode === 're_engager';

  // State defined by hook
  const {
    data,
    isLoading: loading,
    error: queryError
  } = useDashboardData();

  // Local UI state
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  // const [displayedActivities, setDisplayedActivities] = useState<StravaActivity[]>([]); // Removed state
  const [showWizard, setShowWizard] = useState(false);
  const [insightLoading, setInsightLoading] = useState(false);

  // Smart Picker State for Dashboard
  const [showSmartPicker, setShowSmartPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);

  // Level Up milestone state
  const [levelUpStatus, setLevelUpStatus] = useState<ReturnType<typeof milestoneService.checkLevelUp> | null>(null);

  const handleOpenPicker = () => {
      setPickerDate(new Date()); // Today
      setShowSmartPicker(true);
  };

  const handleSmartWorkoutSelect = async (workout: Partial<Workout>) => {
      try {
          // 1. Ensure we have a plan to add to
          const targetPlanId = await trainingPlansService.ensureActivePlan(currentUserId);
          
          // 2. Add workout
          await trainingPlansService.addWorkoutToPlan(targetPlanId, {
              ...workout,
              scheduled_date: new Date().toISOString().split('T')[0] // Always today for dashboard logic
          });

          // 3. Refresh
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
          
      } catch (err) {
          console.error("Failed to add dashboard workout", err);
      }
  };

  // Destructure data with defaults and null handling
  const {
    athlete = null,
    activities = [],
    weeklyStats = null,
    sleepData = null,
    readinessData = null,
    dailyMetric = null,
    dailyMetrics = [],
    weeklyInsight = null,
    healthMetrics = null,
    nextWorkout = null,
    userStreak = null,
    isStravaConnected = false,
    isDemoMode = false,
    currentUserId
  } = data || {};

  const error = queryError ? (queryError as Error).message : null;
  const INITIAL_ACTIVITIES_COUNT = 5;

  // Derived displayed activities
  const displayedActivities = React.useMemo(() => {
    if (!activities) return [];
    return showAllActivities ? activities : activities.slice(0, INITIAL_ACTIVITIES_COUNT);
  }, [activities, showAllActivities]);

  // Handle Onboarding Check (Separate side effect)
  const isDemo = searchParams.get('demo') === 'true';
  useEffect(() => {
    const checkOnboarding = async () => {
      if (isDemo || loading) return;

      try {
        const isOnboarded = await getUserOnboardingStatus();
        setShowWizard(!isOnboarded);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }
    };
    checkOnboarding();
  }, [isDemo, loading]);

  function handleWizardComplete() {
    setShowWizard(false);
    window.location.reload();
  }

  // Note: handleEnterDemoMode is no longer needed as it is handled by URL param + Hook

  async function handleRefreshInsight() {
      // Invalidation logic if we want to force re-gen.
      // Ideally we call a mutation or just invalidate the query.
      // But generating insight is expensive/custom.
      // Keeping original logic behavior:
      if (!athlete || !activities.length) return;

      setInsightLoading(true);
      try {
        weeklyInsightService.clearCache();
        // Since hook controls data, we might need to invalidate query to re-fetch
        // But re-generation happens inside the fetch.
        // Simplest: Invalidate 'dashboard-data'.
        // queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        // BUT that fetches EVERYTHING again.
        // For now, let's just leave this as a "TODO: specific mutation" or simple reload.
        // Or implement the specific generation logic here just like before?
        // Actually the previous implementation did setWeeklyInsight(insight) directly.
        // Since we moved state to React Query, we can't set it directly unless we update cache.

        // Let's implement manual re-gen here for now, updating cache optimistically? Too complex.
        // No, cleaner to just re-fetch.
        // weeklyInsightService.clearCache();
        // await queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });

        // Re-implement generation locally to update cache optimistically? Too complex.
        // Let's just follow the pattern:
         weeklyInsightService.clearCache();
         // Force refetch
         // We need queryClient here.
      } catch(e) { console.error(e); }
      finally { setInsightLoading(false); }
  };

  // We need queryClient to invalidate
  const handleRefreshInner = async () => {
      // We can use the service to clear cache then invalidate query
      setInsightLoading(true);
       weeklyInsightService.clearCache();
       await queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
       setInsightLoading(false);
  }

  // Helper to refresh next workout after adjustment
  const refreshNextWorkout = async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
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

  // Streak celebration logic
  // We need to compare previous streak? React Query doesn't easily give "previous" data on refetch unless we track it.
  // The original code did:
  // if (newStreak > userStreak) ...
  // Since we replace state entirely, we might lose the "transition" event unless we useEffect on data.userStreak.

  // Check level-up milestone whenever streak or fitness mode changes
  useEffect(() => {
    if (!isReEngager) return;
    const status = milestoneService.checkLevelUp(userStreak, userProfile?.fitness_mode);
    if (status.eligible) {
      analytics.track('level_up_prompt_shown', {
        weeks_consistent: status.weeksConsistent,
        recent_activities: status.recentActivityCount,
      });
    }
    setLevelUpStatus(status);
  }, [userStreak, userProfile?.fitness_mode, isReEngager]);

  // Visibility handling for refetch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
         queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);


  if (loading) {
    return <DashboardSkeleton />;
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
              type="button"
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

  if (!loading && !isStravaConnected && !isDemoMode) {
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
                    <Sparkles className="w-12 h-12 text-orange-500" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Initialize Your AI Coach
                </h3>
                <p className="text-gray-600 mb-6">
                  Connect your Strava account to unlock AI analysis, training plans, and performance trends.
                </p>
                <div className="space-y-3">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate(ROUTES.SETTINGS)}
                    className="w-full"
                  >
                    <ActivityIcon className="w-5 h-5 mr-2" />
                    Connect Strava
                  </Button>

                  <button
                    type="button"
                    onClick={() => navigate(`?demo=true`)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Demo Dashboard
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-4">
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
        {showWizard && (
          <IntakeWizard onComplete={handleWizardComplete} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {isDemoMode && (
        <div className="sticky top-0 z-50 bg-blue-600 text-white py-3 px-4 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-yellow-300" />
              <span className="font-medium">You are viewing sample data. Connect Strava for real insights.</span>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.SETTINGS)}
              className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
            >
              Connect Strava
            </button>
          </div>
        </div>
      )}
      <NetworkErrorBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Coach specialization badge */}
        {coachSpecialization && COACH_BADGE[coachSpecialization] && (
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
              <span>{COACH_BADGE[coachSpecialization].emoji}</span>
              {COACH_BADGE[coachSpecialization].label}
            </span>
          </div>
        )}

        {/* ── RE-ENGAGER LAYOUT ── */}
        {isReEngager ? (
          <>
          {/* Level Up Modal */}
          {levelUpStatus?.eligible && (
            <LevelUpModal
              weeksConsistent={levelUpStatus.weeksConsistent}
              recentActivityCount={levelUpStatus.recentActivityCount}
              onClose={() => setLevelUpStatus(prev => prev ? { ...prev, eligible: false } : null)}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Today's workout */}
              {nextWorkout && (
                <SmartWorkoutPreview
                  nextWorkout={nextWorkout}
                  dailyMetrics={dailyMetric}
                  onWorkoutGenerated={() => refreshNextWorkout()}
                  onViewDetails={setSelectedWorkout}
                  onOpenPicker={handleOpenPicker}
                />
              )}
              <TodaysFocusCard 
                dailyMetric={dailyMetric}
                coachSpecialization={coachSpecialization}
                isDemoMode={isDemoMode}
                nextWorkout={nextWorkout}
                onOpenPicker={handleOpenPicker}
              />
              {nextWorkout && (
                <WorkoutAdjustmentChips
                  workout={nextWorkout}
                  onWorkoutUpdated={refreshNextWorkout}
                />
              )}

              {/* Consistency Heatmap */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <ConsistencyHeatmap 
                  isDemoMode={isDemoMode}
                  streak={userStreak}
                  isRestDay={(() => {
                    if (!nextWorkout) return true;
                    const todayStr = new Date().toLocaleDateString('en-CA');
                    const workoutDateStr = nextWorkout.scheduledDate.toISOString().split('T')[0];
                    if (workoutDateStr !== todayStr) return true;
                    return nextWorkout.intensity === 'recovery' || nextWorkout.type === 'rest';
                  })()}
                  onStreakUpdate={() => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })}
                  userId={currentUserId || 'demo'}
                />
              </div>
            </div>

            {/* Right rail — recent activities only */}
            <div className="lg:col-span-1 space-y-4">
              <div className="sticky top-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-200">Recent Activities</h2>
                  <span className="text-sm text-slate-500">{displayedActivities.length} / {activities.length}</span>
                </div>
                {activities.length === 0 ? (
                  <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 text-center">
                    <div className="text-4xl mb-3">🏃</div>
                    <p className="text-slate-400 text-sm">No activities yet — log your first session!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {displayedActivities.map((activity: StravaActivity) => (
                      <ActivityCard key={activity.id} activity={activity} onClick={() => handleActivityClick(activity)} />
                    ))}
                    {activities.length > INITIAL_ACTIVITIES_COUNT && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivities(!showAllActivities)}
                        className="w-full flex items-center justify-center px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-400 hover:border-slate-500 transition-colors"
                      >
                        {showAllActivities ? <><ChevronUp className="w-4 h-4 mr-2" />Show Less</> : <><ChevronDown className="w-4 h-4 mr-2" />Show All ({activities.length})</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (

        /* ── PERFORMANCE LAYOUT (existing) ── */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage (Left/Top) */}
          <div className="lg:col-span-2 space-y-6">
              <div className="lg:hidden mb-6">
                {nextWorkout && (
                  <SmartWorkoutPreview
                    nextWorkout={nextWorkout}
                    dailyMetrics={dailyMetric}
                    onWorkoutGenerated={(workout) => {
                      refreshNextWorkout();
                    }}
                    onViewDetails={setSelectedWorkout}
                    onOpenPicker={handleOpenPicker}
                  />
                )}
                <TodaysFocusCard 
                  dailyMetric={dailyMetric}
                  coachSpecialization={coachSpecialization}
                  isDemoMode={isDemoMode}
                  nextWorkout={nextWorkout}
                  onOpenPicker={handleOpenPicker}
                />
                {nextWorkout && (
                  <WorkoutAdjustmentChips
                    workout={nextWorkout}
                    onWorkoutUpdated={refreshNextWorkout}
                  />
                )}
              </div>
              <DashboardHero
                athlete={athlete}
                weeklyInsight={weeklyInsight}
                weeklyStats={weeklyStats}
                onRefreshInsight={handleRefreshInner}
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
              {nextWorkout && (
                <SmartWorkoutPreview
                  nextWorkout={nextWorkout}
                  dailyMetrics={dailyMetric}
                  onWorkoutGenerated={(workout) => {
                    refreshNextWorkout();
                  }}
                  onViewDetails={setSelectedWorkout}
                  onOpenPicker={handleOpenPicker}
                />
              )}
              <TodaysFocusCard 
                dailyMetric={dailyMetric}
                coachSpecialization={coachSpecialization}
                isDemoMode={isDemoMode}
                nextWorkout={nextWorkout}
                onOpenPicker={handleOpenPicker}
              />
              {nextWorkout && (
                <WorkoutAdjustmentChips
                  workout={nextWorkout}
                  onWorkoutUpdated={refreshNextWorkout}
                />
              )}
            </div>

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
                        type="button"
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
                            Show All ({activities.length})
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
        )} {/* end isReEngager ternary */}

        {/* Activity Detail Modal */}
        {selectedActivity && (
          <ActivityDetailModal
            activity={selectedActivity}
            similarActivities={getSimilarActivities(selectedActivity)}
            onClose={handleCloseModal}
          />
        )}

        {selectedWorkout && (
          <WorkoutDetailModal
            workout={selectedWorkout}
            onClose={() => {
              setSelectedWorkout(null);
              // Refresh data on close as a safe fallback for now
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
            }}
          />
        )}

        {/* Intake Wizard Modal */}
        {showWizard && (
          <IntakeWizard onComplete={handleWizardComplete} />
        )}

        {/* Smart Picker Modal */}
        {pickerDate && (
           <SmartWorkoutPickerModal
             isOpen={showSmartPicker}
             onClose={() => {
                 setShowSmartPicker(false);
                 setPickerDate(null);
             }}
             date={pickerDate}
             onSelectWorkout={handleSmartWorkoutSelect}
             // Use dashboard data or defaults
             recoveryScore={readinessData ? readinessData.score : (dailyMetric?.recovery_score ?? 75)} 
             acuteLoadRatio={healthMetrics?.details.load.components.find(c => c.name === 'A:C Ratio')?.value ? parseFloat(healthMetrics.details.load.components.find(c => c.name === 'A:C Ratio')?.value as string) : 1.1}
             // Actually, healthMetrics is available from data!
             // healthMetrics.details.load.components ... but parsing that is messy here.
             // Let's rely on healthMetrics hook data if available, or just defaults.
             // Given healthMetrics object structure:
             // We can try to parse if needed, but for now defaults or simple prop drilling.
             // Ideally we pass explicit ratio.
           />
        )}
      </div>
    </div>
  );
};