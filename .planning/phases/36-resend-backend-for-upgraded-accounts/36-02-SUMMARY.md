---
phase: 36-resend-backend-for-upgraded-accounts
plan: 02
subsystem: email
tags: [resend, fetch, http, email-provider, vitest, mocks, alias]

# Dependency graph
requires:
  - phase: 36-resend-backend-for-upgraded-accounts
    plan: 01
    provides: "EmailProvider union extension (resend literal), schema migration for accounts.email_provider column"
provides:
  - "lib/email-sender/providers/resend.ts — Resend HTTP provider implementing EmailClient interface"
  - "RESEND_REFUSED_SEND_ERROR_PREFIX = 'resend_send_refused' exported constant"
  - "9-case unit test suite for all send branches (happy path, missing key, 422/429/500, network throw, replyTo override, attachment snake_case)"
  - "tests/__mocks__/resend-provider.ts stub for integration tests (Plan 03 ready)"
  - "vitest.config.ts exact-regex alias for @/lib/email-sender/providers/resend (LD-14)"
  - "RESEND_REFUSED_SEND_ERROR_PREFIX + isRefusedSend helper in account-sender mock (Plan 03 dual-prefix testable)"
affects:
  - 36-03 (factory routing — will import createResendClient and activate the new alias)
  - lib/email/send-booking-emails.ts (Plan 03 dual-prefix fix with isRefusedSend)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw fetch to Resend HTTP API (no resend npm package) — mirrors gmail-oauth.ts shape"
    - "Lazy RESEND_API_KEY read inside send() body — matches Phase 34/35 getKey()/fetchGoogleAccessToken pattern"
    - "Never-throws contract: all errors return { success:false, error: prefix:reason }"
    - "snake_case Resend wire fields: reply_to (not replyTo), content_type (not contentType)"
    - "Exact-regex vitest alias (LD-14) prevents prefix-bleed for new provider sub-path"

key-files:
  created:
    - lib/email-sender/providers/resend.ts
    - tests/resend-provider.test.ts
    - tests/__mocks__/resend-provider.ts
  modified:
    - tests/__mocks__/account-sender.ts
    - vitest.config.ts

key-decisions:
  - "Raw fetch over resend npm package — avoids dependency, matches project pattern, full control over wire format"
  - "Lazy RESEND_API_KEY read inside send() body (not module scope) — required for Vitest per-test process.env isolation"
  - "Factory owns From header (fromName + fromAddress) — callers cannot override, matches Gmail-OAuth parity"
  - "config.replyToAddress is the fallback; options.replyTo wins when caller provides it"
  - "Buffer content converted to base64 string before sending — Resend's wire format requires base64 string, not Buffer"
  - "Alias added now (dormant until Plan 03) to pre-empt prefix-bleed risk per LD-14"

patterns-established:
  - "RESEND_REFUSED_SEND_ERROR_PREFIX exported constant: 'resend_send_refused' — sibling of REFUSED_SEND_ERROR_PREFIX in account-sender.ts"
  - "isRefusedSend(error?) helper in account-sender mock for dual-prefix branching (Plan 03 orchestrator fix)"
  - "resend-provider alias pattern: exact regex /^@\\/lib\\/email-sender\\/providers\\/resend$/ mirrors account-sender alias"

# Metrics
duration: 3min
completed: 2026-05-08
---

# Phase 36 Plan 02: Resend Provider Summary

**Resend HTTP provider (`createResendClient`) built with raw fetch, lazy env-var read, never-throws contract, snake_case wire fields, 9 unit tests, and LD-14 vitest alias pre-registered for Plan 03 integration testing**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-08T12:31:09Z
- **Completed:** 2026-05-08T12:34:21Z
- **Tasks:** 4
- **Files modified:** 5 (1 created provider, 1 created test, 1 created mock stub, 1 mock updated, 1 config updated)

## Accomplishments

