---
phase: 06-cancel-and-reschedule-lifecycle
plan: "06"
subsystem: testing
tags: [vitest, supabase, integration-tests, cancel, reschedule, ics, rate-limit]

# Dependency graph
requires:
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: "Plans 06-01..05 — rate-limit table, ICS extension, shared cancel/reschedule functions, token routes, owner cancel surface"
  - phase: 05-public-booking-flow
    provides: "vitest.config.ts aliases for Turnstile + email-sender mocks; test infrastructure pattern"
provides:
  - "tests/helpers/booking-fixtures.ts — createConfirmedBooking() fixture factory for direct Supabase inserts with known raw tokens"
  - "tests/cancel-reschedule-api.test.ts — 12-test Phase 6 integration suite covering all 10 required scenarios"
  - "Manual QA checklist (8 steps) for Andrew to sign off before Phase 6 is marked complete"
affects:
  - "Phase 9 (Manual QA) — this plan's manual task IS the Phase 6 verification gate; Phase 9 will consolidate all manual QA"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NextRequest in buildRequest() — plain Request misses .nextUrl.origin fallback; NextRequest required for route handlers that call req.nextUrl (Phase 5 lock confirmed)"
    - "Timestamp normalization — Supabase returns '+00:00' suffix; compare via new Date().getTime() not string equality"
    - "HTML-escape-aware assertions — escapeHtml() in email templates converts apostrophes to &#39;; assert escaped form in HTML email tests"
    - "createConfirmedBooking() — bypass /api/bookings for test fixtures to control timing precisely and know raw tokens upfront"

key-files:
  created:
    - tests/helpers/booking-fixtures.ts
    - tests/cancel-reschedule-api.test.ts
  modified: []

key-decisions:
  - "Use cancelBooking() directly with actor:'owner' for tests #8a/#8b instead of cancelBookingAsOwner Server Action — next/headers cookies() throws outside Next request context; Server Action RLS wrapper coverage deferred to Manual QA step 6"
  - "buildRequest() uses NextRequest (not plain Request) — route handlers call req.nextUrl.origin fallback when NEXT_PUBLIC_APP_URL is not set; plain Request throws"
  - "Timestamp assertions use epoch ms comparison (new Date().getTime()) — Supabase may return '+00:00' suffix vs 'Z'; both are the same instant"
  - "HTML reason assertion uses HTML-escaped string — escapeHtml() in send-cancel-emails.ts converts apostrophes to &#39;"

patterns-established:
  - "Fixture factory pattern: bypass API routes for test setup when precise timing + known raw token values needed"
  - "usedRateLimitKeys tracking: record test IPs for cleanup in afterAll to prevent window pollution"
  - "console.error suppression: filter expected route error logs in test output without breaking unexpected error visibility"

# Metrics
duration: 37min
completed: 2026-04-26
---

# Phase 06 Plan 06: Integration Tests and Manual QA Summary (Auto Tasks)

**Vitest integration suite exercising all 10 Phase 6 cancel/reschedule scenarios end-to-end against live Supabase test project — 12/12 green, plus manual QA checklist awaiting Andrew's sign-off**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-04-26T02:07:09Z
- **Completed:** 2026-04-26T02:44:xx Z
- **Tasks (auto):** 2 of 2 complete
- **Files created:** 2

## Accomplishments

- `tests/helpers/booking-fixtures.ts` — shared `createConfirmedBooking()` factory that inserts bookings via `adminClient()` with known raw tokens, bypassing the API route to enable precise time control (negative `minutesAhead` for past-appointment test) and upfront token knowledge
- `tests/cancel-reschedule-api.test.ts` — 12-test `@vitest-environment node` suite covering: cancel/reschedule happy paths, token invalidation (status flip + appointment passed), reschedule slot conflict + CAS guard, rate limit sliding window (both routes), owner cancel apologetic email + reason handling, METHOD:CANCEL .ics RFC shape, email-prefetch defense read-only invariant
- Full suite: 66 tests across 7 files, all green, no Phase 1-5 regressions

## Task Commits

1. **Task 1: tests/helpers/booking-fixtures.ts** - `34554b6` (test)
2. **Task 2: tests/cancel-reschedule-api.test.ts** - `f346b33` (test)

## Files Created

