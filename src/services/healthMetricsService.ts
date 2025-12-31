// Health Metrics Service - Calculates holistic health scores
import type { StravaActivity, StravaAthlete, OuraSleepData, OuraReadinessData } from '../types';
import { startOfWeek, subWeeks, differenceInDays } from 'date-fns';

export interface HealthMetrics {
  cardiovascular: number;
  endurance: number;
  recovery: number;
  sleep: number;
  trainingBalance: number;
  overallScore: number;
  lastUpdated: Date;
  dataQuality: 'excellent' | 'good' | 'limited';
  details: {
    cardiovascular: HealthDimensionDetail;
    endurance: HealthDimensionDetail;
    recovery: HealthDimensionDetail;
    sleep: HealthDimensionDetail;
    trainingBalance: HealthDimensionDetail;
  };
}

export interface HealthDimensionDetail {
  score: number;
  components: Array<{
    name: string;
    value: number | string;
    contribution: number; // points contributed to total score
  }>;
  trend: 'improving' | 'stable' | 'declining';
  suggestion: string;
}

class HealthMetricsService {
  // Calculate comprehensive health metrics
  calculateHealthMetrics(
    _athlete: StravaAthlete,
    activities: StravaActivity[],
    sleepData: OuraSleepData[] = [],
    readinessData: OuraReadinessData[] = []
  ): HealthMetrics {
    console.log('Calculating health metrics...');

    // Filter to last 4 weeks of data
    const fourWeeksAgo = subWeeks(new Date(), 4);
    const recentActivities = activities.filter(a =>
      new Date(a.start_date_local) >= fourWeeksAgo
    );

    const recentSleep = sleepData.filter(s =>
      new Date(s.day) >= fourWeeksAgo
    );

    const recentReadiness = readinessData.filter(r =>
      new Date(r.day) >= fourWeeksAgo
    );

    // Calculate each dimension
    const cardiovascular = this.calculateCardiovascular(recentActivities, recentSleep);
    const endurance = this.calculateEndurance(recentActivities);
    const recovery = this.calculateRecovery(recentReadiness, recentActivities);
    const sleep = this.calculateSleep(recentSleep);
    const trainingBalance = this.calculateTrainingBalance(recentActivities);

    // Calculate overall score (weighted average)
    const weights = {
      cardiovascular: 0.25,
      endurance: 0.25,
      recovery: 0.2,
      sleep: 0.15,
      trainingBalance: 0.15
    };

    const overallScore = Math.round(
      cardiovascular.score * weights.cardiovascular +
      endurance.score * weights.endurance +
      recovery.score * weights.recovery +
      sleep.score * weights.sleep +
      trainingBalance.score * weights.trainingBalance
    );

    // Determine data quality
    const dataQuality = this.assessDataQuality(recentActivities, recentSleep, recentReadiness);

    return {
      cardiovascular: cardiovascular.score,
      endurance: endurance.score,
      recovery: recovery.score,
      sleep: sleep.score,
      trainingBalance: trainingBalance.score,
      overallScore,
      lastUpdated: new Date(),
      dataQuality,
      details: {
        cardiovascular,
        endurance,
        recovery,
        sleep,
        trainingBalance
      }
    };
  }

