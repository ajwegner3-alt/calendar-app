---
phase: 38-magic-link-login
plan: 01
subsystem: auth
tags: [magic-link, supabase-auth, signInWithOtp, rate-limit, zod, server-action, enumeration-safety]

# Dependency graph
requires:
  - phase: 10-multi-user-signup-and-onboarding
    provides: forgot-password enumeration-safe pattern (model for requestMagicLinkAction)
  - phase: 02-owner-auth-and-dashboard-shell
    provides: rate_limit_events table + checkAuthRateLimit helper
provides:
  - requestMagicLinkAction server action (login-only signInWithOtp + IP+email rate-limit)
  - MagicLinkState exported type for Plan 02 useActionState consumer
  - magicLinkSchema (email-only Zod) export
  - AUTH_RATE_LIMITS.magicLink config (5/hour, IP+email scope)
  - AUTH-28 wording reconciled to CONTEXT lock (5/hour per (IP+email), silent throttle)
affects:
  - 38-02-magic-link-form (will import requestMagicLinkAction + MagicLinkState)
  - 38-03-supabase-template (the live email template that signInWithOtp triggers)
  - any-future-passwordless-flow (silent-throttle pattern is the canonical AUTH-29 approach)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Silent-rate-limit on enumeration-sensitive endpoints (always returns success-shape, never throttle leakage)
    - 5xx-only formError surfacing for enumeration-safe Supabase actions (4xx swallowed)

key-files:
  created: []
  modified:
    - lib/auth/rate-limits.ts (added magicLink entry)
    - app/(auth)/app/login/schema.ts (added magicLinkSchema export)
    - app/(auth)/app/login/actions.ts (added requestMagicLinkAction + MagicLinkState)
    - .planning/REQUIREMENTS.md (AUTH-28 reconciled)

key-decisions:
  - "Silent throttle over visible error (CONTEXT lock) — rate-limit hit returns { success: true } identical to a real send"
  - "5xx-only formError gating mirrors loginAction status-based pattern; 4xx (including unknown-email) always swallowed"
  - "shouldCreateUser:false is the login-only switch; default true would silently auto-register every unknown email"
  - "emailRedirectTo points to /auth/confirm?next=/app — the existing confirm route already handles type=magiclink → next param"

patterns-established:
  - "Silent rate-limit return (Phase 38, Plan 01) — magic-link action returns { success: true } on rate-limit miss, NOT { formError } like loginAction or forgot-password. This is intentional: forgot-password leaks throttle status (acceptable trade-off there); magic-link cannot afford to (CONTEXT lock). Future enumeration-sensitive auth actions should default to silent-throttle."
  - "5xx-only error surfacing (Phase 38, Plan 01) — gate on `error.status >= 500 || !error.status` for whether to surface to client. 4xx (Supabase 'unknown email' is one) always logged + swallowed."
  - "magicLink rate-limit key shape (Phase 38, Plan 01) — `auth:magicLink:${ip}:${email}` does NOT collide with `auth:forgotPassword:${ip}:${email}` because checkAuthRateLimit namespaces by route key. Multi-route IP+email scoping is safe."

# Metrics
duration: ~2min
completed: 2026-05-08
---

# Phase 38 Plan 01: Server Action and Schema Summary

**Backend foundation for magic-link login — enumeration-safe `requestMagicLinkAction` with silent IP+email rate-limit, calling `supabase.auth.signInWithOtp` in login-only mode (`shouldCreateUser:false`).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-08T22:38:03Z
- **Completed:** 2026-05-08T22:39:56Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `AUTH_RATE_LIMITS.magicLink` config added (5/hour, IP+email scope) — reuses existing `rate_limit_events` Postgres table; route-key namespacing guarantees no collision with `forgotPassword`
- `magicLinkSchema` (email-only Zod) exported from `app/(auth)/app/login/schema.ts` alongside untouched `loginSchema`
- `requestMagicLinkAction` + exported `MagicLinkState` type added to `app/(auth)/app/login/actions.ts`; modeled exactly on `requestPasswordReset` shape but with silent throttle
- Login-only mode locked in via `shouldCreateUser:false`; redirect target hardcoded to `/auth/confirm?next=/app` (CONTEXT lock — no caller-supplied redirectTo honoring)
- AUTH-29 enumeration safety: identical `{ success: true }` response for known emails, unknown emails (Supabase 400 swallowed), and rate-limit hits
- Only 5xx Supabase errors surface as `{ formError }`; everything else returns success
- REQUIREMENTS.md AUTH-28 reconciled from "3/hour per IP" → "5/hour per (IP+email) pair, silent on throttle" to match CONTEXT lock and ROADMAP wording

## Task Commits

Each task was committed atomically:

