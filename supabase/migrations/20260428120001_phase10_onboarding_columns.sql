-- Phase 10: onboarding state columns + soft-delete + slug/name nullability for stub row.
-- Applied via: npx supabase db query --linked -f supabase/migrations/20260428120001_phase10_onboarding_columns.sql
-- (CLI db push disabled — migration drift workaround LOCKED per STATE.md)

-- Drop NOT NULL on slug so the trigger can insert a stub row before the wizard assigns one.
-- Drop NOT NULL on name so the trigger can insert a stub before the wizard sets a display name.
alter table accounts
  alter column slug drop not null,
  alter column name drop not null,
  add column onboarding_complete boolean not null default false,
  add column onboarding_step integer not null default 1 check (onboarding_step between 1 and 3),
  add column onboarding_checklist_dismissed_at timestamptz,
  add column deleted_at timestamptz;

-- Constraint: a row that has finished onboarding MUST have a slug.
-- Enforces that slug is provided before onboarding_complete can be flipped to true.
alter table accounts
  add constraint accounts_slug_required_when_onboarding_complete
  check ((slug is not null) or (onboarding_complete = false));

-- Constraint: a row that has finished onboarding MUST have a name.
-- Enforces that name (display name) is provided before onboarding_complete can be flipped.
alter table accounts
  add constraint accounts_name_required_when_onboarding_complete
  check ((name is not null) or (onboarding_complete = false));

-- Existing NSI account: mark Andrew's onboarding complete so he never sees the wizard.
update accounts
  set onboarding_complete = true
  where slug = 'nsi'
    and id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60';

-- Index to support the public-surface 404 check (ACCT-03):
-- fast lookup for active (non-deleted) accounts by slug.
create index if not exists accounts_slug_active_idx
  on accounts (slug)
  where deleted_at is null;
