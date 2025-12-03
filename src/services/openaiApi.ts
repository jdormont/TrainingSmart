// OpenAI API service for training advice
import axios from 'axios';
import type { StravaActivity, StravaAthlete, StravaStats, ChatMessage, OuraSleepData, OuraReadinessData } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { calculateSleepScore } from '../utils/sleepScoreCalculator';

// OpenAI Configuration
const OPENAI_CONFIG = {
  MODEL: 'gpt-4o-mini', // More cost-effective than gpt-4
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
} as const;

interface TrainingContext {
  athlete: StravaAthlete;
  recentActivities: StravaActivity[];
  stats: StravaStats;
  weeklyVolume: {
    distance: number;
    time: number;
    activities: number;
  };
  recovery?: {
    sleepData: OuraSleepData | null;
    readinessData: OuraReadinessData | null;
    sleepScore?: number;
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
    const basePrompt = customPrompt || `You are an expert personal running and cycling coach with access to the user's real Strava training data. 

COACHING GUIDELINES:
- Base all advice on their actual training data and patterns
- Consider their recent training load and recovery needs
- Provide specific, actionable recommendations
- Be encouraging but realistic about their current fitness level
- Ask clarifying questions when needed to give better advice
- Reference their actual activities when relevant
- Consider training progression and injury prevention
- IMPORTANT: Factor in sleep quality and readiness scores when giving training advice
- If recovery data shows poor sleep or low readiness, recommend easier training or rest
- Use recovery metrics to suggest optimal training timing and intensity
- When recommending exercises, include YouTube video links from reputable fitness creators
- Prioritize videos with high view counts (100k+) and from creators with large subscriber bases
- Recommend specific cycling content creators who match the user's needs and goals

EXERCISE VIDEO GUIDELINES:
- Always include YouTube links for exercises, stretches, or training techniques
- Format as: **Exercise Name**: [Video Title](https://youtube.com/watch?v=VIDEO_ID) by Creator Name
- Prioritize these top cycling content creators when relevant:
  * **GCN (Global Cycling Network)** - 2M+ subscribers, excellent technique videos
  * **TrainerRoad** - 200k+ subscribers, structured training content
  * **Dylan Johnson** - 300k+ subscribers, science-based training
  * **Cam Nicholls** - 500k+ subscribers, bike fitting and technique
  * **GMBN Tech** - 1M+ subscribers, bike maintenance and setup
  * **Peter Attia MD** - 500k+ subscribers, health and longevity for athletes
  * **Yoga with Adriene** - 12M+ subscribers, yoga for cyclists
  * **Athlean-X** - 13M+ subscribers, strength training for athletes
- Include brief descriptions of why each creator is valuable for cyclists
- Mention subscriber counts and specialties when recommending creators
Respond conversationally as their personal coach who knows their training history intimately.`;

    // Build recovery context string
    let recoveryContext = '';
    if (context.recovery?.sleepData || context.recovery?.readinessData) {
      recoveryContext = '\n\nRECOVERY DATA:';
      
      if (context.recovery.sleepData) {
        const sleep = context.recovery.sleepData;
        const sleepHours = Math.round((sleep.total_sleep_duration / 3600) * 10) / 10;
        const deepSleepMin = Math.round(sleep.deep_sleep_duration / 60);
        const remSleepMin = Math.round(sleep.rem_sleep_duration / 60);
        
        recoveryContext += `
- Last night's sleep: ${sleepHours}h total (${sleep.efficiency}% efficiency)
- Sleep quality: ${deepSleepMin}min deep sleep, ${remSleepMin}min REM sleep
- Sleep disturbances: ${sleep.restless_periods} restless periods
- Resting heart rate: ${sleep.lowest_heart_rate} bpm`;
        
        if (context.recovery.sleepScore) {
          recoveryContext += `
- Sleep score: ${context.recovery.sleepScore}/100`;
        }
      }
      
      if (context.recovery.readinessData) {
        const readiness = context.recovery.readinessData;
        recoveryContext += `
- Readiness score: ${readiness.score}/100
- Recovery recommendation: ${
          readiness.score >= 85 ? 'Ready for intense training' :
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
- Recent activities: ${context.recentActivities.slice(0, 5).map(a => 
  `${a.type}: ${(a.distance * 0.000621371).toFixed(1)}mi in ${Math.round(a.moving_time / 60)}min`
).join(', ')}${recoveryContext}

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
        }
      );

      return response.data.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      
      // Handle specific error types
      if (axios.isAxiosError(error)) {
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
  ): Promise<{ description: string; workouts: any[] }> {
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
          timeout: 60000,
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
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${message}`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to generate training plan. Please try again.');
    }
  }

  async modifyWeeklyPlan(
    existingWorkouts: any[],
    modificationRequest: string,
    context: TrainingContext,
    weekNumber: number
  ): Promise<any[]> {
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
          timeout: 30000,
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
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error: ${message}`);
      }

      throw new Error('Failed to modify training plan. Please try again.');
    }
  }
}

export const openaiService = new OpenAIService();