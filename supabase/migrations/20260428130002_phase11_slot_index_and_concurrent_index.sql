-- Phase 11 Migration B Part 1: Add slot_index column + new unique index CONCURRENTLY.
-- Per RESEARCH.md §Pattern 3 + §Pitfall 2.
-- This file MUST NOT contain BEGIN/COMMIT — CREATE UNIQUE INDEX CONCURRENTLY
-- requires running outside any explicit transaction block.

-- Step 1: Add slot_index column. All existing confirmed rows backfill to slot_index=1
-- (preserves v1.0 semantics — those rows are at slot_index=1 in the new index).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS slot_index smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN bookings.slot_index IS
  'Per-slot capacity index (1..max_bookings_per_slot). All v1.0 rows default to 1.
   The unique index bookings_capacity_slot_idx WHERE status=''confirmed'' enforces
   that no two confirmed bookings share (event_type_id, start_at, slot_index).';

-- Step 2: Create new partial unique index CONCURRENTLY.
-- CONCURRENTLY = non-blocking; existing reads/writes continue during build.
-- IF NOT EXISTS guards against re-running this migration.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS bookings_capacity_slot_idx
  ON bookings(event_type_id, start_at, slot_index)
  WHERE status = 'confirmed';
