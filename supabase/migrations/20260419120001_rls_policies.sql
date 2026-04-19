-- 1. Enable RLS on every tenant-scoped table
alter table accounts enable row level security;
alter table event_types enable row level security;
alter table availability_rules enable row level security;
alter table date_overrides enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;

-- 2. Helper function: account IDs the current authenticated user owns
create or replace function public.current_owner_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from accounts where owner_user_id = auth.uid();
$$;
revoke all on function public.current_owner_account_ids() from public;
grant execute on function public.current_owner_account_ids() to authenticated;

-- 3. accounts: owner can read + update their own row
create policy "owners read own account"
  on accounts for select to authenticated
  using (owner_user_id = auth.uid());
create policy "owners update own account"
  on accounts for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
-- No insert/delete policy for accounts in Phase 1 — service role handles seeding.

-- 4. event_types: owner full CRUD on their account's rows
create policy "owners manage event_types"
  on event_types for all to authenticated
  using (account_id in (select current_owner_account_ids()))
  with check (account_id in (select current_owner_account_ids()));

-- 5. availability_rules
create policy "owners manage availability_rules"
  on availability_rules for all to authenticated
  using (account_id in (select current_owner_account_ids()))
  with check (account_id in (select current_owner_account_ids()));

-- 6. date_overrides
create policy "owners manage date_overrides"
  on date_overrides for all to authenticated
  using (account_id in (select current_owner_account_ids()))
  with check (account_id in (select current_owner_account_ids()));

-- 7. bookings: owner CRUD. Public booker access happens via service-role routes, NOT RLS.
create policy "owners manage bookings"
  on bookings for all to authenticated
  using (account_id in (select current_owner_account_ids()))
  with check (account_id in (select current_owner_account_ids()));

-- 8. booking_events: owner read; writes via service-role only
create policy "owners read booking_events"
  on booking_events for select to authenticated
  using (account_id in (select current_owner_account_ids()));

-- 9. CRITICAL: anon role has NO policies on these tables, so RLS fully blocks anon.
--    The Vitest RLS lockout test verifies this.

-- 10. Storage bucket for branding logos
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Storage policies: public-read for objects in the branding bucket
create policy "public read branding"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'branding');

-- Only owners can upload/update/delete their own account's logo
-- Path convention: {account_id}/logo.{ext} — enforced by policy
create policy "owners upload branding"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select current_owner_account_ids())
  );
create policy "owners update branding"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select current_owner_account_ids())
  );
create policy "owners delete branding"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'branding'
    and (storage.foldername(name))[1]::uuid in (select current_owner_account_ids())
  );
