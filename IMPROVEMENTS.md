# Improvements Assessment — TrainingSmart

*Assessment Date: May 31, 2026*

---

## Assessment Methodology

This assessment was conducted by reviewing the PRD, the formal `RISK_AND_PERFORMANCE_REVIEW.md` (reviewed May 30, 2026), component file sizes and structures, recent commit history (including the May 31 security hardening, CI/CD pipeline, and 142-test suite additions), and all open items in the risk register. Improvements were prioritized by combining security risk, user-facing impact, and developer productivity. Effort estimates assume a developer familiar with the React Query v5 + Supabase + Deno Edge Functions stack.

**Key signals reviewed:**
- `RISK_AND_PERFORMANCE_REVIEW.md` — 20 items; 11 fixed, 9 open across P2–P4
- Recent commits: P1/P2 security fixes, testing suite (142 tests, 11 files), CI/CD, plan templates, heuristic activity matching
- Component sizes: `PlansPage.tsx` (1,382 lines), `SettingsPage.tsx` (1,118 lines), `trainingPlansService.ts` (930 lines)
- PRD incomplete items: Curation Feed Phase 2 & 3, recurring season schedules
- Open risk register items: OAuth token encryption, test coverage (~10%), monolithic components, cache invalidation, DB transactions, error monitoring, code splitting, TypeScript `any` (214 instances), accessibility, admin UI

---

## Tier 1 — High-Impact, Quick Wins

These improvements deliver immediate security or usability value with modest effort.

---

### 1.1 Encrypt OAuth Tokens at Rest (Strava & Google Calendar)

**Description:** Strava and Google Calendar refresh tokens are stored in plaintext in the `user_tokens` / `strava_tokens` database tables. These long-lived tokens grant full access to users' Strava fitness data and Google Calendar. If the Supabase project credentials were ever compromised, all stored tokens would be immediately usable with no additional decryption step. Using Supabase Vault (`pgsodium`) to encrypt tokens before insert — and decrypt only inside Edge Functions — eliminates this risk. This is the single largest remaining open item from the P2 security review.

**Estimated Effort:** 2–3 days  
**Expected Impact:** High security — closes the most significant unmitigated risk in the codebase; protects sensitive third-party access tokens for every user.

**Agent Prompt:**
> Encrypt Strava and Google Calendar OAuth tokens at rest in TrainingSmart. Enable the `pgsodium` extension in Supabase (`create extension if not exists pgsodium`). Create a new Supabase migration that: (1) creates a `pgsodium` encryption key via `pgsodium.create_key()`, (2) replaces plaintext `refresh_token` and `access_token` text columns in both `strava_tokens` and `user_tokens` with `bytea` columns named `refresh_token_enc` and `access_token_enc`. Update the Strava and Google Calendar Edge Functions (`strava-refresh-token`, `google-calendar-*`) to call `pgsodium.crypto_aead_det_encrypt()` before storing tokens and `pgsodium.crypto_aead_det_decrypt()` when reading them. The encryption key must remain entirely within the Edge Function + Vault context and never reach the browser. Include a migration script that re-encrypts any existing plaintext rows. Update `_shared/validate.ts` to reject requests missing required token fields.

---

### 1.2 React Query Cache Invalidation After Mutations

**Description:** React Query caches are not explicitly invalidated after plan creation, workout status updates, or metric syncs. Users occasionally see stale data until the 5-minute default TTL expires — for example, completing a workout but still seeing it as uncompleted on the dashboard stats, or creating a new plan and not seeing it appear in the plan list immediately. Since React Query v5 is already integrated throughout the app, adding `queryClient.invalidateQueries()` in mutation `onSuccess` callbacks is a low-effort, high-return fix identified in risk item #12.

**Estimated Effort:** 1 day  
**Expected Impact:** High usability — eliminates stale-state confusion after the app's most common actions; makes the app feel responsive and trustworthy without any architectural changes.

