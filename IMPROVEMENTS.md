# Improvements
_Last assessment: 2026-06-07_
_Last knowledge sync: 2026-06-07_
_Assessment based on: git log (last 30 commits — no new commits since the June 6 reassessment merge, PR #26), all PRs (state=all; PR #26 merged June 6, no PRs opened or merged since, no open PRs), open issues (none), PRD.md re-read for scope/status context, and fresh code inspection: `ErrorBoundary.tsx` (Sentry stub comment still present, unchanged), `PlansPage.tsx`/`SettingsPage.tsx` (84,727 / 53,721 bytes — byte-for-byte unchanged since June 6, `settings/` still only 2 components), `trainingPlansService.ts` (still 8 `: any` usages), and — critically — a from-scratch audit of the actual test suite (`find src/services -name '*.test.ts'`, reading each file's `describe`/`it` blocks and counting service files) that surfaced material inaccuracies in the long-standing 2.2 test-coverage write-up (see correction below)._

---

## Current Sprint
None — ready for next implementation run

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Wire Mutation Hooks Into PlansPage and SettingsPage (Tier 1.2) | 2026-06-05 | PR #25 merged — all 6 plan mutation hooks wired into PlansPage; `useSaveUserProfile` wired into SettingsPage; dashboard now invalidated on profile saves |
| Pause OAuth Encryption (document blockers) | 2026-06-05 | PR #24 merged — architectural blockers documented; token-write ownership must move to Edge Functions before encryption; pgsodium availability must be verified |
| React Query Cache Invalidation | 2026-06-01 | PR #18 merged — `usePlanMutations.ts` + `useProfileMutations.ts` created |
| Route-Level Code Splitting | 2026-06-02 | PR #20 merged (`ed6eaad`) — all 7 pages lazy-loaded via `React.lazy()` + `Suspense` |

---

## Tier 1 — Quick Wins

### 1.1 Encrypt OAuth Tokens at Rest — PAUSED — ⚠️ NEEDS HUMAN DECISION
- **What:** Strava access/refresh tokens are stored as plaintext `text` columns in `user_tokens` (confirmed in `20251030151139_*` migration). The `strava-oauth-exchange` function returns them directly to the client and the frontend writes them back without encryption. **This item has now appeared in every assessment since May 31 — 7 consecutive assessments without movement. It remains the only P2 security risk unmitigated in this codebase.**
- **Why now:** If the Supabase project credentials were exposed, every user's Strava and Google Calendar access would be immediately compromised. Once complete, token refresh centralization (see Dropped/Stale) should be batched into the same PR or done immediately after.
- **Why it's stuck (and why that's OK):** Unlike this codebase's other stale items, this one isn't stalled for lack of effort or priority — it's blocked on two things genuinely outside an autonomous agent's reach: (1) a **product/architecture decision** on whether token DB writes move from the browser into Edge Functions (a real design tradeoff, not a mechanical choice), and (2) **pgsodium/Supabase Vault availability**, which can only be confirmed by checking the live Supabase Dashboard — `CREATE EXTENSION IF NOT EXISTS pgsodium` silently "succeeds" even when the extension isn't actually available, so a code-only attempt risks shipping a migration that fails in production. **Recommend the project owner spend 10 minutes confirming pgsodium availability in the Supabase Dashboard (Database → Extensions) and greenlighting the token-ownership move** — once those two human inputs land, this is ready to implement immediately from the plan already written in PR #24.
- **Pause reason (documented 2026-06-05, unchanged):** Implementation plan written and reviewed. Two blockers identified: (1) the correct approach requires an **architectural change** first — moving all token DB writes from the browser into Edge Functions (the browser currently owns `tokenStorageService.setTokens()` writes for all providers); pgsodium column encryption is layered on top of that, not a standalone change. (2) **pgsodium availability** cannot be confirmed without running the migration against the live Supabase project — `CREATE EXTENSION IF NOT EXISTS pgsodium` will silently succeed but subsequent `pgsodium.create_key()` calls will fail if the extension isn't in `pg_available_extensions`. Resume when (a) the architectural decision on token ownership has been confirmed, and (b) pgsodium / Supabase Vault availability has been verified in the Supabase Dashboard.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "In `supabase/functions/strava-oauth-exchange/index.ts` and `supabase/functions/strava-refresh-token/index.ts`, add token encryption using Supabase Vault (`pgsodium`). Create a new migration that: (1) enables `create extension if not exists pgsodium`; (2) creates a named encryption key via `pgsodium.create_key('oauth_tokens')`; (3) alters `user_tokens` to add `refresh_token_enc bytea` and `access_token_enc bytea` alongside the existing text columns. Update `strava-oauth-exchange` to accept a user JWT, encrypt tokens with pgsodium, write directly to DB via service_role, and return only `{ access_token, expires_at, athlete }` to the browser (never refresh_token). Update `strava-refresh-token` to accept user JWT only (no refresh_token in request body), read + decrypt refresh_token from DB via service_role, call Strava, encrypt new tokens, write back, return only `{ access_token, expires_at }`. Create a new `get-strava-token` Edge Function that decrypts and returns the access token for browser API calls. Update `tokenStorageService.getTokens('strava')` to call `get-strava-token` instead of querying the DB directly (plaintext column will no longer exist). Remove all `tokenStorageService.setTokens('strava')` calls from `stravaApi.ts` — Edge Functions own DB writes. Write a one-time backfill migration that encrypts existing plaintext rows and then drops the old text columns. **After this PR merges**, create `src/services/tokenRefreshService.ts` exporting `refreshOAuthToken({ provider: 'strava' | 'google', userId: string }): Promise<string>` and remove duplicated refresh logic from `src/services/stravaApi.ts`. Acceptance criteria: `user_tokens.access_token` text column no longer exists; tokens returned to the browser during OAuth exchange are still functional access tokens (not ciphertext); `strava-refresh-token` successfully refreshes a live token end-to-end."

