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

interface ActivityMixItem {
  type: string;
  priority: number; // 1 = highest
}

interface TrainingPlanRequest {
  athleteName: string;
  goal: string;
  eventDate: string;
  startDate: string;
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
  dailyAvailability?: Record<string, string>;
  // Phase 1 — coach context (optional, backward-compatible)
  coach_specialization?: 'endurance' | 'strength_mobility' | 'general_fitness' | 'comeback';
  fitness_mode?: 'performance' | 're_engager';
  // Phase 2 — activity mix from onboarding profile
  activity_mix?: ActivityMixItem[];
}

interface PlanReasoning {
  athleteAssessment: {
    fitnessLevel: string;
    constraints: string;
    strengths: string[];
    limiters: string[];
  };
  macroCycle: {
    strategy: string;
    phases: Array<{
      weeks: string;
      name: string;
      goal: string;
    }>;
  };
  weeklyLogic: Array<{
    week: number;
    focus: string;
    targetTSS: number;
    keyWorkoutLogic: string;
  }>;
}

const PRIORITY_LABELS: Record<number, string> = { 1: 'high', 2: 'medium', 3: 'low' };
const ACTIVITY_DISPLAY: Record<string, string> = {
  bike: 'Cycling', run: 'Running', strength: 'Strength Training',
  yoga: 'Yoga & Mobility', hiking: 'Hiking', swim: 'Swimming',
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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
      coach_specialization,
      fitness_mode,
      activity_mix,
    }: TrainingPlanRequest = await req.json();

    const avgDistance = recentActivities.length > 0
      ? Math.round(recentActivities.reduce((sum, a) => sum + a.distance, 0) / recentActivities.length / 1000)
      : 0;

    let totalDist = 0;
    let totalTime = 0;
    recentActivities.forEach(a => {
      totalDist += a.distance;
      if (a.average_speed > 0) totalTime += a.distance / a.average_speed;
    });
    const avgSpeed = totalTime > 0 ? Math.round((totalDist / totalTime) * 3.6) : 0;

    const start = new Date(startDate);
    const event = new Date(eventDate);
    const diffDays = Math.ceil(Math.abs(event.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weeksAvailable = Math.max(1, Math.floor(diffDays / 7));

    const durationConstraint = `Total Duration: EXACTLY ${weeksAvailable} weeks. Do not generate more or less.`;

    // Periodization
    let periodizationStructure = "";
    if (weeksAvailable < 4) {
      periodizationStructure = "Focus on freshness and sustainable effort. Final week must be Taper.";
    } else if (weeksAvailable <= 8) {
      const taperWeeks = 1;
      const peakWeeks = Math.min(3, Math.max(1, weeksAvailable - taperWeeks - 2));
      const buildWeeks = weeksAvailable - taperWeeks - peakWeeks;
      periodizationStructure = `Weeks 1-${buildWeeks}: Build. Weeks ${buildWeeks + 1}-${buildWeeks + peakWeeks}: Peak. Week ${weeksAvailable}: Taper.`;
    } else {
      const taperWeeks = weeksAvailable >= 12 ? 2 : 1;
      const peakWeeks = 3;
      const remainingWeeks = weeksAvailable - taperWeeks - peakWeeks;
      const buildWeeks = Math.floor(remainingWeeks / 2);
      const baseWeeks = remainingWeeks - buildWeeks;
      periodizationStructure = `Weeks 1-${baseWeeks}: Base. Weeks ${baseWeeks + 1}-${baseWeeks + buildWeeks}: Build. Weeks ${baseWeeks + buildWeeks + 1}-${weeksAvailable - taperWeeks}: Peak. Weeks ${weeksAvailable - taperWeeks + 1}-${weeksAvailable}: Taper.`;
    }

    const numWorkouts = weeksAvailable * 7;

    // Daily schedule constraints
    let scheduleConstraints = "";
    if (dailyAvailability) {
      scheduleConstraints = Object.entries(dailyAvailability)
        .map(([day, time]) => `- ${day}: ${time} max duration`)
        .join("\n");
    }

    // Imperial conversions
    const weeklyVolMiles = ((weeklyVolume.distance / 1000) * 0.621371).toFixed(1);
    const avgDistMiles = Math.round(avgDistance * 0.621371);
    const avgSpeedMph = Math.round(avgSpeed * 0.621371);

    // ── Activity Mix Context ──────────────────────────────────────────────────
    let activityMixSection = "";
    if (activity_mix && activity_mix.length > 0) {
      const sorted = [...activity_mix].sort((a, b) => a.priority - b.priority);
      const lines = sorted.map(item => {
        const label = ACTIVITY_DISPLAY[item.type] ?? item.type;
        const prio = PRIORITY_LABELS[item.priority] ?? 'low';
        return `- ${label}: ${prio} priority`;
      });
      activityMixSection = `\nATHLETE ACTIVITY PRIORITIES:\n${lines.join("\n")}`;

      // Derive primary activities for type guidance
      const highPriority = sorted.filter(i => i.priority === 1).map(i => ACTIVITY_DISPLAY[i.type] ?? i.type);
      const medPriority = sorted.filter(i => i.priority === 2).map(i => ACTIVITY_DISPLAY[i.type] ?? i.type);
      if (highPriority.length > 0) {
        activityMixSection += `\n\nACTIVITY TYPE GUIDANCE: Majority of workouts should be ${highPriority.join(' and ')}. `;
        if (medPriority.length > 0) {
          activityMixSection += `Include ${medPriority.join(' and ')} as complementary sessions (1-2x/week). `;
        }
        activityMixSection += `Use the exact workout type values (bike, run, strength, yoga, hiking, swim) in the JSON output.`;
      }
    } else {
      // Default: if no mix provided, default based on coach specialization
      const defaultMix: Record<string, string> = {
        endurance: "Prioritize bike and run workouts. Include occasional strength for injury prevention.",
        strength_mobility: "Prioritize strength and yoga workouts. Include cycling or running as aerobic conditioning.",
        general_fitness: "Balance bike, run, strength, and yoga sessions across the week.",
        comeback: "Vary activity types — include easy bike or run, bodyweight strength, and yoga/mobility.",
      };
      activityMixSection = `\nACTIVITY TYPE GUIDANCE: ${defaultMix[coach_specialization ?? 'general_fitness'] ?? defaultMix.general_fitness}`;
    }

    // ── Coach Specialization ─────────────────────────────────────────────────
    const specializationLabels: Record<string, string> = {
      endurance: 'Endurance Coach — cycling/running focus, aerobic progression, power zones',
      strength_mobility: 'Strength & Mobility Coach — prioritize strength and yoga; cycling/running as conditioning only',
      general_fitness: 'General Fitness Coach — balance all activity types equally',
      comeback: 'Comeback Coach — consistency first, celebrate every session, warm supportive tone',
    };
    const specializationLine = coach_specialization
      ? `\nCOACH SPECIALIZATION: ${specializationLabels[coach_specialization] ?? coach_specialization}`
      : '';

    // ── Re-Engager Constraints ───────────────────────────────────────────────
    const isReEngager = fitness_mode === 're_engager';
    const fitnessModeLine = isReEngager
      ? `\n\nRE-ENGAGER CONSTRAINTS (STRICT — DO NOT EXCEED):
- Maximum 3 workouts per week. Never schedule more than 3 sessions in any 7-day window.
- Maximum 45 minutes per session. Keep each workout short and achievable.
- Intensity distribution: 80% of sessions must be "easy" or "recovery". Limit "moderate" to 1x/week max. No "hard" in weeks 1-2.
- Vary activity types across the week to keep sessions engaging (e.g., yoga + bike + strength).
- Write workout descriptions that celebrate showing up — avoid performance metrics and pressure language.
- Plan descriptions should feel encouraging and momentum-building, not demanding.`
      : '';

    // ── Cross-Activity Recovery Rules ────────────────────────────────────────
    const recoveryRules = `
CROSS-ACTIVITY RECOVERY RULES:
- Do NOT schedule heavy strength the day after a hard bike or run session.
- Yoga and active recovery sessions may follow any workout type — they aid recovery.
- Hiking counts as moderate aerobic volume — treat like a moderate run for recovery purposes (allow 1 rest day after a long hike).
- Allow 48 hours between hard strength sessions targeting the same muscle groups.
- Swimming is low-impact and can be scheduled on recovery days after hard efforts.`;

    const prompt = `Based on ${athleteName}'s data, create a detailed ${weeksAvailable}-week multi-modal training plan for: "${goal}", ending on ${eventDate}.${specializationLine}${fitnessModeLine}
${activityMixSection}

${durationConstraint}

RECENT TRAINING DATA:
- Weekly volume (primary sport): ${weeklyVolMiles} miles
- Recent activities logged: ${recentActivities.length}
- Average activity distance: ${avgDistMiles} miles
- Average speed: ${avgSpeedMph} mph
- Training consistency: ${riderProfile.discipline}, Stamina: ${riderProfile.stamina}

PREFERENCES: ${preferences || 'None specified'}

PERIODIZATION SCHEDULE:
${periodizationStructure}

WEEKLY SCHEDULE CONSTRAINTS (STRICT):
${scheduleConstraints || "No specific day-by-day constraints provided."}

${recoveryRules}

CRITICAL SCHEDULING RULES:
1. Adhere strictly to schedule constraints above — "Rest" days must have NO workout scheduled (omit entirely).
2. If a day has a time limit (e.g., "45 mins"), workout duration MUST NOT exceed it.
3. Maximum 1 workout per day.
4. DO NOT generate workout objects for rest days.
5. Final week: reduce volume by 50% (Taper).
6. Starting week: calibrate based on Stamina=${riderProfile.stamina}, Discipline=${riderProfile.discipline}.

RESPONSE FORMAT:
Output a JSON object with two root keys: "reasoning" and "workouts".
Generate "reasoning" FIRST to ground your workout decisions.

SCHEMA:
{
  "reasoning": {
    "athleteAssessment": {
      "fitnessLevel": "string",
      "constraints": "string",
      "strengths": ["string"],
      "limiters": ["string"]
    },
    "macroCycle": {
      "strategy": "string",
      "phases": [{ "weeks": "string", "name": "string", "goal": "string" }]
    },
    "weeklyLogic": [{
      "week": number,
      "focus": "string",
      "targetTSS": number,
      "keyWorkoutLogic": "string"
    }]
  },
  "workouts": [
    {
      "week": number,
      "dayOfWeek": number,
      "name": "string",
      "type": "bike" | "run" | "swim" | "strength" | "yoga" | "hiking",
      "phase": "Base" | "Build" | "Peak" | "Taper",
      "description": "string",
      "duration": number,
      "distance": number,
      "intensity": "easy" | "moderate" | "hard" | "recovery",
      "activity_metadata": {
        "sets_reps": "string (strength only, e.g. '3x10 squats')",
        "yoga_style": "string (yoga only, e.g. 'restorative')",
        "elevation_gain": number,
        "terrain": "string (hiking only)",
        "pace_zone": "string (run only)"
      }
    }
  ]
}

Note: activity_metadata is optional — include only the relevant fields for the workout type. Omit activity_metadata entirely for bike and swim workouts.
Generate ${numWorkouts} days of plan coverage (workouts + implied rest days) by omitting workouts on rest days.`;

    console.log(`Generating multi-modal training plan (${weeksAvailable} weeks, specialization: ${coach_specialization ?? 'none'}, mode: ${fitness_mode ?? 'performance'})...`);

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
            content: `You are an expert multi-modal fitness coach creating personalized training plans. You coach across cycling, running, strength training, yoga, and hiking.
You output strictly valid JSON only.
Include YouTube video links in workout descriptions using this format: [Video Title](https://youtube.com/watch?v=VIDEO_ID) by Creator Name.
Prioritize these creators by activity type:
- Cycling/Running: GCN, TrainerRoad, Dylan Johnson, Cam Nicholls
- Strength: Athlean-X, Dialed Health
- Yoga/Mobility: Yoga with Adriene, MoveWithNicole
- Hiking: REI, Outdoor Boys`,
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

    console.log(`Response received (finish_reason: ${finishReason}), parsing...`);
    if (finishReason === 'length') console.warn("Response truncated due to token limit!");

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const cleaned = content
        .replace(/^\s*```json\s*/, "")
        .replace(/^\s*```\s*/, "")
        .replace(/\s*```\s*$/, "");
      result = JSON.parse(cleaned);
    }

    const { reasoning, workouts } = result;

    let description = "No overview provided.";
    if (reasoning) {
      const { athleteAssessment, macroCycle } = reasoning as PlanReasoning;
      description = `**Strategy:** ${macroCycle.strategy}\n\n**Assessment:** ${athleteAssessment.fitnessLevel}\n\n**Phases:**\n${macroCycle.phases.map((p: { name: string; weeks: string; goal: string }) => `- ${p.name} (${p.weeks}): ${p.goal}`).join('\n')}`;
    }

    if (!Array.isArray(workouts) || workouts.length === 0) {
      throw new Error("AI did not return any workouts in the expected format.");
    }

    console.log(`Successfully parsed ${workouts.length} workouts`);

    return new Response(
      JSON.stringify({ description, reasoning, workouts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in openai-training-plan function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
