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

export interface AIToolDefinition {
  name: string;
  description: string;
  /** JSON Schema (object type) describing the tool's input. */
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResultMessage {
  toolCallId: string;
  content: string;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  imageUrls?: string[];
  /** Set on an assistant message that requested tool call(s) in a prior round. */
  toolCalls?: AIToolCall[];
  /** Set on a message carrying the results of previously-requested tool call(s) back to the model. */
  toolResults?: AIToolResultMessage[];
}

export interface AIResponse {
  content: string;
  /** Present when the model wants to call tool(s) before it can finish responding. */
  toolCalls?: AIToolCall[];
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
  /** Tool definitions the model may call. Omit or pass [] for a plain text-only call. */
  tools?: AIToolDefinition[];
}

export async function callAI(options: AICallOptions): Promise<AIResponse> {
  const provider = Deno.env.get("AI_PROVIDER") ?? "openai";

  if (provider === "anthropic") {
    return callAnthropic(options);
  }
  return callOpenAI(options);
}

function formatOpenAIMessages(messages: AIMessage[]): any[] {
  const formatted: any[] = [];

  for (const msg of messages) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      formatted.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });
      continue;
    }

    if (msg.toolResults && msg.toolResults.length > 0) {
      for (const result of msg.toolResults) {
        formatted.push({ role: "tool", tool_call_id: result.toolCallId, content: result.content });
      }
      continue;
    }

    if (msg.imageUrls && msg.imageUrls.length > 0) {
      const contentParts: any[] = [{ type: "text", text: msg.content }];
      msg.imageUrls.forEach(url => {
        contentParts.push({
          type: "image_url",
          image_url: { url }
        });
      });
      formatted.push({ role: msg.role, content: contentParts });
      continue;
    }

    formatted.push({ role: msg.role, content: msg.content });
  }

  return formatted;
}

async function callOpenAI({
  systemPrompt,
  messages,
  maxTokens = 1000,
  temperature = 0.7,
  jsonMode = false,
  tools,
}: AICallOptions): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = Deno.env.get("AI_MODEL") ?? PROVIDER_DEFAULTS.openai;

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...formatOpenAIMessages(messages),
    ],
    max_tokens: maxTokens,
    temperature,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
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
  const choice = data.choices[0];
  if (choice.finish_reason === "length") {
    console.warn(`[AI] OpenAI response was truncated (hit max_tokens=${maxTokens})`);
  }

  const message = choice.message;
  const toolCalls: AIToolCall[] | undefined = message.tool_calls && message.tool_calls.length > 0
    ? message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}"),
      }))
    : undefined;

  return { content: message.content ?? "", toolCalls };
}

async function formatAnthropicMessages(messages: AIMessage[]): Promise<any[]> {
  const formatted: any[] = [];

  for (const msg of messages) {
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const blocks: any[] = [];
      if (msg.content) blocks.push({ type: "text", text: msg.content });
      for (const tc of msg.toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      formatted.push({ role: "assistant", content: blocks });
      continue;
    }

    if (msg.toolResults && msg.toolResults.length > 0) {
      formatted.push({
        role: "user",
        content: msg.toolResults.map(result => ({
          type: "tool_result",
          tool_use_id: result.toolCallId,
          content: result.content,
        })),
      });
      continue;
    }

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
      formatted.push({ role: msg.role, content: contentParts });
      continue;
    }

    formatted.push({ role: msg.role, content: msg.content });
  }

  return formatted;
}

async function callAnthropic({
  systemPrompt,
  messages,
  maxTokens = 1000,
  temperature = 0.7,
  tools,
}: AICallOptions): Promise<AIResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const model = Deno.env.get("AI_MODEL") ?? PROVIDER_DEFAULTS.anthropic;

  const formattedMessages = await formatAnthropicMessages(messages);

  const body: Record<string, unknown> = {
    model,
    system: systemPrompt,
    messages: formattedMessages,
    max_tokens: Math.min(maxTokens, ANTHROPIC_MAX_TOKENS),
    temperature,
  };

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${(err as any).error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  if (data.stop_reason === "max_tokens") {
    console.warn(`[AI] Anthropic response was truncated (hit max_tokens=${Math.min(maxTokens, ANTHROPIC_MAX_TOKENS)})`);
  }

  const content = (data.content as any[])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("");

  const toolUseBlocks = (data.content as any[]).filter(block => block.type === "tool_use");
  const toolCalls: AIToolCall[] | undefined = toolUseBlocks.length > 0
    ? toolUseBlocks.map(block => ({ id: block.id, name: block.name, input: block.input }))
    : undefined;

  return { content, toolCalls };
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
