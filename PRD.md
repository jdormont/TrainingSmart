# TrainingSmart AI - Product Requirements Document

## Project Overview
Build a personal training assistant web app that integrates Strava activity data with AI-powered training advice and Google Calendar scheduling. The app will analyze real workout data to provide personalized training recommendations through a conversational AI interface.

## Target User
Solo athlete/fitness enthusiast who uses Strava to track workouts and wants AI-powered training guidance based on their actual performance data.

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
**User Story**: As a user, I want to securely connect my Strava and Google Calendar accounts.

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
**User Story**: As a user, I want to see my recent training data and key metrics.

**Implementation**:
```javascript
// Key data to fetch from Strava API
const dataPoints = {
  recentActivities: "/athlete/activities?per_page=10",
  athleteStats: "/athletes/{id}/stats",
  weeklyStats: "calculated from recent activities"
}
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
- ✅ **COMPLETED** - Activity filtering by type (All, Runs, Outdoor Rides, Virtual Rides)
- ✅ **COMPLETED** - Multiple metrics (Distance, Training Load, Speed, Heart Rate)
- ✅ **COMPLETED** - Handles loading states gracefully
- ✅ **COMPLETED** - Beautiful activity cards with hover effects

### 3. AI Training Chat Interface
**User Story**: As a user, I want to chat with an AI about my training using my real data.

**Implementation**:
```javascript
// Chat system integration
const aiPromptStructure = {
  systemPrompt: "You are a personal training coach with access to the user's Strava data...",
  userContext: "Recent activities, current fitness level, training history",
  responseFormat: "Conversational but structured training advice"
}
```

**Features**:
- Chat interface with message history
- AI has context of user's recent activities and stats
- Can ask questions like: "Should I run tomorrow?" "Am I overtraining?" "Plan my next week"
- Responses include specific recommendations with reasoning

**Acceptance Criteria**:
- ✅ **COMPLETED** - Chat interface sends messages to AI with user's Strava context
- ✅ **COMPLETED** - AI responses are informed by actual training data (30 recent activities)
- ✅ **COMPLETED** - Conversation history is maintained during session
- ✅ **COMPLETED** - Messages display with proper loading states
- ✅ **COMPLETED** - Suggested questions for easy interaction
- ✅ **COMPLETED** - Custom system prompt editor in Settings
- ✅ **COMPLETED** - Pre-built coaching personality templates
- ✅ **COMPLETED** - Error handling for API issues and rate limits

### 4. Training Plan Generator
**User Story**: As a user, I want AI to create specific training plans based on my data and goals.

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
- 🔄 **IN PROGRESS** - Basic AI plan generation function exists in openaiService
- ❌ **TODO** - Goal-setting form UI
- ❌ **TODO** - Generated plan display interface
- ❌ **TODO** - Plan persistence and management
- ❌ **TODO** - Individual workout detail cards

### 5. Calendar Integration
**User Story**: As a user, I want to export training sessions to my Google Calendar to schedule my workouts.

**Implementation**:
```javascript
// Google Calendar API integration
const calendarScopes = ['https://www.googleapis.com/auth/calendar.events'];
const eventCreation = {
  summary: "🚴 Endurance Ride",
  description: "Type: Bike\nIntensity: Moderate\nDuration: 90min\nDistance: 25 miles\n\nDetails:\n...\n\nView in app: https://app.url/plans",
  start: { dateTime: "2024-03-15T06:00:00-07:00" },
  end: { dateTime: "2024-03-15T07:30:00-07:00" }
}
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
  stats: "/athletes/{id}/stats"
}
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
    trainingConsistency: calculateConsistency(userData.activities)
  }
}
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
- [ ] **IN PROGRESS** - Training plan generation UI

### Phase 2: Enhanced Features
- [x] **COMPLETED** - Google Calendar integration (one-way export)
- [ ] Advanced data visualization
- [ ] Training plan persistence
- [ ] Goal setting and tracking

### Phase 3: Polish & Deploy
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Mobile responsiveness testing
- [ ] Deployment setup

---

## ✅ COMPLETED FEATURES (Current Status)

