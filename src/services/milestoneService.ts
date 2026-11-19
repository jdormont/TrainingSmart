import type { UserStreak } from './streakService';
import type { WeeklyReview } from '../types';

const LEVEL_UP_DISMISSED_KEY = 'level_up_dismissed_at';
const LEVEL_UP_ACCEPTED_KEY = 'level_up_accepted';
const DISMISS_COOLDOWN_DAYS = 14;

// Minimum criteria to show the level-up prompt.
//
// Weekly consistency (preferred, once enough reviews exist):
// - At least 3 of the last 4 scored weeks with an adherence score of 70+.
//   Weeks with no plan (null score) are skipped, neither helping nor hurting.
//
// Legacy fallback (athletes who do not yet have 4 scored weeks):
// - At least 3 weeks of current streak (21 days) OR
// - At least 8 activity entries in the past 28 days across streak history
export const WEEKLY_WINDOW = 4;
export const WEEKS_REQUIRED = 3;
export const WEEKLY_SCORE_THRESHOLD = 70;
const MIN_STREAK_DAYS = 21;
const MIN_RECENT_ACTIVITIES = 8;
const HISTORY_WINDOW_DAYS = 28;

export interface MilestoneStatus {
  eligible: boolean;
  weeksConsistent: number;
  recentActivityCount: number;
  alreadyAccepted: boolean;
  dismissedRecently: boolean;
}

/** Activity entries in the past HISTORY_WINDOW_DAYS from streak_history. */
function countRecentActivities(streak: UserStreak | null): number {
  if (!streak) return 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_WINDOW_DAYS);
  return (streak.streak_history ?? []).filter(item => {
    if (item.type !== 'activity') return false;
    return new Date(item.date) >= cutoff;
  }).length;
}

export const milestoneService = {
  /**
   * @param reviews Cached weekly reviews, newest first. Pass `null` while they
   *   are still loading: the prompt is withheld rather than flashing the
   *   legacy rule and then changing its mind.
   */
  checkLevelUp(
    streak: UserStreak | null,
    fitnessMode: string | undefined,
    reviews: Pick<WeeklyReview, 'adherenceScore'>[] | null,
  ): MilestoneStatus {
    const alreadyAccepted = localStorage.getItem(LEVEL_UP_ACCEPTED_KEY) === 'true';
    const dismissedAt = localStorage.getItem(LEVEL_UP_DISMISSED_KEY);
    const dismissedRecently = dismissedAt
      ? (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24) < DISMISS_COOLDOWN_DAYS
      : false;

    if (fitnessMode !== 're_engager' || alreadyAccepted || reviews === null) {
      return { eligible: false, weeksConsistent: 0, recentActivityCount: 0, alreadyAccepted, dismissedRecently };
    }

    const recentScored = reviews.filter(r => r.adherenceScore !== null).slice(0, WEEKLY_WINDOW);
    if (recentScored.length >= WEEKLY_WINDOW) {
      const qualifyingWeeks = recentScored.filter(r => (r.adherenceScore as number) >= WEEKLY_SCORE_THRESHOLD).length;
      const recentActivityCount = countRecentActivities(streak);
      return {
        eligible: qualifyingWeeks >= WEEKS_REQUIRED && !dismissedRecently,
        weeksConsistent: qualifyingWeeks,
        recentActivityCount,
        alreadyAccepted,
        dismissedRecently,
      };
    }

    if (!streak) {
      return { eligible: false, weeksConsistent: 0, recentActivityCount: 0, alreadyAccepted, dismissedRecently };
    }

    const currentStreak = streak.current_streak ?? 0;
    const weeksConsistent = Math.floor(currentStreak / 7);

    const recentActivityCount = countRecentActivities(streak);

    const meetsStreak = currentStreak >= MIN_STREAK_DAYS;
    const meetsActivity = recentActivityCount >= MIN_RECENT_ACTIVITIES;
    const eligible = (meetsStreak || meetsActivity) && !dismissedRecently;

    return { eligible, weeksConsistent, recentActivityCount, alreadyAccepted, dismissedRecently };
  },

  dismiss() {
    localStorage.setItem(LEVEL_UP_DISMISSED_KEY, new Date().toISOString());
  },

  accept() {
    localStorage.setItem(LEVEL_UP_ACCEPTED_KEY, 'true');
    localStorage.removeItem(LEVEL_UP_DISMISSED_KEY);
  },

  /** Call this if the user manually switches back to re_engager, so they can see the prompt again */
  reset() {
    localStorage.removeItem(LEVEL_UP_ACCEPTED_KEY);
    localStorage.removeItem(LEVEL_UP_DISMISSED_KEY);
  },
};
