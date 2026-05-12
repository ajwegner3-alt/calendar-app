---
phase: 44-customer-portal-billing-polish-stripe-emails
verified: 2026-05-12T00:02:19Z
status: human_needed
score: 4/4 must-haves verified (code-level); 3 items deferred to Phase 46 UAT for live-Stripe sign-off
re_verification: null
human_verification:
  - test: Live Customer Portal end-to-end (SC-1 + SC-2 live verification)
    expected: |
      After PREREQ-C (Stripe Dashboard Customer Portal config), an active-subscription
      owner clicks Manage Subscription on /app/billing - redirects to a real Stripe
      Customer Portal session - cancel/update-payment/invoice-history/plan-switching
      all work via Portal UI - on cancel-at-period-end, owner returns to /app/billing
      and sees the amber Subscription ending Status Card - owner retains access until
      current_period_end, then transitions to locked when customer.subscription.deleted
      fires.
    why_human: |
      Cannot exercise Stripe Customer Portal UI programmatically - requires live Stripe
      Dashboard config (PREREQ-C) + real test-mode subscription + manual browser-side
      Portal interaction. ROADMAP explicitly defers live Portal verification to Phase 46 UAT.
  - test: Trial-will-end email delivery (SC-3 live verification)
    expected: |
      Backdate a test-mode trial to ~3 days from end, or use Stripe CLI
      stripe trigger customer.subscription.trial_will_end against a real account -
      owner receives transactional email from the configured sender (Gmail OAuth or
      bookings@nsintegrations.com per email_provider) with subject Your trial ends in
      3 days and a working Choose a plan CTA linking to /app/billing.
    why_human: |
      Requires Stripe CLI trigger or live trial-end timing + real email inbox access
      to confirm delivery, sender identity, and rendered content. Cannot verify SMTP
      delivery programmatically without sending real email.
  - test: Payment-failed email delivery (SC-4 live verification)
    expected: |
      Use Stripe CLI stripe trigger invoice.payment_failed against a test subscription,
      or attach Stripe test card 4000000000000341 (decline on renewal) - owner receives
      transactional email with subject We could not process your payment (or Final notice
      on last attempt) + working Update payment method CTA. Confirm each retry attempt
      fires a distinct email (each retry = distinct Stripe event ID).
    why_human: |
      Requires Stripe CLI trigger / test-card flow + real email inbox access. Email
      delivery cannot be verified programmatically.
gaps: []
---

# Phase 44: Customer Portal + Billing Settings Polish + Stripe-Triggered Emails - Verification Report

**Phase Goal (ROADMAP):**

> A subscribed owner can manage their subscription (cancel, update payment method, view invoices, switch plan interval) entirely through the Stripe Customer Portal with one click from /app/billing. Stripe lifecycle events trigger transactional emails through the existing getSenderForAccount factory.

**Verified:** 2026-05-12T00:02:19Z
**Status:** human_needed (code-level: PASSED; live Stripe verification deferred to Phase 46 UAT per ROADMAP)
**Re-verification:** No - initial verification.

---

## Goal Achievement

### Observable Truths (SC-1..SC-4)

