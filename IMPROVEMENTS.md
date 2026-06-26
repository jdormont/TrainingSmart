# Improvements
_Last assessment: 2026-06-25_
_Last knowledge sync: 2026-06-25_
_Assessment based on: `git fetch origin main` (HEAD `8c6f2f7`, branch `assessment/2026-06-25` cut from `origin/main`); `git log` reviewed back through the prior assessment's merge commit (`4c3b6db`, PR #43); GitHub PRs #44, #45, #46 read individually via `mcp__github__pull_request_read` (all merged; `list_pull_requests` bulk call again omitted in favor of per-PR `get` after last cycle's note that the bulk call can be unreliable in this environment — this cycle the bulk open-PR list correctly returned `[]`, consistent with `git log` showing no open branches besides this assessment's); `mcp__github__list_issues` returns 0 open issues (no user-feedback proxy available this cycle, same as prior cycles); PRD.md re-read in full (3.3/3.5 INCOMPLETE items unchanged); fresh code inspection of `stravaCacheService.ts` (`: any` count, re-grepped — unchanged at 17), `SettingsPage.tsx` (unchanged at 1,464 lines — no settings feature landed this cycle), `PlansPage.tsx` (unchanged at 1,803 lines, confirmed via `git log -- src/pages/PlansPage.tsx` showing no commits since the Tier-1.2-driven `28e2794`, predating PR #40), `trainingPlansService.ts` (`: any` count unchanged at 8), the new `dataProcessing.ts`/`riderProfileService.ts`/`stravaCacheService.ts` changes from PR #45 (clean — 0 `any` in the new `dataProcessing.ts` utilities, and PR #45 shipped with its own test files for every changed service), and `src/lib/analytics.ts` (PostHog wrapper — found to predate this entire assessment history, see correction below)._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment (`ERR_MODULE_NOT_FOUND` for `vitest`). Test-suite pass/fail status is carried forward from each PR's own reported CI footnote: PR #44 reported 208/208 passing; PR #45 and #46 do not report a running total in their PR bodies but both include new/updated `*.test.ts` files in their diffs (`riderProfileService.test.ts`, `stravaCacheService.test.ts`, `dataProcessing.test.ts` for #45)._

_Correction from last cycle: the prior assessment's instrumentation note ("there is still no usage/analytics instrumentation...") was inaccurate. `src/lib/analytics.ts` (a PostHog wrapper: `track`/`identify`/`reset`, gated on `VITE_POSTHOG_KEY`) already exists and predates this assessment history (introduced alongside the AI-provider abstraction commit `771d7fc`), and `analytics.track` calls are already present in 10 files (`SettingsPage.tsx`, `ChatPage.tsx`, `DashboardPage.tsx`, `WeeklyPlanView.tsx`, `AuthCallback.tsx`, `LevelUpModal.tsx`, `StreakCelebration.tsx`, `IntakeWizard.tsx`, `DashboardHero.tsx`, `StreakWidget.tsx`). The real open question is narrower than "do we have instrumentation" — it's "has anyone looked at the PostHog dashboard to answer the specific questions Tier 3 keeps raising" (digest engagement, Memory-feature usage). No code action follows from this correction; flagging so future cycles don't re-propose instrumentation that already exists._

---

## Current Sprint

