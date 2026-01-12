// Health Metrics Service - Calculates holistic health scores (Dynamic, Relative Model)
import type { StravaActivity, StravaAthlete, OuraSleepData, OuraReadinessData } from '../types';
import { startOfWeek, subWeeks, differenceInDays, isSameDay, startOfDay } from 'date-fns';

export interface HealthMetrics {
  load: number;        // replacing trainingBalance
  consistency: number; // replacing recovery
  endurance: number;   // same name, new logic
  intensity: number;   // replacing cardiovascular
  efficiency: number;  // replacing sleep
  overallScore: number;
  lastUpdated: Date;
  dataQuality: 'excellent' | 'good' | 'limited';
  details: {
    load: HealthDimensionDetail;
    consistency: HealthDimensionDetail;
    endurance: HealthDimensionDetail;
    intensity: HealthDimensionDetail;
    efficiency: HealthDimensionDetail;
  };
}

export interface HealthDimensionDetail {
  score: number;
  components: Array<{
    name: string;
    value: number | string;
    contribution: number; // points contributed to total score or just for display
  }>;
  trend: 'improving' | 'stable' | 'declining';
  suggestion: string;
}

class HealthMetricsService {
  // Calculate comprehensive health metrics
  calculateHealthMetrics(
    _athlete: StravaAthlete,
    activities: StravaActivity[],
    _sleepData: OuraSleepData[] = [],     // Kept for signature compatibility but unused for core calc now
    _readinessData: OuraReadinessData[] = [] // Kept for signature compatibility
  ): HealthMetrics {
    console.log('Calculating dynamic health metrics...');

    // 1. DATA PREP
    // We need up to 8 weeks for Consistency, 42 days for Load (Chronic).
    // Let's filter generally to last 60 days to cover 8 weeks.
    const eightWeeksAgo = subWeeks(new Date(), 8);
    const recentActivities = activities.filter(a =>
      new Date(a.start_date_local) >= eightWeeksAgo
    ).sort((a, b) => new Date(b.start_date_local).getTime() - new Date(a.start_date_local).getTime()); // Newest first

    // 2. CALCULATE AXES
    const load = this.calculateLoad(recentActivities);
    const consistency = this.calculateConsistency(recentActivities);
    const endurance = this.calculateEndurance(recentActivities);
    const intensity = this.calculateIntensity(recentActivities);
    const efficiency = this.calculateEfficiency(recentActivities);

    // 3. OVERALL SCORE
    // Weighted average of the 5 axes. Currently equal weights implied, but can be adjusted.
    const weights = {
      load: 0.2,
      consistency: 0.2,
      endurance: 0.2,
      intensity: 0.2,
      efficiency: 0.2
    };

    const weightedSum =
      (load.score * weights.load) +
      (consistency.score * weights.consistency) +
      (endurance.score * weights.endurance) +
      (intensity.score * weights.intensity) +
      (efficiency.score * weights.efficiency);

    const overallScore = Math.round(weightedSum);

    // 4. DATA QUALITY
    // Check if we have enough history for the "Chronic" and "Baseline" calculations.
    // Ideally need 42 days (6 weeks) for Load, 4 weeks for others.
    const dataQuality = this.assessDataQuality(recentActivities);

    return {
      load: load.score,
      consistency: consistency.score,
      endurance: endurance.score,
      intensity: intensity.score,
      efficiency: efficiency.score,
      overallScore,
      lastUpdated: new Date(),
      dataQuality,
      details: {
        load,
        consistency,
        endurance,
        intensity,
        efficiency
      }
    };
  }