| #    | Truth (Success Criterion) | Status | Evidence |
| ---- | ------------------------- | ------ | -------- |
| SC-1 | Owner with active subscription sees Manage Subscription button on /app/billing; redirects to Stripe Customer Portal; no custom cancel/invoice/payment-update UI exists. | VERIFIED (code-level) | `app/(shell)/app/billing/page.tsx` line 196-202 renders `<StatusCard variant="active" />` for active subs; StatusCard Active variant (status-card.tsx line 77-79) emits `<PortalButton />`; PortalButton (portal-button.tsx line 44-56) POSTs to `/api/stripe/portal` then `window.location.assign(url)`. Grep for cancel/invoice/payment-method-update UI inside `app/(shell)/app/billing/` found ONLY documentation comments and one `flow="payment_method_update"` prop pass (a Portal deep-link, not a custom UI). LD-03 honored. |
| SC-2 | Canceling through Customer Portal sets cancel_at_period_end = true; owner retains access through end of paid period; only loses access after subscription_status canceled. | VERIFIED (code-level) - needs live-Portal UAT | Migration `20260511120000_phase44_cancel_at_period_end.sql` adds BOOLEAN NOT NULL DEFAULT FALSE column. Webhook `app/api/stripe/webhook/route.ts` line 273 writes `updates.cancel_at_period_end = sub.cancel_at_period_end ?? false` on every customer.subscription.{created,updated,deleted}. Billing page line 113-126 (Pitfall 4 honored) checks `subscription_status === 'active' && cancel_at_period_end === true` BEFORE generic active branch - amber cancel_scheduled Status Card. Phase 42.6 subscription-status-driven access gating unchanged - owner with active+cancel_at_period_end retains full access. |
| SC-3 | customer.subscription.trial_will_end triggers transactional email through getSenderForAccount(accountId). | VERIFIED (code-level) - needs live-email UAT | `lib/email/send-trial-ending-email.ts` line 110: `const sender = await getSenderForAccount(accountId);`. Wired in webhook line 222 (sendTrialEndingEmail) within trial_will_end branch. Idempotent via `trial_warning_sent_at IS NULL` guard (line 210). Inner try/catch (line 221, 242) prevents email errors from triggering outer dedupe-rollback (V18-CP-12 honored). |
| SC-4 | invoice.payment_failed triggers transactional email through getSenderForAccount(accountId). | VERIFIED (code-level) - needs live-email UAT | `lib/email/send-payment-failed-email.ts` line 144: `const sender = await getSenderForAccount(accountId);`. Wired in webhook line 374 (sendPaymentFailedEmail) within `invoice.payment_failed` branch. Sends on every retry - each retry is a distinct Stripe event ID, dedupe table prevents duplicates per event. Copy adapts via `attemptCount` + `nextPaymentAttempt === null` for final-attempt copy. Inner try/catch (line 373, 396) honors V18-CP-12. |

**Score:** 4/4 truths verified at code level. 3 truths (SC-1 live-Portal redirect, SC-3 email delivery, SC-4 email delivery) flagged for live UAT in Phase 46 - code wiring is correct, but actual Stripe + email delivery cannot be verified programmatically.

### Required Artifacts (3-level check)

| Artifact | Exists | Substantive | Wired | Status |
| -------- | ------ | ----------- | ----- | ------ |
| `supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql` (+ ROLLBACK) | YES (16 lines + 11 line rollback) | YES - ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE with COMMENT | YES - Column applied to production DB per planner notes; webhook writes it (line 273); page reads it (line 76) | VERIFIED |
| `lib/email/send-trial-ending-email.ts` | YES (149 lines) | YES - Full HTML branded template, `getSenderForAccount(accountId)` (line 110), accountId routing per LD-11 strict, never-throws contract documented | YES - Imported in webhook line 19; called line 222 | VERIFIED |
| `lib/email/send-payment-failed-email.ts` | YES (188 lines) | YES - Full HTML branded template, retry-aware copy (nextPaymentAttempt null = final), `getSenderForAccount(accountId)` (line 144), never-throws contract | YES - Imported in webhook line 20; called line 374 | VERIFIED |
| `app/api/stripe/portal/route.ts` | YES (164 lines) | YES - POST handler with auth gate, account fetch, stripe_customer_id guard, optional `flow: 'payment_method_update'` body, returns `{url}`; Cache-Control: no-store + force-dynamic | YES - Called from `portal-button.tsx` line 44 via `fetch("/api/stripe/portal", { method: "POST" })` | VERIFIED |
| `app/api/stripe/webhook/route.ts` (extended additively) | YES (531 lines) | YES - Existing dedupe + signature verification preserved (V18-CP-01). New: cancel_at_period_end mirror write (line 273); trial_will_end email dispatch; invoice.payment_failed email dispatch. All in inner try/catch (V18-CP-12). | YES - Registered as Stripe webhook endpoint (Phase 41 carry); SDK imports preserved | VERIFIED |
| `app/(shell)/app/billing/_components/portal-button.tsx` | YES (97 lines) | YES - Client component with useTransition, error handling, optional `flow` prop, ExternalLink + Loader2 icons, never caches URL (matches Pitfall 1) | YES - Imported in `status-card.tsx` line 2; used in all 3 Status Card variants (active line 78, cancel_scheduled line 103, past_due line 127) | VERIFIED |
| `app/(shell)/app/billing/_components/status-card.tsx` | YES (131 lines) | YES - Three discriminated-union variants (active/cancel_scheduled/past_due), data-variant attribute for UAT, amber framing for cancel/past_due | YES - Imported in `page.tsx` line 10; used in 3 branches (lines 196, 209, 221) | VERIFIED |
| `app/(shell)/app/billing/page.tsx` (state machine extended) | YES (254 lines) | YES - BillingPageState discriminated union extended to 6 states; cancel_at_period_end checked BEFORE generic active (Pitfall 4 line 113-126); LD-18 plumbing preserved (TrialingHeader, TierGrid, LockedView, CheckoutReturnPoller) | YES - Renders correctly per state | VERIFIED |