- Implemented `createResendClient(config)` as a leaf `EmailClient` provider, POSTing to `https://api.resend.com/emails` with Bearer token auth — no `resend` npm package, pure `fetch`
- 9 unit tests covering every code branch: happy path with body/header/field assertions, missing API key guard, HTTP 422/429/500 refusals, network throw, `replyTo` caller override, attachment `contentType`→`content_type` snake_case mapping with Buffer→base64 conversion, and exported constant value
- Exported `RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused"` so Plan 03's orchestrator can use `isRefusedSend()` for dual-prefix soft-fail detection
- `tests/__mocks__/account-sender.ts` updated with `RESEND_REFUSED_SEND_ERROR_PREFIX` constant and `isRefusedSend()` helper so Plan 03 integration tests branching on the prefix work through the alias mock
- `tests/__mocks__/resend-provider.ts` stub + exact-regex vitest alias pre-registered for Plan 03's `getSenderForAccount` factory (dormant until Plan 03 wires the import)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement createResendClient provider** - `0d4a1a4` (feat)
2. **Task 2: Unit tests for createResendClient with mocked fetch** - `039ef86` (test)
3. **Task 3: Update account-sender mock to export RESEND_REFUSED_SEND_ERROR_PREFIX** - `d30a675` (chore)
4. **Task 4: Add Vitest alias entry for the new resend provider sub-path** - `03b88d6` (chore)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `lib/email-sender/providers/resend.ts` — Resend HTTP provider; exports `createResendClient`, `RESEND_REFUSED_SEND_ERROR_PREFIX`, `ResendConfig` interface
- `tests/resend-provider.test.ts` — 9-case unit test suite; imports real module via relative path, mocks `globalThis.fetch`
- `tests/__mocks__/resend-provider.ts` — Vitest alias stub; pushes to shared `__mockSendCalls`, used by Plan 03 integration tests
- `tests/__mocks__/account-sender.ts` — Added `RESEND_REFUSED_SEND_ERROR_PREFIX` constant and `isRefusedSend()` helper
- `vitest.config.ts` — Added exact-regex alias `^@\/lib\/email-sender\/providers\/resend$` → resend-provider stub

## Decisions Made

- **Raw fetch over resend npm package:** Consistent with project pattern (gmail-oauth.ts also uses raw fetch). Full control over wire format, zero new dependencies.
- **Lazy env-var read:** `process.env.RESEND_API_KEY` read inside `send()` body, not at module top level. Required so `beforeEach(() => { process.env.RESEND_API_KEY = "..." })` in tests propagates correctly. Matches Phase 34 `getKey()` and Phase 35 `fetchGoogleAccessToken` precedents.
- **Factory owns From header:** `fromName + fromAddress` set at factory-creation time; callers cannot supply a different From. Parity with Gmail-OAuth contract.
- **`config.replyToAddress` as fallback, `options.replyTo` wins:** Standard override pattern. Resend wire field is `reply_to` (snake_case).
- **Buffer → base64 string for attachment content:** Resend's REST API accepts base64 strings, not Buffers. `Buffer.isBuffer()` guard handles both cases without caller changes.
- **Alias pre-registered (dormant):** Per LD-14, added the alias now so Plan 03 can freely import `createResendClient` from the `@/` specifier without risking prefix-bleed onto other sub-paths.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing baseline tsc errors (`__mockSendCalls`, `__setTurnstileResult`, implicit `any` in test files) confirmed unchanged. Pre-existing test failures in `bookings-api.test.ts` and `slots-api.test.ts` (remote Supabase fixture/timing issues) are the same failures noted in STATE.md — no regressions introduced.

## User Setup Required

None — framework-only ship. PREREQ-03 (Resend account + DNS verification + API key) still deferred. The provider is exercised only by mocked-fetch unit tests in this phase.

## Next Phase Readiness

- **Plan 03 (factory routing)** is fully unblocked: `createResendClient` is implemented, `ResendConfig` is defined, the vitest alias is in place, the mock exports `RESEND_REFUSED_SEND_ERROR_PREFIX` and `isRefusedSend`. Plan 03 extends `getSenderForAccount` to branch on `accounts.email_provider = 'resend'` and call `createResendClient` instead of `createGmailOAuthClient`.
- Forward note: `lib/email/send-booking-emails.ts` will be updated in Plan 03 to use `isRefusedSend(result.error)` for dual-prefix soft-fail detection (covers both `oauth_send_refused:` and `resend_send_refused:` paths).
- PREREQ-03 (Resend account + NSI domain DNS verification + `RESEND_API_KEY` in Vercel) still blocks live Resend sends but does not block Plans 03-06 (all can be coded and mock-tested).

---
*Phase: 36-resend-backend-for-upgraded-accounts*
*Completed: 2026-05-08*
