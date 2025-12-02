// Sleep Score Calculator based on Oura Ring methodology
// Reverse-engineered from public Oura documentation and research

export interface SleepScoreComponents {
  totalScore: number;
  components: {
    totalSleep: { score: number; weight: number };
    efficiency: { score: number; weight: number };
    restfulness: { score: number; weight: number };
    remSleep: { score: number; weight: number };
    deepSleep: { score: number; weight: number };
    latency: { score: number; weight: number };
    timing: { score: number; weight: number };
  };
}

export function calculateSleepScore(sleepData: {
  total_sleep_duration: number; // seconds
  efficiency: number; // percentage
  restless_periods: number;
  rem_sleep_duration: number; // seconds
  deep_sleep_duration: number; // seconds
  light_sleep_duration: number; // seconds
  latency: number; // seconds to fall asleep
  bedtime_start: string; // ISO string
  bedtime_end: string; // ISO string
  time_in_bed: number; // seconds
}): SleepScoreComponents {
  
  console.log('=== SLEEP SCORE CALCULATION DEBUG ===');
  console.log('Input sleep data:', sleepData);
  
  // Convert durations to hours for easier calculation
  const totalSleepHours = sleepData.total_sleep_duration / 3600;
  const remSleepHours = sleepData.rem_sleep_duration / 3600;
  const deepSleepHours = sleepData.deep_sleep_duration / 3600;
  const lightSleepHours = sleepData.light_sleep_duration / 3600;
  const latencyMinutes = sleepData.latency / 60;
  const timeInBedHours = sleepData.time_in_bed / 3600;
  
  console.log('Converted values:', {
    totalSleepHours,
    remSleepHours,
    deepSleepHours,
    lightSleepHours,
    latencyMinutes,
    timeInBedHours
  });
  
  // Component weights (based on Oura's methodology)
  const weights = {
    totalSleep: 0.25,    // 25% - Most important
    efficiency: 0.20,    // 20% - Sleep efficiency
    restfulness: 0.15,   // 15% - How restful the sleep was
    remSleep: 0.15,      // 15% - REM sleep quality
    deepSleep: 0.10,     // 10% - Deep sleep amount
    latency: 0.10,       // 10% - Time to fall asleep
    timing: 0.05         // 5% - Sleep timing consistency
  };

  // 1. Total Sleep Score (optimal: 7-9 hours)
  const totalSleepScore = calculateTotalSleepScore(totalSleepHours);
  
  // 2. Efficiency Score (already provided as percentage)
  const efficiencyScore = Math.min(sleepData.efficiency, 100);
  
  // 3. Restfulness Score (based on restless periods and awake time)
  const restfulnessScore = calculateRestfulnessScore(
    sleepData.restless_periods, 
    totalSleepHours,
    timeInBedHours
  );
  
  // 4. REM Sleep Score (optimal: 20-25% of total sleep)
  const remSleepScore = calculateRemSleepScore(remSleepHours, totalSleepHours);
  
  // 5. Deep Sleep Score (optimal: 15-20% of total sleep)
  const deepSleepScore = calculateDeepSleepScore(deepSleepHours, totalSleepHours);
  
  // 6. Sleep Latency Score (optimal: 10-20 minutes)
  const latencyScore = calculateLatencyScore(latencyMinutes);
  
  // 7. Sleep Timing Score (based on bedtime consistency)
  const timingScore = calculateTimingScore(sleepData.bedtime_start);
  
  // Calculate weighted total score
  const totalScore = Math.round(
    (totalSleepScore * weights.totalSleep) +
    (efficiencyScore * weights.efficiency) +
    (restfulnessScore * weights.restfulness) +
    (remSleepScore * weights.remSleep) +
    (deepSleepScore * weights.deepSleep) +
    (latencyScore * weights.latency) +
    (timingScore * weights.timing)
  );
  
  console.log('Individual component scores:', {
    totalSleepScore,
    efficiencyScore,
    restfulnessScore,
    remSleepScore,
    deepSleepScore,
    latencyScore,
    timingScore
  });
  
  console.log('Weighted contributions:', {
    totalSleep: totalSleepScore * weights.totalSleep,
    efficiency: efficiencyScore * weights.efficiency,
    restfulness: restfulnessScore * weights.restfulness,
    remSleep: remSleepScore * weights.remSleep,
    deepSleep: deepSleepScore * weights.deepSleep,
    latency: latencyScore * weights.latency,
    timing: timingScore * weights.timing
  });
  
  console.log('Final calculated score:', totalScore);
  console.log('=== END SLEEP SCORE CALCULATION ===');

  return {
    totalScore: Math.min(Math.max(totalScore, 0), 100),
    components: {
      totalSleep: { score: totalSleepScore, weight: weights.totalSleep },
      efficiency: { score: efficiencyScore, weight: weights.efficiency },
      restfulness: { score: restfulnessScore, weight: weights.restfulness },
      remSleep: { score: remSleepScore, weight: weights.remSleep },
      deepSleep: { score: deepSleepScore, weight: weights.deepSleep },
      latency: { score: latencyScore, weight: weights.latency },
      timing: { score: timingScore, weight: weights.timing }
    }
  };
}

