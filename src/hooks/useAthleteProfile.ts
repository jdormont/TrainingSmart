import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { athleteProfileService, type MergedProfile } from '../services/athleteProfileService';
import type { AthleteProfile } from '../types';

export const ATHLETE_PROFILE_KEY = ['athlete-profile'] as const;

export const useAthleteProfile = () => {
  return useQuery({
    queryKey: ATHLETE_PROFILE_KEY,
    queryFn: () => athleteProfileService.getProfile(),
    staleTime: 300000,
  });
};

export function useUpdateAthleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (partial: Parameters<typeof athleteProfileService.editProfile>[0]) =>
      athleteProfileService.editProfile(partial),
    onSuccess: (profile: AthleteProfile) => {
      queryClient.setQueryData(ATHLETE_PROFILE_KEY, profile);
    },
  });
}

export function useClearAthleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => athleteProfileService.clearProfile(),
    onSuccess: () => {
      queryClient.setQueryData(ATHLETE_PROFILE_KEY, null);
    },
  });
}

export function useGenerateProfileDraft() {
  return useMutation<MergedProfile>({
    mutationFn: () => athleteProfileService.generateDraftFromHistory(),
  });
}

export function useApplyProfileDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draft: MergedProfile) => athleteProfileService.applyDraft(draft),
    onSuccess: (profile: AthleteProfile) => {
      queryClient.setQueryData(ATHLETE_PROFILE_KEY, profile);
    },
  });
}
