// Core application types

export interface StravaAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  profile: string;
  city: string;
  state: string;
  country: string;
  sex: 'M' | 'F';
  weight: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  type: string; // Run, Ride, Swim, etc.
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  average_speed: number; // m/s
  max_speed: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  max_watts?: number;
  weighted_average_watts?: number;
  device_watts?: boolean;
  elev_high?: number;
  elev_low?: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
}

export interface StravaZoneBucket {
  min: number;
  max: number;
  time: number; // seconds
}

export interface StravaZone {
  score?: number;
  distribution_buckets: StravaZoneBucket[];
  type: 'heartrate' | 'power';
  resource_state: number;
  sensor_based: boolean;
  points?: number;
  custom_zones?: boolean;
  max?: number;
}

export interface StravaStats {
  biggest_ride_distance: number;
  biggest_climb_elevation_gain: number;
  recent_ride_totals: ActivityTotals;
  recent_run_totals: ActivityTotals;
  recent_swim_totals: ActivityTotals;
  ytd_ride_totals: ActivityTotals;
  ytd_run_totals: ActivityTotals;
  ytd_swim_totals: ActivityTotals;
  all_ride_totals: ActivityTotals;
  all_run_totals: ActivityTotals;
  all_swim_totals: ActivityTotals;
}

export interface ActivityTotals {
  count: number;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  elevation_gain: number; // meters
  achievement_count: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  name: string;
  description?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  category?: 'training' | 'recovery' | 'strategy' | 'nutrition' | 'goals' | 'analysis' | 'general' | 'content_preferences';
}

export interface ChatContextSnapshot {
  goals: string[];
  constraints: {
    timeAvailability?: string;
    equipment?: string[];
    injuries?: string[];
    other?: string[];
  };
  preferences: {
    workoutTypes?: string[];
    intensityPreference?: string;
    trainingDays?: number[];
  };
  keyMessages: Array<{
    messageId: string;
    content: string;
    relevance: string;
  }>;
  confidenceScores: {
    goals: number;
    constraints: number;
    preferences: number;
  };
  extractedAt: Date;
}

export interface TrainingPlan {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  goal: string;
  workouts: Workout[];
  createdAt: Date;
  sourceChatSessionId?: string;
  chatContextSnapshot?: ChatContextSnapshot;
}

export interface Workout {
  id: string;
  name: string;
  type: 'run' | 'bike' | 'swim' | 'strength' | 'rest';
  description: string;
  duration: number; // minutes
  distance?: number; // meters
  intensity: 'easy' | 'moderate' | 'hard' | 'recovery';
  scheduledDate: Date;
  completed: boolean;
  status: 'planned' | 'completed' | 'skipped';
  google_calendar_event_id?: string;
}

export interface ContentItem {
  id: string;
  source: 'youtube' | 'instagram' | 'rss' | 'magazine';
  type: 'video' | 'article' | 'image' | 'race_result';
  title: string;
  description: string;
  url: string;
  thumbnail?: string;
  author: string;
  publishedAt: Date;
  relevanceScore: number;
  tags: string[];
  duration?: number; // for videos in seconds
  viewCount?: number;
  channelSubscribers?: number;
}

export interface UserContentProfile {
  interests: string[]; // extracted from chats
  favoriteCreators: string[];
  activityTypes: string[]; // from Strava
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  preferredContentTypes: ('video' | 'article' | 'image')[];
  lastUpdated: Date;
}

export interface WeeklyStats {
  weekStart: Date;
  totalDistance: number;
  totalTime: number;
  totalElevation: number;
  activityCount: number;
  averagePace?: number;
  activities: StravaActivity[];
}

// Oura Ring Data Types
export interface OuraTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number; // Calculated timestamp
  expires_in?: number; // Raw seconds from API
  token_type: string;
}

export interface OuraSleepData {
  id: string;
  day: string; // YYYY-MM-DD format
  bedtime_start: string;
  bedtime_end: string;
  total_sleep_duration: number; // seconds
  efficiency: number; // percentage
  latency: number; // seconds to fall asleep
  awake_time: number; // seconds
  light_sleep_duration: number; // seconds
  deep_sleep_duration: number; // seconds
  rem_sleep_duration: number; // seconds
  restless_periods: number; // count
  sleep_score_delta: number; // score change
  temperature_deviation?: number;
  average_heart_rate: number;
  lowest_heart_rate: number;
  average_hrv: number;
  time_in_bed: number; // seconds
  average_breath?: number; // average breathing rate
}

export interface OuraReadinessData {
  id: string;
  day: string; // YYYY-MM-DD format
  score: number; // 0-100
  temperature_deviation: number;
  temperature_trend_deviation: number;
  timestamp: string;
  contributors: {
    activity_balance?: number;
    body_battery?: number;
    hrv_balance?: number;
    previous_day_activity?: number;
    previous_night?: number;
    recovery_index?: number;
    resting_heart_rate?: number;
    sleep_balance?: number;
  };
}

export interface OuraDailySleepData {
  id: string;
  day: string;
  score: number;
  timestamp: string;
  contributors: {
      deep_sleep: number;
      efficiency: number;
      latency: number;
      rem_sleep: number;
      restfulness: number;
      timing: number;
      total_sleep: number;
  };
}

export interface OuraActivityData {
  id: string;
  day: string; // YYYY-MM-DD format
  score: number; // 0-100
  active_calories: number;
  average_met_minutes: number;
  equivalent_walking_distance: number; // meters
  high_activity_met_minutes: number;
  high_activity_time: number; // seconds
  inactivity_alerts: number;
  low_activity_met_minutes: number;
  low_activity_time: number; // seconds
  medium_activity_met_minutes: number;
  medium_activity_time: number; // seconds
  meters_to_target: number;
  non_wear_time: number; // seconds
  resting_time: number; // seconds
  sedentary_met_minutes: number;
  sedentary_time: number; // seconds
  steps: number;
  target_calories: number;
  target_meters: number;
  total_calories: number;
}


export interface DailyMetric {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD format
  sleep_minutes?: number;
  resting_hr?: number;
  hrv?: number;
  respiratory_rate?: number;
  recovery_score?: number;
  
  // Oura Extended Fields
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  light_sleep_minutes?: number;
  sleep_efficiency?: number;
  temperature_deviation?: number;
  source?: 'manual' | 'oura' | 'apple_health';

  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_admin: boolean;
  ingest_key?: string;
  created_at: string;
  updated_at: string;
}