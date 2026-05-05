# Phase 31: Email Hard Cap Guard - Research

**Researched:** 2026-05-04
**Domain:** Gmail SMTP quota guard — extending an existing TypeScript module to cover all email paths, structured PII-free logging, and owner-visible error surfaces.
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 31 extends `lib/email-sender/quota-guard.ts` from a signup-only guard to a system-wide refuse-send guard covering every email path: booking confirmation, owner notification, reminder (cron + manual + immediate), cancel, and reschedule. The existing module is well-structured and already has the building blocks (`checkAndConsumeQuota`, `QuotaExceededError`, `getDailySendCount`, `SIGNUP_DAILY_EMAIL_CAP`); the work is to extend its `EmailCategory` type, wire it into the five email-sending modules that currently bypass it, handle the error at each call site, surface inline errors to the owner on manual triggers, and add a dashboard alert for booker-facing confirmation refusals.

The v1.1 carve-out is explicit and documented in `lib/email-sender/index.ts` (line 75): "Booking and reminder paths bypass the guard intentionally — they have their own retry semantics." Phase 31 closes that carve-out.

**Primary recommendation:** Add a thin `checkAndConsumeQuota(category)` call at the top of each of the five email-sending functions (or their callers), propagate `QuotaExceededError` up to owner-triggered call sites, and add a DB column (`email_confirmed = false` flag on the `bookings` table) to surface unconfirmed confirmations on the `/app/bookings` dashboard list.

---

## Standard Stack

This phase introduces no new npm packages. Everything needed is already in the codebase.

### Core (already installed)
| Item | Version/Location | Purpose |
|------|-----------------|---------|
| `lib/email-sender/quota-guard.ts` | Existing | The guard — extend, don't replace |
| `email_send_log` table | Supabase (migration `20260428120003`) | Counts sends per UTC day |
| `QuotaExceededError` | Existing class in quota-guard | Typed refusal signal — catch at call sites |
| Vitest + `vi.mock` | Existing test suite | Test framework for new quota tests |
| `console.error` | Node built-in | Log destination (see recommendation below) |

### No New Installs Needed
All tooling is in place. Phase 31 is a pure TypeScript/logic change with a small schema migration.

---

## Architecture Patterns

### Existing quota-guard shape (HIGH confidence — directly read)

```typescript
// lib/email-sender/quota-guard.ts — key exports
export const SIGNUP_DAILY_EMAIL_CAP = 200;
export type EmailCategory = "signup-verify" | "signup-welcome" | "password-reset" | "email-change" | "other";
export class QuotaExceededError extends Error { constructor(public count: number, public cap: number) }
export async function getDailySendCount(): Promise<number>  // reads email_send_log
export async function checkAndConsumeQuota(category: EmailCategory): Promise<void>  // throws QuotaExceededError if count >= 200
```

The 80% warn log (lines 65-73) uses an in-memory `warnedDays` Set for once-per-day dedup. This MUST stay exactly as-is — do not move, wrap, or restructure it.

`checkAndConsumeQuota` pattern:
1. `getDailySendCount()` — queries `email_send_log` for today's UTC rows
2. If `count >= 200` → throw `QuotaExceededError(count, 200)`
3. If `count >= 160` (80%) → log `GMAIL_SMTP_QUOTA_APPROACHING` (once/day)
4. Insert row into `email_send_log` with `{ category }`
5. If insert fails → log + allow (fail-open on insert error)

### v1.1 carve-out location (HIGH confidence)

The carve-out comment lives in `lib/email-sender/index.ts` lines 73-76:
```
// QUOTA GUARD CONTRACT (Phase 10): signup-side callers MUST call checkAndConsumeQuota()
// ...Booking and reminder paths bypass the guard intentionally...
```

Phase 31 removes this carve-out by wiring up all paths.

### email_send_log table schema (HIGH confidence — directly read)

```sql
create table email_send_log (
  id bigserial primary key,
  sent_at timestamptz not null default now(),
  category text not null check (category in (
    'signup-verify', 'signup-welcome', 'password-reset', 'email-change',
    -- bookings/reminders intentionally NOT listed; they bypass the guard.
    'other'
  ))
);
```

