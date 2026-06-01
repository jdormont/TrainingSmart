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

### 1.2 React Query Cache Invalidation After Mutations ✅ **COMPLETED** (June 1, 2026)

**Description:** React Query caches are not explicitly invalidated after plan creation, workout status updates, or metric syncs. Users occasionally see stale data until the 5-minute default TTL expires — for example, completing a workout but still seeing it as uncompleted on the dashboard stats, or creating a new plan and not seeing it appear in the plan list immediately. Since React Query v5 is already integrated throughout the app, adding `queryClient.invalidateQueries()` in mutation `onSuccess` callbacks is a low-effort, high-return fix identified in risk item #12.

**Estimated Effort:** 1 day  
**Expected Impact:** High usability — eliminates stale-state confusion after the app's most common actions; makes the app feel responsive and trustworthy without any architectural changes.

**Completion Note (June 1, 2026):** Two new hook files were created:

- **`src/hooks/usePlanMutations.ts`** — wraps the key `trainingPlansService` write operations as typed `useMutation` hooks: `useToggleWorkoutComplete`, `useCreatePlan`, `useUpdatePlan`, `useDeletePlan`, `useAddWorkout`, `useUpdateWorkout`, `useDeleteWorkout`. Each hook calls `queryClient.invalidateQueries()` with `exact: false` in `onSuccess` so that subkey variants (e.g. `['dashboard-data', 'demo']` and `['dashboard-data', 'user']`) are both invalidated. Plan-level mutations invalidate both `['plan-data']` and `['dashboard-data']`; workout-only mutations invalidate `['plan-data']`.

- **`src/hooks/useProfileMutations.ts`** — wraps `userProfileService.updateUserProfile()` as two semantic hooks: `useSaveUserProfile` (general settings saves) and `useSaveRiderProfile` (FTP/athletic profile saves). Both invalidate `['dashboard-data']` on success. `RiderProfileService` is a pure calculation class with no persistence method, so both hooks correctly delegate to `userProfileService`.

Query key constants (`PLAN_DATA_KEY`, `DASHBOARD_DATA_KEY`) are exported from each hook file for import by components.

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

---

## Reassessment — June 1, 2026

*Assessment Date: June 1, 2026*

---

### Progress Since May 31 Assessment

| Item | Status | Notes |
|------|--------|-------|
| CI/CD Pipeline (GitHub Actions) | ✅ Completed | PR #15 |
| Vitest Test Suite (142 tests, 11 files) | ✅ Completed | PR #15 |
| Plan Templates Library (Phase 2) | ✅ Completed | Direct push |
| Heuristic Activity Matching | ✅ Completed | Direct push |
| AI Provider Abstraction (OpenAI ↔ Anthropic) | ✅ Completed | Earlier merge |
| Post-workout RPE Check-in Modal | ✅ Completed | Earlier merge |
| Dashboard Insight Cache & Data-Specific Insights | ✅ Completed | Earlier merge |
| React Query Cache Invalidation (1.2) | ✅ Completed | `usePlanMutations.ts` + `useProfileMutations.ts` |

**Remaining open items from previous assessment:** OAuth token encryption (1.1), token refresh centralization (1.3), test coverage to 50% (2.1), PlansPage modularization (2.2), Sentry monitoring (2.3), route-level code splitting (2.4), Curation Feed Phase 2 (3.1), recurring season schedules (3.2), accessibility (3.3).

**New findings from current codebase review (June 1, 2026):**
- `PlansPage.tsx` has grown to **83,947 bytes** (up from the ~1,382-line estimate). Plan templates, the Level-Up modal, and the reasoning popup have all landed here since the last review.
- `SettingsPage.tsx` is **53,624 bytes** — the second-largest file in the codebase, managing Strava OAuth, Google Calendar, Oura, Apple Health, rider profile, and notification settings in a single component.
- `ChatPage.tsx` (36,141 bytes) and `DashboardPage.tsx` (33,996 bytes) are both individually large enough to warrant future extraction.
- The 142-test suite covers utility functions well but critical service layer files (`trainingPlansService.ts`, `healthMetricsService.ts`) remain largely untested.

---

### Updated Tier 1 — High-Impact, Quick Wins

---

#### 1.1 Encrypt OAuth Tokens at Rest *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt. This remains the highest-priority open security item.

**Estimated Effort:** 2–3 days | **Expected Impact:** High security

---

#### 1.2 React Query Cache Invalidation After Mutations ✅ **COMPLETED** (June 1, 2026)

See the May 31 entry above for full description. Completed via two new hook files:
- `src/hooks/usePlanMutations.ts` — 7 exported mutation hooks covering workout status toggle, plan CRUD, and workout CRUD, each with proper `invalidateQueries` calls.
- `src/hooks/useProfileMutations.ts` — 2 exported mutation hooks (`useSaveUserProfile`, `useSaveRiderProfile`) that invalidate `['dashboard-data']` on success.

