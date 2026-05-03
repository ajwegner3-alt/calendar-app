-- Phase 27: Account-scoped cross-event-type overlap EXCLUDE constraint.
--
-- Pre-flight diagnostic (file 20260503120000_phase27_preflight_diagnostic.sql)
-- was executed against production on 2026-05-03 and returned ZERO overlap rows
-- (hard gate V14-CP-06 satisfied).
--
-- bookings_total at migration time: 6
-- Chosen path: SINGLE-STEP ADD CONSTRAINT
--   Justification: bookings_total (6) is far below the 10,000-row threshold,
--   so the brief ACCESS EXCLUSIVE lock during immediate validation is
--   acceptable. The two-step NOT VALID + VALIDATE CONSTRAINT form is reserved
--   for tables large enough that a synchronous full-table scan under
--   ACCESS EXCLUSIVE would block production traffic too long.
--
-- Apply with: echo | npx supabase db query --linked -f <this file>
-- Rollback:   see *_ROLLBACK.sql in the same directory.
--
-- DDL operations (in this exact order -- see V14-CP-01..04):
--   1. CREATE EXTENSION IF NOT EXISTS btree_gist;        -- V14-CP-01: required for UUID equality in gist
--   2. ADD COLUMN during tstzrange GENERATED ...;        -- V14-CP-02: half-open '[)' for adjacent-slot safety
--   3. ADD CONSTRAINT ... EXCLUDE USING gist ... WHERE;  -- V14-CP-03 + V14-CP-04: WHERE confirmed; <> on event_type_id

BEGIN;

-- Step 1: Required extension for UUID equality in gist index (V14-CP-01).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Step 2: Generated column expressing the booking interval as a tstzrange.
-- Half-open [) makes 9:00-9:30 and 9:30-10:00 NON-overlapping (V14-CP-02).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS during tstzrange
    GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

-- Step 3: EXCLUDE constraint.
-- (account_id =) AND (event_type_id <>) AND (during &&) WHERE confirmed.
--   - account_id WITH =       : same account
--   - event_type_id WITH <>   : DIFFERENT event types only -- preserves group-booking capacity (V14-CP-04)
--   - during WITH &&          : intervals overlap
--   - WHERE status='confirmed': cancelled rows do NOT block (V14-CP-03)
ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_account_cross_event_overlap
  EXCLUDE USING gist (
    account_id     WITH =,
    event_type_id  WITH <>,
    during         WITH &&
  ) WHERE (status = 'confirmed');

COMMIT;
