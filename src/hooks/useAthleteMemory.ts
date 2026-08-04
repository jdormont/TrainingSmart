import { useQuery } from '@tanstack/react-query';
import { useAthleteProfile } from './useAthleteProfile';
import { useActiveGoal, useGoalHistory } from './useGoals';
import { useCurrentFtp } from './useFtpHistory';
import { useRecentActivityNotes } from './useRecentActivityNotes';
import { stravaCacheService } from '../services/stravaCacheService';
import type { AthleteMemoryContext } from '../types';

const GOAL_HISTORY_LIMIT = 3;

export const POWER_CURVE_ROLLUP_KEY = ['power-curve-rollup'] as const;

/**
 * Composes the full AthleteMemoryContext consumed by AI prompt assembly
 * (chat, plan generation, analysis) from the individual profile/goal/FTP/
 * power-curve/recent-notes sources.
 */
export function useAthleteMemory(): { data: AthleteMemoryContext | undefined; isLoading: boolean } {
  const profileQuery = useAthleteProfile();
  const activeGoalQuery = useActiveGoal();
  const goalHistoryQuery = useGoalHistory(GOAL_HISTORY_LIMIT);
  const currentFtpQuery = useCurrentFtp();
  const recentNotesQuery = useRecentActivityNotes();
  const powerCurveQuery = useQuery({
    queryKey: POWER_CURVE_ROLLUP_KEY,
    queryFn: () => stravaCacheService.getPowerCurveRollup(),
    staleTime: 300000,
  });

  const isLoading =
    profileQuery.isLoading ||
    activeGoalQuery.isLoading ||
    goalHistoryQuery.isLoading ||
    currentFtpQuery.isLoading ||
    recentNotesQuery.isLoading ||
    powerCurveQuery.isLoading;

  if (isLoading) {
    return { data: undefined, isLoading: true };
  }

  return {
    data: {
      profile: profileQuery.data ?? null,
      activeGoal: activeGoalQuery.data ?? null,
      goalHistory: goalHistoryQuery.data ?? [],
      currentFtp: currentFtpQuery.data ?? null,
      powerCurve: powerCurveQuery.data ?? null,
      recentNotes: recentNotesQuery.data ?? [],
    },
    isLoading: false,
  };
}
