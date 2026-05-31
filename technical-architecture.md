# TrainingSmart AI — Technical Architecture & Database Design

This document outlines the technical framework, data models, integration flows, and security infrastructure for TrainingSmart AI.

---

## 1. Technology Stack

- **Frontend:** React SPA (TypeScript, Vite, `@tanstack/react-query`)
- **Styling:** Tailwind CSS ("Midnight Pro" custom theme)
- **Database & Auth:** Supabase (PostgreSQL, Row-Level Security, Edge Functions)
- **AI Engine:** Anthropic / OpenAI (via secure Supabase Edge Functions)
- **Integrations:** Strava API (v3), Oura API (v2), Google Calendar API (v3)

---

## 2. Environment Variables Template

```env
# Strava API Configuration
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback

# Google Calendar OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/settings

# Oura Ring OAuth
VITE_OURA_CLIENT_ID=your_oura_client_id
VITE_OURA_CLIENT_SECRET=your_oura_client_secret
VITE_OURA_REDIRECT_URI=http://localhost:5173/auth/oura/callback

# Supabase Credentials
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# YouTube API (for content curation feed)
VITE_YOUTUBE_API_KEY=your_youtube_api_key
```

---

## 3. Database Migrations

### Migration 1: Chat-to-Plan Linking
```sql
ALTER TABLE training_plans
  ADD COLUMN source_chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  ADD COLUMN chat_context_snapshot JSONB;

CREATE INDEX idx_training_plans_chat_session ON training_plans(source_chat_session_id);
```

### Migration 2: Activity Reconciliation (Strava Matching)
```sql
ALTER TABLE workouts
  ADD COLUMN strava_activity_id BIGINT UNIQUE,
  ADD COLUMN activity_match_score NUMERIC(5,2) CHECK (activity_match_score >= 0 AND activity_match_score <= 100),
  ADD COLUMN auto_matched BOOLEAN DEFAULT false,
  ADD COLUMN match_metadata JSONB,
  ADD COLUMN linked_at TIMESTAMPTZ;

CREATE INDEX idx_workouts_strava_activity ON workouts(strava_activity_id);
CREATE INDEX idx_workouts_auto_matched ON workouts(auto_matched) WHERE strava_activity_id IS NOT NULL;
```

---

## 4. Key TypeScript Types

### Content Feeds (`types/index.ts`)
```typescript
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
  duration?: number;
}

export interface UserContentProfile {
  interests: string[];
  favoriteCreators: string[];
  activityTypes: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
}
```

### Workouts & Activity Metadata
```typescript
export interface ActivityMetadata {
  sets_reps?: string;
  yoga_style?: string;
  elevation_gain?: number;
  terrain?: string;
  pace_zone?: string;
  rpe?: number;
  checkin_notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  type: 'run' | 'bike' | 'swim' | 'strength' | 'rest' | 'yoga' | 'hiking';
  description: string;
  duration: number; // minutes
  distance?: number; // meters
  intensity: 'easy' | 'moderate' | 'hard' | 'recovery';
  scheduledDate: Date;
  completed: boolean;
  status: 'planned' | 'completed' | 'skipped';
  activity_metadata?: ActivityMetadata;
}
```

---

## 5. Security & Edge Function Standards

- **DOMPurify Sanitization:** Sanitize all markdown rendering on the client-side (`src/utils/markdownToHtml.ts`) to block XSS attacks.
- **Edge Function Validation:** All Supabase Edge Functions must enforce structured schema checks (via `_shared/validate.ts`) for parameters.
- **CORS Lockdown:** Restricted origins allowlist on admin endpoints; no open wildcards.
- **IP-Based Rate Limiting:** Enforced on high-compute LLM endpoints (`openai-chat`) at a rate of 30 requests/minute.
- **Supabase Row-Level Security (RLS):** Policies verify users only modify data associated with their authenticated `user_id`.

---

## 6. Sync & Data Cache Strategy

- **Strava API Rate Limits:** Respect 200 requests/15-min and 2,000/day. Preload and cache athlete activities in `strava_activities_cache` with a 15-minute expiration block.
- **Calorie/Energy Fallback:** When Strava activities lack direct power meter `kilojoules` data, estimate calories based on duration: `estimated_kcal = (duration_seconds / 3600) * 600`.
- **Adherence Math:** Adherence is calculated dynamically on the plans page from the proportion of completed workouts vs. scheduled goals.