### Key Link Verification

| From - To | Via | Status |
| --------- | --- | ------ |
| PortalButton - /api/stripe/portal | `fetch("/api/stripe/portal", { method: "POST", body: JSON.stringify(flow ? { flow } : {}) })` (portal-button.tsx line 44-48); response parsed for `{url}`; `window.location.assign(url)` | WIRED |
| /api/stripe/portal - Stripe SDK | `stripe.billingPortal.sessions.create({ customer, return_url, flow_data? })` (route.ts line 121-125) | WIRED |
| Webhook trial_will_end - sendTrialEndingEmail | `await sendTrialEndingEmail({ accountId, account, trialEndAt, appUrl })` inside inner try/catch (webhook line 221-241) | WIRED |
| Webhook invoice.payment_failed - sendPaymentFailedEmail | `await sendPaymentFailedEmail({ accountId, account, attemptCount, nextPaymentAttempt, amountDueCents, hostedInvoiceUrl, appUrl })` (webhook line 373-388) | WIRED |
| Webhook subscription event - accounts.cancel_at_period_end | `updates.cancel_at_period_end = sub.cancel_at_period_end ?? false` (webhook line 273) - `admin.from("accounts").update(updates).eq("id", account.id)` (line 276) | WIRED |
| page.tsx state derivation - cancel_at_period_end column | `select(..., "cancel_at_period_end", ...)` (page.tsx line 76) - checked at line 115 before generic active branch | WIRED |
| StatusCard past_due variant - Portal payment_method_update deep-link | `<PortalButton flow="payment_method_update" />` (status-card.tsx line 127) - POST body `{ flow: "payment_method_update" }` - route.ts line 102-107 builds `flow_data: { type: "payment_method_update" }` | WIRED |
| Email senders - LD-11 strict factory | Both new email files import + call `getSenderForAccount(accountId)` (trial line 110; payment-failed line 144) - same factory used by booking confirmation, cancel, reschedule, reminder emails | WIRED |

### Requirements Coverage (BILL-21..BILL-24)

| Requirement | Status | Evidence / Note |
| ----------- | ------ | --------------- |
| BILL-21 - Customer Portal entry (Manage Subscription button + Portal route) | SATISFIED | PortalButton component + `/api/stripe/portal` route both shipped and wired. Active variant Status Card renders the button. |
| BILL-22 - Payment-method update deep-link (past_due deep-link to Portal) | SATISFIED | `flow: 'payment_method_update'` body - `flow_data: { type: 'payment_method_update' }` (route.ts line 102-107). past_due Status Card uses `<PortalButton flow="payment_method_update" />`. |
| BILL-23 - cancel_at_period_end lifecycle (column + webhook mirror + UI variant) | SATISFIED | Migration applied; webhook mirrors Stripe payload (line 273); page renders amber cancel_scheduled Status Card with period-end date. Pitfall 4 priority ordering correct. |
| BILL-24 - Stripe-triggered transactional emails | PARTIAL CLOSURE (2/4 - intentional) | trial-ending-3-days-out + payment-failed shipped via getSenderForAccount(accountId). account-locked + welcome-to-paid formally DEFERRED per CONTEXT.md scope narrowing (see 44-00-PLANNER-NOTES.md). This is the documented partial-closure outcome - NOT a gap. |

