-- Phase 32: Inverse Date Overrides — wipe legacy custom-hours rows
--
-- BEFORE this phase: rows with is_closed=false meant "the owner's custom available
-- hours for this date" (replaced weekly rules entirely).
-- AFTER this phase:  rows with is_closed=false mean "unavailable windows" subtracted
-- from weekly rules (MINUS semantics in lib/slots.ts windowsForDate).
--
-- Auto-inverting legacy rows is unsafe — a row "9:00–17:00" currently means
-- "open 9–17" and would flip to "blocked 9–17" (the opposite of intent).
-- Production diagnostic (2026-05-05): 3 rows is_closed=false, 0 rows is_closed=true.
-- Wipe is the safe path; the owner can re-enter unavailability with the new UI.
--
-- This migration only removes legacy DML; no schema columns change.

DELETE FROM date_overrides WHERE is_closed = false;

-- Update column comment so future readers understand the new semantics.
COMMENT ON COLUMN date_overrides.start_minute IS
  'Phase 32: start of an UNAVAILABLE window (minutes from local midnight). Combined with end_minute, this window is subtracted from the weekly-hours base for that day. NULL when is_closed=true (full-day block).';
COMMENT ON COLUMN date_overrides.end_minute IS
  'Phase 32: end of an UNAVAILABLE window (minutes from local midnight). NULL when is_closed=true (full-day block).';
COMMENT ON COLUMN date_overrides.is_closed IS
  'Phase 32: when true, the entire day is blocked (no slots regardless of weekly rules). When false, start_minute/end_minute define an unavailable window subtracted from the weekly schedule.';
