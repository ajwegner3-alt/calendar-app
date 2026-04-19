---
phase: 01
plan: 03
subsystem: foundation
tags: [vitest, testing, rls, race-guard, readme, phase-complete]
completed: 2026-04-18
duration: ~25 minutes
requires: [01-PLAN-01, 01-PLAN-02]
provides:
  - Vitest test harness (shared across phases 4, 8)
  - FOUND-04 evidence (race guard at DB layer)
  - FOUND-05 evidence (anon RLS lockout on 6 tables)
  - Cold-start README
affects: [02, 03, 04, 05, 06, 07, 08]
tech-stack:
  added:
    - vitest@4.1.4
    - "@vitejs/plugin-react@6"
    - jsdom@29
    - "@testing-library/react@16, @testing-library/dom, @testing-library/jest-dom"
    - vite-tsconfig-paths@6
    - dotenv
  patterns:
    - "DB-direct integration tests against remote Supabase (no local stack, no test-specific project)"
    - "Test-tenant isolation via nsi-test slug (idempotent cleanup per test)"
    - "Node environment override via // @vitest-environment node for DB-only tests"
key-files:
  created:
    - vitest.config.ts
    - tests/setup.ts
    - tests/helpers/supabase.ts
    - tests/race-guard.test.ts
    - tests/rls-anon-lockout.test.ts
    - .planning/phases/01-foundation/01-SUMMARY-03-tests-and-readme.md
  modified:
    - package.json (test/test:watch/test:ui scripts)
    - package-lock.json
    - README.md (137 lines, full cold-start guide)
decisions:
  - Vitest 4 + jsdom default, Node env opt-in per-file for DB tests (matches RESEARCH.md Section 6)
  - Single remote Supabase project for both app + tests; test-tenant isolation via nsi-test slug
  - Race test at N=10 (stronger evidence than the N=2 minimum in ROADMAP success criteria #3)
  - RLS test accepts both outcomes on SELECT (data:[] OR error) — supabase-js returns empty data when no policy matches
---

# Phase 1 Plan 3: Tests and README Summary

**One-liner:** Installed Vitest, proved FOUND-04 and FOUND-05 via two DB-direct integration tests, and wrote the cold-start README — Phase 1 is done.

## What shipped

### Test harness

- `vitest.config.ts` — jsdom default env, 15s `testTimeout`, `tsconfigPaths() + react()` plugins.
- `tests/setup.ts` — loads `.env.local` via dotenv so tests see the same env as `npm run dev`.
- `tests/helpers/supabase.ts` — `anonClient()`, `adminClient()`, `getOrCreateTestAccount()`, `getOrCreateTestEventType()`. Test-tenant slug `nsi-test` is cleanly separate from Andrew's production `nsi` seed row.
- `tests/race-guard.test.ts` — fires **N=10** parallel confirmed inserts on the same `(event_type_id, start_at)` via `Promise.allSettled`. Asserts `succeeded.length === 1 && failed.length === 9`. Cleans up after itself.
- `tests/rls-anon-lockout.test.ts` — for each of the 6 tables runs SELECT (accepts either `data === []` or `error`) and INSERT (asserts `error` is truthy). 12 assertions total.

### README

- 137 lines, covers: tech stack, prereqs, clone, install, env setup (with Supabase Dashboard path for each key), `npx supabase login` + `link` + `db push` + `db seed`, `npm run dev`, `npm test`, Vercel deploy workflow, full project tree, security notes (`server-only`, RLS, partial unique race guard), phase status.

## `npm test` results

```
Test Files  2 passed (2)
      Tests  13 passed (13)
   Duration  ~3.3s (first run 3.57s, re-run 1.91s)
```

Breakdown:
- `bookings race guard (FOUND-04)` — 1 passed (1 of 10 parallel confirmed inserts succeeded; 9 rejected with unique-constraint violation)
- `RLS anon lockout (FOUND-05)` — 12 passed (6 SELECT + 6 INSERT across accounts, event_types, availability_rules, date_overrides, bookings, booking_events)

Idempotent: second run clean (race test cleans its slot in cleanup; RLS test doesn't insert).

## Final production deploy

- Vercel URL: https://calendar-app-xi-smoky.vercel.app/
- HTTP 200 in 1.27s
- Body contains `calendar-app` as expected
- Both commits on this plan pushed to `origin/main`; Vercel auto-deployed after each push
- Local `npm run build` green (4 static pages generated, Proxy middleware present)

## ROADMAP Phase 1 success criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | Vercel URL returns working Next page connected to the Supabase calendar project | `curl -I https://calendar-app-xi-smoky.vercel.app/` → HTTP 200, body references `calendar-app`; same env vars in Vercel and `.env.local` target `mogfnutxrrbtvnaupoun` |
| 2 | All 6 tables exist with `timestamptz` + IANA TZ strings on `accounts`/`bookings` | Verified in Plan 02 SQL; the 6 tables are readable+writable via service-role in `tests/helpers/supabase.ts` |
| 3 | 2 parallel INSERTs on same `(event_type_id, start_at)` with `status='confirmed'` produce 1 success + 1 violation | `tests/race-guard.test.ts` runs **N=10** (stronger) and passes |
| 4 | Anon client cannot read or write any table; service-role gated by `server-only` | `tests/rls-anon-lockout.test.ts` passes 12/12; `lib/supabase/admin.ts` starts with `import "server-only";` |
| 5 | Andrew's account exists with `timezone='America/Chicago'` | Seeded in Plan 02 (`ba8e712d-...`); `getOrCreateTestAccount()` creates a separate `nsi-test` so production row stays untouched |

All five criteria satisfied.

## Deviations from RESEARCH.md

**None.** Config, helpers, and both test files are verbatim from Section 6. The only meta-addition is the `autoRefreshToken: false` option on the admin client (paranoia against the admin client trying to refresh a non-existent session during the test run).

## Commits on this plan

| Hash | Type | Message |
|---|---|---|
| a1accac | test(01-03) | add Vitest harness with race-guard + RLS anon-lockout suites |
| 46ab535 | docs(01-03) | complete Phase 1 README with full getting-started |
| _(this summary)_ | docs(01-03) | complete tests-and-readme plan |

## Phase 1 status

**Complete. Ready for Phase 2 (Owner Auth + Dashboard Shell).**

Phase 1 delivered (summing across Plans 1-3):
- Next 16 + Tailwind v4 scaffold on Vercel (live URL)
- 6 tables, 3 enums, partial unique race index, RLS on all, `current_owner_account_ids()` helper, `branding` storage bucket
- Seeded `nsi` account (`America/Chicago`)
- Service-role admin client gated by `server-only`
- Vitest harness with race-guard + RLS anon-lockout tests passing against the live DB
- Cold-start README that lets any dev (or future Claude) recreate the dev environment from zero
- Public GitHub repo + auto-deploying Vercel pipeline on `main`

Next action: `/gsd:plan-phase 2`.
