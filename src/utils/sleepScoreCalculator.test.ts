import { describe, it, expect } from 'vitest';
import {
  calculateSleepScore,
  getSleepScoreColor,
  getSleepScoreBgColor,
} from './sleepScoreCalculator';

// A representative "near-perfect" night: 7.5 h, good staging, quick onset, good timing.
const perfectSleep = {
  total_sleep_duration: 7.5 * 3600,   // 7.5 h (optimal 7–9)
  efficiency: 95,                       // 95 %
  restless_periods: 4,                  // very few
  rem_sleep_duration: 1.8 * 3600,      // 24 % of total → optimal 20–25 %
  deep_sleep_duration: 1.3 * 3600,     // 17 % of total → optimal 15–20 %
  light_sleep_duration: 4.4 * 3600,
  latency: 15 * 60,                     // 15 min → optimal 10–20
  bedtime_start: '2024-01-15T22:00:00', // 10 PM → optimal 21–23
  bedtime_end: '2024-01-16T05:30:00',
  time_in_bed: 8 * 3600,
};

describe('calculateSleepScore', () => {
  it('gives a high score (≥ 85) for ideal sleep parameters', () => {
    const { totalScore } = calculateSleepScore(perfectSleep);
    expect(totalScore).toBeGreaterThanOrEqual(85);
  });

  it('always returns a score between 0 and 100 inclusive', () => {
    const { totalScore } = calculateSleepScore(perfectSleep);
    expect(totalScore).toBeGreaterThanOrEqual(0);
    expect(totalScore).toBeLessThanOrEqual(100);
  });

  it('returns all seven expected component keys', () => {
    const { components } = calculateSleepScore(perfectSleep);
    const keys = ['totalSleep', 'efficiency', 'restfulness', 'remSleep', 'deepSleep', 'latency', 'timing'];
    keys.forEach(k => expect(components).toHaveProperty(k));
  });

  it('each component exposes a score and a weight', () => {
    const { components } = calculateSleepScore(perfectSleep);
    Object.values(components).forEach(c => {
      expect(c).toHaveProperty('score');
      expect(c).toHaveProperty('weight');
    });
  });

  it('penalises short sleep (< 6 h)', () => {
    const short = { ...perfectSleep, total_sleep_duration: 5 * 3600 };
    expect(calculateSleepScore(short).totalScore).toBeLessThan(calculateSleepScore(perfectSleep).totalScore);
  });

  it('penalises poor sleep efficiency', () => {
    const poor = { ...perfectSleep, efficiency: 50 };
    expect(calculateSleepScore(poor).totalScore).toBeLessThan(calculateSleepScore(perfectSleep).totalScore);
  });

  it('penalises long sleep latency (> 30 min)', () => {
    const slow = { ...perfectSleep, latency: 45 * 60 };
    expect(calculateSleepScore(slow).totalScore).toBeLessThan(calculateSleepScore(perfectSleep).totalScore);
  });

  it('penalises many restless periods', () => {
    // 1000 periods over 7.5 h → restlessnessRate = 1000/450 ≈ 2.22 → drops restfulness score well below 100
    const restless = { ...perfectSleep, restless_periods: 1000 };
    expect(calculateSleepScore(restless).totalScore).toBeLessThan(calculateSleepScore(perfectSleep).totalScore);
  });

  it('never returns a negative score even for very poor sleep', () => {
    const terrible = {
      ...perfectSleep,
      total_sleep_duration: 2 * 3600,
      efficiency: 10,
      restless_periods: 500,
      latency: 120 * 60,
    };
    expect(calculateSleepScore(terrible).totalScore).toBeGreaterThanOrEqual(0);
  });

  it('never exceeds 100 even for unrealistically good inputs', () => {
    const superSleep = { ...perfectSleep, efficiency: 100 };
    expect(calculateSleepScore(superSleep).totalScore).toBeLessThanOrEqual(100);
  });
});

describe('getSleepScoreColor', () => {
  it('returns green text for scores ≥ 85', () => {
    expect(getSleepScoreColor(100)).toBe('text-green-600');
    expect(getSleepScoreColor(85)).toBe('text-green-600');
  });

  it('returns yellow text for scores in 70–84', () => {
    expect(getSleepScoreColor(84)).toBe('text-yellow-600');
    expect(getSleepScoreColor(70)).toBe('text-yellow-600');
  });

  it('returns red text for scores below 70', () => {
    expect(getSleepScoreColor(69)).toBe('text-red-600');
    expect(getSleepScoreColor(0)).toBe('text-red-600');
  });
});

describe('getSleepScoreBgColor', () => {
  it('returns green background for scores ≥ 85', () => {
    expect(getSleepScoreBgColor(90)).toBe('bg-green-50');
  });

  it('returns yellow background for scores in 70–84', () => {
    expect(getSleepScoreBgColor(75)).toBe('bg-yellow-50');
  });

  it('returns red background for scores below 70', () => {
    expect(getSleepScoreBgColor(60)).toBe('bg-red-50');
  });
});
