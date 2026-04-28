---
phase: 10-multi-user-signup-and-onboarding
plan: "09"
subsystem: testing, ui
tags: [rls, multi-tenant, vitest, onboarding, supabase, server-actions, next-js]

# Dependency graph
requires:
  - phase: 10-03-accounts-rls-and-provisioning-trigger
    provides: "accounts RLS policies, onboarding_checklist_dismissed_at column, onboarding_complete flag"
  - phase: 10-06-onboarding-wizard-and-provisioning
    provides: "/app redirect on onboarding_complete=false, wizard flow"
  - phase: 08-08-rls-cross-tenant-matrix
    provides: "N=2 RLS matrix test, auth helpers pattern"
provides:
  - "N=3 RLS cross-tenant matrix test (24 new cases; skips gracefully until Task 1 user is provisioned)"
  - "signInAsNsiTest3Owner() + TEST_RLS_3_ACCOUNT_SLUG auth helpers"
  - "OnboardingChecklist 'use client' component with 3 items + copy-link affordance"
  - "dismissChecklistAction Server Action writing accounts.onboarding_checklist_dismissed_at"
  - "/app dashboard renders checklist above WelcomeCard for accounts in first 7 days"
  - "FUTURE_DIRECTIONS.md §7 with 10 Phase 10 v1.2 carry-overs"
