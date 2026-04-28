---
phase: 10-multi-user-signup-and-onboarding
plan: "02"
subsystem: auth
tags: [supabase, verifyOtp, password-reset, rate-limit, server-actions, react-hook-form, zod]

# Dependency graph
requires:
  - phase: 10-01
    provides: lib/reserved-slugs.ts canonical module (build unblocked)
  - phase: 02-owner-auth-and-dashboard-shell
    provides: createClient() async pattern, login-form RHF+useActionState pattern

provides:
  - "app/auth/confirm/route.ts: canonical verifyOtp GET handler (AUTH-08)"
  - "app/auth/auth-error/page.tsx: friendly expired/invalid token page with resend form"
  - "app/(auth)/app/forgot-password/: 4-file forgot-password flow with rate limit + P-A1 generic messaging"
  - "app/auth/reset-password/: 4-file reset-password flow with session guard"
  - "app/(auth)/app/verify-email/: post-signup waiting page with rate-limited resend button"
  - "Closes v1.0 BLOCKER: /auth/callback 404"

affects:
  - "10-05 (signup-page-and-email-confirm-toggle): wires /auth/confirm to signup flow"
  - "10-08 (email-change-with-reverification): reuses /auth/confirm with type=email_change"
  - "10-09 (rls-matrix-extension-and-checklist): integration test for confirm/reset flows"
  - "Phase 13 (manual QA): end-to-end recovery flow smoke test"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verifyOtp({type,token_hash}) pattern for all email OTP types (NOT exchangeCodeForSession)"
    - "P-A1 enumeration prevention: always return generic success from forgot-password and resend"
    - "Dual rate-limit pattern: 1/min + 5/hour per email+IP for resend flows"
    - "Recovery type forces /auth/reset-password override ignoring next param"
    - "Session pre-check in Server Component (getClaims) + action redundancy guard"
    - "resetSuccess prop pattern: Server Component passes query-param flag to Client Component"

key-files:
  created:
    - "app/auth/confirm/route.ts"
    - "app/auth/auth-error/page.tsx"
    - "app/(auth)/app/forgot-password/schema.ts"
    - "app/(auth)/app/forgot-password/actions.ts"
    - "app/(auth)/app/forgot-password/forgot-password-form.tsx"
    - "app/(auth)/app/forgot-password/page.tsx"
    - "app/auth/reset-password/schema.ts"
    - "app/auth/reset-password/actions.ts"
    - "app/auth/reset-password/reset-password-form.tsx"
    - "app/auth/reset-password/page.tsx"
    - "app/(auth)/app/verify-email/page.tsx"
    - "app/(auth)/app/verify-email/actions.ts"
    - "app/(auth)/app/verify-email/resend-verification-button.tsx"
  modified:
    - "app/(auth)/app/login/login-form.tsx (additive: resetSuccess prop + ?reset=success notice)"
    - "app/(auth)/app/login/page.tsx (additive: searchParams prop, passes resetSuccess to form)"

key-decisions:
  - "verifyOtp({ type, token_hash }) is the canonical pattern — not exchangeCodeForSession (AUTH-08)"
  - "Recovery type always overrides next param to force /auth/reset-password (security: recovery sessions scoped to password update)"
  - "Password policy: 8-char minimum, no character-class requirements (CONTEXT.md Claude's Discretion)"
  - "Dual rate limits for resend: 1/min + 5/hour per email+IP (CONTEXT.md Claude's Discretion)"
  - "Forgot-password rate limit: 3/hour per IP (abuse prevention + quota protection)"
  - "resendVerification action shared between verify-email page and auth-error page (DRY, single server action)"

patterns-established:
  - "verifyOtp pattern: all future email OTP handlers (magiclink, email_change) route through app/auth/confirm/route.ts"
  - "P-A1 generic-success pattern: resend + forgot-password always return same message regardless of account existence"
  - "resetSuccess prop: Server Component reads search param, passes boolean flag to Client Component (avoids useSearchParams in form)"

# Metrics
duration: 15min
completed: 2026-04-28
---

# Phase 10 Plan 02: auth-confirm-and-password-reset Summary

**verifyOtp-based /auth/confirm route handler + full forgot/reset-password and verify-email flows closing the v1.0 /auth/callback 404 BLOCKER**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-28T13:37:00Z
- **Completed:** 2026-04-28T13:52:00Z
- **Tasks:** 4 (Tasks 1-4; Task 1 files committed by parallel 10-04 agent — see Deviations)
- **Files created:** 13 new files, 2 modified

## Accomplishments

- Built `app/auth/confirm/route.ts` using `verifyOtp({ type, token_hash })` pattern (AUTH-08) — closes v1.0 BLOCKER `/auth/callback 404`
- Built complete forgot-password flow (`/app/forgot-password`): Zod schema, rate-limited Server Action with P-A1 generic messaging, RHF+useActionState form
- Built complete reset-password flow (`/auth/reset-password`): schema with 8-char min, session-guarded Server Action, form with password+confirmPassword match, Server Component with expired-link fallback
- Built verify-email waiting page with dual-rate-limited (1/min + 5/hour) resend Server Action and 60-second client-side cooldown button
- `resendVerification` action shared by both `verify-email` page and `auth-error` page (DRY)
- Login page updated with additive `?reset=success` success banner

