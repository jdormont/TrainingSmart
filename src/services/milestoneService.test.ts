import { describe, it, expect, beforeEach, vi } from 'vitest';
import { milestoneService } from './milestoneService';
import type { UserStreak } from './streakService';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const streak = (over: Partial<UserStreak> = {}): UserStreak => ({
  user_id: 'u',
  current_streak: 0,
  longest_streak: 0,
  streak_freezes: 0,
  last_activity_date: null,
  streak_history: [],
  ...over,
} as UserStreak);

const scored = (...scores: Array<number | null>) => scores.map(adherenceScore => ({ adherenceScore }));

beforeEach(() => store.clear());

describe('milestoneService.checkLevelUp — legacy streak rule (fewer than 4 scored weeks)', () => {
  it('is eligible at a 21-day streak', () => {
    const s = milestoneService.checkLevelUp(streak({ current_streak: 21 }), 're_engager', []);
    expect(s.eligible).toBe(true);
    expect(s.weeksConsistent).toBe(3);
  });

  it('is eligible with 8 recent activity entries', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({ date: daysAgo(i + 1), type: 'activity' }));
    const s = milestoneService.checkLevelUp(streak({ current_streak: 3, streak_history: history as any }), 're_engager', scored(90, 90));
    expect(s.eligible).toBe(true);
    expect(s.recentActivityCount).toBe(8);
  });

  it('is not eligible below both thresholds', () => {
    expect(milestoneService.checkLevelUp(streak({ current_streak: 10 }), 're_engager', []).eligible).toBe(false);
  });

  it('is not eligible without a streak record', () => {
    expect(milestoneService.checkLevelUp(null, 're_engager', []).eligible).toBe(false);
  });
});

describe('milestoneService.checkLevelUp — weekly consistency rule', () => {
  it('is eligible with 3 of the last 4 weeks at 70+', () => {
    const s = milestoneService.checkLevelUp(streak(), 're_engager', scored(85, 40, 72, 70));
    expect(s.eligible).toBe(true);
    expect(s.weeksConsistent).toBe(3);
  });

  it('is not eligible with only 2 of 4 qualifying weeks', () => {
    expect(milestoneService.checkLevelUp(streak(), 're_engager', scored(85, 40, 72, 50)).eligible).toBe(false);
  });

  it('uses only the 4 most recent scored weeks', () => {
    // Older strong weeks must not count once they fall outside the window.
    const s = milestoneService.checkLevelUp(streak(), 're_engager', scored(50, 50, 90, 90, 90, 90));
    expect(s.eligible).toBe(false);
    expect(s.weeksConsistent).toBe(2);
  });

  it('skips weeks with no plan instead of counting them as misses', () => {
    const s = milestoneService.checkLevelUp(streak(), 're_engager', scored(80, null, 75, 90, 60));
    expect(s.eligible).toBe(true); // window = 80, 75, 90, 60 -> 3 qualify
  });

  it('takes precedence over a long streak once 4 scored weeks exist', () => {
    const s = milestoneService.checkLevelUp(streak({ current_streak: 40 }), 're_engager', scored(20, 30, 40, 50));
    expect(s.eligible).toBe(false);
  });

  it('does not need a streak record', () => {
    expect(milestoneService.checkLevelUp(null, 're_engager', scored(90, 90, 90, 90)).eligible).toBe(true);
  });
});

describe('milestoneService.checkLevelUp — gates', () => {
  it('withholds the prompt while reviews are still loading (null)', () => {
    expect(milestoneService.checkLevelUp(streak({ current_streak: 30 }), 're_engager', null).eligible).toBe(false);
  });

  it('only applies to re-engagers', () => {
    expect(milestoneService.checkLevelUp(streak({ current_streak: 30 }), 'performance', []).eligible).toBe(false);
  });

  it('respects the dismissal cooldown', () => {
    milestoneService.dismiss();
    const s = milestoneService.checkLevelUp(streak({ current_streak: 30 }), 're_engager', []);
    expect(s.eligible).toBe(false);
    expect(s.dismissedRecently).toBe(true);
  });

  it('stays ineligible after accepting, until reset', () => {
    milestoneService.accept();
    expect(milestoneService.checkLevelUp(streak({ current_streak: 30 }), 're_engager', []).eligible).toBe(false);
    milestoneService.reset();
    expect(milestoneService.checkLevelUp(streak({ current_streak: 30 }), 're_engager', []).eligible).toBe(true);
  });
});
