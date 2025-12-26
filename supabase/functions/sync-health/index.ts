import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, x-api-key',
};

// Hardcoded API secret for webhook-style authentication
const API_SECRET = 'Demo-1234';

interface HealthPayload {
  user_id: string;
  sleep_minutes: number;
  resting_hr: number;
  hrv: number;
  date?: string;
}

interface DailyMetric {
  user_id: string;
  date: string;
  sleep_minutes: number;
  resting_hr: number;
  hrv: number;
  recovery_score: number;
}

function calculateRecoveryScore(sleep_minutes: number, hrv: number, resting_hr: number): number {
  const validScores: number[] = [];

  // Sleep Score: Only calculate if sleep_minutes > 0
  if (sleep_minutes > 0) {
    const sleepScore = Math.min(100, (sleep_minutes / 480) * 100);
    validScores.push(sleepScore);
  }

  // HRV Score: Only calculate if hrv > 0
  if (hrv > 0) {
    const hrvScore = Math.min(100, (hrv / 80) * 100);
    validScores.push(hrvScore);
  }

  // RHR Score: Only calculate if resting_hr > 0
  if (resting_hr > 0) {
    const rhrScore = Math.max(0, 100 - ((resting_hr - 40) * 2));
    validScores.push(rhrScore);
  }

  // Return 0 if no valid scores, otherwise return the average
  if (validScores.length === 0) {
    return 0;
  }

  const sum = validScores.reduce((acc, score) => acc + score, 0);
  const average = sum / validScores.length;

  return Math.round(average);
}

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for API key in headers
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing x-api-key header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify API key
    if (apiKey !== API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase admin client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: HealthPayload = await req.json();

    // Validate required fields
    if (!payload.user_id || typeof payload.user_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid user_id field' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (
      typeof payload.sleep_minutes !== 'number' ||
      typeof payload.resting_hr !== 'number' ||
      typeof payload.hrv !== 'number'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid payload. Required fields: user_id (string), sleep_minutes (number), resting_hr (number), hrv (number)',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate ranges
    if (payload.sleep_minutes < 0) {
      return new Response(
        JSON.stringify({ error: 'sleep_minutes must be >= 0' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (payload.resting_hr < 30 || payload.resting_hr > 200) {
      return new Response(
        JSON.stringify({ error: 'resting_hr must be between 30 and 200' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (payload.hrv < 0 || payload.hrv > 300) {
      return new Response(
        JSON.stringify({ error: 'hrv must be between 0 and 300' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use provided date or default to today
    const date = payload.date || getTodayDate();

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate recovery score
    const recovery_score = calculateRecoveryScore(
      payload.sleep_minutes,
      payload.hrv,
      payload.resting_hr
    );

    // Prepare data for upsert
    const metricData: DailyMetric = {
      user_id: payload.user_id,
      date,
      sleep_minutes: payload.sleep_minutes,
      resting_hr: payload.resting_hr,
      hrv: payload.hrv,
      recovery_score,
    };

    // Upsert (insert or update) the daily metric
    const { data, error } = await supabase
      .from('daily_metrics')
      .upsert(metricData, {
        onConflict: 'user_id,date',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({
          error: 'Database upsert failed',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          raw_error: error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Health metrics synced successfully',
        data: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
