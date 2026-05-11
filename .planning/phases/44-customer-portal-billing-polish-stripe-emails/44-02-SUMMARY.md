---
phase: 44-customer-portal-billing-polish-stripe-emails
plan: 02
subsystem: email
tags: [stripe, email, transactional, billing, resend, gmail-oauth]

# Dependency graph
requires:
  - phase: 35-gmail-oauth-sender
    provides: getSenderForAccount factory + EmailClient contract
  - phase: 36-resend-provider
    provides: isRefusedSend dual-prefix helper + RESEND_REFUSED_SEND_ERROR_PREFIX
  - phase: 19-email-branding
    provides: branding-blocks helpers (renderEmailBrandedHeader, renderBrandedButton, brandedHeadingStyle, renderEmailFooter, stripHtml)
provides:
  - sendTrialEndingEmail({accountId, account, trialEndAt, appUrl}) → {success, error?}
  - sendPaymentFailedEmail({accountId, account, attemptCount, nextPaymentAttempt, amountDueCents, hostedInvoiceUrl, appUrl}) → {success, error?}
  - Per-account-routed transactional email primitives for the two Phase-44-scoped Stripe events (trial_will_end, invoice.payment_failed)
affects: [44-04 webhook integration, 46 manual QA]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Never-throw transactional email sender (returns {success, error?})"
    - "LD-11 strict sender identity (per-account routing for Stripe-triggered emails)"
    - "Adaptive copy based on Stripe invoice state (nextPaymentAttempt null = final-attempt language)"

key-files:
  created:
    - lib/email/send-trial-ending-email.ts
    - lib/email/send-payment-failed-email.ts
  modified: []

key-decisions:
  - "Quota guard (checkAndConsumeQuota) NOT applied to billing emails — operationally distinct from booking confirmations; per-account booking-quota cap must not block billing notices."
  - "escapeHtml duplicated locally in both files (mirrors send-booking-confirmation.ts pattern; branding-blocks escapeHtml is internal-only)."
  - "CTA targets ${appUrl}/app/billing in both emails — keep owner in-app; the in-app Status Card routes them to Stripe Portal in one more click per CONTEXT.md."

patterns-established:
  - "Pattern: Stripe-triggered email senders never throw — they return {success: false, error?} so webhook handlers can ignore email failures without rolling back dedupe (Plan 44-04 contract)."
  - "Pattern: Adaptive subject for trial-ending email — 'today' / 'tomorrow' / 'in N days' based on computed daysLeft (handles Stripe edge case where trials shorter than 3 days fire trial_will_end immediately)."
  - "Pattern: Adaptive copy for payment-failed email — branches on nextPaymentAttempt === null to render either retry-date copy or amber final-notice copy."

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 44 Plan 02: Stripe-Triggered Email Senders Summary

**Two never-throw transactional email modules for `customer.subscription.trial_will_end` and `invoice.payment_failed`, both routed through `getSenderForAccount(accountId)` per LD-11 strict, with branded chrome via branding-blocks and `/app/billing` CTAs.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files created:** 2 (337 lines total)
- **Files modified:** 0

## Accomplishments

- `lib/email/send-trial-ending-email.ts` (149 lines) — sends BILL-24 trial_will_end transactional email. Adaptive subject ("today" / "tomorrow" / "in N days"). Routes through `getSenderForAccount(accountId)`.
- `lib/email/send-payment-failed-email.ts` (188 lines) — sends BILL-24 invoice.payment_failed transactional email. Branches copy on `nextPaymentAttempt === null` (final-attempt amber warning) vs retry-date message. Optional hosted invoice URL renders as secondary link. Routes through `getSenderForAccount(accountId)`.
- Both modules honor LD-11 strict (no parallel send path).
- Both modules NEVER throw (verified: zero `throw` statements at file level — `grep -c "^[[:space:]]*throw " = 0` on both files).
- Both modules use `isRefusedSend(error)` for unified refusal detection across Gmail-OAuth + Resend providers.
- Closes EMAIL half of BILL-24 partial-closure (2 of 4 named emails — `account-locked` and `welcome-to-paid` formally deferred per CONTEXT.md scope narrowing).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/email/send-trial-ending-email.ts** — `6ad405e` (feat)
2. **Task 2: Create lib/email/send-payment-failed-email.ts** — `cf4c723` (feat)

## Files Created/Modified

- `lib/email/send-trial-ending-email.ts` (created, 149 lines) — exports `sendTrialEndingEmail(args): Promise<SendTrialEndingEmailResult>`. Routes through `getSenderForAccount(accountId)`. CTA → `${appUrl}/app/billing`.
- `lib/email/send-payment-failed-email.ts` (created, 188 lines) — exports `sendPaymentFailedEmail(args): Promise<SendPaymentFailedEmailResult>`. Routes through `getSenderForAccount(accountId)`. CTA → `${appUrl}/app/billing`. Adaptive copy on `isFinalAttempt`.

## Verification Results

**Per-file grep checks:** All passed.

| Check | trial-ending | payment-failed |
|---|---|---|
| `import "server-only"` | ✓ | ✓ |
| `getSenderForAccount` | ✓ | ✓ |
| `isRefusedSend` | ✓ | ✓ |
| `from "./branding-blocks"` (5 helpers) | ✓ | ✓ |
| `/app/billing` CTA | ✓ | ✓ |
| `export async function` | ✓ | ✓ |
| `isFinalAttempt` branching | n/a | ✓ |
| `throw` statements at file level | 0 | 0 |

