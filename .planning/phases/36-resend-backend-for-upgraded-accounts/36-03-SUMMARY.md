---
phase: 36-resend-backend-for-upgraded-accounts
plan: 03
subsystem: email
tags: [resend, email-provider, quota-guard, factory-routing, vitest, mocks]

# Dependency graph
requires:
  - phase: 36-01
    provides: email_provider + resend_status columns on accounts table; provider column on email_send_log
  - phase: 36-02
    provides: createResendClient + RESEND_REFUSED_SEND_ERROR_PREFIX from providers/resend.ts
  - phase: 35-03
    provides: getSenderForAccount factory + REFUSED_SEND_ERROR_PREFIX + per-account quota isolation
  - phase: 35-04
    provides: send-booking-emails.ts orchestrator with OAuth refusal flag semantics

provides:
  - getSenderForAccount routes on accounts.email_provider (resend → createResendClient; gmail → existing OAuth)
  - isRefusedSend(error?) helper: true for both oauth_send_refused and resend_send_refused prefixes
  - RESEND_REFUSED_SEND_ERROR_PREFIX re-exported from account-sender (single import location)
  - resend_status=suspended → refused sender with resend_send_refused: account_suspended (no OAuth lookup)
  - Resend wins over present account_oauth_credentials (CONTEXT decision enforced)
  - warnIfResendAbuseThresholdCrossed(): fire-and-forget 5000/day soft warn-log
  - checkAndConsumeQuota skips 200/day cap for Resend accounts; logs with provider='resend'|'gmail'
  - send-booking-emails.ts uses isRefusedSend so Resend refusals fire confirmation_email_sent=false (OQ-2)
  - FUTURE_DIRECTIONS.md: PREREQ-03 DNS setup, RESEND_API_KEY Vercel env var, live integration test recipe

affects:
  - phase: 37-upgrade-flow (consumes createResendClient directly; bypasses per-account quota guard — LD-05 bootstrap-safe path)
  - phase: 36-verification (should verify Resend routing branch via SQL flip + live test)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OQ-1 quota bypass centralized in checkAndConsumeQuota via internal accounts SELECT — zero leaf-caller changes needed"
    - "OQ-2 isRefusedSend helper: shared prefix-agnostic predicate; future providers only update this one function"
    - "Resend wins over Gmail credential: CONTEXT decision enforced at getSenderForAccount — flip email_provider='resend' is one SQL UPDATE"
    - "Fire-and-forget abuse threshold: void warnIfResendAbuseThresholdCrossed(accountId) — advisory check never blocks send path"
    - "nil-UUID sentinel falls through: maybeSingle returns null → provider defaults to 'gmail' — correct for system-level signup sends"
    - "Test mock maybeSingle pattern: add maybeSingle() to eq() chain returning {data:null, error:null} for Gmail-path-defaulting test stubs"

key-files:
  created: []
  modified:
    - lib/email-sender/account-sender.ts
    - lib/email-sender/quota-guard.ts
    - lib/email/send-booking-emails.ts
    - tests/account-sender.test.ts
    - tests/quota-guard.test.ts
    - tests/email-quota-refuse.test.ts
    - tests/send-booking-emails.test.ts
    - tests/send-cancel-emails.test.ts
    - tests/send-reminder-booker.test.ts
    - tests/send-reschedule-emails.test.ts
    - tests/email-6-row-matrix.test.ts
    - tests/reminder-email-content.test.ts
    - FUTURE_DIRECTIONS.md

key-decisions:
  - "OQ-1 approach: centralize Resend cap bypass inside checkAndConsumeQuota via internal accounts SELECT — no leaf-caller changes (7 callers stay unchanged)"
  - "OQ-2 approach: shared isRefusedSend helper exported from account-sender — single update point for future providers"
  - "Resend wins: CONTEXT decision enforced — email_provider='resend' routes Resend even if account_oauth_credentials row exists"
  - "Suspension semantics: resend_status='suspended' → refused before RESEND_API_KEY or any other check"
  - "Soft abuse threshold only: 5000/day emits console.warn; no hard block until abuse is observed in production"
  - "Framework-only ship: no live Resend API call; activation deferred to PREREQ-03 completion"

