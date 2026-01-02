// Weekly Insight Service - Generates personalized training insights
import type { StravaActivity, StravaAthlete, OuraSleepData, OuraReadinessData, ChatSession, StravaStats, DailyMetric } from '../types';
export type { HealthMetrics } from './healthMetricsService';
import { openaiService } from './openaiApi';
import { supabaseChatService } from './supabaseChatService';
import { userProfileService } from './userProfileService';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';

export interface WeeklyInsight {
  id: string;
  type: 'recovery' | 'training' | 'pattern' | 'goal' | 'consistency';
  title: string;
  message: string;
  confidence: number; // 0-100
  dataPoints: string[];
  generatedAt: Date;
  weekOf: Date;

  // New fields for Bio-Aware UI
  actionLabel?: string;
  actionLink?: string; // Deep link or route
  pacingProgress?: number; // 0-100+ for volume vs goal
  readinessScore?: number; // Today's recovery/readiness score
}

interface WeeklyInsightCache {
  insight: WeeklyInsight;
  weekOf: string; // ISO string for comparison
}

interface Correlation {
  sleepHours: number;
  sleepEfficiency: number;
  activitySpeed: number;
  activityDistance: number;
}

interface WeeklyData {
  week: number;
  activities: number;
  distance: number;
  time: number;
}

interface TrainingPatterns {
  trainingConsistency: {
    weeks: WeeklyData[];
    avgActivitiesPerWeek: number;
    avgDistancePerWeek: number;
    consistency: number;
  };
  recoveryTrends: {
    available: boolean;
    avgSleepHours?: number;
    avgReadiness?: number;
    avgSleepEfficiency?: number;
    dataPoints?: number;
  };
  performanceCorrelations: {
    available: boolean;
    correlations?: number;
    avgSleepBeforeRides?: number;
  };
  weeklyVolume: {
    thisWeek: number;
    lastWeek: number;
    change: number;
    activities: number;
  };
  intensityDistribution: {
    easy: number;
    moderate: number;
    hard: number;
    totalActivities: number;
  };
}

class WeeklyInsightService {
  private readonly CACHE_KEY = 'weekly_insight_cache';

  /*
  // Check if we have a valid cached insight for this week
  private getCachedInsight(): WeeklyInsight | null {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (!cached) return null;

      const cache: WeeklyInsightCache = JSON.parse(cached);
      const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const cacheWeekStart = format(currentWeekStart, 'yyyy-MM-dd');

      // Check if cached insight is for current week
      if (cache.weekOf === cacheWeekStart) {
        return {
          ...cache.insight,
          generatedAt: new Date(cache.insight.generatedAt),
          weekOf: new Date(cache.insight.weekOf)
        };
      }

      return null;
    } catch (error) {
      console.warn('Failed to load cached weekly insight:', error);
      return null;
    }
  }
  */

  // Cache the insight for this week
  private cacheInsight(insight: WeeklyInsight): void {
    try {
      const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const cache: WeeklyInsightCache = {
        insight,
        weekOf: format(currentWeekStart, 'yyyy-MM-dd')
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to cache weekly insight:', error);
    }
  }

  // Analyze patterns in the data
  private analyzePatterns(
    activities: StravaActivity[],
    sleepData: OuraSleepData[],
    readinessData: OuraReadinessData[]
  ) {
    const patterns = {
      trainingConsistency: this.analyzeTrainingConsistency(activities),
      recoveryTrends: this.analyzeRecoveryTrends(sleepData, readinessData),
      performanceCorrelations: this.analyzePerformanceCorrelations(activities, sleepData),
      weeklyVolume: this.analyzeWeeklyVolume(activities),
      intensityDistribution: this.analyzeIntensityDistribution(activities)
    };

    return patterns;
  }

  private analyzeTrainingConsistency(activities: StravaActivity[]) {
    const now = new Date();
    const weeks = [];

    // Analyze last 4 weeks
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const weekActivities = activities.filter(a => {
        const activityDate = new Date(a.start_date_local);
        return activityDate >= weekStart && activityDate <= weekEnd;
      });

      weeks.push({
        week: i,
        activities: weekActivities.length,
        distance: weekActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371, // miles
        time: weekActivities.reduce((sum, a) => sum + a.moving_time, 0) / 3600 // hours
      });
    }

    const avgActivities = weeks.reduce((sum, w) => sum + w.activities, 0) / weeks.length;
    const avgDistance = weeks.reduce((sum, w) => sum + w.distance, 0) / weeks.length;

    return {
      weeks,
      avgActivitiesPerWeek: Math.round(avgActivities * 10) / 10,
      avgDistancePerWeek: Math.round(avgDistance * 10) / 10,
      consistency: this.calculateConsistencyScore(weeks)
    };
  }

