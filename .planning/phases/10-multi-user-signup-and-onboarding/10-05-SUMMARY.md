---
phase: 10
plan: 05
name: "signup-page-and-email-confirm-toggle"
subsystem: "auth-signup"
tags: ["auth", "signup", "rate-limit", "supabase", "p-a8-deferred"]

dependency-graph:
  requires:
    - "10-01 (reserved-slugs consolidation, project baseline)"
    - "10-02 (/auth/confirm + /auth/verify-email + forgot/reset password actions for centralized rate-limit refactor)"
    - "10-03 (accounts trigger + RLS so new auth.users rows get a stub accounts row)"
    - "10-04 (quota-guard.ts wired into signup Server Action)"
  provides:
    - "/app/signup page (email + password only)"
    - "lib/auth/rate-limits.ts (centralized AUTH_RATE_LIMITS thresholds + checkAuthRateLimit helper)"
    - "scripts/phase10-pre-flight-andrew-email-confirmed.sql (P-A8 pre-flight)"
  affects:
    - "10-06 (wizard receives /auth/confirm redirect → /onboarding)"
    - "10-08 (email-change Server Action will reuse checkAuthRateLimit)"

tech-stack:
  added: []
  patterns:
    - "Centralized rate-limit thresholds in single module"
    - "Quota guard called BEFORE supabase.auth.signUp() (fail-closed at cap)"
    - "Generic post-submit message on signup (P-A1 enumeration prevention)"

key-files:
  created:
    - app/(auth)/app/signup/schema.ts
    - app/(auth)/app/signup/actions.ts
    - app/(auth)/app/signup/signup-form.tsx
    - app/(auth)/app/signup/page.tsx
    - lib/auth/rate-limits.ts
    - scripts/phase10-pre-flight-andrew-email-confirmed.sql
    - scripts/README.md
  modified:
    - app/(auth)/app/login/login-form.tsx (signup link added)
    - app/(auth)/app/login/actions.ts (centralized rate-limit helper)
    - app/(auth)/app/forgot-password/actions.ts (centralized rate-limit helper)
    - app/auth/reset-password/actions.ts (centralized rate-limit helper)
    - app/(auth)/app/verify-email/page.tsx (link target adjustment)

decisions:
  - id: "AUTH-RATE-LIMIT-CENTRALIZE"
    summary: "Single AUTH_RATE_LIMITS const in lib/auth/rate-limits.ts; helper wraps checkRateLimit"
    rationale: "Threshold edits become one-file changes; consistent key prefix `auth:{route}:{identifier}`"

  - id: "P-A8-DEFERRED-2026-04-28"
    summary: "P-A8 pre-flight + Supabase Dashboard email-confirm toggle deferred to milestone-end QA"
    rationale: "Per Andrew 2026-04-28: all manual checks save for end of v1.1. Toggle stays OFF until milestone-end batch — Andrew lockout impossible while toggle is OFF. Tracked in .planning/MILESTONE_V1_1_DEFERRED_CHECKS.md."

metrics:
  duration: "~5 minutes (auto portion); checkpoint deferred"
  completed: "2026-04-28 (auto tasks); checkpoint queued for milestone-end"
  tasks-completed: 3 of 4 (Task 1 deferred, not failed)
  tests-total: 135 passing + 1 skipped (no new tests added)
---

# Phase 10 Plan 05: Signup Page + Email-Confirm Toggle Summary

**One-liner:** Public `/signup` page (email + password) with rate-limited Server Action and quota guard; centralized AUTH_RATE_LIMITS module; P-A8 pre-flight SQL prepared. Supabase Dashboard email-confirm toggle DEFERRED to milestone-end manual QA.

## What Was Built (auto tasks)

1. **`lib/auth/rate-limits.ts`** — Single source of truth for auth rate-limit thresholds:
   - `signup`: 5 / hour / IP
   - `login`: 10 / 5 min / IP
   - `forgotPassword`: 3 / hour / (IP+email)
   - `resetPassword`: 5 / hour / IP
   - `resendVerify`: 5 / hour / (IP+email) — pairs with the per-min limit in 10-02
   - `emailChange`: 3 / hour / (IP+uid)
   Plus `checkAuthRateLimit(route, identifier)` helper. All routes share `auth:{route}:{identifier}` key prefix on the v1.0 `rate_limit_events` Postgres table.

