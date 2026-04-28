---
phase: 10
plan: 03
type: execute
name: "accounts-rls-and-provisioning-trigger"
wave: 2
depends_on: ["10-01"]
files_modified:
  - "supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql"
  - "supabase/migrations/20260428120001_phase10_onboarding_columns.sql"
autonomous: true
must_haves:
  truths:
    - "An RLS-scoped client (authenticated user) CAN INSERT their first row into accounts where owner_user_id = auth.uid() — but the trigger has already inserted a stub, so wizard UPDATEs not INSERTs"
    - "An RLS-scoped client CAN UPDATE their own accounts row (where owner_user_id = auth.uid())"
    - "Inserting a new row in auth.users automatically creates an accounts stub row with onboarding_complete=false, slug=null, owner_email=NEW.email"
    - "accounts table now has columns: onboarding_complete BOOLEAN, onboarding_step INTEGER, onboarding_checklist_dismissed_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ"
    - "Andrew's existing nsi account is updated to onboarding_complete=true (no wizard for him)"
  artifacts:
    - path: "supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql"
      provides: "INSERT/UPDATE RLS policies on accounts; provision_account_for_new_user() trigger function; on auth.users insert trigger"
      contains: "create policy.*accounts.*for insert"
    - path: "supabase/migrations/20260428120001_phase10_onboarding_columns.sql"
      provides: "onboarding_complete + onboarding_step + onboarding_checklist_dismissed_at + deleted_at columns"
      contains: "alter table accounts add column"
  key_links:
    - from: "auth.users (Supabase managed table)"
      to: "public.accounts"
      via: "AFTER INSERT trigger via SECURITY DEFINER function provision_account_for_new_user()"
      pattern: "create trigger.*after insert on auth\\.users"
    - from: "RLS policy 'accounts_owner_update'"
      to: "auth.uid() = owner_user_id"
      via: "USING + WITH CHECK"
  requirements:
    - "ARCH DECISION #1 — Postgres trigger provisioning pattern (committed)"
    - "ONBOARD-02 (atomic accounts row creation — trigger creates stub; wizard finishes via UPDATE)"
    - "ACCT-02 (deleted_at column for soft-delete)"
    - "ONBOARD-09 (onboarding_checklist_dismissed_at column)"
---

## Objective

Land the schema + RLS migrations that make multi-user signup safe and atomic. This plan commits Architectural Decision #1 (Postgres trigger pattern) by creating a `provision_account_for_new_user()` SECURITY DEFINER function that fires on every `auth.users` INSERT to create a stub `accounts` row. Adds onboarding state columns. Adds INSERT and UPDATE RLS policies on `accounts` so the wizard (10-06) can complete the row via the RLS-scoped client. Updates Andrew's seeded NSI account to `onboarding_complete=true` so he never sees the wizard.

## Context

### Architectural Decision #1 — COMMITTED: Postgres trigger (stub row + wizard UPDATE)

**Why trigger over Server Action:**
- STACK.md and PITFALLS.md both pick the trigger for atomicity (P-A3 prevention — auth.users + accounts must succeed or fail together).
- ARCHITECTURE.md prefers Server Action for UX-error-clarity, but the friction is resolved by splitting the work: the trigger creates a STUB row (`onboarding_complete=false, slug=null, display_name=null, timezone='UTC'`) at signup time; the wizard collects display_name + slug + timezone + first event type AFTER `/auth/confirm` and UPDATEs the stub via a Server Action. UX errors (slug taken, etc.) surface clearly during the wizard UPDATE — the user is already authenticated and on a real page when failures happen.
- This hybrid resolves the tension: atomicity-first at signup (no half-provisioned auth.users), UX-error-clarity at wizard completion (where the user is engaged).
- Net effect: no NEW signup ever produces an auth.users row without an accounts stub. The wizard's job is to UPDATE that stub from `(slug=null, onboarding_complete=false)` to `(slug='acme-hvac', onboarding_complete=true)`.

### Locked patterns (STATE.md)

