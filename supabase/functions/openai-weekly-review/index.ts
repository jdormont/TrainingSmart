import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { optionalString, requireEnum, ValidationError } from "../_shared/validate.ts";
import { buildSystemPrompt, buildUserPrompt, sanitizeStats } from "./prompt.ts";

/*
 * STRAVA API COMPLIANCE - AI/ML Usage
 *
 * This edge function is COMPLIANT with Strava's API Terms section 2.6.
 *
 * - Receives ONLY aggregate weekly numbers (counts and minutes) computed by
 *   the client; no raw activity records, routes, streams or Strava IDs.
 * - Stats are passed through an allow-list (sanitizeStats) before reaching
 *   the model, so extra fields in the request body are dropped.
 * - Used for INFERENCE ONLY. No training, fine-tuning or model improvement.
 *
 * See /STRAVA_COMPLIANCE.md for full documentation.
 */

// Per-user-ish rate limiter keyed by bearer token (in-memory; resets on cold start).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const rateKey = req.headers.get("Authorization") ?? req.headers.get("x-forwarded-for") ?? "anon";
    if (!checkRateLimit(rateKey)) {
      return json(429, { error: "Too many requests. Please try again shortly." });
    }

    const body = await req.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON");
    });

    const fitnessMode = requireEnum(body.fitnessMode, "fitnessMode", ["performance", "re_engager"] as const);
    const coachingStyle = optionalString(body.coachingStyle, "coachingStyle", 50) ?? "supportive";
    const persona = optionalString(body.persona, "persona", 100);
    const customSystemPrompt = optionalString(body.customSystemPrompt, "customSystemPrompt", 4000);
    const weekLabel = optionalString(body.weekLabel, "weekLabel", 40);

    let stats;
    try {
      stats = sanitizeStats(body.stats);
    } catch (e) {
      throw new ValidationError(e instanceof Error ? e.message : "Invalid stats");
    }

    const review = await callAI({
      systemPrompt: buildSystemPrompt({ fitnessMode, coachingStyle, persona, customSystemPrompt }),
      messages: [{ role: "user", content: buildUserPrompt(stats, weekLabel) }],
      temperature: 0.6,
      maxTokens: 400,
    });

    return json(200, { review: review.trim() });
  } catch (error) {
    console.error("Weekly review error:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return json(status, { error: error instanceof Error ? error.message : "Failed to generate weekly review" });
  }
});