**Agent Prompt:**
> Audit all `useMutation` calls across TrainingSmart's `src/` directory. For every mutation `onSuccess` callback that modifies server state, add the appropriate `queryClient.invalidateQueries({ queryKey: [...] })` calls. Key mutation/query-key pairs to fix: (1) workout status toggle → invalidate `['workouts', planId]` and `['plan-stats', planId]`; (2) plan creation or modification → invalidate `['training-plans', userId]`; (3) Oura/Apple Watch metric sync → invalidate `['health-metrics', userId]`; (4) Strava activity link → invalidate `['strava-activities', userId]` and `['workouts', planId]`; (5) user profile update → invalidate `['user-profile', userId]`. Use the existing query keys as defined in each hook. Add Vitest tests that verify `invalidateQueries` is called with the correct key after each mutation, using `vi.spyOn(queryClient, 'invalidateQueries')`.

---

### 1.3 Centralize Token Refresh Logic

**Description:** Token refresh code is duplicated between `stravaApi.ts` and `authService.ts`. Inconsistencies between the two implementations have already surfaced at least one production bug (per git history). A single `tokenRefreshService.ts` that both callers delegate to eliminates the divergence risk, makes the refresh logic testable in one place, and simplifies adding future OAuth integrations (Google Calendar already shares the same pattern).

**Estimated Effort:** 1–2 days  
**Expected Impact:** Medium reliability — eliminates a known source of Strava sync bugs; simplifies future OAuth integrations; improves testability of authentication flows.

**Agent Prompt:**
> Create `src/services/tokenRefreshService.ts` in TrainingSmart. Export a single `refreshOAuthToken({ provider: 'strava' | 'google', userId: string }): Promise<string>` function that: (1) reads the current encrypted refresh token from Supabase, (2) calls the appropriate Edge Function proxy (`strava-refresh-token` or `google-calendar-refresh`), (3) stores the new access token back to Supabase (encrypted), (4) returns the fresh access token string. Remove the duplicate refresh logic from `stravaApi.ts` and `authService.ts` and replace both call sites with calls to `tokenRefreshService.refreshOAuthToken()`. Add Vitest unit tests covering the happy path and the case where the refresh token has expired (expect a typed `TokenExpiredError` to be thrown so callers can redirect to re-auth).

---

## Tier 2 — Medium-Impact, Moderate Effort

These improvements materially improve stability and developer velocity but require more focused effort.

---

### 2.1 Increase Test Coverage to 50%+ on Core Services

**Description:** Test coverage is approximately 10% across 50+ service files, per the risk review. The CI/CD pipeline now runs tests on every push, but critical business logic — training plan generation, health metric scoring, Strava sync orchestration, streak calculation — is unprotected by automated tests. A regression in `trainingPlansService.ts` or `healthMetricsService.ts` is invisible until a user reports incorrect workout load, corrupted HRV scores, or a broken plan. This is risk item #5 and the largest remaining technical debt item.

**Estimated Effort:** 1–2 weeks (spread across sprints)  
**Expected Impact:** High long-term — protects the most complex user-critical business logic; enables safe refactoring of monolithic components; supports the DB transactions work in Tier 3.

**Agent Prompt:**
> Add Vitest unit tests for the three highest-priority service files in TrainingSmart to raise coverage from ~10% toward 50%. Target: (1) `src/services/trainingPlansService.ts` — test plan creation with various goal/activity combinations, plan modification logic, and the "Level-Up" consistency milestone trigger (the 21-day streak threshold logic); (2) `src/services/healthMetricsService.ts` — test FTP calculation, HRV scoring, and readiness score derivation using fixed synthetic input datasets that produce known expected outputs; (3) the heuristic activity matching service — test the confidence scoring algorithm with mock Strava activities vs. mock planned workouts at various distance/duration/type similarity thresholds. Use `vi.mock()` to stub all Supabase client calls. Each file should reach at least 70% branch coverage. Run `npm run test:coverage` to verify.

---

### 2.2 Split Monolithic PlansPage.tsx (1,382 Lines)

**Description:** `PlansPage.tsx` at 1,382 lines mixes plan list rendering, plan creation form, workout card interactions, drag-and-drop rescheduling via `@dnd-kit`, the "Brain" AI reasoning popup, the Level-Up modal, and the Plan Info drawer. This single file is difficult to review, effectively impossible to test at the component level, and is the most common source of merge conflicts. Splitting it into focused sub-components reduces cognitive load for every future change to the plans feature.

**Estimated Effort:** 3–4 days  
**Expected Impact:** Medium — reduces developer friction on the most-changed page; enables component-level testing; reduces merge conflicts; improves code review quality.

