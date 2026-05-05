---
phase: 31-email-hard-cap-guard
plan: 02
subsystem: email
tags: [quota-guard, gmail-smtp, email-senders, save-and-flag, after-to-await, cron, server-action]

# Dependency graph
requires:
  - phase: 31-01 (foundation — schema + quota-guard helpers)
    provides: 7 new EmailCategory values, getRemainingDailyQuota, logQuotaRefusal, bookings.confirmation_email_sent column
provides:
  - 7 email senders all guarded (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner)
  - v1.1 carve-out comment removed from lib/email-sender/index.ts; replaced with Phase 31 contract note
  - send-booking-emails.ts save-and-flag UPDATE on QuotaExceededError (booker confirmation refusal flags bookings.confirmation_email_sent=false)
  - lib/bookings/cancel.ts + reschedule.ts switched from after() to await on email send; emailFailed?: "quota" | "send" return field
  - send-cancel-emails.ts + send-reschedule-emails.ts orchestrators throw first QuotaExceededError from allSettled results
  - app/api/cron/send-reminders/route.ts loop moved out of after(); response now returns { ok, scanned, claimed, reminders_sent, quota_refused }; reminder_sent_at NOT cleared on quota refuse
  - sendReminderForBookingAction returns locked Gmail-fallback copy + errorCode: "EMAIL_QUOTA_EXCEEDED"
