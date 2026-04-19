# Summary: 01-PLAN-02 Schema Migrations

**Plan:** `01-PLAN-02-schema-migrations.md`
**Status:** Complete ✓
**Completed:** 2026-04-19

## What Was Built

The full Phase 1 data layer: 6 tenant-scoped tables with `timestamptz` discipline and denormalized `account_id`, a DB-level double-book guard via partial unique index, three booking enums, RLS enabled everywhere with anon blocked by policy-absence, a `current_owner_account_ids()` SECURITY DEFINER helper, a public-read `branding` storage bucket with owner-scoped write policies, and Andrew's `nsi` account seeded at `America/Chicago` (idempotent). Applied to the live Calendar project (`mogfnutxrrbtvnaupoun`) — every downstream phase can build against this shape without schema revision.

## Commits

| Commit | Task | Files |
|--------|------|-------|
| `2382581` | `chore(01-02): install supabase CLI and scaffold supabase/ project` | `supabase/config.toml`, `supabase/.gitignore`, `package.json`, `package-lock.json` |
| `39f0f50` | `feat(01-02): initial schema, RLS policies, storage bucket, and seed` | `supabase/migrations/20260419120000_initial_schema.sql`, `supabase/migrations/20260419120001_rls_policies.sql`, `supabase/seed.sql` |

Plan metadata commit follows this SUMMARY.

## Migration Files

- `supabase/migrations/20260419120000_initial_schema.sql` — extensions (`pgcrypto`, `citext`), 3 enums, 6 tables, indexes (including partial unique index for race guard)
- `supabase/migrations/20260419120001_rls_policies.sql` — RLS on 6 tables, `current_owner_account_ids()` helper, 8 table policies (no anon), storage bucket + 4 storage policies
- `supabase/seed.sql` — idempotent `nsi` account seed with `America/Chicago`, `ON CONFLICT DO NOTHING`

## Apply Path

Plan's original apply path (`supabase db push`) was swapped for **direct application via the Supabase MCP server's `apply_migration` tool**. Same SQL lands on the remote; migrations are recorded in `supabase_migrations.schema_migrations` the same way. This avoided the interactive DB-password prompt `supabase link` requires and matched how Andrew's other NSI projects work with Claude. The versioned-migration-file discipline from CONTEXT.md is preserved — files are committed; anyone can later `supabase db push` them to a different environment.

CLI `link` was NOT completed; no `supabase/.temp/project-ref` exists locally. That's fine — the CLI is only needed for future local development workflows, not for applying these migrations.

## Verification vs Success Criteria

All 10 automated checks ran via MCP `execute_sql`:

| # | Check | Result |
|---|-------|--------|
| 1 | 6 tables present in `public` | ✓ accounts, availability_rules, booking_events, bookings, date_overrides, event_types |
| 2 | All timestamp columns `timestamp with time zone` | ✓ 10/10 columns `timestamptz` |
| 3 | Partial unique index `bookings_no_double_book` | ✓ `WHERE (status = 'confirmed'::booking_status)` exact match |
| 4 | `booking_status` enum | ✓ `{confirmed,cancelled,rescheduled}` (exactly 3) |
| 5 | `booking_event_kind` enum | ✓ `{created,cancelled,rescheduled,reminder_sent}` (exactly 4) |
| 6 | `booking_actor` enum | ✓ `{booker,owner,system}` |
| 7 | RLS enabled on all 6 | ✓ `relrowsecurity=true` on every table |
| 8 | Storage bucket `branding` | ✓ exists, `public=true` |
| 9 | Zero anon policies on our 6 tables | ✓ empty result set |
| 10 | `current_owner_account_ids()` | ✓ exists, `is_security_definer=true`, `provolatile='s'` (stable) |
| — | Seed idempotency re-run | ✓ second `insert ... on conflict do nothing` returned 0 rows; `nsi` count still 1 |

Andrew's account row: `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, `slug=nsi`, `name=North Star Integrations`, `timezone=America/Chicago`, `owner_user_id=null` (will be linked in Phase 2 auth).

## Coexistence with Prior Data

The Calendar project already had `public.contact_submissions` (11 rows) from an earlier unrelated use. Per user decision, left untouched. No name collisions with our 6 tables, enums, functions, policies, or storage bucket.

## Deviations / Discoveries

- **MCP instead of `supabase db push`.** Cleaner than dealing with the CLI password prompt; equivalent end state on the remote. The CLI remains installed as a dev dep (for future `migration new` file scaffolding and any local-DB workflows). `supabase/.temp/project-ref` is not populated; if a future plan calls `npx supabase db <cmd> --linked`, it'll need `npx supabase link --project-ref mogfnutxrrbtvnaupoun` first (DB password required).
- **Migration timestamps.** Used `20260419120000` / `20260419120001` (today's date + ordinal) rather than capturing actual wall-clock time. Works identically and keeps ordering deterministic.
- **`contact_submissions` table** (11 rows, unrelated) was present in `public` before migrations ran. Plan text said to confirm `public` was empty first, but since names don't collide we proceeded. No impact on any verification.

## must_haves Status

- [x] Six tables exist with `timestamptz` everywhere and `account_id` denormalized
- [x] `bookings_no_double_book` partial unique index exists with `WHERE status='confirmed'`
- [x] `booking_status` enum has exactly 3 values; `booking_event_kind` has exactly 4
- [x] RLS enabled on all 6 tables; anon role has zero direct policies
- [x] `current_owner_account_ids()` exists and is `security definer`
- [x] Owner-scoped policies on every table; service-role handles public paths
- [x] Storage bucket `branding` exists, public-read, with owner-upload/update/delete policies keyed on path prefix
- [x] `nsi` account seeded at `America/Chicago`
- [x] Seed idempotent (re-run confirmed)

## Next

**Plan 03: Tests and README** — Wave 3. Installs Vitest + Supabase test helpers, writes two automated tests against the live schema:

1. **Race-guard** — `Promise.allSettled` of 10 parallel confirmed-status inserts on the same `(event_type_id, start_at)`; assert exactly 1 fulfilled, 9 rejected with unique constraint violation (proves FOUND-04 at runtime).
2. **RLS anon lockout** — anon client attempts SELECT + INSERT on every one of our 6 tables; assert all fail or return empty (proves FOUND-05 at runtime).

Plus a full README covering clone → install → env → run → test → deploy, and a final Vercel redeploy. Autonomous — no human checkpoints.