The `CHECK` constraint on `category` will need a migration to add the new booking-side category values. This is a required DB migration for Phase 31.

---

## All Email Paths — Current State

### 1. `lib/email/send-booking-emails.ts` — booking confirmation + owner notification
- **What:** Orchestrator that calls `sendBookingConfirmation()` + `sendOwnerNotification()` via `Promise.allSettled`
- **Caller:** `app/api/bookings/route.ts` inside `after(() => sendBookingEmails(...))` — fired post-201, no await
- **Route through quota-guard:** NO
- **Error shape:** Errors caught by `.catch()` wrappers per task, logged, swallowed — send failure does NOT roll back the booking
- **Phase 31 impact:** Need to add quota check; since this is `fire-and-forget` via `after()`, errors cannot propagate back to the HTTP response. The booking is already confirmed (201 returned). This is the key "save-and-flag" path.

### 2. `lib/email/send-reminder-booker.ts` — reminder email
- **What:** Sends reminder email to booker. Called in three contexts:
  a. Cron: `app/api/cron/send-reminders/route.ts` — sequential `for` loop inside `after()`
  b. Immediate (in-window booking): `app/api/bookings/route.ts` inside second `after()` block
  c. Manual owner trigger: `app/(shell)/app/bookings/[id]/_lib/actions.ts` → `sendReminderForBookingAction()` — `await`-ed, errors propagated to UI
- **Route through quota-guard:** NO
- **Error shape:**
  - Cron: `try/catch` per booking, continues to next; returns 200 regardless
  - Immediate: `after()` wrapper, errors not surfaced
  - Manual: `try/catch` → `return { error: "Reminder send failed." }` → surfaced as `toast.error` in `day-detail-row.tsx`
- **Phase 31 impact:** Three distinct contexts need different handling.

### 3. `lib/email/send-cancel-emails.ts` — booker cancel email + owner cancel notification
- **What:** Orchestrator calling `sendBookerCancelEmail()` + `sendOwnerCancelEmail()` via `Promise.allSettled`
- **Caller:** `lib/bookings/cancel.ts` inside `after(() => sendCancelEmails(...))` — post-DB-commit
- **Route through quota-guard:** NO
- **Error shape:** Per-sender `.catch()` → `console.error`, errors swallowed
- **Phase 31 impact:** Fire-and-forget path; similar to send-booking-emails.

### 4. `lib/email/send-reschedule-emails.ts` — booker reschedule + owner reschedule notification
- **What:** Orchestrator calling `sendBookerRescheduleEmail()` + `sendOwnerRescheduleEmail()` via `Promise.allSettled`
- **Caller:** `lib/bookings/reschedule.ts` inside `after(() => sendRescheduleEmails(...))`
- **Route through quota-guard:** NO
- **Error shape:** Per-sender `.catch()` → `console.error`, errors swallowed
- **Phase 31 impact:** Fire-and-forget path; similar to cancel.

