-- Phase 10: accounts INSERT + UPDATE RLS policies + auto-provisioning trigger.
-- Applied via: npx supabase db query --linked -f supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql
-- (CLI db push disabled — migration drift workaround LOCKED per STATE.md)
-- NOTE: Must be applied AFTER 20260428120001_phase10_onboarding_columns.sql (new columns must exist)

-- 1. UPDATE policy: an authenticated user can update their own accounts row(s).
--    The wizard uses this to fill in slug, name, timezone, onboarding_complete.
--    NOTE: v1.0 already has "owners update own account" policy; this is a named
--    duplicate for explicitness in the Phase 10 policy matrix. Both OR together safely.
--    Guard: only create if it doesn't already exist.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'accounts' and policyname = 'accounts_owner_update'
  ) then
    execute $policy$
      create policy "accounts_owner_update"
        on accounts for update
        to authenticated
        using (auth.uid() = owner_user_id)
        with check (auth.uid() = owner_user_id)
    $policy$;
  end if;
end;
$$;

-- 2. INSERT policy: an authenticated user can insert a row for themselves.
--    With the trigger pattern, normal signup never hits this path (trigger does it
--    via SECURITY DEFINER). But add the policy for completeness so direct INSERT
--    via RLS-scoped client also works (e.g., for tests, future second-tenant flows).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'accounts' and policyname = 'accounts_owner_insert'
  ) then
    execute $policy$
      create policy "accounts_owner_insert"
        on accounts for insert
        to authenticated
        with check (auth.uid() = owner_user_id)
    $policy$;
  end if;
end;
$$;

-- 3. SELECT policy already exists from v1.0 via current_owner_account_ids() RPC.
--    Soft-delete: extend public-facing surfaces by filtering deleted_at IS NOT NULL
--    in app code (load-event-type.ts, load-account-listing.ts) — done in 10-07.

-- 4. Trigger function: auto-create stub accounts row on auth.users INSERT.
--    SECURITY DEFINER so it can bypass RLS at the trigger boundary.
--    set search_path = public to prevent search-path-hijack pitfall (Supabase docs).
--    Inserts stub with onboarding_complete=false, slug=null, name=null — wizard
--    UPDATEs these once the user completes onboarding (Plan 10-06).
create or replace function public.provision_account_for_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.accounts (
    owner_user_id,
    owner_email,
    slug,
    name,
    timezone,
    onboarding_complete,
    onboarding_step
  ) values (
    new.id,
    new.email,
    null,             -- slug filled by wizard step 1
    null,             -- name (display name) filled by wizard step 1
    'UTC',            -- placeholder; wizard step 2 captures real timezone
    false,            -- wizard MUST complete to flip this true
    1                 -- start at wizard step 1
  );
  return new;
end;
$$;

-- Grant execute to postgres role (supabase trigger infrastructure needs this)
grant execute on function public.provision_account_for_new_user() to postgres;

-- 5. Trigger: fire after every auth.users insert.
--    Idempotent: drop-then-create so re-applying the migration is safe.
drop trigger if exists provision_account_on_signup on auth.users;
create trigger provision_account_on_signup
  after insert on auth.users
  for each row execute function public.provision_account_for_new_user();
