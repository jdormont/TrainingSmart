import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { stravaCacheService } from '../services/stravaCacheService';
import { trainingPlansService } from '../services/trainingPlansService';
import { ouraApi } from '../services/ouraApi';

export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    const performSync = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        console.log('[Background Sync] Checking cache status...');
        const cacheStatus = await stravaCacheService.getCacheStatus();
        
        // Cache limit is 15 minutes (900,000 ms)
        const fifteenMinutesMs = 15 * 60 * 1000;
        const activitiesAge = cacheStatus.activitiesAge;

        // If age is undefined (never fetched) or exceeds 15 minutes, we trigger a sync
        const isStravaStale = activitiesAge === undefined || activitiesAge > fifteenMinutesMs;

        if (isStravaStale) {
          if (!active) return;
          setIsSyncing(true);
          console.log('[Background Sync] Syncing Strava activities in background...');
          
          // 1. Fetch fresh activities and cache them (pertaining to recent 50)
          await stravaCacheService.getActivities(true, 50);

          // 2. Perform heuristic workout reconciliation
          console.log('[Background Sync] Running activity matching...');
          const matchResult = await trainingPlansService.reconcileWorkoutsWithStrava();
          console.log('[Background Sync] Match results:', matchResult);

          // 3. Sync Oura data in background if connected
          const isOuraConnected = await ouraApi.isAuthenticated();
          if (isOuraConnected) {
            console.log('[Background Sync] Syncing Oura data...');
            await ouraApi.syncOuraToDatabase(user.id);
          }

          // 4. Invalidate React Query queries so UI components refetch and update
          console.log('[Background Sync] Invalidating queries to update UI...');
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }),
            queryClient.invalidateQueries({ queryKey: ['plan-data'] })
          ]);
        } else {
          console.log('[Background Sync] Cache is fresh. Strava activities age:', Math.round(activitiesAge / 1000), 'seconds.');
          
          // Even if cache is fresh, check if we should run a quick local matching pass
          console.log('[Background Sync] Running local activity matching pass...');
          const matchResult = await trainingPlansService.reconcileWorkoutsWithStrava();
          if (matchResult.autoLinkedCount > 0 || matchResult.suggestedCount > 0) {
            console.log('[Background Sync] Local matching updated workouts, invalidating queries...', matchResult);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['dashboard-data'] }),
              queryClient.invalidateQueries({ queryKey: ['plan-data'] })
            ]);
          }
        }
      } catch (error) {
        console.error('[Background Sync] Error during background sync:', error);
      } finally {
        if (active) {
          setIsSyncing(false);
        }
      }
    };

    // Trigger on mount
    performSync();

    // Trigger on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Background Sync] Tab focused. Triggering sync check...');
        performSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);

  return { isSyncing };
};