**Estimated Effort:** 1 day | **Expected Impact:** High usability

---

#### 1.3 SettingsPage Modularization (53 KB)

**Description:** `SettingsPage.tsx` at 53,624 bytes is effectively a second monolith alongside `PlansPage.tsx`. It manages six entirely separate concerns in one file: Strava OAuth connection, Google Calendar integration, Oura Ring setup, Apple Health sync, rider profile (FTP, weight, zones), and notification preferences. Each section involves its own Edge Function calls, form state, and mutation logic. Splitting these into focused sub-components reduces merge-conflict risk and makes each integration independently testable — a prerequisite for safely adding the OAuth token encryption work from 1.1.

**Estimated Effort:** 2–3 days  
**Expected Impact:** Medium — reduces the second-largest source of merge conflicts; unblocks component-level testing of OAuth flows; improves code review quality on all future settings changes.

**Agent Prompt:**
> Refactor `src/pages/SettingsPage.tsx` in TrainingSmart without changing any visible behavior or styling. Extract the following self-contained sections into `src/components/settings/` sub-components: (1) `StravaConnectionCard.tsx` — Strava OAuth connect/disconnect UI and token status; (2) `GoogleCalendarCard.tsx` — Google Calendar sync enable/disable; (3) `OuraIntegrationCard.tsx` — Oura Ring token entry and sync status; (4) `AppleHealthCard.tsx` — Apple Health sync toggle and last-sync display; (5) `RiderProfileForm.tsx` — FTP, weight, training zones form with save mutation; (6) `NotificationPrefsCard.tsx` — notification toggles. `SettingsPage.tsx` should become a thin layout component under 150 lines that composes these sub-components. Pass shared state (userId, queryClient) via props. Verify CI passes and all 142 existing tests still pass after the refactor.

---

### Updated Tier 2 — Medium-Impact, Moderate Effort

---

#### 2.1 Increase Test Coverage to 50%+ on Core Services *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt. The CI pipeline is now in place, making this work immediately runnable and measurable.

**Estimated Effort:** 1–2 weeks | **Expected Impact:** High long-term

---

#### 2.2 Split Monolithic PlansPage.tsx (Now 83 KB) *(Carried Forward — Status: Open, Worsened)*

See the May 31 entry above for full description and agent prompt. The file has grown from the ~1,382-line estimate to 83,947 bytes. Priority is elevated — this is now the most urgent maintainability issue in the codebase.

**Estimated Effort:** 3–5 days | **Expected Impact:** Medium-High

---

#### 2.3 Structured Error Monitoring with Sentry *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt.

**Estimated Effort:** 2 days | **Expected Impact:** Medium

---

#### 2.4 Eliminate TypeScript `any` in Critical Service Files

**Description:** The previous risk review identified 214 `any` instances across the codebase. In service files like `trainingPlansService.ts` (930 lines), `any` types mask incorrect data shapes passed between AI plan generation and database inserts — a source of hard-to-debug runtime errors. Eliminating `any` in the three highest-traffic service files by replacing with proper interface types (from the Supabase-generated schema types) will surface existing type mismatches and prevent new ones from landing silently.

**Estimated Effort:** 2–3 days  
**Expected Impact:** Medium — prevents a class of silent runtime errors in the plan generation flow; improves IDE autocompletion quality; contributes meaningfully to the overall ~214-instance technical debt reduction.

**Agent Prompt:**
> Eliminate TypeScript `any` types from the three highest-priority service files in TrainingSmart: `src/services/trainingPlansService.ts`, `src/services/healthMetricsService.ts`, and `src/services/stravaApi.ts`. For each file: (1) run `npx tsc --noEmit` and note existing `any`-related suppressions; (2) replace explicit `any` parameter and return types with proper interfaces imported from `src/types/index.ts` or from the Supabase-generated `database.types.ts` (for database row types); (3) where the correct type is genuinely unknown (e.g., raw JSON from an external API), use `unknown` with a type guard or a narrow inline type assertion. Do not change any runtime logic — only type annotations. Enable `"strict": true` in `tsconfig.app.json` if not already set and fix any newly surfaced errors in these three files only. Verify `npx tsc --noEmit` exits clean and CI passes.

---

### Updated Tier 3 — Strategic, Longer-Term

---

#### 3.1 Curation Feed Phase 2 — RSS/Article Integration *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt.

**Estimated Effort:** 2–3 weeks | **Expected Impact:** High long-term

---

#### 3.2 Recurring Season Schedules *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt.

**Estimated Effort:** 2–3 weeks | **Expected Impact:** High long-term

---

#### 3.3 Accessibility Audit and WCAG 2.1 AA Remediation *(Carried Forward — Status: Open)*

See the May 31 entry above for full description and agent prompt.

**Estimated Effort:** 1–2 weeks | **Expected Impact:** Medium
