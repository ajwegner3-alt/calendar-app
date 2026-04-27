-- 20260427120001_phase8_schema_additions.sql
--
-- Phase 8 (Reminders + Hardening + Dashboard List) — additive schema columns.
--
-- Three columns required by downstream Wave 2 plans:
--   1. accounts.reminder_include_custom_answers / reminder_include_location /
--      reminder_include_lifecycle_links — per-account toggles controlling which
--      blocks render in the reminder email (Plans 08-04 cron + 08-05 settings UI).
--   2. event_types.location — free-text location/address surfaced in reminder
--      emails when the per-account location toggle is on (Plan 08-04).
--   3. bookings.owner_note — private owner-only note attached to a booking;
--      never sent to the booker. Edited via /app/bookings/[id] autosave UI
--      (Plan 08-07).
--
-- Additive only. All defaults backfill existing rows safely:
--   - The three account booleans are NOT NULL DEFAULT true so existing nsi row
--     adopts the same behavior as Phase 5/6 confirmation emails (which always
--     include answers, location-when-present, and lifecycle links).
--   - event_types.location and bookings.owner_note are nullable text — existing
--     rows simply get NULL (treated as "not set" by all downstream consumers).
--
-- Idempotent: every ALTER uses IF NOT EXISTS so re-applying is a no-op.
-- RLS: untouched. Phase 1 RLS already covers accounts, event_types, bookings;
-- new columns inherit row visibility from the existing policies.
-- Indexes: none. None of these columns are queried as filters in v1
--   (location is rendered in email body, owner_note is read on detail page,
--    toggles are joined to bookings via existing FK).

-- 1) Per-account reminder content toggles
alter table accounts
  add column if not exists reminder_include_custom_answers  boolean not null default true,
  add column if not exists reminder_include_location        boolean not null default true,
  add column if not exists reminder_include_lifecycle_links boolean not null default true;

comment on column accounts.reminder_include_custom_answers is
  'When true, reminder emails echo back the booker''s custom-question answers. Default true (matches Phase 5/6 confirmation behavior).';
comment on column accounts.reminder_include_location is
  'When true, reminder emails include event_types.location text block. Default true.';
comment on column accounts.reminder_include_lifecycle_links is
  'When true, reminder emails include cancel + reschedule links. Default true.';

-- 2) Event type location/address
alter table event_types
  add column if not exists location text;

comment on column event_types.location is
  'Free-text location/address for the event type. Surfaced in reminder email when accounts.reminder_include_location is true. NULL = not set.';

-- 3) Booking owner notes
alter table bookings
  add column if not exists owner_note text;

comment on column bookings.owner_note is
  'Private owner-only note attached to a booking. Never sent to booker. Edited via /app/bookings/[id] autosave UI.';
