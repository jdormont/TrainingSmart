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
    let currentScore = 0;
    let baselineScore = 0;
    let source = '';

    // Priority 1: Daily Metrics (aggregated)
    if (dailyMetrics.length > 0) {
      // Sort by date descending
      const sortedMetrics = [...dailyMetrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Get today's/latest metric
      const latest = sortedMetrics[0];

      // Try to use Recovery Score if available (0-100)
      if (latest.recovery_score > 0) {
        currentScore = latest.recovery_score;
        source = 'Unified Recovery Metric';

        // Calculate Baseline (last 7 days excluding today)
        const history = sortedMetrics.slice(1, 8);
        if (history.length >= 3) {
          baselineScore = history.reduce((sum, m) => sum + m.recovery_score, 0) / history.length;
        } else {
          // Fallback if no history: compare to static threshold
          baselineScore = 50; // Neutral baseline
        }
      }
      // Fallback: HRV
      else if (latest.hrv > 0) {
        currentScore = latest.hrv;
        source = 'HRV';
        // Baseline
        const history = sortedMetrics.slice(1, 8).filter(m => m.hrv > 0);
        if (history.length >= 3) {
          baselineScore = history.reduce((sum, m) => sum + m.hrv, 0) / history.length;
        } else {
          baselineScore = 40; // Conservative static baseline for HRV
        }
      }
    }
    // Priority 2: Oura Readiness directly
    else if (ouraReadiness.length > 0) {
      const sortedReadiness = [...ouraReadiness].sort((a, b) => new Date(b.day).getTime() - new Date(a.day).getTime());
      const latest = sortedReadiness[0];
      currentScore = latest.score;
      source = 'Oura Readiness';

      const history = sortedReadiness.slice(1, 8);
      if (history.length >= 3) {
        baselineScore = history.reduce((sum, r) => sum + r.score, 0) / history.length;
      } else {
        baselineScore = 75; // Neutral baseline for Oura
      }
    }

    // Logic: Determine Status
    if (currentScore === 0) {
      return { status: 'Unknown', score: 0, reason: 'No recovery data available' };
    }

    // Default Thresholds (can be tuned)
    let isFresh = false;
    let isFatigued = false;

    if (source === 'HRV') {
      // HRV Logic: significant drop is bad
      const deviation = ((currentScore - baselineScore) / baselineScore) * 100;
      if (currentScore < 30) isFatigued = true; // Absolute low
      else if (deviation < -10) isFatigued = true; // Drop > 10%
      else if (deviation > 5) isFresh = true; // Increasing is usually good
    } else {
      // Score (0-100) Logic
      if (currentScore < 60) isFatigued = true;
      else if (currentScore > 85) isFresh = true;
      // Check trends if in middle range
      else if (currentScore < baselineScore - 10) isFatigued = true;
      else if (currentScore > baselineScore + 5) isFresh = true;
    }

    if (isFatigued) return { status: 'Fatigued', score: currentScore, reason: `${source} is low (${Math.round(currentScore)})` };
    if (isFresh) return { status: 'Fresh', score: currentScore, reason: `${source} is strong (${Math.round(currentScore)})` };

    return { status: 'Unknown', score: currentScore, reason: `${source} is normal` }; // Treat normal as "Unknown" for matrix purposes or add "Stable"
  }

  private analyzePacingStatus(activities: StravaActivity[]): { status: 'Behind' | 'Ahead' | 'OnTrack'; progress: number; reason: string } {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekActivities = activities.filter(a => new Date(a.start_date_local) >= thisWeekStart);

    const currentDistance = thisWeekActivities.reduce((sum, a) => sum + a.distance, 0) * 0.000621371; // miles

    // Calculate Goal (Simple: Avg of last 4 weeks OR default 100 miles if pro, 50 if amateur)
    // For now, let's derive a simple "Historic Average" from getWeeklyDistances logic
    const weeklyDistances = this.getWeeklyDistances(activities);
    // Remove current week (index 0 might be partial) if we want true history, 
    // but let's just take avg of non-zero past weeks
    const pastWeeks = weeklyDistances.filter((d: number) => d > 0);
    let weeklyGoal = pastWeeks.length > 0 ? (pastWeeks.reduce((a: number, b: number) => a + b, 0) / pastWeeks.length) * 0.000621371 : 50;

    // Minimum reasonable goal floor
    if (weeklyGoal < 20) weeklyGoal = 30;

    // Project end of week?
    // Simple linear projection based on day of week?
    const dayOfWeek = new Date().getDay() || 7; // Mon=1, Sun=7
    const progressPercent = (currentDistance / weeklyGoal) * 100;

    const expectedProgress = (dayOfWeek / 7) * 100;

    if (progressPercent < expectedProgress - 15) {
      return { status: 'Behind', progress: progressPercent, reason: `Only ${Math.round(currentDistance)}mi vs goal ${Math.round(weeklyGoal)}mi` };
    } else if (progressPercent > expectedProgress + 15) {
      return { status: 'Ahead', progress: progressPercent, reason: `${Math.round(currentDistance)}mi already (Goal: ${Math.round(weeklyGoal)}mi)` };
    }

    return { status: 'OnTrack', progress: progressPercent, reason: 'On track with weekly volume' };
  }

  private generateInsightMatrix(
    pacing: { status: 'Behind' | 'Ahead' | 'OnTrack'; progress: number; reason: string },
    recovery: { status: 'Fresh' | 'Fatigued' | 'Unknown'; score: number; reason: string }
  ): WeeklyInsight | null {
    const dayOfWeek = new Date().getDay();
    const isEarlyWeek = dayOfWeek >= 1 && dayOfWeek <= 2; // Mon/Tue

    // Scenario D: Early Week (Bio-Note)
    if (isEarlyWeek) {
      return {
        id: 'early_week',
        title: recovery.status === 'Fresh' ? 'Primed for the Week' : 'Slow Start Recommended',
        message: recovery.status === 'Fresh'
          ? `It's early in the week and your readiness is high (${recovery.score}). Great time to front-load a hard workout.`
          : `Starting the week with some fatigue. Consider pushing your key workouts to Thu/Fri when you're fresher.`,
        type: recovery.status === 'Fresh' ? 'training' : 'recovery',
        confidence: 90,
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 }),
        dataPoints: [recovery.reason, pacing.reason],
        actionLabel: 'Plan My Week',
        actionLink: '/chat?initialMessage=Help+me+plan+my+week+based+on+my+current+fatigue',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      } as WeeklyInsight;
    }

    // Scenario A: Behind Pace + Fatigued (Permission to Rest)
    if (pacing.status === 'Behind' && recovery.status === 'Fatigued') {
      return {
        id: 'permission_to_rest',
        title: 'Permission to Rest',
        message: "You're behind volume targets, but your body is fighting stress. Prioritize sleep tonight instead of chasing miles.",
        type: 'recovery',
        confidence: 95,
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 }),
        dataPoints: [recovery.reason, pacing.reason],
        actionLabel: 'View Recovery Stats',
        actionLink: '/dashboard', // Focus on recovery card
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      } as WeeklyInsight;
    }

    // Scenario B: Behind Pace + Fresh (The Nudge)
    if (pacing.status === 'Behind' && recovery.status === 'Fresh') {
      return {
        id: 'the_nudge',
        title: 'Prime Time to Train',
        message: "Your recovery scores are high, but training volume is low. You are physiologically primed for a hard session today.",
        type: 'goal',
        confidence: 90,
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 }),
        dataPoints: [recovery.reason, pacing.reason],
        actionLabel: 'Plan a Workout',
        actionLink: '/chat?initialMessage=I+am+fresh+and+behind+schedule,+suggest+a+workout',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      } as WeeklyInsight;
    }

    // Scenario C: Ahead of Pace + Fatigued (The Warning)
    if (pacing.status === 'Ahead' && recovery.status === 'Fatigued') {
      return {
        id: 'the_warning',
        title: 'Risk of Overreach',
        message: "Great volume this week, but your Readiness is dropping. Consider swapping your next interval session for Zone 2.",
        type: 'pattern',
        confidence: 85,
        generatedAt: new Date(),
        weekOf: startOfWeek(new Date(), { weekStartsOn: 1 }),
        dataPoints: [recovery.reason, pacing.reason],
        actionLabel: 'Modify Plan',
        actionLink: '/chat?initialMessage=My+recovery+is+dropping+but+volume+is+high.+How+should+I+modify+my+plan?',
        readinessScore: recovery.score,
        pacingProgress: pacing.progress
      } as WeeklyInsight;
    }

    // Default to null if no strong signal, let fallback logic handle it
    return null;
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