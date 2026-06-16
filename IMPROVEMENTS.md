# Improvements
_Last assessment: 2026-06-15_
_Last knowledge sync: 2026-06-15_
_Assessment based on: `git fetch origin main` + `git log` (8 new commits since June 11: `3f75177` PR #32 merge, `c2b1842` PR #31 docs merge, then 6 feature commits — `59813c8` chat-attachments bucket + migration timestamp standardization, `56a16be` chat paperclip z-index fix, `39373fb` progressive activity enrichment + decoupled chat image uploads, `72067f9` copy chat message as markdown, `19c5c5e` segment HR telemetry/power-to-HR binning/cardiac decoupling, `68dfa87` PRD/CLAUDE.md doc updates, `b551151` multi-workout-per-day support, `fb2102f` cycling news digest); all PRs (state=all, 33 total — PR #32 "Add keyboard accessibility to ConsistencyHeatmap grid cells" merged 2026-06-11 (`3f75177`); PR #33 "Fix mobile chat overflow and collapse stats row" opened 2026-06-15 by the project owner directly (not a Claude session), still open, addresses `ChatPage.tsx`/`markdownToHtml.ts` mobile layout — unrelated to any tracked IMPROVEMENTS item, noted as in-flight human work, not duplicated here); open issues (none — `mcp__github__list_issues` returns empty); PRD.md re-read (Curation Feed Phase 1 now includes the new cycling news digest; Phase 2/3 still incomplete per section 3.5); fresh code inspection: `PlansPage.tsx` unchanged (1,803 lines / 84,727 bytes), `SettingsPage.tsx` **grew** to 1,163 lines / 56,049 bytes (was 1,120/53,721 — the cycling-digest commit added a filter-picker card), `src/components/settings/` still only `CoachSpecializationSelector.tsx` + `Integrations.tsx`, total `: any` usages across `src/` rose from 34 to **48** (new top offender: `stravaCacheService.ts` with 14, from the HR telemetry/cardiac-decoupling feature — itself fully tested in `stravaCacheService.test.ts`), `trainingPlansService.ts` still exactly 8, `riderProfileService.test.ts` still does not exist, no `calculateBiologicalReadiness` describe block in `healthMetricsService.test.ts`._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment. Test-suite status (142 tests passing pre-PR#32; PR #32's description also confirms 142/142, i.e. no net-new tests added by that PR) is carried forward from the most recent confirmed run (PR #30/#32)._

---

## Current Sprint
1.1 Pure-Function Unit Tests for Daily Dashboard Calculations (Tier 1) — `[IN PROGRESS — PR: #36]` · Actual effort: S

_(Item 1.1 "Accessibility for ConsistencyHeatmap Grid Cells" — PR #32 — merged 2026-06-11 and is moved to Recently Completed below. PR #33, open as of today, is unrelated human-authored work on mobile chat layout; see note in Tier 1.)_

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Accessibility for ConsistencyHeatmap Grid Cells (Tier 1.1) | 2026-06-11 | **PR #32 merged** (`3f75177`). All 112 grid cells now have `role="button"`, `tabIndex` (0 for workout days, -1 for empty), and `aria-label` via new `getCellAriaLabel(cell)` helper; `onKeyDown` triggers click handler on Enter/Space; grid container has `role="group"` + `aria-label`; focused cells get a visible focus ring matching the "today" ring. `npx vitest run` 142/142, `npm run lint` clean, `npx tsc --noEmit` clean, `npm run build` passes. This closes the second and final piece of the June 7 dashboard-rewrite regression (the first piece, the services-layer violation, closed via PR #30). |
| Fix Services-Layer Violation in ConsistencyHeatmap (Tier 1.1, prior cycle) | 2026-06-11 | PR #30 merged (`4971e9c`). `ConsistencyHeatmap.tsx` no longer imports `supabase` directly — uses `streakService.getWorkoutsInDateRange()`. |
| Integrate Sentry Error Monitoring (Tier 1.3, prior cycle) | 2026-06-08 | PR #28 merged. `@sentry/react` initialized in `main.tsx`; `ErrorBoundary.componentDidCatch` reports to Sentry; 25 outer catch-all sites instrumented. |

**Closing note for 1.1 (Accessibility):**
- **Actual effort:** S, as estimated.
- **Verification:** all four checks (vitest, lint, tsc, build) clean per PR #32's own test plan.
- This closes out the entire June 7 `ConsistencyHeatmap` rewrite regression (services-layer violation + accessibility), tracked across PRs #30 and #32. The broader app-wide accessibility audit (2.6, below) remains open and can now use this component as a reference implementation.

---

## Tier 1 — Quick Wins

### 1.1 Pure-Function Unit Tests for Daily Dashboard Calculations — OPEN _(was 1.2, promoted to top Tier 1 slot)_
- **What:** `riderProfileService.calculateProfile()` (FTP/training-zone derivation) and `healthMetricsService.calculateBiologicalReadiness()` (the daily readiness band shown to every user) remain the two highest-visibility, zero-coverage **pure** calculation functions in the codebase — confirmed again this cycle (`riderProfileService.test.ts` still doesn't exist; no `calculateBiologicalReadiness` describe block in `healthMetricsService.test.ts`). Both require zero Supabase mocking, making this the cheapest test-writing task available. Note the precedent from this cycle's `19c5c5e` commit, which shipped `calculateCardiacDecoupling` *with* a full test suite in the same PR — this item is the remaining backlog of that same "test pure calculations as they're discovered" pattern, just for two pre-existing functions.
- **Why now:** This is now the 4th assessment to identify this exact gap (previously 1.2 → now 1.1, having been blocked behind the heatmap accessibility work which has now shipped). With 1.1's predecessor cleared, this is unambiguously the next pickup — small, independent, zero risk of touching `PlansPage.tsx`/`SettingsPage.tsx` while those larger refactors (2.1/2.3) are pending.
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Add Vitest unit tests for the two highest-value untested pure calculation functions in TrainingSmart. (1) Create `src/services/riderProfileService.test.ts` and test `RiderProfileService.calculateProfile()` with fixed synthetic `(activities, load, consistency, ftp)` inputs covering at least 3 cases: a high-FTP/high-consistency input that should yield an 'Advanced'-tier profile, a low-FTP/erratic-consistency input that should yield 'Beginner', and one boundary case between adjacent tiers. (2) In `src/services/healthMetricsService.test.ts`, add a `describe('calculateBiologicalReadiness')` block with fixed synthetic HRV/RHR/sleep inputs that produce known expected `status` values (e.g., 'Good' vs. 'Compromised') — cover at least the boundary transition between two adjacent statuses. Run `npx vitest run` and confirm the suite grows from 142 to 142+N passing tests with no failures."

---

### 1.2 Review/Merge In-Flight Mobile Chat Layout Fix (PR #33) — IN FLIGHT (human-authored, not a tracked item)
- **What:** PR #33, opened today (2026-06-15) directly by the project owner (not via a Claude Code session), fixes horizontal overflow/clipping of AI chat messages on mobile (~390px width) and collapses the "Training Summary" stats row on `ChatPage.tsx` behind a toggle on small screens. Touches `src/pages/ChatPage.tsx` and `src/utils/markdownToHtml.ts` (adds `break-words`/`overflow-x-auto` to markdown output).
- **Why flagged here:** Not a reassessment action item — included so the next cycle doesn't re-discover the same mobile-chat issues as "new." Per the routine's instructions, this is work in flight; no reprioritization performed. If merged before the next assessment, it should move to Recently Completed; if it surfaces new follow-on gaps (e.g., the PR's own checklist notes "manual spot-check on a physical device" is unchecked), those can be picked up then.
- **Effort estimate:** n/a (already implemented, awaiting review)
- **Actual effort:** n/a
- **Agent prompt:** n/a — no action requested this cycle.

---

### 1.3 Eliminate `: any` in `stravaCacheService.ts` (New Top Offender) — OPEN _(new this cycle, split from 2.4)_
- **What:** `stravaCacheService.ts` now has **14** `: any` usages — more than double `trainingPlansService.ts`'s 8, and now the single largest concentration of `any` in `src/`. Most are in the newly-added (`19c5c5e`) detailed-activity processing: `(detailedActivity as any).laps.map((l: any) => ...)`, `.segment_efforts.map((se: any) => ...)`, zone/stream lookups (`zones.find((z: any) => ...)`), and row-mapping (`(data || []).map((row: any) => ...)`). These wrap the Strava API's detailed-activity response shape, which is well-documented and typeable.
- **Why now:** This is fresh, still-warm code from the most recent feature commit — typing it now (while the author/context is recent) is far cheaper than after more features build on top of these patterns. It also overtook `trainingPlansService.ts` as the highest-risk untyped file, so it should be sequenced *before* 2.4's `trainingPlansService.ts` work, not after — splitting 2.4 into two independently-shippable slices.
- **Effort estimate:** S–M (1–2 days)
- **Agent prompt:** "In `src/services/stravaCacheService.ts`, eliminate the 14 `: any` usages introduced by the cardiac-decoupling/HR-telemetry feature (lines ~134, 236, 248, 257-258, 265-280, 295-296, 447 per `grep -n ': any' src/services/stravaCacheService.ts`). Define typed interfaces for the Strava detailed-activity shape actually consumed — `StravaLap`, `StravaSegmentEffort`, `StravaZoneDistribution`, `StravaStream` — covering only the fields this file reads (lap data, segment efforts, power/heartrate zone distribution buckets, watts/heartrate streams). Replace `(detailedActivity as any)` casts and inline `(x: any)` callback params with these types. Run `npx vitest run` and confirm `stravaCacheService.test.ts` (which already covers `calculateCardiacDecoupling`) still passes with no behavior change, then `npx tsc --noEmit` for zero new errors."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (84 KB / 1,803 lines) — OPEN
- **What:** `PlansPage.tsx` is 84,727 bytes / 1,803 lines — confirmed byte-for-byte unchanged for the 9th consecutive assessment (no commits since June 6 have touched it, including this cycle's multi-workout-per-day and cycling-digest features, both of which landed elsewhere). It still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal.
- **Why now:** The file has grown across all nine previous assessments without extraction. It is the prerequisite for the accessibility audit (2.6) and for safe component-level testing. With Tier 1 items now small and independent (1.1 tests, 1.3 typing), this cycle has capacity to start 2.1.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. The `src/components/plans/` directory already has DraggableWorkoutCard, DroppableDayColumn, WeeklyPlanView, PlanLogicViewer, ConflictResolutionModal, etc. — extract the remaining inline sections: (1) `src/components/plans/PlanListSidebar.tsx` — the left-rail list of training plans with expand/collapse and delete actions; (2) `src/components/plans/LevelUpModal.tsx` — the consistency milestone celebration modal; (3) `src/components/plans/PlanStatsDrawer.tsx` — the collapsible cumulative plan stats panel; (4) `src/components/plans/CreatePlanForm.tsx` — the plan creation flow including AI generation prompt and template picker. Move associated state and handlers into each sub-component or a new `src/hooks/usePlanPage.ts` hook that `PlansPage.tsx` uses. Note: the multi-workout-per-day feature (`b551151`) added new conflict-resolution UI to `ConflictResolutionModal.tsx` and `WeeklyPlanView.tsx` — preserve those code paths exactly when extracting. Target: `PlansPage.tsx` under 300 lines, orchestrating composition only. Verify CI passes and all 142 existing tests still pass."

---

### 2.2 Eliminate TypeScript `any` in `trainingPlansService.ts` and Remaining Files — OPEN _(narrowed; stravaCacheService split out to 1.3)_
- **What:** With `stravaCacheService.ts` (14 usages) split out as the higher-priority Tier 1 item 1.3, this item now covers the remaining 34 `: any` usages: `trainingPlansService.ts` (8, unchanged across 9 assessments), `PlansPage.tsx` (7), `supabaseChatService.ts` (5), `useChatSessions.ts` (3, all in session/message row-mapping — `(session: any)`, `(msg: any)`, `(a: any, b: any)` sort comparator), `HealthSpiderChart.tsx` (2), `AuthPage.tsx` (2), and single occurrences in `riderProfileService.ts`, `openaiApi.ts`, `contentFeedService.ts`, `ChatPage.tsx`, `useDashboardData.ts`, `RecoveryCard.tsx`, `DailyActivityCard.tsx`.
- **Why now:** `trainingPlansService.ts`'s 8 `: any` (dbPayload casts, `data as any[]` row mapping) are the highest-risk remaining ones — they mask DB response shape mismatches in the service every plan mutation depends on. Fixing this first establishes correct typing before the 2.1 `PlansPage.tsx` split, so new sub-components inherit clean types.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate TypeScript `any` usages in `src/services/trainingPlansService.ts` (run `grep -n ': any' src/services/trainingPlansService.ts` for the current 8). For each: replace `dbPayload: any` with a typed `DbWorkoutInsert` interface matching the Supabase table schema; replace `(data as any[]).map(row => ...)` with a typed `DbPlanRow` interface derived from the migration columns; replace `(workout as any).scheduledDate` with a proper union type or type guard. Then do the same for the one `PlansPage.tsx` `queryClient.setQueryData` cast and the 3 `useChatSessions.ts` row-mapping `any`s (session/message/sort-comparator — type against the `chat_sessions`/`chat_messages` migration columns). Run `npm run typecheck` with `strict: true` to verify zero `any`-related errors in these files. Do not touch other files in this PR — `stravaCacheService.ts` is covered separately by Tier 1 item 1.3."

---

### 2.3 SettingsPage Modularization (now 1,163 Lines, 56 KB — growing) — OPEN
- **What:** `SettingsPage.tsx` grew again this cycle, from 53,721 to **56,049 bytes** (1,120 → 1,163 lines), as the cycling-news-digest feature (`fb2102f`) added a new discipline-filter picker card directly into the file. It now manages seven independent concerns in one file: Strava OAuth, Oura Ring integration, coach prompt customization, content interests, rider profile, notification settings, and now cycling-digest filters. `src/components/settings/` still only contains `CoachSpecializationSelector.tsx` and `Integrations.tsx`.
- **Why now:** This is the second consecutive cycle where a new feature added code directly to `SettingsPage.tsx` rather than a sub-component, because no extraction pattern exists yet for "settings card." Each additional feature compounds the eventual refactor cost. With 2.2 establishing clean types for chat/plan services, this is fully independent and can run in parallel.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. The `src/components/settings/` directory already has `CoachSpecializationSelector.tsx` and `Integrations.tsx` — extract the remaining sections: (1) `StravaConnectionCard.tsx` — Strava OAuth connect/disconnect UI, athlete display, cache refresh; (2) `OuraIntegrationCard.tsx` — Oura token entry, connection status, disconnect; (3) `RiderProfileForm.tsx` — FTP, weight, training zones with save button, using `useSaveRiderProfile` from `useProfileMutations.ts`; (4) `ContentInterestsCard.tsx` — the interest tag grid with save; (5) `CyclingDigestFiltersCard.tsx` — the discipline filter picker added in commit `fb2102f` (`cyclingDigestFilters` state, saved via `cycling_digest_filters` on the user profile). `SettingsPage.tsx` should become a layout shell under 150 lines composing these sub-components. Pass shared auth state (userId) via props. Run `npm run typecheck` and verify all 142 tests still pass."

---

### 2.4 Curation Feed Phase 2 — RSS/Article Integration — OPEN _(8th consecutive assessment without movement — see staleness note)_
- **What:** The Curation Feed shows YouTube videos (Phase 1) and, as of this cycle, a cycling news digest (`fb2102f` — AI-summarized headlines with discipline filtering, server-cached via `cycling_digest_cache`). Phase 2 (RSS-parsed article feeds from cycling/running publications) and Phase 3 (ML affinity recommendations, like/dislike signals) remain incomplete per PRD section 3.5.
- **Why now / staleness assessment:** This item has now appeared in **8 consecutive assessments** without direct action (escalated from Tier 3 in PR #23, June 5). Per the staleness rule (3+ consecutive without movement → escalate further or drop), this is evaluated for escalation vs. drop this cycle. **Decision: keep at Tier 2, not escalate to Current Sprint, and not drop** — because the cycling-news-digest feature shipped *this cycle* materially changes the picture: it delivers much of the "curated written content" value that Phase 2 targeted, using a different mechanism (AI-summarized headlines via Tavily-style search + caching, rather than RSS parsing). This is a genuine, partial step toward the same product goal, even though it doesn't literally implement "RSS/article integration." Recommendation for next cycle: re-scope this item's description to reflect the digest feature as a partial Phase 2 delivery, and narrow the remaining gap (e.g., does the digest need a "save/follow publication" feature, or is RSS parsing now redundant given the AI-digest approach covers the same need more cheaply?). If the next assessment finds no further movement *and* no re-scoping happened, this item should be dropped as superseded by the digest feature rather than carried again verbatim.
- **Effort estimate:** L (now likely smaller given the digest groundwork — re-scope before estimating)
- **Actual effort:** —
- **Agent prompt:** "Before implementing, re-scope this item: review `supabase/functions/cycling-news-digest/index.ts` and `src/components/learn/CyclingDigest.tsx` (both new as of commit `fb2102f`) to determine what portion of PRD section 3.5's 'Curation Feed Phase 2' they already satisfy. If the AI-digest approach covers the core need, propose either (a) extending it to additional content categories (running/triathlon, not just cycling) using the same cached-digest pattern, or (b) marking Phase 2 complete in PRD.md and redirecting remaining effort to Phase 3 (like/dislike signals — add a `liked_content(user_id uuid, content_url text, signal text, created_at timestamptz)` table and thumbs up/down buttons on digest headlines and YouTube cards)."

---

### 2.5 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(8th consecutive assessment without movement — ESCALATION REQUIRED)_
- **What:** No ARIA labels, keyboard navigation, or focus management exist across the app outside of `ConsistencyHeatmap.tsx` (remediated this cycle via PR #32, item 1.1 in the prior assessment). The drag-and-drop workout cards and Recharts power zone chart remain the highest-risk areas for screen readers and keyboard-only users. This is risk item #19 from the original risk review.
- **Why now / staleness assessment:** This item has now appeared in **8 consecutive assessments** without the broader audit starting (escalated from Tier 3 in PR #23, June 5; the only progress has been the narrow `ConsistencyHeatmap` slice). Per the staleness rule, this must be escalated or dropped this cycle — it cannot be carried again unchanged. **Decision: ESCALATE.** Unlike 2.4 (where new feature work partially substitutes), nothing has reduced this item's scope, and accessibility is a correctness/compliance concern that doesn't go away with time. The `ConsistencyHeatmap` remediation (PR #32) now provides a concrete, tested reference pattern (`role`, `tabIndex`, `aria-label` helper, `onKeyDown`, focus ring) that makes the broader audit lower-risk to execute than when this item was first raised. Given 2.1 (PlansPage split) is now also queued for this sprint and is a stated prerequisite, the realistic sequencing is: **2.1 lands first, then this item becomes the lead candidate for the Current Sprint slot next cycle** — explicitly call this out as the recommended next Current Sprint item if 2.1 completes.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart, using the remediated `ConsistencyHeatmap.tsx` (PR #32) as the reference pattern (`role`, `tabIndex`, `aria-label` via a `getXAriaLabel()` helper, `onKeyDown` for Enter/Space, visible focus ring). Install `eslint-plugin-jsx-a11y` and add it to `eslint.config.js`; run `npx eslint src/ --fix` and fix all auto-fixable violations. Then manually address, in priority order: (1) all modal overlays (the app has many: Level-Up, Plan Logic Viewer, Post-Workout Check-in, Conflict Resolution, Smart Workout Picker, Workout Import, Calendar Sync, Plan Modification) — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, and focus trapping via a new `useFocusTrap` hook; (2) drag-and-drop workout cards (`DraggableWorkoutCard.tsx`) — add `role='button'`, `aria-grabbed` state, and arrow-key keyboard support; (3) icon-only buttons app-wide — add descriptive `aria-label`; (4) Recharts charts (power zone distribution, training trends) — wrap in `<figure>` with `aria-label` text summary. Install `@axe-core/react` in dev mode only for regression catching."

---

## Tier 3 — Strategic

_No active Tier 3 items this cycle. Both items previously carried in Tier 2 (2.4 Curation Feed Phase 2, 2.5 Accessibility Audit) were evaluated under the staleness rule above — 2.4 retained at Tier 2 with re-scoping guidance (the cycling-digest feature changed its context), 2.5 escalated with explicit "lead candidate for Current Sprint next cycle" guidance. Neither was dropped: both retain clear product/correctness value._

_To sharpen the next assessment: there is still no usage/analytics instrumentation telling us which dashboard, chat, or settings sections users actually interact with most. This would be especially useful for 2.4's re-scoping question (do users engage with the new cycling digest enough to justify expanding it, vs. investing in RSS parsing or Phase 3 signals?) and for prioritizing which screens in the 2.5 accessibility audit matter most._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Encrypt OAuth Tokens at Rest** | **WON'T FIX — project owner decision, 2026-06-07.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. Implementation plan remains in PR #24 if priorities change. |
| **Centralize Token Refresh Logic** | Dropped along with OAuth token encryption (no longer has a parent item to attach to). |
| **Recurring Season Schedules** | XL effort (3–4 weeks), appeared 5 consecutive assessments with zero traction. Revisit when performance-athlete segment reaches scale. |
