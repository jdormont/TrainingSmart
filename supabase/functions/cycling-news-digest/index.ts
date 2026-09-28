import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import Parser from "npm:rss-parser";
import { callAI } from "../_shared/ai-provider.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";

interface RawArticle {
  title: string;
  description: string;
  link: string;
  pubDate: Date;
}

// Helper: extract alphanumeric words longer than 2 characters
function getWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

// Helper: Jaccard similarity between two sets of words
function getJaccardSimilarity(title1: string, title2: string): number {
  const words1 = getWords(title1);
  const words2 = getWords(title2);
  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// Fetch with a hard timeout so one slow/hanging feed can't stall the whole digest.
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

// Attempt to salvage a usable object out of a truncated JSON response (e.g. the
// model's output was cut off after hitting max_tokens mid-array). Walks the text
// tracking bracket depth (ignoring string contents) to find the longest prefix that
// ends right after a complete array element, then closes out any still-open
// containers and reparses. Returns null if no valid prefix can be recovered.
function repairTruncatedJson(text: string): unknown | null {
  const cutPoints: number[] = [];
  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escapeNext) escapeNext = false;
      else if (ch === "\\") escapeNext = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length > 0 && stack[stack.length - 1] === "[") {
        cutPoints.push(i + 1);
      }
    }
  }

  for (let idx = cutPoints.length - 1; idx >= 0; idx--) {
    const prefix = text.slice(0, cutPoints[idx]);

    const closeStack: string[] = [];
    let s = false, esc = false;
    for (let i = 0; i < prefix.length; i++) {
      const ch = prefix[i];
      if (s) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') s = false;
        continue;
      }
      if (ch === '"') { s = true; continue; }
      if (ch === "{" || ch === "[") closeStack.push(ch);
      else if (ch === "}" || ch === "]") closeStack.pop();
    }

    const closing = closeStack.reverse().map((c) => (c === "{" ? "}" : "]")).join("");

    try {
      return JSON.parse(prefix + closing);
    } catch {
      continue;
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight (OPTIONS)
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check cache (expires_at > now) using service role key (RLS-bypass)
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const nowIso = new Date().toISOString();
    const { data: cachedRow, error: cacheError } = await supabaseAdmin
      .from("cycling_digest_cache")
      .select("*")
      .gt("expires_at", nowIso)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      console.error("Cache check failed, generating fresh digest:", cacheError);
    }

    if (cachedRow && cachedRow.payload) {
      console.log("Returning cached news digest generated at:", cachedRow.generated_at);
      return new Response(
        JSON.stringify(cachedRow.payload),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch RSS feeds (Try/Catch per feed)
    const feeds = [
      { url: "https://www.cyclingnews.com/rss", required: true },
      { url: "https://velonews.com/feed", required: true },
      { url: "https://www.procycling.com/feed", required: false },
      { url: "https://www.cyclingweekly.com/feed", required: true }
    ];

    const parser = new Parser();
    const FEED_TIMEOUT_MS = 8000;

    // Fetch all feeds concurrently (each bounded by its own timeout) instead of
    // sequentially — a single slow/hanging feed used to stall the whole request.
    const feedResults = await Promise.allSettled(
      feeds.map(async (feed) => {
        console.log(`Fetching RSS feed: ${feed.url}`);
        const res = await fetchWithTimeout(feed.url, FEED_TIMEOUT_MS);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const xmlText = await res.text();
        const parsedFeed = await parser.parseString(xmlText);
        const articles: RawArticle[] = [];
        if (parsedFeed.items) {
          for (const item of parsedFeed.items) {
            if (item.title && item.link) {
              articles.push({
                title: item.title.trim(),
                description: (item.contentSnippet || item.content || "").trim(),
                link: item.link.trim(),
                pubDate: item.pubDate ? new Date(item.pubDate) : new Date()
              });
            }
          }
        }
        return articles;
      })
    );

    const allArticles: RawArticle[] = [];
    feedResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        allArticles.push(...result.value);
      } else {
        console.warn(`Failed to fetch/parse feed ${feeds[i].url}:`, result.reason?.message ?? result.reason);
      }
    });

    // If no articles could be loaded at all, return empty state instead of failing
    if (allArticles.length === 0) {
      return new Response(
        JSON.stringify({
          generatedAt: nowIso,
          headlines: [],
          activeRaces: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Deduplicate articles by title similarity using Jaccard threshold (> 0.6)
    // Sort articles by publication date descending to prioritize newer ones
    allArticles.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    const uniqueArticles: RawArticle[] = [];
    for (const article of allArticles) {
      let isDuplicate = false;
      for (const unique of uniqueArticles) {
        if (getJaccardSimilarity(article.title, unique.title) > 0.6) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        uniqueArticles.push(article);
      }
    }

    // Take top ~16 items. Also cap each description length — full RSS descriptions
    // can run to several hundred words, which bloats the prompt and pushes the
    // model's output (which echoes/derives from them) closer to the max_tokens
    // ceiling, raising the risk of a mid-response truncation.
    const MAX_DESCRIPTION_CHARS = 300;
    const itemsToSummarize = uniqueArticles.slice(0, 16).map((art) => ({
      ...art,
      description: art.description.length > MAX_DESCRIPTION_CHARS
        ? `${art.description.slice(0, MAX_DESCRIPTION_CHARS)}...`
        : art.description
    }));

    // 5. Call Claude to synthesize digest
    const systemPrompt = `You are a cycling sports editor. Based on the recent articles provided, produce a structured daily digest covering WorldTour, Classics, gravel, and women's events. 

Return JSON only, no markdown, in this shape:
{
  "generatedAt": "ISO timestamp",
  "headlines": [
    { 
      "title": "headline title", 
      "summary": "2-3 sentences summary of the news story.", 
      "discipline": "road | gravel | womens | track | cyclocross | other", 
      "sourceUrl": "The exact source URL of the article from the input" 
    }
  ],
  "activeRaces": [
    { 
      "raceName": "Name of the active race", 
      "discipline": "road | gravel | womens | track | cyclocross | other", 
      "oneLiner": "A brief one-line update of the race status",
      "overview": "A short narrative summary (1-2 sentences) describing the current race situation based on the articles.",
      "keyUpdates": [
        { "label": "stage update label (e.g. Stage 7 Action)", "text": "details of this update" }
      ]
    }
  ]
}

Rules:
1. For each item in 'headlines', 'sourceUrl' MUST exactly match the Source URL of the article it summarizes.
2. If there are no major active races happening according to the articles, return an empty array [] for 'activeRaces'.
3. In 'activeRaces', include at most 3 races and 2-3 detailed updates in 'keyUpdates' per race (e.g. Stage Action, The Standings, Today's Stage, or Team News/Attrition specific to the race).
4. Keep every 'summary', 'overview', and 'text' field concise — 1-2 sentences. Do not pad with extra detail.
5. CRITICAL: Any double quotes (") inside the JSON string values (like 'title', 'summary', 'oneLiner', 'overview', or 'text') MUST be escaped as \\" (e.g. \\"not good news for the Tour\\") so that the JSON parser doesn't break. Double check this.
6. Do not wrap JSON in markdown blocks (e.g. do not use \`\`\`json).
7. CRITICAL: Output ONLY the complete, well-formed JSON object described above — never truncate or cut off mid-array. If space is limited, include fewer headlines/races rather than leaving the JSON incomplete.`;

    const promptText = `Here are the latest cycling news articles:

${itemsToSummarize.map((art, idx) => `
Article [${idx + 1}]:
Title: ${art.title}
Source URL: ${art.link}
Description: ${art.description || "(No description provided)"}
`).join("\n")}

Based on the above articles, output the structured daily news digest in valid JSON.`;

    console.log(`Calling Claude to synthesize ${itemsToSummarize.length} articles`);
    const { content: responseText } = await callAI({
      systemPrompt,
      messages: [{ role: "user", content: promptText }],
      maxTokens: 4096,
      temperature: 0.25,
      jsonMode: true
    });

    let payload: any;
    let cleanResponse = responseText.trim();
    const firstBrace = cleanResponse.indexOf("{");
    const lastBrace = cleanResponse.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanResponse = cleanResponse.slice(firstBrace, lastBrace + 1);
    }

    try {
      payload = JSON.parse(cleanResponse);
    } catch (err) {
      // The response is likely truncated mid-array (e.g. hit max_tokens). Rather
      // than fail the whole request, try to salvage the complete items that were
      // generated before the cutoff.
      console.warn("Initial JSON parse failed, attempting repair:", err.message);
      const repaired = repairTruncatedJson(cleanResponse);
      if (repaired && typeof repaired === "object") {
        console.warn("Recovered partial digest via JSON repair (response was likely truncated)");
        payload = repaired;
      } else {
        console.error("JSON parsing error on AI response:", responseText, err);
        return new Response(
          JSON.stringify({
            error: `AI response parsing failed: ${err.message}`,
            rawResponse: responseText
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Normalize shape in case of a repaired/partial payload
    if (!Array.isArray(payload.headlines)) payload.headlines = [];
    if (!Array.isArray(payload.activeRaces)) payload.activeRaces = [];

    // Set generatedAt in payload
    payload.generatedAt = nowIso;

    // 6. Cache the synthesized result (TTL = 6 hours)
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabaseAdmin
      .from("cycling_digest_cache")
      .insert({
        generated_at: nowIso,
        expires_at: expiresAt,
        payload: payload
      });

    if (insertError) {
      console.error("Failed to insert into cache:", insertError);
    }

    // Delete expired cache rows to keep table clean
    try {
      await supabaseAdmin
        .from("cycling_digest_cache")
        .delete()
        .lte("expires_at", nowIso);
    } catch (deleteErr) {
      console.error("Failed to delete expired cache rows:", deleteErr);
    }

    return new Response(
      JSON.stringify(payload),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Critical error in cycling-news-digest function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
