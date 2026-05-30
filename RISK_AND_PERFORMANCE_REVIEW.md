# TrainingSmart — Risk & Performance Review

> Reviewed: 2026-05-30  
> Stack: React 18 / TypeScript / Vite / Supabase (PostgreSQL + Edge Functions / Deno) / React Query v5

---

## Summary

TrainingSmart is a well-structured SPA with solid data-fetching patterns, clean service/hooks/component separation, and a secure OAuth token-exchange via Edge Functions. The primary concerns are an XSS exposure in markdown rendering, API keys leaking into the browser, low test coverage, and a few query-efficiency issues. None of these are showstoppers, but the XSS and API-key items should be addressed before scaling to more users.

---

## Priority 1 — Critical (Address Immediately)

### 1. XSS via `dangerouslySetInnerHTML` + `marked`
**Risk: High | Effort: Low** ✅ **FIXED — 2026-05-30**

`marked.parse()` output is rendered with `dangerouslySetInnerHTML` in at least six components (WorkoutCard, ChatPage, PlansPage, and others). If OpenAI ever returns attacker-influenced markdown (e.g., via prompt injection), it executes as HTML in the user's browser.

**Fix:** Add `dompurify` and sanitize before rendering.
```ts
import DOMPurify from 'dompurify';
// Replace:
dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
// With:
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content)) }}
```

**Implementation:** `dompurify` installed. `convertMarkdownToHtml()` in `src/utils/markdownToHtml.ts` now runs `DOMPurify.sanitize()` with a strict allowlist before any Tailwind class injection. Covers all 4 call sites in a single place.

---

### 2. API Keys Exposed in the Browser Bundle
**Risk: High | Effort: Medium** ✅ **FIXED — 2026-05-30**

`VITE_YOUTUBE_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY` are Vite-prefixed env vars, which means they are baked into the JS bundle and visible to anyone who opens DevTools. The `.env.example` file even contains comments noting they should be moved to the backend — but they haven't been.

**Fix:** Create thin Supabase Edge Function proxies for YouTube search and Maps lookups; remove `VITE_` prefix from those keys so they never reach the browser.

**Implementation:** New `supabase/functions/youtube-search/index.ts` proxy handles all 3 YouTube Data API call patterns (`search`, `channel`, `videos`). All 3 call sites in `contentFeedService.ts` now POST to the proxy via `youtubeProxy()`. `VITE_YOUTUBE_API_KEY` removed from `.env.example`. Set `YOUTUBE_API_KEY` as a Supabase secret: `supabase secrets set YOUTUBE_API_KEY=<key>`.

---

### 3. N+1 Query in Chat Session Loading
**Risk: High | Effort: Low** ✅ **FIXED — 2026-05-30**

`supabaseChatService.ts` fetches a list of sessions and then issues a separate `SELECT` query per session to load its messages. Under React Query's 5-minute stale window this can fire 10–20+ sequential database round-trips on first load.

