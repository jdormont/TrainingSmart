import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

RESPONSE FORMAT:
You must respond with TWO sections:

1. OVERVIEW: A markdown-formatted overview of the plan including philosophy, progression strategy, and key focus areas.

2. WORKOUTS: A JSON array of structured workouts. Wrap in \`\`\`json code block.

JSON FORMAT EXAMPLE:
\`\`\`json
[
  {
    "name": "Easy Recovery Ride",
    "type": "bike",
    "description": "Zone 1-2 easy spinning. Focus on smooth pedaling. [Video](https://youtube.com/watch?v=xyz) by GCN",
    "duration": 45,
    "distance": 15,
    "intensity": "easy",
    "dayOfWeek": 1
  },
  {
    "name": "Rest Day",
    "type": "rest",
    "description": "Complete rest or light stretching/yoga",
    "duration": 0,
    "intensity": "recovery",
    "dayOfWeek": 2
  }
]
\`\`\`

WORKOUT STRUCTURE:
- name: Short descriptive name
- type: "bike", "run", "swim", "strength", or "rest"
- description: Detailed instructions with YouTube links for exercises
- duration: Number in minutes
- distance: Number in miles (optional, omit for rest/strength)
- intensity: "easy", "moderate", "hard", or "recovery"
- dayOfWeek: 0=Monday through 6=Sunday (spread workouts throughout the week)

Create ${numWorkouts} workouts with a balanced weekly structure.`;

    console.log("Generating training plan with OpenAI...");

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

CRITICAL: You must respond with BOTH a markdown overview AND a JSON workout array.

EXERCISE VIDEO INTEGRATION:
- Include YouTube video links in workout descriptions
- Use format: [Video Title](https://youtube.com/watch?v=VIDEO_ID) by Creator Name
- Prioritize: GCN, TrainerRoad, Dylan Johnson, Cam Nicholls
- Focus on videos with 100k+ views from established cycling channels`,
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 2500,
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

    console.log("Received response, parsing workouts...");

    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      jsonMatch = content.match(/```\s*\n\s*\[\s*\{[\s\S]*?\}\s*\]\s*\n\s*```/);
    }
    if (!jsonMatch) {
      const startIndex = content.indexOf("[{");
      const endIndex = content.lastIndexOf("}]");
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const jsonString = content.substring(startIndex, endIndex + 2);
        jsonMatch = [content, jsonString];
      }
    }
    if (!jsonMatch) {
      const startIndex = content.indexOf("[");
      const endIndex = content.lastIndexOf("]");
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const jsonString = content.substring(startIndex, endIndex + 1);
        jsonMatch = [content, jsonString];
      }
    }

    let workouts = [];
    let description = content;

    if (jsonMatch) {
      try {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        const cleanedJson = jsonString
          .replace(/^\s*```json?\s*/gm, "")
          .replace(/\s*```\s*$/gm, "")
          .trim();

        workouts = JSON.parse(cleanedJson);

        if (!Array.isArray(workouts)) {
          workouts = [workouts];
        }

        console.log(`Successfully parsed ${workouts.length} workouts`);

        const workoutsHeaderIndex = content.toLowerCase().indexOf("workouts");
        if (workoutsHeaderIndex !== -1) {
          const beforeWorkouts = content.substring(0, workoutsHeaderIndex);
          const afterWorkouts = content.substring(workoutsHeaderIndex);

          const overviewEnd = afterWorkouts.search(/```|^\s*\[|\{.*"name":/m);
          if (overviewEnd !== -1) {
            description = beforeWorkouts + afterWorkouts.substring(0, overviewEnd);
          } else {
            description = beforeWorkouts;
          }
        }

        description = description
          .replace(/```json\s*[\s\S]*?\s*```/g, "")
          .replace(/```\s*[\s\S]*?\s*```/g, "")
          .replace(/\`\`\`json[\s\S]*$/g, "")
          .replace(/^\s*\`\`\`json\s*/gm, "")
          .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, "")
          .replace(/\{\s*"name"[\s\S]*$/g, "")
          .replace(/^Workouts:?\s*$/gim, "")
          .replace(/^\s*\*\*json\s*/gim, "")
          .trim();
      } catch (parseError) {
        console.error("Failed to parse workout JSON:", parseError);
        throw new Error("Failed to parse workout data from AI response");
      }
    }

    if (workouts.length === 0) {
      throw new Error("AI did not return any workouts. Please try again.");
    }

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