  // ==========================================
  // 1. LOAD (ACWR) - "The Growth Tax"
  // ==========================================
  private calculateLoad(activities: StravaActivity[]): HealthDimensionDetail {
    // Acute: Last 7 days duration
    // Chronic: Last 42 days daily average duration * 7
    // Metrics: Duration (moving_time) in minutes.

    const today = startOfDay(new Date());
    const dayInMs = 86400000;

    const getActivityLoad = (act: StravaActivity) => act.moving_time / 60; // minutes

    const getLoadForPeriod = (startDate: Date, endDate: Date) => {
      return activities
        .filter(a => {
          const d = new Date(a.start_date_local);
          return d >= startDate && d < endDate;
        })
        .reduce((sum, a) => sum + getActivityLoad(a), 0);
    };

    // Acute: Last 7 days
    const endDate = new Date(today.getTime() + dayInMs);
    const acuteStart = new Date(endDate.getTime() - (7 * dayInMs));
    const acuteLoad = getLoadForPeriod(acuteStart, endDate);

    // Chronic: Last 42 days
    const chronicStart = new Date(endDate.getTime() - (42 * dayInMs));
    const total42DayLoad = getLoadForPeriod(chronicStart, endDate);
    const chronicLoad = (total42DayLoad / 42) * 7;

    let ratio = 0;
    if (chronicLoad > 10) {
       ratio = acuteLoad / chronicLoad;
    } else if (acuteLoad > 0) {
       ratio = 2.0; 
    } else {
       ratio = 1.0; 
    }

    // STRICT SCORING LOGIC
    let score = 0;
    let suggestion = "";
    let trend: 'improving' | 'stable' | 'declining' = 'stable';

    if (ratio >= 1.10 && ratio <= 1.30) {
      score = 100;
      suggestion = "Perfect Growth Zone (1.1 - 1.3). You are building fitness.";
    } else if (ratio >= 0.95 && ratio < 1.10) {
      score = 85;
      suggestion = "Maintenance Mode (0.95 - 1.1). Push volume slightly to grow.";
    } else if (ratio >= 1.31 && ratio <= 1.45) {
      score = 80;
      suggestion = "Aggressive Build (1.3 - 1.45). Watch for fatigue.";
    } else if (ratio < 0.95) {
      score = 60;
      suggestion = "Detraining Risk (< 0.95). Increase training volume.";
    } else { // ratio > 1.45
      score = 50;
      suggestion = "Danger Zone (> 1.45). Too much too soon! Back off.";
    }

    if (ratio > 1.05) trend = 'improving';
    else if (ratio < 0.95) trend = 'declining';

    return {
      score,
      components: [
        { name: 'Acute Load (7d)', value: `${Math.round(acuteLoad)} mins`, contribution: 0 },
        { name: 'Chronic Load (42d)', value: `${Math.round(chronicLoad)} mins`, contribution: 0 },
        { name: 'A:C Ratio', value: ratio.toFixed(2), contribution: score }
      ],
      trend,
      suggestion
    };
  }

  // ==========================================
  // 2. CONSISTENCY (Habit Formation) - "The Machine Standard"
  // ==========================================
  private calculateConsistency(activities: StravaActivity[]): HealthDimensionDetail {
    // Input: Count of active days per week for last 8 weeks.
    // Calc: Std Dev of training days/week.

    const today = startOfDay(new Date());
    const weeks: number[] = [];

    for (let i = 0; i < 8; i++) {
        const end = new Date(today.getTime() - (i * 7 * 86400000));
        const start = new Date(end.getTime() - (7 * 86400000));

        const activeDays = new Set(
            activities
                .filter(a => {
                    const d = new Date(a.start_date_local);
                    return d >= start && d < end;
                })
                .map(a => new Date(a.start_date_local).toISOString().split('T')[0])
        ).size;
        weeks.push(activeDays);
    }

    const mean = weeks.reduce((sum, v) => sum + v, 0) / weeks.length;
    const variance = weeks.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / weeks.length;
    const stdDev = Math.sqrt(variance);

    // STRICT SCORING
    let score = 0;
    let suggestion = "";

    if (stdDev < 0.5) {
        score = 100;
        suggestion = "Machine-like Consistency! (< 0.5)";
    } else if (stdDev >= 0.5 && stdDev < 1.0) {
        score = 85;
        suggestion = "Good Consistency (< 1.0). Don't miss sessions.";
    } else if (stdDev >= 1.0 && stdDev <= 1.5) {
        score = 70;
        suggestion = "Variable Schedule. Try to lock in your days.";
    } else {
        score = 50;
        suggestion = "Erratic (> 1.5). Establish a routine.";
    }

    const recentWeeks = weeks.slice(0, 4);
    const olderWeeks = weeks.slice(4);
    const recentStdDev = this.calculateStdDev(recentWeeks);
    const olderStdDev = this.calculateStdDev(olderWeeks);
    const trend = recentStdDev < olderStdDev ? 'improving' : (recentStdDev > olderStdDev ? 'declining' : 'stable');


    return {
        score,
        components: [
            { name: 'Avg Days/Week', value: mean.toFixed(1), contribution: 0 },
            { name: 'Variability', value: `±${stdDev.toFixed(1)} days`, contribution: score }
        ],
        trend,
        suggestion
    };
  }

  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // ==========================================
  // 3. ENDURANCE (Long Ride Progression) - "Pushing Boundaries"
  // ==========================================
  private calculateEndurance(activities: StravaActivity[]): HealthDimensionDetail {
      // Input: Single longest ride duration (seconds) of current week vs 4-week avg longest ride.

      const today = startOfDay(new Date());
      const dayInMs = 86400000;

      // Current Week (last 7 days rolling) Longest Ride
      const last7DaysStart = new Date(today.getTime() - 7 * dayInMs);
      const currentWeekActivities = activities.filter(a => new Date(a.start_date_local) >= last7DaysStart);
      const currentLongest = Math.max(0, ...currentWeekActivities.map(a => a.moving_time));

      // Baseline: Avg of Longest Rides for previous 4 weeks
      const baselineLongestRides: number[] = [];
      for(let i=1; i<=4; i++) {
          const end = new Date(today.getTime() - (i * 7 * dayInMs));
          const start = new Date(end.getTime() - (7 * dayInMs));
          const weeksActs = activities.filter(a => {
              const d = new Date(a.start_date_local);
              return d >= start && d < end;
          });
          const weekLongest = Math.max(0, ...weeksActs.map(a => a.moving_time));
          baselineLongestRides.push(weekLongest);
      }

      const baselineAvg = baselineLongestRides.reduce((sum,v) => sum+v, 0) / (baselineLongestRides.length || 1);

      let ratio = 0;
      if (baselineAvg > 0) {
          ratio = currentLongest / baselineAvg;
      } else if (currentLongest > 0) {
          ratio = 2.0; 
      } else {
          ratio = 1.0; 
      }

      // STRICT SCORING
      let score = 0;
      let suggestion = "";
      const toMinutes = (sec: number) => Math.round(sec/60);
      const targetMin = toMinutes(baselineAvg * 1.10);

      if (ratio > 1.10) {
          score = 100;
          suggestion = "Excellent! Pushing boundaries (> 110% of baseline).";
      } else if (ratio >= 0.95 && ratio <= 1.10) {
          score = 80;
          suggestion = `Comfort Zone. To reach Score 100, extend your long ride to > ${targetMin} mins.`;
      } else {
          score = 50;
          suggestion = `Regression (< 95% baseline). Long ride needs to be at least ${toMinutes(baselineAvg * 0.95)} mins to maintain.`;
      }

      const trend = ratio >= 1.0 ? 'improving' : 'declining';

      return {
          score,
          components: [
              { name: 'This Week Longest', value: `${toMinutes(currentLongest)}m`, contribution: 0 },
              { name: 'Baseline Longest', value: `${toMinutes(baselineAvg)}m`, contribution: score }
          ],
          trend,
          suggestion
      };
  }

