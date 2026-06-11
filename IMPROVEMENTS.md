# Improvements
_Last assessment: 2026-06-11_
_Last knowledge sync: 2026-06-11_
_Assessment based on: `git fetch origin main` + `git log origin/main` (one new commit since June 10: `c62a988` merge of PR #30); all PRs (state=all, 30 total — PR #30 "Fix services-layer violation in ConsistencyHeatmap" merged 2026-06-11, no open PRs); open issues (none — `mcp__github__list_issues` returns empty); PRD.md re-read for scope/status context; and fresh code inspection confirming PR #30 landed as described: `src/components/dashboard/ConsistencyHeatmap.tsx` (now 552 lines) no longer imports `supabase` directly — it imports `streakService` and calls the new `streakService.getWorkoutsInDateRange(userId, startDate, endDate)` (added at `src/services/streakService.ts:69-88`, the moved query + row-mapping logic, verbatim). Also re-checked: `PlansPage.tsx` (1,803 lines / 84,727 bytes, unchanged, including the `kilojoules` access at line 1465 and 7 `queryClient.setQueryData(['plan-data'], (oldData: any) => ...)` casts), `SettingsPage.tsx` (1,120 lines / 53,721 bytes, unchanged, `settings/` still only `CoachSpecializationSelector.tsx` + `Integrations.tsx`), `trainingPlansService.ts` (still 8 `: any`, 34 total across `src/`), `riderProfileService.test.ts` (still does not exist), no `calculateBiologicalReadiness` describe block in `healthMetricsService.test.ts`, and the `ConsistencyHeatmap.tsx` grid-cell block (lines 440-471, the `gridData.allCells.map(...)` loop) — confirmed still zero `role`/`tabIndex`/`aria-*`/keyboard handlers on the 112 cells, only `onClick`/`onMouseEnter`/`onMouseLeave`._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment (`ERR_MODULE_NOT_FOUND` for `eslint`/`vitest`/`@vitejs/plugin-react`). Test-suite status (142 tests passing) and lint/typecheck baselines are carried forward from PR #28's verification, the most recent confirmed run._

---

## Current Sprint
None — ready for next implementation run. (1.1 shipped via PR #30, merged 2026-06-11.)

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Fix Services-Layer Violation in ConsistencyHeatmap (Tier 1.1) | 2026-06-11 | **PR #30 merged** (`4971e9c`). Removed the direct `supabase` import/inline query from `ConsistencyHeatmap.tsx`; added `streakService.getWorkoutsInDateRange(userId, startDate, endDate)` and the component now calls it. Loading/error handling preserved. `npm run lint` clean, `npm run build` passes, `npx vitest run` 142/142. No user-facing behavior change. |
| Integrate Sentry Error Monitoring (Tier 1.3, prior cycle) | 2026-06-08 | PR #28 merged. `@sentry/react` initialized in `main.tsx`; `ErrorBoundary.componentDidCatch` reports to Sentry; 25 outer catch-all sites instrumented across `trainingPlansService.ts`, `supabaseChatService.ts`, `ouraApi.ts`. |
| Wire Mutation Hooks Into PlansPage and SettingsPage (Tier 1.2, prior cycle) | 2026-06-05 | PR #25 merged — all 6 plan mutation hooks wired into PlansPage; `useSaveUserProfile` wired into SettingsPage; dashboard now invalidated on profile saves. |
| Decide on OAuth Token Encryption (was 1.1, prior cycle) | 2026-06-07 | Resolved as **WON'T FIX** by project owner; see Dropped/Stale. |

**Closing note for 1.1 (Services-Layer Violation):**
- **Actual effort:** S, as estimated — single component + single new service method, one query moved verbatim.
- **Verification:** `npm run lint` (0 new issues), `npm run build` (passes, includes typecheck via `tsc -b`), `npx vitest run` (142/142 passing) — all per PR #30's test plan.
- This closes the regression introduced by the June 7 dashboard rewrite (`75babea`). The companion accessibility regression from the same rewrite (now Tier 1 item 1.1, the 112 grid cells with zero ARIA/keyboard support) remains open below and is now the top Tier 1 candidate.

---

## Tier 1 — Quick Wins

### 1.1 Accessibility for New ConsistencyHeatmap Grid Cells — OPEN _(scoped subset of 2.6, recommended next)_
- **What:** `ConsistencyHeatmap.tsx` renders 112 plain `<div>` grid cells (one per day across 16 weeks, the `gridData.allCells.map(...)` block at lines 440-471), each with `onClick`/`onMouseEnter`/`onMouseLeave` handlers wired to `handleCellClick`/tooltip display, but zero `role`, `tabIndex`, `aria-label`, or keyboard handlers. Cells with logged workouts route to a modal on click — that interaction is currently mouse-only and invisible to screen readers. Confirmed still present after PR #30 (which only addressed the services-layer violation in this same component, not accessibility).
- **Why now:** This is a regression from the June 7 dashboard rewrite (the previous heatmap had no per-cell click routing), so it's adding *new* inaccessible surface area rather than carrying forward old debt. It's also far smaller than the full 2.6 audit — a single component, a well-defined interaction pattern (grid of buttons), and a clear acceptance bar. With 1.1's services-layer fix now merged, this is the only remaining open item from the June 7 rewrite and the natural next pickup.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "In `src/components/dashboard/ConsistencyHeatmap.tsx`, make the 112 grid cells (the `gridData.allCells.map(...)` block around line 441) keyboard- and screen-reader-accessible without changing visual styling: (1) for cells where `cell.hasWorkout` is true, change the wrapping `<div>` to have `role='button'`, `tabIndex={0}`, an `aria-label` summarizing the date and workout(s) (e.g. 'Tuesday, June 3 — Bike ride, 45 min, completed'), and an `onKeyDown` handler that triggers `handleCellClick` on Enter/Space; (2) for cells with no workout, set `aria-label` to a date + 'No workout logged' and leave them out of the tab order (`tabIndex={-1}` or `aria-hidden` if purely decorative, but keep them focusable if they're meaningful for screen reader users navigating the grid — use your judgement and document the choice); (3) wrap the whole grid in a labelled `role='grid'`/`role='row'` structure or, more simply, a `<div role='group' aria-label='Workout activity heatmap, last 16 weeks'>` if full grid semantics are overkill. Verify with `npx vitest run` (142 tests) and a manual keyboard-only pass (Tab to a workout cell, press Enter, confirm the modal opens)."

---

### 1.2 Pure-Function Unit Tests for Daily Dashboard Calculations — OPEN _(narrowed slice of 2.2)_
- **What:** `riderProfileService.calculateProfile()` (FTP/training-zone derivation) and `healthMetricsService.calculateBiologicalReadiness()` (the daily readiness band shown to every user) remain the two highest-visibility, zero-coverage **pure** calculation functions in the codebase — confirmed again this cycle (`riderProfileService.test.ts` still doesn't exist; no `calculateBiologicalReadiness` describe block). Both require zero Supabase mocking, making this the cheapest test-writing task available.
- **Why now:** This has been correctly identified for 3+ assessments as the genuine remaining test gap (see 2.2's history below), but kept getting bundled into a larger M-effort item alongside `tokenStorageService` tests that *do* require mocking. Splitting out just the two pure-function suites makes this a true Tier 1 quick win — it can ship independently and immediately, with the mocked `tokenStorageService` tests deferred to 2.2.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Add Vitest unit tests for the two highest-value untested pure calculation functions in TrainingSmart. (1) Create `src/services/riderProfileService.test.ts` and test `RiderProfileService.calculateProfile()` with fixed synthetic `(activities, load, consistency, ftp)` inputs covering at least 3 cases: a high-FTP/high-consistency input that should yield an 'Advanced'-tier profile, a low-FTP/erratic-consistency input that should yield 'Beginner', and one boundary case between adjacent tiers. (2) In `src/services/healthMetricsService.test.ts`, add a `describe('calculateBiologicalReadiness')` block with fixed synthetic HRV/RHR/sleep inputs that produce known expected `status` values (e.g., 'Good' vs. 'Compromised') — cover at least the boundary transition between two adjacent statuses. Run `npx vitest run` and confirm the suite grows from 142 to 142+N passing tests with no failures."

---

## Tier 2 — Next Sprint

> **Priority order for this cycle (2.1–2.4), set 2026-06-11 per direct prioritization request:**
> 1. **2.4 — Eliminate `: any` in `trainingPlansService.ts`** (M, 2–3 days). The smallest and most contained of the four, fully independent, and it establishes correct typing for the service layer that 2.1's refactor will lean on. It also removes the one `PlansPage.tsx` `any` cast (`queryClient.setQueryData`) before that file gets restructured, so the new sub-components inherit clean types instead of propagating `any`.
> 2. **2.1 — Split `PlansPage.tsx`** (L, 3–5 days). The highest-leverage item in the backlog: it's the prerequisite for 2.6 (accessibility audit, now 7 assessments stale) and for safe component-level testing, and it has gone unstarted across all 8 prior assessments. Sequencing it right after 2.4 means it starts from clean service types.
> 3. **2.3 — Modularize `SettingsPage.tsx`** (M, 2–3 days). Fully independent of 2.1/2.4 — pick up once capacity frees from 2.1, or run in parallel with it via a second contributor. Its OAuth-card extraction (Strava/Oura) sets up cleaner ground for 2.2's token-storage tests.
> 4. **2.2 — `tokenStorageService` tests** (S–M, 1–2 days). The smallest item, but formally gated on Tier 1 item 1.2 landing first — treat as the fill-in/closeout task for the cycle once 1.2 ships, ideally alongside or after 2.3's OAuth-adjacent work.
>
> If full-cycle capacity doesn't cover all four, **2.4 → 2.1** is the minimum viable slice: it banks the type-safety win and finally unblocks the long-stalled accessibility work (2.6) in a single cycle.

### 2.1 Split Monolithic PlansPage.tsx (84 KB / 1,803 lines) — OPEN
- **What:** `PlansPage.tsx` is 84,727 bytes / 1,803 lines — confirmed byte-for-byte unchanged since June 6 (no commits have touched it this cycle). Despite several sub-components in `src/components/plans/`, the main page file still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal. It is the most-changed file in the repo's history.
- **Why now:** The file has grown across all eight previous assessments without extraction. Every new feature landed here because there was no better abstraction. Splitting it is a prerequisite for safely adding component-level tests and for the full accessibility audit (2.6).
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. The `src/components/plans/` directory already has DraggableWorkoutCard, DroppableDayColumn, WeeklyPlanView, PlanLogicViewer, etc. — extract the remaining inline sections: (1) `src/components/plans/PlanListSidebar.tsx` — the left-rail list of training plans with expand/collapse and delete actions; (2) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal; (3) `src/components/plans/PlanStatsDrawer.tsx` — the collapsible cumulative plan stats panel; (4) `src/components/plans/CreatePlanForm.tsx` — the plan creation flow including AI generation prompt and template picker. Move associated state and handlers into each sub-component or a new `src/hooks/usePlanPage.ts` hook that `PlansPage.tsx` uses. Target: `PlansPage.tsx` under 300 lines, orchestrating composition only. Verify CI passes and all 142 existing tests still pass."

---

### 2.2 Increase Test Coverage on Core Calculation Services — OPEN _(narrowed further this cycle)_
- **What:** With the two genuinely-untested pure functions split out into Tier 1 item 1.2 (`riderProfileService.calculateProfile` and `healthMetricsService.calculateBiologicalReadiness`), the remaining scope of this item is the **mocked-dependency** test that was previously bundled in: `tokenStorageService.test.ts`. There are 24 service files total, 6 already have suites (`trainingPlansService`, `healthMetricsService`, `streakService`, `openaiApi`, `onboardingService`, `recommendationService` — 133 `it()` cases). `tokenStorageService.ts` (`getTokens`/`setTokens`) has zero coverage and requires `vi.mock('./supabaseClient')`.
- **Why now:** Once 1.2 ships, this becomes a small, well-scoped follow-on rather than a recurring catch-all. Token storage correctness matters for the Strava/Google/Oura integrations the PRD marks complete — a silent regression here would break OAuth-dependent features without any visible UI symptom.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —
- **Agent prompt:** "After Tier 1 item 1.2 lands, add `src/services/tokenStorageService.test.ts` covering `getTokens`/`setTokens` happy-path and not-found cases via `vi.mock('./supabaseClient')`. Cover at least: successful token write, successful token read, read of a non-existent provider returning null/undefined, and a Supabase error path (confirm it's surfaced/logged, not swallowed). Run `npm run test:coverage` and report the before/after percentage."

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

### 2.5 Curation Feed Phase 2 — RSS/Article Integration — OPEN _(escalated from Tier 3, now 7 assessments without movement)_
- **What:** The Curation Feed shows YouTube videos (Phase 1 complete). Phase 2 (RSS-parsed article feeds from cycling/running publications) and Phase 3 (ML affinity recommendations) are listed as incomplete in the PRD (section 3.5). `contentFeedService.ts` is already 38KB, indicating Phase 1 was substantial.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments without movement; this is now the 7th. Genuine product value — increases session depth and differentiates TrainingSmart from generic training apps. **Recommendation for next cycle:** if Tier 1 (1.1, 1.2) clears this sprint, schedule this as the Current Sprint item next — it has now outlasted every Tier 1 item that was supposedly blocking it.
- **Effort estimate:** L (2–3 weeks)
- **Actual effort:** —
- **Agent prompt:** "Implement Curation Feed Phase 2. Create a Supabase Edge Function `rss-feed-proxy` that accepts `?tag=cycling|running|triathlon`, fetches and parses RSS/Atom feeds from a hardcoded list of publications (VeloNews, Outside, TrainingPeaks Blog, Canadian Cycling Magazine), and returns normalized `{title, url, imageUrl, source, publishedAt, tags}` objects. Cache results in a new `content_cache(tag text, payload jsonb, cached_at timestamptz)` table for 1 hour. In the frontend, add an 'Articles' tab to the existing `ContentFeed` component alongside 'Videos'. Add a `liked_content(user_id uuid, content_url text, signal text, created_at timestamptz)` table as Phase 3 foundation; add thumbs up/down buttons to article cards."

---

### 2.6 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(escalated from Tier 3, now 7 assessments without movement)_
- **What:** No ARIA labels, keyboard navigation, or focus management were observed across the app. The drag-and-drop workout cards and Recharts power zone chart are the highest-risk areas for screen readers and keyboard-only users. This is risk item #19 from the original risk review. Tier 1 item 1.1 this cycle (the `ConsistencyHeatmap` grid cells) is the first concrete slice of this audit — the broader audit (modals, drag-and-drop cards, charts, icon-only buttons app-wide) is unchanged.
- **Why now:** Escalated from Tier 3 after 5 consecutive assessments; this is now the 7th. Accessibility is a correctness concern — schedule after PlansPage split (2.1) is complete, since that refactor is a prerequisite for per-component ARIA work. Once 1.1 lands, the heatmap pattern can serve as a reference implementation for this broader audit.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart. Install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; run `npx eslint src/ --fix` and fix all auto-fixable violations. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, and focus trapping via a `useFocusTrap` hook; (2) drag-and-drop workout cards — add `role='button'`, `aria-grabbed` state, and arrow-key keyboard support; (3) icon-only buttons — add descriptive `aria-label`; (4) Recharts charts — wrap in `<figure>` with `aria-label` text summary. Install `@axe-core/react` in dev mode only for regression catching. Note: `ConsistencyHeatmap.tsx` cells should already be remediated by Tier 1 item 1.1 by the time this starts — verify that work and extend the same pattern to other interactive grids."

---

## Tier 3 — Strategic

_No active Tier 3 items. All previous items were either escalated to Tier 2 or dropped. Tier 2 items 2.5 and 2.6 are both now at 7 consecutive assessments without movement (escalated from Tier 3 in PR #23 on June 5). Per the staleness rule, items at 3+ consecutive assessments without movement should be escalated or dropped — these were already escalated once (Tier 3 → Tier 2) and have received no further movement since. They are being kept in Tier 2 rather than dropped because both retain clear product/correctness value and the PRD explicitly lists Curation Feed Phase 2 as incomplete scope (section 3.5). However, this is the last cycle they should be carried at "next sprint after Tier 1" without action: if neither moves by the next assessment, the next cycle should schedule one of them directly as the Current Sprint item rather than deferring again._

_To sharpen the next assessment: there is still no usage/analytics instrumentation telling us which dashboard or settings sections users actually interact with most — that would help decide whether SettingsPage modularization (2.3) or Curation Feed Phase 2 (2.5) is more valuable to users right now, versus going purely on code-health signals._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Encrypt OAuth Tokens at Rest (was 1.1)** | **WON'T FIX — project owner decision, 2026-06-07: this will not be addressed.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. The item had appeared in 7 consecutive assessments and was correctly identified as blocked on a human architecture decision (token-write ownership moving to Edge Functions) and an environment check (pgsodium/Supabase Vault availability) — neither of which an autonomous agent can resolve. Rather than continue carrying it forward as "needs human decision," the decision has now been made: do not pursue it. The implementation plan remains documented in PR #24 if priorities change in the future, but this item should no longer be surfaced in assessments. |
| **Centralize Token Refresh Logic (was 3.1)** | Was blocked by 1.1 (OAuth token encryption); 1.1 is now WON'T FIX (see above), so this follow-on is dropped along with it — there is no longer a parent item for it to attach to. |
| **Recurring Season Schedules (was 3.3)** | XL effort (3–4 weeks), appeared 5 consecutive assessments with zero traction and no start. Revisit when performance athlete segment reaches scale warranting the investment. |