- **Migration drift workaround LOCKED:** apply via `npx supabase db query --linked -f <migration.sql>` (CLI `db push` fails). Document this in Task verifications.
- **`current_owner_account_ids()`** RPC already returns accounts where `owner_user_id = auth.uid()` — no change needed; works for multi-tenant.
- **Service-role gate** — `lib/supabase/admin.ts` line 1 `import "server-only"`. Trigger uses SECURITY DEFINER (which is service-role-equivalent), so no service-role module needed at the app layer for provisioning.

### v1.0 schema reference

`accounts` table from `20260419120000_initial_schema.sql`:
- `id uuid primary key default gen_random_uuid()`
- `slug text unique not null` ← MUST become nullable for stub row, OR have a sentinel placeholder. Decision: **Make `slug` nullable** but enforce via trigger CHECK that `(slug IS NOT NULL) OR (onboarding_complete = false)` — slug must exist before onboarding completes.
- `display_name text` (already nullable)
- `timezone text not null default 'America/Chicago'` ← keep default; wizard step 2 overrides.
- `owner_user_id uuid references auth.users(id) not null`
- `owner_email text not null`
- `created_at timestamptz default now()`

`20260419120001_rls_policies.sql:30` comment: "No insert/delete policy for accounts in Phase 1 — service role handles seeding." This plan adds the missing policies.

## Tasks

<task id="1" type="auto">
  <description>
    Create `supabase/migrations/20260428120001_phase10_onboarding_columns.sql` (apply this BEFORE the trigger migration so the trigger function can reference the new columns):

    ```sql
    -- Phase 10: onboarding state columns + soft-delete + slug nullability for stub row.

    alter table accounts
      alter column slug drop not null,
      add column onboarding_complete boolean not null default false,
      add column onboarding_step integer not null default 1 check (onboarding_step between 1 and 3),
      add column onboarding_checklist_dismissed_at timestamptz,
      add column deleted_at timestamptz;

    -- Constraint: a row that has finished onboarding MUST have a slug.
    alter table accounts
      add constraint accounts_slug_required_when_onboarding_complete
      check ((slug is not null) or (onboarding_complete = false));

    -- Existing NSI account: mark Andrew's onboarding complete so he never sees the wizard.
    update accounts
      set onboarding_complete = true
      where slug = 'nsi'
        and id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60';

    -- Index to support the public-surface 404 check (ACCT-03).
    create index if not exists accounts_slug_active_idx
      on accounts (slug)
      where deleted_at is null;
    ```

    Apply via the locked workaround: `npx supabase db query --linked -f supabase/migrations/20260428120001_phase10_onboarding_columns.sql`.
  </description>
  <files>supabase/migrations/20260428120001_phase10_onboarding_columns.sql (new)</files>
  <verification>
    Apply: `npx supabase db query --linked -f supabase/migrations/20260428120001_phase10_onboarding_columns.sql` — succeeds.
    Verify columns: `npx supabase db query --linked -c "select column_name, is_nullable from information_schema.columns where table_name='accounts' and column_name in ('slug','onboarding_complete','onboarding_step','onboarding_checklist_dismissed_at','deleted_at');"` — all 5 present, slug is YES nullable, others as expected.
    Verify Andrew: `npx supabase db query --linked -c "select slug, onboarding_complete from accounts where slug='nsi';"` — onboarding_complete=true.
  </verification>
</task>

