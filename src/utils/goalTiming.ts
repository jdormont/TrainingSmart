import { differenceInCalendarDays, format } from 'date-fns';
import type { Goal } from '../types';

export interface GoalTimingInfo {
  weekLabel?: string;
  targetLabel?: string;
  summary: string;
}

type GoalDates = Pick<Goal, 'targetDate' | 'blockStartDate' | 'blockEndDate'>;

function parseDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}

function pluralDays(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`;
}

/**
 * Computes human-readable "Week X of Y" / "N days until target" phrasing
 * live from a goal's absolute dates — never stored as text, so this is the
 * single place that phrasing is generated (shared by prompt assembly and
 * the Settings UI, so they can never disagree).
 */
export function computeGoalTiming(goal: GoalDates | null | undefined, today: Date = new Date()): GoalTimingInfo | null {
  if (!goal) return null;
  const { targetDate, blockStartDate, blockEndDate } = goal;
  if (!targetDate && !blockStartDate && !blockEndDate) return null;

  const parts: string[] = [];
  let weekLabel: string | undefined;
  let targetLabel: string | undefined;

  if (blockStartDate && blockEndDate) {
    const start = parseDate(blockStartDate);
    const end = parseDate(blockEndDate);
    const totalDays = Math.max(1, differenceInCalendarDays(end, start));
    const totalWeeks = Math.max(1, Math.ceil((totalDays + 1) / 7));
    const elapsedDays = differenceInCalendarDays(today, start);
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.floor(elapsedDays / 7) + 1));
    weekLabel = `Week ${currentWeek} of ${totalWeeks}`;
    parts.push(weekLabel);
  }

  if (targetDate) {
    const target = parseDate(targetDate);
    const daysUntil = differenceInCalendarDays(target, today);
    const formatted = format(target, 'MMM d, yyyy');
    if (daysUntil > 0) {
      targetLabel = `targeting ${formatted} — ${pluralDays(daysUntil)} away`;
    } else if (daysUntil === 0) {
      targetLabel = `target date is today (${formatted})`;
    } else {
      targetLabel = `target date (${formatted}) was ${pluralDays(Math.abs(daysUntil))} ago`;
    }
    parts.push(targetLabel);
  } else if (blockEndDate) {
    const end = parseDate(blockEndDate);
    const daysUntil = differenceInCalendarDays(end, today);
    const formatted = format(end, 'MMM d, yyyy');
    targetLabel = daysUntil >= 0
      ? `block ends ${formatted} — ${pluralDays(daysUntil)} away`
      : `block ended ${formatted} (${pluralDays(Math.abs(daysUntil))} ago)`;
    parts.push(targetLabel);
  }

  return { weekLabel, targetLabel, summary: parts.join(' · ') };
}
