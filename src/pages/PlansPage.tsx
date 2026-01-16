import React, { useState, useEffect } from 'react';
import { addDays, isSameDay, startOfWeek, format } from 'date-fns';
import { Target, Plus, Trash2, MessageCircle, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

import { Button } from '../components/common/Button';
import { stravaCacheService } from '../services/stravaCacheService';
import { openaiService } from '../services/openaiApi';
import { trainingPlansService } from '../services/trainingPlansService';
import { healthMetricsService } from '../services/healthMetricsService'; // Import healthMetricsService
import type { StravaActivity, StravaAthlete, TrainingPlan, Workout, WeeklyStats } from '../types';
import { calculateWeeklyStats } from '../utils/dataProcessing';

import { convertMarkdownToHtml } from '../utils/markdownToHtml';

import WeeklyPlanView from '../components/plans/WeeklyPlanView';
import PlanModificationModal from '../components/plans/PlanModificationModal';
import { WorkoutDetailModal } from '../components/dashboard/WorkoutDetailModal';
import { SmartWorkoutPickerModal } from '../components/plans/SmartWorkoutPickerModal';
import { CalendarSyncModal } from '../components/plans/CalendarSyncModal';
import { ouraApi } from '../services/ouraApi';
import { NetworkErrorBanner } from '../components/common/NetworkErrorBanner';
import { streakService, UserStreak } from '../services/streakService';
import { supabase } from '../services/supabaseClient';

type AiWorkout = Partial<Workout> & { dayOfWeek?: number; week?: number };

import { useQueryClient, useQuery } from '@tanstack/react-query';
import { usePlanData } from '../hooks/usePlanData';
import { PlansSkeleton } from '../components/skeletons/PlansSkeleton';

export const PlansPage: React.FC = () => {
  const [athlete, setAthlete] = useState<StravaAthlete | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  // Removed local savedPlans state, using usePlanData
  const { data: planData } = usePlanData();
  const savedPlans = planData?.plans || [];
  
  const [loading, setLoading] = useState(true); // Keep for Strava data loading
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  // Smart Picker State
  const [showSmartPicker, setShowSmartPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | null>(null);
  const [pickerTargetPlanId, setPickerTargetPlanId] = useState<string | null>(null);
  
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [modificationModal, setModificationModal] = useState<{
    isOpen: boolean;
    planId: string | null;
    weekNumber: number;
    workouts: Workout[];
  }>({ isOpen: false, planId: null, weekNumber: 0, workouts: [] });
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  const queryClient = useQueryClient();

  // Form state
  // ... (keep existing form state)
  const [goal, setGoal] = useState('');
  const [goalType, setGoalType] = useState<'distance' | 'event' | 'fitness'>('event');
  const [timeframe, setTimeframe] = useState('12 weeks');
  const [weeklyHours, setWeeklyHours] = useState('6-8 hours');
  const [preferences, setPreferences] = useState('');
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const refreshStreak = async (currentActivities?: StravaActivity[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const activitiesToUse = currentActivities || activities;

      // Fetch manual completed workouts
      const { data: manualWorkouts } = await supabase
        .from('workouts')
        .select('scheduled_date')
        .eq('user_id', user.id)
        .eq('completed', true);

      const historyItems = [
        ...activitiesToUse.map(a => ({ date: a.start_date_local, type: 'activity' as const, source: 'strava' as const })),
        ...(manualWorkouts || []).map(w => ({ date: w.scheduled_date, type: 'activity' as const, source: 'manual' as const }))
      ];

      if (historyItems.length > 0) {
        await streakService.syncFromHistory(user.id, historyItems);
      }

      const streakData = await streakService.getStreak(user.id);
      setStreak(streakData);
    } catch (err) {
      console.error('Failed to sync/fetch streak:', err);
    }
  };

  // Removed loadPlans

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

        // Fetch and Sync Streak
        await refreshStreak(activitiesData);
        
        // Plans are loaded via hook

      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load your training data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

    // NEW: Fetch Bio-State Data for Smart Picker
    const { data: bioData } = useQuery({
        queryKey: ['bio-state-data'],
        queryFn: async () => {
             try {
                // simple fetches
                const [readiness, sleep] = await Promise.all([
                     ouraApi.getRecentReadinessData(),
                     ouraApi.getRecentSleepData()
                ]);

                // Calculate Load Ratio from existing activities if possible, 
                // but since 'activities' state might be empty initially, we could re-fetch or depend on state.
                // Better to rely on the service to re-calculate if needed or just use what we have.
                // But useQuery runs independently. Let's just use defaults if calculation is complex here.
                // OR, since we load activities in useEffect, we can use that state if we move this query?
                // Actually, let's just fetch athlete + activities briefly to ensure freshness for the modal
                const freshActivities = await stravaCacheService.getActivities(false, 50);
                const freshAthlete = await stravaCacheService.getAthlete();
                
                let acuteLoadRatio = 1.0;
                if (freshAthlete && freshActivities.length > 0) {
                     const metrics = healthMetricsService.calculateHealthMetrics(freshAthlete, freshActivities);
                     const ratioVal = metrics.details.load.components.find(c => c.name === 'A:C Ratio')?.value;
                     if (ratioVal) acuteLoadRatio = parseFloat(String(ratioVal));
                }

                const currentReadiness = readiness && readiness.length > 0 ? readiness[readiness.length - 1].score : 
                                         null;

                return {
                    recoveryScore: currentReadiness,
                    acuteLoadRatio
                };

             } catch (e) {
                 console.error("Failed to fetch bio data", e);
                 return { recoveryScore: null, acuteLoadRatio: 1.0 };
             }
        },
        enabled: showSmartPicker // Only fetch when modal opens? Or keep fresh. Let's keep fresh but with staleTime.
    });

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
        stats: undefined,
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

      const planStartDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Always start on Monday
      const weeks = parseInt(timeframe.split(' ')[0]);
      const planEndDate = addDays(planStartDate, weeks * 7);

      const structuredWorkouts: Omit<Workout, 'id'>[] = aiWorkouts.map((w: AiWorkout, index: number) => {
        // Use explicit week if available (1-based to 0-based), otherwise fallback to index math
        const weekNumber = w.week ? (w.week - 1) : Math.floor(index / 7);
        const dayInWeek = w.dayOfWeek ?? (index % 7);

        // Calculate date: Start Date (Monday) + (Week # * 7) + (Day #)
        const workoutDate = addDays(planStartDate, weekNumber * 7 + dayInWeek);

        return {
          name: w.name || 'Workout',
          type: w.type || 'bike',
          description: w.description || '',
          duration: w.duration || 60,
          distance: w.distance ? w.distance * 1609.34 : undefined,
          intensity: w.intensity || 'moderate',
          scheduledDate: workoutDate,
          completed: false,
          status: 'planned'
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
      
      await queryClient.cancelQueries({ queryKey: ['plan-data'] });
      queryClient.setQueryData(['plan-data'], (oldData: any) => {
          if (!oldData) return { plans: [newPlan], isAuthenticated: true };
          return {
              ...oldData,
              plans: [...(oldData.plans || []), newPlan]
          };
      });

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
      
      queryClient.setQueryData(['plan-data'], (oldData: any) => {
          if (!oldData) return oldData;
          return {
              ...oldData,
              plans: oldData.plans.filter((p: TrainingPlan) => p.id !== planId)
          };
      });

      // Close expanded plan if it's being deleted
      if (expandedPlan === planId) {
        setExpandedPlan(null);
      }
    } catch (err) {
      console.error('Failed to delete plan:', err);
      setError('Failed to delete plan');
      // Invalidate on error to ensure sync
      queryClient.invalidateQueries({ queryKey: ['plan-data'] });
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

    // Toggle logic: if completed, go to 'planned', else 'completed'
    const newStatus = workout.status === 'completed' || workout.completed ? 'planned' : 'completed';

    await handleUpdateStatus(workoutId, newStatus);
  };

  const handleUpdateStatus = async (workoutId: string, newStatus: 'planned' | 'completed' | 'skipped') => {
    const plan = savedPlans.find((p: TrainingPlan) => p.workouts.some((w: Workout) => w.id === workoutId));
    if (!plan) return;

    // Optimistic update
    const previousData = queryClient.getQueryData(['plan-data']);
    
    queryClient.setQueryData(['plan-data'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
            ...oldData,
            plans: oldData.plans.map((p: TrainingPlan) =>
                p.id === plan.id
                  ? {
                    ...p,
                    workouts: p.workouts.map((w: Workout) =>
                      w.id === workoutId ? { ...w, status: newStatus, completed: newStatus === 'completed' } : w
                    )
                  }
                  : p
            )
        };
    });

    try {
      await trainingPlansService.updateWorkoutStatus(workoutId, newStatus);
      // Refresh streak after status update
      await refreshStreak();
    } catch (err) {
      console.error('Failed to update workout status:', err);
      // Revert on failure
      queryClient.setQueryData(['plan-data'], previousData);
      setError('Failed to update workout status');
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout? This cannot be undone.')) return;

    const plan = savedPlans.find((p: TrainingPlan) => p.workouts.some((w: Workout) => w.id === workoutId));
    if (!plan) return;

    // Optimistic update
    const previousData = queryClient.getQueryData(['plan-data']);

    queryClient.setQueryData(['plan-data'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
            ...oldData,
            plans: oldData.plans.map((p: TrainingPlan) =>
                p.id === plan.id
                  ? {
                    ...p,
                    workouts: p.workouts.filter((w: Workout) => w.id !== workoutId)
                  }
                  : p
            )
        };
    });

    try {
      await trainingPlansService.deleteWorkout(workoutId);
    } catch (err) {
      console.error('Failed to delete workout:', err);
      // Revert
      queryClient.setQueryData(['plan-data'], previousData);
      setError('Failed to delete workout');
    }
  };

  // New: Smart Handler Trigger
  const handleAddWorkoutClick = (planId: string, date: Date) => {
    setPickerTargetPlanId(planId);
    setPickerDate(date);
    setShowSmartPicker(true);
  };

  // New: Smart Handler Action
  const handleSmartWorkoutSelect = async (workout: Partial<Workout>) => {
    if (!pickerTargetPlanId || !pickerDate) return;

    try {
      await trainingPlansService.addWorkoutToPlan(pickerTargetPlanId, {
        ...workout,
        scheduled_date: pickerDate.toISOString().split('T')[0]
      });

      // Invalidate to refresh the view
      queryClient.invalidateQueries({ queryKey: ['plan-data'] });
    } catch (err) {
      console.error('Failed to add smart workout', err);
      setError('Failed to add workout');
    }
  };

  const handleAddWorkout = async (planId: string, date: Date) => {
    // Redirect to smart picker logic for now, or keep as fallback
    handleAddWorkoutClick(planId, date); 
  };

  const toggleFocusArea = (area: string) => {
    setFocusAreas((prev: string[]) =>
      prev.includes(area)
        ? prev.filter((a: string) => a !== area)
        : [...prev, area]
    );
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

      // Fetch arrays first
      const sleepHistory = await ouraApi.getRecentSleepData().catch(() => null);
      const readinessHistory = await ouraApi.getRecentReadinessData().catch(() => null);

      // Extract latest single object or null
      const latestSleep = sleepHistory && sleepHistory.length > 0
        ? sleepHistory[sleepHistory.length - 1]
        : null;
      const latestReadiness = readinessHistory && readinessHistory.length > 0
        ? readinessHistory[readinessHistory.length - 1]
        : null;

      const trainingContext = {
        athlete,
        recentActivities: cyclingActivities,
        stats: undefined,
        weeklyVolume: {
          distance: weeklyStats.totalDistance,
          time: weeklyStats.totalTime,
          activities: weeklyStats.activityCount
        },
        recovery: latestSleep || latestReadiness ? {
          sleepData: latestSleep,
          readinessData: latestReadiness
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


      const updatedWorkoutsWithDates = modifiedWorkouts.map((w: AiWorkout, index: number) => {
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
          completed: originalWorkout?.completed || false,
          status: originalWorkout?.status || 'planned'
        };
      });

      
      queryClient.setQueryData(['plan-data'], (oldData: any) => {
          if (!oldData) return oldData;
          return {
              ...oldData,
              plans: oldData.plans.map((p: TrainingPlan) =>
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
          };
      });

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

  const handleMoveWorkout = async (workoutId: string, newDate: Date, strategy: 'move' | 'swap' | 'replace') => {
    // Optimistic UI update
    const previousData = queryClient.getQueryData(['plan-data']);

    queryClient.setQueryData(['plan-data'], (oldData: any) => {
        if (!oldData) return oldData;
        const prevPlans = oldData.plans;
        
        return {
            ...oldData,
            plans: prevPlans.map((plan: TrainingPlan) => {
              const planWorkouts = plan.workouts;
              const originalWorkout = planWorkouts.find((w: Workout) => w.id === workoutId);
              if (!originalWorkout) return plan;
        
              let updatedWorkouts: Workout[] = [...planWorkouts];
              const originalDate = new Date(originalWorkout.scheduledDate);
        
              // Strategy implementations
              if (strategy === 'move') {
                updatedWorkouts = updatedWorkouts.map(w =>
                  w.id === workoutId
                    ? { ...w, scheduledDate: newDate }
                    : w
                );
              } else if (strategy === 'swap') {
                const targetWorkout = updatedWorkouts.find(w =>
                  isSameDay(new Date(w.scheduledDate), newDate)
                );
        
                if (targetWorkout) {
                  updatedWorkouts = updatedWorkouts.map(w => {
                    if (w.id === workoutId) return { ...w, scheduledDate: newDate };
                    if (w.id === targetWorkout.id) return { ...w, scheduledDate: originalDate };
                    return w;
                  });
                }
              } else if (strategy === 'replace') {
                const targetWorkout = updatedWorkouts.find(w =>
                  isSameDay(new Date(w.scheduledDate), newDate)
                );
        
                if (targetWorkout) {
                  updatedWorkouts = updatedWorkouts.filter(w => w.id !== targetWorkout.id);
                  updatedWorkouts = updatedWorkouts.map(w =>
                    w.id === workoutId
                      ? { ...w, scheduledDate: newDate }
                      : w
                  );
                }
              }
        
              return { ...plan, workouts: updatedWorkouts };
            })
        };
    });

    try {
      const plan = savedPlans.find(p => p.workouts.some(w => w.id === workoutId));
      if (!plan) return;

      const originalWorkout = plan.workouts.find(w => w.id === workoutId);
      if (!originalWorkout) return; // Should exist

      if (strategy === 'move') {
        await trainingPlansService.updateWorkout(
          originalWorkout.id,
          originalWorkout.name,
          originalWorkout.description,
          originalWorkout.duration,
          originalWorkout.distance,
          originalWorkout.intensity,
          newDate
        );
      } else if (strategy === 'swap') {
        const targetWorkout = plan.workouts.find((w: Workout) =>
          isSameDay(new Date(w.scheduledDate), newDate)
        );
        if (targetWorkout) {
          await Promise.all([
            trainingPlansService.updateWorkout(
              originalWorkout.id,
              originalWorkout.name,
              originalWorkout.description,
              originalWorkout.duration,
              originalWorkout.distance,
              originalWorkout.intensity,
              newDate
            ),
            trainingPlansService.updateWorkout(
              targetWorkout.id,
              targetWorkout.name,
              targetWorkout.description,
              targetWorkout.duration,
              targetWorkout.distance,
              targetWorkout.intensity,
              originalWorkout.scheduledDate
            )
          ]);
        }
      } else if (strategy === 'replace') {
        const targetWorkout = plan.workouts.find((w: Workout) =>
          isSameDay(new Date(w.scheduledDate), newDate)
        );
        if (targetWorkout) {
          await trainingPlansService.deleteWorkout(targetWorkout.id);
          await trainingPlansService.updateWorkout(
            originalWorkout.id,
            originalWorkout.name,
            originalWorkout.description,
            originalWorkout.duration,
            originalWorkout.distance,
            originalWorkout.intensity,
            newDate
          );
        }
      }
    } catch (error) {
      console.error('Failed to move workout:', error);
      alert('Failed to update workout schedule. Reloading plans...');
      // Re-fetch to revert to server state
      queryClient.setQueryData(['plan-data'], previousData);
      queryClient.invalidateQueries({ queryKey: ['plan-data'] });
    }
  };

  if (loading) {
    return <PlansSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* Ambient Background Orbs */}
      <div className="fixed top-20 right-0 w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] -z-10 pointer-events-none" />

      <NetworkErrorBanner />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mb-2">
              Training Plans
            </h1>
            <p className="text-slate-400 text-sm md:text-base">
              AI-generated cycling plans based on your Strava data
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
             <Button
              onClick={() => setShowCalendarModal(true)}
              variant="outline"
              className="flex items-center justify-center space-x-2 w-full md:w-auto border-slate-700 text-slate-300 hover:text-white"
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Sync</span>
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center space-x-2 w-full md:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>New Plan</span>
            </Button>
          </div>
        </div>

        <CalendarSyncModal 
          isOpen={showCalendarModal} 
          onClose={() => setShowCalendarModal(false)} 
        />

        {pickerDate && (
           <SmartWorkoutPickerModal
             isOpen={showSmartPicker}
             onClose={() => {
                 setShowSmartPicker(false);
                 setPickerDate(null);
                 setPickerTargetPlanId(null);
             }}
             date={pickerDate}
             onSelectWorkout={handleSmartWorkoutSelect}
             recoveryScore={bioData?.recoveryScore ?? 75} 
             acuteLoadRatio={bioData?.acuteLoadRatio ?? 1.1} 
           />
        )}



        {/* Plan Generation Form */}
        {showForm && (
          <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-4 md:p-6 mb-8">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">
              Generate New Cycling Plan
            </h3>

            <form onSubmit={handleGeneratePlan} className="space-y-6">
              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Goal Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {goalTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGoalType(option.value as 'distance' | 'event' | 'fitness')}
                      className={`p-3 text-sm rounded-lg border transition-colors ${goalType === option.value
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Goal */}
              <div>
                <label htmlFor="goal" className="block text-sm font-medium text-slate-300 mb-2">
                  Specific Goal
                </label>
                <input
                  type="text"
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Complete a century ride, Improve FTP by 20 watts, Ride 125mi/week consistently"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-50 placeholder-slate-500"
                  required
                />
              </div>

              {/* Timeframe and Weekly Hours */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-50"
                  >
                    <option value="4 weeks">4 weeks</option>
                    <option value="8 weeks">8 weeks</option>
                    <option value="12 weeks">12 weeks</option>
                    <option value="16 weeks">16 weeks</option>
                    <option value="20 weeks">20 weeks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Weekly Time Available
                  </label>
                  <select
                    value={weeklyHours}
                    onChange={(e) => setWeeklyHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-50"
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Focus Areas (select all that apply)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {focusAreaOptions.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => toggleFocusArea(area)}
                      className={`p-2 text-xs rounded-md border transition-colors text-left ${focusAreas.includes(area)
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Preferences */}
              <div>
                <label htmlFor="preferences" className="block text-sm font-medium text-slate-300 mb-2">
                  Additional Preferences
                </label>
                <textarea
                  id="preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g., Prefer indoor training on weekdays, avoid back-to-back hard days, include recovery rides..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-slate-50 placeholder-slate-500"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                  <p className="text-red-400 text-sm">{error}</p>
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
                  className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-200"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Sticky Header and Active Plan View */}
        {savedPlans.length > 0 && savedPlans.map((plan) => {
            const totalWorkouts = plan.workouts.length;
            const completedWorkouts = plan.workouts.filter(w => w.completed).length;
            const completionPercentage = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
            const totalDistance = plan.workouts.reduce((sum, w) => sum + (w.distance || 0), 0);
            
            return (
              <div key={plan.id} className="mb-24 relative">
                 {/* Slim Sticky Header */}
                 <div className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5 py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 mb-6 shadow-2xl">
                    <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                        {/* Left: Title + Badge */}
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-white leading-tight">{plan.name}</h2>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                   <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
                                      {Math.ceil(totalWorkouts / 7)} Weeks
                                   </span>
                                   <span>
                                     {format(plan.startDate, 'MMM d')} - {format(plan.endDate, 'MMM d')}
                                   </span>
                                </div>
                            </div>
                        </div>

                        {/* Right: Progress + Info */}
                        <div className="flex items-center gap-4">
                             <div className="hidden md:block text-right">
                                <div className="text-xs text-slate-400 mb-1">
                                    {completedWorkouts}/{totalWorkouts} Complete
                                </div>
                                <div className="w-32 bg-slate-800 rounded-full h-1.5">
                                    <div 
                                        className="bg-orange-500 h-1.5 rounded-full transition-all duration-500" 
                                        style={{ width: `${completionPercentage}%` }}
                                    />
                                </div>
                             </div>

                             <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                                <button
                                    onClick={() => deletePlan(plan.id)}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                                    title="Delete Plan"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => togglePlan(plan.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        expandedPlan === plan.id 
                                        ? 'bg-orange-500 text-white' 
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                >
                                    <span>Plan Info</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${expandedPlan === plan.id ? 'rotate-180' : ''}`} />
                                </button>
                             </div>
                        </div>
                    </div>

                    {/* Collapsible Info Drawer (Absolute positioned below header) */}
                    <div className={`overflow-hidden transition-all duration-300 bg-slate-900 border-b border-white/5 ${expandedPlan === plan.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                         <div className="max-w-7xl mx-auto px-4 py-6">
                            <div className="grid md:grid-cols-3 gap-8">
                                <div className="md:col-span-2 prose prose-sm prose-invert">
                                    <h4 className="text-slate-400 font-medium mb-2 uppercase tracking-wider text-xs">Description</h4>
                                    <div 
                                       dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(plan.description || '') }} 
                                       className="text-slate-300 [&_p]:text-slate-300 [&_li]:text-slate-300 [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white"
                                    />
                                </div>
                                <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5 h-fit">
                                    <h4 className="text-slate-400 font-medium mb-4 uppercase tracking-wider text-xs">At a Glance</h4>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Total Distance</span>
                                            <span className="text-slate-300">{(totalDistance / 1609.34).toFixed(1)} mi</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Avg. Intensity</span>
                                            <span className="text-slate-300 capitalize">Moderate</span>
                                        </div>
                                         <div className="flex justify-between">
                                            <span className="text-slate-500">Source</span>
                                            <span className="text-blue-400 flex items-center gap-1">
                                                <MessageCircle className="w-3 h-3" /> AI Chat
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         </div>
                    </div>
                 </div>

                 {/* Main Content Area */}
                 <div className="relative z-0">
                    <WeeklyPlanView
                        workouts={plan.workouts}
                        startDate={plan.startDate}
                        onToggleComplete={handleToggleWorkoutComplete}
                        onStatusChange={handleUpdateStatus}
                        onDelete={handleDeleteWorkout}
                        onAddWorkout={(date) => handleAddWorkout(plan.id, date)}
                        onModifyWeek={(weekNumber, weekWorkouts) => handleOpenModifyWeek(plan.id, weekNumber, weekWorkouts)}
                        onMoveWorkout={handleMoveWorkout}
                        onWorkoutClick={setSelectedWorkout}
                        weeklyStats={weeklyStats}
                        streak={streak}
                    />
                 </div>
              </div>
            );
        })}

        {/* Empty State */}
          {savedPlans.length === 0 && (
            <div className="bg-slate-900 rounded-lg shadow-sm border border-slate-800 p-8 text-center mt-8">
              <div className="text-slate-400 text-6xl mb-4">🚴</div>
              <h3 className="text-lg font-semibold text-slate-50 mb-2">
                No Training Plans Yet
              </h3>
              <p className="text-slate-400 mb-4">
                Create your first AI-generated cycling plan based on your Strava data
              </p>
              <Button
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center space-x-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Plan</span>
              </Button>
            </div>
          )}
      </div>

      <PlanModificationModal
        isOpen={modificationModal.isOpen}
        onClose={handleCloseModifyWeek}
        weekNumber={modificationModal.weekNumber}
        currentWorkouts={modificationModal.workouts}
        onApplyChanges={handleApplyModification}
      />

      <div className="mt-8 mb-4 text-center">
        <p className="text-xs text-slate-500 italic">
          Insights derived in part from Garmin device-sourced data.
        </p>
      </div>

      {/* Modals */}
      {selectedWorkout && (
        <WorkoutDetailModal
          workout={selectedWorkout}
          onClose={() => setSelectedWorkout(null)}
        />
      )}
    </div>
  );
};