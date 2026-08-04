import { describe, it, expect } from 'vitest';
import { computeGoalTiming } from './goalTiming';

const TODAY = new Date('2026-08-02T12:00:00');

describe('computeGoalTiming', () => {
  it('returns null for a null goal', () => {
    expect(computeGoalTiming(null, TODAY)).toBeNull();
  });

  it('returns null when the goal has no dates at all', () => {
    expect(computeGoalTiming({}, TODAY)).toBeNull();
  });

  it('computes "Week X of Y" from block start/end dates', () => {
    const timing = computeGoalTiming(
      { blockStartDate: '2026-06-01', blockEndDate: '2026-08-24' },
      TODAY,
    );
    expect(timing?.weekLabel).toBe('Week 9 of 13');
  });

  it('clamps the current week to the total when today is past the block end', () => {
    const timing = computeGoalTiming(
      { blockStartDate: '2026-01-01', blockEndDate: '2026-01-14' },
      TODAY,
    );
    expect(timing?.weekLabel).toBe('Week 2 of 2');
  });

  it('computes "targeting <date> — N days away" for a future target date', () => {
    const timing = computeGoalTiming({ targetDate: '2026-09-01' }, TODAY);
    expect(timing?.targetLabel).toBe('targeting Sep 1, 2026 — 30 days away');
  });

  it('computes "target date was N days ago" for a past target date', () => {
    const timing = computeGoalTiming({ targetDate: '2026-07-28' }, TODAY);
    expect(timing?.targetLabel).toBe('target date (Jul 28, 2026) was 5 days ago');
  });

  it('handles a target date of today', () => {
    const timing = computeGoalTiming({ targetDate: '2026-08-02' }, TODAY);
    expect(timing?.targetLabel).toBe('target date is today (Aug 2, 2026)');
  });

  it('falls back to blockEndDate for the target label when there is no targetDate', () => {
    const timing = computeGoalTiming(
      { blockStartDate: '2026-07-01', blockEndDate: '2026-08-30' },
      TODAY,
    );
    expect(timing?.targetLabel).toContain('block ends Aug 30, 2026');
  });

  it('combines week and target labels in the summary', () => {
    const timing = computeGoalTiming(
      { blockStartDate: '2026-06-01', blockEndDate: '2026-08-24', targetDate: '2026-08-24' },
      TODAY,
    );
    expect(timing?.summary).toBe(`${timing?.weekLabel} · ${timing?.targetLabel}`);
  });

  it('never produces stored relative-time text — always computed from the passed-in "today"', () => {
    const goal = { targetDate: '2026-09-01' };
    const earlier = computeGoalTiming(goal, new Date('2026-08-01'));
    const later = computeGoalTiming(goal, new Date('2026-08-15'));
    expect(earlier?.targetLabel).not.toEqual(later?.targetLabel);
  });
});