patterns-established:
  - "Test mock maybeSingle: any test mock that stubs a Supabase chain called by quota-guard must add maybeSingle() to the eq() return so the new accounts.email_provider lookup succeeds"
  - "isRefusedSend is the canonical refusal check: use isRefusedSend(error) everywhere, not raw startsWith(prefix)"
  - "RESEND_REFUSED_SEND_ERROR_PREFIX re-exported from account-sender: callers import both prefixes from one location"

# Metrics
duration: 16min
completed: 2026-05-08
---

# Phase 36 Plan 03: Factory Routing and Orchestrator Fix Summary

**Resend provider routing live in getSenderForAccount (email_provider branch) + quota-guard cap bypass (OQ-1) + dual-prefix isRefusedSend orchestrator fix (OQ-2) + soft 5000/day abuse warn-log + FUTURE_DIRECTIONS.md activation guide for PREREQ-03**

## Performance

- **Duration:** 16 min
- **Started:** 2026-05-08T12:37:43Z
- **Completed:** 2026-05-08T12:53:45Z
- **Tasks:** 4 tasks + 1 auto-fix deviation
- **Files modified:** 13

## Accomplishments

- `getSenderForAccount` now branches on `accounts.email_provider`: `'resend'` + `resend_status='active'` → `createResendClient()`; `resend_status='suspended'` → refused before any credential lookup; `'gmail'` (default) → existing OAuth path unchanged
- OQ-1 resolved: `checkAndConsumeQuota` internally reads `accounts.email_provider`; Resend accounts bypass the 200/day cap while still inserting `email_send_log` rows with `provider='resend'` — zero leaf-caller changes required
- OQ-2 resolved: `send-booking-emails.ts` now calls `isRefusedSend(error)` instead of `error?.startsWith(REFUSED_SEND_ERROR_PREFIX)` — Resend refusals correctly fire `confirmation_email_sent=false`
- `warnIfResendAbuseThresholdCrossed()` fire-and-forget helper emits structured `console.warn` at 5000/day; never blocks
- `FUTURE_DIRECTIONS.md` updated with PREREQ-03 DNS steps, Vercel `RESEND_API_KEY` env var, first-customer integration test recipe, activation SQL, and suspension lever
- 14 account-sender tests pass (9 original Gmail + 5 new Resend); 7 quota-guard tests pass (5 original + 2 new Phase 36)

## Task Commits

Each task was committed atomically:

1. **Task 1: getSenderForAccount Resend routing + isRefusedSend + abuse-warn** — `9681747` (feat)
2. **Task 2: checkAndConsumeQuota cap bypass for Resend + provider log tag** — `9583896` (feat)
3. **Task 3: OQ-2 dual-prefix fix + Phase 36 factory tests** — `8863e2a` (feat)
4. **Task 4: FUTURE_DIRECTIONS.md — PREREQ-03 activation guide** — `8253245` (docs)
5. **Deviation auto-fix: update 7 test-file Supabase mocks** — `b870c19` (fix)

## Files Created/Modified

