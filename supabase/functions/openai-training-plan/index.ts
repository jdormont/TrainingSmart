import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/*
 * STRAVA API COMPLIANCE - AI/ML Usage
 *
 * This edge function is COMPLIANT with Strava's API Terms section 2.6.
 *
 * COMPLIANCE DETAILS:
 * - Strava activity data (distance, speed, volume) is used as runtime context
 * - Data is passed to OpenAI Chat Completions API for INFERENCE ONLY
 * - Used to generate personalized training plans based on current fitness
 * - NO training, fine-tuning, or model improvement of any kind
 * - Data is processed in real-time and discarded after plan generation
 * - OpenAI API requests are NOT used to train or improve AI models (per OpenAI policy)
 *
 * See /STRAVA_COMPLIANCE.md for full documentation.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TrainingPlanRequest {
  athleteName: string;
  goal: string;
  timeframe: string;
  preferences: string;
  weeklyVolume: {
    distance: number;
    activities: number;
  };
  recentActivities: Array<{
    distance: number;
    average_speed: number;
  }>;
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
      athleteName,
      goal,
      timeframe,
      preferences,
      weeklyVolume,
      recentActivities,
    }: TrainingPlanRequest = await req.json();

    const avgDistance = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.distance, 0) / recentActivities.length / 1000)
      : 0;

    const avgSpeed = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.average_speed * 3.6, 0) / recentActivities.length)
      : 0;

    const numWorkouts = timeframe === "1 week" ? 7 : timeframe === "2 weeks" ? 14 : timeframe === "4 weeks" ? 28 : 56;

    const prompt = `Based on ${athleteName}'s CYCLING training data, create a detailed ${timeframe} CYCLING training plan for their goal: "${goal}".

CURRENT FITNESS LEVEL:
- Recent weekly cycling volume: ${weeklyVolume.distance / 1000}km
- Recent cycling activities: ${recentActivities.length} rides
- Average ride distance: ${avgDistance}km
- Average ride speed: ${avgSpeed}km/h
- Training consistency: ${recentActivities.length} activities in recent data

PREFERENCES: ${preferences}

CRITICAL SCHEDULING CONSTRAINTS (HIGHEST PRIORITY):
1. **Adhere strictly to the user's PREFERENCES above.** If they ask for "Long rides on Tuesday", you MUST schedule a long ride on Tuesday, overriding any default logic.
2. **Maximum 1 workout per day** unless the user explicitly asks for "double days" or "two-a-days".
3. **DO NOT generate workout objects for "Rest Days".** If a day is a rest day, simply do not include a workout object for that day in the array. The UI handles empty days as rest days.

RESPONSE FORMAT:
You must respond with a valid JSON object containing exactly two fields:
1. "overview": A markdown-formatted string with the plan philosophy, progression strategy, and key focus areas.
2. "workouts": An array of workout objects.

WORKOUT OBJECT STRUCTURE:
{
  "week": number, // The week number this workout belongs to, starting at 1
  "dayOfWeek": number, // 0=Monday through 6=Sunday
  "name": "Short descriptive name",
  "type": "bike" | "run" | "swim" | "strength", // DO NOT USE "rest"
  "description": "Detailed instructions with YouTube links. Format: [Video Title](URL) by Channel Name",
  "duration": number (minutes),
  "distance": number (miles, optional, required for rides/runs),
  "intensity": "easy" | "moderate" | "hard" | "recovery"
}

Create ${numWorkouts} workouts with a balanced weekly structure, defaulting to rest days where appropriate by omitting workouts.`;

    console.log("Generating training plan with OpenAI (JSON Mode)...");

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
            content: `You are an expert cycling coach creating personalized cycling training plans.
You output strictly valid JSON.
Include YouTube video links in workout descriptions using format: [Video Title](https://youtube.com/watch?v=VIDEO_ID) by Creator Name.
Prioritize: GCN, TrainerRoad, Dylan Johnson, Cam Nicholls.`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 12000,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API error:", errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const finishReason = data.choices[0].finish_reason;

    console.log(`Received response (finish_reason: ${finishReason}), parsing JSON...`);

    if (finishReason === 'length') {
      console.warn("Response was truncated due to token limit!");
    }

    let result;
    try {
      // First try parsing directly
      result = JSON.parse(content);
    } catch (directParseError) {
      console.log("Direct JSON parse failed, attempting to strip Markdown...");
      try {
        // Fallback: Strip markdown code blocks and try again
        const cleaned = content
          .replace(/^\s*```json\s*/, "") // Remove start block
          .replace(/^\s*```\s*/, "")     // Remove start block generic
          .replace(/\s*```\s*$/, "");    // Remove end block

        result = JSON.parse(cleaned);
      } catch (cleanedParseError) {
        console.error("Failed to parse JSON response:", cleanedParseError);
        console.log("Raw content causing error:", content.substring(0, 500) + "..."); // Log start of content
        throw new Error(`Failed to parse AI response as JSON. Finish reason: ${finishReason}`);
      }
    }

    const { overview, workouts } = result;
    const description = overview || "No overview provided.";

    if (!Array.isArray(workouts) || workouts.length === 0) {
      throw new Error("AI did not return any workouts in the expected format.");
    }

    console.log(`Successfully parsed ${workouts.length} workouts`);

    return new Response(
      JSON.stringify({ description, workouts }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in openai-training-plan function:", error);

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
