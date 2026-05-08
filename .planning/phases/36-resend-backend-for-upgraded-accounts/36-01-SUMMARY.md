---
phase: 36-resend-backend-for-upgraded-accounts
plan: 01
subsystem: database
tags: [postgres, supabase, migration, typescript, email, resend]

# Dependency graph
requires:
  - phase: 35-per-account-gmail-oauth-send
    provides: email_send_log table with account_id column; getSenderForAccount factory; EmailProvider type union
provides:
  - Forward migration adding accounts.email_provider (TEXT NOT NULL DEFAULT 'gmail', CHECK IN ('gmail','resend'))
  - Forward migration adding accounts.resend_status (TEXT NOT NULL DEFAULT 'active', CHECK IN ('active','suspended'))
  - Forward migration adding email_send_log.provider (TEXT NOT NULL DEFAULT 'gmail')
  - EmailProvider TypeScript union extended to "gmail" | "resend"
affects:
  - 36-02 (Resend provider implementation — declares provider:"resend" on EmailClient)
  - 36-03 (getSenderForAccount factory — reads accounts.email_provider and accounts.resend_status in DB query)
  - future analytics queries against email_send_log

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TEXT + CHECK constraint for provider flags (not ENUM) — matches plan spec; easier to ALTER than ENUM
    - PostgreSQL constant-default fast-path for ADD COLUMN backfill — no row rewrite needed, UPDATE is documentation-only

key-files:
  created:
    - supabase/migrations/20260507120000_phase36_resend_provider.sql
  modified:
    - lib/email-sender/types.ts

key-decisions:
  - "Used TEXT + CHECK constraints (not ENUM) for email_provider and resend_status — consistent with plan spec and easier to ALTER later"
  - "Migration is forward-only, no _ROLLBACK.sql partner — matches Phase 35 precedent (20260506140000)"
  - "Migration NOT applied to hosted Supabase — Phase 36 is framework-only until PREREQ-03 (Resend account + DNS verification) is complete"
  - "tsc pre-existing errors in tests/ confirmed baseline (identical before and after change) — zero new errors introduced"

patterns-established:
  - "Phase 36 provider flag pattern: accounts.email_provider = 'gmail' | 'resend' — Andrew flips manually in Supabase dashboard per upgrade request"
  - "resend_status independence: suspension flag is separate from provider flip so Andrew can suspend without forcing a downgrade back to gmail"

# Metrics
duration: 1min
completed: 2026-05-08
---

# Phase 36 Plan 01: Schema and Types Summary

**Forward migration adding accounts.email_provider/'resend_status' and email_send_log.provider columns, plus EmailProvider TypeScript union extended to "gmail" | "resend" — zero runtime behavior change, all existing accounts default to 'gmail'**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-08T12:27:03Z
- **Completed:** 2026-05-08T12:28:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `supabase/migrations/20260507120000_phase36_resend_provider.sql` with three `ALTER TABLE` statements: `accounts.email_provider`, `accounts.resend_status`, and `email_send_log.provider`, all with appropriate CHECK constraints and DEFAULT values
- Extended `EmailProvider` TypeScript union from `"gmail"` to `"gmail" | "resend"` in `lib/email-sender/types.ts`
- Verified grep checks: 2x `ALTER TABLE accounts`, 1x `ALTER TABLE email_send_log` — all pass
- Confirmed zero new TypeScript errors introduced (pre-existing test-file errors are baseline, identical before and after change)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Phase 36 schema migration** - `c3b0e0b` (feat)
2. **Task 2: Extend EmailProvider type union** - `a0fb2f3` (feat)

**Plan metadata:** `a6e5194` (docs: complete schema-and-types plan)

## Files Created/Modified

- `supabase/migrations/20260507120000_phase36_resend_provider.sql` — Forward migration: adds `accounts.email_provider` (DEFAULT 'gmail', CHECK IN ('gmail','resend')), `accounts.resend_status` (DEFAULT 'active', CHECK IN ('active','suspended')), `email_send_log.provider` (DEFAULT 'gmail'); documentation-only backfill UPDATE
- `lib/email-sender/types.ts` — One-line change: `EmailProvider = "gmail" | "resend"` (was `"gmail"` only)

## Decisions Made

- **TEXT + CHECK, not ENUM:** Plan spec specified this — easier to `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` to add a third value later than to `ALTER TYPE` an ENUM (which requires a transaction and can't be done in some Postgres versions inside a transaction at all).
- **Migration NOT applied to hosted Supabase:** Per plan execution constraints, Phase 36 is framework-only. `accounts.email_provider` column is deferred until PREREQ-03 (Resend account + NSI domain DNS verification) is complete and Andrew is ready to onboard a Resend customer.
- **Forward-only migration:** Matches Phase 35 precedent — no `_ROLLBACK.sql` partner file created.

## Deviations from Plan

None — plan executed exactly as written.

The `npx tsc --noEmit` pre-existing errors in `tests/` (mock infrastructure `__mockSendCalls`, `__setTurnstileResult` exports, implicit `any` params) are a carry-over baseline from prior phases. Confirmed identical output before and after this plan's changes via git stash/pop test. No new errors introduced.

## Issues Encountered

None. Supabase CLI not invoked (framework-only; local apply deferred per plan constraint). Grep verification checks are the binding verification per plan instructions.

## User Setup Required

None at this stage. When PREREQ-03 is complete and an account is ready to flip to Resend:

1. Apply migration to hosted Supabase via `mcp__claude_ai_Supabase__apply_migration` (same as Phase 35 deviation pattern)
2. Add `RESEND_API_KEY` to Vercel env vars
3. Flip `accounts.email_provider = 'resend'` for the target account in Supabase dashboard

## Next Phase Readiness

- **Plan 02 (Resend provider implementation)** is unblocked: `EmailProvider` union now accepts `"resend"`, so `provider: "resend"` on the returned `EmailClient` will compile clean
- **Plan 03 (factory routing)** is unblocked: `accounts.email_provider` and `accounts.resend_status` columns exist in the migration for the DB query to read
- **Blocker for live testing:** PREREQ-03 still pending (Resend account + NSI domain DNS verification). Plans 02-03 can be implemented and tested with mocks; end-to-end Resend sends require PREREQ-03

---
*Phase: 36-resend-backend-for-upgraded-accounts*
*Completed: 2026-05-08*
