import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/*
 * STRAVA API COMPLIANCE - AI/ML Usage
 *
 * This edge function is COMPLIANT with Strava's API Terms section 2.6.
 *
 * COMPLIANCE DETAILS:
 * - Strava activity data (volume, distance) and recovery metrics are used as context
 * - Data is passed to OpenAI Chat Completions API for INFERENCE ONLY
 * - Used to modify training plans based on athlete's current status
 * - NO training, fine-tuning, or model improvement of any kind
 * - Data is processed in real-time and discarded after modification
 * - OpenAI API requests are NOT used to train or improve AI models (per OpenAI policy)
 *
 * See /STRAVA_COMPLIANCE.md for full documentation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ModifyPlanRequest {
  existingWorkouts: any[];
  modificationRequest: string;
  athleteName: string;
  weekNumber: number;
  weeklyVolume: {
    distance: number;
  };
  recentActivities: Array<{
    distance: number;
  }>;
  recovery?: {
    sleepScore?: number;
    readinessScore?: number;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured in environment variables");
    }

    const {
      existingWorkouts,
      modificationRequest,
      athleteName,
      weekNumber,
      weeklyVolume,
      recentActivities,
      recovery,
    }: ModifyPlanRequest = await req.json();

    const avgDistance = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.distance, 0) / recentActivities.length / 1000)
      : 0;

    const workoutsJson = JSON.stringify(existingWorkouts, null, 2);

    let recoveryContext = "";
    if (recovery) {
      recoveryContext = `\n\nRECOVERY STATUS:
- Sleep score: ${recovery.sleepScore || "N/A"}/100
- Readiness: ${recovery.readinessScore || "N/A"}/100
`;
    }

    const prompt = `You are modifying Week ${weekNumber} of ${athleteName}'s CYCLING training plan.

CURRENT WEEK'S WORKOUTS:
\`\`\`json
${workoutsJson}
\`\`\`

ATHLETE'S CURRENT FITNESS:
- Recent weekly volume: ${(weeklyVolume.distance / 1000).toFixed(1)}km
- Recent activities: ${recentActivities.length} rides
- Average ride: ${avgDistance}km${recoveryContext}

MODIFICATION REQUEST:
"${modificationRequest}"

INSTRUCTIONS:
1. Modify the workouts above to accommodate the athlete's request
2. Maintain training principles (don't overload, respect recovery)
3. Keep the same workout structure (same fields: name, type, description, duration, distance, intensity, dayOfWeek)
4. If workouts need to move to different days, adjust dayOfWeek (0=Mon through 6=Sun)
5. If reducing time/volume, prioritize key sessions over easier workouts
6. Include YouTube video links in descriptions where helpful
7. Return ONLY the modified JSON array wrapped in \`\`\`json code block

Respond with the complete modified workout array for this week.`;

    console.log("Modifying training plan with OpenAI...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert cycling coach modifying training plans.

CRITICAL: Respond with ONLY a JSON array of modified workouts wrapped in \`\`\`json code block.
Keep the same structure: name, type, description, duration, distance, intensity, dayOfWeek.
Maintain training principles while accommodating the athlete's constraints.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log("Received response, parsing modified workouts...");

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      throw new Error("AI did not return properly formatted workout JSON");
    }

    const modifiedWorkouts = JSON.parse(jsonMatch[1]);
    console.log(`Parsed ${modifiedWorkouts.length} modified workouts`);

    return new Response(
      JSON.stringify({ workouts: modifiedWorkouts }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in openai-modify-plan function:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