  // Calculate cardiovascular fitness score
  private calculateCardiovascular(activities: StravaActivity[], sleepData: OuraSleepData[]): HealthDimensionDetail {
    const components = [];
    let totalScore = 0;

    // Average speed trends (40 points)
    if (activities.length >= 4) {
      const speeds = activities.map(a => a.average_speed * 2.237); // Convert to mph
      const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
      const recentSpeeds = speeds.slice(0, Math.floor(speeds.length / 2));
      const olderSpeeds = speeds.slice(Math.floor(speeds.length / 2));

      const recentAvg = recentSpeeds.reduce((sum, s) => sum + s, 0) / recentSpeeds.length;
      const olderAvg = olderSpeeds.reduce((sum, s) => sum + s, 0) / olderSpeeds.length;

      const speedImprovement = ((recentAvg - olderAvg) / olderAvg) * 100;
      const speedScore = Math.min(40, Math.max(0, 20 + speedImprovement * 2));

      components.push({
        name: 'Average Speed',
        value: `${avgSpeed.toFixed(1)} mph`,
        contribution: Math.round(speedScore)
      });
      totalScore += speedScore;
    }

    // Heart rate efficiency (30 points) - estimated from speed consistency
    if (activities.length > 0) {
      const heartRateActivities = activities.filter(a => a.average_heartrate && a.average_heartrate > 0);
      if (heartRateActivities.length > 0) {
        const avgHR = heartRateActivities.reduce((sum, a) => sum + (a.average_heartrate || 0), 0) / heartRateActivities.length;
        // Assume good HR efficiency if average is reasonable (120-160 for cycling)
        const hrScore = avgHR >= 120 && avgHR <= 160 ? 25 : 15;

        components.push({
          name: 'Heart Rate Efficiency',
          value: `${Math.round(avgHR)} bpm avg`,
          contribution: hrScore
        });
        totalScore += hrScore;
      } else {
        // Estimate from speed consistency
        const speeds = activities.map(a => a.average_speed);
        const speedVariance = this.calculateVariance(speeds);
        const consistencyScore = Math.max(0, 25 - speedVariance * 10);

        components.push({
          name: 'Performance Consistency',
          value: 'Estimated from speed',
          contribution: Math.round(consistencyScore)
        });
        totalScore += consistencyScore;
      }
    }

    // Resting heart rate trends (30 points)
    if (sleepData.length > 0) {
      const restingHRs = sleepData
        .filter(s => s.lowest_heart_rate && s.lowest_heart_rate > 0)
        .map(s => s.lowest_heart_rate);

      if (restingHRs.length > 0) {
        const avgRestingHR = restingHRs.reduce((sum, hr) => sum + hr, 0) / restingHRs.length;
        // Lower resting HR generally indicates better cardiovascular fitness
        const restingHRScore = Math.max(0, Math.min(30, 50 - avgRestingHR * 0.4));

        components.push({
          name: 'Resting Heart Rate',
          value: `${Math.round(avgRestingHR)} bpm`,
          contribution: Math.round(restingHRScore)
        });
        totalScore += restingHRScore;
      }
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      components,
      trend: this.calculateTrend(activities, 'speed'),
      suggestion: finalScore < 60 ?
        'Focus on consistent aerobic training to improve cardiovascular base' :
        finalScore < 80 ?
          'Add some tempo intervals to boost cardiovascular efficiency' :
          'Excellent cardiovascular fitness - maintain with varied intensity'
    };
  }

