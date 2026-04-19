-- 1. Extensions
-- pgcrypto ships with Postgres 14+ and Supabase enables it by default for gen_random_uuid()
-- citext: case-insensitive email
create extension if not exists "pgcrypto";
create extension if not exists "citext";
-- NOTE: pg_cron and pg_net intentionally NOT enabled (Phase 8)

-- 2. Enums
create type booking_status as enum ('confirmed', 'cancelled', 'rescheduled');
create type booking_event_kind as enum ('created', 'cancelled', 'rescheduled', 'reminder_sent');
create type booking_actor as enum ('booker', 'owner', 'system');

-- 3. accounts (the tenant)
create table accounts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  timezone text not null,                              -- IANA, e.g. 'America/Chicago'
  logo_url text,
  brand_primary text,
  brand_accent text,
  created_at timestamptz not null default now()
);
create index accounts_owner_user_id_idx on accounts(owner_user_id);

-- 4. event_types
create table event_types (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  min_notice_minutes int not null default 60 check (min_notice_minutes >= 0),
  max_advance_days int not null default 60 check (max_advance_days > 0),
  custom_questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (account_id, slug)
);
create index event_types_account_id_idx on event_types(account_id);

-- 5. availability_rules
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),  -- 0=Sun
  start_minute smallint not null check (start_minute between 0 and 1439),
  end_minute smallint not null check (end_minute between 1 and 1440),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);
create index availability_rules_account_id_dow_idx
  on availability_rules(account_id, day_of_week);

-- 6. date_overrides
create table date_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  override_date date not null,
  is_closed boolean not null default false,
  start_minute smallint check (start_minute between 0 and 1439),
  end_minute smallint check (end_minute between 1 and 1440),
  note text,
  created_at timestamptz not null default now(),
  check (is_closed or (start_minute is not null and end_minute is not null and end_minute > start_minute)),
  unique (account_id, override_date, start_minute)
);
create index date_overrides_account_date_idx on date_overrides(account_id, override_date);

-- 7. bookings — the core table
create table bookings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  event_type_id uuid not null references event_types(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  booker_name text not null,
  booker_email citext not null,
  booker_phone text,
  booker_timezone text not null,                       -- IANA
  answers jsonb not null default '{}'::jsonb,
  status booking_status not null default 'confirmed',
  cancel_token_hash text not null,
  reschedule_token_hash text not null,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,                                   -- 'booker' | 'owner'
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

-- CRITICAL: partial unique index = anti-double-book at DB level (FOUND-04)
create unique index bookings_no_double_book
  on bookings(event_type_id, start_at)
  where status = 'confirmed';

-- Dashboard perf
create index bookings_account_start_idx on bookings(account_id, start_at);

-- Reminder-cron perf (Phase 8 will use this; fine to create now)
create index bookings_reminder_scan_idx
  on bookings(start_at)
  where status = 'confirmed' and reminder_sent_at is null;

-- Token lookups (Phase 6 will use these)
create index bookings_cancel_token_idx on bookings(cancel_token_hash);
create index bookings_reschedule_token_idx on bookings(reschedule_token_hash);

-- 8. booking_events (audit log)
create table booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,   -- denormalized for RLS
  event_type booking_event_kind not null,
  occurred_at timestamptz not null default now(),
  actor booking_actor not null,
  metadata jsonb not null default '{}'::jsonb
);
create index booking_events_booking_id_idx on booking_events(booking_id);
create index booking_events_account_id_idx on booking_events(account_id);
