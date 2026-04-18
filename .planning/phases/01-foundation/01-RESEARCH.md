# Phase 1: Foundation — Research

**Researched:** 2026-04-18
**Domain:** Next.js 16 App Router + Supabase (multi-tenant RLS) + Vitest
**Overall confidence:** HIGH on stack, API surface, and migration SQL; MEDIUM on a few Supabase CLI remote-push edge cases flagged inline.

---

## Summary

Domain research (SUMMARY.md / STACK.md) was written against Next.js 15 + Tailwind v3 assumptions from January 2026. Three months later, the correct default has shifted:

1. **Next.js 16 is stable and current** (`16.2.4`, released 2026-04-17). It introduces breaking changes that affect this phase: `middleware.ts` → `proxy.ts`, async `cookies()`/`params`/`searchParams`, Turbopack is default for both `dev` and `build`, and `next lint` is removed.
2. **Tailwind v4 is the default** in the current `with-supabase` example and across ecosystem; install uses `@tailwindcss/postcss` and `@import "tailwindcss"` instead of v3's config + directives.
3. **Supabase's new "publishable key" format** (`sb_publishable_...`) is now the recommended anon-key replacement. Env var convention in the canonical `with-supabase` example is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy keys still work — treat as an either-or).
4. **`@supabase/ssr` v0.10.2** exposes `createBrowserClient` / `createServerClient` with the `cookies.getAll()` / `cookies.setAll()` contract. v0.10 added a second `_headers` argument to `setAll` for cache-header injection, but the with-supabase example still uses the 1-arg form and it works. The auth-session-refresh lives in `proxy.ts` (formerly middleware.ts) and must call `supabase.auth.getClaims()` to refresh tokens — not `getUser()`.
5. **pg_cron is on Supabase Free tier** in April 2026 — no tier gate. The reason to defer it to Phase 8 is scope, not availability. Vercel Cron Hobby = **1 run/day** (confirmed), so pg_cron remains the right Phase 8 choice for sub-hourly reminders.
6. The canonical working example to copy structure from is **`vercel/next.js` → `examples/with-supabase`** on the `canary` branch. All code patterns in this doc are extracted from there or from current official Next.js / Supabase docs.

**Primary recommendation for the planner:** follow the `with-supabase` example's file layout exactly (`lib/supabase/{client,server,proxy}.ts` + root `proxy.ts`), with Phase-1-specific additions for the service-role module, migrations, seed, and Vitest.

---

## 1. Package Versions + Install Commands (verified April 18, 2026)

All versions pulled from `npm view <package> version` on 2026-04-18.

### Core runtime

| Package | Version | Source / Notes |
|---|---|---|
| `next` | **16.2.4** | released 2026-04-17 |
| `react` | **19.2.5** | |
| `react-dom` | **19.2.5** | peers match react |
| `typescript` | **6.0.3** (dev) | Next 16 minimum is 5.1; 6.0 is current |
| `@types/react` | **^19** | |
| `@types/react-dom` | **^19** | |
| `@types/node` | **^20** | Next 16 minimum Node.js is 20.9 LTS |

### Supabase

| Package | Version | Source / Notes |
|---|---|---|
| `@supabase/ssr` | **0.10.2** | released 2026-04-09; `latest` dist-tag; peer `@supabase/supabase-js ^2.102.1` |
| `@supabase/supabase-js` | **2.103.3** | released 2026-04-17 |
| `supabase` (CLI, as devDep or global) | **2.92.1** | CLI is invoked via `npx supabase <cmd>`; can be devDep |

### Styling

| Package | Version | Source / Notes |
|---|---|---|
| `tailwindcss` | **4.2.2** | v4 is the default in 2026. v4.1.18 has a known Turbopack build bug with Next 16 — **pin to `4.2.x` or `4.0.7`** |
| `@tailwindcss/postcss` | **4.2.2** | v4 PostCSS plugin (replaces v3 `tailwindcss` in postcss config) |
| `postcss` | **8.5.10** | |
| `autoprefixer` | not needed in v4 | v4 bundles it via Lightning CSS |

### Testing

