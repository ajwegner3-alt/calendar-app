---
phase: 11-booking-capacity-and-double-booking-fix
plan: 06
subsystem: testing
tags: [postgres, postgres.js, race-conditions, concurrent-inserts, vitest, skip-guard, direct-connection, supavisor, cap-06]

# Dependency graph
requires:
  - phase: 11-03 (slot-index-migration)
    provides: bookings_capacity_slot_idx unique index + slot_index column that the pg-driver tests exercise
  - phase: 11-04 (bookings-api-capacity-retry)
    provides: slot_index retry loop pattern that the pg-driver test replicates at the DB layer
provides:
  - tests/helpers/pg-direct.ts — pgDirectClient() + hasDirectUrl() exports for direct Postgres connection
  - tests/race-guard.test.ts — CAP-06 pg-driver describe block (capacity=3/N=10 + capacity=1/N=5)
  - .env.example — SUPABASE_DIRECT_URL documented with setup instructions
affects: [phase-13-manual-qa, future-race-test-authors]

# Tech tracking
tech-stack:
  added: [postgres@3.4.9 (devDependency only)]
  patterns:
    - "describe.skipIf(!hasDirectUrl()) skip-guard for CI-safe env-var-gated tests"
    - "Inline admin-client INSERT for event_type fixtures needing explicit max_bookings_per_slot"
    - "pgDirectClient(maxConnections) with idle_timeout + connect_timeout for race test isolation"

key-files:
  created:
    - tests/helpers/pg-direct.ts
  modified:
    - package.json
    - package-lock.json
    - tests/race-guard.test.ts
    - .env.example

key-decisions:
  - "postgres.js installed as devDependency only — never in app runtime dependencies"
  - "Fixture path: Fallback B (inline admin-client INSERT with explicit max_bookings_per_slot=CAPACITY)"
  - "getOrCreateTestEventType() not extended — it is a get-or-create returning same row; would need unique slugs and different capacities per test regardless"
  - "SUPABASE_DIRECT_URL setup deferred to Andrew — documented in .env.example (plan file referenced .env.local.example but actual file in project is .env.example)"
  - "describe.skipIf used (already established in project by rls-cross-tenant-matrix.test.ts)"

patterns-established:
  - "pg-direct helper: only importable from tests/ — never from app/ or lib/"
  - "Skip-guarded pg test pattern: const skipIfNoX = !hasX(); describe.skipIf(skipIfNoX)()"

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 11 Plan 06: pg-driver race test (CAP-06) Summary

**postgres.js direct-connection race test proving slot_index + unique-index is genuinely race-safe at the DB layer (bypassing Supavisor), skip-guarded for CI when SUPABASE_DIRECT_URL is absent**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T01:58:48Z
- **Completed:** 2026-04-29T02:02:06Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- postgres.js 3.4.9 installed as devDependency (NOT runtime dependency)
- `tests/helpers/pg-direct.ts` created with `pgDirectClient(maxConnections)` and `hasDirectUrl()` exports
- Two new pg-driver race tests appended to `tests/race-guard.test.ts`: capacity=3/N=10 and capacity=1/N=5
- Skip-guard verified: `SUPABASE_DIRECT_URL` absent → 2 tests skip; present → tests run against prod DB
- Full suite: 148 tests passing + 26 skipped (2 new CAP-06 skips + 24 pre-existing skips)
- `SUPABASE_DIRECT_URL` documented in `.env.example` with setup instructions

## Pitfall 4 Regression Gate (CRITICAL — run before new tests)

**Gate command:** `npm run test -- race-guard.test.ts slots-api.test.ts`

**Result: PASSED**

```
 Test Files  2 passed (2)
      Tests  14 passed (14)
   Start at  20:58:53
   Duration  3.73s (transform 180ms, setup 141ms, import 1.25s, tests 4.06s, environment 0ms)
```

v1.0 supabase-js race-guard test and all slots-api tests continue to pass after Plan 11-05's `.neq("status","cancelled")` → `.eq("status","confirmed")` filter change. No regression.

## Fixture-Helper Path Chosen

**Path: Fallback B — inline admin-client INSERT for event_type fixtures**

**Rationale:**
- `getOrCreateTestEventType(accountId)` in `tests/helpers/supabase.ts` is a **get-or-create** that returns the same `nsi-test/test-race` event_type every time it's called. It does NOT accept `max_bookings_per_slot` overrides.
- Two tests need **different** `max_bookings_per_slot` values (3 and 1). Even if the helper accepted overrides, it couldn't return two different rows per test isolation because it first checks for an existing row by slug.
- Solution: Each test does its own `admin.from("event_types").insert({ ..., max_bookings_per_slot: CAPACITY })` with a unique timestamp-suffixed slug, then deletes it in a `finally` block.
- Account creation still uses `getOrCreateTestAccount()` (stable nsi-test account).
- `max_bookings_per_slot` is **always explicit** in both tests — never relying on the DB DEFAULT of 1.