  private calculateConsistencyScore(weeks: WeeklyData[]): number {
    if (weeks.length < 2) return 0;

    const distances = weeks.map(w => w.distance);
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency
    // Normalize to 0-100 scale
    const consistencyScore = Math.max(0, 100 - (stdDev / mean) * 100);
    return Math.round(consistencyScore);
  }

  private analyzeRecoveryTrends(sleepData: OuraSleepData[], readinessData: OuraReadinessData[]) {
    if (sleepData.length === 0 && readinessData.length === 0) {
      return { available: false };
    }

    const avgSleepHours = sleepData.length > 0
      ? sleepData.reduce((sum, s) => sum + s.total_sleep_duration, 0) / sleepData.length / 3600
      : 0;

    const avgReadiness = readinessData.length > 0
      ? readinessData.reduce((sum, r) => sum + r.score, 0) / readinessData.length
      : 0;

    const avgSleepEfficiency = sleepData.length > 0
      ? sleepData.reduce((sum, s) => sum + s.efficiency, 0) / sleepData.length
      : 0;

    return {
      available: true,
      avgSleepHours: Math.round(avgSleepHours * 10) / 10,
      avgReadiness: Math.round(avgReadiness),
      avgSleepEfficiency: Math.round(avgSleepEfficiency),
      dataPoints: sleepData.length + readinessData.length
    };
  }

  private analyzePerformanceCorrelations(activities: StravaActivity[], sleepData: OuraSleepData[]) {
    if (sleepData.length === 0 || activities.length === 0) {
      return { available: false };
    }

    // Simple correlation analysis
    const correlations: Correlation[] = [];

    activities.forEach(activity => {
      const activityDate = activity.start_date_local.split('T')[0];
      const previousNightSleep = sleepData.find(s => {
        const sleepDate = new Date(s.day);
        const activityDateObj = new Date(activityDate);
        // Sleep data is for the night before the activity
        return sleepDate.getTime() === activityDateObj.getTime() - (24 * 60 * 60 * 1000);
      });

      if (previousNightSleep) {
        correlations.push({
          sleepHours: previousNightSleep.total_sleep_duration / 3600,
          sleepEfficiency: previousNightSleep.efficiency,
          activitySpeed: activity.average_speed * 2.237, // mph
          activityDistance: activity.distance * 0.000621371 // miles
        });
      }
    });

    return {
      available: correlations.length > 0,
      correlations: correlations.length,
      avgSleepBeforeRides: correlations.length > 0
        ? Math.round(correlations.reduce((sum, c) => sum + c.sleepHours, 0) / correlations.length * 10) / 10
        : 0
    };
  }

  private analyzeWeeklyVolume(activities: StravaActivity[]) {
    const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
    const lastWeek = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

    const thisWeekActivities = activities.filter(a => {
      const activityDate = new Date(a.start_date_local);
      return activityDate >= thisWeek;
    });

    const lastWeekActivities = activities.filter(a => {
      const activityDate = new Date(a.start_date_local);
      return activityDate >= lastWeek && activityDate < thisWeek;
    });

    const thisWeekDistance = thisWeekActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371;
    const lastWeekDistance = lastWeekActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371;

    const change = lastWeekDistance > 0 ? ((thisWeekDistance - lastWeekDistance) / lastWeekDistance) * 100 : 0;

    return {
      thisWeek: Math.round(thisWeekDistance * 10) / 10,
      lastWeek: Math.round(lastWeekDistance * 10) / 10,
      change: Math.round(change),
      activities: thisWeekActivities.length
    };
  }

