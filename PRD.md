# TrainingSmart AI — Product Requirements Document (PRD)

_Last updated: 2026-11-19 (previous revision: 2026-06-12)._

## 1. Project Overview

TrainingSmart is an AI-powered fitness coaching platform that curates personalized multi-modal training plans. By integrating Strava activity records, Oura health parameters, and Apple Watch metrics, TrainingSmart translates physical data into contextual, adaptive workout recommendations. The app caters to both performance-focused athletes and fitness "re-engagers" who prioritize consistency over optimized load metrics.

### Core Value Proposition
- **Data-Driven Context:** Direct API integrations capture true training load, sleep metrics, and recovery states.
- **Adaptive LLM Coaching:** Interactive chat interface provides real-time adjustments, planning, and workout analysis.
- **Whole-Athlete Design:** Multi-modal support (cycling, running, strength, yoga, hiking, swimming) manages cross-training recovery schedules.
- **Accessibility & Privacy:** High-contrast modern "Midnight Pro" styling, localized device sync, and strict database user isolation.

---

## 2. Core Experience & Workflows

### 2.1. Conversational Onboarding & Coach Specialization
- **Intake Flow:** A natural language wizard (`ConversationalOnboarding`) gathers goals, activity preferences, self-reported fitness levels, and weekly time limits. On completion it also seeds the AI coach's persistent memory (a lifecycle-tracked goal plus constraints/preferences) so new users get a personalized coach from the first chat. The legacy `IntakeWizard` modal has been removed.
- **Coach Specialization:** Assigns the athlete one of four coaching personas:
  - *Endurance Coach* (Endurance cycling/running focus)
  - *Strength & Mobility Coach* (Strength training & yoga)
  - *General Fitness Coach* (Broad multi-modal cross-training)
  - *Comeback Coach* (Re-engagers focused on consistency)
- **Fitness Mode:** Directs users into either *Performance Mode* (uses metrics like FTP, TSS, acute-to-chronic training load) or *Re-Engager Mode* (limits schedule frequency, lowers intensity, hides complex zone charts, and targets habit building).

### 2.2. Training Plan Planner & Rescheduling
- **Plan Generation:** Generates periodized multi-week schedules tailored to availability, goals, and coach specializations.
- **Plan Reasoning ("Brain" icon):** Renders the underlying AI periodization strategy, target weekly TSS, and phase focus.
- **Drag-and-Drop Rescheduling:** Interactive `@dnd-kit` column layout allows rescheduling and shifting workouts, with conflict resolving alerts. Multiple workouts per day are supported; conflicts offer a "keep both" option.
- **Milestones & Leveling Up:** Tracks consistency (e.g. 21-day streaks). When targets are met, re-engagers are invited to transition to *Performance Mode* via a celebratory Level-Up modal.

### 2.3. Dashboard, Activity Trends & Reconciliation
- **Midnight Pro UI:** Responsive two-column dark Slate layout with quick metrics visibility.
- **Today Card & Readiness:** A single `TodayCard` presents today's workout and readiness. All readiness/recovery messaging derives from one canonical verdict (`readinessService`), so dashboard surfaces never contradict each other.
- **Power Analysis:** Displays 7-zone Coggan power distribution chart and FTP configurations for cycling. A Power Curve tab compares best power per duration over the last 30 days vs. the prior 60; activity detail shows segment efforts (power/HR/grade/climb category) and a power-vs-grade correlation chart.
- **Rider Profile:** Skill metrics include *Form* (TSB = CTL − ATL, computed from TSS) and *Economy*, which uses real cardiac decoupling from enriched rides once ≥3 are available (else a labeled EF-trend estimate).
- **Estimated Power:** For outdoor rides without a power meter, a personal HR-to-power curve built from indoor power-meter rides (min. 4 qualifying rides) yields clearly labeled estimated power, used as a TSS/CTL/ATL fallback below real power and above HR-ratio TSS.
- **Training Trends:** Displays interactive toggles for 4-week and 8-week views of load, distance, time, and pace.
- **Strava Reconciliation:** Links logged Strava activities to planned workouts in the calendar.
- **Plan-Wide Cumulative Stats:** Collapsible "Plan Info" drawer displays total completed miles, hours, feet climbed, and calories burned vs. planned plan-wide targets with progress bars.

