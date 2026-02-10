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
  eventDate: string; // ISO format
  startDate: string; // ISO format
  riderProfile: {
    stamina: string;
    discipline: string;
  };
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
      eventDate,
      startDate,
      riderProfile,
      preferences,
      weeklyVolume,
      recentActivities,
      dailyAvailability,
    }: TrainingPlanRequest & { dailyAvailability?: Record<string, string> } = await req.json();

    const avgDistance = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.distance, 0) / recentActivities.length / 1000)
      : 0;

    const avgSpeed = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.average_speed * 3.6, 0) / recentActivities.length)
      : 0;

    // Calculate duration in weeks
    const start = new Date(startDate);
    const event = new Date(eventDate);
    const diffTime = Math.abs(event.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeksAvailable = Math.max(1, Math.floor(diffDays / 7));

    // Phase Calculation Logic
    let periodizationStructure = "";
    if (weeksAvailable < 4) {
      periodizationStructure = "Ride safely within limits volume-wise. Focus on freshness. Final week must be Taper.";
    } else if (weeksAvailable <= 8) {
      // 4-8 weeks: Build -> Peak -> Taper
      // If 8 weeks: 4 Build, 3 Peak, 1 Taper
      const taperWeeks = 1;
      const peakWeeks = Math.min(3, Math.max(1, weeksAvailable - taperWeeks - 2)); // Ensure at least 2 weeks build
      const buildWeeks = weeksAvailable - taperWeeks - peakWeeks;
      periodizationStructure = `Weeks 1-${buildWeeks}: Build. Weeks ${buildWeeks + 1}-${buildWeeks + peakWeeks}: Peak. Week ${weeksAvailable}: Taper.`;
    } else {
      // 9+ weeks (Treating 12+ as full cycle, 9-11 as compressed)
      // If 12+ weeks: X Base, Y Build, 3 Peak, 2 Taper
      const taperWeeks = weeksAvailable >= 12 ? 2 : 1;
      const peakWeeks = 3;
      const remainingWeeks = weeksAvailable - taperWeeks - peakWeeks;
      const buildWeeks = Math.floor(remainingWeeks / 2); // Split remaining between Base/Build
      const baseWeeks = remainingWeeks - buildWeeks;

      periodizationStructure = `Weeks 1-${baseWeeks}: Base. Weeks ${baseWeeks + 1}-${baseWeeks + buildWeeks}: Build. Weeks ${baseWeeks + buildWeeks + 1}-${weeksAvailable - taperWeeks}: Peak. Weeks ${weeksAvailable - taperWeeks + 1}-${weeksAvailable}: Taper.`;
    }
    
    const numWorkouts = weeksAvailable * 7;

    // Build Daily Schedule Context
    let scheduleConstraints = "";
    if (dailyAvailability) {
        scheduleConstraints = Object.entries(dailyAvailability)
            .map(([day, time]) => `- ${day}: ${time} max duration`)
            .join("\n");
    }

    const prompt = `Based on ${athleteName}'s CYCLING training data, create a detailed ${weeksAvailable}-week CYCLING training plan for their goal: "${goal}", ending on ${eventDate}.

CURRENT FITNESS LEVEL:
- Recent weekly cycling volume: ${(weeklyVolume.distance / 1000).toFixed(1)}km
- Recent cycling activities: ${recentActivities.length} rides
- Average ride distance: ${avgDistance}km
- Average ride speed: ${avgSpeed}km/h
- Training consistency: ${recentActivities.length} activities in recent data
- Rider Profile: Stamina (${riderProfile.stamina}), Discipline (${riderProfile.discipline})

PREFERENCES: ${preferences}

PERIODIZATION SCHEDULE:
${periodizationStructure}

WEEKLY SCHEDULE CONSTRAINTS (STRICT):
${scheduleConstraints || "No specific day-by-day constraints provided."}

CRITICAL SCHEDULING CONSTRAINTS (HIGHEST PRIORITY):
1. **Adhere strictly to the WEEKLY SCHEDULE CONSTRAINTS above.**
   - If a day is marked as "Rest Day", DO NOT schedule a workout (omit it).
   - If a day has a time limit (e.g., "1 hour"), the workout duration MUST NOT exceed this limit.
2. **CONFLICT RESOLUTION (Weekly vs Daily):**
   - If "Weekly Time Available" is low (e.g. 5-6 hours) but the user has high "Daily Availability" on specific days (e.g. 3-4 hours on Weekend), **YOU MUST UTILIZE THE HIGH AVAILABILITY DAYS for key workouts.**
   - Do NOT skip a long ride on a high-availability day just to stay under the weekly average. It is better to exceed the weekly preference slightly than to miss a key structural workout (Long Ride).
   - Reduce duration on other days to compensate if needed.
3. **Maximum 1 workout per day** unless the user explicitly asks for "double days" or "two-a-days".
4. **DO NOT generate workout objects for "Rest Days".** If a day is a rest day, simply do not include a workout object for that day in the array.
5. **For the final week (Week ${weeksAvailable}), ensure volume drops by 50% (Taper).**
6. **For the starting week, calibrate intensity based on Rider Profile: Stamina ${riderProfile.stamina}, Discipline ${riderProfile.discipline}.**

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
  "phase": "Base" | "Build" | "Peak" | "Taper", // The phase this workout belongs to
  "description": "Detailed instructions with YouTube links. Format: [Video Title](URL) by Channel Name",
  "duration": number (minutes),
  "distance": number (miles, optional, required for rides/runs),
  "intensity": "easy" | "moderate" | "hard" | "recovery"
}

Create ${numWorkouts} days of plan (workouts + rest days) with a balanced weekly structure, defaulting to rest days where appropriate by omitting workouts.`;

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
