import { addDays } from 'date-fns';
import type { ActivityType } from '../types';

export interface RawImportWorkout {
  name: string;
  type: string;
  duration: number;
  intensity: string;
  /** Explicit date from the file — used directly, bypasses dayOffset/index logic */
  scheduledDate?: Date;
  dayOffset?: number;
  description?: string;
  distance?: number; // meters
  activity_metadata?: Record<string, unknown>;
}

export interface ImportedPlanMeta {
  title: string;
  goal: string;
  description?: string;
  eventDate?: Date;
  durationWeeks?: number;
}

export interface ParseResult {
  valid: RawImportWorkout[];
  errors: string[];
  /** True when every valid workout carries an explicit scheduledDate from the file */
  hasExplicitDates: boolean;
  /** Present when the JSON root had a "plan" wrapper object */
  importedPlan?: ImportedPlanMeta;
}

export interface MappedWorkout {
  name: string;
  type: string;
  description: string;
  duration: number;
  distance: number;
  intensity: string;
  scheduledDate: Date;
  activity_metadata?: Record<string, unknown>;
}

const VALID_TYPES: ActivityType[] = ['run', 'bike', 'swim', 'strength', 'rest', 'yoga', 'hiking'];
const VALID_INTENSITIES = ['easy', 'moderate', 'hard', 'recovery'];

function sanitizeIntensity(value: string): string | null {
  const normalized = value?.toLowerCase().trim();
  if (VALID_INTENSITIES.includes(normalized)) return normalized;
  if (normalized === 'rest' || normalized === 'light') return 'recovery';
  if (normalized === 'medium' || normalized === 'tempo') return 'moderate';
  if (normalized === 'zone2' || normalized === 'aerobic') return 'easy';
  if (normalized === 'threshold' || normalized === 'interval' || normalized === 'race') return 'hard';
  return null;
}

/**
 * Extract the workouts array and optional plan metadata.
 * Handles:
 *   - Root array:  [ { ...workout }, ... ]
 *   - Wrapped:     { "plan": {...}, "workouts": [ ... ] }
 *                  { "workouts": [ ... ] }
 */
function extractWorkoutsArray(parsed: unknown): { items: unknown[] | string; planMeta?: ImportedPlanMeta } {
  if (Array.isArray(parsed)) return { items: parsed };

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.workouts)) {
      let planMeta: ImportedPlanMeta | undefined;
      if (obj.plan && typeof obj.plan === 'object') {
        const p = obj.plan as Record<string, unknown>;
        const title = typeof p.title === 'string' ? p.title.trim() : '';
        const goal = typeof p.goal === 'string' ? p.goal.trim() : '';
        if (title) {
          planMeta = {
            title,
            goal: goal || title,
            description: typeof p.description === 'string' ? p.description : undefined,
            durationWeeks: typeof p.duration_weeks === 'number' ? p.duration_weeks : undefined,
            eventDate:
              typeof p.event_date === 'string'
                ? (() => { const d = new Date(p.event_date as string + 'T00:00:00'); return isNaN(d.getTime()) ? undefined : d; })()
                : undefined,
          };
        }
      }
      return { items: obj.workouts, planMeta };
    }
  }

  return { items: 'Root must be a JSON array, or an object with a "workouts" array.' };
}

export function parseWorkoutFile(jsonText: string): ParseResult {
  const valid: RawImportWorkout[] = [];
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { valid: [], errors: [`Invalid JSON: ${(e as Error).message}`], hasExplicitDates: false };
  }

  const { items, planMeta } = extractWorkoutsArray(parsed);
  if (typeof items === 'string') {
    return { valid: [], errors: [items], hasExplicitDates: false };
  }

  items.forEach((item: unknown, i: number) => {
    const idx = `Item ${i + 1}`;
    const itemErrors: string[] = [];

    if (typeof item !== 'object' || item === null) {
      errors.push(`${idx}: must be an object.`);
      return;
    }

    const w = item as Record<string, unknown>;

    // ── name: accept "name" or "title" ──
    const rawName = w.name ?? w.title;
    if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
      itemErrors.push('missing or empty "name" (or "title")');
    }

    // ── type ──
    const rawType = typeof w.type === 'string' ? w.type.toLowerCase().trim() : '';
    if (!VALID_TYPES.includes(rawType as ActivityType)) {
      itemErrors.push(`"type" must be one of: ${VALID_TYPES.join(', ')} (got "${w.type}")`);
    }

    // ── duration: accept "duration" or "duration_minutes" ──
    const rawDuration = w.duration ?? w.duration_minutes;
    const duration = Number(rawDuration);
    if (!rawDuration || isNaN(duration) || duration <= 0) {
      itemErrors.push('"duration" (or "duration_minutes") must be a positive number');
    }

    // ── intensity ──
    const rawIntensity = typeof w.intensity === 'string' ? w.intensity : '';
    const sanitized = sanitizeIntensity(rawIntensity);
    if (!sanitized) {
      itemErrors.push(`"intensity" must be one of: ${VALID_INTENSITIES.join(', ')} (got "${w.intensity}")`);
    }

    if (itemErrors.length > 0) {
      errors.push(`${idx} (${rawName ?? 'unnamed'}): ${itemErrors.join('; ')}`);
      return;
    }

    // ── distance: accept "distance" (meters) or "distance_miles" (convert) ──
    let distance: number | undefined;
    if (typeof w.distance === 'number') {
      distance = w.distance;
    } else if (typeof w.distance_miles === 'number') {
      distance = Math.round(w.distance_miles * 1609.34);
    }

    // ── scheduled_date → explicit Date ──
    let scheduledDate: Date | undefined;
    if (typeof w.scheduled_date === 'string' && w.scheduled_date) {
      const d = new Date(w.scheduled_date + 'T00:00:00');
      if (!isNaN(d.getTime())) scheduledDate = d;
    }

    valid.push({
      name: (rawName as string).trim(),
      type: rawType,
      duration,
      intensity: sanitized!,
      scheduledDate,
      dayOffset: typeof w.dayOffset === 'number' ? w.dayOffset : undefined,
      description: typeof w.description === 'string' ? w.description : undefined,
      distance,
      activity_metadata:
        w.activity_metadata && typeof w.activity_metadata === 'object' && !Array.isArray(w.activity_metadata)
          ? (w.activity_metadata as Record<string, unknown>)
          : undefined,
    });
  });

  const hasExplicitDates = valid.length > 0 && valid.every(w => w.scheduledDate !== undefined);

  return { valid, errors, hasExplicitDates, importedPlan: planMeta };
}

