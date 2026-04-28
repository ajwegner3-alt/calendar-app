---
phase: 10-multi-user-signup-and-onboarding
plan: "03"
subsystem: database
tags: [postgres, rls, supabase, triggers, security-definer, migrations, onboarding, soft-delete]

# Dependency graph
requires:
  - phase: 10-01-reserved-slugs-consolidation
    provides: "RESERVED_SLUGS single source of truth (lib/reserved-slugs.ts)"
  - phase: 01-foundation (initial schema)
    provides: "accounts table with slug NOT NULL + v1.0 RLS SELECT policy"
provides:
  - "onboarding_complete, onboarding_step, onboarding_checklist_dismissed_at, deleted_at columns on accounts"
  - "slug and name columns made nullable (stub row support)"
  - "CHECK constraints: slug+name required when onboarding_complete=true"
  - "accounts_slug_active_idx partial index (where deleted_at is null)"
  - "accounts_owner_insert RLS policy (INSERT for authenticated users)"
  - "accounts_owner_update RLS policy (UPDATE for authenticated users)"
  - "provision_account_for_new_user() SECURITY DEFINER trigger function"
  - "provision_account_on_signup AFTER INSERT trigger on auth.users"
  - "Andrew's NSI account marked onboarding_complete=true"
affects:
  - "10-06-onboarding-wizard-and-provisioning (wizard UPDATEs stub via RLS-scoped client)"
  - "10-07-profile-settings-and-soft-delete (deleted_at column + soft-delete filtering)"
  - "10-09-rls-matrix-extension-and-checklist (onboarding_checklist_dismissed_at)"
  - "10-05-signup-page-and-email-confirm-toggle (trigger fires on new auth.users rows)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER trigger function with set search_path = public (prevents search-path-hijack)"
    - "Stub-row provisioning pattern: trigger creates minimal row at signup, wizard UPDATEs to complete"
    - "Idempotent migration pattern: DROP TRIGGER IF EXISTS + DO blocks with pg_policies guard"
    - "CHECK constraint pair: (col IS NOT NULL) OR (onboarding_complete = false)"

key-files:
  created:
    - "supabase/migrations/20260428120001_phase10_onboarding_columns.sql"
    - "supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql"
  modified: []

key-decisions:
  - "ARCH DECISION #1 COMMITTED: Postgres trigger creates stub row at signup; wizard Server Action UPDATEs stub — atomicity-first at auth.users INSERT boundary, UX-error-clarity at wizard"
  - "name column made nullable (not just slug) — actual column is 'name' not 'display_name'; stub rows need null-safe name until wizard step 1"
  - "accounts_owner_update is a NEW named policy alongside v1.0 'owners update own account' — both OR together safely; explicit naming for Phase 10 policy matrix audit (10-09)"
  - "Trigger function grants execute to postgres role for Supabase trigger infrastructure compatibility"

patterns-established:
  - "Trigger provisioning: always SECURITY DEFINER + set search_path = public (Supabase pitfall prevention)"
  - "Stub row lifecycle: created by trigger (onboarding_complete=false), completed by wizard UPDATE (onboarding_complete=true)"

# Metrics
duration: 2min
completed: 2026-04-28
---

# Phase 10 Plan 03: accounts-rls-and-provisioning-trigger Summary

**Postgres SECURITY DEFINER trigger auto-provisions stub accounts rows on auth.users INSERT; INSERT/UPDATE RLS policies + onboarding/soft-delete columns complete the multi-user schema foundation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-28T13:35:33Z
- **Completed:** 2026-04-28T13:38:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Applied migration 1 (`20260428120001`): 4 new columns, slug+name nullable, 2 CHECK constraints, partial index, Andrew NSI row updated to `onboarding_complete=true`
- Applied migration 2 (`20260428120002`): INSERT+UPDATE RLS policies, `provision_account_for_new_user()` SECURITY DEFINER function, `provision_account_on_signup` AFTER INSERT trigger on `auth.users`
- Zero regression: `tests/rls-cross-tenant-matrix.test.ts` still 13 passed, 1 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: onboarding columns migration** - `608961a` (feat)
2. **Task 2: RLS policies + trigger migration** - `0e32d50` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260428120001_phase10_onboarding_columns.sql` - Adds onboarding_complete, onboarding_step, onboarding_checklist_dismissed_at, deleted_at; drops NOT NULL on slug+name; adds CHECK constraints + partial index; marks NSI account complete
- `supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql` - Adds accounts_owner_insert + accounts_owner_update RLS policies; creates SECURITY DEFINER trigger function + AFTER INSERT trigger on auth.users

## Decisions Made

- **ARCH DECISION #1 COMMITTED** — Postgres trigger pattern: trigger creates stub (`slug=null, name=null, onboarding_complete=false`) on `auth.users` INSERT. Wizard UPDATEs stub after `/auth/confirm`. Atomicity at signup boundary, UX clarity at wizard. No half-provisioned auth.users rows possible.
- **accounts_owner_update policy** created as NEW named policy alongside v1.0 `owners update own account` — both OR together safely; explicit naming supports 10-09 RLS audit matrix.
- **`grant execute ... to postgres`** added on trigger function — required for Supabase trigger infrastructure to invoke SECURITY DEFINER functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected column name from display_name to name; also made name nullable**

- **Found during:** Task 1 (pre-flight column inspection)
- **Issue:** Plan's trigger function used `display_name` but the actual accounts table column is `name` (NOT NULL). Inserting a stub with `display_name` would target a nonexistent column; keeping `name NOT NULL` would block the stub insert entirely.
- **Fix:** Made `name` nullable (alongside `slug`) in migration 1. Used `name` (not `display_name`) in the trigger function in migration 2. Added `accounts_name_required_when_onboarding_complete` CHECK constraint so name is enforced before wizard completes.
- **Files modified:** `20260428120001_phase10_onboarding_columns.sql`, `20260428120002_phase10_accounts_rls_and_trigger.sql`
- **Verification:** `information_schema.columns` confirms `name IS_NULLABLE=YES`; CHECK constraint `accounts_name_required_when_onboarding_complete` present in `pg_constraint`.
- **Committed in:** `608961a` + `0e32d50`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correctness — plan's `display_name` would have caused a runtime error on trigger fire. Fix extends the slug-nullability pattern to name consistently.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - migrations applied directly to live Supabase project via CLI workaround. No environment variables or dashboard configuration needed.

## Next Phase Readiness

- **10-05 (signup page)**: trigger is live — any new `auth.users` row immediately gets a stub `accounts` row. Signup page can proceed.
- **10-06 (onboarding wizard)**: `accounts_owner_update` policy is live. Wizard Server Action can UPDATE `(slug, name, timezone, onboarding_complete)` via RLS-scoped client for `auth.uid() = owner_user_id`.
- **10-07 (soft-delete)**: `deleted_at` column exists. App-layer filtering ready to implement.
- **10-09 (RLS matrix)**: both new policies named explicitly (`accounts_owner_insert`, `accounts_owner_update`) for checklist audit.
- **Andrew's NSI account**: `onboarding_complete=true` — will never be redirected to wizard.
- **Blocker**: None.

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
