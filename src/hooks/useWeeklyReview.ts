import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { userProfileService } from '../services/userProfileService';
import { lastCompletedWeekStart, weeklyReviewService } from '../services/weeklyReviewService';
import { MOCK_WEEKLY_REVIEWS } from '../data/mockDashboardData';
import type { WeeklyReview } from '../types';

const REVIEW_HISTORY_LIMIT = 12;

export interface UseWeeklyReviewResult {
  /** Review for the most recently completed week, if there was a plan that week. */
  latest: WeeklyReview | null;
  /** All cached reviews, newest first (includes `latest`). */
  reviews: WeeklyReview[];
  /** True while the first load (including lazy generation) is in flight. */
  isLoading: boolean;
}

function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lazily creates and caches the review for the last completed Monday-Sunday
 * week, then returns it with past reviews. No cron: the first app load after
 * a week ends does the work; every later load just reads the cached row.
 *
 * `?demo=true` returns mock reviews without touching Supabase.
 */
export function useWeeklyReview(): UseWeeklyReviewResult {
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';
  const { user, userProfile } = useAuth();
  const userId = user?.id;
  const timeZone = browserTimeZone();

  // Store the browser timezone once per session so the week boundary is stable.
  const savedTz = useRef(false);
  useEffect(() => {
    if (isDemo || !userId || !userProfile || !timeZone || savedTz.current) return;
    savedTz.current = true;
    if (userProfile.timezone === timeZone) return;
    userProfileService.updateUserProfile({ timezone: timeZone }).catch(err => {
      // Non-fatal: e.g. the column is not migrated yet. The browser zone is used regardless.
      console.warn('Could not store timezone:', err);
    });
  }, [isDemo, userId, userProfile, timeZone]);

  const weekStart = lastCompletedWeekStart(new Date(), timeZone);

  const { data, isLoading } = useQuery({
    queryKey: ['weekly-review', userId, weekStart],
    enabled: !isDemo && !!userId && !!userProfile,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<WeeklyReview[]> => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return [];
      const mode = userProfile?.fitness_mode === 're_engager' ? 're_engager' : 'performance';
      await weeklyReviewService.ensureReview(authUser.id, weekStart, {
        fitnessMode: mode,
        coachingStyle: userProfile?.coach_persona || 'supportive',
        persona: userProfile?.coach_specialization,
      });
      return weeklyReviewService.listReviews(authUser.id, REVIEW_HISTORY_LIMIT);
    },
  });

  if (isDemo) {
    return { latest: MOCK_WEEKLY_REVIEWS[0], reviews: MOCK_WEEKLY_REVIEWS, isLoading: false };
  }

  const reviews = data ?? [];
  return {
    latest: reviews.find(r => r.weekStart === weekStart) ?? null,
    reviews,
    isLoading: isLoading && !!userId,
  };
}