- `lib/email-sender/account-sender.ts` — Resend routing branch, isRefusedSend helper, RESEND_REFUSED_SEND_ERROR_PREFIX re-export, refusedSender opts extension, warnIfResendAbuseThresholdCrossed helper
- `lib/email-sender/quota-guard.ts` — checkAndConsumeQuota extended with accounts.email_provider lookup; Resend bypasses cap; insert tagged with provider='resend'|'gmail'
- `lib/email/send-booking-emails.ts` — REFUSED_SEND_ERROR_PREFIX import replaced with isRefusedSend (OQ-2 fix)
- `tests/account-sender.test.ts` — AccountRow type extended; email_send_log mock branch added; 5 Phase 36 tests (#10-#14)
- `tests/quota-guard.test.ts` — mock updated for accounts table SELECT; 2 Phase 36 tests (#6-#7)
- `tests/email-quota-refuse.test.ts` — mock .eq() chain extended with maybeSingle()
- `tests/send-booking-emails.test.ts` — mock .eq() chain + isRefusedSend added to inline account-sender mock
- `tests/send-cancel-emails.test.ts` — mock .eq() chain extended with maybeSingle()
- `tests/send-reminder-booker.test.ts` — mock .eq() chain extended with maybeSingle()
- `tests/send-reschedule-emails.test.ts` — mock .eq() chain extended with maybeSingle()
- `tests/email-6-row-matrix.test.ts` — mock .eq() chain extended with maybeSingle()
- `tests/reminder-email-content.test.ts` — mock .eq() chain extended with maybeSingle()
- `FUTURE_DIRECTIONS.md` — Phase 36 Resend activation section appended

## Decisions Made

- **OQ-1 approach — centralize in checkAndConsumeQuota:** The plan offered the centralization option (single accounts SELECT inside the function) vs. adding a bypass parameter to each of the 7 leaf callers. Centralization was chosen because it keeps all 7 callers unchanged and puts the Resend-awareness in one place. Tradeoff: an extra DB SELECT per email send on all accounts — negligible for sub-5000/day volume.

- **nil-UUID sentinel falls through to Gmail:** The `checkAndConsumeQuota` `maybeSingle()` returns `null` when accountId is `'00000000-0000-0000-0000-000000000000'` (signup-side paths). `null` → `acct?.email_provider === "resend"` is false → Gmail path with cap enforced. This is the correct behavior: system-level sends (signup-verify, welcome) aren't Resend-routed.

- **Test mocks updated for maybeSingle:** The new `accounts.email_provider` SELECT in `checkAndConsumeQuota` required adding `maybeSingle()` to the `.eq()` chain in 7 test file mocks. Applied as Rule 1 (Bug) auto-fix — the omission caused `TypeError: admin.from(...).select(...).eq(...).maybeSingle is not a function` in all tests that called `checkAndConsumeQuota` through a real (non-mocked) quota-guard module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 7 test-file Supabase mocks broken by new accounts.email_provider SELECT**

- **Found during:** Task 2 verification (running full vitest suite after quota-guard changes)
- **Issue:** `checkAndConsumeQuota` now calls `.from("accounts").select("email_provider").eq(...).maybeSingle()` before the email_send_log query. All 7 existing test mocks used a flat `.eq()` → `.gte()` chain with no `.maybeSingle()`, causing `TypeError: admin.from(...).select(...).eq(...).maybeSingle is not a function` at runtime. This affected `email-quota-refuse.test.ts`, `send-booking-emails.test.ts`, `send-cancel-emails.test.ts`, `send-reminder-booker.test.ts`, `send-reschedule-emails.test.ts`, `email-6-row-matrix.test.ts`, and `reminder-email-content.test.ts` — 40 tests broken.
- **Fix:** Added `maybeSingle: () => Promise.resolve({ data: null, error: null })` to each mock's `.eq()` return. `data: null` → `acct?.email_provider === "resend"` is false → Gmail path, preserving all existing test semantics unchanged.
- **Files modified:** 7 test files (see above)
- **Verification:** All 7 files restored to green (48 total tests); full suite 341-343 passing, same 2 pre-existing failures (bookings-api rate_limit_events accumulation + slots-api DB timing)
- **Committed in:** `b870c19` (separate fix commit after task commits)

Also added `isRefusedSend` and `RESEND_REFUSED_SEND_ERROR_PREFIX` to the inline `account-sender` mock in `send-booking-emails.test.ts` since `send-booking-emails.ts` now imports `isRefusedSend` from `@/lib/email-sender/account-sender`.

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for test correctness; no behavioral scope creep. All pre-existing test semantics preserved.

## Issues Encountered

None from planned tasks. The only issue was the mock bug described above, which was diagnosed and fixed in the same session.

## Next Phase Readiness

- Phase 36 framework is **complete**. All 3 plans shipped:
  - Plan 01: schema migration (`email_provider`, `resend_status` columns)
  - Plan 02: `createResendClient` HTTP provider + 9 unit tests
  - Plan 03: factory routing + quota bypass + OQ-2 fix + abuse warn + FUTURE_DIRECTIONS.md
- **Activation path:** one SQL UPDATE per account — no code changes, no redeploy required
- **Blocker still in effect:** PREREQ-03 (Resend account + NSI domain DNS verification + `RESEND_API_KEY` Vercel env var). See `FUTURE_DIRECTIONS.md §Phase 36` for exact steps.
- **Phase 37 (Upgrade Flow)** can proceed: it consumes `createResendClient` directly (bypass the per-account quota guard — LD-05 bootstrap-safe path) to send the upgrade-request notification email to Andrew.
- **Phase 36 verification** (`36-VERIFICATION.md`) should confirm: Resend routing branch unreachable without `UPDATE accounts SET email_provider='resend'` (inert until PREREQ-03 done), all existing email flows unaffected, test counts correct.

---
*Phase: 36-resend-backend-for-upgraded-accounts*
*Completed: 2026-05-08*
