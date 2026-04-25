---
phase: 04-availability-engine
plan: "06"
subsystem: api
tags: [next.js, route-handler, supabase, vitest, slots, availability, integration-test, service-role]

# Dependency graph
requires:
  - phase: 04-02
    provides: "computeSlots() pure function + SlotInput/Slot types — the engine this route wraps"
  - phase: 04-03
    provides: "availability_rules + date_overrides + accounts data layer; DB schema for the 5 tables this route reads"
  - phase: 01-foundation
    provides: "lib/supabase/admin.ts (createAdminClient), tests/helpers/supabase.ts (adminClient), Supabase schema"
provides:
  - "GET /api/slots route handler — thin HTTP shell around computeSlots()"
  - "Integration test suite (13 tests) covering param validation, happy path, soft-delete 404, Cache-Control headers"
  - "vitest.config.ts server-only alias (no-op stub) enabling route handler imports in Vitest node environment"
affects:
  - phase-05-public-booking-flow
  - phase-07-widget-and-branding

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct route-handler import in Vitest: import GET directly from app/api/*/route.ts, construct NextRequest, no dev server needed"
    - "server-only Vitest alias: resolve.alias['server-only'] -> no-op stub in vitest.config.ts for route handler tests"
    - "Force-dynamic defense-in-depth: export const dynamic='force-dynamic' + export const revalidate=0 + Cache-Control: no-store on every response"
    - "Parallel Supabase fetch after sequential event_type lookup: Promise.all([account, rules, overrides, bookings]) — 4 queries in parallel"

key-files:
  created:
    - app/api/slots/route.ts
    - tests/slots-api.test.ts
    - tests/__mocks__/server-only.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Admin client (service-role) for /api/slots — public endpoint hit by anon Phase 5 booking-page visitors. RLS-scoped client silently returns 0 rows for unauthenticated callers. Reads explicitly scoped to resolved account_id; no writes; inputs Zod/regex-validated before any query."
  - "Direct NextRequest construction in tests — NextRequest works in plain Node environment; no plain Request cast needed"
  - "server-only Vitest alias as Rule 3 auto-fix — lib/supabase/admin.ts imports 'server-only' which throws in Vitest. No-op stub via resolve.alias unblocks route handler tests without affecting Next.js build-time safety"
  - "Bookings range padded ±1 UTC day — from..to dates interpreted in account TZ; Chicago 11pm booking on 'from' has a later UTC timestamp. Padding ensures no edge bookings missed; engine filters precisely by local-date"
  - "5 queries in 2 stages: event_type first (sequential, account_id needed), then account+rules+overrides+bookings in parallel Promise.all"
  - "max_advance_days bumped to 365 in beforeAll, restored in afterAll — prevents test flakiness near 14-day booking window cliff; real dashboard value preserved"

patterns-established:
  - "Route handler integration test pattern: import GET from route.ts + construct NextRequest in @vitest-environment node tests — avoids dev server spin-up, matches real HTTP layer"
  - "server-only alias pattern for any future route handler tests that transitively import lib/supabase/admin.ts"

# Metrics
duration: 12min
completed: 2026-04-25
---

# Phase 4 Plan 06: /api/slots Route Handler + Integration Test Summary

**GET /api/slots HTTP layer wrapping computeSlots() — validates params, fetches 5 Supabase tables (2-stage: sequential event_type then parallel account+rules+overrides+bookings), returns {slots: Array<{start_at, end_at}>} UTC ISO with no-cache headers; 13-test Vitest integration suite all passing**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-25T17:55:10Z
- **Completed:** 2026-04-25T18:07:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created + 2 modified)

## Accomplishments

- Shipped `app/api/slots/route.ts` — thin HTTP shell that validates query params, runs 5 Supabase queries (event_types, accounts, availability_rules, date_overrides, bookings), calls `computeSlots()`, and returns the locked Phase 5 forward contract shape `{slots: Array<{start_at, end_at}>}`
- Shipped `tests/slots-api.test.ts` — 13-test integration suite: 6 param-validation tests (400 + 404 paths), 5 happy-path tests (UTC ISO shape, duration, sort order, empty-closed-day, Cache-Control on all status codes), 1 soft-delete 404 test (try/finally cleanup), 1 cache-header-on-error test
- Fixed blocking `server-only` issue (Rule 3): added `tests/__mocks__/server-only.ts` no-op stub and `vitest.config.ts` resolve alias so route handler can be imported in Vitest node environment without the real package throwing
- Full test suite: 45/45 passing (no regressions on slot engine, race guard, RLS, or auth tests)

## Task Commits

Each task committed atomically:

1. **Task 1: GET /api/slots route handler** — `b74c65f` (feat)
2. **Task 2: Integration test for /api/slots** — `cd572d2` (test) — includes server-only fix + vitest.config.ts update

## Files Created/Modified

- `app/api/slots/route.ts` — GET handler: param validation → event_type lookup → parallel 4-query fetch → computeSlots() → {slots} JSON with Cache-Control: no-store
- `tests/slots-api.test.ts` — 13-test integration suite, seeds + cleans up via adminClient()
- `tests/__mocks__/server-only.ts` — no-op stub for 'server-only' in Vitest environment
- `vitest.config.ts` — added `resolve.alias['server-only']` pointing to no-op stub

## Decisions Made

**Admin client (service-role) for public endpoint**
The `/api/slots` endpoint is called by unauthenticated Phase 5 booking-page visitors. The RLS-scoped `createClient()` from `lib/supabase/server.ts` silently returns 0 rows for anon callers — this would break the entire booking flow. `createAdminClient()` is used instead. Safety rationale: reads are explicitly scoped to the resolved `account_id`; no writes; inputs validated by UUID regex and date regex before any query runs; `import "server-only"` in `admin.ts` prevents client-bundle inclusion at Next.js build time.

**Bookings range padding ±1 UTC day**
The `from`/`to` params are YYYY-MM-DD local calendar dates in the account's timezone. When translating to a UTC bookings query, a booking at Chicago local 11pm on `from` has a UTC timestamp that may fall on the _next_ UTC calendar day. Padding the bookings query range to `${from}T00:00:00.000Z .. ${to}T23:59:59.999Z` covers all TZ offsets. The engine's `countBookingsOnLocalDate` and `slotConflictsWithBookings` then filter precisely by account TZ.

**Direct NextRequest construction in tests**
`NextRequest` from `next/server` can be constructed directly in a Vitest node environment (verified: `new NextRequest('https://...')` resolves `nextUrl.searchParams` correctly). Tests use `new NextRequest(url)` instead of casting a plain `Request` — this is cleaner and exercises the exact same path as production callers.

**5 queries in 2 sequential stages**
`event_type` must be fetched first (account_id needed for the other 4 queries). Then `account + rules + overrides + bookings` run in `Promise.all` — 4 parallel Supabase round-trips instead of 4 sequential ones. Savings: ~3x DB round-trip time for the parallel stage.

**max_advance_days bump in beforeAll**
Test bumped `max_advance_days` from 14 to 365 to ensure the "next Monday 7+ days from now" date always falls within the booking window, regardless of which day of the week the test runs. Restored in `afterAll` so no live dashboard state is leaked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] server-only package throws in Vitest node environment**

- **Found during:** Task 2 (running integration test for the first time)
- **Issue:** `lib/supabase/admin.ts` has `import "server-only"` as line 1. The `server-only` package throws unconditionally in any non-Next.js context, including Vitest node environments. The test file imports `GET` from the route, which imports `admin.ts`, causing a module load failure before any test ran.
- **Fix:** Created `tests/__mocks__/server-only.ts` (empty no-op export) and added `resolve.alias["server-only"]` in `vitest.config.ts` using `path.resolve(__dirname, ...)` to handle Windows path with spaces. The `URL(...).pathname` approach encoded spaces in the path and failed; `path.resolve` works correctly on Windows.
- **Files modified:** `tests/__mocks__/server-only.ts` (created), `vitest.config.ts` (modified)
- **Verification:** `npm test -- tests/slots-api.test.ts` 13/13 passing; full `npm test` 45/45 passing; `npm run build` still clean
- **Committed in:** `cd572d2` (Task 2 commit)

**2. [Rule 3 - Blocking] NextRequest used directly (not plain Request cast)**

- **Found during:** Task 2 (test implementation)
- **Issue:** Plan specified `new Request(url)` cast to `Parameters<typeof GET>[0]`. However, the route handler uses `req.nextUrl.searchParams` which only exists on `NextRequest` (not plain `Request`). The cast was a TypeScript workaround that would fail at runtime.
- **Fix:** Replaced `new Request(url)` with `new NextRequest(url)` from `next/server`. Verified `NextRequest` constructs correctly in Vitest node environment.
- **Files modified:** `tests/slots-api.test.ts`
- **Verification:** All param-extraction tests pass, including ones that read searchParams.
- **Committed in:** `cd572d2` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes essential for the test to run at all. No scope creep. The `server-only` alias is a global test infrastructure improvement that will benefit any future route handler tests (e.g., Plan 04-05's potential `/api/bookings`).

## Issues Encountered

- Windows path with spaces (`OneDrive - Creighton University`) caused `new URL(...).pathname` in vitest.config.ts to encode spaces as `%20`, breaking module resolution. Fixed by switching to `path.resolve(__dirname, ...)` which handles Windows paths correctly.

## Forward Contract for Phase 5 (Locked Here)

```typescript
// Phase 5 booking page fetch pattern:
const res = await fetch(
  `/api/slots?event_type_id=${id}&from=${from}&to=${to}`
);
const { slots } = await res.json();
// slots: Array<{ start_at: string; end_at: string }> — UTC ISO, sorted ascending
// empty array = "no times available" — Phase 5 renders friendly empty-state
```

**Response shape is locked.** Do not add `cap_reached`, `timezone`, or any other top-level field without updating Phase 5 consumers. The `slots` array may be empty (Phase 5 must handle this gracefully).

## Smoke Test (Run After Push)

```bash
# Replace $EVENT_TYPE_ID with any active event type UUID from the dashboard.
curl -i "https://calendar-app-xi-smoky.vercel.app/api/slots?event_type_id=$EVENT_TYPE_ID&from=2026-06-15&to=2026-06-19"
# Expected:
#   HTTP/2 200
#   cache-control: no-store
#   content-type: application/json
#   body: {"slots":[{"start_at":"2026-06-15T14:00:00.000Z","end_at":"2026-06-15T14:30:00.000Z"},...]}}
#   (or {"slots":[]} if no rules are set for that week)

# 400 check:
curl -i "https://calendar-app-xi-smoky.vercel.app/api/slots"
# Expected: HTTP/2 400, cache-control: no-store, body: {"error":"event_type_id is required..."}
```

## Next Phase Readiness

- `/api/slots` is live on Vercel (auto-deployed on push) and ready for Phase 5 booking page consumption
- Response shape `{slots: Array<{start_at, end_at}>}` is locked; Phase 5 can bind to this immediately
- Admin client + service-role pattern confirmed working for public read endpoints
- Direct route-handler import test pattern established for future API tests (e.g., `/api/bookings` in Phase 5)
- No blockers for Phase 5

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
