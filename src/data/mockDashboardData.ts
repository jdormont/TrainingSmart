import { StravaAthlete, StravaActivity, WeeklyStats, OuraSleepData, OuraReadinessData, DailyMetric, Workout, WeeklyReview } from '../types';
import { WeeklyInsight, HealthMetrics } from '../services/weeklyInsightService';
import { subDays } from 'date-fns';

const now = new Date();

export const MOCK_ATHLETE: StravaAthlete = {
  id: 12345678,
  username: 'demo_athlete',
  firstname: 'Demo',
  lastname: 'Athlete',
  profile: 'https://ui-avatars.com/api/?name=Demo+Athlete&background=random',
  city: 'San Francisco',
  state: 'CA',
  country: 'USA',
  sex: 'M',
  weight: 75
} as unknown as StravaAthlete;

export const MOCK_ACTIVITIES: StravaActivity[] = [
  {
    id: 101,
    name: 'Sunday Long Ride - Base Building',
    distance: 85000,
    moving_time: 10800,
    elapsed_time: 12000,
    total_elevation_gain: 1200,
    type: 'Ride',
    start_date: subDays(now, 1).toISOString(),
    start_date_local: subDays(now, 1).toISOString(),
    timezone: '(GMT-08:00) America/Los_Angeles',
    average_speed: 7.8,
    max_speed: 15.5,
    map: { id: 'm101', summary_polyline: '', resource_state: 2 },
    // Mocking additional fields for display
    average_watts: 180,
    kilojoules: 1950,
    average_heartrate: 135,
    max_heartrate: 155,
  } as unknown as StravaActivity,
  {
    id: 102,
    name: 'VO2 Max Intervals 4x4min',
    distance: 35000,
    moving_time: 4200,
    elapsed_time: 4800,
    total_elevation_gain: 400,
    type: 'Ride',
    start_date: subDays(now, 3).toISOString(),
    start_date_local: subDays(now, 3).toISOString(),
    timezone: '(GMT-08:00) America/Los_Angeles',
    average_speed: 8.3,
    max_speed: 14.0,
    map: { id: 'm102', summary_polyline: '', resource_state: 2 },
    average_watts: 240,
    kilojoules: 1000,
    average_heartrate: 155,
    max_heartrate: 178,
  } as unknown as StravaActivity,
  {
    id: 103,
    name: 'Active Recovery Spin',
    distance: 20000,
    moving_time: 3600,
    elapsed_time: 3600,
    total_elevation_gain: 100,
    type: 'Ride',
    start_date: subDays(now, 4).toISOString(),
    start_date_local: subDays(now, 4).toISOString(),
    timezone: '(GMT-08:00) America/Los_Angeles',
    average_speed: 5.5,
    max_speed: 8.0,
    map: { id: 'm103', summary_polyline: '', resource_state: 2 },
    average_watts: 130,
    kilojoules: 450,
    average_heartrate: 110,
    max_heartrate: 125,
  } as unknown as StravaActivity
];

export const MOCK_WEEKLY_STATS: WeeklyStats = {
  weekStart: subDays(now, 6),
  totalDistance: 140000,
  totalTime: 18600,
  totalElevation: 1700,
  activityCount: 3,
  activities: [], // Simplified for mock
  // Extended fields
  previousWeekDistance: 120000,
  previousWeekTime: 16000,
  distanceChange: 16,
  timeChange: 16
} as unknown as WeeklyStats;

export const MOCK_SLEEP_DATA: OuraSleepData = {
  day: now.toISOString().split('T')[0],
  total_sleep_duration: 28800,
  efficiency: 92,
  rem_sleep_duration: 7200,
  deep_sleep_duration: 5400,
  average_heart_rate: 52,
  lowest_heart_rate: 48,
  score: 88
} as unknown as OuraSleepData;

export const MOCK_READINESS_DATA: OuraReadinessData = {
  day: now.toISOString().split('T')[0],
  score: 88,
  contributors: {
      activity_balance: 90,
      previous_night: 88,
      sleep_balance: 85,
      resting_heart_rate: 95,
      hrv_balance: 92,
      recovery_index: 88,
  },
  timestamp: now.toISOString(),
  temperature_deviation: 0,
  temperature_trend_deviation: 0
} as unknown as OuraReadinessData;

export const MOCK_DAILY_METRIC: DailyMetric = {
  user_id: 'demo',
  date: now.toISOString().split('T')[0],
  recovery_score: 88,
  resting_hr: 48,
  hrv: 65,            // Changed from hrv_balance to hrv to match type? Checking type...
                      // DailyMetric has 'hrv'. 'hrv_balance' was likely incorrect in previous file or extra.
  sleep_minutes: 480, // 8 hours * 60
  sleep_score: 88,    // DailyMetric doesn't strictly have sleep_score/readiness_score in interface?
                      // Let's check type: has 'recovery_score', 'sleep_minutes', 'hrv'.
                      // It seems I added extra fields in mock. I will keep them casted.
  readiness_score: 88,
  soreness_score: 10,
  mood_score: 8,
  energy_score: 9,
  stress_score: 20,
  notes: 'Feeling great today, ready for intensity.'
} as unknown as DailyMetric;

export const MOCK_WEEKLY_INSIGHT: WeeklyInsight = {
  id: 'mock-insight-1',
  type: "training",
  title: "Peaking Recovery",
  message: "Your recovery is peaking. Perfect time for the 'Hill Repeats' session.",
  actionLabel: "Push hard on your next interval session.",
  confidence: 90,
  dataPoints: ["Recovery Score: 88", "Sleep Quality: 92"],
  generatedAt: now,
  weekOf: subDays(now, 1) // Start of week roughly
};

