# Improvements
_Last assessment: 2026-06-22_
_Last knowledge sync: 2026-06-22_
_Assessment based on: `git fetch origin` + `git log origin/main` (HEAD `e88d525`, branch `assessment/2026-06-22` cut directly from `origin/main`); GitHub PRs via `mcp__github__pull_request_read` checked individually for #38–#42 (the bulk `list_pull_requests` call returned a stale/incorrect `merged:false` for every PR in this environment — cross-checked against `git log` and the per-PR `get` call, which correctly reports `merged:true` and matches commits present on `main`); open issues (none — `mcp__github__list_issues` returns empty); PRD.md re-read in full (section 3.3/3.5 INCOMPLETE items unchanged); fresh code inspection of `useBackgroundSync.ts` (now has the cooldown guard + gated logging from PR #38), `stravaCacheService.ts` (`: any` count, re-grepped), `PlansPage.tsx` (1,803 lines, confirmed byte-identical line count to last cycle despite PR #40 touching it), `SettingsPage.tsx` (grew 1,163 → 1,464 lines from the new Memory tab in PR #42), and the new `userMemoryService.ts` / `useUserMemory.ts` / `useMemorySessionSync.ts` / `openai-update-memory` surface from PR #42 (new finding, see Tier 1 below)._

_Note: `npx vitest run` / `npm run lint` / `npm run typecheck` could not be executed this cycle — `node_modules` is not installed in this environment (`npx vitest run` fails with `ERR_MODULE_NOT_FOUND` for `vitest`/`@vitejs/plugin-react`). Test-suite pass/fail status is carried forward from each PR's own CI verification footnotes (most recent confirmed: PR #41 at 188/188 passing; PR #42 does not report a vitest count in its test plan — see Tier 1 finding below)._

---

## Current Sprint

### Add Test Coverage for the New Persistent-Memory Feature (PR #42) — `[IN PROGRESS — branch: claude/optimistic-meitner-j486b7, started: 2026-06-22]`

- **What:** PR #42 added `src/services/userMemoryService.ts` (311 lines), `src/hooks/useUserMemory.ts`, `src/hooks/useMemorySessionSync.ts`, and the `openai-update-memory` edge function — all with **zero automated test coverage**. The PR's own test plan left 4 of 5 checklist items unchecked (RLS verification, end-to-end system-prompt injection, multi-session audit-trail behavior, Settings edit/delete persistence) — all manual-only, none executed in this sandbox. This code also sits directly on the chat system-prompt construction path (`buildSystemPrompt()`), so a bug here silently degrades every chat response, not just the Memory tab.
- **Why now:** This is the freshest, highest-blast-radius code in the repo (1,035 lines, new RLS-protected tables, new edge function) and is currently the single biggest gap between "shipped" and "verified." Catching this in the cycle right after it lands is far cheaper than after a second feature builds on top of `userMemoryService.ts`.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —

---

## Recently Completed ✓

| Item | Done | Reference |
|------|------|-----------|
| Throttle/skip redundant reconciliation pass on tab focus + test coverage (Tier 1.1/1.2, prior Current Sprint) | 2026-06-19 | **PR #38 merged** (`5dc821a`). Added a 60s cooldown guard (`useRef` timestamp) around `visibilitychange`-triggered syncs in `useBackgroundSync.ts`, gated the hook's `console.log` calls behind `import.meta.env.DEV`, and added `src/hooks/useBackgroundSync.test.ts` (new, previously zero coverage) covering stale/fresh-cache branches, the cooldown guard, and conditional Oura sync. Reported 169/169 tests passing. Verified in this cycle's code read: the cooldown guard and gated `log()` helper are present in the current `useBackgroundSync.ts`. |
| Expand chat context with full user profile + raise token limits | 2026-06-19 | PR #39 merged (`5ce580c`). Not a previously tracked IMPROVEMENTS item, but a real product fix: `ftp`, `gender`, `age_bucket`, `fitness_level` were collected in Settings but never reached the AI coach's system prompt; `MAX_TOKENS` raised 2000→4096 client-side / 4000→8192 edge-function ceiling to stop premature truncation. Noted here so it isn't re-flagged. |
| Strava power curves, segment effort, and elevation-power correlation (Dashboard + Chat) | 2026-06-21 | PR #40 merged (`20a7b75` + `fa47147` + `f9263f8`). New `elevation_power_profile`, extended power-curve durations (4→10), segment grade/elevation/climb-category, new Power Curve dashboard tab and Power-by-Terrain chart. Reported 184/184 tests passing. Directly advances PRD 2.3/2.4 ("Power Analysis"). |
| Fix Strava enrichment excluding VirtualRide/EBikeRide/TrailRun activities | 2026-06-21 | PR #41 merged (`6388a2c`). Root-caused why indoor-trainer (Zwift VirtualRide) power data never populated the new Power Curve view — `enrichRecentActivities()` matched activity type by exact string equality only. Broadened to substring/case-insensitive match via new exported `isEnrichableActivityType()`. Reported 188/188 tests passing. |
| Persistent user memory for the AI coach | 2026-06-22 | PR #42 merged (`e88d525`). New `user_memory` + `user_memory_audit` tables (owner-scoped RLS confirmed in this cycle's read of `20260621000000_create_user_memory.sql`), `openai-update-memory` edge function, memory re-injected into `buildSystemPrompt()`, and a new Settings → Memory tab. This is the single largest feature addition this cycle (1,035 additions) but landed with **no automated test coverage** — picked up this cycle as the Current Sprint item above. |