---

### 1.3 Integrate Sentry Error Monitoring — OPEN
- **What:** `ErrorBoundary.tsx` has a code comment explicitly noting "replace with Sentry/monitoring in production (item #14)" — Sentry has never been added (confirmed June 6: comment still present in `componentDidCatch`). There are 200+ `console.error`/`console.warn` calls across 49 files that are invisible in production. When an Edge Function fails, a Strava sync crashes, or a render error is caught, there is zero alerting.
- **Why now:** With code splitting live (PR #20) and mutation hooks now wired (PR #25), lazy-loaded chunks that fail to load and mutation failures that hit error boundaries are silently swallowed with no production visibility. The `ErrorBoundary` integration point is explicitly stubbed — install is mechanical. This is the clear next T1 sprint item.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Integrate Sentry into TrainingSmart. Run `npm install @sentry/react`. Initialize Sentry in `src/main.tsx` with `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE, tracesSampleRate: 0.1, integrations: [Sentry.browserTracingIntegration()] })`. In `src/components/common/ErrorBoundary.tsx`, replace the `console.error` in `componentDidCatch` with `Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } })` — keep the console.error as a secondary call for local dev. In the top 10 files by `console.error` count (start with `trainingPlansService.ts`, `openaiApi.ts`, `stravaApi.ts`), add `Sentry.captureException(error, { extra: { context: '<service>/<operation>' } })` alongside existing console calls. Add `VITE_SENTRY_DSN=` to `.env.example` with a comment. Do not add Sentry to Edge Functions — their errors are surfaced via Supabase logs. Acceptance criteria: a deliberate `throw new Error('test')` in `ErrorBoundary` dev mode appears in the Sentry dashboard."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (84 KB) — OPEN
- **What:** `PlansPage.tsx` is 84,727 bytes — confirmed byte-for-byte unchanged since June 6 (no commits have touched it this cycle). Despite several sub-components in `src/components/plans/`, the main page file still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal. It is the most-changed file in the repo's history.
- **Why now:** The file has grown across all seven previous assessments without extraction. Every new feature landed here because there was no better abstraction. Splitting it is a prerequisite for safely adding component-level tests.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. The `src/components/plans/` directory already has DraggableWorkoutCard, DroppableDayColumn, WeeklyPlanView, PlanLogicViewer, etc. — extract the remaining inline sections: (1) `src/components/plans/PlanListSidebar.tsx` — the left-rail list of training plans with expand/collapse and delete actions; (2) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal; (3) `src/components/plans/PlanStatsDrawer.tsx` — the collapsible cumulative plan stats panel; (4) `src/components/plans/CreatePlanForm.tsx` — the plan creation flow including AI generation prompt and template picker. Move associated state and handlers into each sub-component or a new `src/hooks/usePlanPage.ts` hook that `PlansPage.tsx` uses. Target: `PlansPage.tsx` under 300 lines, orchestrating composition only. Verify CI passes and all 142 existing tests still pass."

---

### 2.2 Increase Test Coverage on Core Calculation Services — OPEN _(description corrected June 7 — see note)_
- **What:** **Correction to a long-carried inaccuracy:** prior assessments described this as "~10–15% coverage across 50+ service files" with `trainingPlansService.test.ts` "only testing `calculateMatchConfidence`" and streak/plan-generation logic having "no branch-level tests." A from-scratch audit this cycle found that's no longer (and may never have been) accurate: there are **24** service files, **6** already have suites (`trainingPlansService`, `healthMetricsService`, `streakService`, `openaiApi`, `onboardingService`, `recommendationService` — 133 `it()` cases total), `trainingPlansService.test.ts` (313 lines) also covers `createPlanFromTemplate`, `healthMetricsService.test.ts` (238 lines) covers ACWR load/consistency/endurance/intensity/junk-miles/profile-level derivation, and `streakService.test.ts` already covers init/freeze-consumption/reset boundaries. The **genuine** remaining gap is narrower and more specific: `riderProfileService.ts` (311 lines — owns FTP and training-zone derivation via `calculateProfile()`) and `healthMetricsService.calculateBiologicalReadiness()` (the user-facing daily "readiness" band/status) have **zero** tests, and neither requires Supabase mocking — both are pure calculation functions.
- **Why now:** `riderProfileService` and `calculateBiologicalReadiness` compute numbers users see on their dashboard every single day (FTP, training zones, readiness status) — exactly the "data-driven context" the PRD names as the product's core value proposition. A silent regression here is immediately visible to users and erodes trust fast. They're also the cheapest possible tests to add: pure functions, fixed synthetic inputs, no mocking — far less setup than the DB-backed service tests already written.
- **Effort estimate:** M (3–5 days for the two genuine gaps; L if extending further into integration-adjacent services)
- **Actual effort:** —
- **Agent prompt:** "Add Vitest unit tests for the two highest-value untested calculation paths in TrainingSmart — both are pure functions requiring no Supabase mocking. (1) Create `src/services/riderProfileService.test.ts` and test `RiderProfileService.calculateProfile()` with fixed synthetic `(activities, load, consistency, ftp)` inputs covering at least 3 cases: a high-FTP/high-consistency input that should yield an 'Advanced'-tier profile, a low-FTP/erratic-consistency input that should yield 'Beginner', and one boundary case between adjacent tiers. (2) In `src/services/healthMetricsService.test.ts`, add a `describe('calculateBiologicalReadiness')` block with fixed synthetic HRV/RHR/sleep inputs that produce known expected `status` values (e.g., 'Good' vs. 'Compromised') — cover at least the boundary transition between two adjacent statuses. Once both are green, do a lighter pass adding `src/services/tokenStorageService.test.ts` covering `getTokens`/`setTokens` happy-path and not-found cases via `vi.mock('./supabaseClient')`. Run `npm run test:coverage` and report the before/after percentage."

---

### 2.3 SettingsPage Modularization (1,118 Lines, 53 KB) — OPEN
- **What:** `SettingsPage.tsx` is 53,721 bytes (confirmed June 6 — unchanged) managing six independent concerns in one file: Strava OAuth, Oura Ring integration, coach prompt customization, content interests, rider profile, and notification settings. `src/components/settings/` currently only contains `CoachSpecializationSelector.tsx` and `Integrations.tsx` — partial prior extraction did not complete the job.
- **Why now:** Every integration addition (Oura, Google Calendar, Apple Health) has landed in this one file. It blocks safe testing of OAuth flows and is the second-largest file in the codebase. With `useSaveUserProfile` now wired (PR #25), hooks are available — modularization can proceed cleanly.
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
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments. Accessibility is a correctness concern — schedule after PlansPage split (2.1) is complete, since that refactor is a prerequisite for per-component ARIA work.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart. Install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; run `npx eslint src/ --fix` and fix all auto-fixable violations. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, and focus trapping via a `useFocusTrap` hook; (2) drag-and-drop workout cards — add `role='button'`, `aria-grabbed` state, and arrow-key keyboard support; (3) icon-only buttons — add descriptive `aria-label`; (4) Recharts charts — wrap in `<figure>` with `aria-label` text summary. Install `@axe-core/react` in dev mode only for regression catching."

---

## Tier 3 — Strategic

_No active Tier 3 items. All previous items were either escalated to Tier 2 or dropped._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Centralize Token Refresh Logic (was 3.1)** | Blocked by 1.1 (OAuth token encryption) which itself is PAUSED. Removed as a standalone item — consolidated into 1.1's agent prompt as a mandatory follow-on. Will re-emerge as a discrete Tier 1 item the moment 1.1 merges. |
| **Recurring Season Schedules (was 3.3)** | XL effort (3–4 weeks), appeared 5 consecutive assessments with zero traction and no start. Revisit when performance athlete segment reaches scale warranting the investment. |
