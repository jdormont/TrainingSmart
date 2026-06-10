# Improvements
_Last assessment: 2026-06-10_
_Last knowledge sync: 2026-06-10_
_Assessment based on: git log since the June 7 reassessment (PR #28 "Integrate Sentry error monitoring" merged June 7/8; plus the out-of-band feature merge `75babea`/`aa70d7f`/`0e47aea` "consistency-improvement: dashboard de-duplication & hierarchy" merged June 7, and `4ee1bca` adding CLAUDE.md — neither was previously tracked here), all PRs (state=all, 28 total, PR #28 is the most recent, no PRs opened since, no open PRs), open issues (none — `mcp__github__list_issues` returns empty), PRD.md re-read for scope/status context, and fresh code inspection: `main.tsx`/`ErrorBoundary.tsx` (Sentry confirmed live — `@sentry/react` in `package.json`, `Sentry.init` present, `Sentry.captureException` in `componentDidCatch`), `PlansPage.tsx` (1,803 lines / 84,727 bytes — still byte-for-byte unchanged), `SettingsPage.tsx` (1,120 lines / 53,721 bytes — unchanged, `settings/` still only `CoachSpecializationSelector.tsx` + `Integrations.tsx`), `trainingPlansService.ts` (1,427 lines, still 8 `: any`, 34 total in `src/`), `riderProfileService.test.ts` (still does not exist; no `calculateBiologicalReadiness` describe block in `healthMetricsService.test.ts`), and a full read-through of the rewritten `ConsistencyHeatmap.tsx` (563 lines, now imports `supabase` directly and renders 112 interactive grid cells with `onClick`/`onMouseEnter`/`onMouseLeave` handlers and zero `role`/`tabIndex`/`aria-*`/keyboard support)._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment (`ERR_MODULE_NOT_FOUND` for `eslint`/`vitest`/`@vitejs/plugin-react`). Test-suite status (142 tests passing) and lint/typecheck baselines are carried forward from PR #28's verification, the most recent confirmed run._

---

## Current Sprint
None — ready for next implementation run

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Integrate Sentry Error Monitoring (Tier 1.3) | 2026-06-08 | **PR #28 merged.** `@sentry/react` initialized in `main.tsx` (no-ops without `VITE_SENTRY_DSN`); `ErrorBoundary.componentDidCatch` now reports to Sentry with React component-stack context; outer catch-all boundaries instrumented in `trainingPlansService.ts` (13 sites), `supabaseChatService.ts` (6 sites), `ouraApi.ts` (6 sites) — 25 `Sentry.captureException` calls total, each tagged `extra: { context: '<service>/<function>' }`. Confirmed present in working tree this cycle. See closing notes below for scope corrections vs. the original prompt. |
| Wire Mutation Hooks Into PlansPage and SettingsPage (Tier 1.2) | 2026-06-05 | PR #25 merged — all 6 plan mutation hooks wired into PlansPage; `useSaveUserProfile` wired into SettingsPage; dashboard now invalidated on profile saves |
| Decide on OAuth Token Encryption (1.1) | 2026-06-07 | **Resolved as WON'T FIX** — project owner decided not to pursue this after 7 consecutive assessments stuck on a human-only architecture decision + pgsodium availability check. Moved to Dropped/Stale; no longer tracked as an open item. Plan remains in PR #24 for future reference. |
| Pause OAuth Encryption (document blockers) | 2026-06-05 | PR #24 merged — architectural blockers documented; token-write ownership must move to Edge Functions before encryption; pgsodium availability must be verified |
| React Query Cache Invalidation | 2026-06-01 | PR #18 merged — `usePlanMutations.ts` + `useProfileMutations.ts` created |
| Route-Level Code Splitting | 2026-06-02 | PR #20 merged (`ed6eaad`) — all 7 pages lazy-loaded via `React.lazy()` + `Suspense` |
| Dashboard de-duplication & hierarchy (out-of-band feature work) | 2026-06-07 | Merged directly to `main` (commits `aa70d7f` + `0e47aea`, merge `75babea`) — not an IMPROVEMENTS.md item, but noted because it substantially rewrote `ConsistencyHeatmap.tsx` (now 563 lines) and touched `AnalyticsContainer.tsx`, `DashboardHero.tsx`, `SmartWorkoutPreview.tsx`, `TodaysFocusCard.tsx`, `DashboardPage.tsx`. This rewrite introduced two new findings tracked below: (a) the heatmap now imports `supabase` directly, breaking the services-layer convention (new Tier 1 item 1.1), and (b) its 112 new interactive grid cells have zero accessibility affordances (new Tier 1 item 1.2, scoped narrower than the full 2.6 audit). |

**Closing notes for 1.3 (Sentry Error Monitoring):**
- **Actual effort:** S — under a day, in line with the estimate.
- **Scope correction vs. original prompt:** the agent prompt named `openaiApi.ts`/`stravaApi.ts` as top-`console.error`-count files alongside `trainingPlansService.ts`. A fresh count showed those two have only 4 calls each (not top-10); the genuinely highest-count files are `trainingPlansService.ts` (38), `supabaseChatService.ts` (17), and `ouraApi.ts` (12) — these three were instrumented instead.
- **Instrumentation strategy:** rather than wrapping all ~67 individual `console.error` call sites across those three files (which would have ballooned an "S" item and produced duplicate Sentry events for the same error as it bubbles through nested catches), only the **outer catch-all boundary per function** was instrumented — 25 sites total (13 + 6 + 6), each with `Sentry.captureException(error, { extra: { context: '<service>/<function>' } })` placed immediately before the existing `console.error`, which is preserved for local-dev visibility.
- **Verification:** `npm run lint` → 0 new issues (44 pre-existing warnings, confirmed identical via `git stash`/re-run/`git stash pop`); `tsc --noEmit -p tsconfig.app.json` → 0 new errors (50 pre-existing, confirmed identical modulo line-number shifts via the same stash technique); `npm run build` → succeeds; `npx vitest run` → all 142 tests pass (matches the acceptance-criteria baseline).
- **Caveat:** the acceptance criterion "a deliberate `throw new Error('test')` in `ErrorBoundary` dev mode appears in the Sentry dashboard" requires a live `VITE_SENTRY_DSN`, which does not exist in this environment (the `.env.example` placeholder is intentionally left blank — Sentry no-ops without it). Dashboard-level delivery should be smoke-tested once a real DSN is configured for a deployment environment.

---

## Tier 1 — Quick Wins

### 1.1 Fix Services-Layer Violation in ConsistencyHeatmap — OPEN _(new)_
- **What:** The June 7 dashboard rewrite (`75babea`) introduced a direct `import { supabase } from '../../services/supabaseClient'` and an inline `await supabase...` query inside `src/components/dashboard/ConsistencyHeatmap.tsx` (line 171). Per CLAUDE.md, components should call `src/services/` modules, not Supabase directly — this is the only dashboard component that now breaks that rule, and it's a one-component, one-query fix.
- **Why now:** This is a fresh regression introduced in the same week as the rewrite, before the pattern spreads to other components that copy this file as a template (the heatmap is one of the most-viewed/most-copied dashboard components). Cheapest possible time to fix is now, while the change is small and isolated.
- **Effort estimate:** S (a few hours)
- **Actual effort:** —
- **Agent prompt:** "In `src/components/dashboard/ConsistencyHeatmap.tsx`, remove the direct `supabase` import and inline query at line ~171. Identify which existing service module owns this query (likely `streakService.ts` or a workouts-fetching function in `trainingPlansService.ts` — check for an existing equivalent before adding a new one) and move the query there as a typed exported function; call that function from the component instead. If no equivalent exists, add a small typed function (e.g. `getWorkoutsForDateRange(userId, startDate, endDate)`) to the most appropriate existing service file rather than creating a new service. Preserve existing loading/error state handling exactly. Run `npm run typecheck` and `npx vitest run` to confirm no regressions (baseline: 142 tests passing)."

---

### 1.2 Accessibility for New ConsistencyHeatmap Grid Cells — OPEN _(new, scoped subset of 2.6)_
- **What:** The rewritten `ConsistencyHeatmap.tsx` renders 112 plain `<div>` grid cells (one per day across 16 weeks), each with `onClick`/`onMouseEnter`/`onMouseLeave` handlers wired to `handleCellClick`/tooltip display, but zero `role`, `tabIndex`, `aria-label`, or keyboard handlers. Cells with logged workouts route to a modal on click — that interaction is currently mouse-only and invisible to screen readers.
- **Why now:** This is a brand-new regression (the previous heatmap had no per-cell click routing), so it's adding *new* inaccessible surface area rather than carrying forward old debt. It's also far smaller than the full 2.6 audit — a single component, a well-defined interaction pattern (grid of buttons), and a clear acceptance bar. Fixing it now is cheaper than batching it into the eventual full audit, and prevents the gap from widening further if this component is used as a copy/paste template.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "In `src/components/dashboard/ConsistencyHeatmap.tsx`, make the 112 grid cells (the `gridData.allCells.map(...)` block around line 472) keyboard- and screen-reader-accessible without changing visual styling: (1) for cells where `cell.hasWorkout` is true, change the wrapping `<div>` to have `role='button'`, `tabIndex={0}`, an `aria-label` summarizing the date and workout(s) (e.g. 'Tuesday, June 3 — Bike ride, 45 min, completed'), and an `onKeyDown` handler that triggers `handleCellClick` on Enter/Space; (2) for cells with no workout, set `aria-label` to a date + 'No workout logged' and leave them out of the tab order (`tabIndex={-1}` or `aria-hidden` if purely decorative, but keep them focusable if they're meaningful for screen reader users navigating the grid — use your judgement and document the choice); (3) wrap the whole grid in a labelled `role='grid'`/`role='row'` structure or, more simply, a `<div role='group' aria-label='Workout activity heatmap, last 16 weeks'>` if full grid semantics are overkill. Verify with `npx vitest run` (142 tests) and a manual keyboard-only pass (Tab to a workout cell, press Enter, confirm the modal opens)."

---

### 1.3 Pure-Function Unit Tests for Daily Dashboard Calculations — OPEN _(narrowed slice of 2.2)_
- **What:** `riderProfileService.calculateProfile()` (FTP/training-zone derivation) and `healthMetricsService.calculateBiologicalReadiness()` (the daily readiness band shown to every user) remain the two highest-visibility, zero-coverage **pure** calculation functions in the codebase — confirmed again this cycle (`riderProfileService.test.ts` still doesn't exist; no `calculateBiologicalReadiness` describe block). Both require zero Supabase mocking, making this the cheapest test-writing task available.
- **Why now:** This has been correctly identified for 2+ assessments as the genuine remaining test gap (see 2.2's history below), but kept getting bundled into a larger M-effort item alongside `tokenStorageService` tests that *do* require mocking. Splitting out just the two pure-function suites makes this a true Tier 1 quick win — it can ship independently and immediately, with the mocked `tokenStorageService` tests deferred to 2.2.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Add Vitest unit tests for the two highest-value untested pure calculation functions in TrainingSmart. (1) Create `src/services/riderProfileService.test.ts` and test `RiderProfileService.calculateProfile()` with fixed synthetic `(activities, load, consistency, ftp)` inputs covering at least 3 cases: a high-FTP/high-consistency input that should yield an 'Advanced'-tier profile, a low-FTP/erratic-consistency input that should yield 'Beginner', and one boundary case between adjacent tiers. (2) In `src/services/healthMetricsService.test.ts`, add a `describe('calculateBiologicalReadiness')` block with fixed synthetic HRV/RHR/sleep inputs that produce known expected `status` values (e.g., 'Good' vs. 'Compromised') — cover at least the boundary transition between two adjacent statuses. Run `npx vitest run` and confirm the suite grows from 142 to 142+N passing tests with no failures."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (84 KB / 1,803 lines) — OPEN
- **What:** `PlansPage.tsx` is 84,727 bytes / 1,803 lines — confirmed byte-for-byte unchanged since June 6 (no commits have touched it this cycle). Despite several sub-components in `src/components/plans/`, the main page file still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal. It is the most-changed file in the repo's history.
- **Why now:** The file has grown across all eight previous assessments without extraction. Every new feature landed here because there was no better abstraction. Splitting it is a prerequisite for safely adding component-level tests and for the full accessibility audit (2.6).
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. The `src/components/plans/` directory already has DraggableWorkoutCard, DroppableDayColumn, WeeklyPlanView, PlanLogicViewer, etc. — extract the remaining inline sections: (1) `src/components/plans/PlanListSidebar.tsx` — the left-rail list of training plans with expand/collapse and delete actions; (2) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal; (3) `src/components/plans/PlanStatsDrawer.tsx` — the collapsible cumulative plan stats panel; (4) `src/components/plans/CreatePlanForm.tsx` — the plan creation flow including AI generation prompt and template picker. Move associated state and handlers into each sub-component or a new `src/hooks/usePlanPage.ts` hook that `PlansPage.tsx` uses. Target: `PlansPage.tsx` under 300 lines, orchestrating composition only. Verify CI passes and all 142 existing tests still pass."

---

### 2.2 Increase Test Coverage on Core Calculation Services — OPEN _(narrowed further this cycle)_
- **What:** With the two genuinely-untested pure functions split out into Tier 1 item 1.3 (`riderProfileService.calculateProfile` and `healthMetricsService.calculateBiologicalReadiness`), the remaining scope of this item is the **mocked-dependency** test that was previously bundled in: `tokenStorageService.test.ts`. There are 24 service files total, 6 already have suites (`trainingPlansService`, `healthMetricsService`, `streakService`, `openaiApi`, `onboardingService`, `recommendationService` — 133 `it()` cases). `tokenStorageService.ts` (`getTokens`/`setTokens`) has zero coverage and requires `vi.mock('./supabaseClient')`.
- **Why now:** Once 1.3 ships, this becomes a small, well-scoped follow-on rather than a recurring catch-all. Token storage correctness matters for the Strava/Google/Oura integrations the PRD marks complete — a silent regression here would break OAuth-dependent features without any visible UI symptom.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —
- **Agent prompt:** "After Tier 1 item 1.3 lands, add `src/services/tokenStorageService.test.ts` covering `getTokens`/`setTokens` happy-path and not-found cases via `vi.mock('./supabaseClient')`. Cover at least: successful token write, successful token read, read of a non-existent provider returning null/undefined, and a Supabase error path (confirm it's surfaced/logged, not swallowed). Run `npm run test:coverage` and report the before/after percentage."

---

### 2.3 SettingsPage Modularization (1,120 Lines, 53 KB) — OPEN
- **What:** `SettingsPage.tsx` is 53,721 bytes / 1,120 lines (confirmed unchanged again this cycle) managing six independent concerns in one file: Strava OAuth, Oura Ring integration, coach prompt customization, content interests, rider profile, and notification settings. `src/components/settings/` currently only contains `CoachSpecializationSelector.tsx` and `Integrations.tsx` — partial prior extraction did not complete the job.
- **Why now:** Every integration addition (Oura, Google Calendar, Apple Health) has landed in this one file. It blocks safe testing of OAuth flows and is the second-largest file in the codebase. With `useSaveUserProfile` now wired (PR #25), hooks are available — modularization can proceed cleanly.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. The `src/components/settings/` directory already has `CoachSpecializationSelector.tsx` and `Integrations.tsx` — extract the remaining sections: (1) `StravaConnectionCard.tsx` — Strava OAuth connect/disconnect UI, athlete display, cache refresh; (2) `OuraIntegrationCard.tsx` — Oura token entry, connection status, disconnect; (3) `RiderProfileForm.tsx` — FTP, weight, training zones with save button; use `useSaveRiderProfile` from `useProfileMutations.ts`; (4) `ContentInterestsCard.tsx` — the interest tag grid with save. `SettingsPage.tsx` should become a layout shell under 150 lines composing these sub-components. Pass shared auth state (userId) via props. Run `npm run typecheck` and verify all 142 tests still pass."

---

### 2.4 Eliminate TypeScript `any` in Critical Service Files — OPEN
- **What:** There are 34 `: any` usages across `src/` (8 in `trainingPlansService.ts`, plus scattered usage in `openaiApi.ts`, `DashboardPage.tsx`, `PlansPage.tsx`) — counts unchanged this cycle. The most dangerous ones are `dbPayload: any` and `data as any[]` patterns that can silently mask DB response shape mismatches.
- **Why now:** Every new feature that touches the plan or dashboard code perpetuates `any` by copying existing patterns. Fixing the 8 in `trainingPlansService.ts` first establishes the correct typing for the highest-risk file.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate all TypeScript `any` usages in `src/services/trainingPlansService.ts`. Run `grep -n ': any' src/services/trainingPlansService.ts` to get the full list (currently 8 occurrences). For each: replace `dbPayload: any` with a typed `DbWorkoutInsert` interface matching the Supabase table schema; replace `(data as any[]).map(row => ...)` with a typed `DbPlanRow` interface derived from the migration columns; replace `(workout as any).scheduledDate` with a proper union type or type guard. After the service is clean, run the same process on `src/services/openaiApi.ts` (1 occurrence) and the `any` usages in `src/pages/PlansPage.tsx` (inline `queryClient.setQueryData` cast). Run `npm run typecheck` with `strict: true` to verify zero `any` errors in these files. Do not touch other files in this PR."

---

### 2.5 Curation Feed Phase 2 — RSS/Article Integration — OPEN _(escalated from Tier 3, now 6 assessments without movement)_
- **What:** The Curation Feed shows YouTube videos (Phase 1 complete). Phase 2 (RSS-parsed article feeds from cycling/running publications) and Phase 3 (ML affinity recommendations) are listed as incomplete in the PRD (section 3.5). `contentFeedService.ts` is already 38KB, indicating Phase 1 was substantial.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments without movement; this is now the 6th. Genuine product value — increases session depth and differentiates TrainingSmart from generic training apps. Start only after Tier 1 items are resolved.
- **Effort estimate:** L (2–3 weeks)
- **Actual effort:** —
- **Agent prompt:** "Implement Curation Feed Phase 2. Create a Supabase Edge Function `rss-feed-proxy` that accepts `?tag=cycling|running|triathlon`, fetches and parses RSS/Atom feeds from a hardcoded list of publications (VeloNews, Outside, TrainingPeaks Blog, Canadian Cycling Magazine), and returns normalized `{title, url, imageUrl, source, publishedAt, tags}` objects. Cache results in a new `content_cache(tag text, payload jsonb, cached_at timestamptz)` table for 1 hour. In the frontend, add an 'Articles' tab to the existing `ContentFeed` component alongside 'Videos'. Add a `liked_content(user_id uuid, content_url text, signal text, created_at timestamptz)` table as Phase 3 foundation; add thumbs up/down buttons to article cards."

---

### 2.6 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(escalated from Tier 3, now 6 assessments without movement)_
- **What:** No ARIA labels, keyboard navigation, or focus management were observed across the app. The drag-and-drop workout cards and Recharts power zone chart are the highest-risk areas for screen readers and keyboard-only users. This is risk item #19 from the original risk review. Tier 1 items 1.1/1.2 this cycle address only the newly-introduced `ConsistencyHeatmap` grid cells — the broader audit (modals, drag-and-drop cards, charts, icon-only buttons app-wide) is unchanged.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments; this is now the 6th. Accessibility is a correctness concern — schedule after PlansPage split (2.1) is complete, since that refactor is a prerequisite for per-component ARIA work.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart. Install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; run `npx eslint src/ --fix` and fix all auto-fixable violations. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, and focus trapping via a `useFocusTrap` hook; (2) drag-and-drop workout cards — add `role='button'`, `aria-grabbed` state, and arrow-key keyboard support; (3) icon-only buttons — add descriptive `aria-label`; (4) Recharts charts — wrap in `<figure>` with `aria-label` text summary. Install `@axe-core/react` in dev mode only for regression catching. Note: `ConsistencyHeatmap.tsx` cells were already remediated in Tier 1 item 1.2 — verify that work and extend the same pattern to other interactive grids if any exist."

---

## Tier 3 — Strategic

_No active Tier 3 items. All previous items were either escalated to Tier 2 or dropped. Tier 2 items 2.5 and 2.6 are both at 6 consecutive assessments without movement — if they remain untouched next cycle, consider either (a) actually scheduling one of them as the Current Sprint item, or (b) re-evaluating whether they're correctly prioritized below the Tier 1 quick wins, since both keep getting "next sprint after Tier 1" without Tier 1 ever fully clearing._

_To sharpen the next assessment: there is still no usage/analytics instrumentation telling us which dashboard or settings sections users actually interact with most — that would help decide whether SettingsPage modularization (2.3) or Curation Feed Phase 2 (2.5) is more valuable to users right now, versus going purely on code-health signals._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Encrypt OAuth Tokens at Rest (was 1.1)** | **WON'T FIX — project owner decision, 2026-06-07: this will not be addressed.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. The item had appeared in 7 consecutive assessments and was correctly identified as blocked on a human architecture decision (token-write ownership moving to Edge Functions) and an environment check (pgsodium/Supabase Vault availability) — neither of which an autonomous agent can resolve. Rather than continue carrying it forward as "needs human decision," the decision has now been made: do not pursue it. The implementation plan remains documented in PR #24 if priorities change in the future, but this item should no longer be surfaced in assessments. |
| **Centralize Token Refresh Logic (was 3.1)** | Was blocked by 1.1 (OAuth token encryption); 1.1 is now WON'T FIX (see above), so this follow-on is dropped along with it — there is no longer a parent item for it to attach to. |
| **Recurring Season Schedules (was 3.3)** | XL effort (3–4 weeks), appeared 5 consecutive assessments with zero traction and no start. Revisit when performance athlete segment reaches scale warranting the investment. |
