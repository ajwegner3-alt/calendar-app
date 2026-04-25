-- Phase 4: Availability Engine — global account settings columns
--
-- Adds the four account-wide availability knobs the slot engine reads:
--   - buffer_minutes      (AVAIL-03) pre/post buffer applied around every booking
--   - min_notice_hours    (AVAIL-04) hours before NOW that a slot becomes bookable
--   - max_advance_days    (AVAIL-05) days into future that slots are shown
--   - daily_cap           (AVAIL-06) max confirmed bookings/day; NULL = no cap
--
-- Defaults match CONTEXT.md decisions: buffer=0, min-notice=24h, max-advance=14d,
-- daily-cap=null. Existing seeded rows (nsi account) backfill to these defaults
-- automatically because of the DEFAULT clause on the NOT NULL columns.
--
-- Idempotent: safe to re-run.

alter table accounts
  add column if not exists buffer_minutes int not null default 0
    check (buffer_minutes >= 0),
  add column if not exists min_notice_hours int not null default 24
    check (min_notice_hours >= 0),
  add column if not exists max_advance_days int not null default 14
    check (max_advance_days > 0),
  add column if not exists daily_cap int
    check (daily_cap is null or daily_cap > 0);

-- Document intent on the columns (helps future maintainers grep for it).
comment on column accounts.buffer_minutes is 'Pre/post buffer minutes applied around every booking (AVAIL-03)';
comment on column accounts.min_notice_hours is 'Hours before now a slot becomes bookable (AVAIL-04)';
comment on column accounts.max_advance_days is 'Days into future slots are shown (AVAIL-05)';
comment on column accounts.daily_cap is 'Max confirmed bookings per local-date; NULL = no cap (AVAIL-06)';