1. **Task 1: Add magicLink rate-limit config + magicLinkSchema** — `8c534d9` (feat)
2. **Task 2: Implement requestMagicLinkAction in login/actions.ts** — `cc8a752` (feat)
3. **Task 3: Reconcile REQUIREMENTS AUTH-28 with CONTEXT** — `24d2358` (docs)

**Plan metadata:** _to be added in final commit_ (docs: complete server-action-and-schema plan)

## Files Created/Modified

- `lib/auth/rate-limits.ts` — Added `magicLink: { max: 5, windowMs: 60 * 60 * 1000 }` after `emailChange`. Single-line addition; no other entries touched.
- `app/(auth)/app/login/schema.ts` — Added `magicLinkSchema` (email-only) and `MagicLinkInput` type export below the untouched `loginSchema` block.
- `app/(auth)/app/login/actions.ts` — Imported `magicLinkSchema` alongside `loginSchema`; appended `MagicLinkState` type and `requestMagicLinkAction` server action below the existing `initiateGoogleOAuthAction`. `loginAction` and `initiateGoogleOAuthAction` left bit-for-bit identical.
- `.planning/REQUIREMENTS.md` — Updated AUTH-28 wording to "5/hour per (IP+email) pair, silent on throttle — same success-shape response as real sends".

## Decisions Made

- **Silent-throttle over visible error** — Hit `{ success: true }` on rate-limit miss instead of `{ formError: "Too many attempts..." }`. Rationale: ROADMAP/CONTEXT decision is that throttle-status is itself information leakage (an attacker batch-probing 6 magic-link requests for a target email could distinguish "real send threshold reached" from "no such account"). Forgot-password tolerates this leak because the password-reset attack surface is different; magic-link is the primary auth gate and the leak is unacceptable.
- **5xx-only formError gating** — Mirrors `loginAction` LD pattern: `auth-js` `error.code` is unreliable; gate on `error.status >= 500 || !error.status`. 4xx (including the canonical "unknown email" 400 from `signInWithOtp` with `shouldCreateUser:false`) always swallowed — that's the primary enumeration-safety lever.
- **No `redirect()` / `revalidatePath()` in action body** — Magic-link UX stays on `/app/login` and renders an inline success state (Plan 02's job). This action is pure data → state transformation; navigation only happens after the user clicks the email link and `/auth/confirm` finalizes the session.
- **REQUIREMENTS AUTH-28 reconciled, ROADMAP not touched** — Planner already updated ROADMAP success criterion #3 during the `update_roadmap` step. Re-editing here would create a no-op git churn line in this plan's diff. Verified ROADMAP line 232 already reads "5 magic-link requests from the same (IP, email) pair".

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Plan was complete and accurate. All three `<verify>` blocks passed first try, typecheck was clean (zero new errors in `app/` or `lib/` — only pre-existing test-file type drift unrelated to this plan).

## Issues Encountered

None. The plan was unusually self-contained: 3 small additions, no refactors, no test churn, no env changes. Pre-existing test-file TS errors (in `tests/__mocks__/account-sender.ts`, `tests/bookings-api.test.ts`, etc.) are unchanged drift from prior phases and are not introduced or affected by this plan.

## User Setup Required

None — no external service configuration required for Plan 01. Plan 03 will require Andrew to configure the Supabase Magic Link email template via the Supabase Dashboard (HTML body, sender domain) — but that's a separate plan with its own checkpoint.

## Next Phase Readiness

- **Plan 02 unblocked** (Wave 2): can now `import { requestMagicLinkAction, type MagicLinkState } from "../login/actions"` to wire the form. `MagicLinkState` shape (`{ success?: boolean; formError?: string; fieldErrors?: { email?: string[] } }`) maps directly onto a `useActionState` consumer.
- **Plan 03 unblocked** (Wave 3): the Supabase email template config plan can proceed once Plan 02 ships the form. The action's `emailRedirectTo: ${origin}/auth/confirm?next=/app` is the exact target the template's `{{ .ConfirmationURL }}` placeholder will resolve to.
- **Locked invariants for downstream plans:**
  - Action ALWAYS returns `{ success: true }` for known emails, unknown emails, AND rate-limit hits — Plan 02's UI must NEVER attempt to distinguish these states (and has no signal to do so anyway)
  - The ONLY non-success state is `{ formError }` (5xx) or `{ fieldErrors: { email: [...] } }` (Zod) — Plan 02 should render `formError` as a generic alert and `fieldErrors.email` inline below the input
  - Rate-limit window is exactly 1 hour from first request in window; user reload to retry after 1h (no countdown UI in Plan 02 per CONTEXT scope-cut)

---
*Phase: 38-magic-link-login*
*Completed: 2026-05-08*
