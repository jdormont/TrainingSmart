import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface HealthPayload {
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

function calculateRecoveryScore(sleep_minutes: number, hrv: number): number {
  // Sleep Score: If sleep_minutes > 420 (7 hours), give 50 points. Else, scale it down.
  let sleepScore = 0;
  if (sleep_minutes >= 420) {
    sleepScore = 50;
  } else {
    sleepScore = (sleep_minutes / 420) * 50;
  }

  // HRV Score: If hrv > 50, give 50 points. Else, scale it (hrv / 50 * 50).
  let hrvScore = 0;
  if (hrv >= 50) {
    hrvScore = 50;
  } else {
    hrvScore = (hrv / 50) * 50;
  }

  // Sum them together and round to nearest integer
  const totalScore = Math.round(sleepScore + hrvScore);
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, totalScore));
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

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const payload: HealthPayload = await req.json();

    // Validate required fields
    if (
      typeof payload.sleep_minutes !== 'number' ||
      typeof payload.resting_hr !== 'number' ||
      typeof payload.hrv !== 'number'
    ) {
      return new Response(
        JSON.stringify({
          error: 'Invalid payload. Required fields: sleep_minutes (number), resting_hr (number), hrv (number)',
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
      payload.hrv
    );

    // Prepare data for upsert
    const metricData: DailyMetric = {
      user_id: user.id,
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
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save metrics', details: error.message }),
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