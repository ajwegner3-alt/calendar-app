---
phase: 01-foundation
status: passed
verified: 2026-04-19
verifier: orchestrator-inline
method: goal-backward against ROADMAP.md success criteria using evidence from plan SUMMARYs + live DB queries
---

# Phase 1: Foundation — Verification

## Verdict

**PASSED.** All 5 ROADMAP success criteria and all 73-mapped Phase 1 requirements (FOUND-01..06) are satisfied. Plans delivered what the phase goal promised: a multi-tenant Supabase + Next.js scaffold live on Vercel with race-safe, timezone-correct, RLS-locked data.

## Success Criteria — Goal-Backward Check

| # | ROADMAP success criterion | Evidence | Status |
|---|---|---|---|
| 1 | Deployed Vercel URL returns a working Next.js App Router page connected to Supabase `calendar` | `curl https://calendar-app-xi-smoky.vercel.app/` → HTTP 200, 5942 bytes, Next SSR + Turbopack chunks (curl re-verified at 1.27s after Wave 3 push). Three env vars populated in Vercel for Prod/Preview/Dev. | ✓ |
| 2 | All 6 tables exist with `timestamptz` columns + IANA TZ strings on `accounts`/`bookings` | MCP `execute_sql` returned 6 tables; all 10 timestamp columns are `timestamp with time zone`; `accounts.timezone` and `bookings.booker_timezone` are `text`. Migration file `20260419120000_initial_schema.sql` committed (`39f0f50`). | ✓ |
| 3 | Two parallel same-slot confirmed-status INSERTs produce exactly 1 success + 1 constraint violation | Vitest `race-guard.test.ts`: `Promise.allSettled` of N=10 parallel confirmed-status inserts → 1 fulfilled, 9 rejected with unique-constraint error referencing `bookings_no_double_book`. Test passed in `a1accac`. | ✓ |
| 4 | Anon client cannot read/write any table; service-role gated to server modules via `server-only` | Vitest `rls-anon-lockout.test.ts`: anon SELECT+INSERT on all 6 tables — 12/12 checks all fail or return empty. `head -1 lib/supabase/admin.ts` → `import "server-only";` (confirmed post-Wave-3). | ✓ |
| 5 | Andrew's account row exists with `timezone='America/Chicago'` | MCP `execute_sql`: `select ... from accounts where slug='nsi'` → 1 row, id `ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, `timezone='America/Chicago'`. Seed idempotency verified by second run (0 new rows). | ✓ |

## Requirements Covered (FOUND-01..06)

| REQ-ID | Phase contribution | Status |
|---|---|---|
| FOUND-01 | Next.js 16 App Router + TypeScript scaffolded and deployed to Vercel | ✓ Complete (Wave 1) |
| FOUND-02 | Supabase connected via `@supabase/ssr`; service-role key gated in `lib/supabase/admin.ts` with `server-only` | ✓ Complete (Wave 1) |
| FOUND-03 | 6 tables migrated — `timestamptz`, IANA text timezones, `account_id` denormalized | ✓ Complete (Wave 2) |
| FOUND-04 | Partial unique index `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` | ✓ Complete (Wave 2 + runtime-proved Wave 3) |
| FOUND-05 | RLS enabled on all 6 tables scoped by `account_id`; anon has no direct-table access | ✓ Complete (Wave 2 + runtime-proved Wave 3) |
| FOUND-06 | `nsi` account seeded at `America/Chicago`, idempotent | ✓ Complete (Wave 2) |

## CONTEXT.md Locked Decisions — Audit

