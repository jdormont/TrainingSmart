/**
 * Centralised CORS header factory for Supabase Edge Functions.
 *
 * Instead of every function hardcoding `"Access-Control-Allow-Origin": "*"`,
 * import getCorsHeaders() and pass the incoming request.  The allowed-origin
 * list is maintained in a single place.
 *
 * Rules:
 *  - Mutation / admin functions should ONLY use restricted CORS (no wildcard).
 *  - Read-only public functions may use wildcard; set allowWildcard = true.
 *
 * Usage:
 *   import { getCorsHeaders, handleOptions } from '../_shared/cors.ts';
 *
 *   Deno.serve(async (req) => {
 *     if (req.method === 'OPTIONS') return handleOptions(req);
 *     const headers = getCorsHeaders(req);
 *     ...
 *   });
 */

// Domains that are allowed to call Edge Functions with credentials.
// Add your production domain here before deploying.
const ALLOWED_ORIGINS: readonly string[] = [
  'https://trainingsmart.vercel.app', // production (update with real domain)
  'http://localhost:5173',            // Vite dev server
  'http://localhost:4173',            // Vite preview
  'https://trainingsmart.joshdormont.com' // production app on own domain
];

/**
 * Returns CORS headers that echo the request's Origin only when it is in the
 * allowlist, otherwise falls back to the primary production origin.
 *
 * For public read-only endpoints that genuinely need wildcard access, pass
 * allowWildcard = true.
 */
export function getCorsHeaders(
  req: Request,
  allowWildcard = false,
): Record<string, string> {
  if (allowWildcard) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    };
  }

  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0]; // safe fallback — won't match cross-origin requests

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
    'Vary': 'Origin',
  };
}

/**
 * Convenience handler for CORS preflight (OPTIONS) requests.
 */
export function handleOptions(req: Request, allowWildcard = false): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req, allowWildcard),
  });
}

/**
 * Helper to build a JSON error response with correct CORS headers.
 */
export function errorResponse(
  req: Request,
  message: string,
  status: number,
  allowWildcard = false,
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...getCorsHeaders(req, allowWildcard),
      'Content-Type': 'application/json',
    },
  });
}
