---
phase: 10-multi-user-signup-and-onboarding
plan: "08"
subsystem: auth
tags: [supabase, postgres, trigger, security-definer, server-action, react-hook-form, zod, rate-limit, quota-guard]

requires:
  - phase: 10-02-auth-confirm-and-password-reset
    provides: "/auth/confirm route handling type=email_change via verifyOtp"
  - phase: 10-03-accounts-rls-and-provisioning-trigger
    provides: accounts.owner_email column + SECURITY DEFINER trigger pattern
  - phase: 10-04-gmail-smtp-quota-cap-and-alert
    provides: checkAndConsumeQuota("email-change") + QuotaExceededError
  - phase: 10-05-signup-page-and-email-confirm-toggle
    provides: checkAuthRateLimit("emailChange") threshold in AUTH_RATE_LIMITS
  - phase: 10-07-profile-settings-and-soft-delete
    provides: /app/settings/profile page with "Change email" link placeholder

provides:
  - SECURITY DEFINER trigger sync_account_email_on_auth_update on auth.users keeping accounts.owner_email in sync after email_change OTP confirmed
  - /app/settings/profile/email Server Component page showing current email + form
  - requestEmailChangeAction Server Action (rate-limited, quota-guarded, P-A1 generic)
  - EmailChangeForm client component (RHF, single field, success/error messaging)
  - "Change email" link on /app/settings/profile wired to active route

affects:
  - 10-09-rls-matrix-extension-and-checklist
  - Phase 13 QA (email-change E2E deferred to milestone-end)

tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER trigger on auth.users for cross-schema propagation (mirrors 10-03 pattern)"
    - "P-A1 generic email-change response: never distinguish 'email already in use'"
    - "Rate limit key pattern ip:uid for authenticated flows (prevents cross-device bypass)"
    - "Quota guard integrated into Server Action before calling Supabase updateUser"

key-files:
  created:
    - supabase/migrations/20260428120005_phase10_sync_account_email.sql
    - app/(shell)/app/settings/profile/email/schema.ts
    - app/(shell)/app/settings/profile/email/actions.ts
    - app/(shell)/app/settings/profile/email/email-change-form.tsx
    - app/(shell)/app/settings/profile/email/page.tsx
  modified:
    - app/(shell)/app/settings/profile/page.tsx

key-decisions:
  - "Option A (trigger) chosen for accounts.owner_email sync: atomicity-first, survives future code paths (Supabase admin API, etc.) unlike inline /auth/confirm Option B"
  - "Rate limit key uses ip:uid (not ip:email) because user is authenticated — prevents cross-device bypass while tolerating shared NAT IPs"
  - "P-A1 generic response applied: server-side error logged but user always sees 'If that email is available...' message"
  - "emailRedirectTo includes next=/app/settings/profile so user lands on updated profile page after confirming"

patterns-established:
  - "Email-change OTP flow: updateUser({ email }) → Supabase sends to new address → /auth/confirm type=email_change → trigger syncs accounts.owner_email"

duration: 3min
completed: 2026-04-28
---

# Phase 10 Plan 08: Email-Change with Re-verification Summary

**SECURITY DEFINER trigger + /app/settings/profile/email route delivering Supabase email_change OTP flow with P-A1 generic messaging, rate limiting (3/hr ip:uid), and quota guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-28T23:32:16Z
- **Completed:** 2026-04-28T23:35:19Z
- **Tasks:** 2 completed
- **Files modified:** 6 (1 migration, 4 new app files, 1 modified)

## Accomplishments

- `sync_account_email_on_auth_update` SECURITY DEFINER trigger applied to Supabase production — automatically propagates `auth.users.email` changes to `accounts.owner_email` after email_change OTP is confirmed
- `/app/settings/profile/email` route ships with Server Component page, `EmailChangeForm` (RHF), `requestEmailChangeAction` Server Action, and `emailChangeSchema` (zod)
- `requestEmailChangeAction` wires all security layers: session guard, rate limit (3/hr per ip:uid), quota guard (`email-change` category), P-A1 generic response
- `/app/settings/profile` "Change email" link placeholder (`(coming soon)`) replaced with active link to `/app/settings/profile/email`
- 148 tests passing + 1 skipped — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: sync trigger migration** — `0fdba3f` (feat)
2. **Task 2: email-change route + Server Action + form** — `bf04507` (feat)

**Plan metadata:** (docs commit created after SUMMARY.md + STATE.md updates)

## Files Created/Modified

- `supabase/migrations/20260428120005_phase10_sync_account_email.sql` — SECURITY DEFINER trigger function + AFTER UPDATE OF email trigger on auth.users
- `app/(shell)/app/settings/profile/email/schema.ts` — emailChangeSchema (zod, new_email max 254)
- `app/(shell)/app/settings/profile/email/actions.ts` — requestEmailChangeAction Server Action
- `app/(shell)/app/settings/profile/email/email-change-form.tsx` — RHF client form component
- `app/(shell)/app/settings/profile/email/page.tsx` — Server Component page
- `app/(shell)/app/settings/profile/page.tsx` — removed "(coming soon)" from "Change email" link

## Decisions Made

- **Option A (trigger) for owner_email sync** — SECURITY DEFINER trigger on `auth.users AFTER UPDATE OF email` propagates change to `accounts.owner_email`. Mirrors 10-03 atomicity-first pattern; survives future code paths (Supabase admin API, etc.) unlike the inline /auth/confirm Option B.
- **Rate limit key `${ip}:${uid}` (not `${ip}:${email}`)** — user is authenticated so uid is available; prevents cross-device bypass while tolerating shared NAT IPs.
- **P-A1 generic response preserved** — real error from `supabase.auth.updateUser` is logged server-side (`[email-change]` tag) but user always receives the generic "If that email address is available..." message. Never leaks whether an email is already in use.
- **`emailRedirectTo` set to `${origin}/auth/confirm?next=/app/settings/profile`** — lands user on updated profile page after confirming, so they see the new email immediately.

## Deviations from Plan

None — plan executed exactly as written. The form uses RHF + useTransition (matching the 10-07 profile-form and password-form patterns) rather than useActionState, which is the established codebase pattern.

## Issues Encountered

None. Migration applied cleanly; trigger confirmed live via `pg_trigger` row returned. `tsc --noEmit` errors are all pre-existing test-mock alias errors (v1.2 tech debt per STATE.md).

## User Setup Required

None — no new external service configuration required. The `/auth/confirm?type=email_change` handling was already live from Plan 10-02. The "Confirm Email Change" Supabase email template update (using token-hash URL pattern) is part of the 10-05 deferred items in `MILESTONE_V1_1_DEFERRED_CHECKS.md`.

## Next Phase Readiness

- Email-change flow is fully code-complete and ready for Phase 13 milestone-end QA
- Email-change E2E walkthrough added to `MILESTONE_V1_1_DEFERRED_CHECKS.md` (requires email confirm toggle ON from 10-05 deferred items)
- Plan 10-09 (`rls-matrix-extension-and-checklist`) is the final plan in Phase 10

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