| Decision | Honored? | Evidence |
|---|---|---|
| Public GitHub repo, main-only, scaffold-before-schema deploys | ✓ | https://github.com/ajwegner3-alt/calendar-app public, `main` branch, two atomic deploys |
| Supabase CLI + versioned migrations in `supabase/migrations/` | ✓ | Two timestamped files committed |
| Remote Supabase for dev (no Docker) | ✓ | No `supabase start`; tests run against remote ref `mogfnutxrrbtvnaupoun` |
| Idempotent `supabase/seed.sql` | ✓ | `ON CONFLICT (slug) DO NOTHING`; re-run returned 0 rows |
| `pg_cron` / `pg_net` NOT enabled | ✓ | Neither extension present; only `pgcrypto` + `citext` created |
| `booking_status` = exactly `confirmed\|cancelled\|rescheduled` | ✓ | `enum_range(null::booking_status)` = `{confirmed,cancelled,rescheduled}` |
| `booking_events` = exactly `created\|cancelled\|rescheduled\|reminder_sent` | ✓ | `enum_range(null::booking_event_kind)` matches |
| Storage bucket exactly `branding`, public-read | ✓ | `storage.buckets` row has `id='branding'`, `public=true` |
| `import "server-only"` line 1 of `lib/supabase/admin.ts` | ✓ | Head-of-file verified post-Wave-3 |
| Vitest in Phase 1 with exactly 2 tests | ✓ | `tests/race-guard.test.ts` + `tests/rls-anon-lockout.test.ts`; Playwright NOT installed |
| `custom_questions` jsonb shape (Claude's discretion) | ✓ | Column `jsonb not null default '[]'` exists; shape validation deferred to Phase 3 per plan |

All 11 audited decisions honored. Zero deferred items leaked into phase output.

## Notable Deviations (recorded for future-me)

1. **Apply path switched from `supabase db push` to MCP `apply_migration`.** Same SQL lands; same migration tracking table. Swapped to avoid the interactive DB-password prompt `supabase link` requires. The CLI-versioned migration files are still committed and portable — future `supabase db push` against a different environment works.
2. **Legacy JWT `SUPABASE_SERVICE_ROLE_KEY`** (`eyJ...`) in use rather than new `sb_secret_*` format. Works today; swap noted as a tidy-up item. Publishable key already uses new format.
3. **Pre-existing `contact_submissions` table** (11 rows, unrelated) kept in the `calendar` Supabase project. No name collisions; zero impact on Phase 1 verification or any downstream phase.

## Phase 1 Artifacts Produced

- Source code: Next 16 app, `proxy.ts`, `lib/supabase/{client,server,proxy,admin}.ts`, Tailwind v4, Vitest harness + 2 tests, full README — committed across commits `0b66177`, `a1accac`, `46ab535`.
- Migrations: `supabase/migrations/20260419120000_initial_schema.sql`, `supabase/migrations/20260419120001_rls_policies.sql`, `supabase/seed.sql` — committed in `39f0f50`.
- Plan artifacts: 3 PLAN.md files, 3 SUMMARY.md files, RESEARCH.md, CONTEXT.md, this VERIFICATION.md.
- Remote resources: Supabase `calendar` schema (6 tables + enums + indexes + RLS + helper + storage bucket + seeded account), Vercel production deployment, public GitHub repo.

## Ready for Phase 2

Phase 1 foundation is stable. Phase 2 (Owner Auth + Dashboard Shell) can build directly on:
- `accounts` table with `owner_user_id uuid references auth.users(id) on delete set null` ready to be linked when Andrew completes Supabase Auth signup.
- `@supabase/ssr` cookie plumbing already wired in `proxy.ts` + `lib/supabase/server.ts`.
- Existing `nsi` account row (`id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`) waiting for `owner_user_id` to be populated.

## Carried Concerns

- **Tidy up legacy JWT service-role key** — swap for `sb_secret_*` before any security-sensitive phase (recommendation for Phase 8 hardening, not a blocker).
- **`supabase link` not run locally.** If any future plan needs `npx supabase <cmd> --linked`, Andrew will need to run link first (with DB password). MCP handles the remote-apply case already.

---
*Verification completed: 2026-04-19 inline by orchestrator*
*Method: goal-backward against ROADMAP success criteria using SUMMARY-documented evidence + spot-check against live DB and filesystem state*
