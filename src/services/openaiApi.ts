// OpenAI API service for training advice
import axios from 'axios';
import type { StravaActivity, StravaAthlete, StravaStats, ChatMessage, OuraSleepData, OuraReadinessData, Workout, DailyMetric, PlanReasoning, ActivityMixItem } from '../types';
import { UserStreak } from './streakService';
import { STORAGE_KEYS } from '../utils/constants';


// OpenAI Configuration
const OPENAI_CONFIG = {
  MODEL: 'gpt-4o-mini', // More cost-effective than gpt-4
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
} as const;

interface TrainingContext {
  athlete: StravaAthlete;
  recentActivities: StravaActivity[];
  stats?: StravaStats;
  streak?: UserStreak | null;
  weeklyVolume: {
    distance: number;
    time: number;
    activities: number;
  };
  recovery?: {
    sleepData: OuraSleepData | null;
    readinessData: OuraReadinessData | null;
    dailyMetric?: DailyMetric | null; // Added manual/synced metric support
    sleepScore?: number;
  };
  userProfile?: {
    training_goal?: string;
    primary_goal?: string;
    coach_persona?: string;
    weekly_hours?: number;
    weekly_availability_days?: number;
    weekly_availability_duration?: number;
    ftp?: number;
    // Phase 1 — conversational onboarding fields
    coach_specialization?: string;
    fitness_mode?: string;
    // Phase 2 — activity mix
    activity_mix?: ActivityMixItem[];
  };
}

const SPECIALIZATION_PREFIXES: Record<string, string> = {
  endurance: `COACH SPECIALIZATION — ENDURANCE COACH:
You are an endurance-focused AI coach specializing in cycling and running. Emphasize aerobic development, power zones, pace progression, FTP, and structured periodization. Surface performance metrics prominently and give data-driven feedback anchored in the athlete's power and heart rate data.`,

  strength_mobility: `COACH SPECIALIZATION — STRENGTH & MOBILITY COACH:
You are a strength and mobility AI coach. Prioritize strength training, yoga, functional movement, sets/reps, and recovery. Avoid unsolicited cycling-specific feedback. When activities include rides, acknowledge them but keep focus on strength and mobility outcomes.`,

  general_fitness: `COACH SPECIALIZATION — GENERAL FITNESS COACH:
You are a balanced, multi-modal AI fitness coach. Treat all activity types equally — cycling, running, strength, yoga, and hiking. Balance training advice across the athlete's full activity mix without favoring any single sport.`,

  comeback: `COACH SPECIALIZATION — COMEBACK COACH:
You are an encouraging, consistency-first comeback coach. Be relentlessly positive and celebrate every session. Never criticize missed workouts — reframe them as opportunities. Focus on momentum, streaks, and showing up. Keep language warm, simple, and motivating. Never lead with performance metrics unless the athlete asks.`,
};

const RE_ENGAGER_ADDENDUM = `
FITNESS MODE — RE-ENGAGER:
This athlete is rebuilding consistency after a break. Plans should default to 2–3 sessions/week at 20–45 minutes each. Prioritize showing up over volume or intensity. Celebrate streaks and small wins. When suggesting next steps, use "Ready to level up?" framing only after sustained consistency — never pressure the athlete.`;

