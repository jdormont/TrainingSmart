# TrainingSmart AI: Multi-Modal Athlete Expansion PRD

### TL;DR

TrainingSmart is evolving from a cycling-first AI coaching app into a truly whole-athlete platform. This expansion introduces first-class support for running, strength, yoga, and hiking; a conversational onboarding that tailors coaching and activates re-engager mode; coach specializations personalized to the athlete’s true profile; and richer Apple Watch data capture beyond just sleep. The primary audience: multi-modal athletes and those returning to fitness who need momentum, not just optimization.

---

## Goals

### Business Goals

* Broaden total addressable market beyond cycling-focused athletes by 40% over two quarters
* Reduce early churn (first 7 days) from users who feel the app isn’t built for them by 20%
* Increase 30-day retention for re-engager users by making them feel “at home” in their first session, targeting a 20% improvement
* Rebrand TrainingSmart as the AI coach for the “whole athlete,” securing top 10 positions in search for non-cycling fitness coaching

### User Goals

* Feel seen and supported regardless of activity mix or fitness level
* Receive a training plan that fits real-life availability (as low as 2 sessions/week)
* Interact with an AI coach fluent in their activities and supportive of their specific fitness journey
* Track progress and streaks across all workouts—not just rides
* Never feel like they’re doing a ‘lite’ or watered-down version of the real product

### Non-Goals

* Competing with generic fitness platforms (e.g. Apple Fitness+, Peloton) on pure content volume
* Rebuilding the Strava integration or altering the core compliance model
* Introducing nutrition tracking in this release

---

## User Stories

### Personas

**1. The Multi-Modal Athlete**

* As a multi-modal athlete, I want my training plan to integrate cycling, yoga, and strength, so that my plan and recovery data reflect my actual week, not just my rides.
* As a multi-modal athlete, I want my dashboard to highlight all activity types, so no modality feels ignored.
* As a multi-modal athlete, I want my AI coach to give me advice relevant to each activity, so that training is cohesive.

**2. The Re-Engager**

* As a returning athlete, I want onboarding to set realistic goals and plans that celebrate showing up, so that I feel momentum and success from day one.
* As a re-engager, I want to be assigned a coach that focuses on consistency, not performance optimization, so that I’m motivated to stick to my plan.
* As a re-engager, I want to receive positive feedback for even low-frequency sessions (2x/week), so I don't feel judged.

**3. The Strength-First Athlete**

* As a strength-focused athlete, I want to have workout plans emphasizing strength and hiking, with cycling suggestions as an option, so the app reflects my priorities.
* As a strength-first athlete, I want my coach to surface strength progress (sets, weight, consistency) prominently.
* As a strength athlete, I want to log yoga or gym sessions manually and have them counted equally in my streaks/goals.

---

## Functional Requirements

* **Conversational Onboarding Profile** (Priority: HIGH)

  * Natural language onboarding: 4–5 questions to capture primary goal, activity mix/priorities, realistic weekly availability, and current fitness level/self-perception.
  * Output: coach specialization assignment; fitness mode (performance vs. re-engager).
  * Data stored in structured profile fields; onboarding experience must feel like a “conversation,” not a form.

* **Coach Specializations** (Priority: HIGH)

  * Four AI coach types: Endurance Coach (cycling/running), Strength & Mobility Coach (strength/yoga), General Fitness Coach (broad multi-modal), Comeback Coach (re-engager focus).
  * Specified in profile and visible in UI; each impacts AI prompting, dashboard metrics, and plan logic.
  * User can switch specialization any time.

* **Expanded Activity Types** (Priority: HIGH)

  * Fully support running, strength training, yoga, and hiking (with appropriate fields: sets/reps for strength, yoga style/duration, hiking elevation/distance, running pace zones).
  * Activity icons and unique color coding in plans and dashboard.
  * Ability to log all types both via integrations and manually.

* **Re-Engager Mode** (Priority: HIGH)

  * Auto-triggered based on onboarding data (low availability or long activity gap from Strava or self-report).
  * Plans default to 2–3 sessions/week, 20–45 min, with consistency and streaks celebrated over raw metrics.
  * AI dialogs shift: proactive “how did that feel?” check-in; milestone-based “Ready to level up?” prompts after sustained streaks.

* **Apple Watch Expanded Data Capture** (Priority: MEDIUM)

  * Extend current Apple Health shortcut to collect: active calories, stand hours, exercise minutes, daily steps, most recent workout type.
  * Map Apple Watch workout types into TrainingSmart schema.
  * Add new dashboard cards: ‘Daily Activity’ (distinct from structured/plan workouts) showing ring metrics and cumulative activity.

