---
phase: 10-multi-user-signup-and-onboarding
plan: "07"
subsystem: ui, database, auth
tags: [server-actions, supabase, soft-delete, zod, react-hook-form, nextjs]

# Dependency graph
requires:
  - phase: 10-03-accounts-rls-and-provisioning-trigger
    provides: "accounts.deleted_at column + accounts_slug_active_idx partial index"
  - phase: 10-01-reserved-slugs-consolidation
    provides: "isReservedSlug() helper from lib/reserved-slugs.ts"

provides:
  - "/app/settings/profile route with display name, slug, password change, and soft-delete sections"
  - "softDeleteAccountAction Server Action (sets deleted_at, signs out, redirects /account-deleted)"
  - ".is('deleted_at', null) filter on both public-surface data-access loaders"
  - "tests/account-soft-delete.test.ts covering ACCT-03 invariant (6 tests)"
  - "/account-deleted page (no-auth Server Component)"
  - "Profile link in app-sidebar.tsx Settings group"

affects:
  - "10-08 (email-change flow shares /app/settings/profile surface — 'Change email' link placeholder already present)"
  - "Phase 12 (UI-05 IA refactor replaces sidebar Settings group structure)"
  - "Phase 13 (manual QA walkthrough covers soft-delete end-to-end + UX hole on re-login)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transient cookie-less Supabase SDK client for current-password challenge (persistSession: false — cannot affect active cookie session)"
    - "Inline UNIQUE constraint collision detection for slug uniqueness (code 23505 → fieldError) — no RPC dependency"
    - "Shared data-access loader pattern — single deleted_at filter in loadEventTypeForBookingPage covers 2 surfaces (/[account]/[event-slug] + /embed/)"

key-files:
  created:
    - "app/(shell)/app/settings/profile/page.tsx"
    - "app/(shell)/app/settings/profile/profile-form.tsx"
    - "app/(shell)/app/settings/profile/slug-form.tsx"
    - "app/(shell)/app/settings/profile/password-form.tsx"
    - "app/(shell)/app/settings/profile/delete-account-section.tsx"
    - "app/(shell)/app/settings/profile/actions.ts"
    - "app/(shell)/app/settings/profile/schema.ts"
    - "app/account-deleted/page.tsx"
    - "tests/account-soft-delete.test.ts"
  modified:
    - "app/[account]/_lib/load-account-listing.ts"
    - "app/[account]/[event-slug]/_lib/load-event-type.ts"
    - "components/app-sidebar.tsx"

key-decisions:
  - "Slug collision detection via UNIQUE constraint (23505) not via slug_is_taken RPC — avoids wave-4 race with 10-06"
  - "Transient Supabase SDK client for current-password challenge — persists no session, cannot affect user's active cookie"
  - "accounts column is 'name' (DB) written via action even though UI label says 'Display Name' — per 10-03 schema correction"
  - "Post-soft-delete re-login UX hole: user lands on /app/unlinked (deleted_at filter shows no accounts row) — acceptable for v1.1"
  - "Browser walkthrough verifications deferred to Phase 13 QA per Andrew 2026-04-28"

patterns-established:
  - "Shared-loader deleted_at coverage: filter once in the data-access layer, not in each page — avoids drift risk"

# Metrics
duration: ~30 min (resumed from partial execution)
completed: 2026-04-28
---

# Phase 10 Plan 07: Profile Settings and Soft Delete Summary

**`/app/settings/profile` with display-name/slug/password forms + GitHub-style type-slug soft-delete; ACCT-03 404 invariant enforced via `.is('deleted_at', null)` on shared public-surface loaders (6 new tests green)**

## Performance

- **Duration:** ~30 min (continuation execution — Task 1 committed in prior wave-4 run)
- **Started:** 2026-04-28T00:00:00Z (wave-4 parallel spawn)
- **Completed:** 2026-04-28T15:10:00Z (approximate — continuation)
- **Tasks:** 3 / 3
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments

- `/app/settings/profile` ships with 4 sections: email (read-only + "Change email" link placeholder for 10-08), Display Name form, Slug form, Password change form (with current-password challenge via transient Supabase client), and a Danger Zone soft-delete section.
- `softDeleteAccountAction` sets `accounts.deleted_at = now()`, signs the user out, and redirects to `/account-deleted` — server-side slug confirmation as defense-in-depth.
- ACCT-03 invariant enforced: `.is('deleted_at', null)` added to both `loadAccountListing` and `loadEventTypeForBookingPage`. Because the embed page imports the shared loader, all three public surfaces (`/[account]/`, `/[account]/[event-slug]`, `/embed/[account]/[event-slug]`) are protected by a single edit.
- 6-test file `tests/account-soft-delete.test.ts` covers positive controls (returns data when not deleted), negative controls (returns null after soft-delete), and restoration (returns data again after null). All 141 tests passing (up from 135 baseline).
- Profile link added to the sidebar Settings group above Reminder Settings — reachable from any `/app` page.