**Fix:** Join messages in the initial query or use a single `IN` clause:
```ts
// Single query: fetch sessions + messages together
const { data } = await supabase
  .from('chat_sessions')
  .select('*, chat_messages(*)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**Implementation:** `getSessions()` and `getSession()` both use `select('*, chat_messages(*)')`. The old async `dbSessionToChatSession` method replaced with a synchronous `mapDbSession` mapper. Always 1 round-trip regardless of session count.

---

### 4. No Input Validation on Edge Function Request Bodies
**Risk: High | Effort: Medium** ✅ **FIXED — 2026-05-30**

Edge functions destructure request bodies directly with no schema enforcement. An oversized or malformed payload can crash a function or, in the worst case, pollute a downstream OpenAI prompt.

**Fix:** Add [Zod](https://zod.dev) (or a small Deno-compatible schema library) to each Edge Function's entry point and reject invalid requests with a `400` before any business logic runs.

**Implementation:** New `supabase/functions/_shared/validate.ts` provides `requireString`, `requireArray`, `optionalNumber`, `requireEnum`, and `ValidationError` (HTTP 400) — no external dependencies. Applied to `openai-chat`, `openai-training-plan`, `openai-modify-plan`, `openai-extract-context`, `admin-update-user-status`, and `strava-refresh-token`.

---

## Priority 2 — High (Next Sprint)

### 5. Low Test Coverage (~10%)
**Risk: Medium | Effort: High**

Only 6 test files exist across 50+ service files. Core business logic (plan generation orchestration, health metric scoring, streak merging, Strava sync) is untested. A regression here is invisible until a user reports it.

**Target:** Reach 50%+ coverage within two sprints, prioritising:
- `trainingPlansService.ts` (plan creation / modification)
- `healthMetricsService.ts` (FTP, HRV scoring)
- `streakService.ts` (already partially tested — extend it)
- Edge function happy-path + error flows

---

### 6. React Error Boundaries Missing
**Risk: Medium | Effort: Low** ✅ **FIXED — 2026-05-30**

There are no `<ErrorBoundary>` components wrapping routes or major UI sections. An unhandled render error anywhere crashes the entire app.

**Fix:** Wrap each page-level route with an `<ErrorBoundary>` that shows a recovery UI and logs to a monitoring service (see item 14).

**Implementation:** New `src/components/common/ErrorBoundary.tsx` with a styled recovery UI (dark theme, "Try again" / "Go to home" buttons). Error detail shown in DEV mode only. All 6 protected routes + onboarding wrapped in `App.tsx`.

---

### 7. Unencrypted OAuth Tokens in Database
**Risk: Medium | Effort: Medium**

Google Calendar and Strava refresh tokens are stored in plaintext in the `user_tokens` / `strava_tokens` tables. If the Supabase project is ever compromised, all tokens are immediately usable by an attacker.

**Fix:** Encrypt tokens at rest using Supabase Vault (`pgsodium`) before inserting, and decrypt inside Edge Functions only when needed.

---

### 8. Anonymous Sessions Use Non-Cryptographic IDs
**Risk: Medium | Effort: Low** ✅ **FIXED — 2026-05-30**

`authService.ts` generates anonymous session IDs using `Date.now() + Math.random()` — not `crypto.randomUUID()`. While not directly exploitable, predictable IDs raise the likelihood of session collision or enumeration.

**Fix:**
```ts
// Replace:
const sessionId = `anon_${Date.now()}_${Math.random().toString(36)}`;
// With:
const sessionId = `anon_${crypto.randomUUID()}`;
```

**Implementation:** One-line change in `authService.ts`. `crypto.randomUUID()` is available natively in all modern browsers and Node ≥ 15.

---

### 9. Wildcard CORS on Edge Functions
**Risk: Medium | Effort: Low** ✅ **FIXED — 2026-05-30**

All Edge Functions return `Access-Control-Allow-Origin: *`. This is acceptable for public read endpoints but inappropriate for write/admin endpoints that rely on auth cookies or tokens.

**Fix:** Restrict CORS to your production domain(s) for mutation and admin endpoints.

**Implementation:** New `supabase/functions/_shared/cors.ts` provides `getCorsHeaders(req)` which validates the request `Origin` against an allowlist (`trainingsmart.joshdormont.com`, `localhost:5173`, `localhost:4173`) and echoes it only when matched. Applied to all 10 Edge Functions. Admin endpoints get strict restricted CORS; `send-signup-notification` (Supabase webhook) retains wildcard via `allowWildcard=true`.

---

### 10. Rate Limiting — None at the Application Layer
**Risk: Medium | Effort: Medium** ✅ **FIXED — 2026-05-30**

Sign-up, login, and OpenAI-proxy endpoints have no rate limiting. A scripted attacker can generate unlimited accounts or run up OpenAI costs.

**Fix:** Add Supabase's built-in auth rate limiting (already configurable in the dashboard) and add an invocation counter + per-user throttle in the OpenAI Edge Functions.

**Implementation:** Per-IP in-memory rate limiter added to `openai-chat/index.ts`: 30 requests/minute, returns `429 Too Many Requests`. Resets on function cold start (appropriate for abuse deterrence without requiring a Redis dependency).

---

## Priority 3 — Medium (Q3 2026)

### 11. Large, Monolithic Page Components
**Risk: Low-Medium | Effort: Medium**

Three files exceed 900 lines and are hard to review, test, or modify safely:
- `PlansPage.tsx` — 1,382 lines
- `SettingsPage.tsx` — 1,118 lines
- `trainingPlansService.ts` — 930 lines

**Fix:** Break each into domain-scoped sub-components / sub-services. Start with `SettingsPage.tsx` (tab-per-file pattern is straightforward).

---

### 12. Missing Cache Invalidation After Mutations
**Risk: Low-Medium | Effort: Low**

React Query caches are not explicitly invalidated after plan creation, workout status updates, or metric syncs. Users occasionally see stale data until the 5-minute TTL expires.

**Fix:** Call `queryClient.invalidateQueries()` with the appropriate keys inside mutation `onSuccess` callbacks.

---

### 13. No Database Transactions for Multi-Step Operations
**Risk: Low-Medium | Effort: Medium**

Creating or modifying a training plan involves inserting/updating both `training_plans` and `workouts` records in separate Supabase calls. A network failure mid-way leaves the database in a partially-written state.

**Fix:** Wrap related mutations in a Postgres transaction via a Supabase RPC function (stored procedure), or combine them into a single Edge Function call that uses a transaction.

---

### 14. No Structured Logging or Error Monitoring
**Risk: Low-Medium | Effort: Low**

There are 183 `console.error` / `console.warn` calls scattered throughout the codebase. Production errors are invisible unless a developer has DevTools open.

**Fix:** Add [Sentry](https://sentry.io) (or equivalent) to capture uncaught errors, Edge Function exceptions, and React Error Boundary reports. Replace raw `console.error` in services with a structured logger (`pino` or a thin wrapper).

---

### 15. Duplicate Token-Refresh Logic
**Risk: Low | Effort: Low**

Token refresh code is duplicated between `stravaApi.ts` and `authService.ts`. Inconsistencies between the two implementations have already surfaced at least once (per git history).

**Fix:** Centralise refresh logic in a single `tokenRefreshService.ts` and have both callers delegate to it.

---

## Priority 4 — Low / Nice-to-Have

### 16. No Code Splitting on Routes
**Impact: Performance | Effort: Low**

All page components are eagerly imported. Recharts and `marked` together add ~200 KB to the initial bundle even for users who never visit the Plans or Chat pages.

**Fix:**
```ts
const PlansPage = React.lazy(() => import('./pages/PlansPage'));
```
Wrap in `<Suspense>` with a skeleton fallback.

---

### 17. Loose TypeScript (`any` in 214 Places)
**Impact: Maintainability | Effort: Medium**

214 uses of `any` reduce the value of the TypeScript investment, particularly in API response handling and edge function payloads.

**Fix:** Progressively replace `any` with typed interfaces — start with service-layer return types and API response shapes.

---

### 18. Admin Panel for Profile Approval
**Impact: Ops | Effort: Medium**

A PENDING → APPROVED profile workflow exists in the database and Edge Functions, but there is no admin UI. Approvals must be done directly via SQL, which is operationally risky.

**Fix:** Build a minimal `/admin` route (gated behind RLS `is_admin` check) with a user list and approve/reject buttons.

---

### 19. Accessibility Audit
**Impact: Compliance | Effort: Medium**

No ARIA labels or keyboard-navigation patterns were observed in the component review. Forms and drag-and-drop workout cards are the highest-risk areas.

**Fix:** Run `axe-core` or `eslint-plugin-jsx-a11y` in CI and address WCAG 2.1 AA violations.

---

### 20. CI/CD Pipeline
**Impact: Reliability | Effort: Medium**

No GitHub Actions workflow exists. Deployments rely on manual Vercel pushes and manual Supabase migration runs.

**Fix:** Add a workflow that runs `tsc --noEmit`, `eslint`, `vitest`, and `supabase db push` on every PR, with Vercel preview deployments gated on green checks.

---

## Quick Reference Table

| # | Item | Risk | Effort | Priority | Status |
|---|------|------|--------|----------|--------|
| 1 | XSS via dangerouslySetInnerHTML | 🔴 High | Low | **P1** | ✅ Fixed |
| 2 | API keys in browser bundle | 🔴 High | Medium | **P1** | ✅ Fixed |
| 3 | N+1 query in chat loading | 🔴 High | Low | **P1** | ✅ Fixed |
| 4 | No Edge Function input validation | 🔴 High | Medium | **P1** | ✅ Fixed |
| 5 | Low test coverage (~10%) | 🟠 Medium | High | **P2** | ⬜ Open |
| 6 | No React Error Boundaries | 🟠 Medium | Low | **P2** | ✅ Fixed |
| 7 | OAuth tokens stored in plaintext | 🟠 Medium | Medium | **P2** | ⬜ Open |
| 8 | Non-cryptographic anonymous IDs | 🟠 Medium | Low | **P2** | ✅ Fixed |
| 9 | Wildcard CORS on all endpoints | 🟠 Medium | Low | **P2** | ✅ Fixed |
| 10 | No application-layer rate limiting | 🟠 Medium | Medium | **P2** | ✅ Fixed |
| 11 | Monolithic page components | 🟡 Low-Med | Medium | **P3** | ⬜ Open |
| 12 | Missing React Query cache invalidation | 🟡 Low-Med | Low | **P3** | ⬜ Open |
| 13 | No DB transactions for multi-step ops | 🟡 Low-Med | Medium | **P3** | ⬜ Open |
| 14 | No structured logging / error monitoring | 🟡 Low-Med | Low | **P3** | ⬜ Open |
| 15 | Duplicate token-refresh logic | 🟡 Low | Low | **P3** | ⬜ Open |
| 16 | No route-level code splitting | 🟢 Low | Low | **P4** | ⬜ Open |
| 17 | 214 `any` TypeScript usages | 🟢 Low | Medium | **P4** | ⬜ Open |
| 18 | No admin UI for profile approval | 🟢 Low | Medium | **P4** | ⬜ Open |
| 19 | Accessibility gaps | 🟢 Low | Medium | **P4** | ⬜ Open |
| 20 | No CI/CD pipeline | 🟢 Low | Medium | **P4** | ⬜ Open |