* **Multi-Modal Training Plans** (Priority: HIGH)

  * Plan generator accepts activity mix and priorities from user profile.
  * Weekly plan output: combines any ratio of supported activity types; respects unique recovery needs (e.g., no hard ride after heavy strength).
  * Transparent AI plan explanation surfaced to user (“Why this week looks like this…”).

---

## User Experience

**Entry Point & First-Time User Experience**

* User signs up and is welcomed by the AI coach with a brief conversational intro.
* Onboarding presented as 4–5 natural language screens:
  1. “What brings you to TrainingSmart?” (Goal framing)
  2. “Which activities do you do or want to do?” (Multi-select + prioritize)
  3. “How many days per week can you realistically train, and for how long?” (Availability, e.g., 2 days/week, 30 min)
  4. “How would you describe your current fitness?” (Self-assessment; warm, no-shame language)
  5. Optional: “Do you have any upcoming events or goals?”
* As each question is answered, a conversational progress indicator moves forward (no forms or checklists).
* System assigns a coach specialization and fitness mode, then surfaces a tailored welcome dashboard.

**Core Experience**

* **Step 1:** Dashboard highlights are tailored to coach specialization and fitness mode.
  * Re-engager: streak widget, consistency display, simple “Today’s Workout” card, celebratory visuals for streaks.
  * Multi-modal: pie chart or bar showing activity mix, variety score, progress across types.
  * Performance: FTP, power zones, advanced training load for cycling/running athletes.
* **Step 2:** Plan creation is simplified.
  * Goal is set or confirmed; activity mix auto-filled but adjustable.
  * User reviews week plan, edits day-by-day activity or swaps sessions for alternatives (e.g. swap strength and yoga).
  * Activity color coding and icons are visible throughout.
* **Step 3:** Coach chat adapts to specialization.
  * Strength coach avoids cycling-specific feedback; comeback coach is relentlessly positive, performance coach is analytical.
  * AI checks in after workout completion (“How did that feel?”) and logs response.
* **Step 4:** Logging and integrations.
  * Users can log via Strava, Apple Watch, or manually (especially gym/yoga).
  * New setting enables “Sync Apple Activity Rings”; data mapped and surfaced in dashboard.
* **Step 5:** Re-engager milestones.
  * After 4–6 weeks of consistency, app surfaces “Look how far you’ve come!” moment and offers to “level up” to a more advanced plan.

**Advanced Features & Edge Cases**

* Manual override of coach specialization at any time from profile/settings.
* ‘Level Up’ prompt is celebratory and opt-in, never pressuring.
* Activity logged without device (manual entry) is still incorporated in streaks and analytics.
* For users with under-populated Strava data, Apple Watch or manual activity logs become primary source.
* Error states: clear feedback if Apple Watch shortcut out of date; fallback options always offered.

**UI/UX Highlights**

* Conversational onboarding with one question per screen.
* Progress bar and warm, approachable tone.
* Coach specialization badge in chat header at all times.
* Visually distinct, instantly recognizable activity icons (running, cycling, yoga, strength, hiking).
* No power/FTP/zone widgets on non-performance dashboards.
* Consistency and streaks feel like achievements, not compensations.

---

## Narrative

Maya, 38, once loved half marathons but hasn’t trained in nearly 18 months. She downloads TrainingSmart, and during onboarding the AI coach greets her: “Welcome back to moving well! What brings you in today?” Maya admits she’s just looking to feel like herself again—not chase a time goal. She lists running, yoga, and strength circuits as her activities. When the coach asks about realistic availability, she answers honestly: three days a week, 30–40 minutes per session.

Without judgment, the AI assigns the “Comeback Coach” specialization and creates a gentle, three-day plan: an easy run, a restorative yoga class, and a bodyweight strength set. The first thing Maya sees on her dashboard is her consistency streak—no FTP, no intimidating analytics. After every session, the coach checks in, and Maya finds herself enjoying the momentum. Six weeks in, with a perfect streak and new confidence, the app congratulates her: “Look how far you’ve come! Ready to set a bigger goal together?” Inspired, Maya accepts—and recommends TrainingSmart to friends, who are similarly encouraged by an app that celebrates progress, not just performance.

---

## Success Metrics

### User-Centric Metrics

* 30-day retention rate for users completing conversational onboarding (target: 20% improvement vs. prior baseline)
* Percent of new users generating a training plan within 48 hours of signup
* Consistency rate at week 4 for re-engager mode (60% complete at least 2 workouts in week 4)
* Coach specialization change rate (goal: <10%, showing onboarding is matching well)

### Business Metrics

* 30% of all logged workouts are non-cycling within 90 days of feature launch
* Increased new user acquisition via non-cycling keywords (tracked via referral/tracking links)
* Reduction in first-7-day early user churn rate

### Technical Metrics

* Apple Watch expanded sync success rate (target: 95%+ for daily activity)
* Plan generator latency for multi-modal plans (<8 seconds/user)
* Onboarding completion rate (85%+ for new accounts)

