import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal in-memory Supabase fake (just enough for weekly_reviews + workouts) ──
type Row = Record<string, any>;
const db: { weekly_reviews: Row[]; workouts: Row[] } = { weekly_reviews: [], workouts: [] };
let idCounter = 0;

function makeQuery(table: keyof typeof db) {
  const filters: Array<(r: Row) => boolean> = [];
  let op: 'select' | 'upsert' | 'update' = 'select';
  let payload: Row = {};
  let ignoreDuplicates = false;
  let orderCol: string | null = null;
  let limitN = Infinity;

  const run = (): Row[] => {
    if (op === 'upsert') {
      const exists = db[table].some(r => r.user_id === payload.user_id && r.week_start === payload.week_start);
      if (!exists) db[table].push({ id: `rev-${++idCounter}`, review_text: null, created_at: 'now', ...payload });
      else if (!ignoreDuplicates) Object.assign(db[table].find(r => r.user_id === payload.user_id && r.week_start === payload.week_start)!, payload);
      return [];
    }
    let rows = db[table].filter(r => filters.every(f => f(r)));
    if (op === 'update') rows.forEach(r => Object.assign(r, payload));
    if (orderCol) rows = [...rows].sort((a, b) => (a[orderCol!] < b[orderCol!] ? 1 : -1));
    return rows.slice(0, limitN);
  };

  const q: any = {
    select: () => q,
    upsert: (p: Row, opts: any) => { op = 'upsert'; payload = p; ignoreDuplicates = !!opts?.ignoreDuplicates; return q; },
    update: (p: Row) => { op = 'update'; payload = p; return q; },
    eq: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
    gte: (c: string, v: string) => { filters.push(r => r[c] >= v); return q; },
    lte: (c: string, v: string) => { filters.push(r => r[c] <= v); return q; },
    is: (c: string, v: unknown) => { filters.push(r => r[c] === v); return q; },
    order: (c: string) => { orderCol = c; return q; },
    limit: (n: number) => { limitN = n; return q; },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    then: (resolve: any) => resolve({ data: run(), error: null }),
  };
  return q;
}

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn((t: keyof typeof db) => makeQuery(t)),
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

import {
  addDays,
  lastCompletedWeekStart,
  mondayOf,
  recentWeekStarts,
  weeklyReviewService,
  workoutRowToAdherence,
} from './weeklyReviewService';

const ctx = { fitnessMode: 're_engager' as const, coachingStyle: 'supportive' };
const WEEK = '2026-11-09'; // a Monday

const workout = (over: Row = {}): Row => ({
  user_id: 'u1',
  scheduled_date: WEEK,
  duration: 60,
  status: 'completed',
  completed: true,
  type: 'bike',
  match_metadata: null,
  activity_metadata: null,
  ...over,
});

beforeEach(() => {
  db.weekly_reviews = [];
  db.workouts = [];
  idCounter = 0;
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ review: 'Nice week.' }) });
});

