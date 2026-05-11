---
phase: 44-customer-portal-billing-polish-stripe-emails
type: planner-notes
created: 2026-05-11
---

# Phase 44 Planner Notes

These notes document scope-narrowing and prerequisite items the planner surfaced. They are NOT plans (no execution required) — they exist for the verifier and Andrew during UAT.

## BILL-24 partial closure (intentional scope narrowing)

`REQUIREMENTS.md` BILL-24 names FOUR Stripe-triggered emails:

1. `trial-ending-3-days-out` — covered by Phase 44 ✅
2. `payment-failed` — covered by Phase 44 ✅
3. `account-locked` — **NOT in Phase 44 scope**
4. `welcome-to-paid` — **NOT in Phase 44 scope**

CONTEXT.md (Deferred Ideas section) explicitly narrows Phase 44 to only `trial_will_end` and `invoice.payment_failed`. The other two emails are listed in the deferred section:

- "Plan-change / interval-change / 'welcome to paid' / goodbye emails — outside BILL-24 scope; revisit after Phase 46 QA if owners report confusion."
- "Goodbye / 'subscription ended' email when `canceled` status hits — outside BILL-24 spec; Stripe's own receipts cover the financial transaction side."

**BILL-24 traceability:** This phase ships **2 of 4** Stripe-triggered emails named in BILL-24. The remaining 2 (`account-locked`, `welcome-to-paid`) are formally deferred to a post-v1.8 phase per CONTEXT.md scope narrowing. The phase verifier should mark BILL-24 as **partial closure (2/4)** rather than complete.

## PREREQ-C blocking gate (NOT a plan task)

Customer Portal must be configured in the Stripe Dashboard before any of these plans can be live-verified. PREREQ-C is Andrew's manual setup step; Claude must NOT attempt this.

**What Andrew must do** (Dashboard path: `https://dashboard.stripe.com/test/settings/billing/portal` for test mode and `https://dashboard.stripe.com/settings/billing/portal` for live):

1. **Payment methods** — Enable "Customer can update their payment method"
2. **Invoice history** — Enable "Customer can view invoice history"
3. **Cancel subscription** — Set mode to "At end of billing period" (`cancel_at_period_end = true`)
4. **Subscription updates / Plan switching** — Enable; select all 4 Price IDs:
   - `STRIPE_PRICE_ID_BASIC_MONTHLY`
   - `STRIPE_PRICE_ID_BASIC_ANNUAL`
   - `STRIPE_PRICE_ID_WIDGET_MONTHLY`
   - `STRIPE_PRICE_ID_WIDGET_ANNUAL`

Configure both **test mode** AND **live mode** (separate per-mode configs).

**Verification (after PREREQ-C):** `stripe billing_portal configurations list` should show a config with all four features enabled.

**Optional webhook event check:**

```bash
stripe webhook_endpoints retrieve we_1TVfOTJ7PLcBbY73Groz1G13
```

Confirm `enabled_events` includes both `customer.subscription.trial_will_end` and `invoice.payment_failed`. Per Phase 41 VERIFICATION these were registered, but the live endpoint list should still be verified once before Phase 44 deploys.

## Sender identity reality (LD-11 strict)

Per resolved open question (researcher → planner), Phase 44 honors LD-11 strict: billing emails route through `getSenderForAccount(accountId)` exactly as configured for the account.

**What this means in practice:**
- Accounts with `email_provider = 'gmail'` (default) → billing emails arrive from the account's Gmail OAuth address (same as their booking confirmations).
- Accounts with `email_provider = 'resend'` (upgraded) → billing emails arrive from `bookings@nsintegrations.com` with `reply-to: owner@gmail.com` (same as their booking confirmations).

If Andrew finds this confusing during Phase 46 UAT (e.g., "It feels wrong to receive a payment-failed email from my booking address"), a future phase can introduce a billing-specific sender override. For Phase 44, this is intentional and documented.

The plan SUMMARYs (Plan 44-02 in particular) will reiterate this so it surfaces during code review.

## Send-on-every-retry decision

Per resolved open question, `invoice.payment_failed` email sends on EVERY retry, not just the first failure. The email copy adapts via `invoice.attempt_count` and `invoice.next_payment_attempt`:

- `next_payment_attempt` non-null → "Stripe will retry your payment on {date}"
- `next_payment_attempt` null (final attempt) → "This was our last attempt — please update your payment method"

No new `payment_failed_email_sent_at` column needed. The `stripe_webhook_events` PK + `ON CONFLICT DO NOTHING` already prevents duplicate processing of a single Stripe event ID. Each retry is a distinct Stripe event with a distinct ID.

## Wave structure rationale

The dependency graph naturally splits into two waves:

**Wave 1 (3 plans, independent — file-disjoint):**
- 44-01: Schema migration (DB only, touches `supabase/migrations/`)
- 44-02: Email template files (new files in `lib/email/`)
- 44-03: Portal route handler (new file at `app/api/stripe/portal/route.ts`)

**Wave 2 (2 plans, parallel — file-disjoint, depend on Wave 1):**
- 44-04: Webhook integration (modifies `app/api/stripe/webhook/route.ts` only) — needs 44-01 (column) + 44-02 (email senders)
- 44-05: Billing page Status Card + state-aware rendering (modifies `app/(shell)/app/billing/page.tsx` + adds `_components/status-card.tsx` + `_components/portal-button.tsx`) — needs 44-01 (column for SELECT) + 44-03 (portal route URL)

**Why Plan 44-04 combines all webhook changes:** All three webhook changes (cancel_at_period_end write, trial email dispatch, payment-failed email dispatch) touch `app/api/stripe/webhook/route.ts`. Splitting them into separate plans would force sequential execution within Wave 2 anyway, AND introduce merge complexity. Combining into one plan with 3 tasks keeps the unit of work cohesive and avoids parallel-write conflicts.