## Task Commits

Each task was committed atomically:

1. **Task 1: Profile settings page + forms + Server Actions** - `a329e72` (feat) — committed in prior parallel execution
2. **Task 2: Filter soft-deleted accounts from public loaders + test** - `c5609b3` (feat)
3. **Task 3: /account-deleted page + Profile sidebar link** - `2a627bd` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `app/(shell)/app/settings/profile/page.tsx` — Server Component shell; loads accounts row; renders 4 form sections
- `app/(shell)/app/settings/profile/profile-form.tsx` — "use client" RHF form for display name
- `app/(shell)/app/settings/profile/slug-form.tsx` — "use client" RHF form for slug (reserved + collision checks)
- `app/(shell)/app/settings/profile/password-form.tsx` — "use client" RHF form with current-password challenge
- `app/(shell)/app/settings/profile/delete-account-section.tsx` — "use client" Danger Zone; type-slug-to-confirm gating
- `app/(shell)/app/settings/profile/actions.ts` — four Server Actions: updateDisplayNameAction, updateSlugAction, changePasswordAction, softDeleteAccountAction
- `app/(shell)/app/settings/profile/schema.ts` — Zod schemas for all three mutable fields
- `app/[account]/_lib/load-account-listing.ts` — added `.is('deleted_at', null)` before .maybeSingle()
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — added `.is('deleted_at', null)` to account SELECT; covers embed surface via shared import
- `app/account-deleted/page.tsx` — simple no-auth Server Component; "Back to log in" link to /app/login
- `components/app-sidebar.tsx` — added Profile entry (User icon) to SETTINGS_NAV_ITEMS above Reminders
- `tests/account-soft-delete.test.ts` — 6-test ACCT-03 coverage for loadAccountListing + loadEventTypeForBookingPage

## Decisions Made

- **Slug collision: UNIQUE constraint 23505 not slug_is_taken RPC** — Wave-4 runs 10-06 and 10-07 in parallel; 10-06 creates the `slug_is_taken` RPC. To avoid a wave-race dependency, `updateSlugAction` catches Postgres error code `23505` and returns `{ fieldErrors: { slug: ["That slug is already taken."] } }`. No RPC call needed.
- **Transient Supabase client for password challenge** — `createClient` from raw `@supabase/supabase-js` with `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false`. Instantiated in the Server Action body, discarded after `signInWithPassword`. Cannot affect the user's active cookie-based session.
- **DB column is `name`, UI label is "Display Name"** — Per 10-03 schema correction. `updateDisplayNameAction` writes to `accounts.name`; Zod schema field is `display_name`; label in the form is "Display Name". No DB rename planned.
- **Embed surface covered by shared loader, no direct edit** — Verified via `git grep "loadEventTypeForBookingPage" app/embed/` (3 matches). A separate edit to embed page would duplicate the filter and create drift risk — not done.
- **Post-soft-delete re-login UX hole acknowledged** — After soft-delete, `auth.users` row still exists (per ACCT-02). If user logs back in, `/app/page.tsx` filters `deleted_at IS NULL` and finds no accounts row → redirects to `/app/unlinked`. Acceptable for v1.1 per plan. Documented in Phase 13 QA checklist.
- **Browser walkthroughs deferred** — All visual verifications (login + delete flow + /account-deleted render) deferred to milestone-end QA per Andrew 2026-04-28. Tracked in `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`.

## Deviations from Plan

None - plan executed exactly as written (this is a continuation of a prior executor; Task 1 was committed in the prior run; Tasks 2 and 3 completed here as planned).

## Issues Encountered

- Pre-existing `tsc --noEmit` errors in test files (`__setTurnstileResult`, `__mockSendCalls`, etc.) and in `app/onboarding/actions.ts` (missing `@/lib/onboarding/welcome-email` — that module is being created by 10-06 in parallel). None from 10-07 files. All pre-existing tech debt per STATE.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **10-08 (email-change-with-reverification):** The `/app/settings/profile` page already renders a "Change email" link placeholder pointing to `/app/settings/profile/email` (the surface 10-08 will create). Ready to wire.
- **10-09 (rls-matrix-extension-and-checklist):** ACCT-01/02/03 requirements fulfilled by this plan. 10-09 verifies the full RLS matrix.
- **Phase 13 QA items from this plan:**
  - Browser walkthrough: login → /app/settings/profile → update display name → verify
  - Browser walkthrough: update slug → visit old slug → 404 → visit new slug → works
  - Browser walkthrough: change password (wrong current → error; correct → success)
  - Browser walkthrough: type-slug confirm → submit → logged out → /account-deleted renders
  - Browser walkthrough: confirm sidebar Profile link reachable from all /app pages
  - Note: user re-login after soft-delete lands on /app/unlinked (UX hole, v1.1 acceptable)

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
