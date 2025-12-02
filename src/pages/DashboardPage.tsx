import React, { useState, useEffect } from 'react';
import { stravaApi } from '../services/stravaApi';
import { stravaCacheService } from '../services/stravaCacheService';
import { ouraApi } from '../services/ouraApi';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ActivityCard } from '../components/dashboard/ActivityCard';
import { ActivityDetailModal } from '../components/dashboard/ActivityDetailModal';
import { StatsSummary } from '../components/dashboard/StatsSummary';
import { TrainingTrendsChart } from '../components/dashboard/TrainingTrendsChart';
import { RecoveryCard } from '../components/dashboard/RecoveryCard';
import { WeeklyInsightCard } from '../components/dashboard/WeeklyInsightCard';
import { HealthSpiderChart } from '../components/dashboard/HealthSpiderChart';
import { StravaOnlySpiderChart } from '../components/dashboard/StravaOnlySpiderChart';
import { weeklyInsightService } from '../services/weeklyInsightService';
import { healthMetricsService } from '../services/healthMetricsService';
import type { StravaActivity, StravaAthlete, WeeklyStats, OuraSleepData, OuraReadinessData } from '../types';
import type { WeeklyInsight, HealthMetrics } from '../services/weeklyInsightService';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { MessageCircle, TrendingUp, ChevronDown, ChevronUp, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../utils/constants';

export const DashboardPage: React.FC = () => {
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [displayedActivities, setDisplayedActivities] = useState<StravaActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [sleepData, setSleepData] = useState<OuraSleepData | null>(null);
  const [readinessData, setReadinessData] = useState<OuraReadinessData | null>(null);
  const [weeklyInsight, setWeeklyInsight] = useState<WeeklyInsight | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ouraLoading, setOuraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);

  // Collapsible widget states
  const [weeklyInsightCollapsed, setWeeklyInsightCollapsed] = useState(false);
  const [healthOverviewCollapsed, setHealthOverviewCollapsed] = useState(false);

  // View mode toggle
  const [viewMode, setViewMode] = useState<'auto' | 'full' | 'strava'>('auto');

  const INITIAL_ACTIVITIES_COUNT = 9;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch athlete data and recent activities from cache
        const [athleteData, activitiesData] = await Promise.all([
          stravaCacheService.getAthlete(),
          stravaCacheService.getActivities(false, 20)
        ]);

        setAthlete(athleteData);
        setActivities(activitiesData);
        setDisplayedActivities(activitiesData.slice(0, INITIAL_ACTIVITIES_COUNT));

        // Calculate weekly stats
        const stats = calculateWeeklyStats(activitiesData);
        setWeeklyStats(stats);

        // Fetch Oura data if authenticated
        if (ouraApi.isAuthenticated()) {
          console.log('Oura is authenticated, fetching recovery data...');
          setOuraLoading(true);
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
          } catch (ouraError) {
            console.error('Failed to fetch Oura data:', ouraError);
            console.error('Oura error details:', {
              message: ouraError.message,
              stack: ouraError.stack
            });
          } finally {
            setOuraLoading(false);
          }
        } else {
          console.log('Oura is not authenticated, skipping recovery data fetch');
        }
        
        // Generate weekly insight
        await generateWeeklyInsight(athleteData, activitiesData);
        
        // Generate health metrics
        await generateHealthMetrics(athleteData, activitiesData);

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
  }, []);

  useEffect(() => {
    if (showAllActivities) {
      setDisplayedActivities(activities);
    } else {
      setDisplayedActivities(activities.slice(0, INITIAL_ACTIVITIES_COUNT));
    }
  }, [showAllActivities, activities]);

  const generateWeeklyInsight = async (athleteData: StravaAthlete, activitiesData: StravaActivity[]) => {
    try {
      setInsightLoading(true);
      console.log('Generating weekly insight...');
      
      // Get Oura data for insight generation
      let sleepDataForInsight: OuraSleepData[] = [];
      let readinessDataForInsight: OuraReadinessData[] = [];
      
      if (ouraApi.isAuthenticated()) {
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
        readinessDataForInsight
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
      setHealthLoading(true);
      console.log('Generating health metrics...');
      
      // Get Oura data for health metrics
      let sleepDataForHealth: OuraSleepData[] = [];
      let readinessDataForHealth: OuraReadinessData[] = [];
      
      if (ouraApi.isAuthenticated()) {
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
    } finally {
      setHealthLoading(false);
    }
  };

  const handleRefreshInsight = async () => {
    if (!athlete || !activities.length) return;

    // Clear cache and regenerate
    weeklyInsightService.clearCache();
    await generateWeeklyInsight(athlete, activities);
  };

  const hasOuraData = (): boolean => {
    return (sleepData !== null && sleepData !== undefined) ||
           (readinessData !== null && readinessData !== undefined);
  };

  const getEffectiveViewMode = (): 'full' | 'strava' => {
    if (viewMode === 'strava') return 'strava';
    if (viewMode === 'full') return 'full';

    return hasOuraData() ? 'full' : 'strava';
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {athlete?.firstname}! 👋
          </h1>
          <p className="text-gray-600">
            Here's your training overview and recent activities
          </p>
        </div>

        {/* Weekly Stats */}
        {/* Weekly Insight */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={() => setWeeklyInsightCollapsed(!weeklyInsightCollapsed)}
              className="w-full flex items-center justify-between text-left hover:bg-gray-50 -m-4 p-4 rounded-t-lg transition-colors"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Weekly Insight</h2>
                <p className="text-sm text-gray-600">AI-generated training insights based on your data</p>
              </div>
              {weeklyInsightCollapsed ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
          
          {!weeklyInsightCollapsed && (
            <div className="p-6 pt-0">
              <WeeklyInsightCard 
                insight={weeklyInsight}
                loading={insightLoading}
                onRefresh={handleRefreshInsight}
              />
            </div>
          )}
        </div>

        {/* Health Overview */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setHealthOverviewCollapsed(!healthOverviewCollapsed)}
                className="flex-1 flex items-center justify-between text-left hover:bg-gray-50 -m-4 p-4 rounded-t-lg transition-colors"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Health Overview</h2>
                  <p className="text-sm text-gray-600">
                    {getEffectiveViewMode() === 'strava'
                      ? 'Training performance based on Strava data'
                      : 'Holistic view of your fitness and recovery metrics'}
                  </p>
                </div>
                {healthOverviewCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {!healthOverviewCollapsed && (
                <div className="ml-4 flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('auto')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'auto'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setViewMode('full')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'full'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    disabled={!hasOuraData()}
                  >
                    Full
                  </button>
                  <button
                    onClick={() => setViewMode('strava')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      viewMode === 'strava'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Training
                  </button>
                </div>
              )}
            </div>
          </div>

          {!healthOverviewCollapsed && (
            <div className="p-6 pt-0">
              {getEffectiveViewMode() === 'strava' ? (
                athlete && (
                  <StravaOnlySpiderChart
                    athlete={athlete}
                    activities={activities}
                    loading={healthLoading}
                  />
                )
              ) : (
                <HealthSpiderChart
                  healthMetrics={healthMetrics}
                  loading={healthLoading}
                />
              )}
            </div>
          )}
        </div>

        {weeklyStats && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">This Week</h2>
            <StatsSummary weeklyStats={weeklyStats} />
          </div>
        )}

        {/* Recovery Data */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recovery & Sleep</h2>
          <RecoveryCard 
            sleepData={sleepData} 
            readinessData={readinessData} 
            loading={ouraLoading}
          />
        </div>

        {/* Training Trends Chart */}
        {activities.length > 0 && (
          <div className="mb-8">
            <TrainingTrendsChart activities={activities} />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link
            to={ROUTES.CHAT}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-blue-50 p-3 rounded-full">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Chat with AI Coach
                </h3>
                <p className="text-gray-600 text-sm">
                  Get personalized training advice based on your data
                </p>
              </div>
            </div>
          </Link>

          <Link
            to={ROUTES.PLANS}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center space-x-4">
              <div className="bg-green-50 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                  Generate Training Plan
                </h3>
                <p className="text-gray-600 text-sm">
                  Create a personalized plan for your goals
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Activities */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Activities</h2>
            <span className="text-sm text-gray-500">
              Showing {displayedActivities.length} of {activities.length} activities
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
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedActivities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onClick={() => handleActivityClick(activity)}
                  />
                ))}
              </div>

              {activities.length > INITIAL_ACTIVITIES_COUNT && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setShowAllActivities(!showAllActivities)}
                    className="inline-flex items-center px-6 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
                  >
                    {showAllActivities ? (
                      <>
                        <ChevronUp className="w-5 h-5 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-5 h-5 mr-2" />
                        Load More ({activities.length - INITIAL_ACTIVITIES_COUNT} more)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Activity Detail Modal */}
        {selectedActivity && (
          <ActivityDetailModal
            activity={selectedActivity}
            similarActivities={getSimilarActivities(selectedActivity)}
            onClose={handleCloseModal}
          />
        )}
      </div>
    </div>
  );
};