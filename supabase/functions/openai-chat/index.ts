import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { callAI } from "../_shared/ai-provider.ts";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { messages, systemPrompt, maxTokens = 1000, temperature = 0.7 }: ChatRequest = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array is required");
    }

    if (!systemPrompt) {
      throw new Error("System prompt is required");
    }

    console.log(`Processing chat request with ${messages.length} messages`);

    const content = await callAI({
      systemPrompt,
      messages: messages.map(msg => ({ role: msg.role as "user" | "assistant", content: msg.content })),
      maxTokens,
      temperature,
    });

    return new Response(
      JSON.stringify({ content }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in openai-chat function:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