affects: [31-03 (dashboard alert reads confirmation_email_sent=false; UI branches on emailFailed: "quota" + errorCode: "EMAIL_QUOTA_EXCEEDED"), 32 (auto-cancel batch — same QuotaExceededError contract), 33 (pushback batch — same contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sender-internal quota guard: every email sender calls checkAndConsumeQuota immediately before sendEmail, logs refusal via logQuotaRefusal (PII-free 5-field), re-throws so callers can branch on QuotaExceededError"
    - "Orchestrator allSettled + first-quota-throw: sendCancelEmails / sendRescheduleEmails inspect rejected legs, throw the first QuotaExceededError so awaiting callers can surface emailFailed: 'quota' to the owner UI"
    - "save-and-flag on quota: send-booking-emails.ts UPDATEs bookings.confirmation_email_sent=false via service-role admin client; held slot stays claimed; booking row stays — Plan 31-03 dashboard alert reads this flag"
    - "after()→await for owner-triggered lifecycle: cancel.ts and reschedule.ts now await the email send so QuotaExceededError surfaces synchronously to the owner UI (booker public token routes also await transparently)"
    - "Cron live counters in JSON response: loop moved out of after() so reminders_sent / quota_refused are observable in cron-job.org / Vercel Cron history without trawling Functions logs"
    - "Locked owner-error copy: 'Daily email quota reached (N/200). Resets at UTC midnight. You can use normal Gmail to send the reminder manually.' — verbatim from CONTEXT, paired with errorCode: 'EMAIL_QUOTA_EXCEEDED' for UI branching"

key-files:
  created: []
  modified:
    - lib/email/send-booking-confirmation.ts
    - lib/email/send-owner-notification.ts
    - lib/email/send-reminder-booker.ts
    - lib/email/send-cancel-emails.ts
    - lib/email/send-reschedule-emails.ts
    - lib/email/send-booking-emails.ts
    - lib/bookings/cancel.ts
    - lib/bookings/reschedule.ts
    - lib/email-sender/index.ts
    - app/api/bookings/route.ts
    - app/api/cron/send-reminders/route.ts
    - app/(shell)/app/bookings/[id]/_lib/actions.ts

key-decisions:
  - "Added required `id: string` to every sender's AccountRecord interface — without account_id the PII-free refusal log loses its only structural identifier; passed through from existing call-site account.id (no new fetches)"
  - "Cron loop moved OUT of after() (option a from plan) — cron is server-internal, no human waits on the response, live counters in JSON > buried log emissions for operability"
  - "Cancel/reschedule orchestrators preserve allSettled semantics for non-quota failures (log + swallow) but re-throw the first QuotaExceededError so awaiting callers branch — keeps cancel/reschedule DB UPDATE robust against arbitrary SMTP errors while still surfacing quota to owner UI"
  - "emailFailed return field uses spread `...(emailFailed ? { emailFailed } : {})` so the happy path return shape is unchanged (no field churn for existing callers)"
  - "In send-booking-emails.ts the UPDATE remains inside the after()-wrapped sendBookingEmails (caller still uses after()) — kept the existing posture; the save-and-flag is a small extra DB write that piggybacks on the post-response code path"

patterns-established:
  - "Quota guard contract is now system-wide: lib/email-sender/index.ts comment block names every sender that must call checkAndConsumeQuota, removing the v1.1 carve-out exception"
  - "errorCode: literal-union return field on Server Actions for UI branching — the manual reminder action returns errorCode: 'EMAIL_QUOTA_EXCEEDED' so Plan 31-03 can switch toast → inline callout without string-matching the user-facing copy"

# Metrics
duration: ~30 min
completed: 2026-05-05
---

# Phase 31 Plan 02: Sender Wiring + Caller Routing Summary

**Every email-sending function now goes through `checkAndConsumeQuota` with a typed `EmailCategory`. The v1.1 carve-out (booking + reminder paths bypass guard) is closed. Booker confirmation refusals save-and-flag the booking row; owner-triggered cancel/reschedule/manual-reminder receive synchronous `emailFailed: "quota"` (or the locked Gmail-fallback copy) so Plan 31-03's dashboard alert + inline callout can surface the cap to the owner.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2/2 atomic commits + metadata commit
- **TS errors:** 35 → 35 (0 new in src/; pre-existing test-file errors unchanged)
- **Vitest:** 177 passing, 4 skipped, 8 pre-existing-broken test files unchanged (zero regressions)

## What Changed

### Task 1: Guarded all 7 email senders + closed the v1.1 carve-out

Commit: `7348bc1` — `feat(31-02): wire all 7 email senders through quota guard`

**5 sender modules updated**, 7 call sites total:

| File | Sender | Category |
|------|--------|----------|
| `lib/email/send-booking-confirmation.ts` | `sendBookingConfirmation` | `booking-confirmation` |
| `lib/email/send-owner-notification.ts` | `sendOwnerNotification` | `owner-notification` |
| `lib/email/send-reminder-booker.ts` | `sendReminderBooker` | `reminder` |
| `lib/email/send-cancel-emails.ts` | `sendBookerCancelEmail` (inner) | `cancel-booker` |
| `lib/email/send-cancel-emails.ts` | `sendOwnerCancelEmail` (inner) | `cancel-owner` |
| `lib/email/send-reschedule-emails.ts` | `sendBookerRescheduleEmail` (inner) | `reschedule-booker` |
| `lib/email/send-reschedule-emails.ts` | `sendOwnerRescheduleEmail` (inner) | `reschedule-owner` |

Pattern at every site:

```typescript
try {
  await checkAndConsumeQuota("<category>");
} catch (err) {
  if (err instanceof QuotaExceededError) {
    logQuotaRefusal({ account_id: account.id, sender_type: "<category>", count: err.count, cap: err.cap });
  }
  throw err;
}
await sendEmail({ ... });
```

**Sender AccountRecord types extended** with required `id: string` field — the PII-free refusal log needs `account_id`. All callers updated to pass `id: account.id` (no new DB fetches; the field was already in scope at every call site).

**Cancel + reschedule orchestrators** (`sendCancelEmails`, `sendRescheduleEmails`) switched from per-leg `.catch()` swallow to `Promise.allSettled` inspection. They throw the first `QuotaExceededError` they find in their settled results so `lib/bookings/cancel.ts` + `reschedule.ts` (Task 2) can branch on it. Non-quota failures still log + swallow (the cancel/reschedule DB UPDATE has already committed).

**`lib/email-sender/index.ts` comment block** — the v1.1 carve-out (`// Booking and reminder paths bypass the guard intentionally...`) was replaced with the Phase 31 contract note naming every sender that must call `checkAndConsumeQuota`. No logic change in `index.ts`.

### Task 2: Caller routing — save-and-flag, await, cron live counters, locked copy

Commit: `0de8dab` — `feat(31-02): route quota errors to save-and-flag, await, cron, manual`

**A. `lib/email/send-booking-emails.ts` — save-and-flag:**

After `Promise.allSettled([sendBookingConfirmation, sendOwnerNotification])`, if either leg's reason is `QuotaExceededError`, UPDATE `bookings SET confirmation_email_sent = false` via the service-role admin client. The held slot is NOT released — booking row stays committed, slot stays claimed. Plan 31-03 surfaces the dashboard alert by reading this flag.

**B. `lib/bookings/cancel.ts` — after() → await:**

Switched `after(() => sendCancelEmails(...))` to `await sendCancelEmails(...)` inside try/catch. `QuotaExceededError` → `emailFailed: "quota"`. Other email errors → `emailFailed: "send"` (logged with `[CANCEL_EMAIL_FAILED]` tag). The cancel DB UPDATE has already committed; we always return `ok: true` and let the UI branch on `emailFailed`.

**C. `lib/bookings/reschedule.ts` — after() → await:**

Symmetric to cancel. `RescheduleBookingResult` happy path now includes optional `emailFailed?: "quota" | "send"` field.

**D. `app/api/cron/send-reminders/route.ts` — loop out of after():**

Removed the `after()` wrapper around the email loop. The response now returns AFTER the loop completes with live counters:

```json
{ "ok": true, "scanned": 12, "claimed": 12, "reminders_sent": 7, "quota_refused": 5 }
```

Per-booking `QuotaExceededError` → `quotaRefused++`, `continue`. `reminder_sent_at` is NOT cleared on quota refuse (v1 posture preserved per RESEARCH "Cron Behavior Design"). Non-quota errors still log + continue (single SMTP hiccup doesn't kill the batch).

**E. `app/(shell)/app/bookings/[id]/_lib/actions.ts` — manual reminder action:**

Catches `QuotaExceededError` and returns the locked owner-error copy (verbatim per CONTEXT lock):

```
Daily email quota reached (${err.count}/${err.cap}). Resets at UTC midnight. You can use normal Gmail to send the reminder manually.
```

Paired with `errorCode: "EMAIL_QUOTA_EXCEEDED"` so Plan 31-03's UI can switch from `toast.error` to inline callout without string-matching the user-facing copy. Non-quota error path (`{ error: "Reminder send failed. Please try again." }`) unchanged.

## Verification (per <verify>)

- `grep -rn 'checkAndConsumeQuota(' lib/email/` → 7 call sites across 5 files (verified, exact match to plan)
- `grep -n 'Booking and reminder paths bypass the guard intentionally' lib/email-sender/index.ts` → 0 matches (carve-out removed)
- `grep -n 'QUOTA GUARD CONTRACT (Phase 31' lib/email-sender/index.ts` → 1 match
- `grep -n 'confirmation_email_sent: false' lib/email/send-booking-emails.ts` → 1 match
- `grep -n 'await sendCancelEmails' lib/bookings/cancel.ts` → 1 match (no `after(() => sendCancelEmails`)
- `grep -n 'await sendRescheduleEmails' lib/bookings/reschedule.ts` → 1 match (no `after(() => sendRescheduleEmails`)
- `grep -n 'quota_refused' app/api/cron/send-reminders/route.ts` → 3 matches (declaration, increment, JSON field)
- `grep -n 'EMAIL_QUOTA_EXCEEDED' app/(shell)/app/bookings/[id]/_lib/actions.ts` → 3 matches (type, return, paired with locked copy)
- `grep -n 'use normal Gmail' app/(shell)/app/bookings/[id]/_lib/actions.ts` → 1 match (locked Gmail-fallback wording)
- `npx tsc --noEmit` → 35 errors (all in pre-existing-broken test files; 0 new errors in src/)
- `npx vitest run` → 177 passed, 4 skipped, 8 pre-existing-broken test files unchanged

## Decisions Made

1. **AccountRecord.id added to all 5 sender types as required field** — alternatives (optional + null fallback in log) would lose the only structural identifier in the PII-free refusal log. Every call site already had `account.id` in scope; cost was zero new fetches.

2. **Cron loop out of after() (option a from plan)** — chose live JSON counters over buried log emissions because the cron is server-internal (cron-job.org + Vercel Cron) and no human waits on the response. Operability win is significant; cron observability now visible in the cron driver's invocation history.

3. **Orchestrators throw first QuotaExceededError, log non-quota** — preserves prior posture for arbitrary SMTP errors (cancel DB UPDATE already committed, don't fail the cancel) while still surfacing quota fail-closed to the owner UI.

4. **`...(emailFailed ? { emailFailed } : {})` spread on result return** — keeps the happy-path return shape unchanged (no `emailFailed: undefined` field churn). Existing callers that don't check `emailFailed` see no behavior change.

5. **Did NOT extend pre-existing-broken test files** — `tests/email-6-row-matrix.test.ts` and `tests/reminder-email-content.test.ts` already failed TS (referencing removed `__mockSendCalls`) and now have additional `id` errors from the AccountRecord change. Per STATE.md guidance these are out of scope; quota-guard test expansion (if Plan 31-03 needs it) follows the existing `tests/quota-guard.test.ts` `vi.mock` pattern.

## Deviations from Plan

None. Plan executed exactly as written. The plan suggested option (a) for the cron loop (move out of `after()`); I followed that recommendation. The plan also explicitly listed the `id` field expansion across senders (Task 1) and noted callers might need updates — those updates were folded into the Task 1 commit since the type changes wouldn't compile without them.

## Authentication Gates

None. All work was in source code; no live deploys, no CLI auth.

## Next Phase Readiness

**Ready for Plan 31-03** (dashboard alert + manual-reminder UX inline callout):

- `bookings.confirmation_email_sent = false` flag is now being written on quota-refused booker confirmations → 31-03 dashboard alert query is unblocked
- `cancelBooking` and `rescheduleBooking` return `emailFailed: "quota"` on quota refusal → 31-03 owner-side UI (cancel button, reschedule UI) can surface the Gmail-fallback callout
- `sendReminderForBookingAction` returns `errorCode: "EMAIL_QUOTA_EXCEEDED"` + locked copy → 31-03 UI switches from `toast.error` to inline callout when this code is present
- Cron `quota_refused` counter is exposed in the JSON response for 31-03 (or future infra dashboards) to consume

**No new blockers.** Open tech debt unchanged from Plan 31-01:

- Pre-existing-broken test files (8 files) remain broken (out of scope per STATE.md).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift remains uncommitted (intentional — not Phase 31 scope).
