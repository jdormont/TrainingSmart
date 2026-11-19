import type { AdherenceStats } from '../types';

/**
 * Forgiving, deterministic weekly adherence calculator.
 *
 * Pure: no I/O, no clock, no randomness. The LLM never computes any of these
 * numbers; it only narrates them (see openai-weekly-review).
 *
 * Score = minutes of credit earned / minutes planned, capped at 100.
 * "Actual minutes" for a completed workout is the Strava match's moving time
 * when one exists, otherwise the planned duration (full credit): a workout
 * the athlete marked done is treated as done.
 */

/** Minimum credit for a completed workout, however short, so effort is never read as a near-miss. */
export const MIN_COMPLETED_CREDIT = 0.5;
/** Credit for a completed workout that swapped sport from what was planned. */
export const SUBSTITUTION_CREDIT = 0.75;

export interface AdherenceWorkout {
  /** YYYY-MM-DD */
  date: string;
  /** Planned minutes. */
  duration: number;
  status: 'planned' | 'completed' | 'skipped';
  /** Planned activity type. */
  type?: string;
  /** Strava-matched moving time in minutes, when known. */
  actualMinutes?: number | null;
  /** Activity type the athlete actually did (e.g. matched Strava type), when known. */
  actualType?: string | null;
  /** Post-workout RPE from the check-in, when logged. */
  rpe?: number | null;
}

export interface AdherenceInput {
  workouts: AdherenceWorkout[];
  /**
   * Days (YYYY-MM-DD) excluded from the score, e.g. illness or travel.
   * Placeholder for a future pause mode; defaults to none.
   */
  excusedDates?: string[];
}

/** Map between Strava activity types and the planned workout types they satisfy. */
const TYPE_FAMILIES: Record<string, string> = {
  ride: 'bike', virtualride: 'bike', ebikeride: 'bike', gravelride: 'bike', mountainbikeride: 'bike', bike: 'bike',
  run: 'run', trailrun: 'run', virtualrun: 'run',
  swim: 'swim',
  weighttraining: 'strength', workout: 'strength', crossfit: 'strength', strength: 'strength',
};

function family(type?: string | null): string | null {
  if (!type) return null;
  const key = type.toLowerCase();
  return TYPE_FAMILIES[key] ?? key;
}

function isSubstitution(w: AdherenceWorkout): boolean {
  const planned = family(w.type);
  const actual = family(w.actualType);
  return planned !== null && actual !== null && planned !== actual;
}

/** Fraction of the planned minutes a single workout earns, in [0, 1]. */
function creditFor(w: AdherenceWorkout): number {
  if (w.status !== 'completed') return 0;
  if (isSubstitution(w)) return SUBSTITUTION_CREDIT;
  if (w.actualMinutes != null && w.actualMinutes > 0 && w.duration > 0) {
    return Math.min(1, Math.max(MIN_COMPLETED_CREDIT, w.actualMinutes / w.duration));
  }
  return 1;
}

export function calculateAdherence({ workouts, excusedDates = [] }: AdherenceInput): AdherenceStats {
  const excused = new Set(excusedDates);
  const counted = workouts.filter(w => !excused.has(w.date));

  let plannedMinutes = 0;
  let earnedMinutes = 0;
  let completedMinutes = 0;
  let workoutsCompleted = 0;
  let workoutsSkipped = 0;
  const rpes: number[] = [];

  for (const w of counted) {
    const planned = Math.max(0, w.duration);
    plannedMinutes += planned;
    earnedMinutes += planned * creditFor(w);
    if (w.status === 'completed') {
      workoutsCompleted += 1;
      completedMinutes += w.actualMinutes != null && w.actualMinutes > 0 ? w.actualMinutes : planned;
      if (typeof w.rpe === 'number') rpes.push(w.rpe);
    } else if (w.status === 'skipped') {
      workoutsSkipped += 1;
    }
  }

  const score = plannedMinutes > 0 ? Math.min(100, Math.round((earnedMinutes / plannedMinutes) * 100)) : null;

  const stats: AdherenceStats = {
    score,
    workoutsPlanned: counted.length,
    workoutsCompleted,
    workoutsSkipped,
    workoutsExcused: workouts.length - counted.length,
    plannedMinutes: Math.round(plannedMinutes),
    completedMinutes: Math.round(completedMinutes),
  };
  if (rpes.length > 0) {
    stats.avgRpe = Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10;
  }
  return stats;
}
