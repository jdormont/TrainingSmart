import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userMemoryService, type MergedMemory } from '../services/userMemoryService';
import type { UserMemory } from '../types';

export const USER_MEMORY_KEY = ['user-memory'] as const;

export const useUserMemory = () => {
  return useQuery({
    queryKey: USER_MEMORY_KEY,
    queryFn: () => userMemoryService.getMemory(),
    staleTime: 300000,
  });
};

export function useUpdateUserMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partial: Parameters<typeof userMemoryService.editMemory>[0]) =>
      userMemoryService.editMemory(partial),
    onSuccess: (memory: UserMemory) => {
      queryClient.setQueryData(USER_MEMORY_KEY, memory);
    },
  });
}

export function useClearUserMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => userMemoryService.clearMemory(),
    onSuccess: () => {
      queryClient.setQueryData(USER_MEMORY_KEY, null);
    },
  });
}

export function useGenerateMemoryDraft() {
  return useMutation<MergedMemory>({
    mutationFn: () => userMemoryService.generateDraftFromHistory(),
  });
}

export function useApplyMemoryDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: MergedMemory) => userMemoryService.applyDraft(draft),
    onSuccess: (memory: UserMemory) => {
      queryClient.setQueryData(USER_MEMORY_KEY, memory);
    },
  });
}
