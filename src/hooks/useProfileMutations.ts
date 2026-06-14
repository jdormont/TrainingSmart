/**
 * useProfileMutations.ts
 *
 * React Query useMutation hooks for user profile write operations.
 * On success each mutation invalidates dashboard-data so widgets
 * reflecting profile settings (FTP zones, fitness mode, etc.) refresh.
 *
 * Query key constants are exported so components can import them without
 * duplicating string literals.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userProfileService } from '../services/userProfileService';
import type { UserProfile } from '../services/userProfileService';

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------

/** Key prefix used by useDashboardData (matches both 'demo' and 'user' variants) */
export const DASHBOARD_DATA_KEY = ['dashboard-data'] as const;

// ---------------------------------------------------------------------------
// User profile mutation
// ---------------------------------------------------------------------------

/**
 * Save (partial) user profile fields — training goal, coach persona,
 * FTP, gender, age bucket, weekly availability, fitness mode, etc.
 *
 * Maps directly to userProfileService.updateUserProfile().
 * Invalidates dashboard-data on success so the dashboard widgets that
 * depend on profile data (power zones, fitness mode layout) refresh.
 */
export function useSaveUserProfile(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: Partial<UserProfile>) =>
      userProfileService.updateUserProfile(profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['user-profile', userId] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Rider / athletic profile mutation
// ---------------------------------------------------------------------------

/**
 * Save rider-specific profile fields (FTP, weight, skill level, etc.).
 *
 * The RiderProfileService is a pure calculation class with no persistence
 * method. Rider profile data is persisted via userProfileService just like
 * the general user profile — this hook exists as a semantic alias so call
 * sites can distinguish between "general settings" saves and
 * "rider/athletic profile" saves, even though both delegate to the same
 * underlying Supabase table.
 *
 * Invalidates dashboard-data on success.
 */
export function useSaveRiderProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profile: Partial<UserProfile>) =>
      userProfileService.updateUserProfile(profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_DATA_KEY, exact: false });
    },
  });
}