---

## Tier 1 — Quick Wins

### 1.1 Eliminate `: any` in `stravaCacheService.ts` — OPEN _(carried, count increased)_
- **What:** `stravaCacheService.ts` now has **17** `: any` usages (was 14 last cycle) — grew because PR #40's segment-effort/grade-stream/elevation-power additions used the same untyped pattern as the existing code they extended (`laps.map((l: any) => ...)`, `streams.find((s: any) => ...)`, zone-distribution lookups, row-mapping casts). Still the single largest concentration of `any` in `src/`.
- **Why now:** The gap is now widening, not just sitting static — every new Strava field added to this file (this cycle: grade streams, segment grade/elevation, elevation-power profile) compounds on an already-untyped base, and the file is actively being extended (3 commits touched it this cycle alone). Fixing now is cheaper than after a 4th feature lands on top.
- **Effort estimate:** S–M (1–2 days)
- **Actual effort:** —
- **Agent prompt:** "In `src/services/stravaCacheService.ts`, eliminate the 17 `: any` usages (`grep -n ': any' src/services/stravaCacheService.ts` for exact lines — includes the newer `gradeStream`/segment-effort grade fields from PR #40). Define typed interfaces for the Strava detailed-activity shape actually consumed — `StravaLap`, `StravaSegmentEffort`, `StravaZoneDistribution`, `StravaStream` (now including `grade_smooth`) — covering only the fields this file reads. Replace `(detailedActivity as any)` casts and inline `(x: any)` callback params with these types. Run `npx vitest run` and confirm `stravaCacheService.test.ts` still passes with no behavior change, then `npx tsc --noEmit` for zero new errors."

---

