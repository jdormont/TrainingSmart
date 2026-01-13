# TrainingSmart AI - Product Requirements Document

## Project Overview

Build a personal training assistant web app that integrates Strava activity data
with AI-powered training advice and Google Calendar scheduling. The app will
analyze real workout data to provide personalized training recommendations
through a conversational AI interface.

## Target User

Solo athlete/fitness enthusiast who uses Strava to track workouts and wants
AI-powered training guidance based on their actual performance data.

## Core Value Proposition

- **Data-Driven**: Uses real Strava activity data, not generic advice
- **AI-Powered**: Conversational interface for personalized training guidance
- **Schedule-Integrated**: Connects training plans to real calendar availability
- **Personal**: Built for individual use with full data privacy

---

## Technical Architecture

### Frontend Framework

- **React** with TypeScript
- **Tailwind CSS** for styling
- **Responsive design** (mobile-first approach)
- **Single Page Application (SPA)**

### Key Dependencies & APIs

```json
{
  "strava-api": "v3",
  "google-calendar-api": "v3",
  "openai-api": "GPT-4",
  "axios": "HTTP client",
  "react-router": "Navigation",
  "date-fns": "Date manipulation",
  "recharts": "Data visualization"
}
```

### Authentication Flow

- **Strava OAuth 2.0**: Authorization Code Flow
- **Google OAuth 2.0**: Web server applications flow
- Store tokens securely in localStorage with refresh logic

---

## Feature Specifications

### 1. Authentication & Setup

**User Story**: As a user, I want to securely connect my Strava and Google
Calendar accounts.

**Implementation**:

- Landing page with "Connect with Strava" button
- OAuth redirect handling for Strava API access
- Secondary "Connect Google Calendar" option
- Store access tokens with automatic refresh

**Acceptance Criteria**:

- ✅ **COMPLETED** - User can authenticate with Strava OAuth
- ✅ **COMPLETED** - App receives proper scopes: `read,activity:read_all`
- ✅ **COMPLETED** - Tokens are stored and refreshed automatically
- ✅ **COMPLETED** - User sees connection status clearly
- ✅ **COMPLETED** - Multiple auth flows (direct, callback, manual)

### 2. Activity Data Dashboard

**User Story**: As a user, I want to see my recent training data and key
metrics.

**Implementation**:

```javascript
// Key data to fetch from Strava API
const dataPoints = {
  recentActivities: "/athlete/activities?per_page=10",
  athleteStats: "/athletes/{id}/stats",
  weeklyStats: "calculated from recent activities",
};
```

**UI Components**:

- Recent activities list (last 10 workouts)
- Weekly summary cards (distance, time, elevation)
- Simple charts showing training trends
- Activity type breakdown (run, bike, swim, etc.)

**Acceptance Criteria**:

- ✅ **COMPLETED** - Displays last 20 activities with detailed metrics
- ✅ **COMPLETED** - Shows weekly aggregated stats with visual cards
- ✅ **COMPLETED** - Advanced training trends chart with 8-week history
- ✅ **COMPLETED** - Activity filtering by type (All, Runs, Outdoor Rides,
  Virtual Rides)
- ✅ **COMPLETED** - Multiple metrics (Distance, Training Load, Speed, Heart
  Rate)
- ✅ **COMPLETED** - Handles loading states gracefully
- ✅ **COMPLETED** - Beautiful activity cards with hover effects

### 3. AI Training Chat Interface

**User Story**: As a user, I want to chat with an AI about my training using my
real data.

**Implementation**:

```javascript
// Chat system integration
const aiPromptStructure = {
  systemPrompt:
    "You are a personal training coach with access to the user's Strava data...",
  userContext: "Recent activities, current fitness level, training history",
  responseFormat: "Conversational but structured training advice",
};
```

**Features**:

- Chat interface with message history
- AI has context of user's recent activities and stats
- Can ask questions like: "Should I run tomorrow?" "Am I overtraining?" "Plan my
  next week"
- Responses include specific recommendations with reasoning

**Acceptance Criteria**:

- ✅ **COMPLETED** - Chat interface sends messages to AI with user's Strava
  context