### 🔐 **Authentication System**
- Full Strava OAuth 2.0 implementation
- Multiple auth flows (direct, callback, manual)
- Token management with automatic refresh
- Secure token storage

### 📊 **Dashboard & Data Visualization**
- Beautiful activity cards with detailed metrics
- Weekly stats summary with visual indicators
- Advanced 8-week training trends chart
- Activity filtering (All, Runs, Outdoor Rides, Virtual Rides)
- Multiple metrics (Distance, Training Load, Speed, Heart Rate)
- Responsive design with hover effects

### 🤖 **AI Chat System**
- Full conversational interface with message history
- AI coach with access to 30 recent activities
- Custom system prompt editor in Settings
- Pre-built coaching personality templates
- Suggested questions for easy interaction
- Comprehensive error handling

### ⚙️ **Settings & Customization**
- System prompt editor with live preview
- Account information display
- Coaching style templates
- Secure account disconnection
- Google Calendar connection management
- Oura Ring integration controls

---

## 🚧 REMAINING WORK

### 📋 **Training Plan Generator (High Priority)**
- Goal-setting form (race type, distance, timeline)
- AI-generated plan display interface
- Plan persistence and management
- Individual workout detail cards
- Plan modification capabilities

### 📺 **Personalized Content Feed (Phase 1 - IN PROGRESS)**
- ✅ **COMPLETED** - Content feed architecture and data models
- ✅ **COMPLETED** - YouTube API integration with cycling channels
- ✅ **COMPLETED** - AI-powered content scoring based on user profile
- ✅ **COMPLETED** - Home page content stream with rich cards
- ✅ **COMPLETED** - User profile analysis from chat/Strava data

### 📺 **Content Feed - Future Phases**
- **Phase 2**: Instagram API, RSS feeds (Bicycling, Outside Magazine)
- **Phase 3**: Machine learning recommendations, user feedback

### 👤 **User Profile Setup Chat (TODO)**
- New chat session type for gathering user preferences
- Structured questions about cycling interests, gear, goals
- Profile data integration with content feed recommendations
- Onboarding flow for new users

### 📅 **Google Calendar Integration (COMPLETED)**
- ✅ Google OAuth 2.0 authentication with token storage
- ✅ One-way export of workouts to calendar
- ✅ Weekly batch export functionality
- ✅ Individual workout export
- ✅ Visual indicators for exported workouts
- ✅ Automatic token refresh
- ✅ Detailed calendar event descriptions

**Future Enhancements (Not Yet Implemented)**:
- Two-way sync (update app when calendar changes)
- Conflict detection with existing events
- Custom default workout times per user
- Export to specific calendars (not just primary)

### 🎨 **Polish & Enhancement**
- Mobile responsiveness improvements
- Performance optimization
- Advanced error handling
- Deployment configuration
---

## 📺 Personalized Content Feed System

### Overview
Create an intelligent content stream on the home page that curates cycling content based on the user's chat history, Strava activities, and preferences. The system pulls from multiple sources and uses AI to rank relevance.

### Data Sources for Personalization
- **Chat History Analysis**: Topics discussed most (power training, recovery, nutrition)
- **Strava Activity Patterns**: Ride types, distances, frequency, performance trends  
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

