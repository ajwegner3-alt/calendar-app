-- Pre-flight diagnostic for Phase 27 EXCLUDE constraint.
-- This file is READ-ONLY -- no writes, no DDL.
-- Run with: echo | npx supabase db query --linked -f <this file>
--
-- Expected outcome: zero rows in the second query.
-- If non-zero rows: HALT. Surface rows to Andrew for manual review/resolution.
-- Do NOT auto-cancel bookings programmatically (V14-CP-06).
--
-- Why this exact form:
--   - b1.id < b2.id        : prevents reporting (a,b) and (b,a) twice.
--   - tstzrange(..., '[)') : matches the EXCLUDE constraint's range bound exactly
--                            (V14-CP-02 -- half-open so adjacent slots don't collide).
--   - status = 'confirmed' : mirrors the partial WHERE on the constraint (V14-CP-03)
--                            so the diagnostic catches exactly the rows that would
--                            later abort VALIDATE CONSTRAINT.
--   - event_type_id <>     : matches V14-CP-04 -- only cross-event-type pairs are
--                            problematic; same-event-type capacity stacking is intentional.

-- (A) Informational: total row count for migration-form decision.
--     <10k  -> single-step ADD CONSTRAINT
--     >=10k -> ADD CONSTRAINT NOT VALID + separate VALIDATE CONSTRAINT
SELECT COUNT(*) AS bookings_total FROM bookings;

-- (B) Hard gate: cross-event confirmed-booking overlaps.
SELECT
  b1.id            AS booking_a_id,
  b1.event_type_id AS event_type_a,
  b1.start_at      AS a_start,
  b1.end_at        AS a_end,
  b2.id            AS booking_b_id,
  b2.event_type_id AS event_type_b,
  b2.start_at      AS b_start,
  b2.end_at        AS b_end,
  b1.account_id
FROM bookings b1
JOIN bookings b2
  ON b1.account_id = b2.account_id
 AND b1.event_type_id <> b2.event_type_id
 AND b1.id < b2.id
 AND tstzrange(b1.start_at, b1.end_at, '[)') &&
     tstzrange(b2.start_at, b2.end_at, '[)')
WHERE b1.status = 'confirmed'
  AND b2.status = 'confirmed'
ORDER BY b1.account_id, b1.start_at;