  private analyzeIntensityDistribution(activities: StravaActivity[]) {
    const recentActivities = activities.slice(0, 10); // Last 10 activities

    const intensityBuckets = {
      easy: 0,    // < 15 mph
      moderate: 0, // 15-18 mph  
      hard: 0     // > 18 mph
    };

    recentActivities.forEach(activity => {
      const speedMph = activity.average_speed * 2.237;
      if (speedMph < 15) {
        intensityBuckets.easy++;
      } else if (speedMph < 18) {
        intensityBuckets.moderate++;
      } else {
        intensityBuckets.hard++;
      }
    });

    const total = recentActivities.length;
    return {
      easy: total > 0 ? Math.round((intensityBuckets.easy / total) * 100) : 0,
      moderate: total > 0 ? Math.round((intensityBuckets.moderate / total) * 100) : 0,
      hard: total > 0 ? Math.round((intensityBuckets.hard / total) * 100) : 0,
      totalActivities: total
    };
  }

  // Extract recent training themes from chat sessions
  private async extractTrainingThemes(chatSessions: ChatSession[]): Promise<string[]> {
    const themes = new Set<string>();
    const recentSessions = chatSessions
      .filter(s => s.updatedAt > subWeeks(new Date(), 2)) // Last 2 weeks
      .slice(0, 5); // Most recent 5 sessions

    const themeKeywords = {
      'power training': ['power', 'ftp', 'watts', 'threshold'],
      'recovery focus': ['recovery', 'rest', 'tired', 'fatigue', 'sleep'],
      'endurance building': ['endurance', 'long ride', 'base', 'aerobic', 'distance'],
      'speed work': ['speed', 'intervals', 'fast', 'sprint', 'vo2'],
      'climbing': ['climbing', 'hills', 'elevation', 'mountains'],
      'race preparation': ['race', 'event', 'competition', 'taper'],
      'consistency': ['consistent', 'routine', 'schedule', 'regular']
    };

    recentSessions.forEach(session => {
      const allText = session.messages
        .map(m => m.content.toLowerCase())
        .join(' ');

      Object.entries(themeKeywords).forEach(([theme, keywords]) => {
        if (keywords.some(keyword => allText.includes(keyword))) {
          themes.add(theme);
        }
      });
    });

    return Array.from(themes);
  }

  // Build AI prompt for insight generation
  private buildInsightPrompt(
    athlete: StravaAthlete,
    patterns: TrainingPatterns,
    themes: string[]
  ): string {
    return `You are an elite cycling coach analyzing weekly training data. Generate ONE specific, actionable weekly insight.

ATHLETE: ${athlete.firstname} from ${athlete.city}, ${athlete.state}

TRAINING PATTERNS (Last 4 weeks):
- Consistency: ${patterns.trainingConsistency.consistency}/100 score
- Average: ${patterns.trainingConsistency.avgActivitiesPerWeek} rides/week, ${patterns.trainingConsistency.avgDistancePerWeek} miles/week
- This week vs last: ${patterns.weeklyVolume.change > 0 ? '+' : ''}${patterns.weeklyVolume.change}% distance change
- Intensity split: ${patterns.intensityDistribution.easy}% easy, ${patterns.intensityDistribution.moderate}% moderate, ${patterns.intensityDistribution.hard}% hard

${patterns.recoveryTrends.available ? `RECOVERY DATA:
- Average sleep: ${patterns.recoveryTrends.avgSleepHours}h/night (${patterns.recoveryTrends.avgSleepEfficiency}% efficiency)
- Average readiness: ${patterns.recoveryTrends.avgReadiness}/100
- Sleep-performance correlations: ${patterns.performanceCorrelations.available ? 'Available' : 'Limited data'}` : 'RECOVERY DATA: Not available (encourage Oura connection)'}

RECENT TRAINING FOCUS: ${themes.length > 0 ? themes.join(', ') : 'General fitness'}

REQUIREMENTS:
- Reference specific numbers from their data
- Be actionable (what should they focus on this week?)
- Explain the "why" briefly  
- Keep under 60 words
- Choose ONE key insight, not multiple topics
- Make it personal and encouraging

Generate a JSON response with:
{
  "type": "recovery|training|pattern|goal|consistency",
  "title": "Brief headline (max 8 words)",
  "message": "Detailed insight with specific data references",
  "confidence": 85,
  "dataPoints": ["specific data referenced"]
}`;
  }

