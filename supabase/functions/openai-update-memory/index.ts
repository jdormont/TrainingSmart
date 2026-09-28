import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireArray, ValidationError } from "../_shared/validate.ts";

/*
 * STRAVA API COMPLIANCE - AI/ML Usage
 *
 * This edge function is COMPLIANT with Strava's API Terms section 2.6.
 *
 * COMPLIANCE DETAILS:
 * - Chat conversation data (which may reference Strava metrics) is analyzed
 * - Data is passed to the configured LLM provider for INFERENCE ONLY
 * - Used to merge new session facts into the user's persistent coach profile
 * - NO training, fine-tuning, or model improvement of any kind
 * - Data is processed in real-time and discarded after extraction
 *
 * See /STRAVA_COMPLIANCE.md for full documentation.
 */

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json().catch(() => { throw new ValidationError("Request body must be valid JSON"); });

    const messages = requireArray(body.messages, "messages", 200) as ChatMessage[];
    messages.forEach((msg, i) => {
      if (typeof msg?.role !== "string" || typeof msg?.content !== "string") {
        throw new ValidationError(`messages[${i}] must have string 'role' and 'content' fields`);
      }
    });

    const existingProfile = body.existingProfile ?? null;
    const rollup = body.rollup ?? null;
    const activeGoal = body.activeGoal ?? null;

    const conversationText = messages
      .map((m: ChatMessage) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
      .join("\n\n");

    const existingProfileText = existingProfile
      ? JSON.stringify(existingProfile, null, 2)
      : "(no existing profile — this is the first session being folded in)";

    const rollupText = rollup
      ? JSON.stringify(rollup, null, 2)
      : "(no recent training/recovery rollup available)";

    const activeGoalText = activeGoal
      ? JSON.stringify(activeGoal, null, 2)
      : "(no active goal set)";

    const mergePrompt = `You maintain a long-term profile about an athlete for their AI coach. Merge the new chat session below into the EXISTING PROFILE, producing an updated profile record.

EXISTING PROFILE (durable traits only — NOT goals):
${existingProfileText}

ACTIVE GOAL (read-only context — you may suggest narrow refinements to it, but you may NOT create, close, or retitle it):
${activeGoalText}

RECENT TRAINING/RECOVERY ROLLUP (supplementary signal, may be incomplete):
${rollupText}

NEW CHAT SESSION:
${conversationText}

Instructions:
1. Treat the NEW CHAT SESSION as authoritative when it contradicts EXISTING PROFILE (e.g. an injury that was open is now resolved). Drop facts that are no longer true.
2. This profile covers DURABLE traits only: physiology, equipment, standing training preferences, and recurring behavioral patterns. It does NOT include goals — goal creation and closure are handled by the athlete directly, not by you.
3. Only add to notablePatterns observations that are durable and likely to recur (e.g. "trains best in mornings", "leg fatigue when strength precedes long rides by <24h"). Do not add one-off observations here — use recentActivityNotes for those instead. The rollup's "notableFlags", when present, are system-observed behavioral signals (plan adherence, training-load/efficiency trends) computed from actual workout and activity data, not athlete self-report — treat a flag that recurs across sessions as strong evidence for a notablePattern even if the athlete never mentions it themselves.
4. Keep "narrative" to at most 150 words — a freeform paragraph a coach could read to quickly understand this athlete's durable traits.
5. Update confidenceScores (0-100) for "constraints" and "preferences" reflecting how explicit they are across BOTH the existing profile and this session.
6. recentActivityNotes: extract short, dated, one-off observations from this session (e.g. a segment PR, "felt strong on the climb today"). These are NOT durable patterns — they are transient notes that will automatically roll off after 30 days. Only include genuinely new observations from THIS session, not things already in the profile.
7. activeGoalPatch: if — and only if — the athlete explicitly refines a detail of their CURRENTLY ACTIVE goal in this session (e.g. "let's push the date back two weeks", "actually I want 5000ft of climbing not 4000"), return the specific field(s) that changed (targetDate, blockStartDate, blockEndDate, description). Otherwise return null. NEVER return a title or status change here — you do not have authority to create, rename, or close goals.
8. goalCompletionSuggested: if the conversation strongly implies the active goal is done (completed, abandoned, or clearly no longer relevant), return { "reason": "..." } explaining why. This is a SUGGESTION ONLY — the athlete must confirm it themselves in Settings. If there's no active goal or no clear signal, return null.
9. ftpReportSuggested: if the athlete mentions a specific FTP test result or a specific new FTP value in this session, return { "watts": number, "effectiveDate": "YYYY-MM-DD (best guess, use today if unspecified)", "note": "brief context" }. This is a SUGGESTION ONLY — never assume it's already recorded. If no FTP value is mentioned, return null.
10. Write a one-line "changeSummary" describing what changed in this update (for an audit log). If nothing meaningfully changed, say so explicitly.

Respond with ONLY valid JSON in this exact format:
{
  "profile": {
    "constraints": {
      "timeAvailability": "string or null",
      "equipment": ["item1"] or [],
      "injuries": ["limitation1"] or [],
      "other": ["other constraint"] or []
    },
    "preferences": {
      "workoutTypes": ["type1"] or [],
      "intensityPreference": "string or null",
      "trainingDays": [0, 2, 4] or []
    },
    "notablePatterns": [
      { "observation": "string", "firstNoted": "string (date or relative description)", "lastConfirmed": "string (date or relative description)" }
    ],
    "narrative": "freeform paragraph, <=150 words",
    "confidenceScores": { "constraints": 0, "preferences": 0 }
  },
  "recentActivityNotes": [
    { "note": "string", "noteDate": "YYYY-MM-DD" }
  ],
  "activeGoalPatch": { "targetDate": "YYYY-MM-DD", "blockStartDate": "YYYY-MM-DD", "blockEndDate": "YYYY-MM-DD", "description": "string" } or null (include only changed fields, or null entirely),
  "goalCompletionSuggested": { "reason": "string" } or null,
  "ftpReportSuggested": { "watts": 0, "effectiveDate": "YYYY-MM-DD", "note": "string" } or null,
  "changeSummary": "one-line description of what changed"
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

    const { content } = await callAI({
      systemPrompt: "You are an expert at maintaining structured long-term profile data about an athlete from coaching conversations. Respond only with valid JSON.",
      messages: [{ role: "user", content: mergePrompt }],
      temperature: 0.3,
      maxTokens: 1800,
      jsonMode: true,
    });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const merged = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify(merged),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Profile update error:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to update profile" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
