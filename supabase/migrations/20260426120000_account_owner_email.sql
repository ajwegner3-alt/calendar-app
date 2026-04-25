-- 20260426120000_account_owner_email.sql
-- Phase 5: add nullable owner_email to accounts.
-- Used by:
--   - .ics ORGANIZER field on booker confirmation invites
--   - Owner notification email recipient
--   - Future per-account "from" branding (Phase 7)
-- Nullable on purpose: pre-existing accounts (only nsi today) get backfilled
-- below; future v2 signup will set this at account creation.

alter table accounts
  add column if not exists owner_email text;

comment on column accounts.owner_email is
  'Owner email for outbound transactional emails (.ics ORGANIZER, owner notifications). Nullable; downstream code MUST handle null gracefully (skip owner notification, omit ORGANIZER).';

-- Seed Andrew's nsi account.
update accounts
  set owner_email = 'ajwegner3@gmail.com'
  where slug = 'nsi'
    and owner_email is null;
