import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { goalsService, type NewGoalInput } from '../services/goalsService';
import type { Goal } from '../types';

export const ACTIVE_GOAL_KEY = ['active-goal'] as const;
export const GOAL_HISTORY_KEY = ['goal-history'] as const;

export const useActiveGoal = () => {
  return useQuery({
    queryKey: ACTIVE_GOAL_KEY,
    queryFn: () => goalsService.getActiveGoal(),
    staleTime: 300000,
  });
};

export const useGoalHistory = (limit?: number) => {
  return useQuery({
    queryKey: [...GOAL_HISTORY_KEY, limit],
    queryFn: () => goalsService.listGoalHistory(limit),
    staleTime: 300000,
  });
};

export function useCreateActiveGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewGoalInput) => goalsService.createActiveGoal(input),
    onSuccess: (goal: Goal) => {
      queryClient.setQueryData(ACTIVE_GOAL_KEY, goal);
    },
  });
}

export function useUpdateActiveGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof goalsService.updateActiveGoal>[1] }) =>
      goalsService.updateActiveGoal(id, patch),
    onSuccess: (goal: Goal) => {
      queryClient.setQueryData(ACTIVE_GOAL_KEY, goal);
    },
  });
}

export function useCloseGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'completed' | 'abandoned'; reason?: string }) =>
      goalsService.closeGoal(id, status, reason),
    onSuccess: () => {
      queryClient.setQueryData(ACTIVE_GOAL_KEY, null);
      queryClient.invalidateQueries({ queryKey: GOAL_HISTORY_KEY, exact: false });
    },
  });
}

export function useReplaceActiveGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ newGoal, closure }: {
      newGoal: NewGoalInput;
      closure?: { goalId: string; status: 'completed' | 'abandoned'; reason?: string };
    }) => goalsService.replaceActiveGoal(newGoal, closure),
    onSuccess: ({ created }) => {
      queryClient.setQueryData(ACTIVE_GOAL_KEY, created);
      queryClient.invalidateQueries({ queryKey: GOAL_HISTORY_KEY, exact: false });
    },
  });
}
