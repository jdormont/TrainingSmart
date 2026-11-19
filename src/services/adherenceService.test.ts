import { describe, it, expect } from 'vitest';
import {
  calculateAdherence,
  MIN_COMPLETED_CREDIT,
  SUBSTITUTION_CREDIT,
  type AdherenceWorkout,
} from './adherenceService';

const w = (over: Partial<AdherenceWorkout> = {}): AdherenceWorkout => ({
  date: '2026-11-09',
  duration: 60,
  status: 'completed',
  type: 'bike',
  ...over,
});

describe('calculateAdherence', () => {
  it('scores a fully completed week at 100', () => {
    const stats = calculateAdherence({
      workouts: [w({ date: '2026-11-09' }), w({ date: '2026-11-11' }), w({ date: '2026-11-13', duration: 90 })],
    });
    expect(stats.score).toBe(100);
    expect(stats.workoutsPlanned).toBe(3);
    expect(stats.workoutsCompleted).toBe(3);
    expect(stats.plannedMinutes).toBe(210);
    expect(stats.completedMinutes).toBe(210);
  });

  it('scores a partial week by minutes, not by workout count', () => {
    const stats = calculateAdherence({
      workouts: [
        w({ duration: 30 }),
        w({ duration: 90, status: 'skipped' }),
      ],
    });
    // 30 / 120 minutes
    expect(stats.score).toBe(25);
    expect(stats.workoutsCompleted).toBe(1);
    expect(stats.workoutsSkipped).toBe(1);
  });

  it('treats a workout still marked planned after the week as missed', () => {
    const stats = calculateAdherence({ workouts: [w(), w({ status: 'planned' })] });
    expect(stats.score).toBe(50);
    expect(stats.workoutsSkipped).toBe(0);
  });

  it('returns a null score (not 0) for an empty week', () => {
    const stats = calculateAdherence({ workouts: [] });
    expect(stats.score).toBeNull();
    expect(stats.workoutsPlanned).toBe(0);
    expect(stats.plannedMinutes).toBe(0);
  });

  it('gives partial credit for shorter workouts, floored at the minimum', () => {
    const half = calculateAdherence({ workouts: [w({ duration: 60, actualMinutes: 45 })] });
    expect(half.score).toBe(75);

    const tiny = calculateAdherence({ workouts: [w({ duration: 60, actualMinutes: 5 })] });
    expect(tiny.score).toBe(Math.round(MIN_COMPLETED_CREDIT * 100));
  });

  it('caps credit at 100 when the athlete did more than planned', () => {
    const stats = calculateAdherence({ workouts: [w({ duration: 60, actualMinutes: 120 })] });
    expect(stats.score).toBe(100);
    expect(stats.completedMinutes).toBe(120);
  });

  it('gives partial credit for a substituted sport', () => {
    const stats = calculateAdherence({
      workouts: [w({ type: 'bike', actualType: 'Run' })],
    });
    expect(stats.score).toBe(Math.round(SUBSTITUTION_CREDIT * 100));
  });

  it('does not treat equivalent Strava types as a substitution', () => {
    const stats = calculateAdherence({
      workouts: [w({ type: 'bike', actualType: 'VirtualRide' })],
    });
    expect(stats.score).toBe(100);
  });

  it('excludes excused days from both numerator and denominator', () => {
    const stats = calculateAdherence({
      workouts: [
        w({ date: '2026-11-09' }),
        w({ date: '2026-11-10', status: 'skipped' }),
      ],
      excusedDates: ['2026-11-10'],
    });
    expect(stats.score).toBe(100);
    expect(stats.workoutsPlanned).toBe(1);
    expect(stats.workoutsExcused).toBe(1);
  });

  it('returns a null score when every workout is excused', () => {
    const stats = calculateAdherence({
      workouts: [w({ status: 'skipped' })],
      excusedDates: ['2026-11-09'],
    });
    expect(stats.score).toBeNull();
  });

  it('handles several workouts on the same day', () => {
    const stats = calculateAdherence({
      workouts: [w({ duration: 45 }), w({ duration: 15, type: 'strength' })],
    });
    expect(stats.score).toBe(100);
    expect(stats.workoutsPlanned).toBe(2);
  });

  it('averages RPE across logged check-ins only', () => {
    const stats = calculateAdherence({
      workouts: [w({ rpe: 1 }), w({ rpe: 5 }), w()],
    });
    expect(stats.avgRpe).toBe(3);
    expect(calculateAdherence({ workouts: [w()] }).avgRpe).toBeUndefined();
  });

  it('is deterministic for identical input', () => {
    const input = {
      workouts: [w({ actualMinutes: 40 }), w({ status: 'skipped', duration: 30 }), w({ actualType: 'Run' })],
      excusedDates: [],
    };
    const a = calculateAdherence(input);
    const b = calculateAdherence(JSON.parse(JSON.stringify(input)));
    expect(a).toEqual(b);
  });

  it('does not mutate its input', () => {
    const workouts = [w()];
    const snapshot = JSON.stringify(workouts);
    calculateAdherence({ workouts });
    expect(JSON.stringify(workouts)).toBe(snapshot);
  });
});
