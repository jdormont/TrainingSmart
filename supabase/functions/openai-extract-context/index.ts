import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const conversationText = messages
      .map((m: ChatMessage) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
      .join('\n\n');

    const extractionPrompt = `Analyze this training coaching conversation and extract structured planning context.

CONVERSATION:
${conversationText}

Extract the following information with confidence scores (0-100):

1. GOALS: What training goals has the user mentioned? (e.g., "complete a century ride", "improve FTP by 20 watts")
2. CONSTRAINTS:
   - Time availability: When can they train? How many hours per week?
   - Equipment: What do they have access to? (indoor trainer, road bike, etc.)
   - Injuries/Limitations: Any physical constraints mentioned?
   - Other: Any other limitations (travel, work schedule, etc.)
3. PREFERENCES:
   - Workout types: What activities do they prefer? (outdoor rides, indoor training, etc.)
   - Intensity preference: Do they prefer hard efforts or steady endurance?
   - Training days: Which days of the week do they prefer to train?

4. KEY MESSAGES: Identify 2-5 most relevant message excerpts that contain important planning information

Respond with ONLY valid JSON in this exact format:
{
  "goals": ["goal 1", "goal 2"],
  "constraints": {
    "timeAvailability": "string or null",
    "equipment": ["item1", "item2"] or [],
    "injuries": ["limitation1"] or [],
    "other": ["other constraint"] or []
  },
  "preferences": {
    "workoutTypes": ["type1", "type2"] or [],
    "intensityPreference": "string or null",
    "trainingDays": [0, 2, 4] or []
  },
  "keyMessages": [
    {
      "messageId": "${messages[0]?.id || 'unknown'}",
      "content": "relevant excerpt from conversation",
      "relevance": "why this message is important for planning"
    }
  ],
  "confidenceScores": {
    "goals": 85,
    "constraints": 70,
    "preferences": 60
  },
  "isGoalOriented": true,
  "summary": "Brief 1-2 sentence summary of what the user wants to achieve"
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Confidence scores should reflect how explicit the information was (100 = explicitly stated, 50 = inferred, 0 = not mentioned)
- Set isGoalOriented to true if the user has discussed training goals, false otherwise
- Use actual message IDs from the conversation when possible`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert at analyzing training conversations and extracting structured planning information. Respond only with valid JSON."
          },
          {
            role: "user",
            content: extractionPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      throw new Error(errorData.error?.message || "OpenAI API request failed");
    }

    const data = await openaiResponse.json();
    const content = data.choices[0].message.content;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify(extracted),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Context extraction error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to extract context"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});