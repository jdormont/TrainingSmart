import { supabase } from './supabaseClient';
import { calculateAdherence, type AdherenceWorkout } from './adherenceService';
import type { AdherenceStats, WeeklyReview } from '../types';

/**
 * Weekly review orchestration. No cron: the review for the last completed
 * Monday-Sunday week is generated lazily on the first app load after that
 * week ends, then cached in `weekly_reviews` (unique per user + week).
 *
 * The score is always computed here, deterministically. The LLM only writes
 * the text, from aggregate numbers (see openai-weekly-review).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ── Week math (pure, timezone-aware, string-based to avoid DST drift) ──────

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function localDateString(now: Date, timeZone?: string): string {
  const fmt = (tz?: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  try {
    return fmt(timeZone);
  } catch {
    return fmt(undefined); // invalid timezone string: fall back to the runtime zone
  }
}

function toUtcMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  return fromUtcMs(toUtcMs(dateStr) + days * DAY_MS);
}

/** Monday of the week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const dow = new Date(toUtcMs(dateStr)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return addDays(dateStr, -sinceMonday);
}

/** Monday of the most recent fully finished Monday-Sunday week. */
export function lastCompletedWeekStart(now: Date, timeZone?: string): string {
  return addDays(mondayOf(localDateString(now, timeZone)), -7);
}

/** The `count` most recent completed week starts, newest first. */
export function recentWeekStarts(now: Date, count: number, timeZone?: string): string[] {
  const latest = lastCompletedWeekStart(now, timeZone);
  return Array.from({ length: count }, (_, i) => addDays(latest, -7 * i));
}

// ── Row mapping ─────────────────────────────────────────────────────────────

interface ReviewRow {
  id: string;
  user_id: string;
  week_start: string;
  adherence_score: number | null;
  stats: AdherenceStats;
  review_text: string | null;
  created_at: string;
}

function rowToReview(row: ReviewRow): WeeklyReview {
  return {
    id: row.id,
    userId: row.user_id,
    weekStart: row.week_start,
    adherenceScore: row.adherence_score,
    stats: row.stats,
    reviewText: row.review_text,
    createdAt: row.created_at,
  };
}

interface WorkoutRow {
  scheduled_date: string;
  duration: number | null;
  status: string | null;
  completed: boolean | null;
  type: string | null;
  match_metadata: { moving_time?: number; type?: string } | null;
  activity_metadata: { rpe?: number } | null;
}

/** Map a workouts row to the calculator's input. Exported for testing. */
export function workoutRowToAdherence(row: WorkoutRow): AdherenceWorkout {
  const status: AdherenceWorkout['status'] =
    row.status === 'completed' || row.completed ? 'completed' : row.status === 'skipped' ? 'skipped' : 'planned';
  const movingSec = row.match_metadata?.moving_time;
  return {
    date: row.scheduled_date,
    duration: row.duration ?? 0,
    status,
    type: row.type ?? undefined,
    actualMinutes: typeof movingSec === 'number' && movingSec > 0 ? movingSec / 60 : null,
    actualType: row.match_metadata?.type ?? null,
    rpe: typeof row.activity_metadata?.rpe === 'number' ? row.activity_metadata.rpe : null,
  };
}

// ── Service ─────────────────────────────────────────────────────────────────

interface ReviewContext {
  fitnessMode: 'performance' | 're_engager';
  coachingStyle: string;
  persona?: string;
}

class WeeklyReviewService {
  private edgeUrl(): string {
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) throw new Error('Supabase URL not configured');
    return `${url}/functions/v1/openai-weekly-review`;
  }

  async getReview(userId: string, weekStart: string): Promise<WeeklyReview | null> {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToReview(data as ReviewRow) : null;
  }

  /** Reviews with the most recent week first. */
  async listReviews(userId: string, limit = 12): Promise<WeeklyReview[]> {
    const { data, error } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as ReviewRow[] | null)?.map(rowToReview) ?? [];
  }

  async computeStats(userId: string, weekStart: string): Promise<AdherenceStats> {
    const { data, error } = await supabase
      .from('workouts')
      .select('scheduled_date, duration, status, completed, type, match_metadata, activity_metadata')
      .eq('user_id', userId)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', addDays(weekStart, 6));
    if (error) throw error;
    return calculateAdherence({ workouts: ((data ?? []) as WorkoutRow[]).map(workoutRowToAdherence) });
  }

  /** Ask the Edge Function for the narrative. Sends aggregate numbers only. */
  async generateText(stats: AdherenceStats, ctx: ReviewContext, weekStart: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(this.edgeUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stats: {
          score: stats.score,
          workoutsPlanned: stats.workoutsPlanned,
          workoutsCompleted: stats.workoutsCompleted,
          workoutsSkipped: stats.workoutsSkipped,
          workoutsExcused: stats.workoutsExcused,
          plannedMinutes: stats.plannedMinutes,
          completedMinutes: stats.completedMinutes,
          avgRpe: stats.avgRpe ?? null,
        },
        fitnessMode: ctx.fitnessMode,
        coachingStyle: ctx.coachingStyle,
        persona: ctx.persona,
        weekLabel: weekStart,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to generate weekly review');
    }
    const { review } = await response.json();
    if (typeof review !== 'string' || !review.trim()) throw new Error('Empty weekly review');
    return review.trim();
  }

  /**
   * Return the review for `weekStart`, creating it if needed. Safe to call on
   * every load and from several tabs: the unique (user_id, week_start) key
   * plus ignoreDuplicates means at most one row is ever written.
   *
   * Returns null when nothing was scheduled that week (no card to show).
   * If text generation fails, the score row is still saved with a null
   * review_text and the text is retried on the next call.
   */
  async ensureReview(userId: string, weekStart: string, ctx: ReviewContext): Promise<WeeklyReview | null> {
    let existing = await this.getReview(userId, weekStart);

    if (!existing) {
      const stats = await this.computeStats(userId, weekStart);
      if (stats.workoutsPlanned === 0) return null;

      const { error } = await supabase
        .from('weekly_reviews')
        .upsert(
          { user_id: userId, week_start: weekStart, adherence_score: stats.score, stats },
          { onConflict: 'user_id,week_start', ignoreDuplicates: true },
        );
      if (error) throw error;

      // Re-read: if another tab won the race, we adopt its row instead of duplicating.
      existing = await this.getReview(userId, weekStart);
      if (!existing) return null;
    }

    if (existing.reviewText) return existing;

    try {
      const text = await this.generateText(existing.stats, ctx, weekStart);
      // Only fill in text that is still empty, so a concurrent winner is not overwritten.
      const { data, error } = await supabase
        .from('weekly_reviews')
        .update({ review_text: text })
        .eq('id', existing.id)
        .is('review_text', null)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data ? rowToReview(data as ReviewRow) : (await this.getReview(userId, weekStart)) ?? existing;
    } catch (err) {
      console.warn('Weekly review text generation failed; will retry on next load:', err);
      return existing;
    }
  }
}

export const weeklyReviewService = new WeeklyReviewService();