### Tracking Plan

* onboarding_step_completed (per question)
* coach_specialization_assigned (onboarding endpoint)
* plan_generated (with activity_types array)
* workout_logged (with activity_type and source)
* level_up_prompt_shown and level_up_accepted
* apple_watch_sync_type (sleep vs. daily_activity)

---

## Technical Considerations

### Technical Needs

* New ConversationalOnboarding UI component (renders one question at a time with animation; posts to user profile)
* Supabase schema updates: fields for primary_goal, activity_mix (with priority), weekly_availability_days, weekly_availability_duration, fitness_level, coach_specialization, fitness_mode
* System for coach specialization: profile-driven, referenced in AI system and dashboard logic
* Expanded workouts table: new activity_type enum (running, strength, yoga, hiking); metadata columns for each (e.g., sets_reps, yoga_style)
* Multi-modal AI prompt updates for plan generation; logic respects per-activity recovery and order
* Apple Watch shortcut extension: export daily activity fields, HealthKit mapping, and new dashboard endpoints

### Integration Points

* Strava API unchanged; current fetch/parse logic persists
* Apple Health Shortcut extended, not replaced; users may need to update their shortcut
* Oura integration remains as-is
* OpenAI prompts updated for coach specializations

### Data Storage & Privacy

* Profile data stored securely in user_profiles (existing table)
* Apple Watch daily activity stored in daily_metrics
* No new third-party vendors; user consent/authorization persists unchanged

### Scalability & Performance

* Onboarding and dashboard are stateless UIs; new profile fields are low-impact
* Activity_type expansion requires a safe migration (likely <1 million rows)
* AI prompt length slightly increases with multi-modal logic, should remain within model input window

### Potential Challenges

* Apple Watch shortcut update dependency—existing users must re-install or update for new metrics; requires in-app guidance and fallback
* Multi-modal plan generation increases AI complexity and prompt size, increasing risk of edge case errors or higher inference costs
* Coach specialization switching must be seamless; chat session continuity must not break when switching

---

## Milestones & Sequencing

### Project Estimate

Large — 4–6 weeks across three focused phases

### Team Size & Composition

Small team — 1 full-stack developer (Josh), 1 AI/prompt engineer (roles may overlap); self-serve design using component library

### Suggested Phases

**Phase 1: Foundation (2 weeks)** ✅ COMPLETE — branch: `enhanced-fitness-phase2`

* Key Deliverables:
  * ✅ Supabase schema migration: new `user_profiles` fields (primary_goal, activity_mix, weekly_availability_days/duration, fitness_level, coach_specialization, fitness_mode, conversational_onboarding_completed); expanded `workouts.type` constraint to include yoga/hiking; `activity_metadata` jsonb column
  * ✅ TypeScript types: CoachSpecialization, FitnessMode, FitnessLevel, ActivityType union types; ActivityMixItem and OnboardingProfile interfaces; Workout.type and UserProfile updated
  * ✅ Onboarding services: assignCoachSpecialization() pure logic; saveOnboardingProfile() DB write; updateCoachSpecialization() and updateFitnessMode() for settings
  * ✅ Conversational onboarding UI (5-screen flow): goal → activity mix → availability → fitness level → optional event; completion screen shows assigned coach; routing gate in ProtectedRoute
  * ✅ Coach specialization selector in Settings with save + reloadProfile()
  * ✅ Fitness mode toggle in Settings (Performance / Re-Engager) with immediate save + reloadProfile()
  * ✅ Dashboard fitness mode branching: re-engager layout (streak-first, simple weekly summary, no power/FTP widgets); performance layout unchanged; coach badge in header for all users
  * ✅ OpenAI prompt injection: coach specialization prefix + re-engager addendum prepended to system prompt; training plan edge function updated and deployed
* Notes:
  * fitness_mode is currently set by onboarding self-report only; weekly_availability_days ≤ 3 triggers re_engager regardless of actual Strava data — future improvement: cross-reference Strava history
  * Legacy coach_persona / training_goal fields preserved alongside new fields; overlap to be resolved in Settings refactor (see below)
  * Migration history had pre-existing conflicts (duplicate 20260115 filenames) — resolved by renaming 20260115_fix_rhr_constraint.sql → 20260115100000_fix_rhr_constraint.sql

**Phase 1.5: Settings Page Refactor** ✅ COMPLETE — branch: `enhanced-fitness-phase2`

