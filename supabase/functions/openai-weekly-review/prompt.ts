/**
 * Pure helpers for openai-weekly-review: payload sanitising and prompt
 * building. No Deno or network APIs, so they are unit-testable anywhere.
 *
 * The LLM only narrates numbers computed client-side (adherenceService).
 * Only an allow-list of aggregate numeric fields is ever forwarded, so raw
 * activity data (Strava or otherwise) cannot reach the model through this
 * endpoint (see STRAVA_COMPLIANCE.md).
 */

export type FitnessMode = "performance" | "re_engager";

export interface SanitizedStats {
  score: number | null;
  workoutsPlanned: number;
  workoutsCompleted: number;
  workoutsSkipped: number;
  workoutsExcused: number;
  plannedMinutes: number;
  completedMinutes: number;
  avgRpe: number | null;
}

const NUMERIC_FIELDS = [
  "workoutsPlanned",
  "workoutsCompleted",
  "workoutsSkipped",
  "workoutsExcused",
  "plannedMinutes",
  "completedMinutes",
] as const;

function boundedNumber(val: unknown, field: string, min: number, max: number): number {
  if (typeof val !== "number" || Number.isNaN(val) || val < min || val > max) {
    throw new Error(`'stats.${field}' must be a number between ${min} and ${max}`);
  }
  return val;
}

/** Copy only the allow-listed aggregate fields; throws on malformed values. */
export function sanitizeStats(raw: unknown): SanitizedStats {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("'stats' must be an object");
  }
  const r = raw as Record<string, unknown>;

  let score: number | null = null;
  if (r.score !== null && r.score !== undefined) {
    score = boundedNumber(r.score, "score", 0, 100);
  }

  const out: Record<string, number> = {};
  for (const f of NUMERIC_FIELDS) {
    out[f] = boundedNumber(r[f], f, 0, 100_000);
  }

  let avgRpe: number | null = null;
  if (r.avgRpe !== null && r.avgRpe !== undefined) {
    avgRpe = boundedNumber(r.avgRpe, "avgRpe", 1, 5);
  }

  return { score, avgRpe, ...(out as Omit<SanitizedStats, "score" | "avgRpe">) };
}

const STYLE_GUIDANCE: Record<string, string> = {
  supportive: "Warm, encouraging and gentle.",
  analytical: "Calm, precise and data-aware, but still kind.",
  direct: "Plain, brief and straightforward, but never harsh.",
  drill_sergeant: "Plain, brief and straightforward, but never harsh.",
};

export function buildSystemPrompt(opts: {
  fitnessMode: FitnessMode;
  coachingStyle: string;
  persona?: string;
  customSystemPrompt?: string;
}): string {
  const style = STYLE_GUIDANCE[opts.coachingStyle] ?? STYLE_GUIDANCE.supportive;

  const modeRules = opts.fitnessMode === "re_engager"
    ? [
      "The athlete is rebuilding a habit. Use plain, everyday language.",
      "NEVER mention TSS, CTL, ATL, TSB, FTP, training load, power zones, heart-rate zones or any other jargon.",
      "Celebrate showing up. Frame the suggestion as one small, easy step.",
    ]
    : [
      "The athlete is performance-minded. You may refer to training load and consistency, but do not invent numbers that are not provided.",
    ];

  return [
    "You are a training coach writing a short weekly recap for one athlete.",
    opts.persona ? `Coach persona: ${opts.persona}.` : "",
    `Voice: ${style}`,
    ...modeRules,
    "",
    "Format: roughly 120 words (never more than 150), in 3 short parts, no headings, no bullet points, no emojis:",
    "1. One genuine win from the week.",
    "2. One honest, kind observation.",
    "3. One concrete suggested adjustment for next week.",
    "",
    "Rules:",
    "- Use ONLY the numbers provided. Do not calculate, estimate or invent any figures.",
    "- NEVER shame, guilt or scold. Do not use words like lazy, failed, failure, behind, slacking, excuses, or disappointing.",
    "- Never imply the athlete should have done more. Missed workouts are information, not a verdict.",
    "- If nothing was completed, be warm and encouraging, do not mention the score, and suggest one tiny restart step.",
    "- If no workouts were planned, say it was a rest week and look ahead.",
    opts.customSystemPrompt?.trim()
      ? `\nThe athlete's own coaching preferences (follow them unless they conflict with the rules above):\n${opts.customSystemPrompt.trim().slice(0, 2000)}`
      : "",
  ].filter((line) => line !== "").join("\n");
}

export function buildUserPrompt(stats: SanitizedStats, weekLabel?: string): string {
  const lines: string[] = [
    `Week${weekLabel ? ` of ${weekLabel}` : ""} summary (computed by the app):`,
    `- Workouts planned: ${stats.workoutsPlanned}`,
    `- Workouts completed: ${stats.workoutsCompleted}`,
    `- Workouts skipped: ${stats.workoutsSkipped}`,
    `- Minutes planned: ${stats.plannedMinutes}`,
    `- Minutes completed: ${stats.completedMinutes}`,
  ];
  if (stats.workoutsExcused > 0) lines.push(`- Days excused (not counted): ${stats.workoutsExcused}`);
  if (stats.avgRpe !== null) lines.push(`- Average effort rating: ${stats.avgRpe} (1 = easy, 3 = as planned, 5 = tough)`);

  if (stats.workoutsPlanned === 0) {
    lines.push("- There were no planned workouts this week.");
  } else if (stats.workoutsCompleted === 0) {
    lines.push("- Nothing was completed this week.");
  } else if (stats.score !== null) {
    lines.push(`- Adherence score: ${stats.score} out of 100`);
  }
  lines.push("", "Write the recap now.");
  return lines.join("\n");
}