| Package | Version | Source / Notes |
|---|---|---|
| `vitest` | **4.1.4** | |
| `@vitest/ui` | **4.1.4** | optional |
| `@vitejs/plugin-react` | **6.0.1** | Next's official vitest example uses this |
| `jsdom` | **29.0.2** | test env for component tests |
| `@testing-library/react` | **16.3.2** | |
| `@testing-library/jest-dom` | **6.9.1** | optional; for matchers like `toBeInTheDocument` |
| `@testing-library/dom` | install latest | required peer of `@testing-library/react` |
| `vite-tsconfig-paths` | **6.1.1** | for `@/*` alias resolution in tests |

### Utility

| Package | Version | Source / Notes |
|---|---|---|
| `server-only` | **0.0.1** | Next's canonical package for bundler-level client/server separation |

### Install commands (exact, copy-paste ready)

```bash
# 1. Scaffold (use the canonical Supabase example as the starting template)
npx create-next-app@latest calendar-app \
  --typescript --tailwind --app --eslint --src-dir=false \
  --import-alias "@/*"

# OR, alternatively (and probably better), use the with-supabase example directly:
npx create-next-app@latest calendar-app -e with-supabase

cd calendar-app

# 2. Supabase runtime
npm install @supabase/supabase-js @supabase/ssr

# 3. server-only guard
npm install server-only

# 4. Supabase CLI (as dev dep — avoids global install mismatch)
npm install -D supabase

# 5. Test harness (Vitest + RTL per Next.js 16 official guide)
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/dom @testing-library/jest-dom \
  vite-tsconfig-paths
```

**Do NOT install in Phase 1:** `date-fns`, `@date-fns/tz`, `ics`, `react-email`, `react-hook-form`, `zod`, shadcn components, `sonner`, `nanoid`, `@vercel/analytics`. Those belong to their respective downstream phases; Phase 1 is intentionally minimal.

**Confidence:** HIGH — all versions verified live via `npm view`.

---

## 2. `@supabase/ssr` Current API + Usage Patterns (Next.js 16)

All code below is **copied verbatim from the canonical `vercel/next.js/examples/with-supabase` on the canary branch (current as of 2026-04-18)** and lightly annotated. The planner should treat these as the base; they work with Next 16 + `@supabase/ssr` 0.10.2 + React 19.2.

### `lib/supabase/client.ts` (Browser / Client Component)

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

Usage:
```ts
"use client";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

### `lib/supabase/server.ts` (Server Components, Route Handlers, Server Actions)

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
```

**Next.js 16 note:** `cookies()` is now **async** — the `await cookies()` at the top is required; synchronous access is fully removed in Next 16 (was soft-deprecated in Next 15). The `createClient` export is itself async as a result.

Usage:
```ts
// Server Component
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data } = await supabase.from("accounts").select("*");
```

### `lib/supabase/proxy.ts` (Session refresh logic — "the middleware body")

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug users being randomly logged out.
  // IMPORTANT: use getClaims() (NOT getUser()) — this is the auth-refresh call.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Phase 1 has no auth-gated routes yet; keep the user check commented out
  // or scoped so anon public routes stay public. Phase 3 (auth) wires this up.
  // if (!user && request.nextUrl.pathname.startsWith("/app")) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/login";
  //   return NextResponse.redirect(url);
  // }

  return supabaseResponse;
}
```

### `proxy.ts` (root of project — replaces `middleware.ts` in Next 16)

```ts
import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // All paths except static assets + common image formats
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Critical Next.js 16 changes already applied in the example:**
- File is `proxy.ts` (NOT `middleware.ts`). Next 16 still accepts `middleware.ts` with a deprecation warning, but the codemod and with-supabase example have migrated — we should start on `proxy.ts`.
- Exported function name is `proxy` (NOT `middleware`).
- `proxy` runs on the Node.js runtime ONLY. `edge` runtime is not supported in `proxy.ts`. If edge is needed later, must use the legacy `middleware.ts` name — not a concern for this phase.
- `supabaseResponse` object must be returned as-is (copy cookies if constructing a new response).

**Confidence:** HIGH — code verbatim from canonical example, env var name verified from the example's `.env.example`.

---

## 3. Supabase CLI Workflow for This Project

**Goal:** versioned migrations in `supabase/migrations/`, local dev connects to remote `calendar` project, idempotent `supabase/seed.sql`.

### One-time setup (Phase 1 task list)