  // ==========================================
  // 4. INTENSITY (Zone Distribution) - "Polarization Enforcement"
  // ==========================================
  private calculateIntensity(activities: StravaActivity[]): HealthDimensionDetail {
      // Goal: Reward "Quality Work" (Zone 4+). Penalize "Junk Miles" (Zone 3).
      // Z4 Threshold: approx 160bpm.
      // Z3 Proxy: avg HR 135-159.

      const Z4_THRESHOLD = 160; 
      const Z3_MIN = 135;

      const oneWeekAgo = new Date(Date.now() - 7 * 86400000);
      const recentActivities = activities.filter(a => new Date(a.start_date_local) >= oneWeekAgo);

      let totalDuration = 0;
      let estimatedZ4Duration = 0;
      let estimatedZ3Duration = 0;

      recentActivities.forEach(a => {
          if (!a.average_heartrate) {
               totalDuration += a.moving_time;
               return; 
          }

          totalDuration += a.moving_time;

          // Heuristic Proxy
          if (a.average_heartrate >= Z4_THRESHOLD) {
              // Hard ride: Mostly Z4
              estimatedZ4Duration += a.moving_time * 0.9;
              estimatedZ3Duration += a.moving_time * 0.1;
          } else if (a.average_heartrate >= Z3_MIN) {
              // Tempo ride: Mostly Z3 ("Grey Zone")
              estimatedZ3Duration += a.moving_time * 0.8;
              estimatedZ4Duration += a.moving_time * 0.1; 
          } else if (a.max_heartrate && a.max_heartrate >= Z4_THRESHOLD + 10) {
              // Intervals with low avg HR
              estimatedZ4Duration += a.moving_time * 0.15;
              estimatedZ3Duration += a.moving_time * 0.25;
          }
      });

      const z4Percentage = totalDuration > 0 ? (estimatedZ4Duration / totalDuration) * 100 : 0;
      const z3Percentage = totalDuration > 0 ? (estimatedZ3Duration / totalDuration) * 100 : 0;

      let score = 0;
      let suggestion = "";

      // STRICT SCORING & JUNK MILE PENALTY
      if (z3Percentage > 30) {
          score = 60;
          suggestion = `Junk Mile Penalty! Zone 3 is ${z3Percentage.toFixed(0)}% (>30%). Rides should be Hard (Z4) or Easy (Z2). Avoid the middle.`;
      } else if (z4Percentage >= 15 && z3Percentage < 20) {
          score = 100;
          suggestion = "Perfect Polarization! High quality work with disciplined easy days.";
      } else if (z4Percentage >= 10) {
          score = 75;
          suggestion = "Good intensity, but watch your 'Grey Zone' (Z3) volume.";
      } else {
          score = 50;
          suggestion = "Not enough intensity. Push harder on hard days (> 15% Z4).";
      }

      return {
          score,
          components: [
              { name: 'Training Time', value: `${Math.round(totalDuration/60)}m`, contribution: 0 },
              { name: 'Z4+ (Hard)', value: `${z4Percentage.toFixed(1)}%`, contribution: 0 },
              { name: 'Z3 (Tempo)', value: `${z3Percentage.toFixed(1)}%`, contribution: score }
          ],
          trend: 'stable', 
          suggestion
      };
  }

