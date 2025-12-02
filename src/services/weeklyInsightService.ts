// Weekly Insight Service - Generates personalized training insights
import type { StravaActivity, StravaAthlete, OuraSleepData, OuraReadinessData, ChatSession } from '../types';
export type { HealthMetrics } from './healthMetricsService';
import { openaiService } from './openaiApi';
import { chatSessionService } from './chatSessionService';
import { STORAGE_KEYS } from '../utils/constants';
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
}

interface WeeklyInsightCache {
  insight: WeeklyInsight;
  weekOf: string; // ISO string for comparison
}

class WeeklyInsightService {
  private readonly CACHE_KEY = 'weekly_insight_cache';

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

  private calculateConsistencyScore(weeks: any[]): number {
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
    const correlations = [];
    
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
    patterns: any,
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
    readinessData: OuraReadinessData[] = []
  ): Promise<WeeklyInsight> {
    console.log('Generating weekly insight...');

    // Check cache first
    const cached = this.getCachedInsight();
    if (cached) {
      console.log('Using cached weekly insight');
      return cached;
    }

    try {
      // Analyze patterns
      const patterns = this.analyzePatterns(activities, sleepData, readinessData);
      console.log('Analyzed patterns:', patterns);

      // Extract training themes from recent chats
      const chatSessions = await chatSessionService.getSessions();
      const themes = await this.extractTrainingThemes(chatSessions);
      console.log('Training themes:', themes);

      // Build AI prompt
      const prompt = this.buildInsightPrompt(athlete, patterns, themes);
      console.log('Generated AI prompt');

      // Get AI response
      const aiResponse = await openaiService.getChatResponse(
        [{ id: 'insight', role: 'user', content: prompt, timestamp: new Date() }],
        {
          athlete,
          recentActivities: activities.slice(0, 10),
          stats: {} as any,
          weeklyVolume: {
            distance: patterns.weeklyVolume.thisWeek * 1609.34, // Convert back to meters
            time: 0,
            activities: patterns.weeklyVolume.activities
          }
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
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON, using fallback');
        // Fallback insight based on patterns
        parsedResponse = this.generateFallbackInsight(patterns, themes);
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
      const chatSessions = await chatSessionService.getSessions();
      const themes = await this.extractTrainingThemes(chatSessions);
      const fallback = this.generateFallbackInsight(patterns, themes);
      
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
  private generateFallbackInsight(patterns: any, themes: string[]) {
    const consistency = patterns.trainingConsistency.consistency;
    const weeklyChange = patterns.weeklyVolume.change;
    const hasRecoveryData = patterns.recoveryTrends.available;

    // Choose insight based on patterns
    if (consistency < 60) {
      return {
        type: 'consistency',
        title: 'Focus on Consistency',
        message: `Your training consistency is ${consistency}/100. Try to maintain ${Math.ceil(patterns.trainingConsistency.avgActivitiesPerWeek)} rides per week for better fitness gains.`,
        dataPoints: [`${consistency}/100 consistency score`, `${patterns.trainingConsistency.avgActivitiesPerWeek} avg rides/week`]
      };
    } else if (Math.abs(weeklyChange) > 25) {
      return {
        type: 'training',
        title: weeklyChange > 0 ? 'Volume Increase Noted' : 'Volume Drop Detected',
        message: `Your weekly distance ${weeklyChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(weeklyChange)}%. ${weeklyChange > 0 ? 'Monitor recovery to avoid overreaching.' : 'Consider gradually building back up.'}`,
        dataPoints: [`${weeklyChange}% weekly change`, `${patterns.weeklyVolume.thisWeek} miles this week`]
      };
    } else if (!hasRecoveryData) {
      return {
        type: 'recovery',
        title: 'Connect Recovery Data',
        message: `Great ${consistency}/100 training consistency! Connect your Oura Ring to get personalized recovery insights and optimize your ${patterns.trainingConsistency.avgDistancePerWeek} miles/week.`,
        dataPoints: [`${consistency}/100 consistency`, `${patterns.trainingConsistency.avgDistancePerWeek} miles/week average`]
      };
    } else {
      return {
        type: 'pattern',
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
}

export const weeklyInsightService = new WeeklyInsightService();