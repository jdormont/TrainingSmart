import type { UserStreak } from './streakService';

const LEVEL_UP_DISMISSED_KEY = 'level_up_dismissed_at';
const LEVEL_UP_ACCEPTED_KEY = 'level_up_accepted';
const DISMISS_COOLDOWN_DAYS = 14;

// Minimum criteria to show the level-up prompt:
// - At least 3 weeks of current streak (21 days) OR
// - At least 8 activity entries in the past 28 days across streak history
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

export const milestoneService = {
  checkLevelUp(streak: UserStreak | null, fitnessMode: string | undefined): MilestoneStatus {
    const alreadyAccepted = localStorage.getItem(LEVEL_UP_ACCEPTED_KEY) === 'true';
    const dismissedAt = localStorage.getItem(LEVEL_UP_DISMISSED_KEY);
    const dismissedRecently = dismissedAt
      ? (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60 * 24) < DISMISS_COOLDOWN_DAYS
      : false;

    if (fitnessMode !== 're_engager' || alreadyAccepted || !streak) {
      return { eligible: false, weeksConsistent: 0, recentActivityCount: 0, alreadyAccepted, dismissedRecently };
    }

    const currentStreak = streak.current_streak ?? 0;
    const weeksConsistent = Math.floor(currentStreak / 7);

    // Count activity entries in the past HISTORY_WINDOW_DAYS from streak_history
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_WINDOW_DAYS);
    const recentActivityCount = (streak.streak_history ?? []).filter(item => {
      if (item.type !== 'activity') return false;
      return new Date(item.date) >= cutoff;
    }).length;

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
