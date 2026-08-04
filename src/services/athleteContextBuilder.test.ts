import { describe, it, expect } from 'vitest';
import { buildAthleteMemoryBlock } from './athleteContextBuilder';
import type { AthleteMemoryContext, Goal } from '../types';

const TODAY = new Date('2026-08-02T12:00:00');

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    userId: 'user-1',
    status: 'active',
    title: 'Untitled Goal',
    successCriteria: [],
    source: 'manual',
    sourceSessionIds: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeMemory(overrides: Partial<AthleteMemoryContext> = {}): AthleteMemoryContext {
  return {
    profile: null,
    activeGoal: null,
    goalHistory: [],
    currentFtp: null,
    powerCurve: null,
    recentNotes: [],
    ...overrides,
  };
}

describe('buildAthleteMemoryBlock', () => {
  it('returns an empty string when there is no memory and no fallback FTP', () => {
    expect(buildAthleteMemoryBlock(null, TODAY)).toBe('');
    expect(buildAthleteMemoryBlock(undefined, TODAY)).toBe('');
  });

  it('THE BUG FIX: a closed goal is placed only under "Past goals" and never under an active/current heading', () => {
    const closedEnglandTrip = makeGoal({
      id: 'goal-england',
      title: 'Eden Valley & North Pennines cycling trip',
      status: 'completed',
      closedAt: new Date('2026-08-03'),
      closedReason: 'Completed 245mi/18,360ft over 4 days, all days finished',
    });
    const activeCentury = makeGoal({
      id: 'goal-century',
      title: '100mi century with 4k elevation',
      status: 'active',
      targetDate: '2026-09-22',
    });

    const block = buildAthleteMemoryBlock(
      makeMemory({ activeGoal: activeCentury, goalHistory: [closedEnglandTrip] }),
      TODAY,
    );

    // The closed goal appears exactly once, under the background-only heading.
    const pastGoalsHeadingIndex = block.indexOf('PAST GOALS');
    const activeGoalHeadingIndex = block.indexOf('ACTIVE GOAL');
    const englandTripIndex = block.indexOf('Eden Valley & North Pennines cycling trip');

    expect(pastGoalsHeadingIndex).toBeGreaterThan(-1);
    expect(activeGoalHeadingIndex).toBeGreaterThan(-1);
    expect(englandTripIndex).toBeGreaterThan(pastGoalsHeadingIndex);

    // It never appears inside the ACTIVE GOAL section (which ends where PAST GOALS begins).
    const activeGoalSection = block.slice(activeGoalHeadingIndex, pastGoalsHeadingIndex);
    expect(activeGoalSection).not.toContain('Eden Valley');

    // The active goal (century) is the one rendered under ACTIVE GOAL.
    expect(activeGoalSection).toContain('100mi century with 4k elevation');

    // The heading explicitly instructs the model never to treat history as current.
    expect(block).toContain('background only, NOT current focus');
    expect(block).toContain('Never refer to these as ongoing, upcoming, or current');
  });

  it('omits the ACTIVE GOAL section entirely when there is no active goal', () => {
    const block = buildAthleteMemoryBlock(makeMemory({ activeGoal: null }), TODAY);
    expect(block).not.toContain('ACTIVE GOAL');
  });

  it('omits the PAST GOALS section entirely when goal history is empty', () => {
    const block = buildAthleteMemoryBlock(makeMemory({ goalHistory: [] }), TODAY);
    expect(block).not.toContain('PAST GOALS');
  });

  it('caps goal history display to the most recent 3 entries', () => {
    const history = Array.from({ length: 5 }, (_, i) =>
      makeGoal({ id: `goal-${i}`, title: `Goal ${i}`, status: 'completed', closedAt: new Date('2026-01-01') }),
    );
    const block = buildAthleteMemoryBlock(makeMemory({ goalHistory: history }), TODAY);
    expect(block).toContain('Goal 0');
    expect(block).toContain('Goal 1');
    expect(block).toContain('Goal 2');
    expect(block).not.toContain('Goal 3');
    expect(block).not.toContain('Goal 4');
  });

  it('computes relative-time phrasing live rather than reading stored text', () => {
    const goal = makeGoal({ targetDate: '2026-09-01' });
    const blockEarlier = buildAthleteMemoryBlock(makeMemory({ activeGoal: goal }), new Date('2026-08-01'));
    const blockLater = buildAthleteMemoryBlock(makeMemory({ activeGoal: goal }), new Date('2026-08-15'));
    expect(blockEarlier).not.toEqual(blockLater);
  });

  it('renders current FTP from ftp_history, preferring it over the legacy fallback scalar', () => {
    const block = buildAthleteMemoryBlock(
      makeMemory({
        currentFtp: { id: 'ftp-1', ftpWatts: 210, effectiveDate: '2026-06-19', source: 'zwift_test', confidence: 'confirmed', createdAt: new Date() },
      }),
      TODAY,
      235, // legacy user_profiles.ftp fallback — should be ignored since history exists
    );
    expect(block).toContain('210w');
    expect(block).not.toContain('235w');
  });

  it('falls back to the legacy FTP scalar only when no ftp_history entry exists', () => {
    const block = buildAthleteMemoryBlock(makeMemory({ currentFtp: null }), TODAY, 235);
    expect(block).toContain('235w');
  });

  it('renders profile narrative, constraints, preferences, and notable patterns', () => {
    const block = buildAthleteMemoryBlock(
      makeMemory({
        profile: {
          userId: 'user-1',
          constraints: { injuries: ['left knee'] },
          preferences: { workoutTypes: ['endurance'] },
          notablePatterns: [{ observation: 'trains best in mornings', firstNoted: '2026-01-01', lastConfirmed: '2026-07-01' }],
          narrative: 'Consistent rider focused on long endurance rides.',
          confidenceScores: { constraints: 80, preferences: 70 },
          sourceSessionIds: [],
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      }),
      TODAY,
    );
    expect(block).toContain('Consistent rider focused on long endurance rides.');
    expect(block).toContain('left knee');
    expect(block).toContain('endurance');
    expect(block).toContain('trains best in mornings');
  });

  it('renders recent activity notes with their dates', () => {
    const block = buildAthleteMemoryBlock(
      makeMemory({ recentNotes: [{ id: 'n1', note: 'New segment PR on the climb', noteDate: '2026-08-01', source: 'chat', createdAt: new Date() }] }),
      TODAY,
    );
    expect(block).toContain('New segment PR on the climb');
  });

  it('renders a power curve summary when present', () => {
    const block = buildAthleteMemoryBlock(
      makeMemory({ powerCurve: { windowDays: 90, curve: { '5s': 850, '1m': 320, '5m': 260, '20m': 235, '60m': 210 }, activityCount: 12 } }),
      TODAY,
    );
    expect(block).toContain('20m: 235W');
  });
});
