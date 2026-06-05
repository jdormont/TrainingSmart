# Improvements
_Last assessment: 2026-06-05_
_Last knowledge sync: 2026-06-05_
_Assessment based on: git log (last 30 commits), all PRs (none open), open issues (none). No commits since June 4 assessment. Tier 3 staleness decisions applied this cycle (all 4 items appeared in 5+ consecutive assessments): 3.1 (Token Refresh) dropped — blocked by 1.1, consolidated into 1.1's agent prompt; 3.2 (Curation Feed) escalated to Tier 2 — genuine session-depth value; 3.3 (Season Schedules) dropped as stale — XL effort, zero traction across 5 assessments; 3.4 (Accessibility) escalated to Tier 2 — correctness concern, can no longer defer._

---

## Current Sprint
None — ready for next implementation run

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| React Query Cache Invalidation | 2026-06-01 | PR #18 merged — `usePlanMutations.ts` + `useProfileMutations.ts` created |
| Route-Level Code Splitting | 2026-06-02 | PR #20 merged (`ed6eaad`) — all 7 pages lazy-loaded via `React.lazy()` + `Suspense` |

---

## Tier 1 — Quick Wins

### 1.1 Encrypt OAuth Tokens at Rest — OPEN
- **What:** Strava access/refresh tokens are stored as plaintext `text` columns in `user_tokens` (confirmed in `20251030151139_*` migration). The `strava-oauth-exchange` function returns them directly to the client and the frontend writes them back without encryption. `pgsodium`/Supabase Vault is not enabled. **This item has appeared in every assessment since May 31 — 5 consecutive assessments without movement. It is the only P2 security risk remaining unmitigated in this codebase.**
- **Why now:** If the Supabase project credentials were exposed, every user's Strava and Google Calendar access would be immediately compromised. Once complete, token refresh centralization (see Dropped/Stale) should be batched into the same PR or done immediately after.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "In `supabase/functions/strava-oauth-exchange/index.ts` and `supabase/functions/strava-refresh-token/index.ts`, add token encryption using Supabase Vault (`pgsodium`). Create a new migration that: (1) enables `create extension if not exists pgsodium`; (2) creates a named encryption key via `pgsodium.create_key('oauth_tokens')`; (3) alters `user_tokens` to add `refresh_token_enc bytea` and `access_token_enc bytea` alongside the existing text columns. Update `strava-oauth-exchange` to call `pgsodium.crypto_aead_det_encrypt()` before writing tokens to Supabase (the Edge Function has Vault access; the browser never touches the key). Update `strava-refresh-token` to decrypt on read using `pgsodium.crypto_aead_det_decrypt()`. Write a one-time backfill migration that encrypts existing plaintext rows and then drops the old text columns. **After this PR merges**, create `src/services/tokenRefreshService.ts` exporting `refreshOAuthToken({ provider: 'strava' | 'google', userId: string }): Promise<string>` and remove duplicated refresh logic from `src/services/stravaApi.ts`. Acceptance criteria: `user_tokens.access_token` text column no longer exists; tokens returned to the browser during OAuth exchange are still functional access tokens (not ciphertext); `strava-refresh-token` successfully refreshes a live token end-to-end."

---