class OpenAIService {
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  private supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  constructor() {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration missing. OpenAI features will not work.');
    }
  }

  private buildSystemPrompt(context: TrainingContext): string {
    // Build specialization prefix based on coach_specialization and fitness_mode
    const specialization = context.userProfile?.coach_specialization;
    const fitnessMode = context.userProfile?.fitness_mode;
    let specializationBlock = '';
    if (specialization && SPECIALIZATION_PREFIXES[specialization]) {
      specializationBlock = SPECIALIZATION_PREFIXES[specialization];
    }
    if (fitnessMode === 're_engager') {
      specializationBlock += RE_ENGAGER_ADDENDUM;
    }

    // Get custom system prompt from localStorage, or use default
    const customPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    let basePrompt = customPrompt || `You are TrainingSmart AI, a multi-modal fitness coach with direct access to the user's Strava training data.

CURRENT USER CONTEXT:
- **Training Goal:** {{USER_TRAINING_GOAL}}
- **Coaching Style:** {{USER_COACH_STYLE}} (e.g., Supportive, Drill Sergeant, Analytical)
- **Weekly Availability:** {{USER_WEEKLY_DAYS}} days/week, {{USER_SESSION_DURATION}} min/session

CORE COACHING PROTOCOLS:
1. **Data-First Analysis:** Never give generic advice. Always anchor your feedback in the user's recent activity data.
   - If they ask "How did I do?", analyze their Heart Rate relative to Pace/Power/Effort.
   - Look for signs of overtraining (decreasing HR variability, plateauing performance) or undertraining.
   - Acknowledge consistency streaks or missed workouts immediately.

2. **Persona Adaptation:**
   - If Style is **"Supportive"**: Focus on consistency, mental health, and celebrating small wins. Be gentle with missed workouts.
   - If Style is **"Drill Sergeant"**: Focus on discipline, accountability, and "no excuses." Call out skipped sessions directly.
   - If Style is **"Analytical"**: Focus on the numbers (TSS, Watts/kg, HR Zones). Be precise and scientific.

3. **Safety & Progression:**
   - Adhere to the 10% rule (don't increase volume by >10% weekly).
   - If the user reports pain, immediately switch to "Physio Mode" and recommend rest or medical consultation.

CONTENT & VIDEO RECOMMENDATIONS (CRITICAL):
You have access to a tool to search YouTube. **DO NOT hallucinate video URLs.**
When recommending exercises or deep dives, you MUST use the provided tool to find a *real* video URL before displaying it.

**Trusted Creators (Prioritize these sources):**
- **Endurance/Cycling:** GCN (Global Cycling Network), Dylan Johnson, TrainerRoad, Cam Nicholls
- **Running:** The Run Experience, Running Channel
- **Strength & Functional:** Athlean-X, Jeff Nippard, Dialed Health
- **Yoga & Mobility:** Yoga with Adriene, Tom Merrick (The Bodyweight Warrior)
- **Hiking & Outdoors:** REI, Andrew Skurka
- **Science/Health:** Peter Attia MD, Huberman Lab
- **Maintenance:** GMBN Tech, Park Tool

**Video Output Format:**
When sharing a video, use this format:
"I found a great guide on this: **[Video Title](EXACT_URL_FROM_TOOL)** by [Creator Name]"

RESPONSE GUIDELINES:
- Keep responses concise (max 3-4 paragraphs) unless asked for a deep dive.
- **Use Markdown tables** when comparing activities or presenting a breakdown of data (e.g., "Date | Distance | Avg HR | Power").
- Use bullet points for workout steps or analysis breakdown.
- End with a specific question to keep the user engaged (e.g., "Ready to try those intervals tomorrow?" or "How did that session feel?").`;

    // Inject user profile values into the prompt
    if (context.userProfile) {
      const trainingGoal = context.userProfile.primary_goal || context.userProfile.training_goal || 'Not specified';
      const coachPersona = context.userProfile.coach_persona || 'Supportive';
      const weeklyDays = context.userProfile.weekly_availability_days ?? context.userProfile.weekly_hours ?? 0;
      const sessionDuration = context.userProfile.weekly_availability_duration || 0;

      basePrompt = basePrompt
        .replace('{{USER_TRAINING_GOAL}}', trainingGoal)
        .replace('{{USER_COACH_STYLE}}', coachPersona)
        .replace('{{USER_WEEKLY_DAYS}}', weeklyDays.toString())
        .replace('{{USER_SESSION_DURATION}}', sessionDuration.toString());

      if (context.userProfile.ftp) {
        basePrompt = basePrompt.replace('CURRENT USER CONTEXT:', `CURRENT USER CONTEXT:\n- **FTP:** ${context.userProfile.ftp}w`);
      }
    } else {
      basePrompt = basePrompt
        .replace('{{USER_TRAINING_GOAL}}', 'Not specified')
        .replace('{{USER_COACH_STYLE}}', 'Supportive')
        .replace('{{USER_WEEKLY_DAYS}}', '0')
        .replace('{{USER_SESSION_DURATION}}', '0');
    }

    // Build activity mix section
    const activityMix = context.userProfile?.activity_mix;
    let activityMixSection = '';
    if (activityMix && activityMix.length > 0) {
      const ACTIVITY_DISPLAY: Record<string, string> = {
        run: 'Running', bike: 'Cycling', swim: 'Swimming',
        strength: 'Strength Training', yoga: 'Yoga', hiking: 'Hiking', rest: 'Rest',
      };
      const PRIORITY_LABELS: Record<number, string> = { 1: 'primary', 2: 'secondary', 3: 'supplemental' };
      const mixList = activityMix
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map(item => `${ACTIVITY_DISPLAY[item.type] || item.type} (${PRIORITY_LABELS[item.priority] || 'other'})`)
        .join(', ');
      activityMixSection = `\nACTIVITY PRIORITIES: ${mixList}`;
    }

    // Build recovery context string
    let recoveryContext = '';
    const recovery = context.recovery;

    if (recovery?.sleepData || recovery?.readinessData || recovery?.dailyMetric) {
      recoveryContext = '\n\nRECOVERY DATA:';

      // 1. Prioritize Oura Data found
      if (recovery.sleepData) {
        const sleep = recovery.sleepData;
        const sleepHours = Math.round((sleep.total_sleep_duration / 3600) * 10) / 10;
        const deepSleepMin = Math.round(sleep.deep_sleep_duration / 60);
        const remSleepMin = Math.round(sleep.rem_sleep_duration / 60);

        recoveryContext += `
- Last night's sleep (Oura): ${sleepHours}h total (${sleep.efficiency}% efficiency)
- Sleep quality: ${deepSleepMin}min deep sleep, ${remSleepMin}min REM sleep
- Sleep disturbances: ${sleep.restless_periods} restless periods
- Resting heart rate: ${sleep.lowest_heart_rate} bpm`;

        if (recovery.sleepScore) {
          recoveryContext += `
- Sleep score: ${recovery.sleepScore}/100`;
        }
      }
      // 2. Fallback to Daily Metric (Apple Health / Manual)
      else if (recovery.dailyMetric) {
        const dm = recovery.dailyMetric;
        const sleepHours = dm.sleep_minutes ? Math.round((dm.sleep_minutes / 60) * 10) / 10 : 0;

        recoveryContext += `
- Last night's sleep (Health Data): ${sleepHours}h total
- Resting heart rate: ${dm.resting_hr} bpm
- HRV (RMSSD): ${dm.hrv} ms`;

        if (dm.recovery_score) {
          recoveryContext += `
- Calculated Recovery Score: ${dm.recovery_score}/100`;
        }
      }

      // Readiness Data (Oura)
      if (recovery.readinessData) {
        const readiness = recovery.readinessData;
        recoveryContext += `
- Readiness score: ${readiness.score}/100
- Recovery recommendation: ${readiness.score >= 85 ? 'Ready for intense training' :
            readiness.score >= 70 ? 'Moderate training recommended' :
              'Focus on recovery today'
          }`;
      }

      recoveryContext += '\n\nIMPORTANT: Use this recovery data to inform your training recommendations. Poor sleep or low readiness should lead to easier training suggestions.';
    }

    // Build Streak Context
    let streakContext = '';
    if (context.streak) {
      streakContext = `
STREAK CONTEXT:
- Current Streak: ${context.streak.current_streak} days
- Longest Streak: ${context.streak.longest_streak} days
- Freeze Bank: ${context.streak.streak_freezes} freezes available
- Last Activity: ${context.streak.last_activity_date || 'None'}
`;
    }

    // Only show power metrics for endurance-focused coaches
    const showPowerMetrics = !specialization || specialization === 'endurance';

    return `${specializationBlock ? specializationBlock + '\n\n' : ''}${basePrompt}

ATHLETE PROFILE:
- Name: ${context.athlete.firstname} ${context.athlete.lastname}
- Location: ${context.athlete.city}, ${context.athlete.state}
- Recent activities: ${context.recentActivities.length} activities${activityMixSection}

RECENT TRAINING DATA:
- This week: ${context.weeklyVolume.activities} activities, ${Math.round(context.weeklyVolume.time / 3600)}h ${Math.round((context.weeklyVolume.time % 3600) / 60)}m total
${streakContext}
- Recent activities:
  ${context.recentActivities.slice(0, 5).map(a => {
      const distanceMi = a.distance * 0.000621371;
      const hasDistance = distanceMi > 0.1;
      const parts = [hasDistance ? `${a.type}: ${distanceMi.toFixed(1)}mi in ${Math.round(a.moving_time / 60)}min` : `${a.type}: ${Math.round(a.moving_time / 60)}min`];
      if (a.total_elevation_gain > 10) parts.push(`${Math.round(a.total_elevation_gain * 3.28084)}ft elev`);
      if (a.average_heartrate) parts.push(`${Math.round(a.average_heartrate)}bpm avg HR`);
      if (showPowerMetrics) {
        if (a.average_watts) parts.push(`${Math.round(a.average_watts)}w avg pwr`);
        if (a.max_watts) parts.push(`${Math.round(a.max_watts)}w max pwr`);
        if (a.device_watts === false) parts.push(`(estimated pwr)`);
      }
      return parts.join(', ');
    }).join('\n  ')}${recoveryContext}

Use the coaching style and personality defined above, while incorporating this real-time training data into your responses.`;
  }

  async getChatResponse(
    messages: ChatMessage[],
    context: TrainingContext
  ): Promise<string> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration not found. Please check your environment variables.');
    }

    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const response = await axios.post(
        `${this.supabaseUrl}/functions/v1/openai-chat`,
        {
          messages,
          systemPrompt,
          maxTokens: OPENAI_CONFIG.MAX_TOKENS,
          temperature: OPENAI_CONFIG.TEMPERATURE,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60s timeout for chat response
        }
      );

      return response.data.content;
    } catch (error) {
      console.error('OpenAI API error:', error);

      // Handle specific error types
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('AI Coach check-in timed out. Please try again.');
        }
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Network error. Please check your internet connection.');
        }
        if (error.response?.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please wait a moment and try again, or check your OpenAI account limits.');
        }

        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error (${status}): ${message}`);
      }

      throw new Error('Failed to get AI response');
    }
  }

  async generateTrainingPlan(
    context: TrainingContext,
    goal: string,
    eventDate: string,
    startDate: string,
    riderProfile: any, // { stamina: { level: number, ... }, discipline: ... }
    preferences: string,
    dailyAvailability?: Record<string, string>
  ): Promise<{ description: string; reasoning?: PlanReasoning; workouts: (Partial<Workout> & { dayOfWeek?: number; week?: number; phase?: string })[] }> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration not found. Please check your environment variables.');
    }

    try {
      console.log('Sending training plan request to Edge Function...');
      const response = await axios.post(
        `${this.supabaseUrl}/functions/v1/openai-training-plan`,
        {
          athleteName: context.athlete.firstname,
          goal,
          eventDate,
          startDate,
          riderProfile: {
            stamina: riderProfile.stamina.level, // Passing just the level or description
            discipline: riderProfile.discipline.level
          },
          preferences,
          dailyAvailability,
          weeklyVolume: context.weeklyVolume,
          recentActivities: context.recentActivities,
          coach_specialization: context.userProfile?.coach_specialization,
          fitness_mode: context.userProfile?.fitness_mode,
          activity_mix: context.userProfile?.activity_mix,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 300000, // 5 minute timeout for plan generation
        }
      );

      console.log('Received response from Edge Function');
      return response.data;

    } catch (error) {
      console.error('OpenAI API error:', error);

      if (error instanceof Error && error.message.includes('did not return any workouts')) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        if (error.response?.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your configuration.');
        }

        // Try to interpret the error message from the backend response
        const backendError = error.response?.data?.error;
        const message = typeof backendError === 'string' ? backendError : (backendError?.message || error.message);
        throw new Error(`OpenAI API error: ${message}`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to generate training plan. Please try again.');
    }
  }

  async modifyWeeklyPlan(
    existingWorkouts: (Workout | (Partial<Workout> & { dayOfWeek?: number }))[],
    modificationRequest: string,
    context: TrainingContext,
    weekNumber: number
  ): Promise<(Partial<Workout> & { dayOfWeek?: number })[]> {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      throw new Error('Supabase configuration not found. Please check your environment variables.');
    }

    try {
      console.log('Sending plan modification request to Edge Function...');
      const response = await axios.post(
        `${this.supabaseUrl}/functions/v1/openai-modify-plan`,
        {
          existingWorkouts,
          modificationRequest,
          athleteName: context.athlete.firstname,
          weekNumber,
          weeklyVolume: context.weeklyVolume,
          recentActivities: context.recentActivities,
          recovery: context.recovery ? {
            sleepScore: context.recovery.sleepScore,
            readinessScore: context.recovery.readinessData?.score,
          } : undefined,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minute timeout for plan modification
        }
      );

      console.log('Received modification response from Edge Function');
      return response.data.workouts;
    } catch (error) {
      console.error('OpenAI API error during plan modification:', error);

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        if (error.response?.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
        }
        if (error.response?.status === 401) {
          throw new Error('Invalid OpenAI API key. Please check your configuration.');
        }

        // Try to interpret the error message from the backend response
        const backendError = error.response?.data?.error;
        const message = typeof backendError === 'string' ? backendError : (backendError?.message || error.message);
        throw new Error(`OpenAI API error: ${message}`);
      }

      throw new Error('Failed to modify training plan. Please try again.');
    }
  }
}

export const openaiService = new OpenAIService();