**Agent Prompt:**
> Refactor `PlansPage.tsx` in TrainingSmart into smaller focused components without changing any visible behavior or styling. Extract: (1) `src/components/plans/PlanList.tsx` — the list of training plan cards with select/delete actions; (2) `src/components/plans/WorkoutColumn.tsx` — the `@dnd-kit` sortable column layout for a single week day; (3) `src/components/plans/PlanReasoningModal.tsx` — the "Brain" icon popup showing AI periodization reasoning text; (4) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal with the transition-to-Performance-Mode CTA; (5) `src/components/plans/PlanInfoDrawer.tsx` — the collapsible cumulative stats drawer. `PlansPage.tsx` should become a thin orchestrator under 300 lines that composes these sub-components and manages shared state. Verify CI passes and all 142 existing tests still pass after the refactor.

---

### 2.3 Structured Error Monitoring with Sentry

**Description:** The codebase has 183 `console.error` / `console.warn` calls that are invisible in production. When an Edge Function fails, a Strava sync crashes, or a React render error is caught by the existing `ErrorBoundary`, there is no alerting or aggregated error tracking. This is risk item #14. Adding Sentry would surface real user-impacting errors instantly, enable stack trace analysis, and provide performance monitoring for slow Supabase and OpenAI API calls.

**Estimated Effort:** 2 days  
**Expected Impact:** Medium — transforms the support and debugging workflow; enables proactive identification of production issues before users report them; complements the existing `ErrorBoundary` that already wraps routes.

**Agent Prompt:**
> Integrate Sentry into TrainingSmart. Install `@sentry/react`. Initialize Sentry in `src/main.tsx` with DSN from `VITE_SENTRY_DSN`. Configure: `Sentry.init()` with `environment: import.meta.env.MODE`, `tracesSampleRate: 0.2`, and `integrations: [Sentry.browserTracingIntegration()]`. Update `src/components/common/ErrorBoundary.tsx` to call `Sentry.captureException(error)` in its `componentDidCatch` method alongside the existing recovery UI. In each service file where `console.error` is called for API failures, add `Sentry.captureException(error, { extra: { context: 'service name + operation' } })` alongside (keep console.error for local dev convenience). Add `VITE_SENTRY_DSN` to `.env.example` with a placeholder and explanation comment. Do not add Sentry to Edge Functions — their errors are captured via Supabase dashboard logs.

---

### 2.4 Route-Level Code Splitting

**Description:** All page components are eagerly imported. `PlansPage.tsx` (1,382 lines), `SettingsPage.tsx` (1,118 lines), the Recharts library (charts), and `marked` (markdown rendering) together add substantial weight to the initial JS bundle downloaded even by users visiting the login screen. This is risk item #16. Lazy-loading routes reduces Time-To-Interactive on first load, particularly impactful on mobile networks.

**Estimated Effort:** 1 day  
**Expected Impact:** Medium performance — estimated 30–40% reduction in initial bundle size; improves Time-To-Interactive for first-time users and users on slower mobile connections.

**Agent Prompt:**
> Convert all page-level route components in `src/App.tsx` (TrainingSmart) to use `React.lazy()`. Wrap all lazy-loaded routes in a single `<Suspense fallback={<SkeletonLoader />}>` where `SkeletonLoader` uses the existing dark-themed skeleton components from `src/components/skeletons/`. Pages to lazy-load: `PlansPage`, `ChatPage`, `SettingsPage`, `DashboardPage`, `AdminPage`. Run `npm run build` and inspect the Vite build output to confirm these pages are split into separate chunks. Optionally run `npx vite-bundle-visualizer` to verify the initial entry chunk is under 200 KB gzipped. Verify that all navigation routes still function and that the `ErrorBoundary` wrapping is preserved for each lazy route.

---

## Tier 3 — Strategic, Longer-Term

These improvements define TrainingSmart's long-term differentiation and require multi-week investment.

---

### 3.1 Curation Feed Phase 2 — RSS/Article Integration

