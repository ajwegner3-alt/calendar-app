---
phase: 05-public-booking-flow
plan: "08"
subsystem: testing
tags: [vitest, integration-tests, supabase, turnstile, email, race-condition, partial-unique-index]

# Dependency graph
requires:
  - phase: 05-public-booking-flow plan 05
    provides: POST /api/bookings route handler with full validation pipeline
  - phase: 05-public-booking-flow plan 03
    provides: lib/turnstile.ts (verifyTurnstile) + lib/email/send-booking-emails.ts orchestrator
  - phase: 05-public-booking-flow plan 02
    provides: lib/email-sender vendored Gmail singleton (sendEmail)
  - phase: 04-availability-engine plan 06
    provides: vitest.config.ts node env + server-only alias pattern + NextRequest direct construction pattern

provides:
  - "9-test integration suite for POST /api/bookings (4 describe blocks)"
  - "Vitest mock for lib/turnstile: __setTurnstileResult() per-test control, no Cloudflare network calls"
  - "Vitest mock for lib/email-sender: sendEmail() spy via __mockSendCalls[], no SMTP calls in CI"
  - "vitest.config.ts aliases for @/lib/turnstile and @/lib/email-sender via path.resolve"
  - "Race-safe 409 end-to-end proof: bookings_no_double_book partial unique index wired through route handler"

affects:
  - Phase 6 (cancel/reschedule routes) — token hash format confirmed (SHA-256 hex, 64 chars)
  - Phase 8 (hardening) — test pattern reusable for rate-limiting integration tests
  - Phase 9 (manual QA) — machine-verified BOOK-05 (race-safe), BOOK-07 (Turnstile), EMAIL-01..04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vitest.config.ts resolve.alias for module mocks (path.resolve, NOT new URL().pathname — Windows spaces encode as %20)"
    - "Alias-level mock interception (NOT vi.mock hoisting) — avoids hoisting headaches"
    - "Fire-and-forget email test: 100ms setTimeout for microtask settlement, then assert __mockSendCalls.length >= 1"
    - "startMinuteOffset pattern for non-colliding slots across describe blocks"

key-files:
  created:
    - tests/bookings-api.test.ts
    - tests/__mocks__/turnstile.ts
    - tests/__mocks__/email-sender.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Mock @/lib/email-sender at alias level (not send-booking-emails orchestrator) — captures sendEmail() calls from both send-booking-confirmation.ts and send-owner-notification.ts with one spy"
  - "Assert __mockSendCalls.length >= 1 (not == 2) — owner_email may be null in CI env; booker confirmation is guaranteed; owner notification is conditional on account.owner_email"
  - "Use plain Request(+NextRequest cast) for POST bodies (not NextRequest URL-only constructor) — NextRequest accepts RequestInit with body in node env"
  - "Test event_type seeded on nsi (not nsi-test) — POST /api/bookings resolves account by event_type.account_id, so the event_type must belong to an account with valid slug/name/timezone for redirectTo assertion"
  - "[Rule 1 - Bug] Removed duplicate static metadata export from confirmed page — Next.js App Router forbids exporting both metadata and generateMetadata from same route file; linter auto-fixed on stash-pop"

patterns-established:
  - "Route-handler integration test pattern: import POST directly, construct NextRequest, call POST(req), await res.json()"
  - "__setTurnstileResult(true) + __resetMockSendCalls() in beforeEach — clean state for every test case"
  - "insertedBookingIds tracking array + afterAll cleanup — no orphan bookings left in DB after test run"

# Metrics
duration: 10min
completed: "2026-04-25"
---

# Phase 5 Plan 08: Bookings API Integration Tests Summary

**9-test Vitest integration suite proving POST /api/bookings wiring end-to-end: race-safe 409 via partial unique index, Turnstile mock control, email spy, all 8 plan coverage cases green.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-25T22:33:10Z
- **Completed:** 2026-04-25T22:43:16Z
- **Tasks:** 2 of 2
- **Files modified:** 4

## Accomplishments

- Implemented all 8 plan coverage cases (a)-(h) across 4 describe blocks, 9 tests
- Proved the `bookings_no_double_book` partial unique index wires correctly through the route handler: first POST 201, second identical `(event_type_id, start_at)` payload returns 409 `code: SLOT_TAKEN` — TRUE end-to-end DB constraint test
- Mocked Turnstile + email-sender at vitest.config.ts alias level so tests are deterministic and impose zero external API quota in CI
- Full suite 54/54 passing — zero regressions on Phase 1-4 (45-test baseline) + 9 new cases

## Task Commits

