## Streak Plan

# Training Streaks Experience Spec

### TL;DR

The Training Streaks feature for TrainingSmart AI introduces a clear, motivational streak mechanic—a visible count of consecutive active days—for users to build and reinforce their training habits. Streaks are surfaced across the dashboard, chat, and training plan views, and designed to reward consistent adherence without intrusive notifications or email. This spec covers streak logic, user experience, persistence, and a practical agent prompt for streamlined implementation.

---

## Goals

### Business Goals

* Increase weekly active usage by 15% within 3 months of launch.

* Boost overall user retention at 30-day and 90-day marks by at least 10% relative to baseline.

* Enhance average plan adherence rates by 20% among users with visible streaks.

* Generate actionable insights for future engagement features by tracking streak activity analytics.

### User Goals

* Easily visualize training consistency and progress over days and weeks.

* Feel motivated and rewarded by maintaining and extending their streaks.

* Recover from missed days with clear rules and minimal discouragement.

* Interact with streak tracking seamlessly within their regular TrainingSmart AI workflow.

### Non-Goals

* No use of push notifications or email reminders for streak maintenance or recovery.

* No advanced social or community features for comparing streaks (i.e., public leaderboards).

* No integration with wearable notifications during this phase.

---

## User Stories

**Solo Athlete Persona**

* As a solo athlete, I want to see my current training streak when I log in, so that I can stay motivated to continue my progress.

* As a solo athlete, I want to know exactly what counts towards extending my streak, so that I can reliably maintain it.

* As a solo athlete, I want to understand what happens if I miss a day, so that I don’t feel punished beyond recovery.

**Returning User Persona**

* As a returning user, I want to view my longest streak ever, so that I can set and reach new personal records.

* As a returning user, I want clear visual feedback when my streak increases, so that it feels meaningful and satisfying.

* As a returning user, I want simple analytics about streak history, so I can spot patterns and improve.

---

## Functional Requirements

* **Streak Tracking Logic** (Priority: High)

  * Maintains a count of consecutive active training days with plan adherence.

  * Includes automatic recognition of plan-compliant workouts (via app, manual log, or Strava sync).

  * Enforces a recovery rule: users may break and later restart their streaks, with clear messaging.

  * Stores and displays the “longest streak” and “current streak” per user.

* **UI Surface Points** (Priority: High)

  * Displays streak count prominently on user dashboard.

  * Surfaces streak count and milestone effects (e.g. animation, confetti) in chat after workout completion.

  * Shows streak status and streak history within the training plans page.

* **Feedback Mechanisms** (Priority: Medium)

  * Adds real-time positive feedback (e.g. animation or color) when streak is maintained or increased.

  * Provides forgiving, empathetic messaging and a clear path to streak recovery if a day is missed.

* **Analytics Hooks** (Priority: Medium)

  * Tracks aggregate streak lengths, active streaks, and break rates for cohort analysis.

  * Measures correlation between streak length and overall plan adherence.

---

## User Experience

**Entry Point & First-Time User Experience**

* Users first encounter streaks visually on the dashboard after completing or logging their first workout.

* Onboarding highlights the concept: “Keep your streak alive by training every day you’re scheduled.”

* Simple tooltip or onboarding info panel illustrates how streaks work and what counts.

**Core Experience**

* **Step 1:** User completes a planned workout (either within TrainingSmart AI, manually logs, or synchronizes via Strava).

  * UI displays a quick celebratory animation and updates the streak counter.

  * If it’s the start of a new streak or a “streak milestone” (e.g. 3, 7, 14 days), special visuals are shown in chat and dashboard.

* **Step 2:** On the dashboard, the user's current and best (longest) streak are always visible.

  * Streak history available as a timeline/bar chart on the Plans page.

  * Clear explanation is available when hovering over the streak widget, detailing what counts/decrements a streak.

* **Step 3:** If a scheduled training day is missed, streak is marked as “broken” next login, with empathetic messaging, encouragement, and suggestion to start a new streak.

  * The user can see when their previous streak began/ended.

  * Optionally, on a user's request, quick recovery explanation is displayed.

* **Step 4:** For plan rest days, the streak holds (neither increases nor breaks).

**Advanced Features & Edge Cases**

* Handles syncing delays (e.g. late Strava uploads) by retroactively applying streak updates.