**Description:** The Curation Feed currently shows YouTube videos curated by interest tags (Phase 1, complete). Phase 2 (Instagram Basic Display API + RSS-parsed magazine feeds) and Phase 3 (ML affinity recommendations with like/dislike ratings) are listed as incomplete in the PRD. Completing Phase 2 with RSS feed aggregation would significantly enrich the training content library with long-form articles from cycling, running, and fitness publications — creating a more complete training lifestyle experience.

**Estimated Effort:** 2–3 weeks  
**Expected Impact:** High long-term — increases session depth and engagement; differentiates TrainingSmart as a complete athlete platform vs. a plan tracker; creates Phase 3 data foundation.

**Agent Prompt:**
> Implement Curation Feed Phase 2 for TrainingSmart. Create a new Supabase Edge Function `rss-feed-proxy` that: (1) accepts a `?tag=cycling` query param, (2) fetches and parses RSS/Atom feeds from a hardcoded list of cycling/running/fitness publications (VeloNews, Outside, Canadian Cycling Magazine, etc.), (3) returns normalized `{title, url, imageUrl, source, publishedAt, tags}` objects as JSON. Cache feed results in Supabase `content_cache` table for 1 hour to avoid hammering external feeds. In the frontend, add an "Articles" tab to the existing Curation Feed UI alongside the existing "Videos" tab. Wire the tab to fetch from `rss-feed-proxy` filtered by the user's selected interest tags. Add a `liked_content(user_id, content_url, signal: 'like'|'dislike', created_at)` table as the Phase 3 data foundation; add thumbs up/down buttons to each article card.

---

### 3.2 Recurring Season Schedules

**Description:** The PRD flags "Recurring season schedules" as incomplete. For competitive cyclists and triathletes, training follows an annual periodized calendar (Base → Build → Peak → Taper → Race → Recovery). Supporting multi-season plan templates that auto-populate based on a target race date would be a significant differentiator for performance-mode users who plan 6–12 months in advance — the exact audience TrainingSmart's Performance Mode is designed for.

**Estimated Effort:** 2–3 weeks  
**Expected Impact:** High long-term — unlocks the performance athlete's annual planning workflow; creates high retention as users return each season to create their next year's plan.

**Agent Prompt:**
> Design and implement recurring season schedule support for TrainingSmart. Create a `season_plans` Supabase table: `(id uuid, user_id uuid, name text, start_date date, target_event_date date, target_event_name text, phases jsonb, created_at timestamptz)` where `phases` is an array of `{name: string, weeks: number, tss_target: number, focus: string}`. Create `src/pages/SeasonPlannerPage.tsx` that: (1) displays a year-view timeline divided into training phases; (2) allows the user to set a target event date and have the app auto-calculate phase durations working backward (Taper=2wk, Peak=2wk, Build=8wk, Base=remainder); (3) for each phase, generates a training plan by calling the `openai-training-plan` Edge Function with phase-specific context injected into the system prompt. Training plans generated from a season schedule should display a breadcrumb linking back to the parent season. Add a "Season" tab to the main navigation.

---

### 3.3 Accessibility Audit and WCAG 2.1 AA Remediation

**Description:** No ARIA labels, keyboard navigation patterns, or focus management were observed in the component review. The risk review (item #19) flagged this as unaddressed. For a fitness app aiming at broad adoption, WCAG 2.1 AA compliance is increasingly expected. The drag-and-drop plan interface and the Recharts power zone chart are the highest-risk areas for screen reader and keyboard-only users.

**Estimated Effort:** 1–2 weeks  
**Expected Impact:** Medium — expands the addressable user base; reduces legal risk in accessibility-regulated markets; improves keyboard-only and screen-reader experience for all users.

**Agent Prompt:**
> Conduct and remediate an accessibility audit for TrainingSmart. First, install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; fix all auto-fixable violations reported by `npx eslint src/ --fix`. Then manually address these high-priority areas: (1) all modal/dialog overlays — add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and implement focus trapping using a `useFocusTrap` custom hook that returns focus to the trigger element on close; (2) drag-and-drop workout cards — add `role="button"`, `aria-grabbed` state, and keyboard arrow-key support (up/down to reorder when a card has focus); (3) all icon-only `<button>` elements — add descriptive `aria-label` attributes; (4) the Recharts Coggan power zone chart — wrap in a `<figure>` with `aria-label` providing a text summary of the power distribution. Install `@axe-core/react` in development mode only to catch regressions automatically.