/**
 * Map validated workouts to fully-resolved MappedWorkouts.
 * - If a workout has an explicit `scheduledDate` from the file, use it as-is.
 * - Otherwise fall back to startDate + dayOffset (or array index).
 */
export function mapToScheduledWorkouts(valid: RawImportWorkout[], startDate: Date): MappedWorkout[] {
  return valid.map((w, i) => ({
    name: w.name,
    type: w.type,
    description: w.description ?? '',
    duration: w.duration,
    distance: w.distance ?? 0,
    intensity: w.intensity,
    scheduledDate: w.scheduledDate ?? addDays(startDate, w.dayOffset ?? i),
    activity_metadata: w.activity_metadata,
  }));
}

/**
 * Returns a fully-annotated schema template object.
 * Designed to be pasted into an LLM prompt so it can generate
 * a conforming plan JSON that TrainingSmart can import.
 */
export function getSchemaTemplate() {
  return {
    _instructions:
      'Generate a training plan following this exact JSON structure. ' +
      'Populate "plan" with the athlete\'s details and fill "workouts" with the full schedule. ' +
      'Remove all fields that start with "_" from your output before returning. ' +
      'Every workout must have title, type, intensity, duration_minutes, and scheduled_date.',
    plan: {
      _notes: 'All plan fields except title and goal are optional but recommended.',
      title: 'Example: 10-Week Half Marathon Build',
      goal: 'Example: Complete a half marathon in under 2 hours',
      goal_type: 'endurance | strength | general_fitness',
      event_date: 'YYYY-MM-DD — the target race or event date',
      duration_weeks: 10,
      weekly_hours: 6,
      fitness_mode: 'performance | re_engager',
      description:
        'A brief narrative describing the plan structure, phases, and key focus areas.',
      focus_areas: ['endurance', 'speed', 'climbing', 'strength', 'mobility'],
      activity_mix: [
        { type: 'run', priority: 1, sessions_per_week: 4 },
        { type: 'strength', priority: 2, sessions_per_week: 1 },
      ],
      plan_logic: {
        fitness_assessment: 'Brief assessment of the athlete\'s current fitness level.',
        season_strategy:
          'High-level periodisation narrative, e.g. "Base → Build → Peak → Taper".',
        weekly_focus_breakdown: {
          '1': 'Aerobic base — easy volume, establish routine',
          '5': 'Build — introduce threshold work',
          '9': 'Peak — race-specific intensity',
          '10': 'Taper — reduce volume, maintain sharpness',
        },
      },
    },
    workouts: [
      {
        _notes:
          'Required: title (or name), type, intensity, duration_minutes, scheduled_date. ' +
          'Optional: description, distance_miles, week_number, day_of_week, activity_metadata.',
        week_number: 1,
        day_of_week: 2,
        scheduled_date: 'YYYY-MM-DD',
        title: 'Easy Endurance Run',
        description: 'Conversational-pace run. Stay in Zone 2 the entire time.',
        type: 'run | bike | swim | strength | rest | yoga | hiking',
        intensity: 'easy | moderate | hard | recovery',
        duration_minutes: 45,
        distance_miles: 5.0,
      },
      {
        week_number: 1,
        day_of_week: 4,
        scheduled_date: 'YYYY-MM-DD',
        title: 'Lower Body Strength',
        description: 'Cycling-specific gym session.',
        type: 'strength',
        intensity: 'moderate',
        duration_minutes: 45,
        activity_metadata: {
          sets_reps: '3x10 squats, 3x8 single-leg press, 2x15 calf raises',
        },
      },
      {
        week_number: 1,
        day_of_week: 6,
        scheduled_date: 'YYYY-MM-DD',
        title: 'Long Ride',
        description: 'Aerobic long effort. Keep heart rate in Zone 2–3.',
        type: 'bike',
        intensity: 'moderate',
        duration_minutes: 90,
        distance_miles: 30.0,
      },
    ],
  };
}

/** Triggers a browser download of the schema template as a .json file. */
export function downloadSchemaTemplate() {
  const schema = getSchemaTemplate();
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trainingsmart-plan-schema.json';
  a.click();
  URL.revokeObjectURL(url);
}
