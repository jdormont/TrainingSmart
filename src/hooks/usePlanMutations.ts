/**
 * usePlanMutations.ts
 *
 * React Query useMutation hooks for all plan and workout write operations.
 * Each hook invalidates the relevant query caches on success so the UI
 * stays fresh without a manual refetch.
 *
 * Query key constants are exported so components can import them directly
 * instead of duplicating string literals.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { trainingPlansService } from '../services/trainingPlansService';
import type { TrainingPlan, Workout } from '../types';

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------

/** Key used by usePlanData */
export const PLAN_DATA_KEY = ['plan-data'] as const;

/** Key prefix used by useDashboardData (matches both 'demo' and 'user' variants) */
export const DASHBOARD_DATA_KEY = ['dashboard-data'] as const;

// ---------------------------------------------------------------------------
// Workout status toggle
// ---------------------------------------------------------------------------

export interface ToggleWorkoutCompleteVars {
  workoutId: string;
  status: 'planned' | 'completed' | 'skipped';
}

/**
 * Toggle a workout's completion status.
 * Invalidates plan-data and dashboard-data (both demo/user variants) on success.
 */
export function useToggleWorkoutComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workoutId, status }: ToggleWorkoutCompleteVars) =>
      trainingPlansService.updateWorkoutStatus(workoutId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
    },
  });
}

// ---------------------------------------------------------------------------
// Plan CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new training plan.
 * Invalidates plan-data and dashboard-data on success.
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: Omit<TrainingPlan, 'id' | 'createdAt'>) =>
      trainingPlansService.createPlan(plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
    },
  });
}

export interface UpdatePlanVars {
  planId: string;
  updates: Partial<Omit<TrainingPlan, 'id' | 'createdAt' | 'workouts'>>;
}

/**
 * Update plan-level fields (name, description, goal, dates).
 *
 * trainingPlansService does not expose a dedicated updatePlan method; this hook
 * wraps the same createPlan path after the caller has built the full updated
 * plan object, OR can be extended to call a future updatePlan service method.
 * For now it re-uses the service's createPlan return shape to satisfy the type
 * contract and invalidates the correct keys.
 *
 * NOTE: If trainingPlansService adds an `updatePlan(planId, fields)` method,
 * replace the mutationFn body here and the types will stay correct.
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, updates }: UpdatePlanVars): Promise<void> => {
      // Supabase update via service — extend trainingPlansService with
      // updatePlan() when ready; for now this is a typed placeholder that
      // triggers the correct cache invalidation pattern.
      const { supabase } = await import('../services/supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.goal !== undefined) dbUpdates.goal = updates.goal;
      if (updates.startDate !== undefined)
        dbUpdates.start_date = updates.startDate.toISOString().split('T')[0];
      if (updates.endDate !== undefined)
        dbUpdates.end_date = updates.endDate.toISOString().split('T')[0];
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('training_plans')
        .update(dbUpdates)
        .eq('id', planId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
    },
  });
}

/**
 * Delete a training plan by ID.
 * Invalidates plan-data and dashboard-data on success.
 */
export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => trainingPlansService.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
    },
  });
}

// ---------------------------------------------------------------------------
// Workout CRUD
// ---------------------------------------------------------------------------

export interface AddWorkoutVars {
  planId: string;
  workout: Parameters<typeof trainingPlansService.addWorkoutToPlan>[1];
}

/**
 * Add a workout to an existing plan.
 * Invalidates plan-data on success.
 */
export function useAddWorkout() {
  const queryClient = useQueryClient();

  return useMutation<Workout, Error, AddWorkoutVars>({
    mutationFn: ({ planId, workout }: AddWorkoutVars) =>
      trainingPlansService.addWorkoutToPlan(planId, workout),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
    },
  });
}

export interface UpdateWorkoutVars {
  workoutId: string;
  name: string;
  description: string;
  duration: number;
  distance: number | undefined;
  intensity: Workout['intensity'];
  scheduledDate: Date;
}

/**
 * Update an existing workout's fields.
 * Invalidates plan-data on success.
 */
export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workoutId,
      name,
      description,
      duration,
      distance,
      intensity,
      scheduledDate,
    }: UpdateWorkoutVars) =>
      trainingPlansService.updateWorkout(
        workoutId,
        name,
        description,
        duration,
        distance,
        intensity,
        scheduledDate,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
    },
  });
}

/**
 * Delete a workout by ID.
 * Invalidates plan-data on success.
 */
export function useDeleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workoutId: string) => trainingPlansService.deleteWorkout(workoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_DATA_KEY, exact: false });
    },
  });
}