describe('week math', () => {
  it('finds Monday for any day of the week', () => {
    expect(mondayOf('2026-11-09')).toBe('2026-11-09'); // Monday
    expect(mondayOf('2026-11-15')).toBe('2026-11-09'); // Sunday
    expect(mondayOf('2026-11-12')).toBe('2026-11-09'); // Thursday
  });

  it('adds days across month and DST boundaries', () => {
    expect(addDays('2026-10-26', 7)).toBe('2026-11-02');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('returns the previous Monday-Sunday week once a week has ended', () => {
    // Monday 2026-11-16 12:00 UTC -> last completed week started 2026-11-09
    expect(lastCompletedWeekStart(new Date('2026-11-16T12:00:00Z'), 'UTC')).toBe('2026-11-09');
    // Sunday 2026-11-15 is still inside the week that started 2026-11-09
    expect(lastCompletedWeekStart(new Date('2026-11-15T12:00:00Z'), 'UTC')).toBe('2026-11-02');
  });

  it('respects the user timezone at the week boundary', () => {
    // 02:00 UTC Monday is still Sunday evening in Los Angeles
    const now = new Date('2026-11-16T02:00:00Z');
    expect(lastCompletedWeekStart(now, 'UTC')).toBe('2026-11-09');
    expect(lastCompletedWeekStart(now, 'America/Los_Angeles')).toBe('2026-11-02');
  });

  it('falls back gracefully on an invalid timezone', () => {
    expect(lastCompletedWeekStart(new Date('2026-11-16T12:00:00Z'), 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('lists recent weeks newest first', () => {
    expect(recentWeekStarts(new Date('2026-11-16T12:00:00Z'), 3, 'UTC')).toEqual(['2026-11-09', '2026-11-02', '2026-10-26']);
  });
});

describe('workoutRowToAdherence', () => {
  it('uses Strava moving time (seconds) as actual minutes and reads RPE from activity_metadata', () => {
    const w = workoutRowToAdherence(workout({
      match_metadata: { moving_time: 2700, type: 'Ride' },
      activity_metadata: { rpe: 3 },
    }) as any);
    expect(w.actualMinutes).toBe(45);
    expect(w.actualType).toBe('Ride');
    expect(w.rpe).toBe(3);
    expect(w.status).toBe('completed');
  });

  it('falls back to planned duration (no actual minutes) when unmatched', () => {
    expect(workoutRowToAdherence(workout() as any).actualMinutes).toBeNull();
  });

  it('treats a legacy completed=true row as completed', () => {
    expect(workoutRowToAdherence(workout({ status: null, completed: true }) as any).status).toBe('completed');
  });
});

describe('ensureReview', () => {
  it('creates the review once and caches it', async () => {
    db.workouts = [workout(), workout({ scheduled_date: '2026-11-11', status: 'skipped', completed: false })];

    const first = await weeklyReviewService.ensureReview('u1', WEEK, ctx);
    expect(first?.adherenceScore).toBe(50);
    expect(first?.reviewText).toBe('Nice week.');
    expect(db.weekly_reviews).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Reload: no duplicate row, no second LLM call.
    const second = await weeklyReviewService.ensureReview('u1', WEEK, ctx);
    expect(second?.id).toBe(first?.id);
    expect(db.weekly_reviews).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate when two tabs race', async () => {
    db.workouts = [workout()];
    const [a, b] = await Promise.all([
      weeklyReviewService.ensureReview('u1', WEEK, ctx),
      weeklyReviewService.ensureReview('u1', WEEK, ctx),
    ]);
    expect(db.weekly_reviews).toHaveLength(1);
    expect(a?.id).toBe(b?.id);
  });

  it('returns null and writes nothing for a week with no scheduled workouts', async () => {
    expect(await weeklyReviewService.ensureReview('u1', WEEK, ctx)).toBeNull();
    expect(db.weekly_reviews).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the score and retries the text later when generation fails', async () => {
    db.workouts = [workout()];
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'boom' }) });

    const first = await weeklyReviewService.ensureReview('u1', WEEK, ctx);
    expect(first?.adherenceScore).toBe(100);
    expect(first?.reviewText).toBeNull();
    expect(db.weekly_reviews).toHaveLength(1);

    const retry = await weeklyReviewService.ensureReview('u1', WEEK, ctx);
    expect(retry?.reviewText).toBe('Nice week.');
    expect(db.weekly_reviews).toHaveLength(1);
  });

  it('stores a null score (not 0) when every workout was excused/none counted', async () => {
    db.workouts = [workout({ duration: 0 })];
    const r = await weeklyReviewService.ensureReview('u1', WEEK, ctx);
    expect(r?.adherenceScore).toBeNull();
  });

  it('sends only aggregate numbers to the Edge Function', async () => {
    db.workouts = [workout({
      match_metadata: { moving_time: 3600, type: 'Ride', id: 987654321, name: 'Morning Ride', polyline: 'abc' },
      activity_metadata: { rpe: 3 },
    })];
    await weeklyReviewService.ensureReview('u1', WEEK, ctx);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(Object.keys(body.stats).sort()).toEqual([
      'avgRpe', 'completedMinutes', 'plannedMinutes', 'score',
      'workoutsCompleted', 'workoutsExcused', 'workoutsPlanned', 'workoutsSkipped',
    ]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('987654321');
    expect(serialized).not.toContain('Morning Ride');
    expect(serialized).not.toContain('polyline');
  });

  it("never reads another user's workouts or reviews", async () => {
    db.workouts = [workout({ user_id: 'someone-else' })];
    db.weekly_reviews = [{ id: 'x', user_id: 'someone-else', week_start: WEEK, adherence_score: 90, stats: {}, review_text: 't', created_at: 'now' }];
    expect(await weeklyReviewService.getReview('u1', WEEK)).toBeNull();
    expect(await weeklyReviewService.ensureReview('u1', WEEK, ctx)).toBeNull();
    expect(await weeklyReviewService.listReviews('u1')).toEqual([]);
  });
});
