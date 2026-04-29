-- Phase 11 Migration A: Add per-event-type capacity columns to event_types.
-- Per RESEARCH.md §Pattern 3 — ADD COLUMN only, no index changes.
-- Defaults preserve v1.0 single-capacity behavior; capacity feature is opt-in via the form.

ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS max_bookings_per_slot integer NOT NULL DEFAULT 1
    CHECK (max_bookings_per_slot >= 1);

ALTER TABLE event_types
  ADD COLUMN IF NOT EXISTS show_remaining_capacity boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN event_types.max_bookings_per_slot IS
  'Maximum confirmed bookings per slot. Default 1 = exclusive (v1.0 semantics). Owner-toggleable via event-type form.';

COMMENT ON COLUMN event_types.show_remaining_capacity IS
  'When true, /api/slots returns remaining_capacity and the booker UI shows X spots left.';