* Problem: Settings page had grown unwieldy — overlapping coach concepts, scattered integrations, and a raw system prompt editor all on one long scroll
* Solution: Reorganized into 4 tabs
  * ✅ **My Coach** — Coach Specialization selector, Fitness Mode toggle (Performance / Re-Engager), Communication Style (coach persona), Training Goal; onboarding `primary_goal` surfaced as a reference label above the legacy selector
  * ✅ **My Profile** — Health Profile (gender, age bucket), Weekly Availability sliders (days/week + min/session, replacing legacy `weekly_hours`), FTP, Skill Level; single Save button writes all fields including new `weekly_availability_days/duration`
  * ✅ **Integrations** — Strava, Oura Ring, Google Calendar, Apple Watch Health Sync all in one tab with consistent connect/disconnect UI
  * ✅ **Advanced** — System prompt editor + save/reset, Content Interests pill selector, Example Coaching Styles collapsed behind toggle (reference, not primary UI), Admin Dashboard conditional (admins only)
* Notes:
  * `weekly_hours` legacy field is no longer shown in the UI; new `weekly_availability_days/duration` fields replace it functionally
  * `primary_goal` (from onboarding) displayed as read-only label in My Coach tab alongside the editable legacy `training_goal`; full consolidation deferred to a future cleanup
  * Admin Dashboard visible in Advanced tab for admin users; not yet moved to a dedicated `/admin` route

**Phase 2: Expansion (2 weeks)** ✅ COMPLETE — branch: `enhanced-trainer-phase2`

* Key Deliverables:
  * ✅ **ActivityMetadata type** — new `ActivityMetadata` interface (sets_reps, yoga_style, elevation_gain, terrain, pace_zone) with index signature; added to `Workout` interface
  * ✅ **Multi-modal edge function** — rewrote `openai-training-plan` system prompt from cycling-only to multi-modal fitness coach; accepts `activity_mix[]` from user profile and injects per-type priority context; expanded workout schema to include `yoga` and `hiking` types; added optional `activity_metadata` output per workout; injected cross-activity recovery rules (no heavy strength after hard ride/run, yoga is recovery-safe, hiking counts as moderate aerobic load); deployed
  * ✅ **Re-engager plan constraints** — edge function enforces hard limits when `fitness_mode === 're_engager'`: max 3 sessions/week, max 45min/session, 80% easy/recovery intensity, no "hard" workouts in weeks 1–2, encouragement-first descriptions
  * ✅ **openaiApi.ts updated** — `activity_mix` added to `TrainingContext.userProfile`; passed through to edge function on every plan generation call
  * ✅ **WorkoutCard** — added `Leaf` icon + teal theme for yoga; `Mountain` icon + amber theme for hiking; `TrendingUp` icon for running; per-type theme overrides take precedence over intensity-based theming; metadata pill row in expanded view (sets/reps, yoga style, elevation, terrain, pace zone)
  * ✅ **PlansPage** — imports `useAuth`; derives `isReEngager` and `activityMix` from profile; activity mix summary card appears above form (priority-labeled pills); re-engager simplified form hides goal type selector / event date / focus areas, uses friendlier copy; event date auto-set to 8 weeks for re-engager; full `userProfile` context (coach_specialization, fitness_mode, activity_mix) now flows into plan generation; `activity_metadata` carried through the workout mapping and persisted to DB
  * ✅ **trainingPlansService** — `activity_metadata` added to `DbWorkout` interface, workout insert, and workout hydration (select → map)
  * ✅ **milestoneService.ts** — checks level-up eligibility: re-engager user with ≥21-day streak OR ≥8 activity entries in past 28 days; localStorage-backed dismiss (14-day cooldown) and accept (permanent); `reset()` method for when user switches back to re_engager
  * ✅ **LevelUpModal.tsx** — celebratory modal with streak stats, "Yes, let's level up!" CTA (calls `updateFitnessMode('performance')` + `reloadProfile()`), "Not yet" dismisses for 14 days; tracks `level_up_accepted` and `level_up_prompt_dismissed` analytics events
  * ✅ **DashboardPage** — milestone check runs on streak/profile change (re-engager only); `LevelUpModal` rendered when eligible; `<>` fragment wraps re-engager layout alongside modal
* Notes:
  * `activity_metadata` from AI is passed through as-is from the JSON response; the edge function includes it only for relevant workout types (strength, yoga, hiking, run) — bike and swim workouts omit it
  * Level-up acceptance switches `fitness_mode` to `'performance'` only — does not change `coach_specialization`; user can update specialization separately in Settings → My Coach
  * Re-engager plan form auto-sets event date to 8 weeks; the edge function's periodization logic calculates 8 weeks → Build→Peak→Taper, which is appropriate for a consistency-building cycle

**Phase 3: Apple Watch & Polish (2 weeks)**

* Key Deliverables:
  * Apple Watch shortcut updates for daily activity capture
  * daily_metrics expansion; dashboard “Daily Activity” card
  * Coach specialization badge in chat header
  * End-to-end testing/QA across all three core personas
* Dependencies: Phase 2 activity types and mapping defined

---