- ✅ **COMPLETED** - AI responses are informed by actual training data (30
  recent activities)
- ✅ **COMPLETED** - Conversation history is maintained during session
- ✅ **COMPLETED** - Messages display with proper loading states
- ✅ **COMPLETED** - Suggested questions for easy interaction
- ✅ **COMPLETED** - Custom system prompt editor in Settings
- ✅ **COMPLETED** - Pre-built coaching personality templates
- ✅ **COMPLETED** - Error handling for API issues and rate limits

### 4. Training Plan Generator

**User Story**: As a user, I want AI to create specific training plans based on
my data and goals.

**Implementation**:

- Form for training goals (distance, race type, timeline)
- AI generates structured weekly training plans
- Plans consider current fitness level from Strava data
- Output as structured schedule with specific workouts

**UI Components**:

- Goal-setting modal/form
- Generated plan display (weekly calendar view)
- Individual workout detail cards
- Plan modification interface

**Acceptance Criteria**:

- ✅ **COMPLETED** - Basic AI plan generation function exists in openaiService
- ✅ **COMPLETED** - Goal-setting form UI (Intake Wizard)
- ✅ **COMPLETED** - Generated plan display interface (PlansPage)
- ✅ **COMPLETED** - Plan persistence and management (Supabase)
- ✅ **COMPLETED** - Individual workout detail cards
- ✅ **COMPLETED** - Chat-to-Plan Integration (`ChatContextModal`)

### 5. Calendar Integration

**User Story**: As a user, I want to export training sessions to my Google
Calendar to schedule my workouts.

**Implementation**:

```javascript
// Google Calendar API integration
const calendarScopes = ["https://www.googleapis.com/auth/calendar.events"];
const eventCreation = {
  summary: "🚴 Endurance Ride",
  description:
    "Type: Bike\nIntensity: Moderate\nDuration: 90min\nDistance: 25 miles\n\nDetails:\n...\n\nView in app: https://app.url/plans",
  start: { dateTime: "2024-03-15T06:00:00-07:00" },
  end: { dateTime: "2024-03-15T07:30:00-07:00" },
};
```

**Features**:

- Google OAuth 2.0 authentication with secure token storage
- Export entire weeks of workouts with one click
- Export individual workouts from workout cards
- Visual indicators showing which workouts are in calendar
- Automatic token refresh for continued access
- One-way export (no sync back from calendar)

**Acceptance Criteria**:

- ✅ **COMPLETED** - Google OAuth flow with token storage in Supabase
- ✅ **COMPLETED** - Settings page calendar connection UI with status
- ✅ **COMPLETED** - Weekly export button in calendar view
- ✅ **COMPLETED** - Individual export buttons on workout cards
- ✅ **COMPLETED** - Visual indicators for exported workouts
- ✅ **COMPLETED** - Detailed event descriptions with workout info
- ✅ **COMPLETED** - Default workout times by type
- ✅ **COMPLETED** - Link back to app in calendar events

---

## Data Models & API Integration

### Strava API Endpoints to Use

```javascript
const stravaEndpoints = {
  athlete: "/athlete",
  activities: "/athlete/activities",
  activityDetails: "/activities/{id}",
  stats: "/athletes/{id}/stats",
};
```

### Data Processing Requirements

- **Activity aggregation**: Weekly/monthly summaries
- **Training load calculation**: Based on time, distance, heart rate
- **Recovery metrics**: Days since last hard workout
- **Trend analysis**: Performance improvements over time

### AI Context Building

```javascript
const buildAIContext = (userData) => {
  return {
    recentActivities: userData.activities.slice(0, 10),
    weeklyVolume: calculateWeeklyStats(userData.activities),
    fitnessLevel: estimateFitnessLevel(userData.stats),
    activityTypes: getPreferredActivities(userData.activities),
    trainingConsistency: calculateConsistency(userData.activities),
  };
};
```

---

## UI/UX Guidelines

### Design System