```bash
# From project root, after scaffold + npm install -D supabase:

# 1. Initialize supabase/ directory structure
npx supabase init
# Creates: supabase/config.toml, supabase/seed.sql (empty), .gitignore entries

# 2. Link to the remote `calendar` project
#    Andrew needs to grab the project ref from the Supabase dashboard URL
#    (app.supabase.com/project/<ref>/...)
npx supabase login                        # one-time, opens browser for auth
npx supabase link --project-ref <ref>    # prompts for DB password

# 3. Create the first migration file
npx supabase migration new initial_schema
# Creates: supabase/migrations/<timestamp>_initial_schema.sql
# Edit that file to add the DDL (see Section 4)

# 4. Push migrations to the remote database
npx supabase db push --dry-run            # preview
npx supabase db push                      # apply

# 5. Seed data (after migrations apply)
npx supabase db seed                      # runs supabase/seed.sql
# Note: this command is available in CLI 2.x; alternatively pipe directly:
# psql "$DATABASE_URL" -f supabase/seed.sql
```

### Migration workflow going forward

- Every schema change = new file in `supabase/migrations/` via `npx supabase migration new <name>`.
- File naming: `<UTC timestamp>_<snake_case_name>.sql` (CLI auto-generates).
- Commit migration files to git.
- `supabase db push` on the remote applies only new (unapplied) migrations, tracked in `supabase_migrations.schema_migrations` system table.

### Running migrations against a remote project — risk notes

- **If the remote `calendar` project was created through the dashboard and is non-empty**, `supabase db push` will apply fresh migration files on top. If the dashboard-created schema conflicts with the migration SQL, the push fails — this is the expected behavior.
- **Recommendation for Phase 1:** verify the `calendar` project is empty (no tables in `public` schema) before the first `supabase db push`. If it's not, either drop the tables manually or use `supabase db pull` first to sync remote schema into a baseline migration.
- **`supabase/seed.sql` is run only by `supabase db reset` / `supabase db seed`** — it is NOT auto-run on push. Phase 1 plan must explicitly run `npx supabase db seed` (or `psql -f`) after the first successful push.
- Storage bucket policies (on `storage.objects`) CAN be defined in migration SQL; the CLI's `db diff` has historically not picked these up cleanly, but hand-written migration files work fine.

**Confidence:** HIGH on CLI commands; MEDIUM on the pre-existing-schema edge case (flagged for the planner to include a "confirm empty project" step before first push).

---

## 4. Migration SQL Outline

Recommended as **two migration files** for reviewability. Both applied via `supabase db push` in order:

1. `<ts>_initial_schema.sql` — extensions, enums, tables, indexes, constraints
2. `<ts>_rls_policies.sql` — RLS helper function, per-table policies, storage bucket + policies

### File 1 — `<ts>_initial_schema.sql`

```sql
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
```

### File 2 — `<ts>_rls_policies.sql`

```sql
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
```

### `supabase/seed.sql`

```sql
-- Idempotent seed for Andrew's account.
-- The auth.users row must exist first — create manually via Supabase dashboard
-- (Authentication → Users → Add user) and paste the resulting UUID here,
-- OR leave owner_user_id null for now (Phase 3 auth will link it).

-- Approach A: seed with null owner_user_id, link later in Phase 3.
insert into accounts (slug, name, owner_user_id, timezone, brand_primary, brand_accent)
values ('nsi', 'North Star Integrations', null, 'America/Chicago', '#0A2540', '#F97316')
on conflict (slug) do nothing;
```

### Notes on migration SQL

- **Service-role bypasses RLS automatically** — no SQL pattern needed; discipline lives in application code (Section 7).
- `auth.uid()` works inside policies — this is the standard Supabase pattern; no change in April 2026.
- `current_owner_account_ids()` is defined `security definer` so it can read `accounts` regardless of the caller's RLS context.
- The partial unique index is the sole race guard for FOUND-04; the Vitest race test (Section 6) proves it works.

**Confidence:** HIGH on table schema, indexes, enums, RLS patterns; HIGH on storage bucket SQL (verified `storage.buckets` + `storage.objects` policy pattern against official docs).

---

## 5. `custom_questions` jsonb Shape Recommendation

**Recommended shape** — an array of question objects:

