import { describe, it, expect } from 'vitest';
import { addDays } from 'date-fns';
import { parseWorkoutFile, mapToScheduledWorkouts, getSchemaTemplate } from './workoutImporter';
import type { RawImportWorkout } from './workoutImporter';

// Minimal valid workout object for reuse across tests
const baseWorkout = {
  name: 'Easy Ride',
  type: 'bike',
  duration: 60,
  intensity: 'easy',
};

describe('parseWorkoutFile', () => {
  // ── invalid input ──────────────────────────────────────────────

  it('returns an error for invalid JSON', () => {
    const result = parseWorkoutFile('not valid json {');
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toMatch(/Invalid JSON/);
    expect(result.hasExplicitDates).toBe(false);
  });

  it('returns an error when the root is a plain string', () => {
    const result = parseWorkoutFile('"just a string"');
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('returns an error when the root object has no workouts array', () => {
    const result = parseWorkoutFile(JSON.stringify({ foo: 'bar' }));
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  // ── valid root shapes ──────────────────────────────────────────

  it('parses a root JSON array of workouts', () => {
    const result = parseWorkoutFile(JSON.stringify([baseWorkout]));
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0].name).toBe('Easy Ride');
  });

  it('parses a { workouts: [...] } wrapped object', () => {
    const result = parseWorkoutFile(JSON.stringify({ workouts: [baseWorkout] }));
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('extracts plan metadata from a { plan: {...}, workouts: [...] } wrapper', () => {
    const json = JSON.stringify({
      plan: { title: 'Half-Marathon Build', goal: 'Sub 2h' },
      workouts: [baseWorkout],
    });
    const result = parseWorkoutFile(json);
    expect(result.importedPlan?.title).toBe('Half-Marathon Build');
    expect(result.importedPlan?.goal).toBe('Sub 2h');
  });

  it('falls back to title as goal when goal is omitted from plan', () => {
    const json = JSON.stringify({
      plan: { title: 'My Plan' },
      workouts: [baseWorkout],
    });
    const result = parseWorkoutFile(json);
    expect(result.importedPlan?.goal).toBe('My Plan');
  });

  // ── field validation ───────────────────────────────────────────

  it('reports an error when "name" (and "title") are missing', () => {
    const w = { type: 'bike', duration: 60, intensity: 'easy' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/name/i);
  });

  it('accepts "title" as an alias for "name"', () => {
    const w = { title: 'Long Run', type: 'run', duration: 90, intensity: 'easy' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid[0].name).toBe('Long Run');
  });

  it('rejects an unsupported activity type', () => {
    const w = { ...baseWorkout, type: 'sailing' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toMatch(/type/i);
  });

  it('rejects a workout with zero duration', () => {
    const w = { ...baseWorkout, duration: 0 };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toMatch(/duration/i);
  });

  it('rejects an unrecognised intensity without a known alias', () => {
    const w = { ...baseWorkout, intensity: 'extreme' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toMatch(/intensity/i);
  });

  // ── intensity normalisation aliases ───────────────────────────

  it.each([
    ['tempo', 'moderate'],
    ['medium', 'moderate'],
    ['zone2', 'easy'],
    ['aerobic', 'easy'],
    ['threshold', 'hard'],
    ['interval', 'hard'],
    ['race', 'hard'],
    ['rest', 'recovery'],
    ['light', 'recovery'],
  ])('normalises intensity alias "%s" → "%s"', (alias, expected) => {
    const w = { ...baseWorkout, intensity: alias };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid[0].intensity).toBe(expected);
  });

  // ── optional field aliases ─────────────────────────────────────

  it('accepts "duration_minutes" as an alias for "duration"', () => {
    const w = { name: 'Run', type: 'run', duration_minutes: 45, intensity: 'easy' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid[0].duration).toBe(45);
  });

  it('converts "distance_miles" to metres', () => {
    const w = { ...baseWorkout, distance_miles: 10 };
    const result = parseWorkoutFile(JSON.stringify([w]));
    // 10 miles × 1609.34 = 16093.4 → rounded
    expect(result.valid[0].distance).toBeCloseTo(16093, 0);
  });

  it('accepts metres directly via "distance"', () => {
    const w = { ...baseWorkout, distance: 5000 };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid[0].distance).toBe(5000);
  });

  // ── scheduled_date handling ────────────────────────────────────

  it('parses "scheduled_date" into a Date object', () => {
    const w = { ...baseWorkout, scheduled_date: '2026-06-01' };
    const result = parseWorkoutFile(JSON.stringify([w]));
    expect(result.valid[0].scheduledDate).toBeInstanceOf(Date);
    expect(result.valid[0].scheduledDate!.getFullYear()).toBe(2026);
    expect(result.valid[0].scheduledDate!.getMonth()).toBe(5); // June = 5
  });

  it('sets hasExplicitDates=true when every workout has a scheduled_date', () => {
    const items = [
      { ...baseWorkout, scheduled_date: '2026-06-01' },
      { ...baseWorkout, scheduled_date: '2026-06-02' },
    ];
    expect(parseWorkoutFile(JSON.stringify(items)).hasExplicitDates).toBe(true);
  });

  it('sets hasExplicitDates=false when any workout lacks scheduled_date', () => {
    const items = [
      { ...baseWorkout, scheduled_date: '2026-06-01' },
      { ...baseWorkout }, // no date
    ];
    expect(parseWorkoutFile(JSON.stringify(items)).hasExplicitDates).toBe(false);
  });

  // ── partial errors ─────────────────────────────────────────────

  it('continues parsing remaining items after a per-item error', () => {
    const items = [
      baseWorkout,
      { type: 'bike', duration: 60, intensity: 'easy' }, // missing name → error
      baseWorkout,
    ];
    const result = parseWorkoutFile(JSON.stringify(items));
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it('reports an error for a non-object item (e.g. a bare number)', () => {
    const result = parseWorkoutFile(JSON.stringify([baseWorkout, 42]));
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});

describe('mapToScheduledWorkouts', () => {
  const raw: RawImportWorkout = {
    name: 'Easy Ride',
    type: 'bike',
    duration: 60,
    intensity: 'easy',
  };

  it('uses an explicit scheduledDate from the workout when provided', () => {
    const explicitDate = new Date('2026-06-05T00:00:00');
    const [mapped] = mapToScheduledWorkouts([{ ...raw, scheduledDate: explicitDate }], new Date('2026-06-01'));
    expect(mapped.scheduledDate).toEqual(explicitDate);
  });

  it('falls back to startDate + dayOffset when no explicit date', () => {
    const startDate = new Date('2026-06-01');
    const [mapped] = mapToScheduledWorkouts([{ ...raw, dayOffset: 3 }], startDate);
    expect(mapped.scheduledDate).toEqual(addDays(startDate, 3));
  });

  it('uses the array index as the dayOffset fallback', () => {
    const startDate = new Date('2026-06-01');
    const [w0, w1] = mapToScheduledWorkouts([raw, raw], startDate);
    expect(w0.scheduledDate).toEqual(addDays(startDate, 0));
    expect(w1.scheduledDate).toEqual(addDays(startDate, 1));
  });

  it('defaults description to an empty string when absent', () => {
    const [mapped] = mapToScheduledWorkouts([raw], new Date());
    expect(mapped.description).toBe('');
  });

  it('preserves description when present', () => {
    const [mapped] = mapToScheduledWorkouts([{ ...raw, description: 'Zone 2 spin' }], new Date());
    expect(mapped.description).toBe('Zone 2 spin');
  });

  it('defaults distance to 0 when absent', () => {
    const [mapped] = mapToScheduledWorkouts([raw], new Date());
    expect(mapped.distance).toBe(0);
  });

  it('passes through activity_metadata when present', () => {
    const meta = { sets_reps: '3x10 squats' };
    const [mapped] = mapToScheduledWorkouts([{ ...raw, activity_metadata: meta }], new Date());
    expect(mapped.activity_metadata).toEqual(meta);
  });
});

describe('getSchemaTemplate', () => {
  it('returns an object with "plan" and "workouts" keys', () => {
    const schema = getSchemaTemplate();
    expect(schema).toHaveProperty('plan');
    expect(schema).toHaveProperty('workouts');
  });

  it('provides a workouts array with at least one example entry', () => {
    const { workouts } = getSchemaTemplate();
    expect(Array.isArray(workouts)).toBe(true);
    expect(workouts.length).toBeGreaterThan(0);
  });

  it('includes machine-readable instructions for LLM usage', () => {
    expect(getSchemaTemplate()._instructions).toBeTruthy();
  });
});
