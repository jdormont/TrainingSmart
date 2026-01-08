// OpenAI API service for training advice
import axios from 'axios';
import type { StravaActivity, StravaAthlete, StravaStats, ChatMessage, OuraSleepData, OuraReadinessData, Workout, DailyMetric } from '../types';
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
    coach_persona?: string;
    weekly_hours?: number;
  };
}

class OpenAIService {
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  private supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  constructor() {
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      console.error('Supabase configuration missing. OpenAI features will not work.');
    }
  }

  private buildSystemPrompt(context: TrainingContext): string {
    // Get custom system prompt from localStorage, or use default
    const customPrompt = localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT);
    let basePrompt = customPrompt || `You are TrainingSmart AI, an elite cycling and running coach with direct access to the user's Strava training data.

CURRENT USER CONTEXT:
- **Training Goal:** {{USER_TRAINING_GOAL}} (e.g., Event Prep, Weight Loss, General Fitness)
- **Coaching Style:** {{USER_COACH_STYLE}} (e.g., Supportive, Drill Sergeant, Analytical)
- **Weekly Hours Cap:** {{USER_WEEKLY_HOURS}} hours

CORE COACHING PROTOCOLS:
1. **Data-First Analysis:** Never give generic advice. Always anchor your feedback in the user's recent activity data.
   - If they ask "How did I do?", analyze their Heart Rate relative to Pace/Power.
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
- **Technique/Culture:** GCN (Global Cycling Network), Cam Nicholls
- **Science/Training:** Dylan Johnson, Peter Attia MD, TrainerRoad
- **Maintenance:** GMBN Tech, Park Tool
- **Strength/Mobility:** Yoga with Adriene (Yoga), Athlean-X (Strength), Dialed Health

**Video Output Format:**
When sharing a video, use this format:
"I found a great guide on this: **[Video Title](EXACT_URL_FROM_TOOL)** by [Creator Name]"

RESPONSE GUIDELINES:
- Keep responses concise (max 3-4 paragraphs) unless asked for a deep dive.
- **Use Markdown tables** when comparing activities or presenting a breakdown of data (e.g., "Date | Distance | Avg HR | Power").
- Use bullet points for workout steps or analysis breakdown.
- End with a specific question to keep the user engaged (e.g., "Ready to try those intervals tomorrow?" or "How did your legs feel on that climb?").`;

    // Inject user profile values into the prompt
    if (context.userProfile) {
      const trainingGoal = context.userProfile.training_goal || 'Not specified';
      const coachPersona = context.userProfile.coach_persona || 'Supportive';
      const weeklyHours = context.userProfile.weekly_hours || 0;

      basePrompt = basePrompt
        .replace('{{USER_TRAINING_GOAL}}', trainingGoal)
        .replace('{{USER_COACH_STYLE}}', coachPersona)
        .replace('{{USER_WEEKLY_HOURS}}', weeklyHours.toString());
    } else {
      basePrompt = basePrompt
        .replace('{{USER_TRAINING_GOAL}}', 'Not specified')
        .replace('{{USER_COACH_STYLE}}', 'Supportive')
        .replace('{{USER_WEEKLY_HOURS}}', '0');
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
        const sleepHours = Math.round((dm.sleep_minutes / 60) * 10) / 10;

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

    return `${basePrompt}

ATHLETE PROFILE:
- Name: ${context.athlete.firstname} ${context.athlete.lastname}
- Location: ${context.athlete.city}, ${context.athlete.state}
- Recent activities: ${context.recentActivities.length} activities

RECENT TRAINING DATA:
- This week: ${(context.weeklyVolume.distance * 0.000621371).toFixed(1)}mi over ${context.weeklyVolume.activities} activities
- Total time: ${Math.round(context.weeklyVolume.time / 3600)}h ${Math.round((context.weeklyVolume.time % 3600) / 60)}m
- Recent activities: ${context.recentActivities.slice(0, 5).map(a => {
      const parts = [`${a.type}: ${(a.distance * 0.000621371).toFixed(1)}mi in ${Math.round(a.moving_time / 60)}min`];
      if (a.total_elevation_gain > 0) parts.push(`${Math.round(a.total_elevation_gain * 3.28084)}ft elev`);
      if (a.average_heartrate) parts.push(`${Math.round(a.average_heartrate)}bpm avg HR`);
      if (a.average_watts) parts.push(`${Math.round(a.average_watts)}w avg pwr`);
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
    timeframe: string,
    preferences: string
  ): Promise<{ description: string; workouts: (Partial<Workout> & { dayOfWeek?: number; week?: number })[] }> {
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
          timeframe,
          preferences,
          weeklyVolume: context.weeklyVolume,
          recentActivities: context.recentActivities,
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