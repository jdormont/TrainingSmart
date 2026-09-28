import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI, type AIToolDefinition, type AIToolCall, type AIToolResultMessage } from "../_shared/ai-provider.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireArray, requireString, optionalNumber, ValidationError } from "../_shared/validate.ts";

const MAX_TOOLS = 10;

function parseTools(val: unknown): AIToolDefinition[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) throw new ValidationError("'tools' must be an array");
  if (val.length > MAX_TOOLS) throw new ValidationError(`'tools' exceeds the maximum of ${MAX_TOOLS} items`);

  return val.map((t, i) => {
    if (typeof t?.name !== "string" || t.name.trim().length === 0) {
      throw new ValidationError(`tools[${i}].name must be a non-empty string`);
    }
    if (typeof t?.description !== "string" || t.description.trim().length === 0) {
      throw new ValidationError(`tools[${i}].description must be a non-empty string`);
    }
    if (typeof t?.inputSchema !== "object" || t.inputSchema === null || Array.isArray(t.inputSchema)) {
      throw new ValidationError(`tools[${i}].inputSchema must be an object`);
    }
    return { name: t.name, description: t.description, inputSchema: t.inputSchema };
  });
}

function parseToolCalls(val: unknown, field: string): AIToolCall[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) throw new ValidationError(`'${field}' must be an array`);

  return val.map((tc, i) => {
    if (typeof tc?.id !== "string" || typeof tc?.name !== "string" || typeof tc?.input !== "object" || tc.input === null) {
      throw new ValidationError(`${field}[${i}] must have string 'id', string 'name', and object 'input'`);
    }
    return { id: tc.id, name: tc.name, input: tc.input };
  });
}

function parseToolResults(val: unknown, field: string): AIToolResultMessage[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (!Array.isArray(val)) throw new ValidationError(`'${field}' must be an array`);

  return val.map((tr, i) => {
    if (typeof tr?.toolCallId !== "string" || typeof tr?.content !== "string") {
      throw new ValidationError(`${field}[${i}] must have string 'toolCallId' and string 'content'`);
    }
    return { toolCallId: tr.toolCallId, content: tr.content };
  });
}

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

    const rawMessages = requireArray(body.messages, "messages", 100) as Array<{
      role: string;
      content: string;
      imageUrls?: string[];
      toolCalls?: unknown;
      toolResults?: unknown;
    }>;
    const systemPrompt = requireString(body.systemPrompt, "systemPrompt", 20_000);
    const maxTokens = optionalNumber(body.maxTokens, "maxTokens", 1, 8192, 1000);
    const temperature = optionalNumber(body.temperature, "temperature", 0, 2, 0.7);
    const tools = parseTools(body.tools);

    // Validate each message in the array
    rawMessages.forEach((msg, i) => {
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

    const messages = rawMessages.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
      imageUrls: msg.imageUrls,
      toolCalls: parseToolCalls(msg.toolCalls, 'messages[].toolCalls'),
      toolResults: parseToolResults(msg.toolResults, 'messages[].toolResults'),
    }));

    // Rate limit by IP (no auth on this endpoint in the current setup)
    const clientIp = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait before sending more messages." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Processing chat request with ${messages.length} messages${tools ? ` and ${tools.length} tools` : ""}`);

    const { content, toolCalls } = await callAI({
      systemPrompt,
      messages,
      maxTokens,
      temperature,
      tools,
    });

    return new Response(
      JSON.stringify({ content, toolCalls }),
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
