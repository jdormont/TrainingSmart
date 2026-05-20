/**
 * Unified AI provider abstraction.
 *
 * Controlled by two Supabase secrets:
 *   AI_PROVIDER  — "openai" | "anthropic"  (default: "openai")
 *   AI_MODEL     — optional model override
 *                  OpenAI default:    gpt-4o-mini
 *                  Anthropic default: claude-sonnet-4-6
 *
 * To switch providers: set AI_PROVIDER in Supabase dashboard → Project Settings → Edge Functions secrets.
 * To pin a specific model: set AI_MODEL (e.g. "claude-opus-4-7" or "gpt-4o").
 */

const PROVIDER_DEFAULTS: Record<string, string> = {
  openai:    "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
};

// Anthropic max output cap — claude-sonnet-4-6 supports 8192 output tokens.
const ANTHROPIC_MAX_TOKENS = 8192;

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AICallOptions {
  systemPrompt: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * Hint that the response must be valid JSON.
   * OpenAI: enables response_format json_object.
   * Anthropic: no-op — Claude follows JSON instructions in the system prompt reliably.
   */
  jsonMode?: boolean;
}

export async function callAI(options: AICallOptions): Promise<string> {
  const provider = Deno.env.get("AI_PROVIDER") ?? "openai";

  if (provider === "anthropic") {
    return callAnthropic(options);
  }
  return callOpenAI(options);
}

async function callOpenAI({
  systemPrompt,
  messages,
  maxTokens = 1000,
  temperature = 0.7,
  jsonMode = false,
}: AICallOptions): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = Deno.env.get("AI_MODEL") ?? PROVIDER_DEFAULTS.openai;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: maxTokens,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${(err as any).error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

async function callAnthropic({
  systemPrompt,
  messages,
  maxTokens = 1000,
  temperature = 0.7,
}: AICallOptions): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const model = Deno.env.get("AI_MODEL") ?? PROVIDER_DEFAULTS.anthropic;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages,
      max_tokens: Math.min(maxTokens, ANTHROPIC_MAX_TOKENS),
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${(err as any).error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text as string;
}
