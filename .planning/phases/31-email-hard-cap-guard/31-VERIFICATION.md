---
phase: 31-email-hard-cap-guard
verified: 2026-05-04T22:27:00Z
status: human_needed
score: 4/4 must-haves verified (4 success criteria all structurally satisfied; live verification needed for in-browser surfaces)
human_verification:
  - test: "Trip the cap and trigger a manual reminder"
    expected: "AlertDialog footer shows the inline error 'Daily email quota reached (200/200). Resets at UTC midnight. You can use normal Gmail to send the reminder manually.' — NO toast appears, dialog stays open."
    why_human: "Inline-vs-toast UX behavior of an AlertDialog component cannot be verified by grep — requires the component to actually render in a browser at the cap state."
  - test: "Trip the cap and cancel a booking as owner"
    expected: "Booking is cancelled. Toast says 'Booking cancelled. Email could not be sent (daily quota reached). Use normal Gmail to notify the booker.' Database shows status=cancelled."
    why_human: "Live toast rendering + DB state combination requires runtime; only the wiring is statically verifiable."
  - test: "Trip the cap and have a booker complete a fresh booking"
    expected: "201 returns to booker (booking row committed); booker confirmation page shows generic success copy (no quota numbers); bookings.confirmation_email_sent=false on the row; structured log line emitted with code/account_id/sender_type/count/cap and NO PII."
    why_human: "End-to-end booking flow with quota refusal needs an actual SMTP send attempt at the cap to confirm save-and-flag landed and the booker UX never leaks quota internals."
  - test: "Visit /app/bookings while at least one booking has confirmation_email_sent=false"
    expected: "Amber alert banner renders above filters with copy '<N> booking(s) has/have an unsent confirmation email because the daily email quota (200/day) was reached. Use Gmail to notify these bookers manually. The quota resets at UTC midnight.' Banner self-suppresses when count=0."
    why_human: "Visual rendering + count accuracy + suppress-on-zero behavior all live in the browser."
  - test: "Force a cron tick at the cap with multiple due reminders"
    expected: "Response JSON includes ok:true, scanned, claimed, reminders_sent, quota_refused (with quota_refused matching the number of bookings the cap killed). reminder_sent_at remains set on each refused booking (not cleared)."
    why_human: "Cron route response shape is reachable only by triggering the cron HTTP endpoint with valid CRON_SECRET; not directly inspectable without runtime."
  - test: "Trip the cap and have a booker reschedule via public token URL"
    expected: "Reschedule UPDATE commits (booking moved to new slot). Owner UI on a refreshed booking detail page reflects the new slot. emailFailed='quota' propagates so the public reschedule route can surface a non-fatal warning if added in a future phase. Booker-facing surface stays generic."
    why_human: "Public-token reschedule flow requires a real booking + token + slot pick; structural wiring verified, runtime needs human."
---

# Phase 31: Email Hard Cap Guard - Verification Report

Phase Goal (ROADMAP.md): The Gmail quota guard refuses to send when the daily count is at 200, for every email path in the system - no silent drops, no partial batches.

Verified: 2026-05-04T22:27:00Z
Status: human_needed
Re-verification: No - initial verification

---

## Goal Achievement - Observable Truths (4 ROADMAP success criteria)

### Criterion 1: Refuse-send at cap returns clear error to caller

Status: VERIFIED (structural)

Evidence:
- lib/email-sender/quota-guard.ts:70-72 contains: if (count >= SIGNUP_DAILY_EMAIL_CAP) throw new QuotaExceededError(count, SIGNUP_DAILY_EMAIL_CAP)
- All 7 senders wrap checkAndConsumeQuota in try/catch and re-throw QuotaExceededError after writing logQuotaRefusal
- tests/email-quota-refuse.test.ts proves all 7 categories rejects.toBeInstanceOf(QuotaExceededError) at cap, and resolves below cap (21 tests passing)

### Criterion 2: Owner-facing trigger path returns visible error

Status: VERIFIED structurally; needs live UI check

Evidence:
- Manual reminder action at app/(shell)/app/bookings/[id]/_lib/actions.ts:262-269 returns error string + errorCode EMAIL_QUOTA_EXCEEDED
- day-detail-row.tsx:133-135 branches on errorCode and renders inline (no toast, dialog stays open)
- cancel-button.tsx:62-72 renders differentiated quota-aware success toast
- Cancel/reschedule lib switched from after() to await so emailFailed=quota propagates synchronously (lib/bookings/cancel.ts:194-205, lib/bookings/reschedule.ts:227-238)

### Criterion 3: Every refusal writes structured PII-free log

Status: VERIFIED

Evidence:
- lib/email-sender/quota-guard.ts:106-119 logQuotaRefusal writes exactly 5 fields (code, account_id, sender_type, count, cap) under [EMAIL_QUOTA_EXCEEDED] tag
- All 7 senders call it before re-throwing
- tests/email-quota-refuse.test.ts:135-185 asserts exact 5-key shape AND negative assertions on booker_email/booker_name/booker_phone/ip/answers
- account_id sourced from account.id plumbed through every sender args (added to AccountRecord interfaces)

### Criterion 4: Coverage spans all sender types

Status: VERIFIED

Evidence: 7 checkAndConsumeQuota call sites in lib/email/:
- send-booking-confirmation.ts:159 (booking-confirmation)
- send-owner-notification.ts:152 (owner-notification)
- send-reminder-booker.ts:208 (reminder)
- send-cancel-emails.ts:191,304 (cancel-booker, cancel-owner)
- send-reschedule-emails.ts:184,289 (reschedule-booker, reschedule-owner)