### 1.2 SettingsPage Modularization — OPEN _(carried, file grew 26% this cycle)_
- **What:** `SettingsPage.tsx` grew from 1,163 to **1,464 lines** this cycle — the new Memory tab (PR #42) landed directly in the monolith, the third time in a row a new settings feature has compounded this file rather than being extracted. `src/components/settings/` still contains only `CoachSpecializationSelector.tsx` and `Integrations.tsx`.
- **Why now:** This item has been open for several cycles as a moderate-priority cleanup; the fact that the newest feature (Memory) landed straight into the monolith instead of as its own component is a concrete sign the cost is compounding now, not hypothetically. Promoting to Tier 1 this cycle because the next settings feature (and there has been one almost every cycle recently) will make this materially harder to safely extract.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Complete the modularization of `src/pages/SettingsPage.tsx`. Extract: (1) `StravaConnectionCard.tsx`; (2) `OuraIntegrationCard.tsx`; (3) `RiderProfileForm.tsx` (using `useSaveRiderProfile` from `useProfileMutations.ts`); (4) `ContentInterestsCard.tsx`; (5) `CyclingDigestFiltersCard.tsx`; (6) `MemoryTab.tsx` (using `useUserMemory.ts`, the newest and least-entangled tab — good first extraction to validate the pattern). `SettingsPage.tsx` should become a layout shell under 200 lines. Run `npm run typecheck` and verify all existing tests still pass."

---

## Tier 2 — Next Sprint

### 2.1 Split Monolithic PlansPage.tsx (1,803 lines) — OPEN _(carried, unchanged — 11th consecutive assessment)_
- **What:** `PlansPage.tsx` remains exactly 1,803 lines — confirmed unchanged net line count for the 11th consecutive assessment (PR #40 did touch this file per its diff stat, but net lines settled back to the same count). Still owns plan list rendering, plan creation flow, workout status management, drag-and-drop orchestration, the Level-Up modal, the Plan Logic Viewer, and the Post-Workout Check-in modal.
- **Why now:** Prerequisite for the accessibility audit (2.3) and for safe component-level testing. Tier 1 capacity this cycle went to the new memory-feature test gap and the growing `stravaCacheService.ts`/`SettingsPage.tsx` items, so this is held at Tier 2 again — but it is the named blocker for 2.3 below, which is now at a staleness decision point.
- **Effort estimate:** L (3–5 days)
- **Actual effort:** —
- **Agent prompt:** "Refactor `src/pages/PlansPage.tsx` into focused sub-components without changing any visible behavior or styling. Extract: (1) `src/components/plans/PlanListSidebar.tsx`; (2) `src/components/plans/LevelUpModal.tsx`; (3) `src/components/plans/PlanStatsDrawer.tsx`; (4) `src/components/plans/CreatePlanForm.tsx`. Move associated state/handlers into a new `src/hooks/usePlanPage.ts` hook. Target: `PlansPage.tsx` under 300 lines, orchestration only. Verify CI passes and all existing tests still pass."

---

### 2.2 Eliminate TypeScript `any` in `trainingPlansService.ts` and Remaining Files — OPEN _(carried, unchanged)_
- **What:** Remaining `: any` usages outside `stravaCacheService.ts`: `trainingPlansService.ts` (8, unchanged across 11 assessments), `PlansPage.tsx` (7), `supabaseChatService.ts` (5), `useChatSessions.ts` (3), plus singletons in `riderProfileService.ts`, `openaiApi.ts`, `contentFeedService.ts`, `ChatPage.tsx`, `useDashboardData.ts`, `HealthSpiderChart.tsx`, `AuthPage.tsx`, `RecoveryCard.tsx`, `DailyActivityCard.tsx`.
- **Why now:** `trainingPlansService.ts`'s 8 `any`s mask DB response shape mismatches in the service every plan mutation depends on; fixing before 2.1's `PlansPage.tsx` split means new sub-components inherit clean types.
- **Effort estimate:** M (2–3 days)
- **Actual effort:** —
- **Agent prompt:** "Eliminate TypeScript `any` usages in `src/services/trainingPlansService.ts` (8 occurrences). Replace `dbPayload: any` with a typed `DbWorkoutInsert` interface; replace `(data as any[]).map(...)` with a typed `DbPlanRow` interface from the migration columns. Then address the `PlansPage.tsx` `queryClient.setQueryData` casts and the `useChatSessions.ts` row-mapping `any`s. Run `npm run typecheck` with `strict: true` to verify zero `any`-related errors in these files. `stravaCacheService.ts` is covered separately by Tier 1 item 1.1."

---

### 2.3 Accessibility Audit and WCAG 2.1 AA Remediation — OPEN _(11th consecutive assessment without movement — staleness rule applies, escalation decision below)_
- **What:** No ARIA labels, keyboard navigation, or focus management exist across the app outside of `ConsistencyHeatmap.tsx` (remediated via PR #32, 11 cycles ago). Drag-and-drop workout cards and the Recharts power/elevation charts (now including PR #40's new Power Curve and Power-by-Terrain charts) remain highest-risk for screen readers and keyboard-only users.
- **Why now / staleness assessment:** This is the 11th consecutive assessment without the broader audit starting. Per the staleness rule (3+ consecutive cycles without movement → escalate or drop), this item was already escalated once (Tier 3 → Tier 2) and has now exceeded that threshold again at Tier 2 itself. **Decision: do not escalate to Current Sprint yet** — the stated prerequisite (2.1, `PlansPage.tsx` split) still has not landed, and starting the audit against a 1,803-line monolith would mean redoing the work after 2.1 ships. Holding at Tier 2 is the correct call structurally, but flagging explicitly: if 2.1 lands next cycle and this still hasn't started, it must become the Current Sprint item directly, with no further deferral language — this is the second consecutive cycle saying so.
- **Effort estimate:** L (1–2 weeks)
- **Actual effort:** —
- **Agent prompt:** "Conduct and remediate an accessibility audit for TrainingSmart, using the remediated `ConsistencyHeatmap.tsx` (PR #32) as reference pattern. Install `eslint-plugin-jsx-a11y`, run `npx eslint src/ --fix`. Then manually address: (1) all modal overlays — add `role='dialog'`, `aria-modal='true'`, `aria-labelledby`, focus trapping via a new `useFocusTrap` hook; (2) drag-and-drop workout cards — `role='button'`, `aria-grabbed`, arrow-key support; (3) icon-only buttons app-wide — descriptive `aria-label`; (4) Recharts charts (now including the new Power Curve, Power-by-Terrain, and Elevation-Power Correlation charts from PR #40) — wrap in `<figure>` with `aria-label` summary."

---

## Tier 3 — Strategic

### 3.1 Curation Feed Phase 3 — Like/Dislike Signal Capture — OPEN _(carried, unchanged)_
- **What:** Neither YouTube cards nor the cycling-news digest have any feedback mechanism (thumbs up/down, save/hide). Per PRD 3.5, this is the explicit Phase 3 gap, and it's also the cheapest lever toward eventually answering "do users actually engage with the digest" — a question Tier 2's accessibility-priority discussion has repeatedly needed and couldn't answer for lack of instrumentation.
- **Why now:** Worth planning, not yet building — it's a new table + simple UI affordance, but the bigger unknown is whether engagement with the existing digest justifies further investment in this direction at all (see instrumentation note below).
- **Effort estimate:** M (add `liked_content(user_id, content_url, signal, created_at)` table + UI affordances)
- **Agent prompt:** "Add a `liked_content` table (migration) and thumbs up/down buttons on cycling-digest headlines and YouTube cards in the Learn page, recording `signal: 'like' | 'dislike'`. No ranking/ML logic yet — just capture, to inform a future re-scoping of the Curation Feed roadmap."

### 3.2 Recurring Season Schedules — OPEN _(carried, unchanged — 7th consecutive cycle, no traction)_
- **What:** XL effort (3–4 weeks) periodized recurring-season scheduling feature (PRD 3.3, marked INCOMPLETE). No groundwork has been laid.
- **Why now:** Still strategic-only; revisit when the performance-athlete segment reaches scale, as previously decided. Carried again rather than dropped — this is genuinely a "wait for signal" item, not a stalled one we're failing to prioritize.
- **Effort estimate:** XL (3–4 weeks)

_Only two Tier 3 items exist this cycle, same as last cycle. A third would be speculative without better usage data — see the instrumentation note below, carried again because it remains unaddressed and is the actual blocker to sharpening Tier 3._

_To sharpen the next assessment: there is still no usage/analytics instrumentation telling us which dashboard, chat, or settings sections users actually interact with most. This now directly blocks three decisions: (a) whether 3.1's like/dislike capture is worth building, (b) which screens matter most for the 2.3 accessibility audit once it starts, and (c) whether the new Memory feature (PR #42) is actually being used/edited by anyone, which would justify further investment vs. treating it as done. Recommend adding lightweight pageview/interaction analytics (e.g. extending existing Sentry breadcrumbs, or a minimal PostHog/Plausible integration) as a standalone near-term item if no other instrumentation surfaces first._

---

## Dropped / Stale

| Item | Reason |
|------|--------|
| **Curation Feed Phase 2 (RSS/article integration)** | **DROPPED — superseded, 2026-06-18.** The cycling-news-digest feature (`fb2102f`) delivers the same "curated written content" value via AI-summarized headlines rather than RSS parsing. The remaining genuine gap (Phase 3 like/dislike signals) is carried narrowly as Tier 3 item 3.1. |
| **Encrypt OAuth Tokens at Rest** | **WON'T FIX — project owner decision, 2026-06-07.** Plaintext Strava/Google tokens in `user_tokens` remain a known, accepted risk. Implementation plan remains in PR #24 if priorities change. |
| **Centralize Token Refresh Logic** | Dropped along with OAuth token encryption (no longer has a parent item to attach to). |