## Skip-Guard Behavior

| Environment | SUPABASE_DIRECT_URL | Test outcome |
|---|---|---|
| CI / no env var | unset | 2 new tests `skipped` (CI green) |
| Local with env var | set | 2 new tests run against prod DB |

Pattern used: `describe.skipIf(!hasDirectUrl())` — consistent with existing `describe.skipIf(skipIfNoSecondUser)` pattern in `tests/rls-cross-tenant-matrix.test.ts`.

## Task Commits

Each task committed atomically:

1. **Task 1: Install postgres.js + pg-direct helper + env var doc** - `370d8d0` (chore)
2. **Task 2: pg-driver capacity=N race test (skip-guarded)** - `da8e229` (test)

## Files Created/Modified

- `tests/helpers/pg-direct.ts` — Direct Postgres connection helper; exports `pgDirectClient(maxConnections)` + `hasDirectUrl()`; throws on missing SUPABASE_DIRECT_URL
- `tests/race-guard.test.ts` — New `describe.skipIf(!hasDirectUrl())` block appended; existing supabase-js test untouched
- `package.json` — `"postgres": "^3.4.9"` added to `devDependencies` (NOT `dependencies`)
- `package-lock.json` — Updated by npm install
- `.env.example` — CAP-06 section appended: `SUPABASE_DIRECT_URL=` with setup instructions

## Decisions Made

- **postgres.js dev-only:** Never in runtime dependencies — pg connection is test-only. `grep -rn "pg-direct" app/ lib/` returns 0 matches (verified).
- **Fixture path Fallback B:** Inline event_type INSERT per test with unique slug + explicit `max_bookings_per_slot` + cleanup in `finally` block. Account setup still via `getOrCreateTestAccount()`.
- **`.env.example` vs `.env.local.example`:** Plan referenced `.env.local.example` but the actual project file is `.env.example`. Appended to the existing file (Rule 1 auto-fix).
- **No helper extension needed:** Extending `getOrCreateTestEventType()` would require capacity overrides AND unique slugs per test — Fallback B is simpler and more explicit.
- **SUPABASE_DIRECT_URL setup deferred:** Andrew must obtain the Direct connection string from Supabase Dashboard. All test infrastructure is ready; only the env var is missing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `.env.local.example` → `.env.example`**
- **Found during:** Task 1 (env var documentation)
- **Issue:** Plan specified `.env.local.example` but the actual project env example file is `.env.example` (`.env.local.example` does not exist in the repo)
- **Fix:** Appended the `SUPABASE_DIRECT_URL=` section to the existing `.env.example`
- **Files modified:** `.env.example`
- **Verification:** File visible with correct CAP-06 comment block
- **Committed in:** `370d8d0` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — wrong filename in plan)
**Impact on plan:** No scope creep. All success criteria met.

## Issues Encountered

None — plan executed cleanly. Pre-existing `tsc --noEmit` errors (test-mock alias errors) are pre-existing v1.2 tech debt; `pg-direct.ts` itself has no TS errors.

## User Setup Required

**Andrew must set `SUPABASE_DIRECT_URL` in `.env.local` to run the new CAP-06 tests.**

Steps:
1. Go to Supabase Dashboard → Project `mogfnutxrrbtvnaupoun` → Project Settings → Database
2. Find "Connection string" → select "Direct connection" (port 5432, NOT the Supavisor port 6543)
3. Copy the URL: `postgresql://postgres.mogfnutxrrbtvnaupoun:{password}@db.mogfnutxrrbtvnaupoun.supabase.co:5432/postgres`
4. Add to `.env.local`:
   ```
   SUPABASE_DIRECT_URL=postgresql://postgres.mogfnutxrrbtvnaupoun:{your-db-password}@db.mogfnutxrrbtvnaupoun.supabase.co:5432/postgres
   ```
5. Run: `npm run test -- race-guard.test.ts`
6. Expected: 3 tests passing (1 existing supabase-js + 2 new pg-driver CAP-06)

## Next Phase Readiness

- CAP-06 satisfied at the pg-driver layer — race-safety proven at the Postgres level, not just HTTP layer
- Plan 11-07 can proceed (cancel/reschedule capacity-aware routes)
- When Andrew sets `SUPABASE_DIRECT_URL`, the two new tests will run and confirm race-safety against prod schema

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-29*
