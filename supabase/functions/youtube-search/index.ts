import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireString, optionalNumber, optionalString, ValidationError } from "../_shared/validate.ts";

/**
 * youtube-search — thin Edge Function proxy for the YouTube Data API v3.
 *
 * Accepts POST requests with a JSON body from the browser and forwards them
 * to the YouTube API using the YOUTUBE_API_KEY secret (never exposed to the
 * browser bundle). Replaces the VITE_YOUTUBE_API_KEY usage in contentFeedService.ts.
 *
 * Supported operations (determined by 'op' field):
 *   search  — search/list endpoint with query 'q'
 *   channel — search/list endpoint with 'channelId'
 *   videos  — videos/list endpoint for metadata/statistics by comma-separated 'ids'
 */

const YOUTUBE_BASE = "https://www.googleapis.com/youtube/v3";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    const apiKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY secret is not configured");
    }

    const body = await req.json().catch(() => { throw new ValidationError("Request body must be valid JSON"); });

    const op = requireString(body.op ?? "search", "op", 20);

    // -------------------------------------------------------------------
    // Operation: search — keyword query
    // -------------------------------------------------------------------
    if (op === "search") {
      const q = requireString(body.q, "q", 500);
      const maxResults = optionalNumber(body.maxResults, "maxResults", 1, 50, 10);
      const publishedAfter = optionalString(body.publishedAfter, "publishedAfter", 30);

      const params = new URLSearchParams({
        key: apiKey,
        q,
        part: "snippet",
        order: "relevance",
        maxResults: String(maxResults),
        type: "video",
        videoDuration: "medium",
      });
      if (publishedAfter) params.set("publishedAfter", publishedAfter);

      const response = await fetch(`${YOUTUBE_BASE}/search?${params}`);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${err}`);
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------
    // Operation: channel — fetch latest from a channel
    // -------------------------------------------------------------------
    if (op === "channel") {
      const channelId = requireString(body.channelId, "channelId", 100);
      const maxResults = optionalNumber(body.maxResults, "maxResults", 1, 50, 5);
      const publishedAfter = optionalString(body.publishedAfter, "publishedAfter", 30);

      const params = new URLSearchParams({
        key: apiKey,
        channelId,
        part: "snippet",
        order: "date",
        maxResults: String(maxResults),
        type: "video",
      });
      if (publishedAfter) params.set("publishedAfter", publishedAfter);

      const response = await fetch(`${YOUTUBE_BASE}/search?${params}`);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${err}`);
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------------------------------------------------------------------
    // Operation: videos — fetch statistics/contentDetails for video IDs
    // -------------------------------------------------------------------
    if (op === "videos") {
      const ids = requireString(body.ids, "ids", 2000); // comma-separated video IDs

      const params = new URLSearchParams({
        key: apiKey,
        id: ids,
        part: "statistics,contentDetails",
      });

      const response = await fetch(`${YOUTUBE_BASE}/videos?${params}`);
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`YouTube API error: ${response.status} ${err}`);
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new ValidationError(`Unknown operation '${op}'. Supported: search, channel, videos`);

  } catch (error) {
    console.error("youtube-search error:", error);
    const status = error instanceof ValidationError ? 400 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
