import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token', { status: 400, headers: corsHeaders });
    }

    // Create Supabase admin client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up user by calendar_token
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('calendar_token', token)
      .single();

    if (profileError || !userProfile) {
      console.error('Auth failed for token:', token);
      return new Response('Unauthorized: Invalid calendar token', { status: 401, headers: corsHeaders });
    }

    const userId = userProfile.user_id;

    // Fetch workouts: Future + Recent Past (2 months)
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const startDate = twoMonthsAgo.toISOString().split('T')[0];

    // Query workouts joined with plans to get plan name
    // Note: We select all future workouts for the user, regardless of plan_id
    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select(`
        *,
        training_plans (
          name
        )
      `)
      .eq('user_id', userId)
      .gte('scheduled_date', startDate)
      .order('scheduled_date', { ascending: true });

    if (workoutsError) {
      console.error('Error fetching workouts:', workoutsError);
      return new Response('Error fetching calendar data', { status: 500, headers: corsHeaders });
    }

    // Generate ICS content
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TrainingSmart AI//Fitness Plan//EN',
      'NAME:TrainingSmart Plan',
      'X-WR-CALNAME:TrainingSmart Plan',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ].join('\r\n');

    workouts?.forEach((workout: any) => {
       // Format date as YYYYMMDD
       // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss..."
       const cleanDate = workout.scheduled_date.split('T')[0];
       const dateStr = cleanDate.replace(/-/g, '');
       
       // Calculate next day for DTEND (required for some clients for proper all-day handling)
       const startDateObj = new Date(cleanDate);
       const nextDateObj = new Date(startDateObj);
       nextDateObj.setDate(nextDateObj.getDate() + 1);
       const nextDateStr = nextDateObj.toISOString().split('T')[0].replace(/-/g, '');

       const uid = `${workout.id}@trainingsmart.ai`;
       const summary = `${getEmoji(workout.type)} ${workout.name}`;
       
       let description = workout.description || '';
       
       // Add Plan Name if available
       if (workout.training_plans?.name) {
         description += `\\n\\nPlan: ${workout.training_plans.name}`;
       }
       
       // Add Link
       description += `\\n\\nView details: https://app.trainingsmart.ai/plans`;
       
       // Sanitize description: escape newlines for ICS format
       const safeDesc = description.replace(/\r?\n/g, '\\n');

       icsContent += '\r\n' + [
         'BEGIN:VEVENT',
         `UID:${uid}`,
         `DTSTAMP:${now}`,
         // All Day Event
         `DTSTART;VALUE=DATE:${dateStr}`,
         `DTEND;VALUE=DATE:${nextDateStr}`,
         `SUMMARY:${summary}`,
         `DESCRIPTION:${safeDesc}`,
         'END:VEVENT'
       ].join('\r\n');
    });

    icsContent += '\r\nEND:VCALENDAR';

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="training-plan.ics"',
        ...corsHeaders
      }
    });

  } catch (error) {
     console.error('Function error:', error);
     return new Response(
       JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }), 
       { status: 500, headers: corsHeaders }
     );
  }
});

function getEmoji(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('run')) return '🏃';
  if (t.includes('bike') || t.includes('ride')) return '🚲';
  if (t.includes('swim')) return '🏊';
  if (t.includes('strength') || t.includes('weight')) return '🏋️';
  if (t.includes('rest') || t.includes('recovery')) return '🛌';
  return '📅';
}
