---
phase: 31-email-hard-cap-guard
plan: 01
subsystem: email
tags: [quota-guard, gmail-smtp, supabase-migration, email-send-log, bookings, typescript]

# Dependency graph
requires:
  - phase: 10-billing-and-quota-guard (Phase 10 — original signup quota guard)
    provides: email_send_log table, checkAndConsumeQuota, QuotaExceededError, getDailySendCount, SIGNUP_DAILY_EMAIL_CAP=200, 80% warn block
provides:
  - email_send_log.category CHECK accepts 7 booking-side values (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner)
  - bookings.confirmation_email_sent boolean NOT NULL DEFAULT true with partial index for unsent rows
  - EmailCategory union extended to 12 values
  - getRemainingDailyQuota() pre-flight helper
  - logQuotaRefusal() PII-free structured refusal logger ([EMAIL_QUOTA_EXCEEDED] tag, 5 fields)
affects: [31-02 (call-site wiring), 31-03 (dashboard alert + manual reminder UX), 32 (auto-cancel batch pre-flight), 33 (pushback batch pre-flight)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-function EmailCategory taxonomy (7 booking-side values, not coarse grouping) — gives exact log granularity for which email type hit the cap"
    - "save-and-flag posture for fire-and-forget email failures — booking row is committed and 201 returned before quota guard fires; failure is recorded via boolean column, dashboard surfaces it"
    - "Structured PII-free refusal log shape: { code, account_id, sender_type, count, cap } under [EMAIL_QUOTA_EXCEEDED] tag"
    - "Partial index on rare-condition column (confirmation_email_sent = false) avoids full-table scan on dashboard count"

key-files:
  created:
    - supabase/migrations/20260504130000_phase31_email_send_log_categories.sql
    - supabase/migrations/20260504130001_phase31_bookings_confirmation_email_sent.sql
  modified:
    - lib/email-sender/quota-guard.ts

key-decisions:
  - "Bundled getRemainingDailyQuota() in Phase 31 (not deferred to Phase 32) — 3 lines, contained, avoids duplicate work in 32"
  - "Per-function EmailCategory taxonomy (7 new values) instead of coarse 'booking' / 'reminder' grouping"
  - "console.error-only for refusal log destination — Vercel Functions log is sufficient at v1 volume, no new DB table"
  - "DEFAULT true on bookings.confirmation_email_sent — preserves existing-row invariant (all are 'sent' since they predate the guard)"
  - "Partial index WHERE confirmation_email_sent = false — keeps dashboard count cheap"
  - "Boundary semantics unchanged: count >= SIGNUP_DAILY_EMAIL_CAP (allow-200, refuse-at-201) — already correct per RESEARCH"

patterns-established:
  - "PII-free refusal logging: only structural identifiers (account_id UUID, sender_type enum, counts/caps), never booker_email/booker_name/booker_phone/ip/answers"
  - "Place new exports AFTER checkAndConsumeQuota in quota-guard.ts — preserves git diff readability and signals 'addition, not modification' for the locked 80% warn block"

# Metrics
duration: ~10 min
completed: 2026-05-05
---

# Phase 31 Plan 01: Email Hard Cap Guard Foundation Summary

**Schema + TypeScript foundation for the system-wide quota guard: 7 new booking-side email categories accepted by both the DB CHECK and the EmailCategory union, plus getRemainingDailyQuota() and logQuotaRefusal() helpers ready for Plans 31-02/03 and Phases 32/33 to consume.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-05T02:48Z (approx)
- **Completed:** 2026-05-05T02:58Z
- **Tasks:** 2
- **Files modified:** 3 (2 new migrations + quota-guard.ts edited)

## Accomplishments

- `email_send_log.category` CHECK constraint extended from 5 values to 12 (added: booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner). Verified live: `pg_get_constraintdef` returns the full 12-value list.
- `bookings.confirmation_email_sent boolean NOT NULL DEFAULT true` column added with partial index `bookings_confirmation_email_unsent_idx` on `(account_id) WHERE confirmation_email_sent = false`. Verified live: column metadata correct, all existing bookings rows defaulted to true (count of unsent = 0).
- INSERT smoke-test confirmed: `INSERT INTO email_send_log (category) VALUES ('booking-confirmation')` succeeded against the live DB; test row deleted.
- `quota-guard.ts` `EmailCategory` union extended to 12 members; `getRemainingDailyQuota(): Promise<number>` and `logQuotaRefusal(params): void` exported.
- Existing 80% warn block (`warnedDays` Set + `[GMAIL_SMTP_QUOTA_APPROACHING]` console.error) and `checkAndConsumeQuota` boundary semantics (`count >= SIGNUP_DAILY_EMAIL_CAP`) byte-for-byte unchanged. Confirmed by `git diff lib/email-sender/quota-guard.ts` showing additions only.
- Existing `tests/quota-guard.test.ts` still passes (4/4) with no modification.

## Task Commits

1. **Task 1: Migrations — extend email_send_log CHECK + add bookings.confirmation_email_sent** — `ab3ceb2` (feat)
2. **Task 2: Extend quota-guard.ts — EmailCategory + getRemainingDailyQuota + logQuotaRefusal** — `ac886ca` (feat)

**Plan metadata:** _to be appended after this summary commit_

## Files Created/Modified

- `supabase/migrations/20260504130000_phase31_email_send_log_categories.sql` (NEW) — drops + re-adds `email_send_log_category_check` CHECK constraint with the 12-value union (5 legacy + 7 booking-side).
- `supabase/migrations/20260504130001_phase31_bookings_confirmation_email_sent.sql` (NEW) — adds `bookings.confirmation_email_sent boolean NOT NULL DEFAULT true` plus partial index `bookings_confirmation_email_unsent_idx`.
- `lib/email-sender/quota-guard.ts` (MODIFIED, additions only) — extends `EmailCategory` union with 7 new values; appends `getRemainingDailyQuota()` and `logQuotaRefusal()` after `checkAndConsumeQuota`.

### New EmailCategory union (full list)

```typescript
export type EmailCategory =
  | "signup-verify"
  | "signup-welcome"
  | "password-reset"
  | "email-change"
  | "other"
  // Phase 31 (EMAIL-21): booking-side paths now go through the guard
  | "booking-confirmation"
  | "owner-notification"
  | "reminder"
  | "cancel-booker"
  | "cancel-owner"
  | "reschedule-booker"
  | "reschedule-owner";
```

### New helper signatures

```typescript
export async function getRemainingDailyQuota(): Promise<number>;

export function logQuotaRefusal(params: {
  account_id: string | null;
  sender_type: EmailCategory;
  count: number;
  cap: number;
}): void;
```

`logQuotaRefusal` writes a single `console.error("[EMAIL_QUOTA_EXCEEDED]", { code, account_id, sender_type, count, cap })` line — exactly the 5 PII-free fields required by EMAIL-25.

### 80% warn block status

UNCHANGED. The `warnedDays` Set and `[GMAIL_SMTP_QUOTA_APPROACHING] ${count}/${SIGNUP_DAILY_EMAIL_CAP}` console.error block (now lines 66-80 of the file, originally 65-73) is byte-for-byte identical to pre-Phase-31. Confirmed via `git diff lib/email-sender/quota-guard.ts` — the diff hunk @@-78,3+86,34@@ is purely a `+` block appended AFTER the existing `checkAndConsumeQuota` function. No deletions, no modifications inside the warn block.

## Decisions Made

All decisions came pre-baked from 31-RESEARCH.md "Decision Summary for Planner" — no new judgment calls were needed during execution. Key ones reaffirmed by execution:

- **Per-function category taxonomy (7 new values).** Followed RESEARCH recommendation; matches Plan 31-02's expected wiring (one category per email function).
- **Partial index on `confirmation_email_sent = false`.** Adopted from RESEARCH "Dashboard Alert" section — keeps the count query cheap when nearly all rows are true.
- **`getRemainingDailyQuota()` bundled in 31, not deferred.** Three lines, no risk; saves Phase 32's planner from rewriting the same code.
- **Helpers placed AFTER `checkAndConsumeQuota`, not before.** Preserves git diff readability and signals "the existing function is locked, these are additions."

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<verify>` section called for `npx supabase db query --linked --sql "..."` but the installed supabase CLI version (2.92.1) does not accept `--sql` as a flag — it only accepts `-f file.sql` or a positional SQL string. Resolved by writing each verification query to a temp `.tmp_verify*.sql` file, applying via `-f`, then deleting the temp files. This is a tooling adaptation, not a deviation from intent — the same SQL ran, the same results were verified. Not tracked as a Rule 1/2/3 deviation because the plan's verification was satisfied; only the invocation syntax differed.

## Issues Encountered

- **Pre-existing TS errors in unrelated test files.** `npx tsc --noEmit` surfaced ~30 errors in `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts` — all referencing removed `__mockSendCalls` / `__resetMockSendCalls` / `__setTurnstileResult` test-helper exports. Filtered the output (`grep -E "quota-guard|email-sender/index"`) and confirmed zero errors in any file Phase 31 touches. These errors pre-date Phase 31 (test-mock infrastructure debt) and are not introduced or aggravated by this plan. Not tracked as a deviation since they're not blocking my work; flagged here for visibility.

## User Setup Required

None - no external service configuration required. Both migrations applied to the linked Supabase via the canonical `echo "y" | npx supabase db query --linked -f` path. No env vars, no dashboard work, no third-party sign-ups.

## Next Phase Readiness

**Plan 31-02 ready to start.** The wiring work has all the surface it needs:
- DB CHECK accepts every category Plan 31-02 will insert via `checkAndConsumeQuota("...")`.
- TS union compiles for every category Plan 31-02 will import.
- `confirmation_email_sent` column ready for the `sendBookingEmails()` save-and-flag UPDATE.
- `logQuotaRefusal` ready as the single shared logger across all five email-sender modules.
- `getRemainingDailyQuota` ready for Phase 32/33 batch pre-flights (Plan 31-02 will not consume it but it's there).

**Concerns / open items to carry forward:**
- Pre-existing test-mock infra debt (see Issues Encountered) will likely surface during Plan 31-02 if any new test imports those removed helpers. Recommend Plan 31-02 not extend those test files; if quota-guard tests need expansion, follow the existing `tests/quota-guard.test.ts` pattern (vi.mock the admin client directly, no helper exports needed).
- The `lib/email-sender/index.ts` v1.1 carve-out comment (lines 73-76) still says "Booking and reminder paths bypass the guard intentionally." Plan 31-02 must update or remove that comment as part of wiring.

---
*Phase: 31-email-hard-cap-guard*
*Completed: 2026-05-05*
