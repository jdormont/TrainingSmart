# Build Plan: Weekly Review + Forgiving Adherence Score

Source: `brief-weekly-review.md` (2026-11-19). Findings below are from the code on `main` @ `2ee16e9`.

## 1. Answers to the brief's open questions

| # | Question | Finding | Consequence |
|---|----------|---------|-------------|
| 1 | Timezone on `user_profiles`? | **No.** `UserProfile` has no timezone field. The only `Intl...resolvedOptions().timeZone` use is `googleCalendarService.ts:286`. | Add `timezone text` to `user_profiles` (new migration), written from the browser on first load/app start. The week boundary is computed in that zone. |
| 2 | Where does the 21-day streak logic live, and what tests cover it? | Two places. `streakService.ts` (377 lines) owns `user_streaks` (`current_streak`, `streak_history`, freezes). The **Level-Up trigger is in `milestoneService.checkLevelUp`** (`MIN_STREAK_DAYS = 21` OR `>= 8` activities in 28 days). It is called from `DashboardPage.tsx:242`. Level-Up state is in **localStorage** (accepted/dismissed). | The brief lists `streakService.ts` as the file to change, but the change belongs in `milestoneService.ts`. |
| | | Tests: `streakService.test.ts` covers only `getStreak` and `validateAndSyncLikely` (3 cases). **`milestoneService` has no tests at all.** | "Keep existing tests passing" is easy. We need to add `milestoneService.test.ts` first, pinning current behavior, then change it. |
| 3 | "Actual minutes" for a completed workout? | Not stored. `Workout.duration` is the *planned* minutes. Strava-matched workouts keep `match_metadata.moving_time` (seconds) only when linked via the match flow. Manually completed workouts have no actual duration. | Use `match_metadata.moving_time / 60` when present, else the planned duration (full credit). Document this in the service. |

## 2. Corrections to the brief

- `rpe` and `checkin_notes` are not workout columns. They live in the `activity_metadata` jsonb (`ActivityMetadata`, written by `saveWorkoutCheckin`). The adherence service should read them from there. RPE is not needed for the score; it can feed the review text as an aggregate.
- Adherence already exists in a simpler form: `memoryRollupService.buildPlanAdherence` (completed / scheduled count). Keep it. Do not unify in this change, but have the new service be the canonical minutes-based score, and note the difference.
- Dashboard has no Monday-Sunday week concept today. The helper has to be written (use `date-fns` `startOfWeek({ weekStartsOn: 1 })`, which the codebase already imports).
- Multiple workouts per day are now supported. The adherence logic must not assume one workout per day.
- "Substituted workouts" has no data model. Define it as: an unplanned (no `workout` row) Strava activity, or a completed workout whose actual type differs from the planned type. For v1 use the only signal that exists: a completed workout whose `match_metadata.type` differs from `workout.type` gets a flat partial credit. Unplanned activities are not counted (keep it simple, flag it).

## 3. Design decisions

**Score (`adherenceService.ts`, pure):**
- Inputs: `{ weekStart, planned: Workout[], excusedDates?: string[] }` plus optional actual minutes per workout, all passed in. No Supabase calls.
- Per workout: `planned = duration`; `credit = min(actual, planned)`:
  - `completed`, no actual data -> full credit
  - `completed` with actual -> `min(actual / planned, 1)`; floor of 0.5 so a short workout never reads as a near-miss
  - substituted (type mismatch) -> `0.75` of planned
  - `skipped` / still `planned` after the day -> 0
- Excused dates: workouts on those days are dropped from numerator and denominator (hook only, empty by default).
- `score = round(100 * sum(credit) / sum(planned))`, capped at 100. Empty plan (no scheduled workouts) -> `score: null` with `hasPlan: false` (distinct from 0; the brief's "empty week" case).
- Returns `{ score, plannedMinutes, completedMinutes, workoutsPlanned, workoutsCompleted, workoutsSkipped, avgRpe? , excusedCount }`.

**Edge Function `openai-weekly-review`:** follows the `openai-extract-context` pattern (`callAI`, `getCorsHeaders`, `requireString`/`requireEnum`/`optionalNumber`).
- Body: `{ stats, coachingStyle, persona, fitnessMode, customSystemPrompt? }`. Validate `stats` against an allow-list of numeric fields so nothing else (and no raw Strava data) can pass through.
- Prompt rules: ~120 words, one win, one honest observation, one adjustment; no shaming; Re-Engager: no TSS/CTL/zones; zero completed -> encouraging, never references the score as a failure.
- Add the Strava inference-only compliance header comment, as in the other functions.
- Auth: verify the JWT and rate limit per user (same in-memory limiter as `openai-chat`).
- Stateless: it returns text only. The client writes the row (keeps the function free of DB writes and RLS complexity).

**Lazy generation (`weeklyReviewService` + `useWeeklyReview`):**
- On first load, compute the last *completed* Monday-Sunday week in the user's timezone. Look it up in `weekly_reviews`.
- If missing: build stats from that week's workouts, call the Edge Function, then insert. The unique `(user_id, week_start)` plus `upsert ... ignoreDuplicates` makes a reload or two-tab race harmless (the loser re-reads the winner's row).
- If the LLM call fails: still persist the score and stats with `review_text` null and retry the text on the next load, so the score is never lost and no duplicate row appears.
- Skip generation if the user had no plan that week (`score: null`) unless there is something worth saying; show nothing rather than a hollow card.
- React Query key `['weekly-review', weekStart]`, `staleTime: Infinity`. No cron.