<task id="2" type="auto">
  <description>
    Create `supabase/migrations/20260428120000_phase10_accounts_rls_and_trigger.sql`:

    ```sql
    -- Phase 10: accounts INSERT + UPDATE RLS policies + auto-provisioning trigger.

    -- 1. UPDATE policy: an authenticated user can update their own accounts row(s).
    --    Wizard uses this to fill in slug, display_name, timezone, onboarding_complete.
    create policy "accounts_owner_update"
      on accounts for update
      to authenticated
      using (auth.uid() = owner_user_id)
      with check (auth.uid() = owner_user_id);

    -- 2. INSERT policy: an authenticated user can insert a row for themselves.
    --    With the trigger pattern, normal signup never hits this path (trigger does it
    --    via SECURITY DEFINER). But add the policy for completeness so direct INSERT
    --    via RLS-scoped client also works (e.g., for tests, future second-tenant flows).
    create policy "accounts_owner_insert"
      on accounts for insert
      to authenticated
      with check (auth.uid() = owner_user_id);

    -- 3. SELECT policy already exists from v1.0 via current_owner_account_ids() RPC.
    --    Soft-delete: extend public-facing surfaces by filtering deleted_at IS NOT NULL
    --    in app code (load-event-type.ts, load-account-listing.ts) — done in 10-07.

    -- 4. Trigger function: auto-create stub accounts row on auth.users INSERT.
    --    SECURITY DEFINER so it can bypass RLS at the trigger boundary.
    --    set search_path = public to prevent search-path-hijack pitfall (Supabase docs).
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
        display_name,
        timezone,
        onboarding_complete,
        onboarding_step
      ) values (
        new.id,
        new.email,
        null,             -- slug filled by wizard step 1
        null,             -- display_name filled by wizard step 1
        'UTC',            -- placeholder; wizard step 2 captures real TZ
        false,            -- wizard MUST complete to flip this
        1                 -- start at step 1
      );
      return new;
    end;
    $$;

    -- 5. Trigger: fire after every auth.users insert.
    --    Idempotent: drop-then-create so re-applying the migration is safe.
    drop trigger if exists provision_account_on_signup on auth.users;
    create trigger provision_account_on_signup
      after insert on auth.users
      for each row execute function public.provision_account_for_new_user();
    ```

    Apply: `npx supabase db query --linked -f supabase/migrations/20260428120000_phase10_accounts_rls_and_trigger.sql`.

    Order MATTERS: this migration filename sorts BEFORE the columns one (`20260428120000` < `20260428120001`), but it depends on the columns existing. Solution: apply column migration FIRST (Task 1 above) then this one. The Supabase migration filename ordering is for forward-replay; live application order is set by the Task sequence in this plan.

    Alternative: rename this file to `20260428120002_*.sql` so filename order matches application order. **Decision: rename to `20260428120002_phase10_accounts_rls_and_trigger.sql`** to keep migration replay sane for any future fresh-db rebuilds.
  </description>
  <files>supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql (new — note: numbered after the columns migration)</files>
  <verification>
    Apply: `npx supabase db query --linked -f supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql` — succeeds.
    Smoke: `npx supabase db query --linked -c "select policyname from pg_policies where tablename='accounts';"` — shows accounts_owner_update + accounts_owner_insert + existing v1.0 select policy.
    Smoke: `npx supabase db query --linked -c "select tgname from pg_trigger where tgname='provision_account_on_signup';"` — returns 1 row.
    Trigger smoke (DESTRUCTIVE — only on dev/preview branch): create a test auth user via supabase admin API, verify accounts row appears with onboarding_complete=false, slug=null. Clean up after.
    Existing tests pass: `npm test` (no regressions).
  </verification>
</task>

## Verification Criteria

- Both migration files exist and apply cleanly via `npx supabase db query --linked -f`.
- `pg_policies` for `accounts` shows: `accounts_owner_update`, `accounts_owner_insert`, plus existing v1.0 SELECT policy.
- `pg_trigger` shows `provision_account_on_signup` ON `auth.users`.
- Andrew's NSI row has `onboarding_complete=true` (`select onboarding_complete from accounts where slug='nsi';` → t).
- New columns visible: `onboarding_complete`, `onboarding_step`, `onboarding_checklist_dismissed_at`, `deleted_at`.
- `slug` column is now nullable (but constraint enforces `slug IS NOT NULL` once `onboarding_complete = true`).
- Existing v1.0 RLS cross-tenant test (`tests/rls-cross-tenant-matrix.test.ts`) still passes (no regression on existing SELECT policy or `current_owner_account_ids()`).

## must_haves

- ARCH DECISION #1 — Postgres trigger provisioning pattern committed in code.
- ONBOARD-02 — atomic accounts row creation (stub at signup; wizard finishes via UPDATE).
- ACCT-02 — `deleted_at` column added (soft-delete UI in 10-07; 404 enforcement in 10-07 + 10-09).
- ONBOARD-09 — `onboarding_checklist_dismissed_at` column added (dashboard checklist in 10-09).
