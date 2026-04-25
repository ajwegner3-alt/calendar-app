---
phase: 05-public-booking-flow
plan: 01
subsystem: database
tags: [supabase, postgres, migration, accounts, email, ics]

# Dependency graph
requires:
  - phase: 04-availability-engine
    provides: accounts table with buffer_minutes/min_notice_hours/max_advance_days/daily_cap columns (04-01 migration)
  - phase: 01-foundation
    provides: initial_schema with accounts table including owner_user_id, slug, name, timezone
provides:
  - accounts.owner_email TEXT nullable column, applied live on mogfnutxrrbtvnaupoun
  - nsi account row seeded with owner_email = ajwegner3@gmail.com
  - idempotent migration file at supabase/migrations/20260426120000_account_owner_email.sql
affects:
  - 05-public-booking-flow (plans 02-06): POST /api/bookings reads accounts.owner_email for .ics ORGANIZER + owner notification recipient
  - 07-widget-and-branding: future per-account "from" branding may extend this column

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADD COLUMN IF NOT EXISTS for idempotent column additions (established in 04-01, reused here)"
    - "Seed UPDATE uses WHERE slug = 'nsi' AND owner_email IS NULL (idempotent backfill)"
    - "supabase db query --linked -f <file> as CLI migration apply (MCP fallback confirmed working)"

key-files:
  created:
    - supabase/migrations/20260426120000_account_owner_email.sql
  modified: []

key-decisions:
  - "Plain TEXT (not citext) for owner_email — no per-account uniqueness requirement, no equality lookup against this column; citext extension dependency unneeded"
  - "Nullable column — backward compat with existing rows; nsi backfilled below; v2 signup will populate at account creation"
  - "No CHECK constraint on email format — application-layer Zod validation is sufficient; Postgres regex on email is brittle"
  - "Applied via supabase db query --linked (CLI), not Supabase MCP — MCP available but CLI worked cleanly; both methods confirmed equivalent per STATE.md decision"

patterns-established:
  - "Owner email: denormalized on accounts table, not runtime-joined from auth.users — simpler for admin-client public route handlers; survives auth provider migrations"

# Metrics
duration: 2min
completed: 2026-04-25
---

# Phase 5 Plan 01: Migration — accounts.owner_email + seed nsi — Summary

**Nullable `owner_email TEXT` column added to accounts table via idempotent migration, seeded with ajwegner3@gmail.com on the nsi row — unlocking .ics ORGANIZER field and owner notification email for Phase 5 booking flow**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-25T21:14:29Z
- **Completed:** 2026-04-25T21:16:06Z
- **Tasks:** 1 / 1
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/20260426120000_account_owner_email.sql` with idempotent `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_email text`
- Applied migration live on Supabase project `mogfnutxrrbtvnaupoun` via `supabase db query --linked`
- Verified live: `nsi.owner_email = 'ajwegner3@gmail.com'` confirmed via service-role SELECT
- Committed and pushed to `main` (dcbe764)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create + apply owner_email migration** - `dcbe764` (feat)

## Files Created/Modified

- `supabase/migrations/20260426120000_account_owner_email.sql` — idempotent ALTER + COMMENT + seed UPDATE for nsi account

## Decisions Made

- **Plain TEXT for owner_email** — no citext; no uniqueness requirement or equality lookup on this column; Phase 1 uses citext only for `booker_email` which has lookup needs
- **Nullable column** — existing accounts (only nsi today) backfilled below; v2 multi-tenant signup sets at account creation
- **No email format CHECK** — Zod validates at application layer; Postgres regex on email is brittle
- **CLI apply method** — `supabase db query --linked -f` used; confirmed link is established and working (STATE.md concern about `supabase link` resolved — link was already done)

## Schema Notes for Downstream Plans

- **`bookings.cancel_token_hash` and `bookings.reschedule_token_hash`** already exist as `NOT NULL TEXT` in the initial schema (20260419120000). Phase 5 (Plan 05-04 booking POST handler) generates raw UUID tokens, SHA-256 hashes them, and inserts the hash. No new token columns needed.
- **`bookings.booker_phone`** is intentionally nullable at the DB layer. Required-ness enforced in Zod schema at Plan 05-03. No NOT NULL to add.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Supabase CLI link was already established from prior phases; `supabase db query --linked` succeeded on first try.

## User Setup Required

None — Andrew's email was seeded automatically by the migration.

## Next Phase Readiness

- `accounts.owner_email` populated for `nsi` — Phase 5 plans 02–06 can now query `accounts.owner_email` via `createAdminClient().from('accounts').select('owner_email, name, timezone')` without additional setup
- `.ics` ORGANIZER field will resolve to `ajwegner3@gmail.com` for all NSI bookings
- Owner notification emails will route to `ajwegner3@gmail.com`
- No blockers for Phase 5 Plan 02 (public booking page UI)

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