### 1.2 Wire Mutation Hooks Into PlansPage (Orphaned Code) — OPEN
- **What:** `usePlanMutations.ts` and `useProfileMutations.ts` (created in PR #18) are not imported by any component. Confirmed: `PlansPage.tsx` imports `trainingPlansService` directly (verified June 4 — no import from `usePlanMutations`). `PlansPage.tsx` still calls service methods directly and manually fires `queryClient.invalidateQueries()` inline at five separate call sites. The hooks are production-ready but simply not wired in — a day's work to complete the original PR #18 intent.
- **Why now:** The mutation hook work was shipped to solve stale-cache bugs, but because components were never updated to use the hooks, users are still relying on the ad-hoc inline invalidation, which is inconsistent and misses some paths (e.g., workout deletion in certain flows). This is a low-effort fix with direct reliability payoff.
- **Effort estimate:** S (half day)
- **Actual effort:** —
- **Agent prompt:** "In `src/pages/PlansPage.tsx`, replace all direct `trainingPlansService.updateWorkoutStatus()`, `trainingPlansService.createPlan()`, `trainingPlansService.deletePlan()`, `trainingPlansService.addWorkoutToPlan()`, `trainingPlansService.updateWorkout()`, and `trainingPlansService.deleteWorkout()` call sites with the corresponding hooks from `src/hooks/usePlanMutations.ts` (`useToggleWorkoutComplete`, `useCreatePlan`, `useDeletePlan`, `useAddWorkout`, `useUpdateWorkout`, `useDeleteWorkout`). Remove the five manual `queryClient.invalidateQueries({ queryKey: ['plan-data'] })` inline calls — cache invalidation is now handled by each hook's `onSuccess`. Similarly, update `src/pages/SettingsPage.tsx` to use `useSaveUserProfile` and `useSaveRiderProfile` from `src/hooks/useProfileMutations.ts` instead of direct service calls. Verify all 142 existing tests still pass and that toggling a workout completion in the UI immediately updates the plan list without a manual refresh."

---

### 1.3 Integrate Sentry Error Monitoring — OPEN
- **What:** `ErrorBoundary.tsx` has a code comment explicitly noting "replace with Sentry/monitoring in production (item #14)" — Sentry has never been added (confirmed June 4: comment still present in `componentDidCatch`). There are 200+ `console.error`/`console.warn` calls across 49 files that are invisible in production. When an Edge Function fails, a Strava sync crashes, or a render error is caught, there is zero alerting.
- **Why now:** With code splitting now live (PR #20), lazy-loaded chunks that fail to load will be silently caught by `ErrorBoundary` with no visibility. Sentry installation is mechanical and the codebase already has the `ErrorBoundary` integration point explicitly stubbed.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Integrate Sentry into TrainingSmart. Run `npm install @sentry/react`. Initialize Sentry in `src/main.tsx` with `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, tracesSampleRate: 0.1, integrations: [Sentry.browserTracingIntegration()] })`. In `src/components/common/ErrorBoundary.tsx`, replace the `console.error` in `componentDidCatch` with `Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })` — keep the console.error as a secondary call for local dev. In the top 10 files by `console.error` count (start with `trainingPlansService.ts`, `openaiApi.ts`, `stravaApi.ts`), add `Sentry.captureException(error, { extra: { context: '<service>/<operation>' } })` alongside existing console calls. Add `VITE_SENTRY_DSN=` to `.env.example` with a comment. Do not add Sentry to Edge Functions — their errors are surfaced via Supabase logs. Acceptance criteria: a deliberate `throw new Error('test')` in `ErrorBoundary` dev mode appears in the Sentry dashboard."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (83 KB) — OPEN
- **What:** `PlansPage.tsx` is 83,947 bytes and growing. Despite several sub-components being in `src/components/plans/` (WorkoutCard, WeeklyPlanView, etc.), the main page file still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, the Post-Workout Check-in modal, and all Strava activity matching. It is the most-changed file in the repo and the largest source of merge conflicts.
- **Why now:** The file has grown across all five previous assessments without extraction. Every new feature (plan templates, activity matching, Level-Up) landed in this file because there was no better abstraction. Splitting it is a prerequisite for safely adding component-level tests.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. The `src/components/plans/` directory already has DraggableWorkoutCard, DroppableDayColumn, WeeklyPlanView, PlanLogicViewer, etc. — extract the remaining inline sections: (1) `src/components/plans/PlanListSidebar.tsx` — the left-rail list of training plans with expand/collapse and delete actions; (2) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal; (3) `src/components/plans/PlanStatsDrawer.tsx` — the collapsible cumulative plan stats panel; (4) `src/components/plans/CreatePlanForm.tsx` — the plan creation flow including AI generation prompt and template picker. Move associated state and handlers into each sub-component or a new `src/hooks/usePlanPage.ts` hook that `PlansPage.tsx` uses. Target: `PlansPage.tsx` under 300 lines, orchestrating composition only. Verify CI passes and all 142 existing tests still pass."

---

### 2.2 Increase Test Coverage to 50%+ on Core Services — OPEN
- **What:** Test coverage is approximately 10–15% across 50+ service files. `trainingPlansService.test.ts` exists but only tests `calculateMatchConfidence`. `healthMetricsService.test.ts` exists but scope is limited. Critical paths — FTP calculation, readiness score derivation, plan generation logic, streak calculation — have no branch-level tests.
- **Why now:** The CI pipeline is in place and actively running on every push. The infrastructure is ready; it's just the test cases that are missing. A regression in `trainingPlansService` or `healthMetricsService` is currently invisible until a user reports broken data.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Expand test coverage in TrainingSmart across three priority service files. (1) `src/services/trainingPlansService.test.ts` — add tests for `createPlan()` with at least 3 goal/activity type combinations using `vi.mock()` to stub Supabase; test `deletePlan()` success and error paths; test the Level-Up 21-day streak threshold logic. (2) `src/services/healthMetricsService.test.ts` — add tests for FTP calculation, HRV scoring, and readiness score derivation using fixed synthetic input datasets that produce known expected outputs (e.g. HRV of 65ms + resting HR of 52bpm → specific readiness band). (3) `src/services/streakService.test.ts` — verify streak start/stop boundary conditions and the exact day-count threshold that triggers Level-Up eligibility. Use `vi.mock('./supabaseClient')` to stub all DB calls. Run `npm run test:coverage` and confirm overall coverage moves above 30% as a milestone toward 50%."

---

### 2.3 SettingsPage Modularization (1,118 Lines, 53 KB) — OPEN
- **What:** `SettingsPage.tsx` is 1,118 lines managing six independent concerns in one file: Strava OAuth, Oura Ring integration, coach prompt customization, content interests, rider profile, and notification settings. `src/components/settings/` currently only contains `CoachSpecializationSelector.tsx` and `Integrations.tsx` — partial prior extraction did not complete the job.
- **Why now:** Every integration addition (Oura, Google Calendar, Apple Health) has landed in this one file. It is the second-largest file in the codebase and blocks safe testing of OAuth flows. Completing modularization is also a prerequisite for cleanly wiring in the `useProfileMutations` hooks from item 1.2.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. The `src/components/settings/` directory already has `CoachSpecializationSelector.tsx` and `Integrations.tsx` — extract the remaining sections: (1) `StravaConnectionCard.tsx` — Strava OAuth connect/disconnect UI, athlete display, cache refresh; (2) `OuraIntegrationCard.tsx` — Oura token entry, connection status, disconnect; (3) `RiderProfileForm.tsx` — FTP, weight, training zones with save button; use `useSaveRiderProfile` from `useProfileMutations.ts`; (4) `ContentInterestsCard.tsx` — the interest tag grid with save. `SettingsPage.tsx` should become a layout shell under 150 lines composing these sub-components. Pass shared auth state (userId) via props. Run `npm run typecheck` and verify all 142 tests still pass."

---

### 2.4 Eliminate TypeScript `any` in Critical Service Files — OPEN
- **What:** There are 34 `: any` usages across `src/` (8 in `trainingPlansService.ts`, plus scattered usage in `openaiApi.ts`, `DashboardPage.tsx`, `PlansPage.tsx`). The most dangerous ones are `dbPayload: any` and `data as any[]` patterns that can silently mask DB response shape mismatches.
- **Why now:** Every new feature that touches the plan or dashboard code perpetuates `any` by copying existing patterns. Fixing the 8 in `trainingPlansService.ts` first establishes the correct typing for the highest-risk file.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate all TypeScript `any` usages in `src/services/trainingPlansService.ts`. Run `grep -n ': any' src/services/trainingPlansService.ts` to get the full list (currently 8 occurrences). For each: replace `dbPayload: any` with a typed `DbWorkoutInsert` interface matching the Supabase table schema; replace `(data as any[]).map(row => ...)` with a typed `DbPlanRow` interface derived from the migration columns; replace `(workout as any).scheduledDate` with a proper union type or type guard. After the service is clean, run the same process on `src/services/openaiApi.ts` (1 occurrence) and the `any` usages in `src/pages/PlansPage.tsx` (inline `queryClient.setQueryData` cast). Run `npm run typecheck` with `strict: true` to verify zero `any` errors in these files. Do not touch other files in this PR."

---

### 2.5 Curation Feed Phase 2 — RSS/Article Integration — OPEN _(escalated from Tier 3)_
- **What:** The Curation Feed shows YouTube videos (Phase 1 complete). Phase 2 (RSS-parsed article feeds from cycling/running publications) and Phase 3 (ML affinity recommendations) are listed as incomplete in the PRD. `contentFeedService.ts` is already 38KB, indicating Phase 1 was substantial.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments without movement. Genuine product value — increases session depth and differentiates TrainingSmart from generic training apps. Start only after Tier 1 items are resolved.
- **Effort estimate:** L (2–3 weeks)
- **Actual effort:** —
- **Agent prompt:** "Implement Curation Feed Phase 2. Create a Supabase Edge Function `rss-feed-proxy` that accepts `?tag=cycling|running|triathlon`, fetches and parses RSS/Atom feeds from a hardcoded list of publications (VeloNews, Outside, TrainingPeaks Blog, Canadian Cycling Magazine), and returns normalized `{title, url, imageUrl, source, publishedAt, tags}` objects. Cache results in a new `content_cache(tag text, payload jsonb, cached_at timestamptz)` table for 1 hour. In the frontend, add an 'Articles' tab to the existing `ContentFeed` component alongside 'Videos'. Add a `liked_content(user_id uuid, content_url text, signal text, created_at timestamptz)` table as Phase 3 foundation; add thumbs up/down buttons to article cards."

---

### 2.6 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(escalated from Tier 3)_
- **What:** No ARIA labels, keyboard navigation, or focus management were observed. The drag-and-drop workout cards and Recharts power zone chart are the highest-risk areas for screen readers and keyboard-only users. This is risk item #19 from the original risk review.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments. Accessibility is a correctness concern, not just a quality concern — it cannot be deferred indefinitely. Schedule after PlansPage split (2.1) is complete, since that refactor is a prerequisite for per-component ARIA work.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart. Install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; run `npx eslint src/ --fix` and fix all auto-fixable violations. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, and focus trapping via a `useFocusTrap` hook; (2) drag-and-drop workout cards — add `role='button'`, `aria-grabbed` state, and arrow-key keyboard support; (3) icon-only buttons — add descriptive `aria-label`; (4) Recharts charts — wrap in `<figure>` with `aria-label` text summary. Install `@axe-core/react` in dev mode only for regression catching."

---

## Tier 3 — Strategic

_No active Tier 3 items. Previous items were either escalated to Tier 2 or dropped this cycle._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Centralize Token Refresh Logic (was 3.1)** | Blocked by 1.1 (OAuth token encryption) which has itself been open for 5 assessments. Removed as a standalone item — consolidated into 1.1's agent prompt as a mandatory follow-on. Will re-emerge as a discrete Tier 1 item the moment 1.1 merges. |
| **Recurring Season Schedules (was 3.3)** | XL effort (3–4 weeks), appeared 5 consecutive assessments with zero traction and no start. Revisit when performance athlete segment reaches scale warranting the investment. |
