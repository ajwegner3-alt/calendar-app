---
phase: 11-booking-capacity-and-double-booking-fix
plan: "03"
subsystem: database
tags: [postgres, migrations, partial-index, concurrently, slot_index, unique-index, supabase]

# Dependency graph
requires:
  - phase: 11-01
    provides: "CAP-01 root-cause verdict PROCEED — zero duplicate confirmed rows on prod"
  - phase: 11-02
    provides: "max_bookings_per_slot + show_remaining_capacity columns live on event_types"
provides:
  - "bookings.slot_index smallint NOT NULL DEFAULT 1 column live on prod"
  - "bookings_capacity_slot_idx UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed' live on prod"
  - "bookings_no_double_book v1.0 index dropped cleanly with zero exposure window"
  - "N-per-slot Postgres storage guarantee ready for Plan 04 INSERT retry + Plan 06 slots API"
affects: ["11-04", "11-05", "11-06", "11-07"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CONCURRENTLY index build split to separate migration file (no BEGIN/COMMIT wrapper)"
    - "Defensive DO $$ guard before DROP INDEX — refuses if new index not indisvalid=true"
    - "CLI fallback: split CONCURRENTLY statement to standalone inline query when CLI wraps file in implicit transaction"

key-files:
  created:
    - supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql
    - supabase/migrations/20260428130003_phase11_drop_old_double_book_index.sql
  modified: []

key-decisions:
  - "slot_index column: smallint NOT NULL DEFAULT 1 — backfills all v1.0 rows to slot_index=1 safely (Plan 01 PROCEED gate)"
  - "bookings_capacity_slot_idx replaces bookings_no_double_book — new index covers (event_type_id, start_at, slot_index) WHERE status='confirmed'"
  - "CLI apply path: CLI wraps -f files in implicit BEGIN/COMMIT, so CONCURRENTLY statement was applied via standalone inline query (not SQL Editor — same-session workaround worked cleanly)"
  - "Smoke test 23505 confirmed: new index rejects duplicate (event_type_id, start_at, slot_index=1) confirmed inserts"
  - "DROP executed with defensive DO $$ guard: aborts if bookings_capacity_slot_idx missing or indisvalid=false"

patterns-established:
  - "Split migration pattern: CONCURRENTLY builds in file without BEGIN/COMMIT; dependent DDL in separate file with BEGIN/COMMIT"
  - "Pitfall 3 guard: always verify indisvalid=true + indisready=true before dropping predecessor index"

# Metrics
duration: 15min
completed: "2026-04-28"
---

# Phase 11 Plan 03: Slot-Index Migration Summary

**`bookings.slot_index` column + `bookings_capacity_slot_idx` UNIQUE partial index live on prod; `bookings_no_double_book` v1.0 index dropped cleanly — N-per-slot DB storage guarantee now enforced via `(event_type_id, start_at, slot_index) WHERE status='confirmed'`**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-29T01:37:41Z
- **Completed:** 2026-04-29T01:52:00Z
- **Tasks:** 2
- **Files modified:** 2 (migration files created)

## Accomplishments

- `bookings.slot_index smallint NOT NULL DEFAULT 1` column added; all 2 existing confirmed rows backfilled to slot_index=1
- `bookings_capacity_slot_idx UNIQUE (event_type_id, start_at, slot_index) WHERE status='confirmed'` built CONCURRENTLY — `indisvalid=true`, `indisready=true` confirmed via Pitfall 3 check
- `bookings_no_double_book` v1.0 single-capacity partial unique index dropped via defensive transaction (DO $$ guard passed — new index was live); zero exposure window (old index not dropped until new one validated)
- Smoke 23505 test: duplicate confirmed INSERT → `ERROR 23505: duplicate key value violates unique constraint "bookings_capacity_slot_idx"` — new index enforcing correctly

## pg_indexes: Before vs After

### Before (Plan 03 start)

```
bookings_account_start_idx    — CREATE INDEX ... USING btree (account_id, start_at)
bookings_cancel_token_idx     — CREATE INDEX ... USING btree (cancel_token_hash)
bookings_no_double_book       — CREATE UNIQUE INDEX ... (event_type_id, start_at) WHERE status='confirmed'
bookings_pkey                 — CREATE UNIQUE INDEX ... USING btree (id)
bookings_reminder_scan_idx    — CREATE INDEX ... WHERE status='confirmed' AND reminder_sent_at IS NULL
bookings_reschedule_token_idx — CREATE INDEX ... USING btree (reschedule_token_hash)
```

### After (Plan 03 complete)

```
bookings_account_start_idx    — CREATE INDEX ... USING btree (account_id, start_at)
bookings_cancel_token_idx     — CREATE INDEX ... USING btree (cancel_token_hash)
bookings_capacity_slot_idx    — CREATE UNIQUE INDEX ... (event_type_id, start_at, slot_index) WHERE status='confirmed'  [NEW]
bookings_pkey                 — CREATE UNIQUE INDEX ... USING btree (id)
bookings_reminder_scan_idx    — CREATE INDEX ... WHERE status='confirmed' AND reminder_sent_at IS NULL
bookings_reschedule_token_idx — CREATE INDEX ... USING btree (reschedule_token_hash)
```

`bookings_no_double_book` → GONE. `bookings_capacity_slot_idx` → LIVE.

## Smoke 23505 Verification Output

```
unexpected status 400: {"message":"Failed to run sql query: ERROR:  23505: duplicate key value violates unique constraint \"bookings_capacity_slot_idx\"\nDETAIL:  Key (event_type_id, start_at, slot_index)=(5db348b8-7eae-4de9-a5ec-1dd2593ffac4, 2026-04-29 15:30:00+00, 1) already exists.\n"}
```

New index correctly rejects duplicate `(event_type_id, start_at, slot_index=1)` confirmed inserts — v1.0 capacity=1 semantics preserved.

## Pitfall 3 Check Output

```json
{
  "index_name": "bookings_capacity_slot_idx",
  "is_valid": true,
  "is_ready": true,
  "size": "16 kB",
  "definition": "CREATE UNIQUE INDEX bookings_capacity_slot_idx ON public.bookings USING btree (event_type_id, start_at, slot_index) WHERE (status = 'confirmed'::booking_status)"
}
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Write Migration B Part 1 (slot_index + CONCURRENTLY index)** — `4a4e1ec` (feat)
2. **Task 2: Apply both migrations, verify, write Migration B Part 2** — `35e7251` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql` — Part 1: ALTER TABLE ADD COLUMN slot_index + CREATE UNIQUE INDEX CONCURRENTLY (no BEGIN/COMMIT)
- `supabase/migrations/20260428130003_phase11_drop_old_double_book_index.sql` — Part 2: BEGIN/COMMIT with DO $$ guard + DROP INDEX IF EXISTS bookings_no_double_book

## Decisions Made

1. **CLI implicit transaction fallback confirmed:** `npx supabase db query --linked -f` wraps -f files in an implicit transaction, causing `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`. Workaround: the CONCURRENTLY statement was applied via a standalone inline `echo "..." | npx supabase db query --linked` call (single statement = its own implicit transaction, no CLI wrapping). This is fully equivalent to the SQL Editor path documented in the plan — no manual web dashboard access was required.

2. **Pitfall 3 check passed cleanly:** After the CONCURRENTLY build, `indisvalid=true` and `indisready=true` verified before writing/applying Part 2. No partial index state encountered.

3. **DO $$ defensive guard executed correctly:** Part 2 confirmed `bookings_capacity_slot_idx` was live and valid before issuing DROP INDEX — guard passed, old index dropped successfully.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CLI wraps -f files in implicit transaction — CONCURRENTLY fails**
- **Found during:** Task 2 (Apply Migration B Part 1)
- **Issue:** `npx supabase db query --linked -f` wraps the file in BEGIN/COMMIT implicitly; `CREATE UNIQUE INDEX CONCURRENTLY` cannot run inside a transaction block; exit code 1 with `ERROR: 25001`
- **Fix:** Applied the three SQL statements separately as standalone inline queries (ALTER TABLE, COMMENT ON COLUMN, CREATE UNIQUE INDEX CONCURRENTLY each in their own `echo | npx supabase db query --linked` call). This is the documented CLI fallback from the plan — no SQL Editor web access needed.
- **Files modified:** None (apply-only; no migration file changes)
- **Verification:** All three queries returned `rows: []` (success); subsequent column/index verification queries confirmed both column and index live on prod
- **Committed in:** `35e7251` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking — known CLI behavior, documented fallback in plan)
**Impact on plan:** No scope creep. Plan explicitly documented this fallback path. Functionally equivalent to planned approach.

## Issues Encountered

- CLI wraps -f files in implicit transaction (known behavior per locked workaround documentation). Resolved via standalone inline query approach — simpler than SQL Editor web dashboard.

## User Setup Required

None — no external service configuration required. All changes are pure Postgres DDL applied to linked Supabase project via CLI.

## Next Phase Readiness

- **Plan 04 (bookings INSERT retry):** `bookings_capacity_slot_idx` is live — Plan 04 can implement the INSERT + 23505-catch retry loop for N-per-slot booking
- **Plan 05 (slots API `/api/slots` fix):** slot_index column exists; Plan 05 must fix `.neq("status","cancelled")` → `.eq("status","confirmed")` per Pitfall 4 (capacity-accuracy fix)
- **Plan 06:** `bookings_capacity_slot_idx` definition confirmed; no further schema work needed
- **No blockers for Wave 2 continuation**

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-28*
