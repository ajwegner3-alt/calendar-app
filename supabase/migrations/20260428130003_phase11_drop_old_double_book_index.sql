-- Phase 11 Migration B Part 2: Drop the v1.0 single-capacity partial unique index.
-- Pre-requisite: bookings_capacity_slot_idx must be live + indisvalid=true (verified before this file applies).
-- The new index has been live since Migration B Part 1 finished CONCURRENTLY,
-- so dropping the old index is sub-millisecond and zero-exposure.

BEGIN;
  -- Defensive guard: only drop if the new index exists and is valid.
  -- If new index is missing or invalid, this transaction will see indisvalid=false and we abort.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = 'bookings_capacity_slot_idx' AND i.indisvalid = true
    ) THEN
      RAISE EXCEPTION 'bookings_capacity_slot_idx not live or not valid; refusing to drop bookings_no_double_book';
    END IF;
  END $$;

  DROP INDEX IF EXISTS bookings_no_double_book;
COMMIT;