2. **`/app/signup`** — Server Component page + client form (RHF + useActionState) + Zod schema + Server Action. Action does:
   - Zod validate (`email max 254`, `password min 8 max 72`)
   - `checkAuthRateLimit("signup", ip)` → 429-equivalent error message
   - `checkAndConsumeQuota("signup-verify")` → fail-closed at cap with "temporarily unavailable" message
   - `supabase.auth.signUp({ email, password, options.emailRedirectTo: ${origin}/auth/confirm?next=/onboarding })`
   - Generic redirect to `/app/verify-email?email=...` regardless of duplicate-email state (P-A1)

3. **`/app/login` form + action** — added "Don't have an account? Sign up" link; replaced inline rate-limit with `checkAuthRateLimit("login", ip)` call.

4. **`/app/forgot-password` + `/auth/reset-password` actions** — replaced their inline rate-limit calls (added in 10-02) with the centralized helper.

5. **`scripts/phase10-pre-flight-andrew-email-confirmed.sql`** — pre-flight SELECT + commented conditional UPDATE + re-SELECT for `auth.users.email_confirmed_at` of `ajwegner3@gmail.com`. **Not yet executed.**

6. **`scripts/README.md`** — documents the scripts/ folder convention.

## DEFERRED to Milestone-End QA — P-A8 Pre-flight Checkpoint

Per Andrew 2026-04-28: **all manual / human-action checkpoints across Phase 10–13 are batched for milestone-end QA.** This plan's Task 1 (autonomous: false — five-step Supabase Dashboard + SQL Editor procedure) is queued in `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` and NOT executed during Phase 10. The five steps:

1. Run `scripts/phase10-pre-flight-andrew-email-confirmed.sql` — confirm `email_confirmed_at IS NOT NULL` for Andrew (or backfill).
2. Supabase Dashboard → Authentication → "Enable email confirmations" → ON.
3. Supabase Dashboard → URL Configuration → Redirect URLs whitelist (3 entries).
4. Supabase Dashboard → Email Templates — replace `{{ .ConfirmationURL }}` with token-hash pattern across 4 templates (Confirm signup, Reset Password, Magic Link, Confirm Email Change).
5. Verify Andrew's login still works post-toggle.

**Why deferral is safe:** Andrew lockout is only possible AFTER step 2 (toggle flip). With the toggle OFF, all v1.0 + v1.1 login flows continue to work as today. Downstream Phase 10 plans (10-06 wizard, 10-07 profile, 10-08 email change) ship code that EXPECTS the toggle to be ON for live signup E2E, but that E2E is itself part of the milestone-end QA batch (Phase 13).

## Architectural Decisions (Code Reflection)

- **AUTH-RATE-LIMIT-CENTRALIZE**: thresholds + helper consolidated in one module so future Phase 10 plans (10-08 email-change) and v1.2 changes need ONE file edit.
- **Generic-error policy holds across all auth surfaces**: signup, forgot-password, login (existing), email-change (10-08) all return the same "If your email is registered..." or equivalent generic message regardless of underlying state.

## Commits

- `a2a3751` feat(10-05): centralize auth rate-limit thresholds and helper
- `3266472` feat(10-05): add /app/signup page with rate-limit + quota guard
- `d7fe76b` chore(10-05): create P-A8 pre-flight SQL and scripts/README
- `(this commit)` docs(10-05): complete signup-page-and-email-confirm-toggle plan (P-A8 deferred)

## Verification Status

- ✓ `/app/signup`, `/app/login` (with sign-up link), `/app/forgot-password`, `/auth/reset-password`, `/auth/confirm`, `/app/verify-email` all wired and code-complete.
- ✓ `lib/auth/rate-limits.ts` is the single source for AUTH thresholds.
- ✓ `npx tsc --noEmit` clean on production source.
- ✓ `npm test` — 135 passing, 1 skipped.
- ⊘ Live signup E2E (`signup → email → click → /auth/confirm → /onboarding`): blocked on P-A8 deferred batch.
- ⊘ Login burst test (11 → 11th rate-limited): documented as deferred but logic is identical to v1.0 trusted `checkRateLimit`.

## Tasks-Carried-Forward

- **Wave 4 (10-06) starts immediately.** The `/onboarding` route is a 404 today — that's expected; 10-06 ships it.
- **Milestone-end batch:** see `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` for the 5-step P-A8 procedure plus any future deferred checks.