function calculateTotalSleepScore(hours: number): number {
  // Optimal sleep: 7-9 hours = 100 points
  // 6-7 or 9-10 hours = 80-99 points
  // <6 or >10 hours = lower scores
  
  if (hours >= 7 && hours <= 9) {
    return 100;
  } else if (hours >= 6 && hours < 7) {
    // Linear scale from 80 to 100
    return 80 + ((hours - 6) * 20);
  } else if (hours > 9 && hours <= 10) {
    // Linear scale from 100 to 80
    return 100 - ((hours - 9) * 20);
  } else if (hours >= 5 && hours < 6) {
    // Linear scale from 60 to 80
    return 60 + ((hours - 5) * 20);
  } else if (hours > 10 && hours <= 11) {
    // Linear scale from 80 to 60
    return 80 - ((hours - 10) * 20);
  } else if (hours < 5) {
    return Math.max(20, 60 - ((5 - hours) * 15));
  } else {
    return Math.max(20, 60 - ((hours - 11) * 10));
  }
}

function calculateRestfulnessScore(restlessPeriods: number, sleepHours: number, timeInBedHours: number): number {
  // Lower restless periods = higher score
  // Normalize by sleep duration
  const restlessnessRate = restlessPeriods / (sleepHours * 60); // per minute of sleep
  
  if (restlessnessRate <= 0.5) {
    return 100;
  } else if (restlessnessRate <= 1.0) {
    return 100 - ((restlessnessRate - 0.5) * 40);
  } else if (restlessnessRate <= 2.0) {
    return 80 - ((restlessnessRate - 1.0) * 30);
  } else {
    return Math.max(20, 50 - ((restlessnessRate - 2.0) * 10));
  }
}

function calculateRemSleepScore(remHours: number, totalHours: number): number {
  const remPercentage = (remHours / totalHours) * 100;
  
  // Optimal REM: 20-25% of total sleep
  if (remPercentage >= 20 && remPercentage <= 25) {
    return 100;
  } else if (remPercentage >= 15 && remPercentage < 20) {
    return 80 + ((remPercentage - 15) * 4);
  } else if (remPercentage > 25 && remPercentage <= 30) {
    return 100 - ((remPercentage - 25) * 4);
  } else if (remPercentage >= 10 && remPercentage < 15) {
    return 60 + ((remPercentage - 10) * 4);
  } else if (remPercentage > 30 && remPercentage <= 35) {
    return 80 - ((remPercentage - 30) * 4);
  } else {
    return Math.max(20, 40);
  }
}

function calculateDeepSleepScore(deepHours: number, totalHours: number): number {
  const deepPercentage = (deepHours / totalHours) * 100;
  
  // Optimal deep sleep: 15-20% of total sleep
  if (deepPercentage >= 15 && deepPercentage <= 20) {
    return 100;
  } else if (deepPercentage >= 10 && deepPercentage < 15) {
    return 80 + ((deepPercentage - 10) * 4);
  } else if (deepPercentage > 20 && deepPercentage <= 25) {
    return 100 - ((deepPercentage - 20) * 4);
  } else if (deepPercentage >= 5 && deepPercentage < 10) {
    return 60 + ((deepPercentage - 5) * 4);
  } else {
    return Math.max(30, 50);
  }
}

function calculateLatencyScore(latencyMinutes: number): number {
  // Optimal latency: 10-20 minutes
  if (latencyMinutes >= 10 && latencyMinutes <= 20) {
    return 100;
  } else if (latencyMinutes >= 5 && latencyMinutes < 10) {
    return 90 + ((latencyMinutes - 5) * 2);
  } else if (latencyMinutes > 20 && latencyMinutes <= 30) {
    return 100 - ((latencyMinutes - 20) * 2);
  } else if (latencyMinutes < 5) {
    return 90 - ((5 - latencyMinutes) * 5); // Falling asleep too quickly can indicate sleep debt
  } else if (latencyMinutes > 30) {
    return Math.max(40, 80 - ((latencyMinutes - 30) * 2));
  }
  return 80;
}

function calculateTimingScore(bedtimeStart: string): number {
  const bedtime = new Date(bedtimeStart);
  const hour = bedtime.getHours();
  
  // Optimal bedtime: 9 PM - 11 PM (21-23)
  if (hour >= 21 && hour <= 23) {
    return 100;
  } else if (hour >= 20 && hour < 21) {
    return 90;
  } else if ((hour >= 0 && hour <= 1) || hour === 19) {
    return 85;
  } else if ((hour >= 2 && hour <= 3) || hour === 18) {
    return 75;
  } else {
    return 60; // Very early or very late bedtimes
  }
}

// Helper function to get score color for UI
export function getSleepScoreColor(score: number): string {
  if (score >= 85) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function getSleepScoreBgColor(score: number): string {
  if (score >= 85) return 'bg-green-50';
  if (score >= 70) return 'bg-yellow-50';
  return 'bg-red-50';
}