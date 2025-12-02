// Application constants

export const STRAVA_CONFIG = {
  BASE_URL: 'https://www.strava.com/api/v3',
  AUTH_URL: 'https://www.strava.com/oauth/authorize',
  TOKEN_URL: 'https://www.strava.com/oauth/token',
  SCOPES: 'read,activity:read_all',
} as const;

export const OURA_CONFIG = {
  BASE_URL: 'https://api.ouraring.com',
  AUTH_URL: 'https://cloud.ouraring.com/oauth/authorize',
  SCOPES: 'personal daily', // Removed email scope as it might need approval
} as const;

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  CHAT: '/chat',
  PLANS: '/plans',
  CALENDAR: '/calendar',
  SETTINGS: '/settings',
  AUTH_CALLBACK: '/auth/callback'
} as const;

export const STORAGE_KEYS = {
  STRAVA_TOKENS: 'strava_tokens',
  OURA_TOKENS: 'oura_tokens',
  ATHLETE_DATA: 'athlete_data',
  CHAT_HISTORY: 'chat_history',
  CHAT_SESSIONS: 'chat_sessions',
  ACTIVE_CHAT_SESSION: 'active_chat_session',
  TRAINING_PLANS: 'training_plans',
  SYSTEM_PROMPT: 'system_prompt',
  USER_CONTENT_PROFILE: 'user_content_profile',
  CONTENT_CACHE: 'content_cache',
  CONTENT_FEEDBACK: 'content_feedback',
} as const;

export const ACTIVITY_TYPES = {
  RUN: 'Run',
  RIDE: 'Ride',
  SWIM: 'Swim',
  HIKE: 'Hike',
  WALK: 'Walk',
  WORKOUT: 'Workout',
  YOGA: 'Yoga',
} as const;

export const COLORS = {
  STRAVA_ORANGE: '#FC5200',
  PRIMARY: '#FC5200',
  SECONDARY: '#6B7280',
  SUCCESS: '#10B981',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
} as const;