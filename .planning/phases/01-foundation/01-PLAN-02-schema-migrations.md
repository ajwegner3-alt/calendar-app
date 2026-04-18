---
phase: 01-foundation
plan: 02
type: execute
wave: 2
depends_on: ["01-PLAN-01"]
files_modified:
  - supabase/config.toml
  - supabase/migrations/
  - supabase/seed.sql
  - .gitignore
  - package.json
  - package-lock.json
autonomous: false
user_setup:
  - service: supabase-cli
    why: "Versioned migrations + seed management against remote calendar project"
    dashboard_config:
      - task: "Run `npx supabase login` (opens browser) and `npx supabase link --project-ref <ref>` (prompts for DB password). Both are interactive and must be run by Andrew."
        location: "Terminal - project ref is in the Supabase dashboard URL; DB password is at Dashboard -> Settings -> Database -> Database password (reset if lost)"
      - task: "Confirm the remote `calendar` project's `public` schema is empty BEFORE first `supabase db push`. If not empty, drop existing tables or run `supabase db pull` first."
        location: "Supabase Dashboard -> Table Editor (or SQL Editor: `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)"

must_haves:
  truths:
    - "Six tables exist in the remote Supabase `calendar` project: accounts, event_types, availability_rules, date_overrides, bookings, booking_events"
    - "All timestamp columns use `timestamptz` (never `timestamp` or `timestamp without time zone`)"
    - "`accounts.timezone` and `bookings.booker_timezone` are `text` holding IANA strings"
    - "`account_id` column exists on every child table (denormalized for RLS)"
    - "Partial unique index `bookings_no_double_book` exists on `(event_type_id, start_at) WHERE status = 'confirmed'`"
    - "`booking_status` enum has exactly three values: confirmed, cancelled, rescheduled"
    - "`booking_event_kind` enum has exactly four values: created, cancelled, rescheduled, reminder_sent"
    - "RLS is enabled on all six tables"
    - "`current_owner_account_ids()` helper function exists and is SECURITY DEFINER"
    - "Owner-scoped policies exist for each table; anonymous role has NO direct table policies"
    - "Storage bucket `branding` exists, is public-read, and has owner-upload/update/delete policies keyed on path prefix"
    - "Andrew's account row exists in `accounts` with `slug='nsi'`, `name='North Star Integrations'`, `timezone='America/Chicago'`"
    - "Re-running the seed is a no-op (idempotent via ON CONFLICT DO NOTHING)"
  artifacts:
    - path: "supabase/config.toml"
      provides: "Supabase CLI project config produced by `supabase init`"
    - path: "supabase/migrations/"
      provides: "Directory with at least two timestamped .sql files (schema + RLS)"
    - path: "supabase/seed.sql"
      provides: "Idempotent seed for Andrew's nsi account at America/Chicago timezone"
      contains: "America/Chicago"
    - path: "supabase/migrations/*_initial_schema.sql"
      provides: "Extensions, enums, 6 tables, indexes, partial unique index"
      contains: "bookings_no_double_book"
    - path: "supabase/migrations/*_rls_policies.sql"
      provides: "RLS enabled + policies + storage bucket + storage policies"
      contains: "current_owner_account_ids"
  key_links:
    - from: "supabase/migrations/*_initial_schema.sql"
      to: "bookings table"
      via: "partial unique index on (event_type_id, start_at) WHERE status='confirmed'"
      pattern: "unique index bookings_no_double_book"
    - from: "supabase/migrations/*_rls_policies.sql"
      to: "storage.buckets"
      via: "insert 'branding' bucket with public=true"
      pattern: "'branding'"
    - from: "supabase/seed.sql"
      to: "accounts table"
      via: "insert nsi row ON CONFLICT DO NOTHING"
      pattern: "on conflict .* do nothing"
---

<objective>
Initialize the Supabase CLI against the remote `calendar` project, create two versioned migration files (schema + RLS/storage), push them to the remote DB, and seed Andrew's account. After this plan, the database has exactly the shape Phase 2+ will build against: six tables, RLS locked down, storage bucket ready, and one seeded row.

Purpose: Every race-guard, timezone, and RLS guarantee the whole project depends on lives at the DB layer. Getting the schema right ONCE, in a reviewable, reproducible migration file, means downstream phases never have to re-open these decisions.

Output: `supabase/` directory committed to git with `config.toml`, two migration files in `supabase/migrations/`, and a `seed.sql`. The remote `calendar` project has all six tables, all RLS policies, the `branding` storage bucket, and Andrew's `nsi` account row.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/01-foundation/01-RESEARCH.md