### 5. `lib/email/send-owner-notification.ts` — new booking notification to owner
- **What:** Sends owner notification on new booking
- **Caller:** `send-booking-emails.ts` (see #1 above)
- **Route through quota-guard:** NO
- **Phase 31 impact:** Part of the booking-emails orchestrator; handled when #1 is handled.

---

## Booking Creation Flow (HIGH confidence)

End-to-end in `app/api/bookings/route.ts`:

1. Validate → rate-limit → Turnstile → resolve event_type + account → generate tokens
2. **INSERT booking row** (slot_index retry loop for capacity) → on success, `booking` is set
3. Return **201** immediately
4. `after(() => sendBookingEmails(...))` — confirmation + owner notification sent post-response
5. If `start_at` within 24h: immediate reminder via second `after()` block

**Current behavior if email fails:** Booking is saved (201 returned), email failure is logged and swallowed. The booking has no flag indicating email was unsent.

**Phase 31 discretion call — recommendation: save-and-flag**

Reject outright (option A) would be wrong — the slot is already locked by the DB insert; rejecting the booking would orphan a claimed slot and confuse the booker (who might see the slot taken but their booking rejected). Save-and-queue (option C) introduces a new retry infrastructure not warranted for v1.

Save-and-flag (option B) is correct: the booking saves, 201 returns, but if the quota guard fires in `after()`, write a flag to the DB so the dashboard can show an alert. Specifically: add a `boolean NOT NULL DEFAULT true` column `confirmation_email_sent` to `bookings`. When quota refusal occurs in `sendBookingEmails`, set it to `false` via a separate admin UPDATE. The bookings list at `/app/bookings` can then surface a count or badge for rows where `confirmation_email_sent = false`.

**Held-slot fate — recommendation: no change**

The slot is committed to the DB (capacity index). There is no "held but not confirmed" lifecycle state. Since the booking is saved, the slot remains taken whether or not the email sent. This is the correct behavior — the owner can manually send confirmation via Gmail as indicated by the error UX. No new lifecycle needed.

---

## Reminder Cron Analysis (HIGH confidence)

**File:** `app/api/cron/send-reminders/route.ts`

**Schedule:** `vercel.json` — `"0 13 * * *"` (daily at 13:00 UTC) + cron-job.org hourly driver

**Loop shape:**
- Scan all confirmed bookings with `reminder_sent_at IS NULL` in next 24h
- Per row: CAS UPDATE (`reminder_sent_at = now()`) with token rotation
- Then `after(async () => { for (const c of claimed) { ... } })` — sequential sends, each in `try/catch`

**Current failure handling:** `try/catch` per send; `console.error` on failure; `reminder_sent_at` is NOT cleared (intentional — prevents retry spam). Continues to next booking. Returns `200 { ok: true, scanned, claimed }` regardless of email send failures.

**Phase 31 discretion call — recommendation for cron mid-batch behavior:**

When quota is hit mid-batch:
1. The claim UPDATE has already stamped `reminder_sent_at` — do NOT clear it (existing posture preserved)
2. Catch `QuotaExceededError` per booking in the send loop; log structured refusal entry (console.error with required 5 fields)
3. Continue the loop (check remaining bookings — all will also fail at cap, but at least structured logs accumulate per booking)
4. Return `200 { ok: true, scanned, claimed, reminders_sent, quota_refused }` — do NOT return 4xx/5xx

**Rationale for 200 exit code:** Vercel Cron and cron-job.org treat non-2xx as retries (Vercel will alert on repeated failures). The job itself succeeded (claims made, audit rows inserted); email failure is operational, not a job failure. Returning 4xx would cause the cron platform to retry unnecessarily. The v1 posture (log + accept that some reminders won't send when cap is hit) is the right call — no skipped-reminder retry queue needed.

**Batch pre-flight helper (EMAIL-22/23 for Phases 32/33) — recommendation: bundle a minimal version in Phase 31**

Phases 32 (inverse date overrides) and 33 (pushback) both need `getRemainingQuota(): Promise<number>` — the count of sends remaining today. This is a one-liner atop the existing `getDailySendCount()`:

```typescript
export async function getRemainingDailyQuota(): Promise<number> {
  const count = await getDailySendCount();
  return Math.max(0, SIGNUP_DAILY_EMAIL_CAP - count);
}
```

This is a trivially small addition — 3 lines + export. Deferring it to Phase 32 just means Phase 32's planner starts by writing the same 3 lines. Bundle it in Phase 31 as part of the quota-guard module extension.

---

## Owner-Facing Error Surfaces

### Manual reminder trigger (DayDetailRow) — HIGH confidence

In `app/(shell)/app/_components/day-detail-row.tsx`, `handleReminderConfirm()` awaits `sendReminderForBookingAction(booking.id)` and surfaces errors via `toast.error(message)`. This is the WRONG surface for Phase 31 — the CONTEXT decision is **inline on the action**, not a global toast.

The action today returns `{ error: string }`. Phase 31 needs to return quota-specific error copy: `"Daily email quota reached (200/200). Resets at UTC midnight. You can use normal Gmail to send the reminder manually."` The component needs to replace the toast with inline error text adjacent to the "Send reminder" button in the AlertDialog footer.

### Cancel email (owner-triggered via cancel-button.tsx) — HIGH confidence

In `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx`, errors surface as `toast.error(message)`. Cancel emails fire via `after()` in `lib/bookings/cancel.ts`, so there is no synchronous error return path for email failure — the cancel DB commit has already happened. The pattern must be: the cancel succeeds, the toast says "Booking cancelled. Both parties have been notified." — but if the quota guard fires, the toast should say "Booking cancelled. Email could not be sent (daily quota reached). Use normal Gmail to notify the booker."

To achieve this: `cancelBooking()` currently returns `{ ok: true }` — it needs to optionally include an `emailFailed?: true` flag if the quota was hit, so the `cancelBookingAsOwner` Server Action can pass a differentiated result to the UI.

However, since cancel emails use `after()`, quota errors can only be detected asynchronously. This creates a design tension: the 201/200 response is already returned before `after()` runs. The simplest path: keep the existing `after()` pattern but replace the swallowed errors with a direct `sendCancelEmails()` call (no `after()`) — i.e., `await sendCancelEmails(...)` — in the cancel path so quota errors CAN be surfaced synchronously.

Alternative: keep `after()` but write a DB flag similar to `confirmation_email_sent` for cancel notifications. This adds another migration.

**Recommended approach:** For cancel and reschedule, switch from fire-and-forget `after()` to `await sendCancelEmails()` / `await sendRescheduleEmails()` directly inside the `cancelBooking()` / `rescheduleBooking()` functions. The existing "email failure must not roll back the booking" constraint was protecting against SMTP errors — but QuotaExceededError is a known, predictable condition that should be surfaced. This lets quota errors bubble synchronously to the owner UI without a new DB column.

**Tradeoff:** The response to the owner will be slightly slower (waits for the quota check before returning). At v1 volume, this is acceptable.

### Booker-facing confirmation failure — HIGH confidence

For the `after(() => sendBookingEmails(...))` path, quota errors fire after 201 is returned. The booker sees the confirmation page. The owner needs to be informed.

Implementation: In `sendBookingEmails()`, catch `QuotaExceededError` from either send task (currently swallowed). When caught, perform a service-role UPDATE on `bookings` setting `confirmation_email_sent = false`. The `/app/bookings` page query already reads from `bookings` — adding a filter for `confirmation_email_sent = false` and surfacing a count banner at the top of the bookings page is a contained addition.

**Migration:** Add `confirmation_email_sent boolean NOT NULL DEFAULT true` to `bookings`. Default true so existing rows are unaffected.

---

## PII-Free Observability Discipline (HIGH confidence)

From v1.4 (Phase 27) pattern, confirmed in multiple PLAN.md and SUMMARY.md files:

**PII-free means:** Log lines contain ONLY structural identifiers:
- `account_id` (UUID — not a person)
- `booking_id` (UUID — not a person)
- `event_type_id` (UUID — not a person)
- `code` (string enum)
- Counts, caps, timestamps

**Never in logs:**
- `booker_email`
- `booker_name`
- `booker_phone`
- `ip` address
- Any field from the booker's submitted answers

The existing quota log at line 69 logs `[GMAIL_SMTP_QUOTA_APPROACHING] ${count}/${SIGNUP_DAILY_EMAIL_CAP}` — no PII. The new refusal log must follow the same shape.

**Required log shape for EMAIL-25:**
```typescript
console.error("[EMAIL_QUOTA_EXCEEDED]", {
  code: "EMAIL_QUOTA_EXCEEDED",
  account_id: accountId,       // string UUID
  sender_type: category,       // EmailCategory enum value
  count: quotaErr.count,       // number
  cap: quotaErr.cap,           // number
});
```

---

## EmailCategory Taxonomy — Recommendation (HIGH confidence)

**Current categories** (in `email_send_log` CHECK constraint and TS type):
```
"signup-verify" | "signup-welcome" | "password-reset" | "email-change" | "other"
```

**New categories needed for Phase 31:**

| Category | Email Function | Sender Type |
|----------|---------------|-------------|
| `"booking-confirmation"` | `sendBookingConfirmation` | booker |
| `"owner-notification"` | `sendOwnerNotification` | owner |
| `"reminder"` | `sendReminderBooker` | booker |
| `"cancel-booker"` | `sendBookerCancelEmail` | booker |
| `"cancel-owner"` | `sendOwnerCancelEmail` | owner |
| `"reschedule-booker"` | `sendBookerRescheduleEmail` | booker |
| `"reschedule-owner"` | `sendOwnerRescheduleEmail` | owner |

**Recommendation:** Use the per-function taxonomy above (7 new values). This gives exact log granularity for which email type hit the cap — more useful in production than a coarser grouping like "booking" or "booker/owner." The `email_send_log.category` CHECK constraint migration must add all 7 values.

The TS `EmailCategory` type in `quota-guard.ts` must be extended to match.

---

## Log Destination — Recommendation (HIGH confidence)

**Options considered:**

1. `console.error` only — existing pattern for all logs in this codebase; Vercel surfaces these in the Functions log tab. No migration.
2. New DB table — adds migration complexity, RLS, and query overhead for what is observability-only data. Not warranted.
3. Reuse `email_send_log` — misfit: `email_send_log` counts SUCCESSFUL sends; refusals are the opposite. Mixing them would corrupt the daily counter query.

**Recommendation: `console.error` only.** The existing `email_send_log` table is a counter, not a general audit log. Creating a new DB table for refusal logs is over-engineering at v1 volume. Vercel's Functions log gives the owner visibility when needed. This matches v1.4 observability discipline (all 23P01 logs are `console.error`).

---

## Boundary Semantics — Recommendation (HIGH confidence)

**Three options:**

| Option | Behavior | Implementation |
|--------|----------|----------------|
| Refuse-the-200th | The send that would take count to 200 is refused | `if (count >= 200)` — current code |
| Refuse-at-200 | The 200th send succeeds; the 201st is refused | `if (count > 200)` |
| Atomic | DB-level transaction to prevent race between count-check and insert | Requires `SELECT FOR UPDATE` or CAS logic |

**Current code:** `if (count >= SIGNUP_DAILY_EMAIL_CAP)` → refuses when count is already 200. This means the 200th send is refused (refuse-the-200th). In other words, at count=199 the send goes through; at count=200 it's refused. This is actually correct: it means the cap is "allow up to 199 sends, refuse on 200."

Wait — re-reading the code: `getDailySendCount()` returns the count of rows ALREADY in `email_send_log` (rows already sent), and the INSERT happens AFTER the check. So when count=199, the check passes, then the INSERT runs making it 200 total. When count=200, the check refuses — no insert. So the system allows exactly 200 sends and refuses the 201st attempt. This is the **allow-200, refuse-at-201** behavior, which maps to the "refuse-at-200" description in the context (i.e., the 200th slot has been filled).

**Recommendation:** Keep the existing `count >= SIGNUP_DAILY_EMAIL_CAP` boundary unchanged. It correctly implements allow-200, refuse-any-more. Do not change to atomic — the v1.1 race-tolerance posture is acceptable per CONTEXT, and the blast radius of a race (sending 201 emails on a very active day) is minimal.

---

## Common Pitfalls

### Pitfall 1: Changing the existing 80% warn log
**What goes wrong:** The in-memory `warnedDays` Set is in module scope. Restructuring quota-guard.ts could accidentally move or duplicate it, causing the once-per-day dedup to break.
**Prevention:** Treat lines 65-73 as a locked section. Only add new exports/functions around them; do not modify.

### Pitfall 2: Calling `checkAndConsumeQuota` AFTER the email is actually sent
**What goes wrong:** The count is incremented even when the email silently fails (e.g., SMTP error). This is actually the correct behavior — a failed SMTP send should still count (nodemailer may have submitted the message before the error was returned). But if the order were reversed (insert → check → send), quota could be consumed without a send even when the guard throws.
**Prevention:** Keep the existing pattern: `checkAndConsumeQuota` → `sendEmail`. The INSERT into `email_send_log` before the actual SMTP call is intentional.

### Pitfall 3: Forgetting the DB migration for new category values
**What goes wrong:** `checkAndConsumeQuota("booking-confirmation")` fails with a DB CHECK constraint violation, causing every booking email to fail with a cryptic error rather than the expected behavior.
**Prevention:** The migration extending `email_send_log.category` CHECK must ship BEFORE or simultaneously with the code change.

### Pitfall 4: Using `after()` for owner-triggered sends that need error feedback
**What goes wrong:** If cancel/reschedule emails stay wrapped in `after()`, the quota error fires after the HTTP response is returned — the owner sees "cancelled successfully" but the email was never sent.
**Prevention:** For owner-triggered actions that need inline error feedback (cancel, reschedule from owner UI), switch to `await` instead of `after()`. Only fire-and-forget paths (booking confirmation post-201) should stay in `after()`.

### Pitfall 5: Surfacing quota internals to bookers
**What goes wrong:** The booker sees "Daily email quota reached (200/200)" — violates LD-07 booker-neutrality lock.
**Prevention:** All quota-specific error copy must stay on the owner surface only. Booker-facing paths return generic copy or nothing.

### Pitfall 6: Double-counting in the cron batch
**What goes wrong:** If `checkAndConsumeQuota` is called once per booking in the cron loop, each call hits the DB for a fresh count — correct. But if the quota guard is called at batch-start only (checking total remaining for the batch), sends after the first few would bypass the per-send guard.
**Prevention:** Call `checkAndConsumeQuota` per individual send, inside the loop, not once at batch start.

---

## Code Examples

### Extending EmailCategory (quota-guard.ts)
```typescript
// Source: lib/email-sender/quota-guard.ts — extend the existing union
export type EmailCategory =
  | "signup-verify"
  | "signup-welcome"
  | "password-reset"
  | "email-change"
  | "other"
  // Phase 31: booking/reminder paths now go through the guard
  | "booking-confirmation"
  | "owner-notification"
  | "reminder"
  | "cancel-booker"
  | "cancel-owner"
  | "reschedule-booker"
  | "reschedule-owner";
```

### Structured refusal log (PII-free)
```typescript
// Pattern from Phase 27 (27-02-SUMMARY.md / route.ts)
console.error("[EMAIL_QUOTA_EXCEEDED]", {
  code: "EMAIL_QUOTA_EXCEEDED",
  account_id: accountId,
  sender_type: category,
  count: err.count,
  cap: err.cap,
});
```

### Pre-flight helper for Phases 32/33 (bundle in 31)
```typescript
// Add to lib/email-sender/quota-guard.ts
export async function getRemainingDailyQuota(): Promise<number> {
  const count = await getDailySendCount();
  return Math.max(0, SIGNUP_DAILY_EMAIL_CAP - count);
}
```

### Wiring quota guard in send-booking-confirmation.ts (example pattern)
```typescript
// Before sendEmail() call, add:
import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";

// In sendBookingConfirmation():
try {
  await checkAndConsumeQuota("booking-confirmation");
} catch (err) {
  if (err instanceof QuotaExceededError) {
    // structured log — see log pattern above
    throw err; // re-throw so caller can handle
  }
  throw err;
}
await sendEmail({ ... });
```

### Migration for new category values
```sql
-- Phase 31: extend email_send_log.category CHECK to include booking paths
ALTER TABLE email_send_log DROP CONSTRAINT email_send_log_category_check;
ALTER TABLE email_send_log ADD CONSTRAINT email_send_log_category_check CHECK (category IN (
  'signup-verify', 'signup-welcome', 'password-reset', 'email-change', 'other',
  'booking-confirmation', 'owner-notification', 'reminder',
  'cancel-booker', 'cancel-owner', 'reschedule-booker', 'reschedule-owner'
));
```

---

## Cron Behavior Design (Recommendation)

The cron at `app/api/cron/send-reminders/route.ts` currently:
- Claims bookings in a `for` loop (sequential CAS UPDATEs)
- Fires all emails in `after()` block — sequential `try/catch` loop

**Phase 31 change:** Inside the `after()` send loop, call `checkAndConsumeQuota("reminder")` before each `sendReminderBooker()`. When `QuotaExceededError` is caught:
1. Log structured refusal (per EMAIL-25)
2. Do NOT clear `reminder_sent_at` (already stamped in the claim step — v1 posture)
3. Continue to next booking (check remaining — all will also fail at cap; log each)
4. Track `quota_refused` count

Return `200 { ok: true, scanned, claimed, reminders_sent, quota_refused }` — not 500. Vercel cron does not treat 200 with quota_refused as a problem.

**Rationale:** `reminder_sent_at` was stamped before the send. The decision to not un-stamp it is the existing v1 posture — prevents retry spam. The consequence is that bookings whose reminder was quota-refused will not get a reminder from the next cron tick either. This is an accepted tradeoff per CONTEXT (deferred ideas: "Skipped-reminder retry queue... only worth doing if... loses enough reminders to matter"). Manual remediation via the dashboard "Send reminder" button is the recovery path.

---

## Dashboard Alert for Unconfirmed Confirmations

**Current `/app/bookings` page structure:** `app/(shell)/app/bookings/page.tsx` renders `BookingsFilters` + `BookingsTable` + `BookingsPagination`. Data is fetched via `queryBookings()` from `app/(shell)/app/bookings/_lib/queries.ts`.

**Phase 31 addition:** 
1. Add `confirmation_email_sent boolean NOT NULL DEFAULT true` to `bookings` table (migration)
2. When quota fires in `sendBookingEmails()`, UPDATE the just-created booking row with `confirmation_email_sent = false`
3. In `queryBookings()`, count rows where `confirmation_email_sent = false` (status='confirmed', no additional filter — any time horizon)
4. In `BookingsPage`, if count > 0, render a banner above the table:
   ```
   [N booking(s) today have unsent confirmation emails — quota was reached.
    Use Gmail to notify these bookers manually. (link: filter to show unconfirmed)]
   ```

This surfaces on the owner dashboard at `/app/bookings` exactly as the CONTEXT decision requires: "dashboard alert on the owner surface showing how many bookings today have unsent confirmations."

The banner is error-only (no persistent counter) — consistent with CONTEXT decision "no quota counter, no 80% banner."

---

## Existing Tests

**`tests/quota-guard.test.ts`** — 4 tests using `vi.mock("@/lib/supabase/admin")`:
1. Below threshold — allows send
2. At 80% — allows send + logs warning
3. At cap — throws `QuotaExceededError`
4. DB error — fails open

**Framework:** Vitest with the `vi.mock()` closure pattern. The mock intercepts `createAdminClient()` and exposes `setCountResult()` / `setInsertResult()` closures for per-test control.

**Phase 31 tests to add:**
- New category values accepted (no CHECK violation)
- `checkAndConsumeQuota("booking-confirmation")` throws at cap
- `getRemainingDailyQuota()` returns correct remainder
- Each new category logs correct structured refusal line
- Cron loop continues after first quota refusal (loop doesn't break)

**Mock strategy:** The existing `tests/__mocks__/email-sender.ts` mocks `sendEmail` at the `@/lib/email-sender` alias level. For quota tests, the direct import path `../lib/email-sender/quota-guard` is used (bypasses the alias mock) — same pattern as existing `tests/quota-guard.test.ts`.

---

## Open Questions

1. **`confirmation_email_sent` column — should it also cover reminder/cancel/reschedule?**
   - What we know: The CONTEXT only specifies a dashboard alert for BOOKER CONFIRMATION failures. Cancel/reschedule failures go to the owner inline (since those are owner-triggered and can await the result).
   - Recommendation: Add `confirmation_email_sent` only for booking confirmations. Cancel/reschedule inline error is the sufficient surface for those paths.

2. **The `after()` → `await` switch for cancel/reschedule — scope creep risk?**
   - What we know: The `after()` pattern in `cancelBooking()` and `rescheduleBooking()` exists to keep the worker alive past the HTTP response. Switching to `await` would slightly increase response latency.
   - Recommendation: Switch to `await` for the quota-check step only, keeping `after()` for the actual SMTP send. That is: check quota synchronously → if passes, fire SMTP via `after()` → if fails, surface error inline. This preserves the "no latency from SMTP" posture while making the quota gate synchronous.
   - Alternative: Keep `after()` everywhere; add a DB flag per cancel/reschedule as well. Higher migration cost.

3. **Cron accounting: are claimed-but-quota-refused reminders counted in `email_send_log`?**
   - What we know: `checkAndConsumeQuota` inserts into `email_send_log` BEFORE sending. If the quota is hit (count >= 200), it THROWS — no insert. So quota-refused emails do NOT increment the counter. Good.
   - But: the claim step (SET `reminder_sent_at`) happens BEFORE `checkAndConsumeQuota` in the cron flow. This means `reminder_sent_at` is stamped even for quota-refused sends. This is the accepted v1 posture — no retry.

---

## Sources

### Primary (HIGH confidence)
- Direct read of `lib/email-sender/quota-guard.ts` — complete module
- Direct read of `lib/email-sender/index.ts` — v1.1 carve-out comment location confirmed
- Direct read of `supabase/migrations/20260428120003_phase10_email_send_log.sql` — schema confirmed
- Direct read of `app/api/cron/send-reminders/route.ts` — cron loop shape confirmed
- Direct read of `app/api/bookings/route.ts` — booking creation + after() pattern confirmed
- Direct read of `lib/bookings/cancel.ts` + `reschedule.ts` — after() usage confirmed
- Direct read of `lib/email/send-booking-emails.ts`, `send-booking-confirmation.ts`, `send-owner-notification.ts`, `send-cancel-emails.ts`, `send-reschedule-emails.ts`, `send-reminder-booker.ts` — all email-sending modules confirmed
- Direct read of `app/(shell)/app/_components/day-detail-row.tsx` — manual reminder UI confirmed
- Direct read of `app/(shell)/app/bookings/[id]/_lib/actions.ts` — sendReminderForBookingAction confirmed
- Direct read of `tests/quota-guard.test.ts` — existing test framework confirmed
- Direct read of `.planning/phases/27-slot-correctness-db-layer-enforcement/` — PII-free discipline confirmed
- Direct read of `vercel.json` — cron schedule confirmed

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md EMAIL-21/24/25 text — requirements text confirmed
- CONTEXT.md Phase 31 — all decisions confirmed from the context file

---

## Metadata

**Confidence breakdown:**
- Quota-guard current shape: HIGH — directly read
- Email path inventory: HIGH — all 5 modules read + callers traced
- Booking creation flow: HIGH — route.ts read completely
- Cron behavior: HIGH — route.ts read completely
- Owner UI surfaces: HIGH — day-detail-row.tsx + cancel-button.tsx read
- Dashboard structure: HIGH — bookings/page.tsx + queries.ts read
- Test framework: HIGH — quota-guard.test.ts + vitest.config.ts read
- PII discipline: HIGH — Phase 27 plans + summaries read

**Research date:** 2026-05-04
**Valid until:** Stable — no external libraries involved; codebase-only research

---

## Decision Summary for Planner

| Discretion Area | Recommendation |
|----------------|----------------|
| Booking creation on refusal | Save-and-flag: booking saves, add `confirmation_email_sent = false` DB column, surface on `/app/bookings` dashboard |
| Held-slot fate | No change — slot stays claimed regardless of email outcome |
| Cron mid-batch | Per-send quota check; log refusals; stamp `reminder_sent_at` stays (v1 posture); return 200 with `quota_refused` count |
| HTTP exit code on cron refusal | 200 — not 4xx/5xx |
| Batch pre-flight helper | Bundle `getRemainingDailyQuota()` in Phase 31 — 3 lines, contained |
| EmailCategory taxonomy | 7 new per-function values; DB migration required |
| Log destination | `console.error` only — reuse Vercel Functions log |
| Extra log fields | Use exactly the 5 required fields (`code`, `account_id`, `sender_type`, `count`, `cap`) |
| Boundary semantics | Keep existing `count >= 200` — already correct (allow-200, refuse-at-201) |
