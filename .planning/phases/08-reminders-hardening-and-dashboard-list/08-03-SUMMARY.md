---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-03"
subsystem: infra
tags: [rate-limit, api, security, supabase, vitest, infra-04]

requires:
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: lib/rate-limit.ts (checkRateLimit), rate_limit_events table, sliding-window pattern
  - phase: 05-public-booking-flow-email-and-ics
    provides: app/api/bookings/route.ts (POST handler structure)
provides:
  - "POST /api/bookings rate-limited at 20 req / IP / 5-min sliding window (INFRA-04)"
  - "Reused Phase 6 lib/rate-limit.ts with new key prefix `bookings:`"
  - "Vitest integration test (3 cases) proving allowed/blocked/per-IP isolation"
  - "Pattern lock: any new public POST endpoint should follow this guard placement (after Zod, before Turnstile/DB)"
affects:
  - 08-04-reminders-cron (any new public endpoints introduced for cron callbacks)
  - 09-manual-qa-and-verification (live network rate-limit verification)

tech-stack:
  added: []
  patterns:
    - "Per-route key prefix on shared rate-limit table (cancel: / reschedule: / bookings:)"
    - "IP extraction hoisted to share between rate-limit and Turnstile guards"

key-files:
  created:
    - tests/bookings-rate-limit.test.ts
  modified:
    - app/api/bookings/route.ts

key-decisions:
  - "Threshold 20 req / IP / 5-min — higher than token routes (10/5min) because legitimate booking flow can produce 2-3 calls per session (slot check + submit + retry on flaky network); RESEARCH §Pattern 7"
  - "Guard placement: AFTER Zod validation (cheap input shape check first), BEFORE Turnstile + DB (rate-limit is the cheapest gate to block enumeration / flood); honors plan's `FIRST step after request parsing` instruction"
  - "Test isolation strategy: Turnstile mock=false short-circuits each call after the rate-limit increment; no event_type/account/booking DB writes in the rate-limit test"
  - "IP fallback string `unknown` is normalized to undefined before passing to verifyTurnstile (preserves Turnstile's missing-IP no-op semantics)"

patterns-established:
  - "Rate-limit guard insertion point: parse → Zod → checkRateLimit → Turnstile → DB resolve → mutate"
  - "Test cleanup convention: track keys in usedRateLimitKeys[] and DELETE FROM rate_limit_events WHERE key IN (...) in afterAll"
  - "UUID test fixtures must use valid v4 format (version digit = 4); zero-filled UUIDs fail Zod's strict .uuid() validation"

duration: ~15 min
completed: 2026-04-26
---

# Phase 08 Plan 03: Bookings Rate Limit Summary

**IP-based rate limiting on POST /api/bookings (20 req/5min window) using the existing Phase 6 lib/rate-limit.ts — zero new dependencies, INFRA-04 closed.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-27T00:35:00Z (approx)
- **Completed:** 2026-04-27T00:50:40Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)
- **Test count:** 80 → 83 (+3 new cases)

## Accomplishments

- POST /api/bookings now returns 429 + Retry-After header + `{code: "RATE_LIMITED"}` JSON body when an IP exceeds 20 requests in any rolling 5-minute window
- Rate-limit guard runs BEFORE Turnstile (cheapest fail-fast for enumeration / flood)
- Three-case Vitest integration test proves: (a) 20 calls allowed, (b) 21st blocked, (c) different IP unaffected
- Reused Phase 6's `checkRateLimit()` with key prefix `bookings:` — same DB table, same insert+count algorithm, same fail-open-on-DB-error semantics
- No new dependencies, no new tables, no Upstash/Redis introduction

## Task Commits

Both tasks combined into a single atomic commit per the plan's explicit commit instruction (the plan groups Task 1's route edit and Task 2's test under one `feat(08-03): ...` commit):

1. **Tasks 1 + 2 combined: rate-limit guard + integration test** — `9a5a573` (feat)

## Files Created/Modified

- `app/api/bookings/route.ts` — Added `checkRateLimit()` import + guard between Zod validation (step 2) and Turnstile (step 4). Hoisted IP extraction. Updated step-numbering comments + docblock (Flow / Response shapes / Rate limiting line).
- `tests/bookings-rate-limit.test.ts` — NEW. Three integration test cases mirroring `tests/cancel-reschedule-api.test.ts` Scenario 7. Uses Turnstile mock=false to short-circuit each call after the rate-limit increment, isolating the guard from DB writes.