affects: [Phase 11, Phase 12, Phase 13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "skipIfNoThreeUsers guard: all three env var pairs required for N=3 suite to run"
    - "Lazy count loading: checklist counts fetched only when window is open (avoids round-trips for established users)"
    - "Client-side optimistic dismiss: setDismissed(true) after Server Action success to avoid full page reload"

key-files:
  created:
    - "components/onboarding-checklist.tsx"
    - "app/(shell)/app/onboarding-checklist-actions.ts"
    - ".planning/phases/10-multi-user-signup-and-onboarding/10-09-SUMMARY.md"
  modified:
    - "tests/helpers/auth.ts"
    - "tests/rls-cross-tenant-matrix.test.ts"
    - "app/(shell)/app/page.tsx"
    - "FUTURE_DIRECTIONS.md"
    - ".planning/MILESTONE_V1_1_DEFERRED_CHECKS.md"

key-decisions:
  - "Task 1 (checkpoint:human-action — create 3rd Supabase test user) deferred to milestone-end QA per Andrew 2026-04-28"
  - "N=3 suite uses skipIfNoThreeUsers guard requiring BOTH TEST_OWNER_2_* and TEST_OWNER_3_* — enforces all-or-nothing for full matrix integrity"
  - "FUTURE_DIRECTIONS.md update split into separate 'docs' commit from checklist code commit"
  - "Lazy count loading: Promise.all for availability_rules + event_types counts only when checklistWindowOpen, saving 2 DB round-trips for all established users"
  - "Browser walkthrough verification (checklist visible + dismiss persists) deferred to milestone-end QA per Andrew 2026-04-28"

patterns-established:
  - "N=3 matrix pattern: describe.skipIf(skipIfNoThreeUsers) for extended suite; describe.runIf(skipIfNoThreeUsers) for placeholder"
  - "OnboardingChecklist: server-side window gate + client-side state for optimistic dismiss; never relies solely on SSR to hide"

# Metrics
duration: 6min
completed: 2026-04-28
---

# Phase 10 Plan 09: rls-matrix-extension-and-checklist Summary

**RLS cross-tenant matrix extended to N=3 tenants (24 new cases, graceful skip until user provisioned) + 7-day dismissible onboarding checklist component wired to /app dashboard**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-28T23:38:24Z
- **Completed:** 2026-04-28T23:44:12Z
- **Tasks:** 3 (Task 1 deferred; Tasks 2 + 3 executed)
- **Files modified:** 7

## Accomplishments

- Task 1 (human-action checkpoint: create 3rd Supabase auth user + accounts row) **deferred to milestone-end QA** per Andrew 2026-04-28; deferred steps captured in `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` under "Phase 10 — Plan 10-09 — RLS Test User 3 Creation".
- Extended `tests/helpers/auth.ts` with `signInAsNsiTest3Owner()` + `TEST_RLS_3_ACCOUNT_SLUG`; updated skip guard to `skipIfNoThreeUsers`; added full N=3 suite (~24 new test cases across positive control, anon lockout, cross-tenant SELECT in 8 directions, UPDATE deny in 2 directions, admin sees-all-3 control). Suite skips gracefully when env vars absent; 148 tests passing + 24 skipped baseline confirmed.
- Shipped onboarding checklist: `components/onboarding-checklist.tsx` (`'use client'`) + `app/(shell)/app/onboarding-checklist-actions.ts` + updated `app/(shell)/app/page.tsx` to load counts + render checklist above WelcomeCard. Visibility gate: `onboarding_complete=true` + `dismissed_at=null` + `created_at+7d>now()`. Lazy count loading skips 2 DB round-trips for established users.
- Updated `FUTURE_DIRECTIONS.md` §7 with 10 Phase 10 carry-overs to v1.2 backlog.

## Task Commits

1. **Task 1: Create 3rd test user (DEFERRED)** — Appended to `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`. No code commit.
2. **Task 2: Extend RLS matrix to N=3** — `6142b31` (feat(10-09))
3. **Task 3a: Onboarding checklist component + dismiss action + page.tsx** — `12cbf29` (feat(10-09))
4. **Task 3b: FUTURE_DIRECTIONS.md Phase 10 carry-overs** — `8102474` (docs(10-09))

## Files Created/Modified

- `tests/helpers/auth.ts` — Added `TEST_RLS_3_ACCOUNT_SLUG`, `TEST_OWNER_3_*` vars, `signInAsNsiTest3Owner()`; updated JSDoc
- `tests/rls-cross-tenant-matrix.test.ts` — Renamed skip guard to `skipIfNoThreeUsers`; added complete N=3 suite (24 cases); preserved original N=2 suite unchanged
- `components/onboarding-checklist.tsx` — New `'use client'` checklist card component (3 items + copy link + dismiss)
- `app/(shell)/app/onboarding-checklist-actions.ts` — New `dismissChecklistAction` Server Action
- `app/(shell)/app/page.tsx` — Extended SELECT to include checklist columns; lazy count loading; renders `<OnboardingChecklist />` above WelcomeCard; 10-06 redirect preserved
- `FUTURE_DIRECTIONS.md` — Added §7 with 10 v1.2 carry-over bullets
- `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` — Added "Phase 10 — Plan 10-09" section with full provisioning steps for the 3rd test user

## Decisions Made

- **Task 1 deferred:** Per Andrew 2026-04-28, the 3rd Supabase auth user creation and `.env.test.local` setup are batched to milestone-end QA. The N=3 test code is committed and skips cleanly without the env vars. SQL snippet in the deferred-checks file uses `name` (not `display_name`) per the 10-03 schema deviation.
- **skipIfNoThreeUsers requires both pairs:** The N=3 suite guard requires `TEST_OWNER_2_*` AND `TEST_OWNER_3_*` to ensure the full 3-tenant matrix runs atomically — a partial 2.5-tenant run would give misleading coverage.
- **Two Task 3 commits:** `feat` for runtime files + `docs` for FUTURE_DIRECTIONS.md — cleaner git blame separation.

## Deviations from Plan

None — plan executed as specified. Task 1 was pre-announced as deferred by Andrew; not a runtime deviation.

## Issues Encountered

None. `tsc --noEmit` errors are all pre-existing test-mock alias errors (v1.2 tech debt, documented in STATE.md). No new source-file errors introduced.

## User Setup Required

**Deferred to milestone-end QA.** See `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md` — "Phase 10 — Plan 10-09 — RLS Test User 3 Creation" section for the 4-step provisioning process.

**Browser walkthrough also deferred to milestone-end QA** (checklist visible for new accounts within 7 days; dismiss persists; Andrew's NSI account too old to see checklist — gate works correctly).

## Next Phase Readiness

- Phase 10 auto-executable work is **complete**. All 9 plans in Phase 10 have committed code; 8 are fully done, 10-09 auto portions done with Task 1 deferred.
- Phase 11 (Booking Capacity + Double-Booking Fix) can start immediately. No Phase 10 blockers remain for Phase 11.
- Milestone-end QA tasks to replay (in order, per `MILESTONE_V1_1_DEFERRED_CHECKS.md`):
  1. Phase 10-05: P-A8 pre-flight + email-confirm toggle + Supabase URL config + email templates
  2. Phase 10-08: Email-change E2E verification
  3. Phase 10-09: Create 3rd RLS test user + run N=3 matrix test locally
  4. Phase 10-09 (browser): Onboarding checklist visible post-wizard + dismiss persists

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
