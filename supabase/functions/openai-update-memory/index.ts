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
 * - Used to merge new session facts into the user's persistent coach memory
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

    const existingMemory = body.existingMemory ?? null;
    const rollup = body.rollup ?? null;

    const conversationText = messages
      .map((m: ChatMessage) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
      .join("\n\n");

    const existingMemoryText = existingMemory
      ? JSON.stringify(existingMemory, null, 2)
      : "(no existing memory — this is the first session being folded in)";

    const rollupText = rollup
      ? JSON.stringify(rollup, null, 2)
      : "(no recent training/recovery rollup available)";

    const mergePrompt = `You maintain a long-term memory record about an athlete for their AI coach. Merge the new chat session below into the EXISTING MEMORY, producing an updated memory record.

EXISTING MEMORY:
${existingMemoryText}

RECENT TRAINING/RECOVERY ROLLUP (supplementary signal, may be incomplete):
${rollupText}

NEW CHAT SESSION:
${conversationText}

Instructions:
1. Treat the NEW CHAT SESSION as authoritative when it contradicts EXISTING MEMORY (e.g. an injury that was open is now resolved, a goal changed). Drop facts that are no longer true.
2. Keep at most 8 active goals. If there are more, retire the stalest/least relevant into the narrative as past context rather than dropping them silently.
3. Only add to notablePatterns observations that aren't already captured as a goal/constraint/preference (e.g. "trains best in mornings", "recovery dips after back-to-back hard days").
4. Keep "narrative" to at most 150 words — a freeform paragraph a coach could read to quickly understand this athlete.
5. Update confidenceScores (0-100) reflecting how explicit the current goals/constraints/preferences are across BOTH existing memory and this session.
6. Write a one-line "changeSummary" describing what changed in this update (for an audit log). If nothing meaningfully changed, say so explicitly.

Respond with ONLY valid JSON in this exact format:
{
  "goals": ["goal 1", "goal 2"],
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
  "confidenceScores": { "goals": 0, "constraints": 0, "preferences": 0 },
  "changeSummary": "one-line description of what changed"
}

IMPORTANT: Return ONLY the JSON object, no other text.`;

    const content = await callAI({
      systemPrompt: "You are an expert at maintaining structured long-term memory about an athlete from coaching conversations. Respond only with valid JSON.",
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
    console.error("Memory update error:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to update memory" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