None — ready for next implementation run.

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Fix `useMemorySessionSync` outgoing-session bug | 2026-06-26 | Root cause: `latestSessionRef.current` was reassigned to the new session during render, before the outgoing effect's cleanup ran, so the cleanup's `session.id !== sessionId` guard blocked the sync. Replaced the single ref with a per-session snapshot map (`sessionSnapshotsRef`, keyed by session id) so the outgoing session's data survives the switch. Updated the existing test (`does not sync the outgoing session...` → `syncs the outgoing session...`) to assert the corrected behavior. `npx vitest run` — 233/233 passing. `npm run lint` — 0 errors. `npx tsc --noEmit` — clean. Actual effort: S. |
| Add test coverage for persistent-memory service and session sync hook | 2026-06-23 | **PR #44 merged** (`13a80ce`). Added `userMemoryService.test.ts` and `useMemorySessionSync.test.ts`, 208/208 tests passing (+20). Also surfaced a real bug as a documented-but-not-fixed finding: session-switch never syncs the outgoing session due to a ref-ordering issue — see above, now fixed. |
| Implement Form (TSS/CTL/ATL) and real cardiac decoupling for Economy | 2026-06-23 | PR #45 merged (`b383fea`). Replaces the ACWR-based "Capacity" dimension (which duplicated the existing Load health-score dimension) with Training Stress Balance (CTL−ATL); upgrades "Economy" to prefer real per-ride cardiac decoupling once ≥3 enriched rides exist, with a clearly-flagged heuristic fallback otherwise. Shipped with its own test coverage across all three changed service/util files — no test-gap follow-up needed, unlike PR #42. Not a previously tracked IMPROVEMENTS item but a meaningful Rider Profile accuracy fix; noted here so it isn't re-flagged. |
| Enable RLS on `cycling_digest_cache` table | 2026-06-24 | PR #46 merged (`e1c0aab`). The table was only ever accessed by the cycling-news-digest Edge Function via the service-role key (which bypasses RLS), so it had been sitting open to any anon/authenticated client. Enabling RLS with no client policies closes that gap without affecting the Edge Function. Small (4-line) but a real security fix worth recording — not previously tracked because the gap wasn't noticed until this PR's own investigation. |

---

## Tier 1 — Quick Wins

