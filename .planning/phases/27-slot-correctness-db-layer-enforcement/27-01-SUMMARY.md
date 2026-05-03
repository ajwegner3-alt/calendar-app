---
phase: 27-slot-correctness-db-layer-enforcement
plan: 01
subsystem: database
tags: [postgres, exclude-constraint, btree_gist, tstzrange, supabase, migration, ddl]

# Dependency graph
requires:
  - phase: research-phase-27
    provides: "Locked EXCLUDE constraint mechanism (Option A, rejected Option B trigger fallback). DDL live-verified on prod Postgres 17.6.1."
provides:
  - "btree_gist extension installed in production"
  - "bookings.during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED column"
  - "EXCLUDE constraint bookings_no_account_cross_event_overlap with operators (account_id =, event_type_id <>, during &&) WHERE status='confirmed'"
  - "Pre-flight diagnostic SQL file (re-runnable) confirming zero cross-event overlap rows in prod"
  - "Reverse-SQL rollback file (paste-runnable) for fast revert if Plan 27-02..05 surface issues"
affects:
  - "27-02-error-mapping (will catch 23P01 from this constraint and map to 409)"
  - "27-03-application-precheck (will issue ROLLBACK on 23P01 in retry loops)"
  - "27-04 / 27-05 (slot correctness verification + manual QA both depend on this constraint being live)"

# Tech tracking
tech-stack:
  added:
    - "btree_gist (Postgres extension) -- enables UUID equality inside gist indexes"
  patterns:
    - "DB-layer invariant via EXCLUDE constraint with partial WHERE on status -- cancelled rows transparently exit the constraint without DELETE"
    - "Generated tstzrange column with half-open '[)' bound -- adjacent slots non-overlapping by design (V14-CP-02)"
    - "Pre-flight diagnostic + hard-gate checkpoint pattern for VALIDATE-CONSTRAINT-aborting DDL (V14-CP-06)"
    - "Single-step ADD CONSTRAINT vs NOT VALID + VALIDATE branched on row-count threshold (10k)"

key-files:
  created:
    - "supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql"
    - "supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql"
    - "supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql"
  modified: []

key-decisions:
  - "Single-step ADD CONSTRAINT chosen (bookings_total = 6 << 10k threshold). NOT VALID branch removed from migration file for unambiguity."
  - "Pre-flight diagnostic returned zero overlap rows -- VALIDATE-CONSTRAINT abort risk eliminated before DDL ran (V14-CP-06 hard gate satisfied without manual data resolution)."
  - "Rollback intentionally does NOT drop btree_gist extension -- harmless to leave installed, may be reused by future constraints."

patterns-established:
  - "Pre-flight diagnostic file co-located with migration (same timestamp prefix family) so future operators see the gate-and-apply pair together"
  - "Migration header documents bookings_total + chosen path so audit trail of the threshold decision lives in the SQL file itself, not just the SUMMARY"

# Metrics
duration: ~10min (post-checkpoint Tasks 2 + 3)
completed: 2026-05-03
---

# Phase 27 Plan 01: Pre-flight + EXCLUDE Constraint Migration Summary

**Account-scoped cross-event-type overlap invariant now enforced at the Postgres layer via `EXCLUDE USING gist (account_id =, event_type_id <>, during &&) WHERE status='confirmed'`, backed by a generated `tstzrange` column and `btree_gist` extension.**

## Performance

- **Duration:** ~10 min (post-checkpoint resume; Tasks 2 + 3)
- **Completed:** 2026-05-03T19:51:41Z
- **Tasks:** 3 (Task 1 was completed pre-checkpoint)
- **Files created:** 3 (1 diagnostic, 1 forward migration, 1 rollback)

## Accomplishments

- **Pre-flight hard gate (V14-CP-06) satisfied without manual intervention** — diagnostic returned 0 cross-event overlap rows in production, eliminating the `VALIDATE CONSTRAINT` abort risk before any DDL ran.
- **EXCLUDE constraint live in production** — Postgres now refuses any INSERT/UPDATE that would put the same `account_id` in two different `event_type_id` confirmed bookings whose intervals overlap.
- **Generated column `during` (tstzrange, half-open `[)`)** in place — adjacent slots (e.g., 9:00–9:30 and 9:30–10:00) are correctly NON-overlapping per V14-CP-02.
- **Same-event-type capacity preserved** — `event_type_id WITH <>` means the existing partial-unique capacity index (Phase 11) remains the authority for stacking same-type bookings; this constraint only fires across DIFFERENT event types.
- **Rollback path written and ready** — `20260503120001_..._ROLLBACK.sql` will drop the constraint + column in seconds if Plan 27-02..05 surface issues. `btree_gist` intentionally retained.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author pre-flight diagnostic SQL + execute against prod** — `c8bd9e7` (feat)
2. **Task 2: Author forward migration + rollback SQL** — `71ab982` (chore)
3. **Task 3: Apply forward migration to production** — `56982ac` (feat)

**Plan metadata commit:** (this commit, after SUMMARY write)

## Files Created/Modified