- `tests/helpers/booking-fixtures.ts` — `createConfirmedBooking({ accountId, eventTypeId, minutesAhead, ... })` returning `BookingFixture` with raw tokens + hashes + times
- `tests/cancel-reschedule-api.test.ts` — 12-test Phase 6 integration suite

## Decisions Made

- **cancelBooking() directly for owner tests:** `cancelBookingAsOwner` Server Action calls `createClient()` from `next/headers`, which calls `cookies()`. In vitest+node there is no Next request context, so `cookies()` throws. Calling `cancelBooking({ actor: 'owner', ... })` directly is the correct single-source-of-truth proof (the Server Action just delegates to this function). Server Action RLS wrapper coverage moves to Manual QA step 6.
- **NextRequest in buildRequest():** The routes' `appUrl()` helper falls through to `req.nextUrl.origin` when `NEXT_PUBLIC_APP_URL` is not set in `.env.local`. Plain `Request` has no `.nextUrl` property, causing a TypeError. Using `NextRequest` matches the Phase 5 `bookings-api.test.ts` established pattern.
- **Epoch ms timestamp comparison:** Supabase timestamptz columns return `+00:00` suffix in some query paths while our fixtures use `Z` suffix. Both represent the same UTC instant but `toBe()` string comparison fails. Using `new Date(ts).getTime()` normalizes both representations.
- **HTML-escaped reason assertion:** `send-cancel-emails.ts` runs user strings through `escapeHtml()` which converts `'` to `&#39;`. Asserting the raw reason string against the rendered HTML fails. The test escapes the reason using the same rules before asserting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched buildRequest to use NextRequest instead of plain Request**
- **Found during:** Task 2 (first test run — 7/12 failing with "Cannot read properties of undefined (reading 'origin')")
- **Issue:** The routes call `req.nextUrl.origin` as fallback in `appUrl()` helper. Plain `Request` objects do not have `.nextUrl`; only `NextRequest` (Next.js wrapper) does. `NEXT_PUBLIC_APP_URL` was not set in `.env.local`, so the fallback path always triggered.
- **Fix:** Changed `buildRequest()` return type from `Request` to `NextRequest`, importing from `next/server`. Added explanatory comment documenting the Phase 5 lock this mirrors.
- **Files modified:** `tests/cancel-reschedule-api.test.ts`
- **Committed in:** `f346b33` (Task 2 commit — fix included with initial test write)

**2. [Rule 1 - Bug] Normalized timestamp assertions to epoch ms**
- **Found during:** Task 2 test run (#2, #5 failing with `'2026-05-04T02:11:55.922+00:00' to be '2026-05-04T02:11:55.922Z'`)
- **Issue:** Supabase returns `+00:00` UTC offset notation from some query paths while `new Date().toISOString()` always produces `Z`. These are the same instant but `toBe()` is strict string comparison.
- **Fix:** Wrapped both sides in `new Date(x).getTime()` for comparison.
- **Files modified:** `tests/cancel-reschedule-api.test.ts`
- **Committed in:** `f346b33`

**3. [Rule 1 - Bug] HTML-escaped apostrophe in reason assertion (#8a)**
- **Found during:** Task 2 test run (#8a failing — reason string present in HTML but as `&#39;` not `'`)
- **Issue:** `escapeHtml()` in `send-cancel-emails.ts` converts `'` to `&#39;`. The test reason string `"Schedule conflict came up — happy to reschedule when you're free."` contains a `'` that becomes `&#39;` in the rendered HTML.
- **Fix:** Applied the same `escapeHtml` transformation to the expected reason before asserting `toContain()`.
- **Files modified:** `tests/cancel-reschedule-api.test.ts`
- **Committed in:** `f346b33`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All 3 fixes were necessary for correctness. No scope creep. The test behaviors they protect are unchanged from the plan specification.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None — test infrastructure reuses existing vitest.config.ts aliases. No new env vars required.

## Next Phase Readiness

- Auto tasks complete. All 66 tests green. Phase 6 code is fully tested at the integration level.
- **Blocker:** Manual QA Task 3 (8-step checklist) requires Andrew's sign-off before Phase 6 is marked complete. See checkpoint return below.
- After manual sign-off, Phase 6 closes and Phase 7 (Widget + Branding) can begin.

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed (auto tasks): 2026-04-26*
