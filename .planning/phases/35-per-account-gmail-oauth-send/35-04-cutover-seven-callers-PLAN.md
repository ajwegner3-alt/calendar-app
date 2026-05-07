---
phase: 35-per-account-gmail-oauth-send
plan: 04
type: execute
wave: 4
depends_on: ["35-01", "35-03"]
files_modified:
  - lib/email/send-booking-confirmation.ts
  - lib/email/send-owner-notification.ts
  - lib/email/send-reminder-booker.ts
  - lib/email/send-cancel-emails.ts
  - lib/email/send-reschedule-emails.ts
  - lib/email/send-booking-emails.ts
  - app/api/cron/send-reminders/route.ts
  - lib/bookings/cancel.ts
  - lib/bookings/reschedule.ts
  - app/api/bookings/route.ts
  - tests/send-booking-emails.test.ts
  - tests/send-cancel-emails.test.ts
  - tests/send-reschedule-emails.test.ts
  - tests/send-reminder-booker.test.ts
autonomous: true

must_haves:
  truths:
    - "All 7 transactional senders accept accountId and obtain their EmailClient via getSenderForAccount(accountId)"
    - "All 7 senders call checkAndConsumeQuota(category, accountId) — quota is per-account"
    - "On REFUSED_SEND_ERROR_PREFIX result, the booking orchestrator sets confirmation_email_sent=false (mirrors QuotaExceededError handling)"
    - "Booking still succeeds when send is refused (slot reserved, booker sees normal confirmation page)"
    - "Zero direct sendEmail() singleton imports remain in app/, lib/email/, lib/bookings/"
    - "Welcome email path (lib/onboarding/welcome-email.ts) is NOT touched — stays on singleton until Phase 36"
  artifacts:
    - path: "lib/email/send-booking-emails.ts"
      provides: "Orchestrator that threads accountId into both confirmation + owner-notification calls and treats oauth_send_refused like quota refusal"
      contains: "getSenderForAccount"
    - path: "lib/email/send-booking-confirmation.ts"
      provides: "Takes accountId, uses sender from factory"
      contains: "getSenderForAccount"
    - path: "lib/email/send-owner-notification.ts"
      provides: "Takes accountId, uses sender from factory"
      contains: "getSenderForAccount"
    - path: "lib/email/send-reminder-booker.ts"
      provides: "Takes accountId, uses sender from factory"
      contains: "getSenderForAccount"
    - path: "lib/email/send-cancel-emails.ts"
      provides: "Takes accountId, both inner functions use sender from factory"
      contains: "getSenderForAccount"
    - path: "lib/email/send-reschedule-emails.ts"
      provides: "Takes accountId, both inner functions use sender from factory"
      contains: "getSenderForAccount"
  key_links:
    - from: "All 7 lib/email/* senders"
      to: "lib/email-sender/account-sender.ts:getSenderForAccount"
      via: "await getSenderForAccount(accountId); await sender.send({...})"
      pattern: "getSenderForAccount\\("
    - from: "lib/email/send-booking-emails.ts orchestrator"
      to: "bookings.confirmation_email_sent flag"
      via: "Detect oauth_send_refused result and set confirmation_email_sent=false (same branch as QuotaExceededError)"
      pattern: "REFUSED_SEND_ERROR_PREFIX|oauth_send_refused"
    - from: "All 7 senders"
      to: "lib/email-sender/quota-guard.ts:checkAndConsumeQuota"
      via: "Pass (category, accountId) — both arguments"
      pattern: "checkAndConsumeQuota\\([^,]+,\\s*\\w"
---

<objective>
Cutover all 7 transactional email send paths from the centralized `sendEmail()` singleton to per-account `getSenderForAccount(accountId)`. Thread `accountId` through every caller (booking route, cron route, cancel/reschedule libs). Update the booking orchestrator to handle OAuth refusal the same way it handles quota refusal (booking succeeds, `confirmation_email_sent = false`).

Per RESEARCH §Pattern 5 + CONTEXT decision: single commit, no feature flag (single-tenant nsi during cutover; matches CP-03 from Phase 28).

Purpose: This is the actual EMAIL-26/27/28/32 delivery. Until this plan ships, the factory exists but nobody calls it.

