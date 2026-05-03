-- Phase 27 rollback: drop EXCLUDE constraint + generated column.
--
-- Apply with: echo | npx supabase db query --linked -f <this file>
--
-- We do NOT drop the btree_gist extension -- it is harmless to leave installed
-- and may be reused by future constraints. If you absolutely need to remove it:
--   DROP EXTENSION IF EXISTS btree_gist;
-- (This will fail if any other index depends on it.)

BEGIN;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_no_account_cross_event_overlap;

ALTER TABLE bookings
  DROP COLUMN IF EXISTS during;

COMMIT;