### 2.4. Conversational AI Coach
- **Context Sharing:** AI receives 30 recent Strava activities (including segment grade/elevation, extended power curve, and terrain power profile), Oura sleep trends, Apple Watch metrics, and the full user profile.
- **Persistent Coach Memory:** The coach retains context across sessions via structured memory: a durable athlete profile (constraints, preferences, notable patterns, narrative), lifecycle-tracked goals (one active goal enforced in the DB; closed goals are presented as background only), FTP history, and a rolling 30-day activity-notes window. Memory is merged by the `openai-update-memory` Edge Function when a chat goes idle; goal creation/closure requires explicit user confirmation. The rollup also includes observed behavior (plan adherence, activity counts and weekly volume trend, declining health dimensions), not just chat text. A durable per-session sync watermark (`chat_sessions.memory_synced_message_count`) ensures failed or interrupted merges are retried. Users can review, edit, clear, and generate a review-before-save backfill draft from chat history in Settings.
- **Data Formatting:** Automatically renders Markdown comparison tables to show pacing, load, and variance.
- **Coaching Settings:** Includes a custom system prompt override and pre-built coaching styles (supportive, analytical, direct).

---

## 3. Scope & Feature Status

Consistent notation is used to represent current development status.

### 3.1. Authentication, Profile & Integrations
- `[x] COMPLETE` - Strava OAuth 2.0 connection and automatic token refresh logic.
- `[x] COMPLETE` - Google Calendar OAuth 2.0 flow for workout schedule exports.
- `[x] COMPLETE` - Oura Ring OAuth 2.0 and Supabase database caching (`daily_metrics`).
- `[x] COMPLETE` - Apple Watch Health Sync (iOS Shortcut with Ingest Key for sleep, HRV, and RHR).
- `[x] COMPLETE` - Settings Page Tabbed Restructuring (My Coach, My Profile, Integrations, Advanced), plus a coach Memory management tab.

### 3.2. Intake & Onboarding Wizard
- `[x] COMPLETE` - Conversational 5-screen intake flow (Goals, Activities, Availability, Fitness self-assessment, Event details).
- `[x] COMPLETE` - Onboarding seeds coach memory (goal + athlete profile); redundant legacy IntakeWizard removed.
- `[x] COMPLETE` - Automated assignment of Coach Specialization and Fitness Mode (Performance vs. Re-Engager).
- `[x] COMPLETE` - Automatic routing gates for un-onboarded user profiles.

### 3.3. Training Plan Planner & Generator
- `[x] COMPLETE` - Plan generation using user profile (goal, activity mix, availability).
- `[x] COMPLETE` - Workout rescheduling via drag-and-drop (`@dnd-kit`).
- `[x] COMPLETE` - Plan logic and AI reasoning transparency popup ("Brain" icon).
- `[x] COMPLETE` - Level-Up Consistency Milestones & celebratory modal for Re-Engager consistency.
- `[x] COMPLETE` - Collapsible "Plan Info" drawer with plan-wide completed stats (miles, hours, climb, and calories) and progress bars.
- `[x] COMPLETE` - Advanced periodization logic (Base, Build, Peak, Taper phase instructions).
- `[x] COMPLETE` - Plan templates library (Active Recovery, Base Builder, Gran Fondo Prep).
- `[x] COMPLETE` - Multiple workouts per day with ordering and "keep both" conflict resolution.
- `[ ] INCOMPLETE` - Recurring season schedules.