  // Generate weekly insight using AI
  async generateWeeklyInsight(
    athlete: StravaAthlete,
    activities: StravaActivity[],
    sleepData: OuraSleepData[] = [],
    readinessData: OuraReadinessData[] = [],
    dailyMetrics: DailyMetric[] = []
  ): Promise<WeeklyInsight> {
    console.log('Generating weekly insight...');

    // Skip cache for development/testing of new logic
    // const cached = this.getCachedInsight();
    // if (cached) {
    //   console.log('Using cached weekly insight');
    //   return cached;
    // }

    try {
      // Analyze new Bio-Aware metrics
      const recoveryStatus = this.analyzeRecoveryStatus(dailyMetrics, readinessData);
      const pacingStatus = this.analyzePacingStatus(activities);

      // Generate Matrix Insight based on the intersection
      const matrixInsight = this.generateInsightMatrix(pacingStatus, recoveryStatus);

      if (matrixInsight) {
        console.log('Generated Bio-Aware Matrix Insight:', matrixInsight);

        // Cache and return the matrix insight immediately
        // Cache and return the matrix insight immediately
        const insight: WeeklyInsight = {
          ...matrixInsight,
          generatedAt: new Date(),
          weekOf: startOfWeek(new Date(), { weekStartsOn: 1 })
        };

        this.cacheInsight(insight);
        return insight;
      }

      // Fallback to legacy AI generation if no matrix insight is triggered (e.g. perfect balance)
      // For now, we'll stick to the matrix as primary.

      // Analyze patterns (legacy)
      const patterns = this.analyzePatterns(activities, sleepData, readinessData);
      console.log('Analyzed patterns:', patterns);

      // Extract training themes from recent chats
      const chatSessions = await supabaseChatService.getSessions();
      const themes = await this.extractTrainingThemes(chatSessions);
      console.log('Training themes:', themes);

      // Build AI prompt
      const prompt = this.buildInsightPrompt(athlete, patterns, themes);
      console.log('Generated AI prompt');

      // Get user profile for personalized coaching
      let userProfile;
      try {
        userProfile = await userProfileService.getUserProfile();
      } catch (profileError) {
        console.warn('Could not load user profile for insight generation:', profileError);
      }

      // Get AI response
      const aiResponse = await openaiService.getChatResponse(
        [{ id: 'insight', role: 'user', content: prompt, timestamp: new Date() }],
        {
          athlete,
          recentActivities: activities.slice(0, 10),
          stats: {} as unknown as StravaStats,
          weeklyVolume: {
            distance: patterns.weeklyVolume.thisWeek * 1609.34, // Convert back to meters
            time: 0,
            activities: patterns.weeklyVolume.activities
          },
          userProfile: userProfile ? {
            training_goal: userProfile.training_goal,
            coach_persona: userProfile.coach_persona,
            weekly_hours: userProfile.weekly_hours
          } : undefined
        }
      );

      // Parse AI response
      let parsedResponse;
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch {
        console.warn('Failed to parse AI response as JSON, using fallback');
        // Fallback insight based on patterns
        parsedResponse = this.generateFallbackInsight(patterns);
      }

      const insight: WeeklyInsight = {
        id: `weekly_${Date.now()}`,
        type: parsedResponse.type || 'training',
        title: parsedResponse.title || 'Weekly Training Insight',
        message: parsedResponse.message || 'Keep up the great work with your training consistency!',
        confidence: parsedResponse.confidence || 75,
        dataPoints: parsedResponse.dataPoints || [],
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 })
      };

      // Cache the insight
      this.cacheInsight(insight);
      console.log('Generated and cached weekly insight:', insight);