```ts
type CustomQuestion = {
  id: string;          // stable slug, e.g. "job_address"; used as answers key
  label: string;       // display text, e.g. "Job site address"
  type:
    | "short_text"     // single-line <input type="text">
    | "long_text"      // <textarea>
    | "select"         // requires `options`
    | "email"          // validates email
    | "phone"          // validates phone (libphonenumber later)
    | "number";        // numeric input
  required: boolean;
  options?: string[];  // only for type: "select"
  placeholder?: string;
};

// Stored as: event_types.custom_questions = CustomQuestion[]  (jsonb)
```

**Example value:**
```json
[
  { "id": "address", "label": "Job site address", "type": "short_text", "required": true },
  { "id": "issue",   "label": "Describe the issue", "type": "long_text", "required": true },
  { "id": "urgency", "label": "How urgent?", "type": "select", "required": true,
    "options": ["Emergency","Within a week","Flexible"] }
]
```

**Answers storage on bookings.answers (jsonb):**
```json
{ "address": "123 Main St", "issue": "Leaking faucet", "urgency": "Emergency" }
```

**Why this shape:**
- Array preserves order (questions render in declared order).
- `id` decoupled from `label` lets owners rename without orphaning historical answers.
- `type` union is constrained — Phase 3 form renderer can switch on it without guesswork.
- `options` is optional, only present for `select` — shape keeps invariants obvious.
- Phone/email/number get first-class types up front, making Phase 5 validation trivial.

A Zod schema in Phase 3 (`lib/schemas/custom-questions.ts`) validates this shape; Phase 1 only needs the jsonb column and this documented contract.

**Confidence:** HIGH — this matches shapes used by Cal.com and similar OSS booking tools.

---

## 6. Vitest + Supabase Test Setup

**Approach:** Vitest runs Node-environment tests that speak directly to the remote Supabase `calendar` project via `@supabase/supabase-js`. No Supabase-specific test-helper library needed — the standard client works fine.

### `vitest.config.ts` (project root)

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Default env jsdom for component tests; override per-file for DB tests.
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Sequential by default is fine; DB tests can opt into threading but
    // race test intentionally runs concurrent INSERTs INSIDE a single test.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 15_000,  // DB round-trips to remote Supabase can be slow
  },
});
```

### `tests/setup.ts`

```ts
// Loaded once per test file. Wire env vars for tests.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env.test.local", override: true });  // optional overrides
```

### `tests/helpers/supabase.ts`

```ts
import { createClient } from "@supabase/supabase-js";

export function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** The stable test account id; pre-created via seed.sql or in a setup step. */
export const TEST_ACCOUNT_SLUG = "nsi-test";

export async function getOrCreateTestAccount() {
  const admin = adminClient();
  const { data: existing } = await admin
    .from("accounts").select("id").eq("slug", TEST_ACCOUNT_SLUG).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.from("accounts").insert({
    slug: TEST_ACCOUNT_SLUG, name: "NSI Test", timezone: "America/Chicago",
  }).select("id").single();
  if (error) throw error;
  return data!.id as string;
}

export async function getOrCreateTestEventType(accountId: string) {
  const admin = adminClient();
  const { data: existing } = await admin
    .from("event_types")
    .select("id")
    .eq("account_id", accountId).eq("slug", "test-race").maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await admin.from("event_types").insert({
    account_id: accountId, slug: "test-race", name: "Test Race", duration_minutes: 30,
  }).select("id").single();
  if (error) throw error;
  return data!.id as string;
}
```

### `tests/race-guard.test.ts` — Phase 1 deliverable #1

```ts
// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import {
  adminClient, getOrCreateTestAccount, getOrCreateTestEventType,
} from "./helpers/supabase";