export const MOCK_HEALTH_METRICS: HealthMetrics = {
  cardiovascular: 75,
  endurance: 82,
  recovery: 88,
  sleep: 92,
  trainingBalance: 85,
  overallScore: 84,
  lastUpdated: now,
  dataQuality: 'excellent',
  details: {
    cardiovascular: {
      score: 75,
      components: [
        { name: 'Average Speed', value: '18.5 mph', contribution: 30 },
        { name: 'Heart Rate Efficiency', value: '145 bpm avg', contribution: 25 },
        { name: 'Resting Heart Rate', value: '48 bpm', contribution: 20 }
      ],
      trend: 'improving',
      suggestion: 'Excellent cardiovascular fitness - maintain with varied intensity'
    },
    endurance: {
      score: 82,
      components: [
        { name: 'Weekly Volume', value: '120 miles/week', contribution: 35 },
        { name: 'Longest Ride', value: '52 miles', contribution: 25 },
        { name: 'Training Consistency', value: '95/100', contribution: 22 }
      ],
      trend: 'stable',
      suggestion: 'Strong endurance base - focus on maintaining consistency'
    },
    recovery: {
      score: 88,
      components: [
        { name: 'Readiness Score', value: '88/100', contribution: 44 },
        { name: 'Recovery Consistency', value: '90% consistent', contribution: 22 },
        { name: 'Recovery Trend', value: 'Improving', contribution: 22 }
      ],
      trend: 'improving',
      suggestion: 'Excellent recovery capacity - you can handle current training load'
    },
    sleep: {
      score: 92,
      components: [
        { name: 'Sleep Duration', value: '8.0h avg', contribution: 40 },
        { name: 'Sleep Efficiency', value: '92%', contribution: 28 },
        { name: 'Deep Sleep', value: '18.5%', contribution: 24 }
      ],
      trend: 'stable',
      suggestion: 'Excellent sleep quality supporting your training'
    },
    trainingBalance: {
      score: 85,
      components: [
        { name: 'Easy/Hard Balance', value: '78% easy rides', contribution: 35 },
        { name: 'Rest Day Frequency', value: 'Good', contribution: 25 },
        { name: 'Load Progression', value: 'Appropriate', contribution: 25 }
      ],
      trend: 'stable',
      suggestion: 'Good training balance - maintain 80/20 easy/hard split'
    }
  },
  profile: {
    discipline: {
      level: 10,
      currentValue: "6.5 days/wk",
      nextLevelCriteria: "Max",
      prompt: "Maximum Discipline achieved! Keep the streak alive."
    },
    stamina: {
      level: 8,
      currentValue: "4h 30m",
      nextLevelCriteria: "5h 0m",
      prompt: "Extend your weekend long ride by ~30 minutes to unlock the next level."
    },
    punch: {
      level: 6,
      currentValue: "10.0%",
      nextLevelCriteria: "12.5%",
      prompt: "You need more intensity. Try the '4x8m Threshold' workout this week."
    },
    capacity: {
      level: 7,
      currentValue: "1.15",
      nextLevelCriteria: "1.20",
      prompt: "Safely increase volume to ACWR 1.20 for Level 8."
    },
    form: {
      level: 9,
      currentValue: "+2.8%",
      nextLevelCriteria: "+3.5%",
      prompt: "Peak efficiency approaching. Focus on steady state."
    }
  }
} as unknown as HealthMetrics;

export const MOCK_NEXT_WORKOUT: Workout | null = null;

// ── Weekly review (demo mode) ───────────────────────────────────────────────
const demoWeekStart = (weeksAgo: number): string => {
  const d = new Date();
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday - 7 * weeksAgo);
  return d.toISOString().slice(0, 10);
};

/** Newest first. Index 0 is the most recently completed week. */
export const MOCK_WEEKLY_REVIEWS: WeeklyReview[] = [
  {
    id: 'demo-review-1',
    userId: 'demo',
    weekStart: demoWeekStart(1),
    adherenceScore: 82,
    stats: { score: 82, workoutsPlanned: 4, workoutsCompleted: 3, workoutsSkipped: 1, workoutsExcused: 0, plannedMinutes: 220, completedMinutes: 180, avgRpe: 3 },
    reviewText:
      'You showed up for three of your four sessions, and your Saturday ride was a real highlight. ' +
      'Midweek was the tricky spot; a missed session is just useful information about how busy that day gets. ' +
      'Next week, try moving Wednesday to a short 30-minute spin earlier in the day so it fits around your schedule. ' +
      'Small and steady wins.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-review-2',
    userId: 'demo',
    weekStart: demoWeekStart(2),
    adherenceScore: 74,
    stats: { score: 74, workoutsPlanned: 4, workoutsCompleted: 3, workoutsSkipped: 1, workoutsExcused: 0, plannedMinutes: 200, completedMinutes: 150 },
    reviewText: 'A solid week: three sessions done and a steady rhythm building. Keep the easy days easy and protect your long ride.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-review-3',
    userId: 'demo',
    weekStart: demoWeekStart(3),
    adherenceScore: 90,
    stats: { score: 90, workoutsPlanned: 3, workoutsCompleted: 3, workoutsSkipped: 0, workoutsExcused: 0, plannedMinutes: 150, completedMinutes: 145 },
    reviewText: 'Every planned session done. That consistency is exactly what builds fitness over time.',
    createdAt: new Date().toISOString(),
  },
];
