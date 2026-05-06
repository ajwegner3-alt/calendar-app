-- Phase 34: Google OAuth Signup + Credential Capture — account_oauth_credentials table.
-- Applied via: npx supabase db reset (local) or supabase db push (remote).
-- Forward-only migration — no rollback file. Phase 34 plans 02-04 all depend on this
-- table existing and on the encrypted-blob format described below.
--
-- Encrypted-blob format for refresh_token_encrypted:
--   iv:authTag:ciphertext   (all segments are lowercase hex strings)
--   AES-256-GCM, 12-byte IV, 16-byte auth tag.
--   Plan 34-02 produces this format via Node.js `crypto.createCipheriv`.
--
-- Write path: only the service-role / admin client may INSERT or UPDATE rows.
--   No INSERT/UPDATE/DELETE RLS policies are created here on purpose — writes
--   must go through a server-side API route that calls the admin Supabase client,
--   preventing direct credential manipulation from the browser.

-- 1. Create the table.
create table public.account_oauth_credentials (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  provider                text        not null check (provider in ('google')),
  refresh_token_encrypted text        not null,
  granted_scopes          text,
  status                  text        not null default 'connected'
                            check (status in ('connected', 'needs_reconnect')),
  connected_at            timestamptz not null default now(),
  last_refresh_at         timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, provider)
);

-- 2. Index on user_id for fast lookups by authenticated user.
create index account_oauth_credentials_user_id_idx
  on public.account_oauth_credentials (user_id);

-- 3. Enable Row Level Security.
alter table public.account_oauth_credentials enable row level security;

-- 4. SELECT-only RLS policy: authenticated users can read only their own row.
--    INSERT/UPDATE/DELETE are intentionally absent — all writes go through the
--    admin client in server-side API routes (see above comment).
create policy "credentials_select_own"
  on public.account_oauth_credentials
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 5. updated_at trigger function (matches project convention from Phase 10).
create or replace function public.set_account_oauth_credentials_updated_at()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_account_oauth_credentials_updated_at
  before update on public.account_oauth_credentials
  for each row execute function public.set_account_oauth_credentials_updated_at();