### 1.1 Eliminate `: any` in `stravaCacheService.ts` — OPEN _(now the oldest open Tier 1 item)_
- **What:** Still **17** `: any` usages, unchanged since last cycle — no new commits touched this file this cycle (PR #45 modified `stravaCacheService.ts` only for the new `prioritizeForEnrichment()` function, which was written without introducing new `any`s, so the count held steady rather than growing for the first time in several cycles).
- **Why now:** The count has stopped growing, which is a good sign PR authors are already avoiding the pattern in new code — but the existing 17 are unaddressed and this is now the single largest concentration of `any` in `src/` for multiple consecutive cycles. Worth clearing now while it's stable rather than waiting for the next feature to compound it again.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —
- **Agent prompt:** "In `src/services/stravaCacheService.ts`, eliminate the 17 `: any` usages (`grep -n ': any' src/services/stravaCacheService.ts` for exact lines). Define typed interfaces for the Strava detailed-activity shape actually consumed — `StravaLap`, `StravaSegmentEffort`, `StravaZoneDistribution`, `StravaStream` (including `grade_smooth`) — covering only the fields this file reads. Replace `(detailedActivity as any)` casts and inline `(x: any)` callback params with these types. Run `npx vitest run` and confirm `stravaCacheService.test.ts` still passes with no behavior change, then `npx tsc --noEmit` for zero new errors."

---

### 1.2 SettingsPage Modularization — OPEN _(carried, unchanged this cycle)_
- **What:** `SettingsPage.tsx` held steady at **1,464 lines** this cycle — no settings feature landed in PRs #44–#46, so the monolith didn't grow further, but it also didn't shrink. `src/components/settings/` still contains only `CoachSpecializationSelector.tsx` and `Integrations.tsx`.
- **Why now:** This is a quiet cycle for this file — the best opportunity to extract without chasing a moving target. Promoted to Tier 1 last cycle because of compounding risk; that risk paused this cycle, but the underlying debt is the same size it's been for 3+ cycles and the next settings feature will land on the monolith again if this isn't done first.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. Extract: (1) `StravaConnectionCard.tsx`; (2) `OuraIntegrationCard.tsx`; (3) `RiderProfileForm.tsx` (using `useSaveRiderProfile` from `useProfileMutations.ts`); (4) `ContentInterestsCard.tsx`; (5) `CyclingDigestFiltersCard.tsx`; (6) `MemoryTab.tsx` (using `useUserMemory.ts`, the newest and least-entangled tab — good first extraction to validate the pattern). `SettingsPage.tsx` should become a layout shell under 200 lines. Run `npm run typecheck` and verify all existing tests still pass."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (1,803 lines) — OPEN _(carried, unchanged — 12th consecutive assessment)_
- **What:** `PlansPage.tsx` remains exactly 1,803 lines — confirmed via `git log -- src/pages/PlansPage.tsx`, which shows no commits touching this file since `28e2794` (predating PR #40, several cycles ago). Still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal.
- **Why now:** Prerequisite for the accessibility audit (2.2), which has now hit its own staleness threshold (see below) waiting on this. Recent capacity went to test coverage (#44) and the Form/Economy rider-profile rework (#45) — both reasonable choices, but this item needs to move soon or it blocks 2.2 indefinitely.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. Extract: (1) `src/components/plans/PlanListSidebar.tsx`; (2) `src/components/plans/LevelUpModal.tsx`; (3) `src/components/plans/PlanStatsDrawer.tsx`; (4) `src/components/plans/CreatePlanForm.tsx`. Move associated state/handlers into a new `src/hooks/usePlanPage.ts` hook. Target: `PlansPage.tsx` under 300 lines, orchestration only. Verify CI passes and all existing tests still pass."

---

### 2.2 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(escalation note: 12th consecutive assessment without movement, see decision below)_
- **What:** No ARIA labels, keyboard navigation, or focus management exist across the app outside of `ConsistencyHeatmap.tsx` (remediated via PR #32, many cycles ago). Drag-and-drop workout cards and the Recharts power/elevation/Form-TSB charts remain highest-risk for screen readers and keyboard-only users.
- **Why now / staleness assessment:** This is the 12th consecutive assessment without the audit starting, and the second consecutive cycle flagging that it must become the Current Sprint item the moment 2.1 lands, with no further deferral. **Decision this cycle: hold at Tier 2, do not drop.** The staleness rule's intent is to stop re-surfacing items with no path forward; this item has a clear, named, single blocker (2.1) rather than being vague or low-conviction, so dropping it would lose a legitimate WCAG gap rather than clear noise. Holding rather than dropping, but this is the last cycle this gets a "waiting on 2.1" pass — if 2.1 doesn't land next cycle, this should be escalated to Current Sprint regardless, decoupled from the prerequisite.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart, using the remediated `ConsistencyHeatmap.tsx` (PR #32) as reference pattern. Install `eslint-plugin-jsx-a11y`, run `npx eslint src/ --fix`. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, focus trapping via a new `useFocusTrap` hook; (2) drag-and-drop workout cards — `role='button'`, `aria-grabbed`, arrow-key support; (3) icon-only buttons app-wide — descriptive `aria-label`; (4) Recharts charts (Power Curve, Power-by-Terrain, Elevation-Power Correlation, and the new Form/TSB chart from PR #45) — wrap in `<figure>` with `aria-label` summary."

---

### 2.3 Eliminate TypeScript `any` in `trainingPlansService.ts` and Remaining Files — OPEN _(carried, unchanged)_
- **What:** Remaining `: any` usages outside `stravaCacheService.ts`: `trainingPlansService.ts` (8, unchanged across 12+ assessments), `PlansPage.tsx` (7), `supabaseChatService.ts` (5), `useChatSessions.ts` (3), plus singletons in `riderProfileService.ts`, `openaiApi.ts`, `contentFeedService.ts`, `ChatPage.tsx`, `useDashboardData.ts`, `HealthSpiderChart.tsx`, `AuthPage.tsx`, `RecoveryCard.tsx`, `DailyActivityCard.tsx`. Notably, PR #45 touched `riderProfileService.ts` and `useDashboardData.ts` this cycle and did **not** introduce new `any`s in either — a good sign the codebase's newer code is cleaner than its older code.
- **Why now:** `trainingPlansService.ts`'s 8 `any`s mask DB response shape mismatches in the service every plan mutation depends on; fixing before 2.1's `PlansPage.tsx` split means new sub-components inherit clean types.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate TypeScript `any` usages in `src/services/trainingPlansService.ts` (8 occurrences). Replace `dbPayload: any` with a typed `DbWorkoutInsert` interface; replace `(data as any[]).map(...)` with a typed `DbPlanRow` interface from the migration columns. Then address the `PlansPage.tsx` `queryClient.setQueryData` casts and the `useChatSessions.ts` row-mapping `any`s. Run `npm run typecheck` with `strict: true` to verify zero `any`-related errors in these files. `stravaCacheService.ts` is covered separately by Tier 1 item 1.1."

---

## Tier 3 — Strategic

### 3.1 Curation Feed Phase 3 — Like/Dislike Signal Capture — OPEN _(carried, unchanged)_
- **What:** Neither YouTube cards nor the cycling-news digest have any feedback mechanism (thumbs up/down, save/hide). Per PRD 3.5, this is the explicit Phase 3 gap.
- **Why now:** Worth planning, not yet building. With this cycle's correction that PostHog analytics already exists and is already wired into 10 files, the actual next step is cheap: check whether `analytics.track` already fires on digest/YouTube card views or clicks, and if so, pull that data before committing engineering time to a full like/dislike table. This sharpens the item rather than leaving it purely speculative.
- **Effort estimate:** M (add `liked_content(user_id, content_url, signal, created_at)` table + UI affordances)
- **Agent prompt:** "First, check whether `analytics.track` calls already exist on the Learn page / digest / YouTube card components (none of the 10 files currently using `analytics.track` are in that area, per this cycle's grep — so most likely no). If absent, add `analytics.track('digest_card_viewed' | 'youtube_card_clicked', ...)` calls there first (S effort, immediate signal). Only then add the `liked_content` table (migration) and thumbs up/down buttons on cycling-digest headlines and YouTube cards in the Learn page, recording `signal: 'like' | 'dislike'`. No ranking/ML logic yet — just capture."

### 3.2 Recurring Season Schedules — OPEN _(carried, unchanged — 8th consecutive cycle, no traction)_
- **What:** XL effort (3–4 weeks) periodized recurring-season scheduling feature (PRD 3.3, marked INCOMPLETE). No groundwork has been laid.
- **Why now:** Still strategic-only; revisit when the performance-athlete segment reaches scale, as previously decided. Carried again rather than dropped — this is genuinely a "wait for signal" item, not a stalled one we're failing to prioritize.
- **Effort estimate:** XL (3–4 weeks)

_Only two Tier 3 items exist this cycle, same as the last several cycles. A third would be speculative — see the analytics note above; now that PostHog is confirmed live and instrumented in 10 files, the actual blocker to sharpening Tier 3 is someone reviewing the existing PostHog dashboard data (digest engagement, Memory-feature usage), not adding new instrumentation. Recommending that as a lightweight one-time action rather than an engineering backlog item._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Curation Feed Phase 2 (RSS/article integration)** | **DROPPED — superseded, 2026-06-18.** The cycling-news-digest feature (`fb2102f`) delivers the same "curated written content" value via AI-summarized headlines rather than RSS parsing. The remaining genuine gap (Phase 3 like/dislike signals) is carried narrowly as Tier 3 item 3.1. |
| **Encrypt OAuth Tokens at Rest** | **WON'T FIX — project owner decision, 2026-06-07.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. Implementation plan remains in PR #24 if priorities change. |
| **Centralize Token Refresh Logic** | Dropped along with OAuth token encryption (no longer has a parent item to attach to). |
| **"No usage/analytics instrumentation" framing (prior Tier 3 note)** | **CORRECTED, 2026-06-25.** This framing was inaccurate — `src/lib/analytics.ts` (PostHog) already existed and was already wired into 10 files before this assessment history began. Not dropped as in "wrong priority," but retracted as a factual correction; see note at top of this document. |

---

## Process Notes

- **`useMemorySessionSync` outgoing-session bug fixed 2026-06-26** — picked as the highest-priority incomplete Tier 1 item (newest, smallest, with an existing test already proving the bug) by the autonomous implementation routine. Branched as `feature/fix-memory-session-sync-outgoing-bug` directly off `origin/main` rather than waiting for this reassessment PR (#47) to merge, since the two changes don't overlap. If PR #47 merges separately, its next reassessment cycle should reconcile/dedupe this entry against the one being added here.