interface UserContentProfile {
  interests: string[]; // extracted from chats
  favoriteCreators: string[];
  activityTypes: string[]; // from Strava
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
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

The following features represent the next evolution of TrainingSmart AI, creating a complete training workflow from planning conversations to performance tracking.

---

## Feature 1: Chat-to-Plan Integration

### Overview
Allow users to generate training plans directly from chat conversations where they've discussed their goals, constraints, and preferences. This creates a seamless flow from planning discussions to actionable training schedules.

### 1. Database Schema Updates

**Tables to Modify:**
- Add `source_chat_session_id` column to `training_plans` table (UUID, nullable, foreign key to chat_sessions)
- Add `chat_context_snapshot` JSONB column to store relevant chat excerpts used in plan generation
- Create index on `source_chat_session_id` for efficient lookups
- Store bidirectional relationship between plans and the chat messages that informed them

**Migration Requirements:**
```sql
ALTER TABLE training_plans
  ADD COLUMN source_chat_session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  ADD COLUMN chat_context_snapshot JSONB;

CREATE INDEX idx_training_plans_chat_session ON training_plans(source_chat_session_id);
```

### 2. Chat Message Analysis Service

**Create:** `chatContextExtractor.ts`

**Core Functionality:**
- Extract key information from chat conversations including:
  - Stated goals and target events (e.g., "I want to complete a century ride")
  - Time availability and scheduling constraints (e.g., "I can only ride weekends")
  - Equipment available (indoor trainer, outdoor only, bike type)
  - Injury history or current limitations mentioned
  - Preferred workout types and intensities
  - Specific requirements (e.g., "avoid back-to-back hard days")
- Use AI to summarize multi-message conversations into structured data
- Calculate confidence scores for each extracted piece of information (0-100)
- Handle ambiguous or conflicting information gracefully with user review
- Identify most relevant messages that contributed to each extraction

**Technical Approach:**
- Send entire chat history to AI with extraction prompt
- Request structured JSON response with extracted fields and confidence scores
- Link extracted data back to specific message IDs for traceability
- Allow manual correction of extracted information

### 3. Enhanced Plan Generation UI

**Chat Interface Updates:**
- Add "Create Plan from This Chat" button in chat header
- Show button only when chat contains goal-related discussions
- Use AI to detect planning-related conversations automatically
- Display extracted context in pre-generation review modal
- Allow users to edit or confirm all extracted information
- Show which specific chat messages contributed to each data point

**Plan Generation Modal:**
- Pre-fill form fields with extracted chat context
- Display confidence scores next to auto-filled fields
- Highlight low-confidence extractions for user review
- Show relevant chat excerpts inline for context
- Allow toggling between chat-extracted and manual entry
- Link back to source chat session for reference

### 4. Plan Generation Flow

**Detection Phase:**
- Monitor chats for goal-oriented keywords and phrases
- Categorize chat sessions based on content (goals, training, recovery, etc.)
- Trigger suggestion to create plan when sufficient context exists
- Use chat category to influence detection sensitivity

**Context Building:**
- Analyze entire chat history to build comprehensive context
- Extract goals, constraints, preferences, and training history discussion
- Include previous messages about injuries, time availability, equipment
- Identify contradictions and flag for user resolution
- Build structured context object for AI plan generation

**Generation Phase:**
- Pass full chat transcript along with structured context to AI
- Include chat context in plan generation prompt
- Generate plan that specifically references things discussed in chat
- Create database link between chat session and generated plan
- Add assistant message in chat confirming plan creation with link

### 5. Plans Page Integration

**Visual Indicators:**
- Display chat bubble icon badge on chat-generated plans
- Show chat category tag (training, goals, recovery, etc.)
- Add "View Source Chat" button to navigate to original conversation
- Display creation timestamp with "Generated from chat" label

**Context Display:**
- Show excerpts of key chat messages that informed the plan
- Display extracted goals and constraints in plan header
- Link specific workouts to chat discussions that inspired them
- Show confidence scores for AI-extracted information

**Plan Management:**
- Allow regenerating plan with updated chat context
- Filter plans by source: "From Chat" vs "Manual Creation"
- Search plans by chat content and discussion topics
- Track plan versions with links to triggering chat messages

### 6. Context Refinement Interface

**Pre-Generation Review Modal:**
- Display all extracted information in editable form
- Show confidence score badges (High/Medium/Low) for each field
- Present relevant chat message excerpts for each extraction
- Provide checkboxes to include or exclude specific constraints
- Add free-form notes field for additional context
- Show preview of how context will inform plan generation

**Validation Logic:**
- Require user confirmation for low-confidence extractions (<70%)
- Highlight conflicting information for resolution
- Suggest missing information based on plan type
- Allow saving refined context for future plan updates

### 7. Real-time Plan Updates

**Change Detection:**
- Monitor continued discussion in source chat after plan creation
- Detect when users mention plan modifications or new constraints
- Use AI to identify plan-relevant updates in ongoing conversations
- Show notification badge on plan when source chat has updates

**Update Workflow:**
- Display "Updates Available from Chat" notification on plan card
- Show diff preview of suggested changes based on new chat context
- Allow accepting or rejecting suggested modifications
- Track plan version history with links to triggering chat messages
- Maintain change log showing what was modified and why

### 8. Smart Suggestions in Chat

**Contextual Detection:**
- Identify natural transition points to suggest plan creation
- Detect when user has discussed sufficient planning information
- Avoid suggesting too early (not enough context) or too late
- Remember if user dismissed suggestion to avoid repetition

**Suggestion UI:**
- Show inline suggestion card at appropriate moments
- Display preview of extracted context (goals, timeline, etc.)
- Provide "Create Plan" quick action button
- Include "Not Now" option with don't-ask-again checkbox
- Show confidence indicator for extraction quality

### 9. Plan Discussion Mode

**Special Chat Context:**
- Create dedicated chat mode for discussing existing plans
- Automatically load plan details into AI context
- Reference specific workouts by name or date in conversation
- Allow natural language queries about plan structure and rationale

**Modification Flow:**
- Enable requesting plan changes through chat
- Parse modification requests (e.g., "move Tuesday's workout to Wednesday")
- Show preview of planned changes before applying
- Apply approved changes directly to plan workouts
- Add modification notes to workout descriptions

### 10. Supabase Integration

**Data Persistence:**
- Store chat-to-plan relationships in database
- Save chat context snapshots with plans
- Track which specific messages influenced each plan element
- Maintain audit trail of plan modifications from chat

**Query Capabilities:**
- Search plans by chat content and topics discussed
- Filter plans by chat session category
- Find all plans created with a specific chat session
- Retrieve chat excerpts that informed specific workouts

**Sync Logic:**
- Update plan metadata when source chat is modified
- Handle chat deletion (keep plan but remove chat reference)
- Maintain consistency between chat sessions and plans tables
- Enable real-time updates when plans are modified via chat

---

## Feature 2: Link Strava Activities to Training Plan Workouts

### Overview
Connect completed Strava activities to planned workouts, enabling users to track adherence, compare planned vs actual performance, and gain insights into training consistency. Transform static plans into dynamic training logs with real performance data.

### 1. Database Schema Extension

**Tables to Modify:**
- Add `strava_activity_id` column to `workouts` table (BIGINT, nullable, unique)
- Add `activity_match_score` column (NUMERIC, 0-100) to track matching confidence
- Add `auto_matched` BOOLEAN to distinguish automatic vs manual linking
- Add `match_metadata` JSONB to store algorithm details and matching reasons
- Add `linked_at` TIMESTAMPTZ to track when activity was linked

**Migration Requirements:**
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

**Constraints:**
- Prevent same activity from linking to multiple workouts
- Allow workout to have no linked activity (null permitted)
- Cascade delete behavior when activities are unlinked

### 2. Activity Matching Algorithm

**Create:** `activityMatchingService.ts`

**Core Matching Logic:**
Calculate match scores (0-100) based on weighted factors:

1. **Date Proximity (50% weight)**
   - Same day: 50 points
   - 1 day off: 40 points
   - 2 days off: 25 points
   - 3+ days off: 10 points
   - Activities within planned workout window get bonus points

2. **Activity Type Match (20% weight)**
   - Exact match (Ride to bike): 20 points
   - Related match (VirtualRide to bike): 15 points
   - Wrong type: 0 points

3. **Distance Similarity (15% weight)**
   - Within 10% of planned: 15 points
   - Within 20% of planned: 12 points
   - Within 30% of planned: 8 points
   - Greater than 30% off: scaled 0-7 points

4. **Duration Similarity (15% weight)**
   - Within 15% of planned: 15 points
   - Within 30% of planned: 12 points
   - Within 45% of planned: 8 points
   - Greater than 45% off: scaled 0-7 points

**Additional Considerations:**
- Intensity alignment using heart rate zones
- Check average pace vs planned intensity
- Prefer activities not already linked to other workouts
- Handle edge cases (rest days, multiple activities same day)

**Match Confidence Levels:**
- 85-100: High confidence (auto-match eligible)
- 70-84: Medium confidence (suggest to user)
- 50-69: Low confidence (show in manual selection)
- <50: Not displayed as match

### 3. Training Plans Service Updates

**New Methods:**

```typescript
// Link workout to Strava activity
async linkWorkoutToActivity(
  workoutId: string,
  stravaActivityId: number,
  matchScore: number,
  autoMatched: boolean,
  metadata: object
): Promise<void>

// Unlink activity from workout
async unlinkWorkoutActivity(workoutId: string): Promise<void>

// Get workout with full activity data
async getWorkoutWithActivity(workoutId: string): Promise<{
  workout: Workout;
  activity: StravaActivity | null;
}>

// Get suggested matches for workout
async suggestActivityMatches(
  workoutId: string,
  activities: StravaActivity[]
): Promise<Array<{
  activity: StravaActivity;
  matchScore: number;
  reasons: string[];
}>>

// Auto-match all unlinked workouts in plan
async autoMatchActivities(
  planId: string,
  threshold: number = 85
): Promise<{
  matched: number;
  suggested: number;
}>
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
Distance:  Planned 25.0 mi  →  Actual 26.3 mi  (+5%)  ✓
Duration:  Planned 90 min   →  Actual 95 min   (+6%)  ✓
Intensity: Moderate         →  HR Zone 3       ✓
Pace:      16.7 mph        →  16.6 mph       (-1%)  ✓
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
Plan Adherence
━━━━━━━━━━━━━━━
Completed:     15/20 (75%)
Auto-matched:  12 workouts
Manual:        3 workouts
Needs Review:  5 workouts
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
Last synced: 5 minutes ago
Next sync: in 55 minutes
Status: ✓ Up to date
```

### 9. Settings and Preferences

**Activity Matching Section:**

```
Automatic Activity Matching
━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ Enable automatic matching
Match sensitivity: ○ Strict  ⦿ Moderate  ○ Lenient

Auto-match threshold: [85] (70-100)
Only auto-match scores above this value

Date matching window: [7] days
Search activities within ± this many days

☑ Automatically mark workouts complete when activity is linked
☑ Show notifications for new matches
☑ Enable background sync (check hourly)

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
Plan Adherence Overview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall:        78% (15/19 workouts)
This Week:      4/4 completed
Last Week:      3/4 completed
This Month:     15/19 completed

Adherence Trend: 📈 +5% vs last month
Consistency:    85% (completed on scheduled day)
```

**Performance Analysis:**
- Planned vs Actual training load chart (weekly)
- Distance variance: average difference between planned and actual
- Duration variance: how often workouts run over/under time
- Intensity adherence: heart rate zone compliance

**Workout Type Breakdown:**
```
Completion by Type:
Bike workouts:     12/14 (86%) ✓
Rest days:         3/3 (100%)  ✓
Strength:          0/2 (0%)    ⚠️
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
Chat Session
    ↓ (extract context)
Training Plan
    ↓ (create workouts)
Scheduled Workouts
    ↓ (athlete completes)
Strava Activities
    ↓ (auto-match)
Completed Workouts
    ↓ (analyze performance)
Insights & Analytics
    ↓ (discuss results)
Chat Session (new)
```

**Database Relationships:**
```
chat_sessions ←→ training_plans
training_plans ←→ workouts
workouts ←→ strava_activities (via activity_id)
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
"I see you completed your Tuesday ride, but it was 30 minutes
shorter than planned. Based on our earlier discussion about
time constraints, should we adjust your Thursday workout to
compensate, or keep the plan as-is?"
```

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
```

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

These two features work together to create a complete, intelligent training workflow:

1. **Chat-to-Plan** eliminates manual data entry by extracting goals and constraints from natural conversations, making plan creation effortless and contextual.

2. **Activity Linking** closes the loop by connecting planned workouts to actual Strava activities, providing visibility into training adherence and performance variance.

Together, they transform TrainingSmart AI from a planning tool into a comprehensive training management system that understands user goals (from chat), generates personalized plans (AI-powered), tracks actual performance (Strava integration), and provides insights into training effectiveness (analytics).

The seamless integration creates a continuous feedback loop where conversations inform plans, plans guide training, activities track execution, and analytics fuel new conversations about progress and adjustments.

---

This PRD provides bolt.new with specific, actionable requirements that can be implemented step-by-step, starting with the core MVP functionality and building up to advanced features.