lib/email-sender/index.ts:70-76 v1.1 carve-out comment replaced with Phase 31 contract note. grep "Booking and reminder paths bypass" returns 0 matches across lib/.

Score: 4/4 truths VERIFIED structurally.

---

## Required Artifacts

### Plan 31-01 (DB + quota-guard foundation) - all VERIFIED

- supabase/migrations/20260504130000_phase31_email_send_log_categories.sql - DROP + ADD CONSTRAINT contains all 12 values (5 legacy + 7 new)
- supabase/migrations/20260504130001_phase31_bookings_confirmation_email_sent.sql - column ALTER + partial index present
- Extended EmailCategory union (lines 12-25, 12-member union)
- getRemainingDailyQuota() (lines 95-98, 3 test cases pass)
- logQuotaRefusal (lines 106-119)
- Preserved 80% warn block (lines 66-81 unchanged, 5 quota-guard tests pass)
- checkAndConsumeQuota boundary (line 70 unchanged, count >= cap)

### Plan 31-02 (Sender wiring + caller routing) - all VERIFIED

- lib/email/send-booking-confirmation.ts (lines 158-170 guard + log + re-throw, AccountRecord adds id)
- lib/email/send-owner-notification.ts (lines 151-163)
- lib/email/send-reminder-booker.ts (lines 207-219)
- lib/email/send-cancel-emails.ts (orchestrator 82-105 finds first QuotaExceededError and re-throws; inner guards 190-202, 303-315)
- lib/email/send-reschedule-emails.ts (orchestrator 78-102, inner guards 183-195, 288-300)
- lib/email/send-booking-emails.ts save-and-flag (lines 53-72 detects quotaHit and UPDATEs confirmation_email_sent=false; held slot NOT released)
- lib/bookings/cancel.ts await + emailFailed (lines 162-205 try/catch with emailFailed propagation; grep for after-arrow-sendCancelEmails returns 0)
- lib/bookings/reschedule.ts await + emailFailed (lines 196-238 same pattern)
- app/api/cron/send-reminders/route.ts (lines 224-289 inline loop with continue-on-quota counter; reminder_sent_at NOT cleared; response JSON has live counters)
- sendReminderForBookingAction (lines 262-269 returns locked Gmail-fallback string + errorCode)
- lib/email-sender/index.ts carve-out removed (lines 70-76 contain Phase 31 contract note)

### Plan 31-03 (Owner UX + tests) - all VERIFIED

- day-detail-row.tsx inline reminder error (useState reminderError; lines 133-135 set on EMAIL_QUOTA_EXCEEDED no toast; lines 269-277 render with data-testid; reset on open-change)
- cancel-button.tsx differentiated toast (lines 62-72 three-branch quota/send/default)
- countUnsentConfirmations (queries.ts:132-147, head:true count, partial-index-backed)
- app/bookings/page.tsx banner mounting (imports, fetches in Promise.all, renders above filters)
- unsent-confirmations-banner.tsx (self-suppresses when count<=0; contains literal Use Gmail to notify these bookers manually; has UTC reset note + (200/day) figure)
- tests/email-quota-refuse.test.ts (21 tests passing)
- tests/quota-guard.test.ts (5 tests passing including 80% warn regression)

---

## Key Link Verification - all WIRED

- All 7 email senders to quota-guard checkAndConsumeQuota (via import + try/catch + logQuotaRefusal + re-throw)
- send-booking-emails.ts quota catch to bookings.confirmation_email_sent UPDATE (via createAdminClient)
- lib/bookings/cancel.ts to sendCancelEmails (via await, not after)
- lib/bookings/reschedule.ts to sendRescheduleEmails (via await, not after)
- day-detail-row Send Reminder dialog to sendReminderForBookingAction errorCode (via branch on errorCode)
- app/bookings/page.tsx to countUnsentConfirmations (via server-component fetch)
- Cancel/reschedule emailFailed to UI toast/copy (via propagation through cancelBookingAsOwner)

---

## Anti-Patterns Found

None. All console.error sites are intentional (structured PII-free quota refusal log + non-quota error logging). All paths re-throw or propagate; none silently swallow.

Note: Pre-existing tech debt (8 unrelated broken-mock test files) is documented in STATE.md, NOT introduced by Phase 31.

---

## Human Verification Required

Six runtime UX flows that grep cannot prove (full details in frontmatter):

1. Trip cap and trigger manual reminder - inline error renders, no toast, dialog stays open
2. Trip cap and cancel as owner - differentiated success toast, booking cancelled in DB
3. Trip cap and have booker complete booking - save-and-flag works, booker UX stays generic
4. Visit /app/bookings with unsent-confirmation row - banner renders with locked copy
5. Force cron tick at cap - response JSON has live quota_refused counter
6. Trip cap and have booker reschedule via token URL - reschedule commits, booker stays generic

These are the only blockers to flipping status from human_needed to passed.

---

## Gaps Summary

No structural gaps. Every must-have from each plan frontmatter is satisfied in the codebase.

- All 7 email-sending paths route through checkAndConsumeQuota
- v1.1 carve-out comment is gone
- Refusals never silently drop (emailFailed/errorCode propagated, save-and-flag, quota_refused counter)
- No partial batches (cron loop is mid-batch-resilient)
- Every refusal writes the 5-field PII-free structured log
- Booker-facing surfaces preserve LD-07 booker-neutrality

21-test refuse-send suite + 5 quota-guard regression tests pass.

---

Verified: 2026-05-04T22:27:00Z
Verifier: Claude (gsd-verifier)