- **Color Palette**: Strava orange (#FC5200) as primary, clean whites/grays
- **Typography**: System fonts, clear hierarchy
- **Layout**: Card-based design, mobile-responsive
- **Icons**: Feather icons or Lucide React

### Key Pages Structure

1. **Dashboard** (`/`): Activity summary + quick chat
2. **Chat** (`/chat`): Full AI conversation interface
3. **Plans** (`/plans`): Training plan generation and management
4. **Calendar** (`/calendar`): Integrated schedule view
5. **Settings** (`/settings`): Account connections and preferences

### Component Library Needed

```jsx
// Key components to build
<ActivityCard />
<StatsSummary />
<ChatInterface />
<TrainingPlanCard />
<CalendarIntegration />
<AuthButton />
<LoadingSpinner />
```

---

## Environment Variables Required

```env
# Strava API
VITE_STRAVA_CLIENT_ID=your_strava_client_id
VITE_STRAVA_CLIENT_SECRET=your_strava_client_secret
VITE_STRAVA_REDIRECT_URI=http://localhost:5173/auth/callback

# Oura Ring API
VITE_OURA_CLIENT_ID=your_oura_client_id
VITE_OURA_CLIENT_SECRET=your_oura_client_secret
VITE_OURA_REDIRECT_URI=http://localhost:5173/auth/oura/callback

# Google Calendar API
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_CLIENT_SECRET=your_google_client_secret

# OpenAI API
VITE_OPENAI_API_KEY=your_openai_api_key

# YouTube API (for content feed)
VITE_YOUTUBE_API_KEY=your_youtube_api_key

# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Development Phases

### Phase 1: MVP (Build First)

- [x] **COMPLETED** - Strava OAuth authentication
- [x] **COMPLETED** - Advanced activity data display with trends
- [x] **COMPLETED** - AI chat with full training context
- [x] **COMPLETED** - Custom AI coach personality system
- [x] **COMPLETED** - Custom AI coach personality system
- [x] **COMPLETED** - Training plan generation UI (Manual & Chat-based)
- [x] **COMPLETED** - Bio-Aware Insights System

### Phase 2: Enhanced Features

- [x] **COMPLETED** - Google Calendar integration (one-way export)
- [x] **COMPLETED** - Advanced data visualization (Bio-Aware Insights, Training
      Trends)
- [x] **COMPLETED** - Training plan persistence
- [x] **COMPLETED** - Goal setting and tracking (Intake Wizard)
- [x] **COMPLETED** - **Training Streaks & Habit Tracking**

### Phase 3: Polish & Deploy

- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Mobile responsiveness testing
- [ ] Deployment setup

---

## ✅ COMPLETED FEATURES (Current Status)

### 🔐 **Authentication & Security**

- **[NEW]** **Redesigned Login & Signup**: Sleek "Midnight Pro" themed
  authentication pages.
- Full Strava OAuth 2.0 implementation
- Multiple auth flows (direct, callback, manual)
- Token management with automatic refresh
- Secure token storage

### 📊 **Dashboard & Data Visualization**

- **[NEW]** **Refactored Training Trends**: Consolidated controls, interactive
  metric toggle cards (`TrainingTrendsChart`).
- **[NEW]** **Intent Chips**: Quick-adjust "Need Rest", "Short on Time", "Feel
  Fresh" chips for daily workout modification.
- **[NEW]** **Guest/Demo Mode**: Dashboard access via `?demo=true` with mock
  data.
- **[NEW]** **Redesigned Layout**: 2-column layout with Hero component.
- Enhanced Recovery Card with weighted score visualization & grid layout
- Respiratory Rate tracking and trend analysis
- Beautiful activity cards with detailed metrics
- Activity filtering (All, Runs, Outdoor Rides, Virtual Rides)
- Responsive design with hover effects

### 🤖 **AI Chat System**

- Full conversational interface with message history
- AI coach with access to 30 recent activities
- **[NEW]** **Enhanced Context**: AI now receives Heart Rate, Power, and
  Elevation data.
- **[NEW]** **Rich Formatting**: Markdown tables for data comparisons in chat.
- Custom system prompt editor in Settings
- Pre-built coaching personality templates
- Suggested questions for easy interaction
- Comprehensive error handling

### ⚙️ **Settings & Integrations**

- **[NEW]** **Apple Watch Health Sync**: "Ingest Key" generation for iOS
  Shortcut integration (Sleep, HRV, RHR).
- **[NEW]** **PostHog Analytics**: Privacy-focused product analytics
  integration.
- System prompt editor with live preview
- Account information display
- Secure account disconnection
- Google Calendar connection management
- Oura Ring integration controls

### 🧬 **Bio-Aware Training Insights**

- **[NEW]** **Health Metrics Documentation**: Detailed breakdown of "Health
  Balance" vs "Rider Profile" in `HEALTH_METRICS.md`.
- **Weighted Recovery Score**: Composed of Sleep Quality, HRV, and Resting Heart
  Rate (RHR).
- **Matrix-Based Analysis**: Analyzes intersection of _Pacing_ (Volume vs Goal)
  and _Recovery_.
- **Readiness Score**: Aggregates data from multiple sources to determine
  "Fresh" vs "Fatigued" state.

### 📋 **Interactive Training Planner**

- **[NEW]** **Focus Mode**: Sticky header and "Current Week" auto-expansion for
  better usability.
- **Chat-to-Plan**: Automatic detection and generation of plans.
- **Plan Management**:
  - Drag-and-drop workout rescheduling (`@dnd-kit`).
  - **Strava Reconciliation**: Link actual activities to planned workouts.
  - Weekly Google Calendar export.
  - Full persistence via Supabase.

### 🔥 **Training Streaks System**

- **Smart Backfill**: Automatically calculates streak from past 365 days of
  Strava history.
- **Active Recovery**: "Rest Days" check-ins.
- **Loss Aversion**: Banked "Freezes" for missed days.
- **UI Integration**: Flame widget and visual indicators.

### 🚀 **UI & Design**

- **[NEW]** **"Midnight Pro" Theme**: Cohesive dark mode redesign across the
  entire application.
- **Onboarding**: 3-step Intake Wizard (Goal, Availability, Persona).
- **Personalized Content**: Hybrid interest-based content feed.

---

## 🚧 REMAINING WORK

### 📋 **Training Plan Generator (Enhancements)**

- [ ] Advanced periodization logic
- [ ] Plan templates library
- [ ] Recurring season schedules

### 📺 **Content Feed - Phases 2 & 3**

- **Phase 2**: Instagram API, RSS feeds (Bicycling, Outside Magazine)
- **Phase 3**: Machine learning recommendations, user feedback

### 👤 **User Profile & Onboarding (Refinements)**

- [ ] Advanced equipment tracking (bike weight, sensors)
- [ ] More granular availability settings (am/pm preferences)

### 🎨 **Polish & Enhancement**

- Mobile responsiveness improvements
- Performance optimization
- Advanced error handling
- Deployment configuration

---

## 📺 Personalized Content Feed System

### Overview

Create an intelligent content stream on the home page that curates cycling
content based on the user's chat history, Strava activities, and preferences.
The system pulls from multiple sources and uses AI to rank relevance.

### Data Sources for Personalization

- **Chat History Analysis**: Topics discussed most (power training, recovery,
  nutrition)
- **Strava Activity Patterns**: Ride types, distances, frequency, performance
  trends
- **Session Categories**: Which chat topics user engages with most
- **Explicit Preferences**: Favorite creators, content types, training goals

### Content Sources Integration

**🎥 YouTube API:**

- Cycling channels: GCN, TrainerRoad, Dylan Johnson, Cam Nicholls
- Race highlights: Tour de France, Giro, Vuelta, World Championships
- Training content: Based on current focus areas
- Bike tech reviews: New gear matching riding style

**📱 Instagram Basic Display API (Phase 2):**

- Pro cyclist content: Race updates, training insights
- Cycling photography: Routes similar to Strava activities
- Brand content: From bike manufacturers user rides

**📰 RSS/Web Scraping (Phase 2):**

- Bicycling Magazine: Latest articles, gear reviews
- Outside Magazine: Adventure cycling, endurance content
- Cycling News: Race results, industry updates
- Local cycling blogs: Events in user's area

### AI-Powered Curation

- **Content Scoring**: Based on user profile analysis
- **Duplicate Detection**: Across multiple sources
- **Freshness Weighting**: Newer content prioritized
- **Engagement Prediction**: Using chat interaction patterns

### Technical Architecture

```typescript
// Data Models
interface ContentItem {
  id: string;
  source: "youtube" | "instagram" | "rss" | "magazine";
  type: "video" | "article" | "image" | "race_result";
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

interface UserContentProfile {
  interests: string[]; // extracted from chats
  favoriteCreators: string[];
  activityTypes: string[]; // from Strava
  skillLevel: "beginner" | "intermediate" | "advanced";
  goals: string[];
}
```

### Implementation Phases

**Phase 1: Foundation (COMPLETED)**

- User profile analysis from existing data
- YouTube API integration
- Basic content scoring algorithm
- Simple card-based UI on home page

**Phase 2: Multi-source**

- Instagram API integration
- RSS feed parsing for magazines
- Content deduplication
- Advanced filtering options

**Phase 3: Intelligence**

- Machine learning for better recommendations
- User feedback integration (like/dislike)
- Trending content detection
- Social features (share to chat)

### Privacy & API Considerations

- **Rate Limits**: YouTube 10,000 units/day, respectful RSS scraping
- **Data Storage**: Local caching to minimize API calls
- **User Consent**: For social media integration
- **Opt-out Options**: For each content source

### Personalization Examples

- **Power training focus** → FTP test videos, power meter reviews
- **Recovery questions** → Sleep optimization, nutrition content
- **Century ride prep** → Long-distance training, fueling strategies
- **Morning rides** → Early training tips, sunrise cycling content
- **Hilly routes** → Climbing techniques, hill training videos

## Success Metrics

- **User Engagement**: Daily active usage of chat feature
- **Data Integration**: Successful sync of Strava activities
- **AI Quality**: Relevant, actionable training advice
- **Calendar Usage**: Training sessions actually scheduled and completed

---

## Technical Notes for Implementation

### Error Handling

- API rate limits (Strava: 200/15min, 2000/day)
- Token expiration and refresh
- Network connectivity issues
- Invalid/missing data handling

### Security Considerations

- Never expose API keys in frontend code
- Secure token storage and rotation
- Input validation for AI prompts
- Rate limiting on AI requests

### Performance Optimization

- Cache Strava data to minimize API calls
- Lazy loading for activity history
- Optimistic UI updates
- Background sync for new activities

---

## 🚀 FUTURE FEATURE PLANS

The following features represent the next evolution of TrainingSmart AI.

---

## Feature 1: Advanced Recovery Calibration (Phase 2)

### Overview

Move beyond simple HRV thresholds to a personalized baseline model that adapts
to the user's menstrual cycle (if applicable), seasonal trends, and subjective
"feeling" scores.

### 1. Subjective Metadata

- Add daily "Morning check-in" popup (1-5 mood, soreness location).
- Correlate subjective feel with objective Oura data.

### 2. Trend Analysis

- Detect "Overreaching" before it becomes "Overtraining".
- Alert on 7-day trailing average deviations.

---

## Feature 2: Automated Activity Matching (Heuristic)

### Overview

While Manual Linking is completed, the system should eventually _auto-suggest_
matches with high confidence (95%+) to reduce user friction.

### Algorithm Refinement

- **Time Window**: Match start times within +/- 15 mins of planned time.
- **Distance/Duration**: Fuzzy match within 5% tolerance.
- **Auto-Confirm**: If 1 candidate found with >95% score, link automatically and
  notify user.

---

## Feature 3: Race Day Strategy Generator

### Overview

A specialized chat mode that takes a course profile (GPX) and generates a
segment-by-segment power/pacing plan.

### Inputs

- **GPX File** of the route.
- **Target Time**.
- **User's Power Curve** (from Strava).

### Outputs

- "Cheat Sheet" for top tube taping.
- Nutrition plan (grams of carbs/hr) overlay.

  planId: string, threshold: number = 85 ): Promise<{ matched: number;
  suggested: number; }>

```
**Update Logic:**
- Automatically mark workout as completed when activity is linked (configurable)
- Validate activity date is within reasonable range of workout date
- Check activity type matches workout type
- Store matching reasons in metadata for transparency

### 4. Workout Card Enhancements

**Visual Indicators:**
- Display Strava logo badge when activity is linked
- Show checkmark with "Completed on Strava" label
- Color-code card based on adherence (green=met, yellow=close, red=significant variance)

**Metrics Comparison:**
Display side-by-side planned vs actual with visual diff:
```

Distance: Planned 25.0 mi → Actual 26.3 mi (+5%) ✓ Duration: Planned 90 min →
Actual 95 min (+6%) ✓ Intensity: Moderate → HR Zone 3 ✓ Pace: 16.7 mph → 16.6
mph (-1%) ✓

```
**Interactive Elements:**
- "Link Activity" button opening selection modal
- "View on Strava" external link button
- "Unlink Activity" option to remove association
- Display match confidence score as percentage badge
- Show auto-match vs manual-match indicator

### 5. Activity Selection Modal

**Modal Components:**

1. **Date Range Selector**
   - Default: 7 days before to 7 days after scheduled date
   - Calendar picker for custom range
   - Quick filters: Same Day, Same Week, Last 30 Days

2. **Activity List**
   - Card-based layout with key metrics visible
   - Match score badge prominently displayed
   - Sort options: Best Match (default), Date, Distance
   - Filter by activity type
   - Show already-linked activities with grayed-out styling

3. **Comparison Panel**
   - Expand activity card to see detailed comparison
   - Planned vs Actual metrics table
   - Route map thumbnail for outdoor activities
   - Activity details: weather, gear, elevation

4. **Selection Actions**
   - "Link This Activity" primary button
   - "View on Strava" secondary button
   - "Cancel" to close without linking

**Smart Features:**
- Highlight highest-scoring match
- Show reasons for match score in tooltip
- Disable already-linked activities
- Allow searching by activity name
- Remember last used date range preference

### 6. Plans Page Updates

**Progress Indicators:**
- Add progress bar showing linked vs total workouts
- Display percentage: "15/20 workouts completed (75%)"
- Show breakdown: X auto-matched, Y manually linked, Z unlinked
- Color-code based on adherence level

**Bulk Actions:**
- "Auto-Match All" button to run matching on all unlinked workouts
- "Review Suggestions" to see all medium-confidence matches
- Filter view: All / Linked / Unlinked / Needs Review
- Export training log with actual activity data

**Statistics Card:**
```

Plan Adherence ━━━━━━━━━━━━━━━ Completed: 15/20 (75%) Auto-matched: 12 workouts
Manual: 3 workouts Needs Review: 5 workouts

```
### 7. Automatic Matching System

**Trigger Points:**
- When plan page loads
- When user uploads new activity to Strava
- On manual refresh button click
- Scheduled background sync (if enabled)

**Matching Process:**
1. Fetch recent Strava activities (last 30 days)
2. Find all unlinked workouts in active plans
3. Calculate match scores for each workout-activity pair
4. Auto-link high-confidence matches (85+)
5. Queue medium-confidence matches for review (70-84)
6. Notify user of new matches found

**User Notifications:**
- Show badge count on Plans page for pending matches
- Display toast notification: "3 new activities matched!"
- List matches in review queue with scores
- Allow batch approval/rejection of suggestions

### 8. Background Sync Service

**Sync Strategy:**
- Poll Strava API for new activities every hour (configurable)
- Store last sync timestamp in user preferences
- Fetch only activities since last sync
- Rate limit: respect Strava's 200 requests per 15 min limit

**Activity Monitoring:**
- Detect new activity uploads
- Check for activity updates (user edited on Strava)
- Handle activity deletions (unlink from workout)
- Update workout completion status automatically

**Sync Status Display:**
```

Last synced: 5 minutes ago Next sync: in 55 minutes Status: ✓ Up to date

```
### 9. Settings and Preferences

**Activity Matching Section:**
```

Automatic Activity Matching ━━━━━━━━━━━━━━━━━━━━━━━━━━ ☑ Enable automatic
matching Match sensitivity: ○ Strict ⦿ Moderate ○ Lenient

Auto-match threshold: [85] (70-100) Only auto-match scores above this value

Date matching window: [7] days Search activities within ± this many days

☑ Automatically mark workouts complete when activity is linked ☑ Show
notifications for new matches ☑ Enable background sync (check hourly)

Matching Priority (drag to reorder):

1. Date proximity
2. Activity type
3. Distance similarity
4. Duration similarity

```
**Notification Preferences:**
- Toggle for match notifications
- Choose notification timing (immediate, daily summary)
- Email digest for weekly matching summary
- In-app notification badges

### 10. Analytics Dashboard

**Create:** New "Analytics" tab on Plans page

**Adherence Metrics:**
```

Plan Adherence Overview ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Overall: 78% (15/19
workouts) This Week: 4/4 completed Last Week: 3/4 completed This Month: 15/19
completed

Adherence Trend: 📈 +5% vs last month Consistency: 85% (completed on scheduled
day)

```
**Performance Analysis:**
- Planned vs Actual training load chart (weekly)
- Distance variance: average difference between planned and actual
- Duration variance: how often workouts run over/under time
- Intensity adherence: heart rate zone compliance

**Workout Type Breakdown:**
```

Completion by Type: Bike workouts: 12/14 (86%) ✓ Rest days: 3/3 (100%) ✓
Strength: 0/2 (0%) ⚠️

```
**Insights:**
- AI-generated observations about training patterns
- Highlight consistently missed workout types
- Identify best days for training adherence
- Suggest schedule adjustments based on completion patterns

**Export Options:**
- Download CSV of all workouts with linked activities
- Export training log with metrics comparison
- Generate PDF report of plan performance
- Share adherence stats (social media formatted)

---

## Integration Points Between Both Features

### Unified User Experience

**Seamless Workflow:**
1. User discusses goals and constraints in chat
2. System extracts context and suggests creating plan
3. Plan is generated with reference to chat discussion
4. User completes workouts based on plan
5. Strava activities automatically link to completed workouts
6. User reviews performance in plans page
7. Insights feed back into chat for discussion
8. Plan adjustments made through chat conversation

**Cross-Feature Navigation:**
- Plans show "Source Chat" link for context
- Chat shows "Generated Plans" list
- Activity cards link to both workout and chat
- Analytics reference chat goals and plan adherence

### Data Flow Architecture

**Complete Training Loop:**
```

Chat Session ↓ (extract context) Training Plan ↓ (create workouts) Scheduled
Workouts ↓ (athlete completes) Strava Activities ↓ (auto-match) Completed
Workouts ↓ (analyze performance) Insights & Analytics ↓ (discuss results) Chat
Session (new)

```
**Database Relationships:**
```

chat_sessions ←→ training_plans training_plans ←→ workouts workouts ←→
strava_activities (via activity_id)

```
### Notification Strategy

**Smart Notification Timing:**
- Chat contains sufficient context for plan → Suggest creating plan
- New Strava activity uploaded → Check for workout matches
- Workout due today → Remind user to complete
- Activity completed but not linked → Suggest matching
- Plan adherence dropping → Suggest chat discussion
- Weekly summary → Combine plan progress + activity matches

**Notification Consolidation:**
- Group related notifications together
- Provide contextual quick actions
- Link to relevant chat sessions or plans
- Show progress toward goals mentioned in chat

### AI Context Sharing

**Enhanced AI Understanding:**
- Chat AI has access to plan adherence data
- References specific activities when discussing performance
- Knows which workouts were completed vs skipped
- Understands variance between planned and actual training
- Can suggest plan modifications based on activity data

**Example AI Response:**
```

"I see you completed your Tuesday ride, but it was 30 minutes shorter than
planned. Based on our earlier discussion about time constraints, should we
adjust your Thursday workout to compensate, or keep the plan as-is?"

````
---

## Technical Implementation Notes

### Database Migrations Required

**Migration 1: Chat-to-Plan Linking**
```sql
-- Add chat session relationship to training plans
ALTER TABLE training_plans
  ADD COLUMN source_chat_session_id UUID
    REFERENCES chat_sessions(id) ON DELETE SET NULL,
  ADD COLUMN chat_context_snapshot JSONB;

CREATE INDEX idx_training_plans_chat_session
  ON training_plans(source_chat_session_id);
````

**Migration 2: Activity Linking**

```sql
-- Add Strava activity linking to workouts
ALTER TABLE workouts
  ADD COLUMN strava_activity_id BIGINT UNIQUE,
  ADD COLUMN activity_match_score NUMERIC(5,2)
    CHECK (activity_match_score >= 0 AND activity_match_score <= 100),
  ADD COLUMN auto_matched BOOLEAN DEFAULT false,
  ADD COLUMN match_metadata JSONB,
  ADD COLUMN linked_at TIMESTAMPTZ;

CREATE INDEX idx_workouts_strava_activity
  ON workouts(strava_activity_id);
CREATE INDEX idx_workouts_auto_matched
  ON workouts(auto_matched)
  WHERE strava_activity_id IS NOT NULL;
```

**RLS Policies:**

- Ensure users can only link activities to their own workouts
- Validate user owns both the workout and the Strava activity
- Prevent linking same activity to multiple workouts

### API Considerations

**Strava API Usage:**

- Rate limits: 200 requests per 15 minutes, 2000 per day
- Batch activity fetches when possible (up to 200 activities)
- Cache activity data locally to minimize repeated fetches
- Use webhooks for real-time activity updates (future enhancement)

**OpenAI API Usage:**

- Context extraction requires one API call per chat session
- Plan generation already implemented
- Modification requests use existing infrastructure
- Cache extracted context to avoid repeated processing

### Performance Optimization

**Query Optimization:**

- Index on strava_activity_id for fast lookup
- Index on source_chat_session_id for chat-plan queries
- Use JSONB indexes for match_metadata queries
- Preload activities when viewing plans page

**Caching Strategy:**

- Cache Strava activities for 5 minutes
- Cache match scores for viewed workouts
- Invalidate cache when activities are linked/unlinked
- Background prefetch likely-needed activities

**Lazy Loading:**

- Load activity details only when workout card is expanded
- Defer match calculation until user views workout
- Paginate activity selection modal results
- Stream large plan analytics calculations

### Security and Privacy

**Data Access Control:**

- Verify user owns workout before allowing activity link
- Validate Strava activity belongs to authenticated user
- RLS policies enforce user isolation on all tables
- Audit log for activity linking actions

**Data Privacy:**

- Store only necessary chat excerpts, not full transcripts
- Allow users to delete chat-context snapshots
- Anonymize data for analytics aggregations
- Provide data export for user's own records

**API Security:**

- Validate Strava activity IDs exist before linking
- Rate limit matching requests to prevent abuse
- Sanitize chat context before storing in database
- Validate match scores are within valid range (0-100)

---

## Future Enhancements

### Strava Webhooks Integration

- Subscribe to activity.create events
- Real-time matching when activities are uploaded
- Instant notifications without polling
- Lower API usage and better user experience

### Machine Learning Matching

- Train model on user's manual linking decisions
- Learn user-specific matching preferences
- Improve match scores over time
- Personalized matching algorithms

### Social Features

- Share training plans with friends
- Compare adherence with training partners
- Group chat sessions for team training
- Leaderboards and challenges

### Advanced Analytics

- Predict future performance based on plan adherence
- Identify optimal training patterns from activity data
- Recommend plan adjustments using ML
- Forecast fitness improvements

---

## Summary

These two features work together to create a complete, intelligent training
workflow:

1. **Chat-to-Plan** eliminates manual data entry by extracting goals and
   constraints from natural conversations, making plan creation effortless and
   contextual.

2. **Activity Linking** closes the loop by connecting planned workouts to actual
   Strava activities, providing visibility into training adherence and
   performance variance.

Together, they transform TrainingSmart AI from a planning tool into a
comprehensive training management system that understands user goals (from
chat), generates personalized plans (AI-powered), tracks actual performance
(Strava integration), and provides insights into training effectiveness
(analytics).

The seamless integration creates a continuous feedback loop where conversations
inform plans, plans guide training, activities track execution, and analytics
fuel new conversations about progress and adjustments.