### 3.4. Dashboard, Trends & Strava Reconciliation
- `[x] COMPLETE` - "Midnight Pro" CSS layout with Ambient background orbs.
- `[x] COMPLETE` - Interactive Training Trends Chart with 4-week and 8-week view toggles.
- `[x] COMPLETE` - Coggan 7-zone Power Analysis & manual FTP configuration.
- `[x] COMPLETE` - Manual Strava activity linking and automatic workout completion updates.
- `[x] COMPLETE` - Apple Watch "Daily Activity" rings card (calories, stand hours, steps, exercise minutes).
- `[x] COMPLETE` - Heuristic-based automatic activity matching suggestions with confidence scores.
- `[x] COMPLETE` - Automated background sync polling on window/tab focus (reconciliation pass throttled on refocus).
- `[x] COMPLETE` - Strava enrichment: segment grade/elevation, extended power curve, and real cardiac decoupling; most recent ride always prioritized, >60min rides favored, and all ride types (VirtualRide, EBikeRide, TrailRun, etc.) eligible.
- `[x] COMPLETE` - Power Curve, Segment Efforts, and Elevation-Power dashboard views.
- `[x] COMPLETE` - Form (TSS/CTL/ATL/TSB) rider-profile metric, replacing ACWR-based Capacity.
- `[x] COMPLETE` - HR-to-power estimation for outdoor rides without a power meter.
- `[x] COMPLETE` - Consolidated readiness/recovery insights via `readinessService` and unified `TodayCard`.

### 3.5. AI Chat Interface & Curation Loop
- `[x] COMPLETE` - Message history maintenance and context snapshot storage.
- `[x] COMPLETE` - Chat prompt enrichment (attaching HRV, RHR, recent activities, power/HR zone distributions).
- `[x] COMPLETE` - Provider-agnostic chat image uploads (multimodal mapping support for OpenAI and Anthropic/Claude).
- `[x] COMPLETE` - Copy chat messages directly to clipboard as raw Markdown.
- `[x] COMPLETE` - Advanced Heart Rate Telemetry & Aerobic Efficiency analysis (automatic segment efforts extraction, power-to-HR binning, and Joe Friel standard cardiac decoupling calculations).
- `[x] COMPLETE` - Custom system prompt editor in Advanced Settings.
- `[x] COMPLETE` - Persistent AI coach memory (athlete profile, goal lifecycle, FTP history, recent activity notes) with behavior-based rollups and durable sync watermark.
- `[x] COMPLETE` - Chat reliability: expanded profile context, higher token and system-prompt limits, surfaced Edge Function errors, and 140s request timeout for long replies.
- `[x] COMPLETE` - Mobile chat layout fixes and improved bubble/table contrast.
- `[x] COMPLETE` - Curation Feed Phase 1 (YouTube video integration curated by interest tags).
- `[x] COMPLETE` - Cycling news digest (`cycling-news-digest` Edge Function, cached in `cycling_digest_cache` with RLS): RSS-sourced, discipline-filtered, with detailed race overviews on the Learn page; parallel feed fetching.
- `[ ] INCOMPLETE` - Curation Feed Phase 2 (Instagram Basic Display API; RSS magazine feeds partially delivered via the cycling digest).
- `[ ] INCOMPLETE` - Curation Feed Phase 3 (Machine Learning affinity recommendations and like/dislike ratings).

---

## 4. UI/UX & Styling Guidelines

- **Theme Colors:** Deep slate backgrounds (`bg-slate-950`), custom borders (`border-white/5`), bright accent points (Strava Orange `#FC5200` for primary, Blue `#3B82F6` for rides, Red `#EF4444` for runs, Teal `#06B6D4` for yoga).
- **Responsive Sizing:** Mobile-responsive columns, flex grids, and auto-collapsing panels.
- **Micro-Animations:** Slow transitions (`transition-all duration-300`) on hover states, collapsible drawers, and modal popups to maintain premium styling.

---

## 5. Success Metrics

- **Early Retention:** 30-day user retention increase for athletes completing conversational onboarding (target: +20%).
- **Onboarding Pipeline:** Conversational onboarding flow completion rate (target: 85%+).
- **Plan Generation Rate:** Percentage of new users generating a training plan within 48 hours of onboarding (target: 70%+).
- **Multi-Modal Engagement:** Proportion of non-cycling workouts logged on the platform (target: 30%+ of all logged entries).
