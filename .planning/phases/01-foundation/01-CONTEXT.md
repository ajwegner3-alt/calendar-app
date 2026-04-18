# Phase 1: Foundation - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Multi-tenant Supabase + Next.js scaffold live on Vercel with a race-safe, timezone-correct, RLS-locked data layer. Covers: Next.js 15 App Router project scaffolded, Supabase `calendar` project wired via `@supabase/ssr`, all 6 tables migrated with `timestamptz` + IANA timezone strings, partial unique index on `bookings`, RLS enabled on every table with anon fully locked out, service-role client gated via `server-only`, and Andrew's account seeded. Covered requirements: FOUND-01..06.

Authentication, event types, availability, booking flow, and branding are all separate phases. This phase only proves the *foundation* works — it ends with a deployed scaffold page plus a migrated schema whose race/RLS guarantees are verified by Vitest tests.

</domain>

<decisions>
## Implementation Decisions

### Repo + Deployment

- New **public** GitHub repo under Andrew's account (name: `calendar-app`).
- **main-only** branching — every commit pushed to `main`, Vercel auto-deploys each push. Matches CLAUDE.md's "push early and often" workflow.
- First Vercel deploy happens **after the scaffold lands but before the schema migration** — two small verifiable steps rather than one big one. Empty Next.js hello-world deploys, we confirm the Vercel wiring works, then schema goes in.
- Secrets split: **`.env.local` (gitignored) for local dev, Vercel env UI for production/preview**. Provide Andrew a copy-paste checklist of exact env var names to paste into Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).

### Supabase Migrations + Dev DB

- **Supabase CLI with versioned migration files** (`supabase/migrations/<timestamp>_<name>.sql`). Every schema change is a committed file, reviewable, reproducible.
- Local dev runs against the **remote Supabase `calendar` project directly** (no local Docker / `supabase start`). Simpler; safe while v1 has no real users.
- Andrew's account seeded via **`supabase/seed.sql`** committed to the repo. Inserts his `accounts` row with `timezone = 'America/Chicago'`, idempotent via `ON CONFLICT DO NOTHING`. Seed file is the place future test accounts get added too.
- **`pg_cron` and `pg_net` are NOT enabled in Phase 1.** Research picked Vercel Cron as primary for reminders; pg_cron is only a fallback. Decision: enable only in Phase 8 if Vercel Cron's hobby-tier limits don't fit. Keeps Phase 1 focused and surface area small.

### Schema Specifics

- **`event_types.custom_questions`** — Claude's discretion on exact shape; research suggests `[{id, label, type, required, options?}]`. Lock the concrete shape during planning based on best Phase 3 ergonomics. Must support at minimum short text, long text, and select with options; phone/email/number types are a bonus if cheap.
- **`bookings.status`** enum values: `confirmed`, `cancelled`, `rescheduled`. "Completed" is inferred (`start_at < now() AND status='confirmed'`); no-show tracking is out of v1.
- **`booking_events`** audit table tracks **key events only**: `created`, `cancelled`, `rescheduled`, `reminder_sent`. Columns: `booking_id`, `event_type`, `occurred_at`, `actor` (`booker`|`owner`|`system`), `metadata jsonb`.
- **Per-account logos** stored in a Supabase Storage bucket named `branding`, path `{account_id}/logo.{ext}`, public-read. The full public URL is stored on `accounts.logo_url`. Bucket creation belongs in this phase so Phase 7 has somewhere to upload to.

### Test Harness

- **Install Vitest + Supabase test helpers in Phase 1** so Phase 4 (DST tests) and Phase 8 (RLS matrix) plug into an existing test setup.
- Phase 1's DB-level verifications are **automated Vitest tests** (not one-off SQL scripts):
  - **Race guard test** — N parallel `INSERT`s on `(event_type_id, start_at)` for `status='confirmed'`; assert exactly one succeeds and the rest violate the partial unique index.
  - **RLS anon lockout test** — anon Supabase client attempts to read and write every table; all attempts return empty or fail.
- **Playwright is deferred to Phase 9** (or whichever earlier phase actually needs E2E); the full booking flow doesn't exist until Phase 5, and setting up Playwright before then adds cost without payoff.
- Tests run against the **same remote Supabase project** as dev, isolated by `account_id` (tests spin up a dedicated test account via seed helpers). A separate Supabase test project can come later if hermetic isolation becomes necessary.

### Claude's Discretion

- Exact Next.js project structure (route-group names, `lib/` subfolders).
- Exact shape of `event_types.custom_questions` jsonb (within the constraints above).
- Naming of the Vitest helper module / test directory structure.
- Tailwind v3 vs v4 decision — lean toward whichever is stable at install time; this is a standard default, not a gray area worth re-litigating.
- Whether the first scaffold deploy includes a placeholder landing page or just a blank App Router shell.
- Exact seed-file structure and any helper SQL functions (e.g., `current_owner_account_ids()`).

</decisions>

<specifics>
## Specific Ideas

- "Push early and often" is a hard rule from CLAUDE.md — commit and deploy after each logical unit (scaffold, then schema, then tests).
- Supabase project name is fixed: **`calendar`**.
- Andrew's IANA timezone is fixed: **`America/Chicago`**.
- Env vars follow standard Next + Supabase naming — Andrew wants a concrete checklist of exact names to paste into Vercel.

</specifics>

<deferred>
## Deferred Ideas

- **pg_cron / pg_net extension enablement** — deferred to Phase 8 unless research finds Vercel Cron's hobby tier too limited.
- **Playwright / E2E test setup** — deferred to Phase 9 (or the earliest phase whose plan-phase verification says it's needed).
- **Separate Supabase project for isolated testing** — defer; remote-with-test-tenant is sufficient for v1.
- **Local `supabase start` Docker dev DB** — defer; may become worthwhile later if offline work or hermetic integration tests become important.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-18*