describe("bookings race guard (FOUND-04)", () => {
  let accountId: string;
  let eventTypeId: string;

  beforeAll(async () => {
    accountId = await getOrCreateTestAccount();
    eventTypeId = await getOrCreateTestEventType(accountId);
  });

  it("only one of N parallel inserts for the same (event_type_id, start_at) succeeds", async () => {
    const admin = adminClient();
    const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    const endAt = new Date(Date.parse(startAt) + 30 * 60_000).toISOString();

    // Clean slate for this slot
    await admin.from("bookings")
      .delete().eq("event_type_id", eventTypeId).eq("start_at", startAt);

    const N = 10;
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) =>
        admin.from("bookings").insert({
          account_id: accountId,
          event_type_id: eventTypeId,
          start_at: startAt,
          end_at: endAt,
          booker_name: `Booker ${i}`,
          booker_email: `race-${i}@test.local`,
          booker_timezone: "America/Chicago",
          status: "confirmed",
          cancel_token_hash: `test-cancel-${i}`,
          reschedule_token_hash: `test-resched-${i}`,
        }).select("id").single(),
      ),
    );

    // Note: supabase-js resolves the Promise even on DB error; check the inner error.
    const succeeded = results.filter(
      (r) => r.status === "fulfilled" && !r.value.error,
    );
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error),
    );

    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(N - 1);
    // Cleanup
    await admin.from("bookings")
      .delete().eq("event_type_id", eventTypeId).eq("start_at", startAt);
  });
});
```

### `tests/rls-anon-lockout.test.ts` — Phase 1 deliverable #2

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { anonClient } from "./helpers/supabase";

const TABLES = [
  "accounts", "event_types", "availability_rules",
  "date_overrides", "bookings", "booking_events",
] as const;

describe("RLS anon lockout (FOUND-05)", () => {
  for (const table of TABLES) {
    it(`anon cannot SELECT from ${table}`, async () => {
      const { data, error } = await anonClient().from(table).select("*").limit(1);
      // Either policy blocks (returns []) or error is a permissions error.
      // Our policies return [] because no policy matches; this is the expected behavior.
      if (!error) {
        expect(data).toEqual([]);
      } else {
        // Acceptable alternative outcome
        expect(error).toBeTruthy();
      }
    });

    it(`anon cannot INSERT into ${table}`, async () => {
      const { error } = await anonClient().from(table).insert({} as never);
      expect(error).toBeTruthy();
    });
  }
});
```

### Add scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### Test execution notes

- Phase 1 test account (`nsi-test` slug) is separate from Andrew's real account (`nsi`). Tests are idempotent — repeated runs don't pollute.
- Race test uses `admin` client (service role) because anon cannot insert bookings per RLS. The partial unique index works regardless of who's inserting.
- Both tests run against the **same remote Supabase `calendar` project** (per CONTEXT.md decision). Cleanup is explicit; no shared mutable state.
- Run via `npm run test` after migrations are pushed and seed has run.

**Confidence:** HIGH for configuration (verified against Next.js 16 official vitest example + Vitest 4 docs); MEDIUM for exact error shape in RLS test — supabase-js may return data:[] OR error depending on how policies resolve; the test accepts both.

---

## 7. Service-Role Client Module Pattern