  // Calculate endurance capacity score
  private calculateEndurance(activities: StravaActivity[]): HealthDimensionDetail {
    const components = [];
    let totalScore = 0;

    // Weekly volume vs baseline (40 points)
    const weeklyDistances = this.getWeeklyDistances(activities);
    if (weeklyDistances.length > 0) {
      const avgWeeklyDistance = weeklyDistances.reduce((sum, d) => sum + d, 0) / weeklyDistances.length;
      const avgWeeklyMiles = avgWeeklyDistance * 0.000621371;

      // Score based on weekly volume (rough cycling benchmarks)
      let volumeScore = 0;
      if (avgWeeklyMiles >= 150) volumeScore = 40;
      else if (avgWeeklyMiles >= 100) volumeScore = 35;
      else if (avgWeeklyMiles >= 75) volumeScore = 30;
      else if (avgWeeklyMiles >= 50) volumeScore = 25;
      else if (avgWeeklyMiles >= 25) volumeScore = 20;
      else volumeScore = Math.max(0, avgWeeklyMiles * 0.8);

      components.push({
        name: 'Weekly Volume',
        value: `${avgWeeklyMiles.toFixed(1)} miles/week`,
        contribution: Math.round(volumeScore)
      });
      totalScore += volumeScore;
    }

    // Longest ride capacity (30 points)
    if (activities.length > 0) {
      const longestRide = Math.max(...activities.map(a => a.distance)) * 0.000621371;
      let longestRideScore = 0;

      if (longestRide >= 100) longestRideScore = 30;
      else if (longestRide >= 75) longestRideScore = 25;
      else if (longestRide >= 50) longestRideScore = 20;
      else if (longestRide >= 25) longestRideScore = 15;
      else longestRideScore = longestRide * 0.6;

      components.push({
        name: 'Longest Ride',
        value: `${longestRide.toFixed(1)} miles`,
        contribution: Math.round(longestRideScore)
      });
      totalScore += longestRideScore;
    }

    // Training consistency (30 points)
    const consistencyScore = this.calculateConsistencyScore(activities);
    components.push({
      name: 'Training Consistency',
      value: `${consistencyScore}/100`,
      contribution: Math.round(consistencyScore * 0.3)
    });
    totalScore += consistencyScore * 0.3;

    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      components,
      trend: this.calculateTrend(activities, 'distance'),
      suggestion: finalScore < 60 ?
        'Build endurance base with longer, easier rides' :
        finalScore < 80 ?
          'Gradually increase weekly volume by 10% each week' :
          'Strong endurance base - focus on maintaining consistency'
    };
  }

  // Calculate recovery quality score
  private calculateRecovery(readinessData: OuraReadinessData[], activities: StravaActivity[]): HealthDimensionDetail {
    const components = [];
    let totalScore = 0;

    if (readinessData.length > 0) {
      // Average readiness score (50 points)
      const avgReadiness = readinessData.reduce((sum, r) => sum + r.score, 0) / readinessData.length;
      const readinessScore = avgReadiness * 0.5; // Convert to 50-point scale

      components.push({
        name: 'Readiness Score',
        value: `${Math.round(avgReadiness)}/100`,
        contribution: Math.round(readinessScore)
      });
      totalScore += readinessScore;

      // Recovery consistency (25 points)
      const readinessScores = readinessData.map(r => r.score);
      const readinessVariance = this.calculateVariance(readinessScores);
      const consistencyScore = Math.max(0, 25 - readinessVariance * 0.5);

      components.push({
        name: 'Recovery Consistency',
        value: `${Math.round(100 - readinessVariance)}% consistent`,
        contribution: Math.round(consistencyScore)
      });
      totalScore += consistencyScore;

      // Recovery trend (25 points)
      if (readinessData.length >= 7) {
        const recentReadiness = readinessData.slice(0, 3).reduce((sum, r) => sum + r.score, 0) / 3;
        const olderReadiness = readinessData.slice(-3).reduce((sum, r) => sum + r.score, 0) / 3;
        const trendScore = Math.max(0, Math.min(25, 12.5 + (recentReadiness - olderReadiness) * 0.25));

        components.push({
          name: 'Recovery Trend',
          value: recentReadiness > olderReadiness ? 'Improving' : 'Stable',
          contribution: Math.round(trendScore)
        });
        totalScore += trendScore;
      }
    } else {
      // Estimate recovery from training patterns
      const estimatedScore = this.estimateRecoveryFromTraining(activities);
      components.push({
        name: 'Estimated Recovery',
        value: 'Based on training patterns',
        contribution: Math.round(estimatedScore)
      });
      totalScore += estimatedScore;
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      components,
      trend: readinessData.length > 0 ? this.calculateTrend(readinessData, 'readiness') : 'stable',
      suggestion: finalScore < 60 ?
        'Focus on sleep quality and consider more rest days' :
        finalScore < 80 ?
          'Good recovery - maintain current rest patterns' :
          'Excellent recovery capacity - you can handle current training load'
    };
  }

  // Calculate sleep health score
  private calculateSleep(sleepData: OuraSleepData[]): HealthDimensionDetail {
    const components = [];
    let totalScore = 0;

    if (sleepData.length > 0) {
      // Sleep duration consistency (40 points)
      const sleepHours = sleepData.map(s => s.total_sleep_duration / 3600);
      const avgSleepHours = sleepHours.reduce((sum, h) => sum + h, 0) / sleepHours.length;

      let durationScore = 0;
      if (avgSleepHours >= 7 && avgSleepHours <= 9) durationScore = 40;
      else if (avgSleepHours >= 6.5 && avgSleepHours <= 9.5) durationScore = 30;
      else if (avgSleepHours >= 6 && avgSleepHours <= 10) durationScore = 20;
      else durationScore = 10;

      components.push({
        name: 'Sleep Duration',
        value: `${avgSleepHours.toFixed(1)}h avg`,
        contribution: durationScore
      });
      totalScore += durationScore;

      // Sleep efficiency (30 points)
      const avgEfficiency = sleepData.reduce((sum, s) => sum + s.efficiency, 0) / sleepData.length;
      const efficiencyScore = Math.min(30, avgEfficiency * 0.3);

      components.push({
        name: 'Sleep Efficiency',
        value: `${Math.round(avgEfficiency)}%`,
        contribution: Math.round(efficiencyScore)
      });
      totalScore += efficiencyScore;

      // Deep sleep percentage (30 points)
      const deepSleepPercentages = sleepData.map(s =>
        (s.deep_sleep_duration / s.total_sleep_duration) * 100
      );
      const avgDeepSleep = deepSleepPercentages.reduce((sum, p) => sum + p, 0) / deepSleepPercentages.length;

      let deepSleepScore = 0;
      if (avgDeepSleep >= 15 && avgDeepSleep <= 20) deepSleepScore = 30;
      else if (avgDeepSleep >= 10 && avgDeepSleep <= 25) deepSleepScore = 20;
      else deepSleepScore = 10;

      components.push({
        name: 'Deep Sleep',
        value: `${avgDeepSleep.toFixed(1)}%`,
        contribution: deepSleepScore
      });
      totalScore += deepSleepScore;
    } else {
      // No sleep data available
      components.push({
        name: 'Sleep Data',
        value: 'Connect Oura Ring',
        contribution: 0
      });
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      components,
      trend: sleepData.length > 0 ? this.calculateTrend(sleepData, 'sleep') : 'stable',
      suggestion: sleepData.length === 0 ?
        'Connect your Oura Ring for detailed sleep insights' :
        finalScore < 60 ?
          'Focus on consistent bedtime and sleep hygiene' :
          finalScore < 80 ?
            'Good sleep patterns - aim for 7-9 hours nightly' :
            'Excellent sleep quality supporting your training'
    };
  }

  // Calculate training balance score
  private calculateTrainingBalance(activities: StravaActivity[]): HealthDimensionDetail {
    const components = [];
    let totalScore = 0;

    if (activities.length > 0) {
      // Intensity distribution (40 points) - 80/20 rule
      const intensityDistribution = this.calculateIntensityDistribution(activities);
      const easyPercentage = intensityDistribution.easy;

      // Ideal is 80% easy, 20% moderate/hard
      let intensityScore = 0;
      if (easyPercentage >= 75 && easyPercentage <= 85) intensityScore = 40;
      else if (easyPercentage >= 70 && easyPercentage <= 90) intensityScore = 30;
      else if (easyPercentage >= 60 && easyPercentage <= 95) intensityScore = 20;
      else intensityScore = 10;

      components.push({
        name: 'Easy/Hard Balance',
        value: `${easyPercentage}% easy rides`,
        contribution: intensityScore
      });
      totalScore += intensityScore;

      // Rest day frequency (30 points)
      const restDayScore = this.calculateRestDayScore(activities);
      components.push({
        name: 'Rest Day Frequency',
        value: `${restDayScore > 20 ? 'Good' : 'Needs improvement'}`,
        contribution: Math.round(restDayScore)
      });
      totalScore += restDayScore;

      // Training load progression (30 points)
      const progressionScore = this.calculateProgressionScore(activities);
      components.push({
        name: 'Load Progression',
        value: `${progressionScore > 20 ? 'Appropriate' : 'Too aggressive'}`,
        contribution: Math.round(progressionScore)
      });
      totalScore += progressionScore;
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    return {
      score: finalScore,
      components,
      trend: 'stable',
      suggestion: finalScore < 60 ?
        'Balance hard training with more easy recovery rides' :
        finalScore < 80 ?
          'Good training balance - maintain 80/20 easy/hard split' :
          'Excellent training balance supporting long-term development'
    };
  }

  // Helper methods
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateConsistencyScore(activities: StravaActivity[]): number {
    const weeklyDistances = this.getWeeklyDistances(activities);
    if (weeklyDistances.length < 2) return 50;

    const mean = weeklyDistances.reduce((sum, d) => sum + d, 0) / weeklyDistances.length;
    const variance = this.calculateVariance(weeklyDistances);

    if (mean === 0) return 0;
    const consistencyScore = Math.max(0, 100 - (variance / mean) * 100);
    return Math.round(consistencyScore);
  }

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

  private calculateIntensityDistribution(activities: StravaActivity[]) {
    const intensityBuckets = { easy: 0, moderate: 0, hard: 0 };

    activities.forEach(activity => {
      const speedMph = activity.average_speed * 2.237;
      if (speedMph < 15) {
        intensityBuckets.easy++;
      } else if (speedMph < 18) {
        intensityBuckets.moderate++;
      } else {
        intensityBuckets.hard++;
      }
    });

    const total = activities.length;
    return {
      easy: total > 0 ? Math.round((intensityBuckets.easy / total) * 100) : 0,
      moderate: total > 0 ? Math.round((intensityBuckets.moderate / total) * 100) : 0,
      hard: total > 0 ? Math.round((intensityBuckets.hard / total) * 100) : 0
    };
  }

  private calculateRestDayScore(activities: StravaActivity[]): number {
    // Simple heuristic: should have at least 1-2 rest days per week
    const daysWithActivities = new Set(
      activities.map(a => a.start_date_local.split('T')[0])
    ).size;

    const totalDays = Math.min(28, differenceInDays(new Date(), new Date(activities[activities.length - 1]?.start_date_local || new Date())));
    const restDays = totalDays - daysWithActivities;
    const restDaysPerWeek = (restDays / totalDays) * 7;

    // Ideal: 1-3 rest days per week
    if (restDaysPerWeek >= 1 && restDaysPerWeek <= 3) return 30;
    if (restDaysPerWeek >= 0.5 && restDaysPerWeek <= 4) return 20;
    return 10;
  }

  private calculateProgressionScore(activities: StravaActivity[]): number {
    const weeklyDistances = this.getWeeklyDistances(activities);
    if (weeklyDistances.length < 3) return 25;

    // Check for reasonable progression (not more than 10% increase per week)
    let appropriateProgression = true;
    for (let i = 1; i < weeklyDistances.length; i++) {
      const prevWeek = weeklyDistances[i];
      const currentWeek = weeklyDistances[i - 1];

      if (prevWeek > 0) {
        const increase = ((currentWeek - prevWeek) / prevWeek) * 100;
        if (increase > 15) { // More than 15% increase is risky
          appropriateProgression = false;
          break;
        }
      }
    }

    return appropriateProgression ? 30 : 15;
  }

  private estimateRecoveryFromTraining(activities: StravaActivity[]): number {
    // Estimate recovery based on training consistency and load
    const consistencyScore = this.calculateConsistencyScore(activities);
    const intensityDist = this.calculateIntensityDistribution(activities);

    // Good consistency + appropriate easy percentage = better estimated recovery
    const estimatedRecovery = (consistencyScore * 0.4) + (intensityDist.easy * 0.6);
    return Math.min(75, estimatedRecovery); // Cap at 75 since it's estimated
  }

  private calculateTrend(data: (StravaActivity | OuraSleepData | OuraReadinessData)[], type: string): 'improving' | 'stable' | 'declining' {
    if (data.length < 4) return 'stable';

    const midpoint = Math.floor(data.length / 2);
    let recentAvg = 0;
    let olderAvg = 0;

    switch (type) {
      case 'speed': {
        const speedData = data as StravaActivity[];
        recentAvg = speedData.slice(0, midpoint).reduce((sum, a) => sum + a.average_speed, 0) / midpoint;
        olderAvg = speedData.slice(midpoint).reduce((sum, a) => sum + a.average_speed, 0) / (data.length - midpoint);
        break;
      }
      case 'distance': {
        const distData = data as StravaActivity[];
        recentAvg = distData.slice(0, midpoint).reduce((sum, a) => sum + a.distance, 0) / midpoint;
        olderAvg = distData.slice(midpoint).reduce((sum, a) => sum + a.distance, 0) / (data.length - midpoint);
        break;
      }
      case 'readiness': {
        const readyData = data as OuraReadinessData[];
        recentAvg = readyData.slice(0, midpoint).reduce((sum, r) => sum + r.score, 0) / midpoint;
        olderAvg = readyData.slice(midpoint).reduce((sum, r) => sum + r.score, 0) / (data.length - midpoint);
        break;
      }
      case 'sleep': {
        const sleepData = data as OuraSleepData[];
        recentAvg = sleepData.slice(0, midpoint).reduce((sum, s) => sum + s.efficiency, 0) / midpoint;
        olderAvg = sleepData.slice(midpoint).reduce((sum, s) => sum + s.efficiency, 0) / (data.length - midpoint);
        break;
      }
      default:
        return 'stable';
    }

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (change > 5) return 'improving';
    if (change < -5) return 'declining';
    return 'stable';
  }

  private assessDataQuality(
    activities: StravaActivity[],
    sleepData: OuraSleepData[],
    readinessData: OuraReadinessData[]
  ): 'excellent' | 'good' | 'limited' {
    const hasStrava = activities.length >= 8; // At least 2 weeks of data
    const hasOura = sleepData.length >= 14 || readinessData.length >= 14; // At least 2 weeks
    const hasHeartRate = activities.some(a => a.average_heartrate && a.average_heartrate > 0);

    if (hasStrava && hasOura && hasHeartRate) return 'excellent';
    if (hasStrava && (hasOura || hasHeartRate)) return 'good';
    return 'limited';
  }
}

export const healthMetricsService = new HealthMetricsService();