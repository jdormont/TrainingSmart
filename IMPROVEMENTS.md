# Improvements
_Last assessment: 2026-06-18_
_Last knowledge sync: 2026-06-15_
_Assessment based on: `git log`/`git fetch origin` (local branch `claude/loving-goldberg-6gp4sd` confirmed at parity with `origin/main`, HEAD `427565f`); all PRs (state=all, 36 total — PR #36 "add pure-function unit tests for calculateProfile and calculateBiologicalReadiness" merged 2026-06-16, closing the Current Sprint item; PR #35 "Improve chat bubble contrast and table styling" merged 2026-06-15, human-authored, unrelated to a tracked item); open issues (none — `mcp__github__list_issues` returns empty); PRD.md re-read (section 3.5 Curation Feed Phase 2/3 still incomplete); fresh code inspection: `PlansPage.tsx` unchanged at 1,803 lines, `SettingsPage.tsx` unchanged at 1,163 lines, `src/components/settings/` still only 2 files, `: any` usage unchanged at 48 total (`stravaCacheService.ts` 14, `trainingPlansService.ts` 8, `PlansPage.tsx` 7, `supabaseChatService.ts` 5, `useChatSessions.ts` 3, rest singletons), test suite now 165 tests across 8/24 service files (`riderProfileService.test.ts` now exists, `calculateBiologicalReadiness` now covered), `src/hooks/useBackgroundSync.ts` read in full for the first time this cycle (new finding, see 1.x below)._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment. Test-suite status (165/165 passing) is carried forward from PR #36's own verification, the most recent confirmed run._

---

## Current Sprint
Throttle/Skip Redundant Reconciliation Pass on Tab Focus + Test Coverage (Tier 1.1/1.2) — `[IN PROGRESS — PR: #38]`

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Pure-Function Unit Tests for `calculateProfile` / `calculateBiologicalReadiness` (Tier 1.1) | 2026-06-16 | **PR #36 merged** (`427565f`). New `riderProfileService.test.ts` (6 tests) + `calculateBiologicalReadiness` describe block in `healthMetricsService.test.ts` (6 tests). Test count 153 → 165, all passing. `npm run lint` and `npm run build` clean per PR's own verification. This was the 4th-cycle item (formerly 1.2 → 1.1) and closes the "test pure calculations as discovered" backlog opened by `19c5c5e`. |
| Chat bubble contrast + markdown table dark-theme styling (human-authored, untracked) | 2026-06-15 | PR #35 merged. Solid chat bubble backgrounds and fixed `[&_table]` descendant-selector dark styling (previously used non-matching `[&>table]` direct-child selectors against `convertMarkdownToHtml`'s wrapped output). Not a tracked IMPROVEMENTS item but resolves a real contrast bug; noted here so it isn't re-flagged. |
| Accessibility for ConsistencyHeatmap Grid Cells (Tier 1.1, prior cycle) | 2026-06-11 | PR #32 merged (`3f75177`). |
| Fix Services-Layer Violation in ConsistencyHeatmap (prior cycle) | 2026-06-11 | PR #30 merged (`4971e9c`). |
| Mobile chat overflow/stats-row collapse (human-authored, untracked) | 2026-06-15 | PR #33 merged (`0c1869a`). Previously flagged as "work in flight" — now resolved, included for completeness. |

---

## Tier 1 — Quick Wins

### 1.1 Throttle/Skip Redundant Reconciliation Pass on Every Tab Focus — IN PROGRESS
- **What:** `useBackgroundSync.ts` runs `trainingPlansService.reconcileWorkoutsWithStrava()` on **every** `visibilitychange` event where the tab becomes visible — even in the "cache is fresh" branch (lines 59-68), with no debounce, cooldown, or in-flight guard against rapid tab-switching. A user alt-tabbing or switching browser tabs repeatedly (common while multitasking) re-triggers a full Supabase reconciliation query each time, with only a `console.log` audit trail and no rate limit. Also carries 12 `console.log` calls that ship to production (no env gate), which is unnecessary console noise/string-building cost on every sync.
- **Why now:** This hook runs app-wide on every page (mounted in `App.tsx` per CLAUDE.md) — it's the highest-frequency code path in the app and was not covered by the last several assessments' performance lens. The fix is small, isolated, and reduces redundant Supabase round-trips without changing the staleness-detection logic for Strava data itself (the 15-minute cache check is fine; it's the "fresh cache" reconciliation pass that has no rate limit).
- **Effort estimate:** S (0.5–1 day)
- **Actual effort:** —
- **Agent prompt:** "In `src/hooks/useBackgroundSync.ts`, add a minimum-interval guard (e.g. 60s, via a `useRef` timestamp) around `performSync()`'s `visibilitychange` handler so rapid tab-focus events don't re-trigger `reconcileWorkoutsWithStrava()` repeatedly. Keep the mount-time sync and the 15-minute Strava-cache staleness check unchanged. Gate the 12 `console.log` calls behind `import.meta.env.DEV` (or remove). Run `npx vitest run` to confirm no existing test regresses (no test file currently covers this hook — adding one is out of scope here, see 1.2)."

---

### 1.2 Add a Test for `useBackgroundSync`'s Reconciliation Gating — IN PROGRESS (paired with 1.1)
- **What:** `useBackgroundSync.ts` has zero test coverage and is the only app-wide hook with non-trivial conditional logic (cache-staleness branch vs. fresh-cache branch, Oura conditional sync, double `invalidateQueries` paths). Once 1.1 adds the interval guard, a regression here would be invisible until a user actually multitasks across tabs.
- **Why now:** Pairs directly with 1.1 — testing the gating logic at the same time as introducing it is far cheaper than retrofitting later, and this hook has never had a "is it tested" check applied to it in prior assessments (services have been the focus; hooks haven't).
- **Effort estimate:** S (1 day)
- **Actual effort:** —
- **Agent prompt:** "Add `src/hooks/useBackgroundSync.test.ts` using Vitest + Testing Library's `renderHook`, mocking `stravaCacheService`, `trainingPlansService`, `ouraApi`, and `supabase.auth.getUser`. Cover: (1) stale cache triggers `getActivities`, `reconcileWorkoutsWithStrava`, and both query invalidations; (2) fresh cache skips `getActivities` but still runs reconciliation; (3) the 1.1 interval guard prevents a second `reconcileWorkoutsWithStrava` call if `visibilitychange` fires twice within the cooldown window; (4) Oura sync only runs when `ouraApi.isAuthenticated()` resolves true. Run `npx vitest run` and confirm the suite grows from 165 with no failures."

---

### 1.3 Eliminate `: any` in `stravaCacheService.ts` — OPEN _(carried, unchanged)_
- **What:** `stravaCacheService.ts` still has **14** `: any` usages (confirmed unchanged this cycle via `grep -c ': any'`), the single largest concentration in `src/`, from the cardiac-decoupling/HR-telemetry feature (`19c5c5e`): lap/segment-effort mapping, zone-distribution lookups, and row-mapping casts.
- **Why now:** No commits have touched this file since it was first flagged last cycle — still the cheapest, most isolated typing win available, and still ahead of `trainingPlansService.ts` (8) as the top offender.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —
- **Agent prompt:** "In `src/services/stravaCacheService.ts`, eliminate the 14 `: any` usages (`grep -n ': any' src/services/stravaCacheService.ts` for exact lines). Define typed interfaces for the Strava detailed-activity shape actually consumed — `StravaLap`, `StravaSegmentEffort`, `StravaZoneDistribution`, `StravaStream` — covering only the fields this file reads. Replace `(detailedActivity as any)` casts and inline `(x: any)` callback params with these types. Run `npx vitest run` and confirm `stravaCacheService.test.ts` still passes with no behavior change, then `npx tsc --noEmit` for zero new errors."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (84 KB / 1,803 lines) — OPEN _(carried, unchanged)_
- **What:** `PlansPage.tsx` remains 1,803 lines, confirmed byte-for-byte unchanged for the 10th consecutive assessment. Still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal.
- **Why now:** Prerequisite for the accessibility audit (2.4) and for safe component-level testing. With Tier 1 now light (two new small hook items + the carried `any` cleanup), there is capacity to start this.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. Extract: (1) `src/components/plans/PlanListSidebar.tsx`; (2) `src/components/plans/LevelUpModal.tsx`; (3) `src/components/plans/PlanStatsDrawer.tsx`; (4) `src/components/plans/CreatePlanForm.tsx`. Move associated state/handlers into a new `src/hooks/usePlanPage.ts` hook. Target: `PlansPage.tsx` under 300 lines, orchestration only. Verify CI passes and all 165 existing tests still pass."

---

### 2.2 Eliminate TypeScript `any` in `trainingPlansService.ts` and Remaining Files — OPEN _(carried, unchanged)_
- **What:** Remaining 34 `: any` usages outside `stravaCacheService.ts`: `trainingPlansService.ts` (8, unchanged across 10 assessments), `PlansPage.tsx` (7), `supabaseChatService.ts` (5), `useChatSessions.ts` (3), plus singletons in `riderProfileService.ts`, `openaiApi.ts`, `contentFeedService.ts`, `ChatPage.tsx`, `useDashboardData.ts`.
- **Why now:** `trainingPlansService.ts`'s 8 `any`s mask DB response shape mismatches in the service every plan mutation depends on; fixing before 2.1's `PlansPage.tsx` split means new sub-components inherit clean types.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate TypeScript `any` usages in `src/services/trainingPlansService.ts` (8 occurrences). Replace `dbPayload: any` with a typed `DbWorkoutInsert` interface; replace `(data as any[]).map(...)` with a typed `DbPlanRow` interface from the migration columns. Then address the 1 `PlansPage.tsx` `queryClient.setQueryData` cast and the 3 `useChatSessions.ts` row-mapping `any`s. Run `npm run typecheck` with `strict: true` to verify zero `any`-related errors in these files. `stravaCacheService.ts` is covered separately by Tier 1 item 1.3."

---

### 2.3 SettingsPage Modularization (1,163 Lines, 56 KB) — OPEN _(carried, unchanged)_
- **What:** `SettingsPage.tsx` unchanged this cycle at 1,163 lines — no new feature landed in it since the cycling-digest card. Still manages seven independent concerns in one file. `src/components/settings/` still only contains `CoachSpecializationSelector.tsx` and `Integrations.tsx`.
- **Why now:** Unchanged risk profile, but no new compounding cost this cycle either — still worth doing before the next settings feature lands directly in the monolith again (the pattern has repeated twice already).
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. Extract: (1) `StravaConnectionCard.tsx`; (2) `OuraIntegrationCard.tsx`; (3) `RiderProfileForm.tsx` (using `useSaveRiderProfile` from `useProfileMutations.ts`); (4) `ContentInterestsCard.tsx`; (5) `CyclingDigestFiltersCard.tsx`. `SettingsPage.tsx` should become a layout shell under 150 lines. Run `npm run typecheck` and verify all 165 tests still pass."

---

### 2.4 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(9th consecutive assessment without movement — staleness rule applies)_
- **What:** No ARIA labels, keyboard navigation, or focus management exist across the app outside of `ConsistencyHeatmap.tsx` (remediated via PR #32). Drag-and-drop workout cards and the Recharts power zone chart remain highest-risk for screen readers and keyboard-only users.
- **Why now / staleness assessment:** This is the 9th consecutive assessment without the broader audit starting (originally escalated from Tier 3 in PR #23, June 5; only progress is the narrow `ConsistencyHeatmap` slice from 7 cycles ago). Per the staleness rule, an item appearing 3+ consecutive cycles without movement must be escalated further or dropped — this was already escalated once (Tier 3 → Tier 2, prior cycle) and explicitly flagged as "lead candidate for Current Sprint" once `PlansPage.tsx` split (2.1) lands. **Decision: hold at Tier 2, not Current Sprint** — 2.1 has not yet landed (still unchanged at 1,803 lines), so the stated prerequisite is not satisfied. Re-flagging this explicitly: if 2.1 completes next cycle and this item still hasn't moved, it must become the Current Sprint item directly rather than deferred again.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart, using the remediated `ConsistencyHeatmap.tsx` (PR #32) as reference pattern. Install `eslint-plugin-jsx-a11y`, run `npx eslint src/ --fix`. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, focus trapping via a new `useFocusTrap` hook; (2) drag-and-drop workout cards — `role='button'`, `aria-grabbed`, arrow-key support; (3) icon-only buttons app-wide — descriptive `aria-label`; (4) Recharts charts — wrap in `<figure>` with `aria-label` summary."

---

### 2.5 Curation Feed Phase 2 — Re-scope or Mark Superseded — OPEN _(9th consecutive assessment without movement — staleness rule applies)_
- **What:** Curation Feed shows YouTube videos (Phase 1) and a cycling news digest (`fb2102f`, AI-summarized headlines with discipline filtering). PRD Phase 2 (RSS-parsed article feeds) and Phase 3 (ML affinity, like/dislike signals) remain incomplete.
- **Why now / staleness assessment:** 9 consecutive assessments without direct action. Last cycle's recommendation was explicit: "if the next assessment finds no further movement *and* no re-scoping happened, this item should be dropped as superseded by the digest feature rather than carried again verbatim." No re-scoping action or further digest expansion happened this cycle. **Decision: DROP as superseded**, per the prior cycle's own stated condition — see Dropped/Stale below. The genuinely open remaining gap (Phase 3 like/dislike signals) is small enough to stand alone; it is re-raised fresh in Tier 3 rather than carried under the old Phase 2 framing.
- **Effort estimate:** n/a — see Dropped/Stale
- **Actual effort:** n/a

---

## Tier 3 — Strategic

### 3.1 Curation Feed Phase 3 — Like/Dislike Signal Capture — OPEN _(re-raised, narrower scope than the dropped 2.5)_
- **What:** Neither YouTube cards nor the cycling-news digest have any feedback mechanism (thumbs up/down, save/hide). Per PRD 3.5, this is the explicit Phase 3 gap, and it's also the cheapest lever toward eventually answering "do users actually engage with the digest" — a question the last two cycles' Tier 2.4 discussion repeatedly needed and couldn't answer for lack of instrumentation.
- **Why now:** Worth planning, not yet building — it's a new table + simple UI affordance, but the bigger unknown is whether engagement with the existing digest justifies further investment in this direction at all (see instrumentation note below).
- **Effort estimate:** M (add `liked_content(user_id, content_url, signal, created_at)` table + UI affordances)
- **Agent prompt:** "Add a `liked_content` table (migration) and thumbs up/down buttons on cycling-digest headlines and YouTube cards in the Learn page, recording `signal: 'like' | 'dislike'`. No ranking/ML logic yet — just capture, to inform a future re-scoping of the Curation Feed roadmap."

### 3.2 Recurring Season Schedules — OPEN _(carried, unchanged)_
- **What:** XL effort (3–4 weeks) periodized recurring-season scheduling feature (PRD 3.3, marked INCOMPLETE). No groundwork has been laid.
- **Why now:** Still strategic-only; revisit when the performance-athlete segment reaches scale, as previously decided.
- **Effort estimate:** XL (3–4 weeks)

_Only two clear Tier 3 items exist this cycle (3.1 is newly distilled from the dropped 2.5; 3.2 is carried). A third would be speculative without better usage data — see the instrumentation note below, carried again because it remains unaddressed and is the actual blocker to sharpening Tier 3._

_To sharpen the next assessment: there is still no usage/analytics instrumentation telling us which dashboard, chat, or settings sections users actually interact with most. This is now directly blocking two decisions: (a) whether 3.1's like/dislike capture is worth building before or after Phase 2 RSS parsing, and (b) which screens matter most for the 2.4 accessibility audit once it starts. Recommend adding lightweight pageview/interaction analytics (e.g. extending existing Sentry breadcrumbs, or a minimal PostHog/Plausible integration) as a standalone near-term item if no other instrumentation surfaces first._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Curation Feed Phase 2 (RSS/article integration)** | **DROPPED — superseded, 2026-06-18.** 9 consecutive assessments without movement; the prior cycle's cycling-news-digest feature (`fb2102f`) delivers the same "curated written content" value via AI-summarized headlines rather than RSS parsing, and the prior assessment explicitly conditioned dropping this on "no further movement and no re-scoping" this cycle — neither occurred. The remaining genuine gap (Phase 3 like/dislike signals) is re-raised narrowly as new Tier 3 item 3.1. |
| **Encrypt OAuth Tokens at Rest** | **WON'T FIX — project owner decision, 2026-06-07.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. Implementation plan remains in PR #24 if priorities change. |
| **Centralize Token Refresh Logic** | Dropped along with OAuth token encryption (no longer has a parent item to attach to). |
| **Recurring Season Schedules (as a Tier 2 candidate)** | Carried at Tier 3 (3.2) rather than dropped outright — XL effort, no traction across 6 consecutive assessments, revisit at scale. |