### `lib/supabase/admin.ts`

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * RULES:
 *   - Import this ONLY from server code (Route Handlers, Server Actions, Server Components,
 *     API routes, cron endpoints, Vitest files marked // @vitest-environment node).
 *   - NEVER import from a "use client" file, Client Component, or any module that's
 *     part of the client bundle. The `import "server-only"` above throws at bundle
 *     time if this is attempted.
 *   - Bypasses RLS. Every query here is as if Postgres-superuser — scope by account_id
 *     manually in every query. No exceptions.
 *   - Do NOT cache / memoize into a module-level singleton. Supabase's Fluid compute
 *     guidance is to create a new client per invocation. Same rule as server.ts.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL — " +
      "admin client unavailable. Check .env.local / Vercel env.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

### Why `import "server-only"`

- Next.js + Turbopack has first-class support for the `server-only` package. When any code that imports `admin.ts` gets pulled into a client bundle, the build fails with a clear error.
- This is stronger than naming convention — it's enforced by the bundler.
- Keep it as the FIRST line of the file so the error fires before anything else.

### Usage rules (write into CLAUDE.md for the project)

1. Only these paths may import `@/lib/supabase/admin`:
   - `app/api/**/route.ts` (Route Handlers)
   - `app/**/actions.ts` (Server Actions)
   - Server Components that explicitly need to bypass RLS
   - `app/api/cron/**/route.ts` (cron jobs, Phase 8)
   - `tests/**/*.test.ts` (with `// @vitest-environment node`)
2. For normal authenticated user requests in Server Components, use `lib/supabase/server.ts` (RLS-scoped).
3. For Client Components, use `lib/supabase/client.ts` (anon, RLS-scoped by user session).

**Confidence:** HIGH.

---

## 8. Environment Variable Checklist

### `.env.local` (local dev only — gitignored)

| Name | Example / Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Public base URL. Copy from Supabase dashboard → Project Settings → API → "Project URL" |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` or legacy `eyJhbGci...` (anon JWT) | Public client key. Copy from dashboard → API → "Project API keys". Use the new `sb_publishable_*` format if shown; fall back to the legacy anon JWT if project predates the migration. Both work. |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` or legacy `eyJhbGci...` | SERVER-ONLY. NEVER prefix with `NEXT_PUBLIC_`. From dashboard → API → "service_role" (or new "Secret keys"). |
| `SUPABASE_DB_PASSWORD` | (optional) — DB password from dashboard | Only if scripts use direct `psql` connection; `supabase db push` prompts on first use and caches via `supabase link`. |

**Example `.env.local` template to commit as `.env.example`:**

```bash
# Supabase (calendar project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Vercel environment variables (Production + Preview)

Set via Vercel dashboard → Project → Settings → Environment Variables:

| Name | Scope | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Same as local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development | Same as local |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview (NOT Development — dev uses `.env.local`) | Server-only |

**Do NOT set in Phase 1:**
- `CRON_SECRET` — Phase 8 (reminder cron)
- `RESEND_API_KEY` — Phase 5 / Phase 8 (emails)
- `NEXT_PUBLIC_SITE_URL` — can add in Phase 2 for auth callback URLs

### Key security rules (flag in the planner's prompt)

- **NEVER** prefix secret keys with `NEXT_PUBLIC_`. That suffix ships the variable to the browser.
- **NEVER** commit `.env.local`. Verify `.gitignore` includes it (Next.js default scaffold does).
- **NEVER** `console.log` or otherwise echo secret keys in build output.
- If a secret is accidentally committed, **rotate immediately in Supabase dashboard** (invalidates old key).

**Confidence:** HIGH.

---

## 9. Vercel Deployment Specifics

### First-time deploy

1. Push `calendar-app` repo to GitHub.
2. In Vercel dashboard → "Add New Project" → Import from GitHub → select `calendar-app`.
3. Framework preset auto-detects **Next.js**. Do NOT change. Build command, output dir, install command — all leave at defaults.
4. Root directory: leave as `/` (unless monorepo).
5. Environment variables: paste all three from Section 8 **before** clicking Deploy (production + preview both).
6. Deploy.

### Do I need `vercel.json`?

**Not for Phase 1.** Defaults work:
- Framework detection handles routing.
- No custom headers/redirects needed yet.
- No cron jobs until Phase 8.

Phase 8 or Phase 11 will add `vercel.json` for CSP `frame-ancestors` (embed widget) and cron schedules.

### Node.js version

Vercel auto-detects Node 20.9+ requirement from Next 16. If you want to pin explicitly:

```json
// package.json
{
  "engines": {
    "node": "20.x"
  }
}
```

### Preview vs Production deploys

- Every push to `main` → production deploy (because main-only branching).
- Every PR (if any are opened later) → preview deploy with its own URL.
- Both use the same Supabase `calendar` project (per CONTEXT.md "no separate test project"). This is fine for Phase 1 — preview and production writes are additive and don't clash.

### Two-deploy Phase 1 strategy (per CONTEXT.md)

1. **First deploy:** Scaffolded Next.js app with NO Supabase wiring at all. Prove the Vercel ↔ GitHub pipeline works, get the live URL. Page can be the default Next template OR a minimal "calendar-app coming soon" landing page. **Recommendation:** a minimal `app/page.tsx` with `<h1>calendar-app</h1>` — signals it's live without looking like an unfinished default template.
2. **Second deploy:** After `@supabase/ssr` setup + migrations are in, deploy again. Page can remain the same `<h1>`; the proof is that env vars resolve and `proxy.ts` runs without errors.

### `.env.production` is NOT needed

Vercel injects env vars from the dashboard at build + runtime. Committing `.env.production` would be redundant AND is dangerous if it ever contains real secrets. Keep only `.env.example` and `.env.local` (gitignored).

**Confidence:** HIGH.

---

## 10. Known Gotchas / Recent Breaking Changes (April 2026)

### Next.js 15 → 16 (directly affects Phase 1)

1. **`middleware.ts` → `proxy.ts`.** Renamed file AND renamed exported function. Still accepts old name with a deprecation warning, but start clean. Codemod: `npx @next/codemod@canary upgrade latest` or do by hand (it's a 2-line change).
2. **Async request APIs are fully required.** `cookies()`, `headers()`, `draftMode()`, page `params`, page `searchParams` — all Promises. Our Supabase server.ts already handles this with `await cookies()`.
3. **`proxy.ts` runs on Node.js runtime only.** No `edge` runtime option in Next 16's proxy file. Not an issue for Phase 1; note for downstream phases.
4. **Turbopack is default for `next dev` AND `next build`.** Remove `--turbopack` flag from `package.json` scripts. If a webpack-requiring plugin gets added later, use `next build --webpack`.
5. **`next lint` removed.** Use ESLint CLI directly. Default scaffold's `"lint": "eslint ."` is correct.
6. **Node 20.9+ required.** Node 18 is EOL and rejected.
7. **PPR config renamed.** `experimental.ppr` / `experimental_ppr` → `cacheComponents: true` at top level. Not relevant Phase 1; note for future.

### `@supabase/ssr`-specific gotchas

1. **`getClaims()` not `getUser()` in `proxy.ts`.** The `with-supabase` example uses `supabase.auth.getClaims()` — it returns signed claims without a DB roundtrip and is now the recommended refresh call. `getUser()` still works but goes to the DB every time.
2. **Don't put `createClient()` in a module-level variable.** Under Vercel Fluid compute, sharing a client across invocations causes cookie-state leakage between requests. Always instantiate inside the function. Both `server.ts` and `admin.ts` above follow this.
3. **`setAll` in server.ts MUST be wrapped in try/catch.** Calling `cookieStore.set()` from a Server Component throws (cookies are read-only there); the catch is intentional — session refresh still happens in proxy.ts.
4. **Keep auth-refresh code contiguous.** The comment `"Do not run code between createServerClient and supabase.auth.getClaims()"` is load-bearing. Logging, branching, or awaiting other Promises in between can cause spurious logouts.
5. **pnpm + `@supabase/ssr` module resolution.** Known open issue (GitHub issue #139). Use npm for Phase 1 (NSI standard) to avoid.

### Tailwind v4 gotchas

1. **v4.1.18 has a Turbopack+Next 16 build bug** (GitHub discussion #88443). **Pin `tailwindcss` to `^4.2.0`** or use `4.0.7`. Current stable (`4.2.2`) is safe.
2. **No `tailwind.config.js` needed.** v4 uses CSS-first config via `@theme`. The with-supabase example still ships a `tailwind.config.ts` — it works but is optional. Simpler to omit and configure in `globals.css`.
3. **PostCSS config uses `@tailwindcss/postcss`, not `tailwindcss`.** Different plugin name.
4. **`@import "tailwindcss"` replaces three `@tailwind` directives.** Single line in `globals.css`.

### Supabase CLI gotchas

1. **`supabase link` asks for DB password on first run** and caches it. Andrew needs it from the dashboard → Project Settings → Database → "Database password" (reset if lost).
2. **`supabase db push` against a non-empty remote fails loudly.** Verify the `calendar` project has no tables in `public` before first push (or drop them).
3. **Storage policies via migrations work but `supabase db diff` doesn't always detect them.** Hand-write the SQL (as in Section 4); never rely on diff-pull for storage.
4. **`supabase/seed.sql` is not run automatically.** Run `npx supabase db seed` explicitly after the first push.

**Confidence:** HIGH on Next 16 changes (official docs verified), MEDIUM on Tailwind v4.1.18 Turbopack bug (ecosystem reports; verify fresh at install time).

---

## 11. pg_cron Free-Tier Status (for Phase 8 planning)

**pg_cron IS available on Supabase Free tier as of April 2026.**

- Confirmed via Supabase Docs ("Cron") and Supabase discussions. Not gated by tier.
- Only limitation is shared-resource consumption (CPU/memory/disk across your whole project).
- Related extension `pg_net` (required for HTTP calls from pg_cron) also available on Free tier.

**Phase 8 confirmation:** The decision to use pg_cron as primary reminder scheduler (with Vercel Cron as nightly fallback) remains valid. Vercel Hobby cron is strictly **1 run/day**, which is insufficient for the 24h-reminder window (needs ≥ hourly scan), so pg_cron is required if staying on Hobby.

**Additional Phase 8 note:** Free Supabase projects auto-pause after 7 days of inactivity, which would silence pg_cron. Keep-alive is a Phase 8 concern (simple daily web-hit against the Supabase project keeps it warm).

**Confidence:** HIGH on availability, MEDIUM on the resource-consumption phrasing (taken from Supabase docs; actual free-tier quota in CPU-seconds/week not spelled out publicly).

---

## 12. Sources + Confidence

### Primary (HIGH confidence)

- **Next.js 16 upgrade guide** — https://nextjs.org/docs/app/guides/upgrading/version-16 — verified 2026-04-15 lastUpdated, all breaking changes catalogued in Section 10.
- **Next.js Vitest testing guide** — https://nextjs.org/docs/app/guides/testing/vitest — vitest.config.mts structure for Section 6.
- **`vercel/next.js/examples/with-supabase`** (canary branch) — raw file contents fetched 2026-04-18 for Section 2 code blocks. Specific files: `lib/supabase/{client,server,proxy}.ts`, root `proxy.ts`, `.env.example`, `package.json`.
- **`npm view` live** (2026-04-18) — all version numbers in Section 1.
- **Supabase SSR docs** — https://supabase.com/docs/guides/auth/server-side and https://supabase.com/docs/guides/auth/server-side/nextjs — v0.10 `setAll` signature + `getClaims()` usage.
- **Supabase migrations reference** — https://supabase.com/docs/reference/cli/supabase-db-push + https://supabase.com/docs/guides/deployment/database-migrations — Section 3 workflow.

### Secondary (MEDIUM confidence — WebSearch verified against official sources)

- **Supabase new API keys (`sb_publishable_*` / `sb_secret_*`)** — https://supabase.com/docs/guides/api/api-keys + supabase discussion #29260. Legacy anon/service-role still work; new keys are the recommended format.
- **Vercel Hobby cron limits (1/day, 2 crons max)** — https://vercel.com/docs/cron-jobs/usage-and-pricing + https://vercel.com/docs/plans/hobby.
- **pg_cron Free-tier availability** — Supabase discussion #37405 + https://supabase.com/docs/guides/cron.
- **Tailwind v4.1.18 + Next 16 Turbopack bug** — Next.js discussion #88443, ecosystem reports. Recommendation: pin `^4.2.0`.
- **`middleware` → `proxy` rename** — https://nextjs.org/docs/app/api-reference/file-conventions/proxy + https://nextjs.org/docs/messages/middleware-to-proxy.

### Tertiary (LOW confidence — flagged for validation at implementation time)

- **`supabase db push` against pre-existing dashboard-created schema**: behavior documented at conceptual level only; test with a `--dry-run` first before the real push.
- **`supabase db seed` CLI command name**: CLI 2.x exposes it; confirm with `npx supabase --help` at install time. Fallback: `psql "$DATABASE_URL" -f supabase/seed.sql`.
- **Exact error shape from supabase-js when RLS blocks an anon read**: test accepts both empty-data and error outcomes; narrow if one is consistently returned.

### Confidence breakdown

| Area | Level | Reason |
|---|---|---|
| Package versions | HIGH | `npm view` live |
| `@supabase/ssr` API | HIGH | Verbatim from canonical example |
| Next.js 16 breaking changes | HIGH | Official upgrade guide |
| Migration SQL | HIGH | Combined: CONTEXT.md decisions + ARCHITECTURE.md schema + standard Postgres + Supabase storage SQL patterns |
| RLS policies | HIGH | Standard Supabase pattern, verified `auth.uid()` still works |
| Vitest setup | HIGH | Official Next 16 guide |
| Env var checklist | HIGH | `.env.example` from canonical example |
| Vercel deployment | HIGH | Official Vercel docs + CONTEXT.md decisions |
| pg_cron free tier | HIGH | Confirmed |
| Tailwind v4.1.18 Turbopack bug | MEDIUM | Ecosystem reports; pin `^4.2.0` to dodge |
| Supabase CLI remote-push edge cases | MEDIUM | Risk notes included in Section 3 |

**Research date:** 2026-04-18
**Valid until:** ~2026-05-18 (30 days — Next.js and Supabase ship frequently; re-verify `npm view` before locking versions if Phase 1 is deferred past May)