      return insight;

    } catch (error) {
      console.error('Failed to generate weekly insight:', error);

      // Return fallback insight
      const patterns = this.analyzePatterns(activities, sleepData, readinessData);
      // const chatSessions = await supabaseChatService.getSessions();
      // const themes = await this.extractTrainingThemes(chatSessions);
      const fallback = this.generateFallbackInsight(patterns);

      const insight: WeeklyInsight = {
        id: `weekly_fallback_${Date.now()}`,
        type: fallback.type,
        title: fallback.title,
        message: fallback.message,
        confidence: 60,
        dataPoints: fallback.dataPoints || [],
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 })
      };

      this.cacheInsight(insight);
      return insight;
    }
  }

  // Generate fallback insight when AI fails
  private generateFallbackInsight(patterns: TrainingPatterns) {
    const consistency = patterns.trainingConsistency.consistency;
    const weeklyChange = patterns.weeklyVolume.change;
    const hasRecoveryData = patterns.recoveryTrends.available;

    // Choose insight based on patterns
    if (consistency < 60) {
      return {
        type: 'consistency' as const,
        title: 'Focus on Consistency',
        message: `Your training consistency is ${consistency}/100. Try to maintain ${Math.ceil(patterns.trainingConsistency.avgActivitiesPerWeek)} rides per week for better fitness gains.`,
        dataPoints: [`${consistency}/100 consistency score`, `${patterns.trainingConsistency.avgActivitiesPerWeek} avg rides/week`]
      };
    } else if (Math.abs(weeklyChange) > 25) {
      return {
        type: 'training' as const,
        title: weeklyChange > 0 ? 'Volume Increase Noted' : 'Volume Drop Detected',
        message: `Your weekly distance ${weeklyChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(weeklyChange)}%. ${weeklyChange > 0 ? 'Monitor recovery to avoid overreaching.' : 'Consider gradually building back up.'}`,
        dataPoints: [`${weeklyChange}% weekly change`, `${patterns.weeklyVolume.thisWeek} miles this week`]
      };
    } else if (!hasRecoveryData) {
      return {
        type: 'recovery' as const,
        title: 'Connect Recovery Data',
        message: `Great ${consistency}/100 training consistency! Connect your Oura Ring to get personalized recovery insights and optimize your ${patterns.trainingConsistency.avgDistancePerWeek} miles/week.`,
        dataPoints: [`${consistency}/100 consistency`, `${patterns.trainingConsistency.avgDistancePerWeek} miles/week average`]
      };
    } else {
      return {
        type: 'pattern' as const,
        title: 'Strong Training Pattern',
        message: `Excellent consistency at ${patterns.trainingConsistency.avgActivitiesPerWeek} rides/week with ${patterns.recoveryTrends.avgSleepHours}h average sleep. Your ${patterns.recoveryTrends.avgReadiness}/100 readiness supports current training load.`,
        dataPoints: [`${patterns.trainingConsistency.avgActivitiesPerWeek} rides/week`, `${patterns.recoveryTrends.avgSleepHours}h sleep`, `${patterns.recoveryTrends.avgReadiness}/100 readiness`]
      };
    }
  }

  // Clear cached insight (for testing)
  clearCache(): void {
    localStorage.removeItem(this.CACHE_KEY);
  }

  // --- Bio-Aware Logic ---

  private analyzeRecoveryStatus(
    dailyMetrics: DailyMetric[],
    ouraReadiness: OuraReadinessData[]
  ): { status: 'Fresh' | 'Fatigued' | 'Unknown'; score: number; reason: string } {
    // We prioritize Daily Metrics (which contain HRV/RHR from Oura or Apple Health)
    // We need at least 3 days for "Current" and ideally more for "Baseline"
    if (dailyMetrics.length < 3) {
      // Fallback to Oura Readiness Score if we don't have enough granular metric data
      if (ouraReadiness.length > 0) {
        const sorted = [...ouraReadiness].sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime());
        const score = sorted[0].score;
        return {
          status: score >= 85 ? 'Fresh' : score <= 60 ? 'Fatigued' : 'Unknown',
          score,
          reason: `Oura Readiness is ${score}`
        };
      }
      return { status: 'Unknown', score: 0, reason: 'Insufficient data' };
    }

    // Sort metrics desc (newest first)
    const sorted = [...dailyMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 1. Current State (Last 3 Days Average)
    const currentWindow = sorted.slice(0, 3);
    const avgCurrentHRV = currentWindow.reduce((sum, m) => sum + m.hrv, 0) / currentWindow.length;
    const avgCurrentRHR = currentWindow.reduce((sum, m) => sum + m.resting_hr, 0) / currentWindow.length;

    // 2. Baseline (Previous 27 days, skipping the most recent 3)
    const baselineWindow = sorted.slice(3, 30);
    // If not enough history, use what we have, but require at least 5 days for a valid baseline
    if (baselineWindow.length < 5) {
      return { status: 'Unknown', score: Math.round(avgCurrentHRV), reason: 'Building baseline data...' };
    }

    const avgBaselineHRV = baselineWindow.reduce((sum, m) => sum + m.hrv, 0) / baselineWindow.length;
    const avgBaselineRHR = baselineWindow.reduce((sum, m) => sum + m.resting_hr, 0) / baselineWindow.length;

    // 3. Determine Status
    let status: 'Fresh' | 'Fatigued' | 'Unknown' = 'Unknown';
    const reasonParts = [];

    // Fatigued Conditions:
    // - HRV down > 10% 
    // - RHR up > 5bpm
    const hrvDrop = ((avgCurrentHRV - avgBaselineHRV) / avgBaselineHRV) * 100;
    const rhrRise = avgCurrentRHR - avgBaselineRHR;

    const isFatigued = hrvDrop < -10 || rhrRise > 5;

    // Fresh Conditions:
    // - HRV stable or up ( > -5% drop is "stable")
    // - RHR stable or down ( < 2bpm rise is "stable")
    const isFresh = !isFatigued && (hrvDrop > -2 && rhrRise < 2);

    if (isFatigued) {
      status = 'Fatigued';
      if (hrvDrop < -10) reasonParts.push(`HRV down ${Math.round(Math.abs(hrvDrop))}%`);
      if (rhrRise > 5) reasonParts.push(`RHR up ${Math.round(rhrRise)}bpm`);
    } else if (isFresh) {
      status = 'Fresh';
      reasonParts.push('Biometrics stable/improving');
    } else {
      reasonParts.push('Biometrics normal');
    }

    // Use current Recovery Score as the display score, or calculate a proxy
    const displayScore = currentWindow[0].recovery_score || Math.round((avgCurrentHRV / avgBaselineHRV) * 50 + 50); // Rough proxy if no score

    return {
      status,
      score: displayScore,
      reason: reasonParts.join(', ') || 'No significant change'
    };
  }

  private analyzePacingStatus(activities: StravaActivity[]): { status: 'Behind' | 'Ahead' | 'OnTrack'; progress: number; reason: string } {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekActivities = activities.filter(a => new Date(a.start_date_local) >= thisWeekStart);

    const currentDistance = thisWeekActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371; // miles

    // Dynamic Goal: Average of last 4 weeks that had data
    const weeklyDistances = this.getWeeklyDistances(activities).filter(d => d > 10); // Filter out empty weeks
    let weeklyGoal = weeklyDistances.length > 0
      ? (weeklyDistances.reduce((a, b) => a + b, 0) / weeklyDistances.length) * 0.000621371
      : 30; // Default floor

    // Cap goal variance (don't let it drop too low if user had a bad month)
    weeklyGoal = Math.max(weeklyGoal, 20);

    const progressPercent = (currentDistance / weeklyGoal) * 100;

    // Day of week projection (1-7)
    const dayIndex = new Date().getDay() || 7;
    const expectedProgress = (dayIndex / 7) * 100;
    const buffer = 15; // +/- 15% tolerance

    let status: 'Behind' | 'Ahead' | 'OnTrack' = 'OnTrack';
    if (progressPercent < expectedProgress - buffer) status = 'Behind';
    else if (progressPercent > expectedProgress + buffer) status = 'Ahead';

    return {
      status,
      progress: progressPercent,
      reason: `${Math.round(currentDistance)}mi / ${Math.round(weeklyGoal)}mi goal`
    };
  }

  private generateInsightMatrix(
    pacing: { status: 'Behind' | 'Ahead' | 'OnTrack'; progress: number; reason: string },
    recovery: { status: 'Fresh' | 'Fatigued' | 'Unknown'; score: number; reason: string }
  ): WeeklyInsight | null {
    const dayOfWeek = new Date().getDay();
    const isEarlyWeek = dayOfWeek >= 1 && dayOfWeek <= 2; // Mon/Tue
    const weekOf = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Scenario D: Early Week (Bio-Note)
    if (isEarlyWeek) {
      // If we have recovery data, use it. If "Unknown", maybe skip to patterns? 
      // User requirement: "Keep Planning Mode logic... add bio-note"
      // We'll return a planning insight if we have *any* status other than Unknown, or even if unknown just say "Fresh week"

      const readinessText = recovery.status === 'Fresh' ? 'High' : recovery.status === 'Fatigued' ? 'Low' : 'Stable';

      return {
        id: 'early_week_planning',
        title: recovery.status === 'Fresh' ? 'Green Light for Training' : 'Start Slow This Week',
        message: recovery.status === 'Fresh'
          ? "Fresh week. Your readiness is High. Plan your key interval sessions for early in the week."
          : `Fresh week, but your readiness is ${readinessText}. Consider pushing hard sessions to Thursday/Friday.`,
        type: 'training',
        confidence: 90,
        generatedAt: new Date(),
        weekOf,
        dataPoints: [recovery.reason, pacing.reason],
        actionLabel: 'Plan My Week',
        actionLink: '/chat?initialMessage=Help+me+plan+my+week+accounting+for+my+recovery',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      };
    }

    // Scenario A: Behind Pace + Fatigued (The "Permission to Rest")
    if (pacing.status === 'Behind' && recovery.status === 'Fatigued') {
      return {
        id: 'permission_to_rest',
        title: 'Permission to Rest',
        message: "You're behind volume targets, but your body is fighting stress (Low HRV). Prioritize sleep tonight over chasing miles.",
        type: 'recovery',
        confidence: 95,
        generatedAt: new Date(),
        weekOf,
        dataPoints: [`Readiness: ${recovery.score}`, recovery.reason, pacing.reason],
        actionLabel: 'View Recovery Stats',
        actionLink: '/dashboard',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      };
    }

    // Scenario B: Behind Pace + Fresh (The "Nudge")
    if (pacing.status === 'Behind' && recovery.status === 'Fresh') {
      return {
        id: 'the_nudge',
        title: 'Primed for Performance',
        message: "Your recovery scores are high, but training volume is low. You are physically primed for a hard session today.",
        type: 'goal',
        confidence: 90,
        generatedAt: new Date(),
        weekOf,
        dataPoints: [`Readiness: ${recovery.score}`, recovery.reason, pacing.reason],
        actionLabel: 'Plan a Workout',
        actionLink: '/chat?initialMessage=I+am+fresh+and+ready+to+train,+suggest+a+workout',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      };
    }

    // Scenario C: Ahead of Pace + Fatigued (The "Warning")
    if (pacing.status === 'Ahead' && recovery.status === 'Fatigued') {
      return {
        id: 'the_warning',
        title: 'Watch Your Load',
        message: "Great volume this week, but your Readiness is dropping. Consider swapping tomorrow's interval session for Zone 2 recovery.",
        type: 'recovery', // Orange/Caution implied by recovery type usually
        confidence: 85,
        generatedAt: new Date(),
        weekOf,
        dataPoints: [`Readiness: ${recovery.score}`, recovery.reason, pacing.reason],
        actionLabel: 'Ask Coach for Modification',
        actionLink: '/chat?initialMessage=My+recovery+is+dropping+but+volume+is+high.+Modify+my+plan+for+fatigue',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      };
    }

    // Default / Catch-All: Balanced or On Track (The "Status Quo")
    // We return this matching the Bio-Aware structure regardless of 'Unknown' status
    // to ensure the new UI always renders.
    const isUnknown = recovery.status === 'Unknown';

    return {
      id: isUnknown ? 'building_data' : 'balanced_status',
      title: isUnknown ? 'Gathering Recovery Data' : 'Training Balanced',
      message: isUnknown
        ? `We're building your recovery baseline. Keep tracking to unlock personalized readiness insights.`
        : `You are ${pacing.status} with your training goals and your body is responding well. Keep up the momentum!`,
      type: 'consistency',
      confidence: 80,
      generatedAt: new Date(),
      weekOf,
      dataPoints: isUnknown ? [pacing.reason] : [`Readiness: ${recovery.score}`, recovery.reason, pacing.reason],
      actionLabel: isUnknown ? 'View Metrics' : 'View Training Details',
      actionLink: '/dashboard',
      readinessScore: recovery.score, // Might be 0 if unknown, which is fine
      pacingProgress: pacing.progress
    };
  }
  // Helper method to calculate weekly distances (replicated from HealthMetricsService logic)
  private getWeeklyDistances(activities: StravaActivity[]): number[] {
    const weeks: number[] = [];
    const now = new Date();

    for (let i = 0; i < 4; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = subWeeks(weekStart, -1);

      const weekActivities = activities.filter(a => {
        const activityDate = new Date(a.start_date_local);
        return activityDate >= weekStart && activityDate < weekEnd;
      });

      const weekDistance = weekActivities.reduce((sum, a) => sum + a.distance, 0);
      weeks.push(weekDistance);
    }

    return weeks;
  }
}

export const weeklyInsightService = new WeeklyInsightService();