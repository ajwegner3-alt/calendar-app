-- Phase 10: per-day email-send counter table for Gmail SMTP quota guard.
-- Service-role-only access (no RLS policies → authenticated/anon get nothing).

create table if not exists email_send_log (
  id bigserial primary key,
  sent_at timestamptz not null default now(),
  category text not null check (category in (
    'signup-verify',
    'signup-welcome',
    'password-reset',
    'email-change',
    -- bookings/reminders intentionally NOT listed; they bypass the guard.
    'other'
  ))
);

-- Index for daily-count queries.
create index email_send_log_sent_at_idx on email_send_log (sent_at desc);

-- RLS on (deny-all to authenticated/anon — service role bypasses RLS).
alter table email_send_log enable row level security;

-- Optional: a daily-cleanup helper (run manually or via future cron).
-- Rows older than 30 days are not needed for the daily counter.
-- (Not adding cron now — manual cleanup acceptable in v1.1.)