# Prior plan in this phase
@.planning/phases/01-foundation/01-PLAN-01-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew runs interactive Supabase CLI login + link</name>
  <what-built>
Supabase CLI installed as a dev dependency. Before migration files can be pushed, Andrew must complete two interactive commands that Claude cannot automate: browser-based login and DB-password-prompted project link. Andrew must also confirm the remote `calendar` project's `public` schema is empty.
  </what-built>
  <how-to-verify>
1. Claude will first run `npm install -D supabase` and `npx supabase init` (see Task 2 Step 1 — non-interactive).
2. Andrew then runs in the project root:
   ```bash
   npx supabase login
   ```
   A browser opens. Log in with your Supabase account. The CLI caches the token.

3. Andrew finds the `calendar` project ref:
   - Go to https://app.supabase.com -> `calendar` project
   - The URL is `https://app.supabase.com/project/<PROJECT_REF>/...` — copy `<PROJECT_REF>` (20-char string).

4. Andrew then runs:
   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   ```
   The CLI prompts for the Database password. Retrieve it from:
   - Supabase Dashboard -> `calendar` -> Project Settings -> Database -> "Database password" (reset if lost)

5. Andrew confirms the remote `public` schema is empty:
   - Supabase Dashboard -> SQL Editor -> run:
     ```sql
     SELECT table_name FROM information_schema.tables WHERE table_schema='public';
     ```
   - Expected result: zero rows (or only Supabase-managed tables like `schema_migrations`).
   - If there ARE existing tables, tell Claude — plan must decide between dropping them or running `supabase db pull` to baseline.

6. Andrew tells Claude: project ref value, confirmation that login + link succeeded, AND confirmation that `public` is empty.
  </how-to-verify>
  <resume-signal>Type: "linked <PROJECT_REF>, public empty" — OR — "linked, public has these tables: ..." so Claude can adjust strategy.</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Install Supabase CLI, initialize, write schema + RLS migrations + seed, push</name>
  <files>supabase/config.toml, supabase/migrations/*_initial_schema.sql, supabase/migrations/*_rls_policies.sql, supabase/seed.sql, package.json, .gitignore</files>
  <action>
After Andrew completes the checkpoint:

1. **Install CLI as dev dep** (if Task 1 didn't already):
   ```bash
   npm install -D supabase
   ```
   This adds `supabase` ~2.92.x to `devDependencies`. Use `npx supabase <cmd>` to invoke it.

2. **Initialize supabase directory**:
   ```bash
   npx supabase init
   ```
   Creates `supabase/config.toml` and an empty `supabase/seed.sql`. Adds `.gitignore` entries for `supabase/.temp/`, etc. (CLI manages this — don't hand-edit).

3. **Create schema migration file**:
   ```bash
   npx supabase migration new initial_schema
   ```
   This creates `supabase/migrations/<timestamp>_initial_schema.sql`. Replace its content with the exact SQL from RESEARCH.md Section 4 "File 1 - initial_schema.sql" — every `create table`, `create index`, `create type` block, verbatim. Key invariants to double-check:
   - `create type booking_status as enum ('confirmed', 'cancelled', 'rescheduled');` — exactly three values, no more.
   - `create type booking_event_kind as enum ('created', 'cancelled', 'rescheduled', 'reminder_sent');` — exactly four values.
   - Every timestamp column is `timestamptz` (never bare `timestamp`).
   - `accounts.timezone text not null` (IANA string, no default — seed sets it).
   - `bookings.booker_timezone text not null` (IANA string).
   - `account_id uuid not null references accounts(id) on delete cascade` on: `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`.
   - THE critical line: `create unique index bookings_no_double_book on bookings(event_type_id, start_at) where status = 'confirmed';` — this is FOUND-04.
   - `event_types.custom_questions jsonb not null default '[]'::jsonb` — shape documented in RESEARCH.md Section 5 (stored as array of `{id, label, type, required, options?, placeholder?}` with types `short_text | long_text | select | email | phone | number`). Phase 1 only needs the column; shape validation lives in Phase 3.
   - `booking_events` columns: `id, booking_id, account_id, event_type, occurred_at, actor, metadata` — exactly per CONTEXT.md.
   - Do NOT enable `pg_cron` or `pg_net` — explicitly deferred.
   - Do NOT add `check (status in ...)` — the enum type already constrains it.

4. **Create RLS + storage migration file**:
   ```bash
   npx supabase migration new rls_policies
   ```
   Replace its content with the exact SQL from RESEARCH.md Section 4 "File 2 - rls_policies.sql" — every `alter table ... enable row level security`, the `current_owner_account_ids()` function, every `create policy`, the storage bucket insert, and all storage policies. Key invariants:
   - RLS enabled on ALL SIX tables.
   - `current_owner_account_ids()` is `language sql stable security definer`, granted EXECUTE to `authenticated`, revoked ALL from `public`.
   - No `create policy ... to anon` anywhere — anon is blocked by having NO policies.
   - Storage bucket insert: `insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;`
   - Storage policies: public SELECT on `branding` bucket; authenticated INSERT/UPDATE/DELETE gated on `(storage.foldername(name))[1]::uuid in (select current_owner_account_ids())`.

5. **Populate `supabase/seed.sql`** verbatim from RESEARCH.md Section 4 "seed.sql":
   ```sql
   insert into accounts (slug, name, owner_user_id, timezone, brand_primary, brand_accent)
   values ('nsi', 'North Star Integrations', null, 'America/Chicago', '#0A2540', '#F97316')
   on conflict (slug) do nothing;
   ```
   `owner_user_id` is NULL — Phase 2 auth wires it. The `on conflict (slug) do nothing` makes the seed idempotent (FOUND-06 + CONTEXT.md decision).

6. **Dry-run the migration push**:
   ```bash
   npx supabase db push --dry-run
   ```
   Read the output carefully. It should enumerate the two new migration files and list all DDL statements. If it reports conflicts with existing tables, STOP — the checkpoint confirmed `public` was empty; investigate before proceeding.

7. **Apply migrations to remote**:
   ```bash
   npx supabase db push
   ```
   Expected: "Applied 2 migrations" (or similar). Zero errors.

8. **Seed Andrew's account**:
   ```bash
   npx supabase db seed
   ```
   If `supabase db seed` is not recognized in the installed CLI version, fall back to:
   ```bash
   # Use the direct psql path (password from Supabase dashboard)
   psql "postgresql://postgres.<REF>:<DB_PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres" -f supabase/seed.sql
   ```
   Exact connection string format is shown at Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI.

9. **Verify via SQL Editor query** (run via `npx supabase db execute` or the dashboard SQL Editor):
   ```sql
   -- All six tables exist
   select table_name from information_schema.tables
   where table_schema = 'public'
   order by table_name;
   -- Expected rows: accounts, availability_rules, booking_events, bookings, date_overrides, event_types

   -- Partial unique index exists
   select indexname, indexdef from pg_indexes
   where tablename = 'bookings' and indexname = 'bookings_no_double_book';
   -- Expected: 1 row, indexdef contains "WHERE (status = 'confirmed'::booking_status)"

   -- RLS enabled on all six
   select relname, relrowsecurity from pg_class
   where relname in ('accounts','event_types','availability_rules','date_overrides','bookings','booking_events')
   order by relname;
   -- Expected: relrowsecurity = true for all six

   -- Storage bucket
   select id, name, public from storage.buckets where id = 'branding';
   -- Expected: 1 row, public = true

   -- Andrew's account seeded
   select slug, name, timezone from accounts where slug = 'nsi';
   -- Expected: 1 row, timezone = 'America/Chicago'
   ```

10. **Re-run seed to confirm idempotency**:
    ```bash
    npx supabase db seed   # or psql -f
    ```
    Expected: zero new rows inserted (ON CONFLICT DO NOTHING triggered). Confirm with another `select count(*) from accounts where slug='nsi';` — still 1.

11. **Commit**:
    ```bash
    git add supabase/ package.json package-lock.json .gitignore
    git status   # confirm no DB credentials accidentally staged
    git commit -m "feat(01): initial schema migrations + RLS + storage bucket + seed"
    git push
    ```
    Vercel auto-deploys; the scaffold page is unchanged, but the deploy should still succeed (no env vars missing).

DO NOT do in this task:
- Install or configure Vitest (Plan 03).
- Write tests (Plan 03).
- Enable pg_cron or pg_net.
- Create any tables beyond the six listed.
- Add any policies for the `anon` role.
- Create `.env.test.local` (Plan 03 if needed).
  </action>
  <verify>
1. `test -f supabase/config.toml` succeeds.
2. `ls supabase/migrations/*_initial_schema.sql` matches exactly one file.
3. `ls supabase/migrations/*_rls_policies.sql` matches exactly one file.
4. `grep -q "bookings_no_double_book" supabase/migrations/*_initial_schema.sql`.
5. `grep -q "create type booking_status as enum ('confirmed', 'cancelled', 'rescheduled')" supabase/migrations/*_initial_schema.sql`.
6. `grep -q "current_owner_account_ids" supabase/migrations/*_rls_policies.sql`.
7. `grep -q "'branding'" supabase/migrations/*_rls_policies.sql`.
8. `grep -q "America/Chicago" supabase/seed.sql` AND `grep -q "on conflict" supabase/seed.sql`.
9. Remote verification queries from Step 9 all return expected results.
10. Second `supabase db seed` run does not create a duplicate account row.
11. `git log --oneline -n 1` shows the migration commit; `git push` succeeded.
12. Vercel auto-deploy triggered by the push shows SUCCESS on the Deployments tab.
  </verify>
  <done>
Remote `calendar` project has all six tables with correct types (timestamptz everywhere, IANA text on timezone columns, `account_id` on every child), partial unique index on bookings, `booking_status` enum with exactly three values, `booking_event_kind` enum with exactly four, RLS enabled on every table, `current_owner_account_ids()` helper, owner-scoped policies (no anon policies), `branding` storage bucket + policies, and Andrew's `nsi` account seeded at `America/Chicago`. Migrations + seed are committed to git and the seed is proven idempotent by a second run. Vercel auto-deploy still succeeds.
  </done>
</task>

</tasks>

<verification>
End-to-end DB verification (run from Supabase SQL Editor OR via `psql`):

```sql
-- Table count check
select count(*) from information_schema.tables
where table_schema = 'public'
and table_name in ('accounts','event_types','availability_rules','date_overrides','bookings','booking_events');
-- Expected: 6

-- All timestamp columns are timestamptz
select table_name, column_name, data_type from information_schema.columns
where table_schema = 'public'
and data_type like '%timestamp%';
-- Expected: every row has data_type = 'timestamp with time zone'

-- account_id on every child table
select table_name from information_schema.columns
where table_schema = 'public' and column_name = 'account_id'
order by table_name;
-- Expected: event_types, availability_rules, date_overrides, bookings, booking_events

-- Partial unique index on bookings
select indexdef from pg_indexes
where tablename='bookings' and indexname='bookings_no_double_book';
-- Expected: definition contains "WHERE (status = 'confirmed'::booking_status)"

-- Enum values
select enum_range(null::booking_status);
-- Expected: {confirmed,cancelled,rescheduled}
select enum_range(null::booking_event_kind);
-- Expected: {created,cancelled,rescheduled,reminder_sent}

-- RLS enabled
select relname from pg_class where relrowsecurity = true
and relname in ('accounts','event_types','availability_rules','date_overrides','bookings','booking_events');
-- Expected: 6 rows

-- Storage bucket
select id, public from storage.buckets where id='branding';
-- Expected: 1 row, public=true

-- Seeded account
select slug, timezone from accounts where slug='nsi';
-- Expected: nsi, America/Chicago
```

Filesystem + git checks:

1. `supabase/migrations/` contains exactly the two files created in Task 2.
2. `supabase/seed.sql` is idempotent (ON CONFLICT DO NOTHING present).
3. No DB passwords or service-role keys committed (grep `git log -p supabase/` for `sb_secret_` or `postgresql://` — should be empty).
</verification>

<success_criteria>
- All six tables exist on the remote `calendar` project with types matching RESEARCH.md Section 4 exactly.
- Partial unique index `bookings_no_double_book` exists with `WHERE status = 'confirmed'`.
- `booking_status` has exactly three values; `booking_event_kind` has exactly four.
- RLS enabled on every table; no policies target the `anon` role.
- `current_owner_account_ids()` function exists and is SECURITY DEFINER.
- Storage bucket `branding` exists with public-read + owner-scoped write policies.
- Andrew's `nsi` account seeded at `America/Chicago`; re-running the seed is a no-op.
- `supabase/` directory committed to git; Vercel auto-deploy still succeeds.
- No pg_cron, no pg_net, no Vitest, no tests (those are deferred or belong to Plan 03).
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-PLAN-02-SUMMARY.md` capturing:
- Filenames of the two migration files (with timestamps)
- Output of the verification SQL block (condensed — one line per check)
- Confirmation the seed is idempotent (re-run produced zero inserts)
- Any CLI quirks encountered (e.g. `supabase db seed` unavailability -> used `psql` fallback)
- "Ready for Plan 03" status confirming schema + seed are live
</output>
