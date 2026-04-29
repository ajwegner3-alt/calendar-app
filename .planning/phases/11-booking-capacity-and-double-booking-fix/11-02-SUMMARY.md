---
phase: 11-booking-capacity-and-double-booking-fix
plan: "02"
subsystem: database
tags: [postgres, supabase, migrations, event-types, capacity]

# Dependency graph
requires:
  - phase: 11-01
    provides: CAP-01 root-cause verdict (c); Plan 03 gate PROCEED; confirmed 0 duplicate rows on prod

provides:
  - event_types.max_bookings_per_slot column (integer NOT NULL DEFAULT 1, CHECK >= 1)
  - event_types.show_remaining_capacity column (boolean NOT NULL DEFAULT false)
  - Schema foundation for Plans 11-04, 11-05, 11-07 (capacity-aware slot query, INSERT retry, form UI)

affects:
  - 11-04 (bookings INSERT retry reads max_bookings_per_slot)
  - 11-05 (slots query reads max_bookings_per_slot + show_remaining_capacity)
  - 11-07 (event-type form UI writes max_bookings_per_slot + show_remaining_capacity)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration drift workaround: npx supabase db query --linked -f (NOT db push)"
    - "ADD COLUMN IF NOT EXISTS for idempotent DDL migrations"
    - "DB minimum-only CHECK (no upper-bound) — upper cap enforced at Zod layer (Plan 07)"

key-files:
  created:
    - supabase/migrations/20260428130001_phase11_capacity_columns.sql
  modified: []

key-decisions:
  - "max_bookings_per_slot DEFAULT 1 preserves v1.0 exclusive-booking semantics for all existing rows"
  - "show_remaining_capacity DEFAULT false keeps capacity display opt-in (CAP-08 requirement)"
  - "No upper-bound CHECK on max_bookings_per_slot — Zod validation in Plan 07 handles <=50; DB keeps flexibility for future raised cap without re-migration"
  - "ADD COLUMN IF NOT EXISTS for both columns — idempotent in case of retry"

patterns-established:
  - "Phase 11 migration sequence: 20260428130001 (one second after Phase 10's 20260428120005)"

# Metrics
duration: 2min
completed: "2026-04-28"
---

# Phase 11 Plan 02: Capacity Columns Migration Summary

**Two capacity columns added to event_types via locked Supabase CLI workaround — all 4 existing prod rows defaulted to v1.0-safe values (max_bookings_per_slot=1, show_remaining_capacity=false), 9 booking API tests still green.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-29T01:33:41Z
- **Completed:** 2026-04-29T01:35:10Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments

- Created `supabase/migrations/20260428130001_phase11_capacity_columns.sql` with verbatim RESEARCH.md §Pattern 3 Migration A SQL
- Applied migration to prod via `npx supabase db query --linked -f` (locked workaround — `db push` is prohibited)
- All three verify queries passed; 4 existing event_types rows safely defaulted
- Smoke test (9 bookings-api tests) still green — v1.0 capacity=1 booking path unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Migration A** - `5339ad7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260428130001_phase11_capacity_columns.sql` - DDL adding max_bookings_per_slot + show_remaining_capacity to event_types with CHECK constraint and COMMENT clauses

## Verify-Query Output (verbatim)

### Query 1: Column metadata (information_schema.columns)

```json
[
  {
    "column_default": "1",
    "column_name": "max_bookings_per_slot",
    "data_type": "integer",
    "is_nullable": "NO"
  },
  {
    "column_default": "false",
    "column_name": "show_remaining_capacity",
    "data_type": "boolean",
    "is_nullable": "NO"
  }
]
```

**Result:** Both columns present with correct types, defaults, and NOT NULL. PASS.

### Query 2: CHECK constraint (pg_constraint)

```json
[
  {
    "conname": "event_types_max_bookings_per_slot_check",
    "pg_get_constraintdef": "CHECK ((max_bookings_per_slot >= 1))"
  }
]
```

**Result:** Constraint `event_types_max_bookings_per_slot_check` with `CHECK ((max_bookings_per_slot >= 1))`. PASS.

### Query 3: Existing rows defaulted correctly

```json
[
  {
    "defaulted_to_1": 4,
    "defaulted_to_false": 4,
    "total": 4
  }
]
```

**Result:** 4 total rows, all 4 defaulted to max_bookings_per_slot=1, all 4 defaulted to show_remaining_capacity=false. total = defaulted_to_1 = defaulted_to_false. PASS.

## Decisions Made

- **No upper-bound DB CHECK on max_bookings_per_slot** — RESEARCH.md §Pattern 3 specifies the 50-cap as a Zod-layer concern (Plan 07 event-type form schema). Keeping DB minimum-only (>= 1) leaves headroom for future raised cap without requiring a re-migration.
- **ADD COLUMN IF NOT EXISTS** — ensures the migration is idempotent and safe to retry if the CLI connection dropped mid-run.
- **DEFAULT 1 + NOT NULL on max_bookings_per_slot** — all existing NSI event types and any Phase 10 onboarding-wizard-created event types get exclusive-booking semantics automatically. No data migration needed.
- **DEFAULT false + NOT NULL on show_remaining_capacity** — CAP-08 requirement: capacity display is opt-in. Contractors don't expose appointment load to bookers unless they explicitly enable it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Migration applied cleanly on first attempt. All three verify queries matched expected output. Supabase CLI update notice (v2.92.1 → v2.95.4) is informational only, not a blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `event_types.max_bookings_per_slot` is queryable and returns `1` for all existing rows. Plans 04, 05, 07 can read/write these columns without further schema work.
- `event_types.show_remaining_capacity` is queryable and returns `false` for all existing rows.
- Plan 11-03 (slot_index migration — CONCURRENTLY index build) is next in Wave 2.
- No blockers.

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-28*