Output: All 7 senders + their callers updated. `grep -rn "from.*email-sender/index\|sendEmail" app/ lib/email lib/bookings` returns zero direct singleton imports (only `lib/onboarding/welcome-email.ts` keeps its singleton import — explicitly out of scope per CONTEXT). Tests updated and green.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@.planning/phases/35-per-account-gmail-oauth-send/35-01-SUMMARY.md
@.planning/phases/35-per-account-gmail-oauth-send/35-03-SUMMARY.md
@lib/email/send-booking-emails.ts
@lib/email/send-booking-confirmation.ts
@lib/email/send-owner-notification.ts
@lib/email/send-reminder-booker.ts
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts
@lib/bookings/cancel.ts
@lib/bookings/reschedule.ts
@app/api/cron/send-reminders/route.ts
@app/api/bookings/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate the 5 leaf senders + thread accountId through orchestrator</name>
  <files>lib/email/send-booking-confirmation.ts, lib/email/send-owner-notification.ts, lib/email/send-reminder-booker.ts, lib/email/send-cancel-emails.ts, lib/email/send-reschedule-emails.ts, lib/email/send-booking-emails.ts</files>
  <action>
    For each of the 5 leaf senders below, apply the same migration pattern:

    **Pattern:**
    1. Add `accountId: string` to the function's input type/parameters (whichever it uses).
    2. Replace `import { sendEmail } from "@/lib/email-sender"` with `import { getSenderForAccount, REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender"`.
    3. Replace `await checkAndConsumeQuota("category")` with `await checkAndConsumeQuota("category", accountId)`.
    4. Replace `await sendEmail({...})` with:
       ```typescript
       const sender = await getSenderForAccount(accountId);
       const result = await sender.send({...});
       ```
    5. Update the existing "DO NOT pass `from`" comment to: `// from is owned by the OAuth factory (must equal authenticated Gmail address); cannot be overridden.` Remove `from` if any caller passes it.
    6. The function's return value (whatever shape it has — usually some boolean or result) should now propagate `result.success` or include the `result.error` (existing functions already return success/error info; preserve their existing contract, just sourcing from `result` instead of the old `sendEmail` return).

    **Files:**
    - `lib/email/send-booking-confirmation.ts` — add `accountId` to its input args type.
    - `lib/email/send-owner-notification.ts` — add `accountId` to its input args type.
    - `lib/email/send-reminder-booker.ts` — add `accountId` to its input args type.
    - `lib/email/send-cancel-emails.ts` — both inner functions (`sendCancelBookerEmail`, `sendCancelOwnerEmail` or whatever the file exports) take `accountId`.
    - `lib/email/send-reschedule-emails.ts` — same pattern, both inner reschedule functions take `accountId`.

    **Then update `lib/email/send-booking-emails.ts` orchestrator:**
    - It already has `account.id` from its inputs.
    - Pass `account.id` into both `sendBookingConfirmation(...)` and `sendOwnerNotification(...)`.
    - Where the existing code branches on `QuotaExceededError` to set `confirmation_email_sent = false`, ALSO check for the new refusal: import `REFUSED_SEND_ERROR_PREFIX` and treat any send result whose `error?.startsWith(REFUSED_SEND_ERROR_PREFIX)` is true as the same "soft fail — flag and continue" path. Pseudo-code:
      ```typescript
      const result = await sendBookingConfirmation({ ..., accountId: account.id });
      if (!result.success && result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)) {
        // Treat like quota refusal: booking still succeeds, flag it, owner sees in bookings list.
        confirmationSent = false;
      } else if (!result.success) {
        // Other errors: existing handling (whatever the current code does).
      } else {
        confirmationSent = true;
      }
      ```
      The exact integration depends on how `send-booking-emails.ts` currently structures this — read the file first and match the existing pattern. If it currently catches `QuotaExceededError`, the OAuth refusal path is a return-value check (not a throw), so it goes in a sibling branch.

    **Read each file before editing.** The exact arg shape varies (some use destructured object args, some positional). Match each file's existing convention.
  </action>
  <verify>
    Run `grep -rn "sendEmail\b\|from \"@/lib/email-sender\"" lib/email/` — must return zero matches (the only legal singleton consumer left is `lib/onboarding/welcome-email.ts` which is outside `lib/email/`).

    Run `grep -rn "getSenderForAccount" lib/email/` — must show one match per file (5 leaf senders + orchestrator = 6 occurrences minimum).

    Run `npx tsc --noEmit` — must compile clean once Task 2 also lands. (After Task 1 alone, expect type errors at the 4 outer callers — those are fixed in Task 2.)
  </verify>
  <done>
    All 5 leaf senders + orchestrator updated; no `sendEmail` imports remain inside `lib/email/`; OAuth refusal path wired into the same flag-and-continue branch as quota refusal.
  </done>
</task>

