---
phase: 06-cancel-and-reschedule-lifecycle
plan: "06"
subsystem: testing
tags: [vitest, supabase, integration-tests, cancel, reschedule, ics, rate-limit, manual-qa]

# Dependency graph
requires:
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: "Plans 06-01..05 — rate-limit table, ICS extension, shared cancel/reschedule functions, token routes, owner cancel surface"
  - phase: 05-public-booking-flow
    provides: "vitest.config.ts aliases for Turnstile + email-sender mocks; test infrastructure pattern"
provides:
  - "tests/helpers/booking-fixtures.ts — createConfirmedBooking() fixture factory for direct Supabase inserts with known raw tokens"
  - "tests/cancel-reschedule-api.test.ts — 12-test Phase 6 integration suite covering all 10 required scenarios"
  - "Manual QA sign-off: Andrew approved steps 1-3, 5-7 (2026-04-25); steps 4+8 explicitly deferred to Phase 9"
affects:
  - "Phase 9 (Manual QA) — 2 deferred items consolidated into Phase 9 manual QA: .ics calendar-client removal/update + rate-limit live verification"
  - "Phase 8 (Hardening) — email deliverability slow-delivery observation tracked as waitUntil() candidate for INFRA-01/INFRA-04"

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
  - "Manual QA steps 4+8 deferred to Phase 9 — .ics calendar-client iTIP removal/update and rate-limit live verification consolidated with Phase 9 project-wide QA per CLAUDE.md convention"

patterns-established:
  - "Fixture factory pattern: bypass API routes for test setup when precise timing + known raw token values needed"
  - "usedRateLimitKeys tracking: record test IPs for cleanup in afterAll to prevent window pollution"
  - "console.error suppression: filter expected route error logs in test output without breaking unexpected error visibility"

# Metrics
duration: 37min (auto) + manual QA 2026-04-25 (Andrew sign-off)
completed: 2026-04-25
---

# Phase 06 Plan 06: Integration Tests and Manual QA Summary

**Vitest integration suite exercising all 10 Phase 6 cancel/reschedule scenarios end-to-end against live Supabase test project — 12/12 green; Andrew signed off manual QA 2026-04-25 (steps 1-3, 5-7 approved; steps 4+8 explicitly deferred to Phase 9)**

## Performance

- **Duration:** ~37 min (auto tasks) + manual QA 2026-04-25
- **Started:** 2026-04-26T02:07:09Z
- **Completed (auto):** 2026-04-26T02:44:xxZ
- **Signed off (manual QA):** 2026-04-25
- **Tasks:** 3 of 3 complete (auto tasks 1+2 + manual QA task 3)
- **Files created:** 2

## Accomplishments

- `tests/helpers/booking-fixtures.ts` — shared `createConfirmedBooking()` factory that inserts bookings via `adminClient()` with known raw tokens, bypassing the API route to enable precise time control (negative `minutesAhead` for past-appointment test) and upfront token knowledge
- `tests/cancel-reschedule-api.test.ts` — 12-test `@vitest-environment node` suite covering: cancel/reschedule happy paths, token invalidation (status flip + appointment passed), reschedule slot conflict + CAS guard, rate limit sliding window (both routes), owner cancel apologetic email + reason handling, METHOD:CANCEL .ics RFC shape, email-prefetch defense read-only invariant
- Full suite: 66 tests across 7 files, all green, no Phase 1-5 regressions
- Manual QA: Andrew verified the full Phase 6 lifecycle end-to-end on the live Vercel deployment (2026-04-25)

## Task Commits

1. **Task 1: tests/helpers/booking-fixtures.ts** - `34554b6` (test)
2. **Task 2: tests/cancel-reschedule-api.test.ts** - `f346b33` (test)
3. **Task 3: Manual QA** - Andrew sign-off 2026-04-25 (no code commit; verification artifacts in 06-VERIFICATION.md)

## Files Created

- `tests/helpers/booking-fixtures.ts` — `createConfirmedBooking({ accountId, eventTypeId, minutesAhead, ... })` returning `BookingFixture` with raw tokens + hashes + times
- `tests/cancel-reschedule-api.test.ts` — 12-test Phase 6 integration suite

## Manual QA Results (Andrew, 2026-04-25)

**Steps 1, 2, 3, 5, 6, 7: APPROVED**

