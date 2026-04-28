-- Phase 10 (10-08): keep accounts.owner_email in sync with auth.users.email
-- after verifyOtp(type=email_change) updates the auth.users row.
--
-- Uses SECURITY DEFINER so the function can UPDATE public.accounts even though
-- it runs in the auth schema context. set search_path = public prevents
-- search-path injection.

create or replace function public.sync_account_email_on_auth_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.accounts
      set owner_email = new.email
      where owner_user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_account_email_on_auth_update on auth.users;
create trigger sync_account_email_on_auth_update
  after update of email on auth.users
  for each row execute function public.sync_account_email_on_auth_update();