### Locked Decisions (Carry-Through) - Preservation Check

| Locked Decision | Status | Evidence |
| --------------- | ------ | -------- |
| LD-03 - Customer Portal owns cancel/update-payment/invoices/plan-switching; no custom equivalents | PRESERVED | Grep across `app/(shell)/app/billing/` found ZERO custom cancel/invoice/payment-update UI - only Portal redirect button. |
| LD-11 strict - Stripe-triggered emails route through getSenderForAccount(accountId) | PRESERVED | Both new email modules import + call `getSenderForAccount(accountId)`. No bypass, no separate billing sender. |
| LD-18 - Phase 42 plumbing preserved byte-identical | PRESERVED | `page.tsx` still imports TrialingHeader, LockedView, TierGrid, CheckoutReturnPoller (lines 4-9). Used in plan_selection/locked branches (lines 188, 239, 241, 250, 251). Extension is additive (StatusCard added alongside, not replacing). |
| V18-CP-09 - Portal URL never logged | PRESERVED | `console.log(...)` in route.ts lines 60, 76, 87, 129, 143, 156 - all log account_id + session_id + outcome, NEVER session.url. The only references to `session.url` are (1) empty-check `if (!session.url)`, (2) JSON response body, (3) documentation comments. |
| V18-CP-12 (new this phase) - Email failures wrapped in inner try/catch | PRESERVED | Webhook trial_will_end branch wraps sendTrialEndingEmail in try/catch (line 221, 242). Invoice payment_failed wraps sendPaymentFailedEmail (line 373, 396). Outer dedupe-rollback try/catch (line 137-152) only catches DB-level failures. |
| Pitfall 4 - cancel_at_period_end === true checked BEFORE generic subscription_status === active | PRESERVED | `page.tsx` line 113-126 (cancel_scheduled branch) comes BEFORE line 127 (generic active). Inline comment explicitly notes the silent-UX-bug risk if order were reversed. |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| (none) | No TODO / FIXME / XXX / placeholder / not-implemented / coming-soon patterns found in any Phase 44 file | - | None |

### Build / Type Safety

- `npx tsc --noEmit` filtered to Phase 44 files returned **zero errors**. The TS errors that DO surface live in `tests/__mocks__/` and `tests/*.test.ts` - pre-existing mock-infrastructure issues unrelated to Phase 44 (mock module export name mismatches in `__mockSendCalls` / `__resetMockSendCalls` / `__setTurnstileResult`). They predate this phase and are out of scope.

### Human Verification Required (Deferred to Phase 46 UAT)

PREREQ-C (Stripe Dashboard Customer Portal config) is a manual prerequisite for live verification, NOT a code requirement. With PREREQ-C complete in test mode AND live mode, Phase 46 UAT must execute:

1. **Live Customer Portal end-to-end (SC-1 + SC-2)** - manual browser test of the full cancel / update-payment / invoice / plan-switching flow via Stripe Customer Portal, plus the cancel-at-period-end - access retained - access lost transition.
2. **Trial-will-end email delivery (SC-3)** - Stripe CLI `stripe trigger customer.subscription.trial_will_end` against a test account; confirm email arrival + sender identity + content.
3. **Payment-failed email delivery (SC-4)** - Stripe CLI `stripe trigger invoice.payment_failed` or test-card 4000000000000341; confirm email arrival on each retry; confirm final-attempt copy on the last retry.

These are flagged `human_needed` because email delivery and Stripe-hosted Portal UI cannot be exercised programmatically. ROADMAP explicitly defers live ship sign-off to Phase 46.

### Gaps Summary

**None.** All code-level wiring for the 4 SCs is correct. BILL-24 partial-closure (2/4 emails) is intentional scope narrowing per CONTEXT.md and 44-00-PLANNER-NOTES.md - account-locked and welcome-to-paid are formally deferred to a post-v1.8 phase, NOT in BILL-24 Phase 44 scope.

The remaining work is live-Stripe + live-email validation in Phase 46 UAT.

---

_Verified: 2026-05-12T00:02:19Z_
_Verifier: Claude (gsd-verifier)_
