---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-03"
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/bookings/route.ts
  - tests/bookings-rate-limit.test.ts
autonomous: true

must_haves:
  truths:
    - "POST /api/bookings is rate-limited at 20 requests / IP / 5-minute sliding window"
    - "21st request from same IP within 5 minutes returns 429 with Retry-After header and {error, code: 'RATE_LIMITED'} JSON body"
    - "Rate limit check runs BEFORE Turnstile verification (cheaper to fail-fast)"
    - "Token-routes pattern (Phase 6) is preserved — same checkRateLimit function, different key prefix"
    - "Integration test proves the 429 path under simulated 21st-call pressure"
  artifacts:
    - path: "app/api/bookings/route.ts"
      provides: "POST handler with checkRateLimit() guard"
      contains: "checkRateLimit"
    - path: "tests/bookings-rate-limit.test.ts"
      provides: "Vitest integration covering allowed + blocked paths"
      contains: "RATE_LIMITED"
  key_links:
    - from: "app/api/bookings/route.ts"
      to: "lib/rate-limit.ts"
      via: "checkRateLimit('bookings:' + ip, 20, 5 * 60 * 1000)"
      pattern: "checkRateLimit\\(`bookings:"
    - from: "app/api/bookings/route.ts"
      to: "rate_limit_events table"
      via: "lib/rate-limit.ts insert+count"
      pattern: "RATE_LIMITED"
---

<objective>
Add IP-based rate limiting to `POST /api/bookings` using the existing Phase 6 `checkRateLimit()` library, satisfying INFRA-04.

Purpose: The booking endpoint is the most public-facing write path in the app. Without rate limiting, a single bad actor or buggy widget can flood the DB with bookings or attempt slot enumeration. Reusing the Phase 6 limiter means zero new dependencies and consistent operational behavior with cancel/reschedule routes.

Output: One updated route handler + one new integration test. Zero new dependencies.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@lib/rate-limit.ts
@app/api/bookings/route.ts
@app/api/cancel/route.ts
@tests/cancel-reschedule-api.test.ts
@tests/bookings-api.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add checkRateLimit guard to POST /api/bookings</name>
  <files>app/api/bookings/route.ts</files>
  <action>
    1. Read `app/api/bookings/route.ts` and `app/api/cancel/route.ts` (latter is the canonical pattern from Phase 6).

    2. In the POST handler of `/api/bookings/route.ts`, add the rate-limit check as the FIRST step after request parsing — BEFORE Turnstile verification, BEFORE any DB query. RESEARCH.md Pattern 7 documents this exact insertion point.

    3. Implementation:
       ```typescript
       import { checkRateLimit } from "@/lib/rate-limit";

       // Inside POST handler, immediately after extracting any body fields you need
       // for logging but BEFORE Turnstile / DB:
       const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
         ?? req.headers.get("x-real-ip")
         ?? "unknown";

       const rl = await checkRateLimit(`bookings:${ip}`, 20, 5 * 60 * 1000);
       if (!rl.allowed) {
         return NextResponse.json(
           { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
           {
             status: 429,
             headers: {
               ...NO_STORE,
               "Retry-After": String(rl.retryAfterSeconds),
             },
           },
         );
       }
       ```

       Threshold rationale (RESEARCH.md):
       - 20 req / 5min / IP — Phase 6 token routes use 10/5min for cancel/reschedule (low-frequency). Booking flow is higher-frequency legitimate traffic (slot check + submit can produce 2-3 calls per real session). 20/5min blocks bot enumeration while tolerating real users.
       - Same `rate_limit_events` table; same `checkRateLimit` signature; key prefix `bookings:` distinguishes from `cancel:` / `reschedule:`.

    4. Confirm `NO_STORE` constant is already imported (it should be — Phase 6 cancel route uses it). If not present in this file, define inline:
       ```typescript
       const NO_STORE = { "Cache-Control": "no-store, no-transform" } as const;
       ```
       OR import from wherever the cancel route imports it. Be consistent with the existing pattern.

    5. Do NOT change Turnstile, Supabase queries, race-guard logic, or email send code paths. The rate-limit guard is a single block inserted near the top of the handler.

    6. Do NOT log the IP or rate-limit decision in plain console — match the existing logging convention used in the cancel route (likely structured `console.error` only on failure paths).

    Anti-patterns to avoid:
    - Do NOT add a NEW rate-limit table.
    - Do NOT use an in-memory Map (lambda cold starts make it useless).
    - Do NOT introduce Upstash Redis or any external dep — RESEARCH.md is explicit: reuse `lib/rate-limit.ts`.
  </action>
  <verify>
    `grep -n "checkRateLimit" app/api/bookings/route.ts` shows at least one match.
    `grep -n "bookings:" app/api/bookings/route.ts` shows the key prefix.
    `grep -n "RATE_LIMITED" app/api/bookings/route.ts` shows the response code.
    Manual code read: rate-limit check appears BEFORE Turnstile verification and BEFORE any Supabase query.
    Build succeeds: `npm run build` (or just typecheck if build is slow).
  </verify>
  <done>
    POST /api/bookings checks rate limit before doing anything expensive. 21st request from same IP within 5 minutes returns 429 with proper headers and JSON body.
  </done>
