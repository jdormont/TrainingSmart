# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TrainingSmart AI — an AI cycling/endurance coach SPA. It pulls activity data (Strava), recovery data (Oura ring, Apple Health), runs it through an LLM, and produces personalized training advice, dashboards, and adaptive training plans. Originally scaffolded with Bolt (`.bolt/`).

## Commands

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build → dist/
npm run lint       # ESLint over the repo
npm test           # Vitest (watch mode)
npx vitest run     # Vitest single pass (CI-style)
npx vitest run src/services/streakService.test.ts   # run one test file
```

There is no separate `vitest.config`; Vitest reads `vite.config.ts`. Tests live next to their source as `*.test.ts` under `src/services/` (and one Deno test under `supabase/functions/sync-health/`).

## Architecture

**Frontend:** React 18 + TypeScript + Vite SPA, React Router 7, `@tanstack/react-query` for server state, Tailwind ("Midnight Pro" dark theme, `bg-slate-950`). Icons from `lucide-react` only.

**Backend:** Supabase — Postgres with Row-Level Security, Auth, and Deno **Edge Functions** under `supabase/functions/`. There is no custom Node server; all backend logic is Edge Functions plus direct Supabase client calls.

**Three layers to keep distinct:**

1. **`src/services/`** — the data layer. ~30 single-responsibility modules, each owning one domain (`stravaApi`, `ouraApi`, `openaiApi`, `trainingPlansService`, `recommendationService`, `healthMetricsService`, `streakService`, etc.). Components and hooks should call services, not Supabase/fetch directly. `supabaseClient.ts` exports the singleton `supabase` client and hand-maintained `Database` types.
2. **`src/hooks/`** — React Query wrappers (`useDashboardData`, `usePlanData`, `useChatSessions`, `useBackgroundSync`). These compose multiple services into the data a page needs and own caching/refetch. `useBackgroundSync` runs app-wide (mounted in `App.tsx`) to sync health/activity data.
3. **`src/components/` + `src/pages/`** — presentation. Pages are routed in `App.tsx`; nearly all are wrapped in `ProtectedRoute` + `ErrorBoundary`. Feature folders mirror the domains (`dashboard/`, `plans/`, `chat/`, `auth/`, `onboarding/`).

**Secrets boundary (important):** Client secrets and the OpenAI/Anthropic key must NEVER reach the browser bundle. Only `VITE_`-prefixed *public* values (client IDs, Supabase URL/anon key) belong in `.env`. All LLM calls, OAuth token exchange/refresh, and the YouTube key go through Edge Functions (`openai-*`, `strava-oauth-exchange`, `strava-refresh-token`, `youtube-search`). Despite filenames, `src/services/openaiApi.ts` builds context/prompts client-side but the actual model call is proxied server-side.

**AI provider abstraction:** `supabase/functions/_shared/ai-provider.ts` (`callAI`) abstracts OpenAI vs Anthropic, switched by Supabase secrets `AI_PROVIDER` (`openai`|`anthropic`) and optional `AI_MODEL`. All `openai-*` Edge Functions route through it. When changing prompts or model behavior, edit there + the relevant function, not just the client service.

**Edge Function conventions:** Use `_shared/cors.ts` (`getCorsHeaders`, `handleOptions`) for CORS and `_shared/validate.ts` (`requireString`, `requireArray`, etc.) for input validation. LLM endpoints (e.g. `openai-chat`) enforce in-memory per-user rate limiting (30 req/min). Deno runtime — imports use `npm:`/`jsr:` specifiers per `supabase/functions/deno.json`, not `package.json`.

## Key cross-cutting concepts

- **Demo mode:** append `?demo=true` to any URL to render with mock data from `src/data/mockDashboardData.ts` (no Strava/login needed). `useDashboardData` branches on this early — preserve the branch when editing dashboard data flow.
- **Strava ↔ plan reconciliation:** workouts carry `strava_activity_id`, `activity_match_score`, `auto_matched`, `match_metadata`. Heuristic auto-matching of real activities to planned workouts lives in `trainingPlansService.ts`. See `STRAVA_COMPLIANCE.md` — Strava data is inference-only context, never used to train models; keep that invariant.
- **Health/recovery scoring:** recovery score blends Sleep + HRV + Resting HR (`healthMetricsService`, `sleepScoreCalculator`, `dailyMetricsService`). Calculation details are documented in `HEALTH_METRICS.md`.
- **Chat → plan:** chat sessions can spawn training plans; `training_plans` rows store `source_chat_session_id` and `chat_context_snapshot`. Context extraction is `openai-extract-context` / `chatContextExtractor.ts`.
- **Markdown safety:** all LLM markdown is rendered through `src/utils/markdownToHtml.ts` with DOMPurify. Don't bypass it with `dangerouslySetInnerHTML`.
- **Constants:** routes, storage keys, OAuth scopes, and config live in `src/utils/constants.ts` (`ROUTES`, `STORAGE_KEYS`, `STRAVA_CONFIG`, `OURA_CONFIG`). Use these rather than string literals.
- **Shared types:** `src/types/index.ts` is the canonical domain model (`Workout`, `StravaActivity`, `DailyMetric`, `PlanReasoning`, `ContentItem`, etc.).

## Database

Migrations are append-only SQL files in `supabase/migrations/` (timestamp-prefixed). Add a new migration rather than editing existing ones. Core tables: `user_profiles`, `training_plans`, `workouts`, `daily_metrics`, `chat_sessions`, `user_streaks`, `strava_activities_cache`, `plan_templates`. RLS policies scope every row to the authenticated `user_id`.

## Local proxy quirk

Oura API calls are proxied through `/api/oura` to avoid CORS/WAF issues — handled by a Vite dev proxy (`vite.config.ts`, strips cookies/origin) locally and a Vercel rewrite (`vercel.json`) in production. Deployment target is Vercel (SPA rewrite to `index.html`).

## Reference docs

Domain/integration details live in top-level markdown: `technical-architecture.md`, `PRD.md`, `HEALTH_METRICS.md`, `STRAVA_COMPLIANCE.md`, `OURA_INTEGRATION.md`, `APPLE_HEALTH_SYNC.md`, `GOOGLE_CALENDAR_SETUP.md`, `RIDER_PROFILE_METRICS.md`.
