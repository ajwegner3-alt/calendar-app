---
phase: 35-per-account-gmail-oauth-send
plan: 01
subsystem: database
tags: [supabase, email, quota, migration, vitest]

# Dependency graph
requires:
  - phase: 31-email-quota-guard
    provides: email_send_log table + checkAndConsumeQuota() helper
  - phase: 34-google-oauth-signup-and-credential-capture
    provides: accounts table with account_id UUIDs; Phase 35 factory needs per-account counts
provides:
  - account_id column on email_send_log (nullable, FK to accounts)
  - Per-account getDailySendCount(accountId) + checkAndConsumeQuota(category, accountId) + getRemainingDailyQuota(accountId)
  - Migration 20260506140000_phase35_email_send_log_account_id.sql
affects:
  - phase: 35-03 (account-sender-factory — calls checkAndConsumeQuota with accountId)
  - phase: 35-04 (cutover-seven-callers — each caller passes accountId to quota helpers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-account quota isolation: email_send_log.account_id + .eq() filter isolates each account's 200/day cap"
    - "Mock chain extension: vitest fluent supabase mocks now chain .eq().gte() for account-filtered queries"

key-files:
  created:
    - supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql
  modified:
    - lib/email-sender/quota-guard.ts
    - tests/quota-guard.test.ts
    - tests/email-quota-refuse.test.ts

key-decisions:
  - "Nullable account_id: legacy email_send_log rows (pre-Phase 35) have no account_id; only new Phase 35 rows populate it"
  - "Per-account warn dedup key: changed from today to today:accountId so each account gets independent 80% threshold log"
  - "email-quota-refuse.test.ts updated inline (not deferred): updating test signatures is part of the same task as updating the source"

patterns-established:
  - "Phase 35 accountId param: all three quota helpers require accountId as a required arg — no global fallback"
  - "7 callsite type errors expected until Plan 04: npx tsc --noEmit | grep quota-guard.ts returns empty; broader errors are Plan 04's scope"

# Metrics
duration: 5min
completed: 2026-05-07
---

# Phase 35 Plan 01: Per-Account Quota Migration Summary

**Added `account_id uuid` column to `email_send_log` and updated all three quota-guard helpers to filter and insert by account, giving each account an independent 200/day Gmail send cap.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-07T01:40:10Z
- **Completed:** 2026-05-07T01:45:01Z
- **Tasks:** 2 (+ 1 auto-fix deviation)
- **Files modified:** 4

## Accomplishments

- Created migration `20260506140000_phase35_email_send_log_account_id.sql` adding nullable `account_id uuid` column + `email_send_log_account_sent_at_idx` index on `(account_id, sent_at DESC)`
- Updated `getDailySendCount(accountId)` to filter selects with `.eq("account_id", accountId)` — per-account counts only
- Updated `checkAndConsumeQuota(category, accountId)` to pass `accountId` through to count check and insert; updated warn log dedup key to `today:accountId`; updated `GMAIL_SMTP_QUOTA_APPROACHING` log to include `account=<id>`
- Updated `getRemainingDailyQuota(accountId)` to delegate to per-account `getDailySendCount`
- Updated file-level comment to note "per-account as of Phase 35"
- All 26 tests in `quota-guard.test.ts` + `email-quota-refuse.test.ts` pass with new signatures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add account_id column + index migration** - `8fdee36` (chore)
2. **Task 2: Update quota-guard signatures to take accountId** - `4cb75ef` (feat)
3. **Deviation fix: Update email-quota-refuse tests** - `5538c52` (fix)

## Files Created/Modified

- `supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql` — ALTER TABLE adds account_id + index
- `lib/email-sender/quota-guard.ts` — Three exported helpers now take `accountId: string`; insert includes `account_id`
- `tests/quota-guard.test.ts` — All calls pass `TEST_ACCOUNT_ID`; mock chain extended for `.eq().gte()`
- `tests/email-quota-refuse.test.ts` — Same: `TEST_ACCOUNT_ID` added; all 18 booking-category tests updated

## Decisions Made

- `account_id` is nullable (not NOT NULL) so legacy rows from Phases 5-34 don't need backfilling
- Warn dedup key changed from `today` to `${today}:${accountId}` so two different accounts can each fire the 80% warning independently without suppressing each other
- `email-quota-refuse.test.ts` updated inline (not left as a known failure) because updating test signatures is a required part of the quota-guard signature change

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/email-quota-refuse.test.ts` called quota helpers without accountId**

- **Found during:** Task 2 verification (running full vitest suite)
- **Issue:** The plan only mentioned updating `tests/quota-guard.test.ts`. But `tests/email-quota-refuse.test.ts` (Phase 31's test file) also called `checkAndConsumeQuota(cat)` and `getRemainingDailyQuota()` without `accountId`, causing 18 test failures. The mock chain also lacked the `.eq()` step needed for the new filter.
- **Fix:** Added `TEST_ACCOUNT_ID` constant, updated all 15 call sites in the two `for (const cat of PHASE_31_CATEGORIES)` loops and the three `getRemainingDailyQuota()` calls, extended mock chain to handle `.eq().gte()`
- **Files modified:** `tests/email-quota-refuse.test.ts`
- **Verification:** `npx vitest run tests/quota-guard.test.ts tests/email-quota-refuse.test.ts` → 26/26 pass
- **Committed in:** `5538c52`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test suite kept green. No scope creep — the fix was strictly limited to making existing tests call the new signatures correctly.

## Issues Encountered

None — migration file created, signatures updated, tests green.

## Next Phase Readiness

- Migration `20260506140000_phase35_email_send_log_account_id.sql` ready for Andrew to apply via `supabase migration up` on production (or it will be applied with the cutover deploy)
- `lib/email-sender/quota-guard.ts` exports updated signatures — Plan 03 (account-sender-factory) and Plan 04 (cutover-seven-callers) can now consume `checkAndConsumeQuota(category, accountId)`
- 7 caller type errors exist in the repo (`app/(auth)/app/signup/actions.ts`, 2× `actions-batch-cancel.ts`, 4× `actions-pushback.ts`, `settings/profile/email/actions.ts`, `send-booking-confirmation.ts`, 2× `send-cancel-emails.ts`, `send-owner-notification.ts`, `send-reminder-booker.ts`, 2× `send-reschedule-emails.ts`, `welcome-email.ts`) — these are expected and resolved in Plan 04

---
*Phase: 35-per-account-gmail-oauth-send*
*Completed: 2026-05-07*