</task>

<task type="auto">
  <name>Task 2: Vitest integration test for /api/bookings rate limit</name>
  <files>tests/bookings-rate-limit.test.ts</files>
  <action>
    Create a new test file `tests/bookings-rate-limit.test.ts` modeled on the existing `tests/cancel-reschedule-api.test.ts` rate-limit test (which proves the Phase 6 cancel route's 11th-call → 429 path).

    Required test cases:

    1. **Allowed under threshold**: First call from a fresh IP succeeds (or fails for a non-rate-limit reason). Assert that 20 successive calls within the window do NOT trigger 429. Use a deterministic IP via `x-forwarded-for` header in the mock request.

    2. **Blocked at 21st call**: After 20 successful (or non-rate-limited) calls, the 21st call MUST return 429 with:
       - `response.status === 429`
       - JSON body has `code: "RATE_LIMITED"`
       - `Retry-After` header is a positive integer string

    3. **Different IP not affected**: Make the 21st call with a different `x-forwarded-for` value; it must NOT 429. Proves the key is per-IP.

    Implementation strategy (matches existing test patterns):
    - Mock `lib/rate-limit.ts`'s `checkRateLimit` directly OR clean the `rate_limit_events` table between tests via the test helpers.
    - Look at `tests/cancel-reschedule-api.test.ts` for the exact mocking style — copy that pattern verbatim and adapt the route import to `app/api/bookings/route.ts` and the key prefix to `bookings:`.
    - The test does NOT need to drive the full booking flow to success — it just needs to prove that the rate-limit guard short-circuits BEFORE any DB activity, so use the mocked rate-limit response and assert the 429 path.
    - Use the existing `tests/__mocks__` and `tests/helpers/` if they have request-builder utilities; reuse them.

    Skip these in v1 (deferred to Phase 9 manual QA):
    - Live network rate-limit verification (Phase 9 backlog already flags this — STATE.md line 239).
    - Window-expiry behavior (already tested implicitly by Phase 6 test).

    Do NOT use real Supabase calls — `tests/setup.ts` mocks the supabase client. Stay consistent with the existing harness.

    Run the test:
    ```bash
    npm test -- bookings-rate-limit
    ```
    All cases must pass before commit.

    Commit:
    ```bash
    git add app/api/bookings/route.ts tests/bookings-rate-limit.test.ts
    git commit -m "feat(08-03): rate-limit /api/bookings at 20/5min/ip + integration test"
    ```
  </action>
  <verify>
    `npm test -- bookings-rate-limit` passes all assertions.
    `npm test` full suite is still green (no regressions).
    `grep -n "RATE_LIMITED" tests/bookings-rate-limit.test.ts` shows assertion present.
  </verify>
  <done>
    Three test cases (allowed under threshold, blocked at 21st, different IP not affected) all pass. INFRA-04 is verifiable via `npm test`.
  </done>
</task>

</tasks>

<verification>
1. `grep -n "checkRateLimit" app/api/bookings/route.ts` returns the rate-limit guard.
2. `npm test -- bookings-rate-limit` passes.
3. `npm test` full suite green.
4. `npm run build` succeeds.
</verification>

<success_criteria>
- INFRA-04 verifiable: 21st rapid call to POST /api/bookings from same IP returns 429 with Retry-After.
- Different-IP control case: rate limit is per-IP, not global.
- Existing 80 tests still pass.
- New test file follows the established Phase 6 mocking pattern.
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-03-SUMMARY.md` documenting:
- Threshold chosen (20/5min) and source (RESEARCH.md)
- Insertion point in POST handler (before Turnstile, line N)
- Test cases written and pass count
- Anything deferred to Phase 9 manual QA
</output>