<task type="auto">
  <name>Task 2: Thread accountId from outer callers (booking route, cron route, cancel/reschedule libs)</name>
  <files>app/api/bookings/route.ts, app/api/cron/send-reminders/route.ts, lib/bookings/cancel.ts, lib/bookings/reschedule.ts</files>
  <action>
    Update the 4 outer call sites to pass `account_id` (or `account.id`) into the now-updated senders:

    1. **`app/api/bookings/route.ts`** — Already fetches `account` row at lines ~170-181 (per RESEARCH). Pass `account.id` into `sendBookingEmails` (the orchestrator). The orchestrator already has account.id available; this verifies it's threaded into the new `accountId` param signature.

    2. **`app/api/cron/send-reminders/route.ts`** — `ScanRow.account_id` is already populated (per RESEARCH lines 70-93). Pass `row.account_id` into `sendReminderBooker(...)` for each row.

    3. **`lib/bookings/cancel.ts`** — Pre-fetch query at line ~106 returns `account_id` on the booking row (per RESEARCH). Pass `pre.account_id` into the cancel sender(s).

    4. **`lib/bookings/reschedule.ts`** — Same pattern: the booking row carries `account_id`; pass into the reschedule sender(s).

    Read each file before editing to confirm the exact variable name; then thread it through.

    **Final repo-wide guard grep:**
    Run from project root:
    ```
    grep -rn "import.*sendEmail\|from \"@/lib/email-sender\"" app/ lib/ | grep -v "lib/onboarding/welcome-email.ts"
    ```
    Must return ZERO results (only welcome-email is allowed to keep the singleton import this phase). If any other file shows up, fix that file too.

    **Update tests** for the 4 send modules:
    - `tests/send-booking-emails.test.ts`, `tests/send-cancel-emails.test.ts`, `tests/send-reschedule-emails.test.ts`, `tests/send-reminder-booker.test.ts`.
    - For each: mock `@/lib/email-sender/account-sender` so `getSenderForAccount` returns a stub `EmailClient` whose `.send` is a `vi.fn().mockResolvedValue({ success: true, messageId: "test" })`.
    - Update existing test setups to pass `accountId: "00000000-0000-0000-0000-000000000001"` (or the test fixture's account id) into every sender call.
    - Add at least one new test per file: "when sender returns oauth_send_refused error, the orchestrator treats it as a soft fail and does NOT throw" (for `send-booking-emails.test.ts` specifically, also assert `confirmation_email_sent` is set to false in that branch).
  </action>
  <verify>
    1. `grep -rn "import.*sendEmail\|from \"@/lib/email-sender\"\b" app/ lib/ | grep -v "lib/onboarding/welcome-email.ts"` returns zero matches.
    2. `npx tsc --noEmit` clean.
    3. `npx vitest run` — full suite green (or at least: all `tests/send-*` files green, plus quota-guard, account-sender, gmail-oauth tests). Note: any prior pre-existing failing test (per STATE.md, `tests/bookings-api.test.ts` had one fixture mismatch) does NOT need to be fixed in this plan unless the cutover broke it further.
    4. `next build` succeeds (this is the canonical deploy gate per Andrew's "deploy-and-eyeball" model).
  </verify>
  <done>
    All 4 outer callers pass account_id into senders; type-check clean; full test suite green (modulo pre-existing unrelated failures); `next build` succeeds; the grep guard returns zero (welcome-email is the only allowed exception).
  </done>
</task>

</tasks>

<verification>
- 7 transactional paths all use `getSenderForAccount(accountId)`.
- Per-account quota: `checkAndConsumeQuota` everywhere takes 2 args.
- OAuth refusal handled exactly like quota refusal in `send-booking-emails.ts` (booking succeeds, `confirmation_email_sent = false`).
- Welcome email (`lib/onboarding/welcome-email.ts`) intentionally untouched.
- `next build` green; full test suite green (pre-existing test failures excluded).
</verification>

<success_criteria>
- Repo-wide grep `import.*sendEmail\|from "@/lib/email-sender"` (excluding welcome-email) returns zero matches.
- All 7 categories of send (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) instantiate their EmailClient via the factory.
- A test asserts the OAuth refusal branch sets `confirmation_email_sent = false` without throwing.
- `next build` succeeds.
- This commit is the SAFE cutover commit — Plan 05 verifies it on preview, Plan 06 removes the SMTP path AFTER verification.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-04-SUMMARY.md` recording: every modified file with a one-line summary, the exact grep guard result (zero), test count delta, and a note that the SMTP singleton in `lib/email-sender/index.ts` and the App-Password provider in `lib/email-sender/providers/gmail.ts` are STILL ON DISK — Plan 06 removes them ONLY after Plan 05's preview + production verification gates.
</output>
