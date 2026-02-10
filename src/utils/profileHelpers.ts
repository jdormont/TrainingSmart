import type { StravaActivity } from '../types';
import type { HealthDimensionDetail } from '../services/healthMetricsService';
import { startOfDay } from 'date-fns';

/**
 * Calculates Training Load (ACWR) for Rider Profile generation.
 * Logic extracted from HealthMetricsService to support standalone assessment.
 */
export const calculateLoad = (activities: StravaActivity[]): HealthDimensionDetail => {
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
};

/**
 * Calculates Consistency (Habit Formation) for Rider Profile generation.
 * Logic extracted from HealthMetricsService to support standalone assessment.
 */
export const calculateConsistency = (activities: StravaActivity[]): HealthDimensionDetail => {
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

    // Trend Logic
    const recentWeeks = weeks.slice(0, 4);
    const olderWeeks = weeks.slice(4);
    
    // Helper for std dev
    const getStdDev = (values: number[]) => {
         if (values.length === 0) return 0;
         const m = values.reduce((sum, v) => sum + v, 0) / values.length;
         const v = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length;
         return Math.sqrt(v);
    };

    const recentStdDev = getStdDev(recentWeeks);
    const olderStdDev = getStdDev(olderWeeks);
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
};
