import React, { useState, useEffect } from 'react';
import { Calendar, Target, Clock, MapPin, Plus, Trash2, List, CalendarDays, MessageCircle } from 'lucide-react';

import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { stravaCacheService } from '../services/stravaCacheService';
import { openaiService } from '../services/openaiApi';
import { trainingPlansService } from '../services/trainingPlansService';
import type { StravaActivity, StravaAthlete, TrainingPlan, Workout, WeeklyStats } from '../types';
import { calculateWeeklyStats } from '../utils/dataProcessing';
import { formatDistance, formatDuration } from '../utils/formatters';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';
import { StatsSummary } from '../components/dashboard/StatsSummary';
import WorkoutCard from '../components/plans/WorkoutCard';
import WeeklyPlanView from '../components/plans/WeeklyPlanView';
import PlanModificationModal from '../components/plans/PlanModificationModal';
import { addDays } from 'date-fns';
import { ouraApi } from '../services/ouraApi';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';

export const PlansPage: React.FC = () => {
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [savedPlans, setSavedPlans] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [modificationModal, setModificationModal] = useState<{
    isOpen: boolean;
    planId: string | null;
    weekNumber: number;
    workouts: Workout[];
  }>({ isOpen: false, planId: null, weekNumber: 0, workouts: [] });

  // Form state
  const [goal, setGoal] = useState('');
  const [goalType, setGoalType] = useState<'distance' | 'event' | 'fitness'>('event');
  const [timeframe, setTimeframe] = useState('12 weeks');
  const [weeklyHours, setWeeklyHours] = useState('6-8 hours');
  const [preferences, setPreferences] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [athleteData, activitiesData] = await Promise.all([
          stravaCacheService.getAthlete(),
          stravaCacheService.getActivities(false, 50) // More activities for better context
        ]);

        setAthlete(athleteData);
        setActivities(activitiesData);

        // Calculate weekly stats
        const stats = calculateWeeklyStats(activitiesData);
        setWeeklyStats(stats);

        // Load saved plans from Supabase
        const plans = await trainingPlansService.getPlans();
        setSavedPlans(plans);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load your training data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athlete || !goal.trim()) return;

    setGenerating(true);
    setError(null);

    try {
      const weeklyStats = calculateWeeklyStats(activities);
      const cyclingActivities = activities.filter((a: StravaActivity) => a.type === 'Ride');

      const trainingContext = {
        athlete,
        recentActivities: cyclingActivities,
        stats: {} as any,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        }
      };

      const planDescription = `
Goal: ${goal}
Type: ${goalType}
Timeframe: ${timeframe}
Weekly Time Available: ${weeklyHours}
Focus Areas: ${focusAreas.join(', ') || 'General fitness'}
Additional Preferences: ${preferences || 'None'}
      `.trim();

      const { description, workouts: aiWorkouts } = await openaiService.generateTrainingPlan(
        trainingContext,
        goal,
        timeframe,
        planDescription
      );

      const planStartDate = new Date();
      const weeks = parseInt(timeframe.split(' ')[0]);
      const planEndDate = addDays(planStartDate, weeks * 7);

      const structuredWorkouts: Omit<Workout, 'id'>[] = aiWorkouts.map((w: any, index: number) => {
        const weekNumber = Math.floor(index / 7);
        const dayInWeek = w.dayOfWeek ?? (index % 7);
        const workoutDate = addDays(planStartDate, weekNumber * 7 + dayInWeek);

        return {
          name: w.name || 'Workout',
          type: w.type || 'bike',
          description: w.description || '',
          duration: w.duration || 60,
          distance: w.distance ? w.distance * 1609.34 : undefined,
          intensity: w.intensity || 'moderate',
          scheduledDate: workoutDate,
          completed: false
        };
      });

      const planToCreate = {
        name: goal,
        description: description,
        startDate: planStartDate,
        endDate: planEndDate,
        goal: planDescription,
        workouts: structuredWorkouts as Workout[]
      };

      const newPlan = await trainingPlansService.createPlan(planToCreate);
      const updatedPlans = [...savedPlans, newPlan];
      setSavedPlans(updatedPlans);

      setShowForm(false);
      // Reset form
      setGoal('');
      setPreferences('');
      setFocusAreas([]);
    } catch (err) {
      console.error('Failed to generate plan:', err);
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      await trainingPlansService.deletePlan(planId);
      const updatedPlans = savedPlans.filter(p => p.id !== planId);
      setSavedPlans(updatedPlans);

      // Close expanded plan if it's being deleted
      if (expandedPlan === planId) {
        setExpandedPlan(null);
      }
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setError('Failed to delete plan');
    }
  };

  const togglePlan = (planId: string) => {
    setExpandedPlan(expandedPlan === planId ? null : planId);
  };

  const handleToggleWorkoutComplete = async (workoutId: string) => {
    const plan = savedPlans.find((p: TrainingPlan) => p.workouts.some((w: Workout) => w.id === workoutId));
    if (!plan) return;

    const workout = plan.workouts.find((w: Workout) => w.id === workoutId);
    if (!workout) return;

    const newCompletedState = !workout.completed;

    setSavedPlans((prevPlans: TrainingPlan[]) =>
      prevPlans.map((p: TrainingPlan) =>
        p.id === plan.id
          ? {
            ...p,
            workouts: p.workouts.map((w: Workout) =>
              w.id === workoutId ? { ...w, completed: newCompletedState } : w
            )
          }
          : p
      )
    );

    try {
      await trainingPlansService.updateWorkoutCompletion(workoutId, newCompletedState);
    } catch (err) {
      console.error('Failed to update workout:', err);
      setSavedPlans((prevPlans: TrainingPlan[]) =>
        prevPlans.map((p: TrainingPlan) =>
          p.id === plan.id
            ? {
              ...p,
              workouts: p.workouts.map((w: Workout) =>
                w.id === workoutId ? { ...w, completed: !newCompletedState } : w
              )
            }
            : p
        )
      );
    }
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev: string[]) =>
      prev.includes(area)
        ? prev.filter((a: string) => a !== area)
        : [...prev, area]
    );
  };

  const handleWorkoutsExported = async () => {
    try {
      const plans = await trainingPlansService.getPlans();
      setSavedPlans(plans);
    } catch (err) {
      console.error('Failed to refresh plans:', err);
    }
  };

  const handleOpenModifyWeek = (planId: string, weekNumber: number, weekWorkouts: Workout[]) => {
    setModificationModal({
      isOpen: true,
      planId,
      weekNumber,
      workouts: weekWorkouts,
    });
  };

  const handleCloseModifyWeek = () => {
    setModificationModal({
      isOpen: false,
      planId: null,
      weekNumber: 0,
      workouts: [],
    });
  };

  const handleApplyModification = async (modificationRequest: string) => {
    if (!modificationModal.planId || !athlete) return;

    const plan = savedPlans.find((p: TrainingPlan) => p.id === modificationModal.planId);
    if (!plan) return;

    try {
      const weeklyStats = calculateWeeklyStats(activities);
      const cyclingActivities = activities.filter((a: StravaActivity) => a.type === 'Ride');

      const sleepData = await ouraApi.getRecentSleepData().catch(() => null);
      const readinessData = await ouraApi.getRecentReadinessData().catch(() => null);

      const trainingContext = {
        athlete,
        recentActivities: cyclingActivities,
        stats: {} as any,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: sleepData || readinessData ? {
          sleepData,
          readinessData
        } : undefined
      };

      const workoutsToModify = modificationModal.workouts.map((w: Workout) => ({
        name: w.name,
        type: w.type,
        description: w.description,
        duration: w.duration,
        distance: w.distance ? w.distance / 1609.34 : undefined,
        intensity: w.intensity,
        dayOfWeek: new Date(w.scheduledDate).getDay(),
      }));

      const modifiedWorkouts = await openaiService.modifyWeeklyPlan(
        workoutsToModify,
        modificationRequest,
        trainingContext,
        modificationModal.weekNumber
      );

      const workoutIdsToUpdate = modificationModal.workouts.map((w: Workout) => w.id);
      const updatedWorkoutsWithDates = modifiedWorkouts.map((w: any, index: number) => {
        const originalWorkout = modificationModal.workouts[index];
        const weekStart = new Date(modificationModal.workouts[0].scheduledDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const dayInWeek = w.dayOfWeek ?? (index % 7);
        const workoutDate = addDays(weekStart, dayInWeek);

        return {
          id: originalWorkout?.id || `temp-${index}`,
          name: w.name || 'Workout',
          type: w.type || 'bike',
          description: w.description || '',
          duration: w.duration || 60,
          distance: w.distance ? w.distance * 1609.34 : undefined,
          intensity: w.intensity || 'moderate',
          scheduledDate: workoutDate,
          completed: originalWorkout?.completed || false
        };
      });

      setSavedPlans((prevPlans: TrainingPlan[]) =>
        prevPlans.map((p: TrainingPlan) =>
          p.id === modificationModal.planId
            ? {
              ...p,
              workouts: p.workouts.map((w: Workout) => {
                const updatedWorkout = updatedWorkoutsWithDates.find((uw: Workout) => uw.id === w.id);
                return updatedWorkout || w;
              })
            }
            : p
        )
      );

      for (const workout of updatedWorkoutsWithDates) {
        await trainingPlansService.updateWorkout(
          workout.id,
          workout.name,
          workout.description,
          workout.duration,
          workout.distance,
          workout.intensity,
          workout.scheduledDate
        );
      }

    } catch (err) {
      console.error('Failed to modify plan:', err);
      throw err;
    }
  };

  const focusAreaOptions = [
    'Endurance Base Building',
    'Speed & Power',
    'Hill Climbing',
    'Time Trial Performance',
    'Recovery & Maintenance',
    'Weight Loss',
    'Race Preparation'
  ];

  const goalTypeOptions = [
    { value: 'event', label: 'Specific Event/Race' },
    { value: 'distance', label: 'Distance Goal' },
    { value: 'fitness', label: 'General Fitness' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-orange-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Loading Your Training Data
          </h2>
          <p className="text-gray-600">
            Analyzing your cycling activities...
          </p>
        </div>
      </div>
    );
  }

  const cyclingActivities = activities.filter(a => a.type === 'Ride');

  return (
    <div className="min-h-screen bg-gray-50">
      <NetworkErrorBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Training Plans
            </h1>
            <p className="text-gray-600">
              AI-generated cycling plans based on your Strava data
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </Button>
        </div>

        {/* Current Training Context */}
        {weeklyStats && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">This Week</h2>
            <StatsSummary weeklyStats={weeklyStats} />
          </div>
        )}

        {/* Plan Generation Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Generate New Cycling Plan
            </h3>

            <form onSubmit={handleGeneratePlan} className="space-y-6">
              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Goal Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {goalTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGoalType(option.value as any)}
                      className={`p-3 text-sm rounded-lg border transition-colors ${goalType === option.value
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Goal */}
              <div>
                <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-2">
                  Specific Goal
                </label>
                <input
                  type="text"
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Complete a century ride, Improve FTP by 20 watts, Ride 125mi/week consistently"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Timeframe and Weekly Hours */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="4 weeks">4 weeks</option>
                    <option value="8 weeks">8 weeks</option>
                    <option value="12 weeks">12 weeks</option>
                    <option value="16 weeks">16 weeks</option>
                    <option value="20 weeks">20 weeks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weekly Time Available
                  </label>
                  <select
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="3-4 hours">3-4 hours</option>
                    <option value="5-6 hours">5-6 hours</option>
                    <option value="6-8 hours">6-8 hours</option>
                    <option value="8-10 hours">8-10 hours</option>
                    <option value="10+ hours">10+ hours</option>
                  </select>
                </div>
              </div>

              {/* Focus Areas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Focus Areas (select all that apply)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {focusAreaOptions.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleFocusArea(area)}
                      className={`p-2 text-xs rounded-md border transition-colors text-left ${focusAreas.includes(area)
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Preferences */}
              <div>
                <label htmlFor="preferences" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Preferences
                </label>
                <textarea
                  id="preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g., Prefer indoor training on weekdays, avoid back-to-back hard days, include recovery rides..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex space-x-3">
                <Button
                  type="submit"
                  loading={generating}
                  className="flex items-center space-x-2"
                >
                  <Target className="w-4 h-4" />
                  <span>{generating ? 'Generating...' : 'Generate Plan'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Saved Plans */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Your Training Plans
          </h2>

          {savedPlans.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">🚴</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Training Plans Yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first AI-generated cycling plan based on your Strava data
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Plan</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {savedPlans.map((plan) => {
                const completedWorkouts = plan.workouts.filter(w => w.completed).length;
                const totalWorkouts = plan.workouts.length;
                const completionPercentage = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
                const totalDistance = plan.workouts.reduce((sum, w) => sum + (w.distance || 0), 0);
                const totalHours = plan.workouts.reduce((sum, w) => sum + w.duration, 0) / 60;

                return (
                  <div key={plan.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-gray-900">
                              {plan.name}
                            </h3>
                            {plan.sourceChatSessionId && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <MessageCircle className="w-3 h-3 mr-1" />
                                From Chat
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {plan.startDate.toLocaleDateString()} - {plan.endDate.toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {totalWorkouts} workouts, {totalHours.toFixed(1)}h total
                            </div>
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {(totalDistance / 1609.34).toFixed(1)} mi
                            </div>
                          </div>

                          {totalWorkouts > 0 && (
                            <div>
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-700 font-medium">Progress</span>
                                <span className="text-gray-600">{completedWorkouts} / {totalWorkouts} workouts completed</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                  className="bg-orange-500 h-2.5 rounded-full transition-all"
                                  style={{ width: `${completionPercentage}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => togglePlan(plan.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title={expandedPlan === plan.id ? "Collapse" : "Expand"}
                          >
                            <svg
                              className={`w-5 h-5 transition-transform ${expandedPlan === plan.id ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {expandedPlan === plan.id && (
                        <div className="mt-6 space-y-6">
                          {plan.description && (
                            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                              <h4 className="font-semibold text-gray-900 mb-3">Plan Overview</h4>
                              <div
                                className="prose prose-sm max-w-none text-gray-700"
                                dangerouslySetInnerHTML={{
                                  __html: convertMarkdownToHtml(plan.description)
                                }}
                              />
                            </div>
                          )}

                          {totalWorkouts > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-900">Workouts</h4>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar'
                                      ? 'bg-orange-100 text-orange-600'
                                      : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    title="Calendar view"
                                  >
                                    <CalendarDays className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-colors ${viewMode === 'list'
                                      ? 'bg-orange-100 text-orange-600'
                                      : 'text-gray-400 hover:text-gray-600'
                                      }`}
                                    title="List view"
                                  >
                                    <List className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>

                              {viewMode === 'calendar' ? (
                                <WeeklyPlanView
                                  workouts={plan.workouts}
                                  startDate={plan.startDate}
                                  onToggleComplete={handleToggleWorkoutComplete}
                                  onModifyWeek={(weekNumber, weekWorkouts) => handleOpenModifyWeek(plan.id, weekNumber, weekWorkouts)}
                                  onWorkoutsExported={handleWorkoutsExported}
                                />
                              ) : (
                                <div className="space-y-3">
                                  {plan.workouts
                                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                                    .map(workout => (
                                      <WorkoutCard
                                        key={workout.id}
                                        workout={workout}
                                        onToggleComplete={handleToggleWorkoutComplete}
                                        onWorkoutExported={handleWorkoutsExported}
                                      />
                                    ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <PlanModificationModal
        isOpen={modificationModal.isOpen}
        onClose={handleCloseModifyWeek}
        weekNumber={modificationModal.weekNumber}
        currentWorkouts={modificationModal.workouts}
        onApplyChanges={handleApplyModification}
      />

      <div className="mt-8 mb-4 text-center">
        <p className="text-xs text-gray-400 italic">
          Insights derived in part from Garmin device-sourced data.
        </p>
      </div>
    </div>
  );
};