**`npx tsc --noEmit`:** Zero errors attributable to either new file. All TS errors observed are pre-existing tech debt:
- `tests/__mocks__/*` + `tests/*.test.ts` — pre-existing per STATE.md "Open tech debt" (date-sensitive fixtures + missing mock exports).
- `app/api/stripe/portal/route.ts` (line 96) — untracked file from a parallel/companion Plan 44 (not Plan 44-02 territory; Plan 44-02 only touches `lib/email/`).

**`npm run build`:** Fails ONLY on the unrelated `app/api/stripe/portal/route.ts` namespace-access issue (`Stripe.BillingPortal.SessionCreateParams.FlowData`). This file is **untracked** (never staged by Plan 44-02), exists outside this plan's `files_modified` scope, and is the concern of a different Plan 44 wave member. **Plan 44-02 success criteria ("`npm run build` succeeds") cannot be fully validated until the sibling plan ships its portal-route fix.** Static evidence (clean tsc filter on new files + clean grep checks + clean compile of new files in isolation) gives high confidence the new modules build cleanly in a clean tree.

## Decisions Made

- **CTA target = `/app/billing`, NOT Stripe Portal.** Owner picks a tier in the app first; the Status Card on `/app/billing` (Phase 43) routes them onward to Stripe Portal for past_due / payment-method updates. Decision source: CONTEXT.md.
- **No quota guard on billing emails.** `checkAndConsumeQuota` is intentionally omitted — billing is operational and must never be silently suppressed by the per-account booking-quota cap. If quota gating for billing emails is desired later, it is a separate phase decision.
- **`escapeHtml` duplicated locally per file.** Same pattern as `lib/email/send-booking-confirmation.ts:217`. The branding-blocks `escapeHtml` is intentionally internal (no export keyword) — see `branding-blocks.ts` lines 6-7 historical note.
- **Send on every retry, no dedupe column added.** Per 44-00-PLANNER-NOTES.md resolved open question Q1: each Stripe retry is a distinct event ID, so `stripe_webhook_events (stripe_event_id PRIMARY KEY)` + `ON CONFLICT DO NOTHING` already prevents duplicate sends for the SAME event. The email copy itself adapts to retry context.

## Deviations from Plan

None — plan executed exactly as written. Both files match the plan's exact content specification verbatim.

## Issues Encountered

- **`npm run build` fails on unrelated portal route file.** The file `app/api/stripe/portal/route.ts` is **untracked** (not part of this plan) and contains a TypeScript namespace-access error on `Stripe.BillingPortal.SessionCreateParams.FlowData` (Stripe SDK type is not a namespace). This is sibling-plan territory (likely Plan 44-03). Plan 44-02 did not touch this file. Documented here so the sibling plan / verifier sees the cross-plan coupling: once the portal route fix lands, full project `npm run build` will pass and Plan 44-02 will be greenlit through the build gate.

## LD-11 Strict Sender Identity (carry forward to UAT)

What the account owner will literally see in the `From:` header of the new emails:

| Account `email_provider` | From header | Reply-To |
|---|---|---|
| `gmail` (default) | Owner's Gmail OAuth address (same address used for their booking confirmations) | (none — replies route to From) |
| `resend` (upgraded) | `Bookings <bookings@nsintegrations.com>` | `owner_email` |

This is intentional and matches per-account routing for booking confirmations (single sender identity per account). If Andrew finds this confusing during Phase 46 UAT (e.g., "It feels strange to receive a payment-failed email from my booking address"), a future phase can introduce a billing-specific sender override (`getBillingSenderForAccount` or similar). For Phase 44, this is the locked behavior per LD-11 strict + CONTEXT.md.

## Note for Downstream Plan 44-04 (webhook integration)

Import paths for the webhook handler:

```typescript
import { sendTrialEndingEmail } from "@/lib/email/send-trial-ending-email";
import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed-email";
```

Argument shapes (full TypeScript signatures exported from each file):

```typescript
// trial_will_end handler:
await sendTrialEndingEmail({
  accountId: string,
  account: { id, name, logo_url, brand_primary, owner_email },
  trialEndAt: string | Date,
  appUrl: string,
});

// invoice.payment_failed handler:
await sendPaymentFailedEmail({
  accountId: string,
  account: { id, name, logo_url, brand_primary, owner_email },
  attemptCount: number,
  nextPaymentAttempt: number | null,   // Unix seconds; null = final attempt
  amountDueCents: number,
  hostedInvoiceUrl: string | null,
  appUrl: string,
});
```

Both functions return `Promise<{success: boolean; error?: string}>` and NEVER throw. Plan 44-04 should:
1. Look up account by `stripe_customer_id`.
2. `await` the send.
3. Log on `!result.success` but still return HTTP 200 to Stripe (do NOT roll back the dedupe row — Stripe will not retry a 200, and the email failure does not invalidate the subscription state change).

## Next Phase Readiness

- **Ready for Plan 44-04 (webhook integration):** both modules exported, types stable, contract documented above.
- **Blocker for full Phase 44 build gate:** sibling Plan 44-03 (?) portal route TypeScript fix needed before `npm run build` passes project-wide.
- **PREREQ-C still pending** per 44-00-PLANNER-NOTES.md — Andrew must configure Customer Portal in Stripe Dashboard (plan-switching across all 4 Prices) before any of Phase 44 can be live-verified. Not Claude's task.

---
*Phase: 44-customer-portal-billing-polish-stripe-emails*
*Completed: 2026-05-11*