- `supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql` — Read-only diagnostic. Returns `bookings_total` count + every cross-event confirmed overlap pair. Re-runnable any time to spot-check the invariant.
- `supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql` — Forward migration: `CREATE EXTENSION IF NOT EXISTS btree_gist`, `ADD COLUMN during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED`, `ADD CONSTRAINT bookings_no_account_cross_event_overlap EXCLUDE USING gist (account_id =, event_type_id <>, during &&) WHERE (status = 'confirmed')`. Wrapped in single `BEGIN; ... COMMIT;`.
- `supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql` — Reverse SQL: `DROP CONSTRAINT IF EXISTS` + `DROP COLUMN IF EXISTS during`. `btree_gist` deliberately preserved.

## Decisions Made

### bookings_total = 6 (< 10k threshold)

**Single-step ADD CONSTRAINT chosen.** Justification: with only 6 rows in `bookings`, the brief ACCESS EXCLUSIVE lock during synchronous full-table validation is imperceptible. The two-step `NOT VALID` + `VALIDATE CONSTRAINT` form is reserved for tables large enough that a synchronous scan under ACCESS EXCLUSIVE would materially block production traffic. The NOT-VALID branch was deleted from the file (rather than commented out) so the applied SQL is unambiguous.

### Pre-flight diagnostic outcome

Diagnostic execution against production returned:
- `bookings_total` = **6**
- Cross-event overlap rows = **0** (empty result set)

The hard gate (V14-CP-06) passed without requiring any data resolution. Andrew typed `proceed` at the post-Task-1 checkpoint.

### Rollback strategy

`btree_gist` extension is **NOT** dropped on rollback. Rationale: the extension is harmless when unused, may be reused by future constraints, and dropping it can fail if any other index depends on it. A separate manual `DROP EXTENSION IF EXISTS btree_gist;` step is documented in the rollback file's header comment for the rare case it's needed.

## Verification Output (Production, Verbatim)

### `pg_constraint` query

```
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'bookings_no_account_cross_event_overlap';
```

Result (1 row):

| conname | pg_get_constraintdef |
|---|---|
| `bookings_no_account_cross_event_overlap` | `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE ((status = 'confirmed'::booking_status))` |

This is the authoritative goal-backward verification artifact. Operators match the plan exactly:
- `account_id WITH =` ✓
- `event_type_id WITH <>` ✓
- `during WITH &&` ✓
- Partial `WHERE ((status = 'confirmed'::booking_status))` ✓ (Postgres normalizes the bare string literal to its enum cast — semantically identical to the source `WHERE (status = 'confirmed')`)

### `information_schema.columns` query

```
SELECT column_name, data_type, generation_expression
FROM information_schema.columns
WHERE table_name = 'bookings' AND column_name = 'during';
```

Result (1 row):

| column_name | data_type | generation_expression |
|---|---|---|
| `during` | `tstzrange` | `tstzrange(start_at, end_at, '[)'::text)` |

Postgres renders the half-open bound as `'[)'::text` after parsing — semantically identical to the source `'[)'`. V14-CP-02 satisfied.

### Apply command output

```
echo | npx supabase db query --linked -f supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql
```

Returned `{"rows": []}` (DDL produces no rowset; this is the success signal for `db query --linked` against DDL files). No errors, no warnings beyond the standard CLI version-update notice. Exit code 0.

## Deviations from Plan

None — plan executed exactly as written.

The pre-flight gate passed cleanly (zero overlap rows), so the contingency branch documented in the plan (manual cancel/reschedule of conflicting bookings) was never exercised. The single-step migration form selected by the plan's own threshold rule (< 10k) was applied without modification.

## Issues Encountered

None. Both verification queries returned the expected single row on first execution. No rollback was needed.

## Authentication Gates

None encountered during this plan. The `npx supabase db query --linked` path was already linked to the production project (carried over from prior phases' migrations), so no `supabase login` prompt was triggered.

## User Setup Required

None — no external service configuration needed for this plan. The btree_gist extension was created in the migration itself; no Supabase dashboard action required.

## Next Phase Readiness

**Plan 27-02 (Error Mapping) may proceed.** The DB-layer invariant is live and verified. Plan 27-02 will:

1. Catch Postgres error code `23P01` (exclusion_violation) in `app/api/bookings/route.ts` BEFORE the existing 23505 retry branch and return 409 (V14-MP-01).
2. Catch the same code in `lib/bookings/reschedule.ts` and map to the existing `slot_taken` error path (V14-MP-02).
3. Issue `ROLLBACK` if the failed insert is inside a transaction so the retry loop doesn't reuse a poisoned txn (V14-mp-01).

**No blockers.** The constraint name `bookings_no_account_cross_event_overlap` is the literal value Plan 27-02 will pattern-match against in error.constraint or use as a sentinel for the 409 response.

**Test suite status:** Not re-run in this plan since no application code changed. The constraint should be invisible to existing tests because none of them exercise cross-event overlap on the same account. Plan 27-02's tests will be the first to exercise the constraint's failure path.

---
*Phase: 27-slot-correctness-db-layer-enforcement*
*Completed: 2026-05-03*
