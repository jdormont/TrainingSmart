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
  imageUrls?: string[];
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

  const formattedMessages = messages.map(msg => {
    if (msg.imageUrls && msg.imageUrls.length > 0) {
      const contentParts: any[] = [{ type: "text", text: msg.content }];
      msg.imageUrls.forEach(url => {
        contentParts.push({
          type: "image_url",
          image_url: { url }
        });
      });
      return { role: msg.role, content: contentParts };
    }
    return { role: msg.role, content: msg.content };
  });

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...formattedMessages,
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

  // Map messages to support base64 image blocks for Anthropic
  const formattedMessages: any[] = [];
  for (const msg of messages) {
    if (msg.imageUrls && msg.imageUrls.length > 0) {
      const contentParts: any[] = [];
      for (const url of msg.imageUrls) {
        try {
          const { data, mediaType } = await fetchImageAsBase64(url);
          contentParts.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: data
            }
          });
        } catch (err) {
          console.warn(`[Anthropic] Failed to download/encode image from URL: ${url}`, err);
        }
      }
      contentParts.push({ type: "text", text: msg.content });
      formattedMessages.push({ role: msg.role, content: contentParts });
    } else {
      formattedMessages.push({ role: msg.role, content: msg.content });
    }
  }

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
      messages: formattedMessages,
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

// Helper to download image and encode as base64 in Deno environment
async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = "";
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const base64Data = btoa(binary);
  const mediaType = response.headers.get("content-type") ?? "image/jpeg";
  
  return { data: base64Data, mediaType };
}
