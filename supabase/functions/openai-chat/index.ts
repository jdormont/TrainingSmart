import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/ai-provider.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireArray, requireString, optionalNumber, ValidationError } from "../_shared/validate.ts";

/*
 * STRAVA API COMPLIANCE - AI/ML Usage
 *
 * This edge function is COMPLIANT with Strava's API Terms section 2.6.
 *
 * COMPLIANCE DETAILS:
 * - Strava data is used ONLY as runtime context in chat messages
 * - Data is passed to OpenAI Chat Completions API for INFERENCE ONLY
 * - NO training, fine-tuning, or model improvement of any kind
 * - Data is processed in real-time and discarded after response generation
 * - OpenAI API requests are NOT used to train or improve AI models (per OpenAI policy)
 *
 * See /STRAVA_COMPLIANCE.md for full documentation.
 */

// ---------------------------------------------------------------------------
// Per-user rate limiter (in-memory; resets on cold start)
// Prevents scripted users from running up unbounded OpenAI costs.
// ---------------------------------------------------------------------------
interface RateLimitEntry { count: number; resetAt: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 30;          // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    // Parse and validate request body
    const body = await req.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON");
    });

    const messages = requireArray(body.messages, "messages", 100) as Array<{ role: string; content: string; imageUrls?: string[] }>;
    const systemPrompt = requireString(body.systemPrompt, "systemPrompt", 20_000);
    const maxTokens = optionalNumber(body.maxTokens, "maxTokens", 1, 8192, 1000);
    const temperature = optionalNumber(body.temperature, "temperature", 0, 2, 0.7);

    // Validate each message in the array
    messages.forEach((msg, i) => {
      if (typeof msg?.role !== "string" || typeof msg?.content !== "string") {
        throw new ValidationError(`messages[${i}] must have string 'role' and 'content' fields`);
      }
      if (msg.content.length > 50_000) {
        throw new ValidationError(`messages[${i}].content exceeds maximum length`);
      }
      if (msg.imageUrls !== undefined) {
        if (!Array.isArray(msg.imageUrls)) {
          throw new ValidationError(`messages[${i}].imageUrls must be an array of strings`);
        }
        msg.imageUrls.forEach((url, urlIdx) => {
          if (typeof url !== "string") {
            throw new ValidationError(`messages[${i}].imageUrls[${urlIdx}] must be a string`);
          }
        });
      }
    });

    // Rate limit by IP (no auth on this endpoint in the current setup)
    const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait before sending more messages." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing chat request with ${messages.length} messages`);

    const content = await callAI({
      systemPrompt,
      messages: messages.map(msg => ({ 
        role: msg.role as "user" | "assistant", 
        content: msg.content,
        imageUrls: msg.imageUrls 
      })),
      maxTokens,
      temperature,
    });

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in openai-chat function:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unknown error occurred" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