* Manages plan changes (e.g. skipped ahead, rescheduled) by recalculating streaks accordingly.

* Provides user override for missed/incorrect entries with proper data validation and audit trail.

**UI/UX Highlights**

* Contrasting color badge/number, easily glanceable.

* Subtle yet delightful animation for streak milestones (e.g. spark, confetti).

* Fully responsive: mobile/desktop-friendly layouts.

* Accessibility: ensures screen reader support, color-blind accessible visuals, and clear alt text for streak graphics.

---

## Narrative

Sam, a dedicated runner, has always struggled to maintain consistent training—enthusiastic one week, falling off the next. After joining TrainingSmart AI, Sam logs her first workout. A bright “1-day Streak” badge flashes on the dashboard with a celebratory animation. Each day she shows up, Sam’s streak count increases, visually rewarding her efforts on both her dashboard and in her chat sessions. On her seventh day, animated confetti bursts and she gets a positive note: “Awesome job—1 week strong!” When a busy workday derails her routine, Sam logs in the next evening, greeted by empathetic messaging: "Your streak paused, but you can start a new one—every day counts.” Instead of quitting, she’s motivated to beat her previous 7-day record. Her streak stats and history help her see real progress, keeping training fun and habit-forming. For TrainingSmart AI, this means improved engagement, more consistent users, and ultimately, better outcomes for both user and platform.

---

## Success Metrics

### User-Centric Metrics

* Percentage of users who reach streak milestones (e.g. 7, 14, 30 days)

* Uplift in user satisfaction (survey rating for "motivation to train")

### Business Metrics

* Increase in average active days per user per month.

* Improvement in plan completion rates post-streak launch.

### Technical Metrics

* Reliable calculation accuracy (>99%) for streak logic.

* UI render latency <200ms for streak component loads.

### Tracking Plan

* Streak start event

* Streak increment event

* Streak milestone event (e.g. 7, 14, 30 days)

* Streak broken event

* Streak recovery/restart event

* Dashboard and chat streak component views/clicks

---

## Technical Considerations

### Technical Needs

* **APIs:** Secure workout ingestion (internal + Strava sync), get/set streak status, update streak logic.

* **Data Model:** User: streak current, streak longest, streak history (array of dates/events), plus plan schedule reference.

* **Front-End:** Components for dashboard, chat, and plan display; animation assets for celebration.

* **Back-End:** Job to validate day rollover, streak breaks, handle Strava batch syncs.

### Integration Points

* Strava API for remote workout verification; TrainingSmart's internal workout and plan APIs.

* Compatibility with manual workout entry and current plan schedule logic.

### Data Storage & Privacy

* Streak data stored per user, tied to minimal necessary identifiers.

* Compliant with TrainingSmart’s privacy and data minimization policies (no location or workout detail stored redundantly).

* User-initiated data deletion for streak records supported.

### Scalability & Performance

* Must efficiently support real-time streak calculations for up to 100,000 daily active users.

* Optimized for delta updates rather than expensive history scans.

### Potential Challenges

* Sync lag or missed imports from Strava causing user confusion.

* Edge-case handling for timezones, daylight savings, or retroactive workout edits.

* UI performance and accessibility regressions due to increased data or visuals.

---

## Milestones & Sequencing

### Project Estimate

* Small: 1–2 weeks to MVP, and 1 week for polish/enhancements.

### Team Size & Composition

* Small Team: 2 people (1 full-stack engineer, 1 part-time design/product)

### Suggested Phases

**MVP (1 week)**

* Key Deliverables:

  * Streak data tracking engine (engineer)

  * Core API endpoints (engineer)

  * Minimal UI widgets for dashboard and chat (engineer, review with design)

  * Simple onboarding explanation (product/design)

* Dependencies:

  * Workout ingestion logic, plan baseline

**Polish & Edge Cases (1 week)**

* Key Deliverables:

  * Advanced UI/UX: animations, milestone effects (engineer/design)

  * Strava batch sync + retroactive update handler (engineer)

  * Basic analytics event hooks (engineer)

  * Accessibility pass (design)

* Dependencies:

  * MVP release, user feedback

**Enhancement & Analytics (1 week, optional)**

* Key Deliverables:

  * History views, personal bests

  * Cohort analysis dashboard

  * User override/admin tools for edge error states

* Dependencies:

  * Core and polish phases

---