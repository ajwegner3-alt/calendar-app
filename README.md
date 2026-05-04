# calendar-app

Multi-tenant booking tool for service businesses. A visitor lands on a business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Live production:** https://calendar-app-xi-smoky.vercel.app/

## Tech stack

- **Next.js 16** (App Router, Turbopack default, `proxy.ts` for auth session refresh)
- **React 19** / **TypeScript 6**
- **@supabase/ssr 0.10** (`createBrowserClient` / `createServerClient` with `getAll` / `setAll` cookie contract)
- **@supabase/supabase-js 2.103** (service-role admin client, gated by `import "server-only"`)
- **Tailwind CSS v4** (`@import "tailwindcss"`, `@tailwindcss/postcss`)
- **Vitest 4** (jsdom default env, Node env for DB-only tests)
- **Hosting:** Vercel (auto-deploy on push to `main`)

## Getting started

### 1. Prereqs

- Node.js >= 20.9 LTS (the repo currently runs on v24 too, but engines pins `20.x`)
- npm
- git
- A Supabase project (Free tier is fine)
- A Vercel account (for deploys)

### 2. Clone and install

```bash
git clone https://github.com/ajwegner3-alt/calendar-app.git
cd calendar-app
npm install
```

### 3. Environment variables

Copy the example and populate it:

```bash
cp .env.example .env.local
```

The three required values all live in **Supabase Dashboard → Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project API Keys → `sb_publishable_...` (preferred) or legacy `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys → `service_role` (secret — never commit) |

`.env.local` is already gitignored. Never prefix the service-role key with `NEXT_PUBLIC_`.

### 4. Link the Supabase CLI (one-time)

```bash
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

The project ref is the subdomain on your Supabase dashboard URL (e.g. `mogfnutxrrbtvnaupoun`).

### 5. Apply migrations

```bash
npx supabase db push
```

This creates all 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`), enables RLS on each, installs the partial unique index `bookings_no_double_book`, and creates the `branding` storage bucket.

### 6. Seed

```bash
npx supabase db seed
# or: psql $DATABASE_URL -f supabase/seed.sql
```

Seeds the `nsi` account with `timezone = 'America/Chicago'`.

### 7. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

### 8. Run the tests

```bash
npm test           # run once
npm run test:watch # watch mode
```

The suite contains two DB-level tests that speak to the remote Supabase project:

- `tests/race-guard.test.ts` — fires 10 parallel confirmed bookings on the same `(event_type_id, start_at)` and asserts exactly one succeeds (FOUND-04).
- `tests/rls-anon-lockout.test.ts` — verifies the anon client cannot SELECT or INSERT on any of the 6 tables (FOUND-05).

Tests are idempotent — they clean up after themselves and use the separate `nsi-test` account slug.

## Deploying

Push to `main` → Vercel auto-deploys. Environment variables are configured in the Vercel dashboard (**Project Settings → Environment Variables**), *not* in a committed `.env.production` file. Copy the same three keys from your `.env.local` into the Vercel project.

## Project structure

```
app/                       # Next.js App Router pages + route handlers
lib/supabase/
  client.ts                # Browser client (Client Components)
  server.ts                # Server client (Server Components, Route Handlers)
  proxy.ts                 # Session-refresh helper for proxy.ts
  admin.ts                 # Service-role client — server-only, bypasses RLS
proxy.ts                   # Next 16 middleware replacement (auth session refresh)
supabase/
  config.toml              # Linked project config
  migrations/              # SQL migration files (applied via `supabase db push`)
  seed.sql                 # Seed data (nsi account)
tests/
  setup.ts                 # dotenv loader
  helpers/supabase.ts      # anonClient() / adminClient() factories
  race-guard.test.ts       # FOUND-04 test
  rls-anon-lockout.test.ts # FOUND-05 test
.planning/                 # GSD phase plans, research, state (not deployed)
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is **never** prefixed `NEXT_PUBLIC_` — it must never reach the client bundle.
- `lib/supabase/admin.ts` is gated by `import "server-only"` — the build throws if a Client Component imports it.
- RLS is enabled on every one of the 6 tables; the anon role has zero policies, so anon reads return `[]` and anon writes error out.
- The DB-level race guard is a partial unique index: `UNIQUE (event_type_id, start_at) WHERE status='confirmed'`. This is the authoritative double-book defense — not application code.
- The `branding` storage bucket is public-read with owner-scoped write policies.

## Phase status

Phase 1 (Foundation) — **complete**. See `.planning/ROADMAP.md` for the full 9-phase breakdown. Phase 2 (Owner Auth + Dashboard Shell) is next.