  // ==========================================
  // 5. EFFICIENCY (EF Trend) - "Demanding Results"
  // ==========================================
  private calculateEfficiency(activities: StravaActivity[]): HealthDimensionDetail {
      // EF = (Avg Speed m/s) / Avg HR. 
      // Calc: Compare this week's Avg EF to 4-week Baseline EF.

      const getEF = (a: StravaActivity): number | null => {
          if (!a.average_heartrate || a.average_heartrate < 50) return null; 
          
          let output = 0;
          if (a.weighted_average_watts) output = a.weighted_average_watts;
          else if (a.average_watts) output = a.average_watts;
          else if (a.average_speed) output = a.average_speed * 100; 
          
          if (output === 0 && a.average_speed) output = a.average_speed * 100;

          return output / a.average_heartrate;
      };

      const today = startOfDay(new Date());
      const dayInMs = 86400000;

      // 1. Current Week EF
      const last7DaysStart = new Date(today.getTime() - 7 * dayInMs);
      const currentWeekActivities = activities.filter(a => new Date(a.start_date_local) >= last7DaysStart);
      const currentEFs = currentWeekActivities.map(getEF).filter((x): x is number => x !== null);
      const currentAvgEF = currentEFs.length > 0 ? currentEFs.reduce((a,b)=>a+b,0)/currentEFs.length : 0;

      // 2. Baseline EF (Late 4 weeks)
      const baselineStart = new Date(today.getTime() - 35 * dayInMs); // 5 weeks ago
      const baselineEnd = last7DaysStart;
      const baselineActivities = activities.filter(a => {
          const d = new Date(a.start_date_local);
          return d >= baselineStart && d < baselineEnd;
      });
      const baselineEFs = baselineActivities.map(getEF).filter((x): x is number => x !== null);
      const baselineAvgEF = baselineEFs.length > 0 ? baselineEFs.reduce((a,b)=>a+b,0)/baselineEFs.length : 0;

      let trendValue = 0; // % diff
      if (baselineAvgEF > 0) {
          trendValue = ((currentAvgEF - baselineAvgEF) / baselineAvgEF) * 100;
      }

      // STRICT SCORING
      let score = 0;
      let suggestion = "";

      if (currentAvgEF === 0 && baselineAvgEF === 0) {
          score = 50;
          suggestion = "No HR/Power data to calculate efficiency.";
      } else if (trendValue > 2.0) {
          score = 100;
          suggestion = `Strong Efficiency Gains (+${trendValue.toFixed(1)}%)! Fitness is rising.`;
      } else if (trendValue >= 0 && trendValue <= 2.0) {
          score = 85;
          suggestion = `Marginal Gains (+${trendValue.toFixed(1)}%). Push for > 2% improvement.`;
      } else {
          score = 50;
          suggestion = `Efficiency Loss (${trendValue.toFixed(1)}%). Fatigue or detraining detected.`;
      }

      const trend = trendValue > 0 ? 'improving' : (trendValue < 0 ? 'declining' : 'stable');

      return {
          score,
          components: [
              { name: 'Current EF', value: currentAvgEF.toFixed(2), contribution: 0 },
              { name: 'Baseline EF', value: baselineAvgEF.toFixed(2), contribution: score }
          ],
          trend,
          suggestion
      };
  }

  // Helper: Data Quality Assessment
  private assessDataQuality(activities: StravaActivity[]): 'excellent' | 'good' | 'limited' {
    if (activities.length === 0) return 'limited';
    
    // Check history length
    const oldest = new Date(Math.min(...activities.map(a => new Date(a.start_date_local).getTime())));
    const daysHistory = differenceInDays(new Date(), oldest);
    
    // Check HR availability
    const hrCount = activities.filter(a => a.average_heartrate).length;
    const hrCoverage = hrCount / activities.length;

    if (daysHistory >= 42 && hrCoverage > 0.8) return 'excellent';
    if (daysHistory >= 28) return 'good';
    return 'limited';
  }
}

export const healthMetricsService = new HealthMetricsService();