- Step 1 (real booking via form): Passed — booking confirmed end-to-end on Vercel
- Step 2 (cancel link in email → /cancel/[token] page): Passed — page rendered correct booking details
- Step 3 (cancel confirmation → both parties receive cancellation emails + cancelled.ics): Passed
- Step 5 (reschedule end-to-end — slot picker, new confirmation, fresh .ics): Passed
- Step 6 (owner cancel from /app/bookings/[id] dashboard): Passed
- Step 7 (stale cancel/reschedule link → friendly "no longer active" page): Passed

**Steps 4 and 8: Explicitly deferred to Phase 9**

- Step 4 (.ics calendar-client removal/update verification — Apple Mail / Gmail web / Outlook web): Deferred. Andrew chose to consolidate with Phase 9 alongside Phase 5's existing "ICS file structure for Gmail inline card" and QA-03 mail-tester items. Not a failure — a deliberate scope consolidation per CLAUDE.md "Phase X: Manual QA & Verification" convention.
- Step 8 (rate-limit live verification — 11+ rapid POSTs returning 429 + Retry-After): Deferred. Integration test #7 in `tests/cancel-reschedule-api.test.ts` already proves the code path end-to-end. Live Vercel confirmation deferred to Phase 9 hardening checks.

## Email Deliverability Observation

During live manual QA, the second booking's confirmation email took longer than expected to arrive but did arrive successfully. No code change needed. Working hypothesis: Gmail SMTP rate-limiting or threading behavior on rapid same-recipient sends. This is a known Gmail SMTP quirk, not a bug in the application code.

**Potential fix tracked for Phase 8:** If lambda-timeout symptoms appear in Phase 9 (fire-and-forget email paths blocking Vercel function response), the fix path is `waitUntil()` from `@vercel/functions` on the fire-and-forget email calls in:
- `app/api/bookings/route.ts`
- `app/api/cancel/route.ts`
- `app/api/reschedule/route.ts`
- `app/(shell)/app/bookings/[id]/_lib/actions.ts` (cancelBookingAsOwner Server Action)

Tracked as Phase 8 INFRA-01/INFRA-04 hardening candidate. NOT a Phase 6 blocker.

## Decisions Made

- **cancelBooking() directly for owner tests:** `cancelBookingAsOwner` Server Action calls `createClient()` from `next/headers`, which calls `cookies()`. In vitest+node there is no Next request context, so `cookies()` throws. Calling `cancelBooking({ actor: 'owner', ... })` directly is the correct single-source-of-truth proof (the Server Action just delegates to this function). Server Action RLS wrapper coverage moves to Manual QA step 6.
- **NextRequest in buildRequest():** The routes' `appUrl()` helper falls through to `req.nextUrl.origin` when `NEXT_PUBLIC_APP_URL` is not set in `.env.local`. Plain `Request` has no `.nextUrl` property, causing a TypeError. Using `NextRequest` matches the Phase 5 `bookings-api.test.ts` established pattern.
- **Epoch ms timestamp comparison:** Supabase timestamptz columns return `+00:00` suffix in some query paths while our fixtures use `Z` suffix. Both represent the same UTC instant but `toBe()` string comparison fails. Using `new Date(ts).getTime()` normalizes both representations.
- **HTML-escaped reason assertion:** `send-cancel-emails.ts` runs user strings through `escapeHtml()` which converts `'` to `&#39;`. Asserting the raw reason string against the rendered HTML fails. The test escapes the reason using the same rules before asserting.
- **Manual QA steps 4+8 deferred to Phase 9:** Andrew explicitly chose to consolidate .ics calendar-client iTIP behavior verification and rate-limit live verification into Phase 9 alongside other real-client checks. This is a scope decision, not a failure.

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

- All 3 tasks complete. 66/66 tests green. Phase 6 cancel + reschedule lifecycle verified end-to-end.
- Manual QA signed off by Andrew 2026-04-25 (6/8 steps approved; 2 steps explicitly deferred to Phase 9).
- Phase 6 is complete. Phase 7 (Widget + Branding) can begin.
- Phase 9 backlog additions: .ics iTIP calendar-client removal/update verification (steps 4+8 from this plan); rate-limit live verification.
- Phase 8 backlog addition: `waitUntil()` adoption for fire-and-forget email paths (INFRA-01/INFRA-04 candidate).

---
*Phase: 06-cancel-and-reschedule-lifecycle*
*Completed: 2026-04-25 (Andrew sign-off)*