1. **Task 1: Turnstile + email-sender mocks + vitest config aliases** - `1e280aa` (test)
2. **Task 2: bookings-api.test.ts integration suite** - `44df424` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/__mocks__/turnstile.ts` — Vitest mock for `@/lib/turnstile`; `verifyTurnstile()` returns controllable `__result` (default true); `__setTurnstileResult(v)` for per-test control
- `tests/__mocks__/email-sender.ts` — Vitest mock for `@/lib/email-sender`; `sendEmail()` spy capturing `EmailOptions` in `__mockSendCalls[]`; `__resetMockSendCalls()` for `beforeEach`; re-exports stubs for `escapeHtml`, `stripHtml`, `createEmailClient`
- `vitest.config.ts` — Added `@/lib/turnstile` and `@/lib/email-sender` aliases via `path.resolve(__dirname, ...)` (Phase 4 Windows lock)
- `tests/bookings-api.test.ts` — 9-test integration suite (4 describe blocks; see coverage below)

## Test Coverage (per describe block)

| Describe block | Tests | Coverage cases |
|---|---|---|
| Input validation | 4 | (b) BAD_REQUEST, (c) VALIDATION×3 |
| Turnstile gate | 1 | (d) 403 TURNSTILE |
| Event type resolution | 1 | (e) 404 NOT_FOUND |
| Happy path | 1 | (a) 201 + redirectTo + DB row + emails + (g) no-store + (h) no raw tokens |
| Race-safe 409 | 2 | (f) SLOT_TAKEN + (g) no-store belt-and-suspenders |

**Total:** 9 tests, all passing. Full suite: 54/54.

## Mock Strategy

**Chosen approach:** vitest.config.ts `resolve.alias` interception (NOT `vi.mock()` calls inside test files).

Rationale:
- `vi.mock()` requires hoisting and can have module-load-order issues with ESM
- Alias-level interception is simpler: any module that imports `@/lib/turnstile` or `@/lib/email-sender` gets the mock automatically
- `@/lib/email-sender` mock intercepts `sendEmail()` called deep in `send-booking-confirmation.ts` and `send-owner-notification.ts` — the full orchestrator chain runs (no orchestrator mock), proving `sendBookingEmails` → both senders → `sendEmail` wiring

**`@/lib/email-sender` alias scope:** The alias matches directory-level imports only. Subdirectory imports like `@/lib/email-sender/types` resolve normally through tsconfig paths (types.ts has no `server-only`; no mock needed).

## Seed Data Pattern for nsi Event Type

Tests seed a temp `event_type` on the real `nsi` account (NOT `nsi-test`) because:
- `POST /api/bookings` resolves account by `event_type.account_id`
- `redirectTo` is `/${account.slug}/${eventType.slug}/confirmed/${id}` — needs a valid account slug for assertion
- `nsi` account has `owner_email`, `timezone`, `name` all correctly populated from Phase 5 Plan 01

`beforeAll` inserts with slug `phase5-bookings-test`; `afterAll` deletes all `insertedBookingIds` then hard-deletes the event_type. Any test producing a 201 pushes `body.bookingId` to `insertedBookingIds`.

## Race-Safe Test Approach

```
POST payload (offset=45min) → first.status === 201    ← INSERT succeeds
POST same payload (different bookerEmail) → second.status === 409
  ← bookings_no_double_book partial unique index raises Postgres 23505
  ← route handler: insertError.code === "23505" → return 409 SLOT_TAKEN
```

This is a TRUE end-to-end DB constraint test. The race window is not simulated — both requests hit the real Supabase project sequentially within the same test. Concurrent parallel test is not needed here because the unique index fires on ANY second insert with matching `(event_type_id, start_at, status='confirmed')`, regardless of timing.

## Raw Token Assertion

The `(h)` case asserts:
- `body.cancelToken === undefined`
- `body.rescheduleToken === undefined`
- `JSON.stringify(body)` does not match `/cancel_?token/i` or `/reschedule_?token/i`

The 201 response shape is `{ bookingId, redirectTo }` only. Raw tokens flow exclusively through `sendBookingEmails()` → email body. Token hashes are in the DB row (`cancel_token_hash`, `reschedule_token_hash` — 64-char SHA-256 hex, verified via DB query).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate static `metadata` export from confirmed booking page**

- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` exported both `export const metadata: Metadata = {...}` (static) and `export async function generateMetadata(...)` (dynamic). Next.js App Router forbids both in the same route file — build failed with "metadata and generateMetadata cannot be exported at the same time".
- **Fix:** The linter removed the static `metadata` export automatically on `git stash pop`. `generateMetadata` retained — it already includes `robots: { index: false, follow: false }` on all branches (CONTEXT decision #9 preserved).
- **Files modified:** `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx`
- **Verification:** `npm run build` exits 0 after fix
- **Committed in:** Pre-existing uncommitted file; linter-fixed; included in plan 05-08 final commit

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Build was broken by pre-existing code from Plan 05-07 (confirmed page not yet committed). Fixed inline; no scope change to test plan.

## Issues Encountered

- **"Another next build process is still running"** — Turbopack left a lock from a prior killed build. Resolved by running `npx kill-port 3000` to clear the lingering process, then retrying `npm run build`.

## Next Phase Readiness

- Phase 5 test coverage complete: BOOK-05 (race-safe), BOOK-07 (Turnstile), EMAIL-01..04 (email orchestrator fires) all machine-verified
- Plan 05-07 (confirmation page) may need a final commit/push — the confirmed page files are untracked or partially committed; confirm git status before starting Phase 5 verification
- Phase 6 (cancel/reschedule) can now build on the confirmed token hash format (SHA-256, 64-char hex) and locked cancel/reschedule URL format (`/cancel/:rawToken`, `/reschedule/:rawToken`)
- No blockers for Phase 5 final verification or Phase 6 planning

---
*Phase: 05-public-booking-flow*
*Completed: 2026-04-25*