## Decisions Made

- **Threshold: 20 req / IP / 5-min sliding window** — Plan-locked threshold from RESEARCH.md. Token routes use 10/5min; bookings is 20/5min because legitimate booking flow can produce 2-3 calls per real session.
- **Guard placement: after Zod, before Turnstile** — Plan said "FIRST step after request parsing — BEFORE Turnstile verification, BEFORE any DB query". Following the literal reading: parse → Zod → rate-limit → Turnstile → DB. Cancel route's pattern (rate-limit first, before parse) is a slight variant — bookings has a Zod step in between because the schema is more complex and worth failing-fast on shape errors before incurring a rate_limit_events insert.
- **IP unknown → undefined for Turnstile** — Rate-limit uses `"unknown"` string fallback to keep keys deterministic; Turnstile receives `undefined` instead so Cloudflare treats it as a no-op rather than rejecting the token.
- **Combined commit, not split per-task** — Plan's Task 2 action block explicitly specifies one `git commit -m "feat(08-03): rate-limit /api/bookings at 20/5min/ip + integration test"`. Honored the plan's commit instruction over the executor's default per-task pattern. Two-file diff is small and the test is the proof of the route change — they belong together.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] UUID fixture rejected by Zod's strict .uuid() validator**
- **Found during:** Task 2 first test run
- **Issue:** Initial fixture used `"00000000-0000-0000-0000-000000000001"`. Zod v4's `.uuid()` requires a valid version digit (1-5) in the third group; `0000` fails with "Invalid UUID". All three test cases failed at status 400 (VALIDATION) instead of reaching the rate-limit gate.
- **Fix:** Changed fixture to `"11111111-2222-4333-8444-555555555555"` (valid v4 format, version digit = 4, variant digit = 8). Added a code comment explaining why the UUID must be syntactically valid even though it doesn't exist in DB.
- **Files modified:** tests/bookings-rate-limit.test.ts
- **Verification:** All 3 test cases pass; full suite 83/83 green.
- **Committed in:** 9a5a573 (combined commit)

**2. [Rule 1 - Bug-adjacent / Hygiene] Updated route docblock + step-numbering comments**
- **Found during:** Task 1 implementation
- **Issue:** Existing docblock said "Rate limiting: DEFERRED to Phase 8 (INFRA-01)" which was now stale. Step-numbered comments in the handler also got off-by-one when the rate-limit step was inserted.
- **Fix:** Updated Flow comment to include step 2 (rate limit), updated Response shapes to include 429, replaced the DEFERRED line with the new threshold + reuse note. Renumbered step comments 4→5, 5→6, etc.
- **Files modified:** app/api/bookings/route.ts (comments only)
- **Verification:** Comments match runtime behavior; no logic changes.
- **Committed in:** 9a5a573 (combined commit)

---

**Total deviations:** 2 (1 blocking test fixture, 1 doc hygiene)
**Impact on plan:** Both deviations strictly required for the test to prove the rate-limit path and for the docblock to remain accurate. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `tests/bookings-api.test.ts` and `tests/cancel-reschedule-api.test.ts` (`__setTurnstileResult`, `__mockSendCalls` not exported from real modules — they exist only in the vitest.config.ts alias-resolved mocks). Unrelated to this plan; tests work at runtime via Vitest's alias resolution. Already deferred to Phase 9 ESLint backlog (per Plan 08-02 STATE.md note about 19 violations).
- `npm run build` was explicitly skipped per the orchestrator's instructions; typecheck of the production file `app/api/bookings/route.ts` passes cleanly (`npx tsc --noEmit` returns no errors for that file).

## User Setup Required

None - no external service configuration required. The rate-limit table and library already exist (Phase 6).

## Next Phase Readiness

- INFRA-04 verifiable in `npm test`. Live network verification (curl loop) deferred to Phase 9 manual QA per RESEARCH.md.
- Wave 2 plans (08-04 reminders cron, 08-05 dashboard bookings list, 08-07 dashboard search) remain unblocked.
- Pattern set: any future public POST endpoint introduced in Phase 8/9 should follow the same guard placement (parse → Zod → rate-limit → ...) with a unique key prefix.

---
*Phase: 08-reminders-hardening-and-dashboard-list*
*Completed: 2026-04-26*