**Level-Up (`milestoneService.ts`):**
- New rule: at least 3 of the last 4 completed weeks with `adherence_score >= 70`. Weeks with `score: null` (no plan) do not count for or against; require >= 3 qualifying weeks.
- `checkLevelUp` becomes async or takes reviews as an argument. Prefer passing reviews in (keeps it pure and testable): `checkLevelUp(streak, fitnessMode, recentReviews)`.
- Keep `MilestoneStatus` fields (`weeksConsistent` is now qualifying weeks). Keep the old streak/activity rule as a fallback while a user has fewer than 4 reviews, so existing users are not locked out. This is a product call, flagged below.
- Keep localStorage accept/dismiss behavior unchanged.

**UI:** `WeeklyReviewCard` on the dashboard (score ring, 3 chips: workouts done/planned, minutes done/planned, one of RPE/streak, text, "Past reviews" drawer listing prior weeks). In Re-Engager mode hide any load/zone chip. Use `lucide-react` icons and the existing Midnight Pro tokens.

## 4. Build order (each step is a reviewable commit)

1. **Migration** `<ts>_weekly_reviews.sql`: table, unique `(user_id, week_start)`, RLS (select/insert/update own rows via `auth.uid() = user_id`), index on `(user_id, week_start desc)`. Second migration (or same file): `user_profiles.timezone text`.
2. **Types** in `src/types/index.ts`: `WeeklyReview`, `AdherenceStats`; add `timezone?` to `UserProfile`.
3. **`adherenceService.ts` + test** (pure). Vitest cases: full week, partial week, empty week, substituted workouts, plus excused-days hook, multi-workout day, determinism (same input twice).
4. **Timezone capture**: write the browser timezone to the profile (via `useProfileMutations` / `userProfileService`) when missing or changed.
5. **Edge Function `openai-weekly-review`** (+ `supabase/functions/openai-weekly-review/` Deno test for payload validation and the prompt builder, matching the existing sync-health Deno test).
6. **`weeklyReviewService.ts`** (week boundary helper, fetch week workouts, lookup/insert, generate) + tests with a mocked Supabase client, including the "reload does not duplicate" case.
7. **`useWeeklyReview`** hook (current review, list of past reviews).
8. **`WeeklyReviewCard`** + past-reviews drawer, mounted in `DashboardPage`.
9. **Level-Up change**: add `milestoneService.test.ts` pinning current behavior, then switch the rule and update the tests.
10. **Demo mode**: mock review in `mockDashboardData.ts`, wired through `useDashboardData`'s `isDemo` branch (the hook must not call the Edge Function or Supabase in demo mode).
11. **Docs**: short section in `PRD.md` (status list) and a line in `CLAUDE.md` for the new tables/function.

## 5. Acceptance mapping

| Criterion | How it is verified |
|-----------|--------------------|
| Deterministic score | `adherenceService.test.ts` (4 required cases + extras) |
| One review per user-week | unique constraint + upsert; service test simulating double load |
| No-workout week is encouraging | Edge Function prompt rule + a prompt-builder test asserting the instruction and that no score-failure wording is included; manual check |
| No raw Strava data to LLM | Edge Function allow-lists numeric stat fields; service test asserts the payload keys |
| Re-Engager sees no TSS/CTL/zones | prompt rule + card hides load chips; test on card props and prompt builder |
| RLS blocks other users | policy in migration; verify with two users via `execute_sql` on a Supabase branch |
| `vitest run`, `lint`, `build`, `?demo=true` | run before each commit; browser check of demo card with Playwright |

## 6. Risks and decisions for you

1. **Level-Up fallback.** Switching strictly to weekly rule means no existing user can qualify until 4 weeks of reviews exist. Recommended: keep the old rule as a fallback for users with < 4 reviews. Confirm?
2. **Backfill.** Should the first load generate reviews only for the most recent week (recommended, one LLM call), or backfill up to 4 weeks so Level-Up works immediately? Backfill costs up to 4 calls once per user.
3. **Plan-less weeks.** Recommended: no review and no card. Alternative: a gentle "nothing planned" card.
4. **Substitution definition** (section 2) is a v1 approximation; unplanned activities are ignored.
5. **Manually completed workouts** get full credit because actual minutes are unknown (open question 3). This is generous, which fits the "forgiving" goal.
6. **Edge Function deploy.** The function and migrations must be deployed to Supabase separately from the Vercel deploy; the card should degrade gracefully (score only) if the function is unavailable.
7. **Model cost/limits.** One ~120-word call per user per week is negligible; the existing per-user rate limiter covers abuse.

## 7. Out of scope (per brief)

Push/email delivery, sharing, cron, plan-generation changes, illness/travel pause mode (hook only).
