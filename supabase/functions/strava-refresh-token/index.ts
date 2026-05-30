import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { requireString, ValidationError } from "../_shared/validate.ts";

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    const body = await req.json().catch(() => { throw new ValidationError("Request body must be valid JSON"); });
    const refresh_token = requireString(body.refresh_token, "refresh_token", 500);

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("Strava credentials not configured");
    }

    const tokenUrl = "https://www.strava.com/oauth/token";
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh_token,
      grant_type: "refresh_token",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Strava token refresh failed:", errorText);
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const tokenData: RefreshTokenResponse = await response.json();

    return new Response(
      JSON.stringify(tokenData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in strava-refresh-token:", error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