## Task Commits

Each task was committed atomically:

1. **Task 1: /auth/confirm route + auth-error page** — `77d1ee4` (feat — committed by parallel 10-04 agent, see Deviations)
2. **Task 2: /app/forgot-password** — `90e8c62` (feat(10-02))
3. **Task 3: /auth/reset-password + login ?reset=success** — `8c91c03` (feat(10-02))
4. **Task 4: /app/verify-email + resend action + button** — `fd2e36c` (feat(10-02))

## Files Created/Modified

- `app/auth/confirm/route.ts` — GET handler; verifyOtp; missing-params/error → /auth/auth-error; recovery → /auth/reset-password; else → next
- `app/auth/auth-error/page.tsx` — friendly headline based on reason; embeds ResendVerificationButton with optional pre-filled email
- `app/(auth)/app/forgot-password/schema.ts` — Zod email schema
- `app/(auth)/app/forgot-password/actions.ts` — requestPasswordReset; 3/hr IP rate limit; resetPasswordForEmail; P-A1 generic response
- `app/(auth)/app/forgot-password/forgot-password-form.tsx` — RHF+useActionState; inline success message on submit
- `app/(auth)/app/forgot-password/page.tsx` — Server Component with "Back to login" link
- `app/auth/reset-password/schema.ts` — password min(8) + confirmPassword refine match
- `app/auth/reset-password/actions.ts` — resetPasswordAction; getClaims() session check; updateUser; redirect /app/login?reset=success
- `app/auth/reset-password/reset-password-form.tsx` — RHF+useActionState; password + confirmPassword fields
- `app/auth/reset-password/page.tsx` — Server Component; getClaims() pre-check; expired-link view if no session
- `app/(auth)/app/verify-email/page.tsx` — reads ?email=; shows address in copy; ResendVerificationButton; "Use different email" link
- `app/(auth)/app/verify-email/actions.ts` — resendVerification; dual rate limits; supabase.auth.resend; P-A1 generic success
- `app/(auth)/app/verify-email/resend-verification-button.tsx` — 'use client'; useActionState; 60s cooldown with countdown; hidden/visible email input
- `app/(auth)/app/login/login-form.tsx` — additive resetSuccess prop + success Alert banner
- `app/(auth)/app/login/page.tsx` — additive searchParams prop; passes resetSuccess flag

## Decisions Made

- **verifyOtp is the only pattern** — never exchangeCodeForSession (RESEARCH PITFALL P-A4 locked this)
- **Recovery type hard-overrides next param** — recovery sessions must land on password-update page; allowing next=/app with a recovery session would be a privilege escalation path
- **8-char password minimum, no character-class rules** — CONTEXT.md Claude's Discretion; Supabase enforces minimum server-side anyway
- **resendVerification shared action** — auth-error page and verify-email page both use the same Server Action; no duplication
- **resetSuccess prop pattern** — Server Component reads search param and passes boolean to Client Component, avoiding `useSearchParams` in the form (which would require a Suspense boundary)

## Deviations from Plan

### Auto-fixed Issues

**1. [Parallel execution] Task 1 files committed under 10-04 agent commit `77d1ee4`**

- **Found during:** Task 1 commit attempt
- **Issue:** The parallel 10-04 executor had already staged and committed `app/auth/confirm/route.ts` and `app/auth/auth-error/page.tsx` (both written to disk by this agent before the 10-04 commit landed). The files were picked up as untracked by the 10-04 agent's `git add` sweep.
- **Fix:** No fix needed — the content committed is identical to what this plan specifies. Tasks 2-4 committed normally with `feat(10-02):` prefix.
- **Impact:** Task 1 commit message is `feat(10-04): add quota-guard.ts with 4 unit tests` rather than a dedicated 10-02 commit, but the code itself is correct and present.
- **Verification:** `git show 77d1ee4 -- app/auth/confirm/route.ts` and `app/auth/auth-error/page.tsx` confirm exact expected content.

---

**Total deviations:** 1 (git-index race with parallel executor; no code impact)
**Impact on plan:** Zero — all correct code is committed. The missing per-plan commit label is a cosmetic tracking concern only.

## Issues Encountered

- **Git index race with parallel agents** — 10-04 agent committed Task 1 files before this agent could. Files were written to disk by this agent, then picked up by 10-04's broad `git add`. The STATE.md v1.2 ops concern about parallel commits materialized. Recommendation: in future parallel waves, use per-agent git worktrees or serialize commits with a lock file.

## User Setup Required

None — no external service configuration required. Supabase email templates for recovery flow use default Supabase templates (which respect the `redirectTo` param) until Plan 10-05 ships custom templates.

## Next Phase Readiness

- `/auth/confirm` is live and handles signup, recovery, and future magic-link/email-change types
- Plans 10-05 (signup) and 10-08 (email-change) can now wire their flows through `/auth/confirm`
- Recovery flow is immediately testable against dev Supabase: `/app/forgot-password` → email → click link → `/auth/confirm` → `/auth/reset-password`
- Verify-email page ready for Plan 10-05 to redirect to after signup
- No blockers for Plans 10-05 through 10-09

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
