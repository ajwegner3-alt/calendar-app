---
phase: 03-event-types-crud
plan: 01
subsystem: database
tags: [postgres, migration, soft-delete, partial-index, supabase, event-types]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: initial event_types table with unique(account_id, slug) constraint

provides:
  - event_types.deleted_at timestamptz column (nullable) — soft-delete marker
  - Partial unique index event_types_account_id_slug_active enforcing slug uniqueness only among non-deleted rows
  - Dropped table-level unique constraint event_types_account_id_slug_key

affects:
  - 03-event-types-crud (Plans 02-04) — all server actions rely on deleted_at column and partial index semantics
  - 06-cancel-reschedule — bookings query patterns inherit soft-delete concepts
  - 08-reminders-hardening — potential future soft-delete patterns elsewhere

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-delete via deleted_at timestamptz NULL (no boolean is_archived flag)"
    - "Partial unique index for scoped uniqueness among active rows only"
    - "Idempotent migrations: ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS"
    - "supabase db query --linked -f <file> for DDL migration apply (CLI Management API path)"

key-files:
  created:
    - supabase/migrations/20260424120000_event_types_soft_delete.sql
  modified:
    - .env.local (TEST_OWNER_PASSWORD quoted to fix dotenv # comment trap)

key-decisions:
  - "Soft-delete via deleted_at column (not boolean): null = active, timestamptz = archived. Enables audit trail and point-in-time restore semantics."
  - "Partial unique index replaces full table-level constraint: only non-deleted rows enforce slug uniqueness — slug becomes reusable after archive."
  - "Migration applied via supabase db query --linked -f (CLI Management API), not supabase db push (requires DB password). Same pattern as STATE.md Phase 1 decision but using CLI linked mode instead of MCP."
  - "CTE slug-reuse smoke test: sequential steps required (not a single CTE) because Postgres CTEs run concurrently — the UPDATE in arc does not become visible to ins2 within the same statement."

patterns-established:
  - "Soft-delete pattern: Filter active rows with .is('deleted_at', null) in supabase-js; server actions write deleted_at = now() for archive."
  - "Slug reuse after archive: Guaranteed by partial index; no application-level guard needed."
  - "Idempotent migration format: All three DDL verbs use IF [NOT] EXISTS guards."

# Metrics
duration: 25min
completed: 2026-04-25
---

# Phase 03 Plan 01: Schema Migration Summary

**Soft-delete column + partial unique index on event_types: `deleted_at timestamptz` added, `event_types_account_id_slug_key` constraint dropped, `event_types_account_id_slug_active WHERE (deleted_at IS NULL)` partial index created and verified live.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-25T04:20:00Z (approx)
- **Completed:** 2026-04-25T04:45:49Z
- **Tasks:** 2 (both complete)
- **Files modified:** 2 (migration SQL created; .env.local bug-fixed)

## Accomplishments

- Authored idempotent migration SQL with three guarded DDL statements
- Applied migration to live Supabase project (ref `mogfnutxrrbtvnaupoun`) via `supabase db query --linked`
- Verified all three structural changes in Postgres (`information_schema`, `pg_indexes`, `pg_constraint`)
- Ran slug-reuse smoke test: insert → archive → re-insert same slug succeeded (2 rows, 1 archived, 1 active)
- Cleaned up all smoke test rows
- All 17 existing Vitest tests pass (race-guard, RLS lockout, authenticated-owner)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author the migration SQL file** - `1f8db7a` (feat)
2. **Task 2: Apply migration + verify** — no separate commit (migration file already committed in Task 1; .env.local is gitignored)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/20260424120000_event_types_soft_delete.sql` — Phase 3 migration: ADD COLUMN deleted_at, DROP CONSTRAINT event_types_account_id_slug_key, CREATE UNIQUE INDEX event_types_account_id_slug_active WHERE deleted_at IS NULL
- `.env.local` (gitignored) — Quoted TEST_OWNER_PASSWORD to fix dotenv # comment parsing bug

## Decisions Made

- **Soft-delete via `deleted_at` column:** null = active, timestamptz = archived. No boolean `is_archived` flag needed; timestamp provides audit-trail-ready semantics and enables future point-in-time queries.
- **Partial index is the load-bearing uniqueness guard:** Without it, archived event types would permanently occupy their slugs, blocking slug reuse after archive and breaking the restore UX (would throw `23505 unique_violation`).
- **Migration apply method:** `supabase db query --linked -f <file>` via CLI Management API, not `supabase db push` (which requires DB password — per STATE.md decision). `supabase link --project-ref mogfnutxrrbtvnaupoun` was run first (required).
- **Smoke test implementation:** CTE approach from plan fails (Postgres CTE parallel execution means the UPDATE doesn't commit before ins2 runs). Switched to sequential statements: INSERT → UPDATE → INSERT → verify counts. Outcome confirmed partial index behavior (allows 2 rows with same slug, 1 archived + 1 active).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed dotenv `#` comment trap in `.env.local` for TEST_OWNER_PASSWORD**

- **Found during:** Task 2 verification — `npm test` ran and the `rls-authenticated-owner.test.ts` suite errored with "TEST_OWNER_EMAIL / TEST_OWNER_PASSWORD missing"
- **Issue:** `TEST_OWNER_PASSWORD=#plaNNing4succ3ss!` — dotenvx parses the `#` as the start of a comment, yielding an empty value for the env var. This caused 4 tests in the authenticated-owner suite to fail.
- **Fix:** Quoted the value: `TEST_OWNER_PASSWORD="#plaNNing4succ3ss!"` — standard dotenv quoting for values starting with `#`.
- **Files modified:** `.env.local` (gitignored)
- **Verification:** Node script confirmed `TEST_OWNER_PASSWORD` now has length 18, starts with `#`. All 17 Vitest tests pass.
- **Note:** This is the pre-existing "dotenv quoting trap" documented in STATE.md Carried Concerns. The quoting fix is local-only (.env.local is gitignored); Andrew should apply the same fix to any other environments where this password is stored.

**2. [Rule 1 - Bug] CTE smoke test replaced with sequential statements**

- **Found during:** Task 2 — the plan's CTE slug-reuse test raised `23505 unique_violation` (second INSERT conflicted with first because the UPDATE in the same CTE ran concurrently, not committing before ins2 saw the row).
- **Issue:** Postgres CTEs do NOT provide inter-CTE row visibility in the same statement — all CTEs see the same snapshot. The UPDATE in `arc` was not visible to `ins2` in the same query.
- **Fix:** Rewrote smoke test as three sequential statements (INSERT, UPDATE, INSERT) run via `-f` flag in separate CLI invocations. Confirmed 2 rows with same slug (1 archived, 1 active).
- **Files modified:** Temp file `supabase/migrations/_smoke_test_tmp.sql` (deleted after use)
- **Verification:** Counts confirmed: `total_rows=2`, `archived_rows=1`, `active_rows=1`. Partial index working correctly.

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for correctness and test reliability. No scope creep.

## Issues Encountered

- **Supabase MCP `apply_migration` not in scope for this Claude Code session.** MCP tools are exposed via Claude Desktop, not Claude Code CLI. Worked around by using `supabase db query --linked -f <file>` via the Supabase CLI v2.92.1, which uses the Management API path (same effect as MCP `execute_sql`). Per plan: "If `apply_migration` is unavailable for any reason, fall back to the MCP `execute_sql` tool with the same SQL. Either path is acceptable."

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `deleted_at` column on `event_types` | `timestamp with time zone`, nullable | `timestamp with time zone`, `YES` | PASSED |
| Partial index `event_types_account_id_slug_active` indexdef | Contains `WHERE (deleted_at IS NULL)` | `CREATE UNIQUE INDEX event_types_account_id_slug_active ON public.event_types USING btree (account_id, slug) WHERE (deleted_at IS NULL)` | PASSED |
| Old constraint `event_types_account_id_slug_key` gone | Zero rows from `pg_constraint WHERE contype='u'` | `rows: []` | PASSED |
| Slug reuse smoke test | total=2, archived=1, active=1 | `total_rows=2, archived_rows=1, active_rows=1` | PASSED |
| Cleanup DELETE | All test rows removed | `rows: []` confirmed | PASSED |
| Vitest suite regression | 17 tests pass | 17/17 passed | PASSED |

## Constraint Name Verification

The auto-named constraint `event_types_account_id_slug_key` was confirmed as the actual constraint name via `pg_constraint` query (zero rows after DROP, as expected). The `DROP CONSTRAINT IF EXISTS event_types_account_id_slug_key` in the migration matched the Postgres auto-name exactly.

## Next Phase Readiness

- **Plans 03-02 through 03-04** can proceed immediately — `deleted_at` column and partial index are live
- Server actions should filter active rows with `.is('deleted_at', null)` in supabase-js
- Archive writes use `update event_types set deleted_at = now() where id = ...`
- Slug uniqueness among active rows is now DB-enforced; no application guard needed
- No blockers

---
*Phase: 03-event-types-crud*
*Completed: 2026-04-25*
