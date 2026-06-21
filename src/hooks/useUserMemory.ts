import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userMemoryService } from '../services/userMemoryService';
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
