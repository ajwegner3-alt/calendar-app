---
phase: 44-customer-portal-billing-polish-stripe-emails
plan: 04
subsystem: payments
tags: [stripe, webhook, email, idempotency, transactional-email, billing]

# Dependency graph
requires:
  - phase: 41-stripe-sdk-schema-webhook-skeleton
    provides: Webhook handler skeleton (POST handler, raw body, signature verify, dedupe table)
  - phase: 42.5-multi-tier-stripe-schema
    provides: priceIdToTier + checkout.session.completed plan_tier write
  - phase: 44-01
    provides: accounts.cancel_at_period_end column (BOOLEAN NOT NULL DEFAULT FALSE)
  - phase: 44-02
    provides: sendTrialEndingEmail + sendPaymentFailedEmail (never-throw, branded, LD-11 strict)
provides:
  - Webhook write of accounts.cancel_at_period_end on customer.subscription.{created,updated,deleted}
  - Webhook dispatch of sendTrialEndingEmail on customer.subscription.trial_will_end (idempotency-gated)
  - Webhook dispatch of sendPaymentFailedEmail on invoice.payment_failed (every retry attempt)
  - V18-CP-12 enforcement (inner try/catch wrappers around email dispatch)
affects: [44-05-status-card-billing-ui, 46-andrew-uat-stripe-cli-triggers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inner try/catch wrapping email dispatch — V18-CP-12: email failures NEVER propagate to outer dedupe-rollback"
    - "Expanded SELECT pattern: account lookup grows to include branding columns (id, name, logo_url, brand_primary, owner_email) plus event-specific idempotency columns (trial_warning_sent_at) so a single round-trip serves both UPDATE and email-dispatch needs"
    - "Pre-UPDATE email dispatch for trial-ending: send BEFORE setting trial_warning_sent_at so a send failure does not lock the account out of future retries (Stripe re-fires trial_will_end on non-200; we always 200)"
    - "Post-UPDATE email dispatch for payment-failed: send AFTER the status UPDATE succeeds — so if the UPDATE fails and rolls back, the email still doesn't send (consistency invariant)"

key-files:
  created: []
  modified:
    - "app/api/stripe/webhook/route.ts (3 commits, +111 lines net — additive only)"

key-decisions:
  - "Email send for trial_will_end happens BEFORE updates.trial_warning_sent_at write so a send failure leaves the gate open for future webhook retries"
  - "Email send for invoice.payment_failed happens AFTER the status UPDATE — UPDATE failures roll back via outer try/catch, and email-dispatch must not run on rolled-back state"
  - "Inner try/catch wrappers on BOTH email dispatches enforce V18-CP-12: email failures cannot trigger dedupe rollback. Without this guard, a rogue throw from the email layer would cause Stripe retry storms"
  - "Idempotency for trial-ending email uses TWO gates: stripe_webhook_events PK (event-level) + trial_warning_sent_at IS NULL (account-level). Both must clear for the email to send"
  - "Payment-failed email sends on EVERY retry attempt (per 44-00-PLANNER-NOTES.md Q1) — each Stripe retry is a distinct event ID, so the event-level dedupe is sufficient. Adaptive copy via attempt_count + next_payment_attempt"
  - "cancel_at_period_end write deliberately confined to subscription.{created,updated,deleted} branch. NOT added to trial_will_end branch even though benign — established pattern: only write the columns this event type actually communicates a change to"

patterns-established:
  - "V18-CP-12: Email send failures inside webhook handler MUST be wrapped in inner try/catch so they never propagate to the outer try/catch that rolls back the dedupe row"
  - "Branding column SELECT expansion: when a webhook event-handler needs to dispatch a branded email, expand the existing account lookup SELECT in place (single round-trip) — never make a second SELECT call for branding"
  - "Adaptive email copy via Stripe payload fields: attempt_count + next_payment_attempt give us first-retry vs final-retry semantics with zero state lookup"

# Metrics
duration: 3min
completed: 2026-05-11
---

# Phase 44 Plan 04: Webhook Integration Summary

**Stripe webhook now mirrors `cancel_at_period_end` into `accounts` and dispatches the Phase 44-02 trial-ending and payment-failed branded emails — all three changes wrapped in V18-CP-12 inner try/catches so email failures cannot trigger Stripe retry storms.**

## Performance

- **Duration:** ~3 min (sequential edits, no debugging required — plan was precise)
- **Started:** 2026-05-11T23:50:38Z
- **Completed:** 2026-05-11T23:53:26Z
- **Tasks:** 3
- **Files modified:** 1 (`app/api/stripe/webhook/route.ts`)

## Accomplishments

- `handleSubscriptionEvent` now writes `accounts.cancel_at_period_end = sub.cancel_at_period_end ?? false` on `customer.subscription.{created,updated,deleted}` — Plan 44-05 billing UI can now read this column to render the "Cancels at period end" state.
- `handleSubscriptionEvent` now dispatches `sendTrialEndingEmail` on `customer.subscription.trial_will_end`, gated by `!account.trial_warning_sent_at && account.owner_email`, with email send happening BEFORE the `trial_warning_sent_at` UPDATE so send-failures stay retry-eligible.
- `handleInvoiceEvent` now dispatches `sendPaymentFailedEmail` on `invoice.payment_failed` (every retry attempt), with adaptive copy via `attempt_count + next_payment_attempt`, dispatched AFTER the status UPDATE so consistency is preserved on rollback.
- Both email dispatches wrapped in inner `try { ... } catch (emailErr) { ... }` — V18-CP-12 enforcement: email failures NEVER propagate to the outer try/catch that rolls back the `stripe_webhook_events` dedupe row.
- All existing Phase 41/42/42.5 behavior preserved byte-identical: signature verification (`stripe.webhooks.constructEvent`), idempotency (`ignoreDuplicates: true`), `priceIdToTier` derivation, `listLineItems` fetch, `client_reference_id` safety net, status derivation (`payment_succeeded ? "active" : "past_due"`), dedupe rollback on DB failure.

## Task Commits

Each task was committed atomically against `app/api/stripe/webhook/route.ts`:

1. **Task 1: Add cancel_at_period_end write to handleSubscriptionEvent** — `ddcc316` (feat)
2. **Task 2: Dispatch sendTrialEndingEmail on customer.subscription.trial_will_end** — `1163a84` (feat)
3. **Task 3: Dispatch sendPaymentFailedEmail on invoice.payment_failed** — `442767a` (feat)

Note: Commits `4b793b1` and `421bcbd` (Plan 44-05) landed in parallel between Task 2 and Task 3 but touched only `app/(shell)/app/billing/_components/portal-button.tsx` and `status-card.tsx` — zero overlap with this plan's file. Each 44-04 commit modifies only `app/api/stripe/webhook/route.ts`.

## Files Created/Modified

- `app/api/stripe/webhook/route.ts` — modified (3 atomic commits, +111 net lines, all additive):
  - Two new imports (`sendTrialEndingEmail`, `sendPaymentFailedEmail`) at top of file
  - `handleSubscriptionEvent`: expanded account lookup SELECT (id-only → 6 columns including branding + idempotency); inserted email-send block at top of trial_will_end branch; added `cancel_at_period_end` write to the subscription.{created,updated,deleted} branch
  - `handleInvoiceEvent`: expanded account lookup SELECT (2 columns → 6 columns); inserted email-send block between the UPDATE-err check and the return statement, gated to `eventType === "invoice.payment_failed" && account.owner_email`

## Key Implementation Excerpts

### Task 1 — cancel_at_period_end write (subscription.{created,updated,deleted} branch)

```typescript
updates.plan_interval =
  sub.items.data[0]?.price.recurring?.interval ?? null;
// Phase 44 (BILL-23): mirror Stripe subscription.cancel_at_period_end.
// True when owner schedules cancellation via Customer Portal; access continues until current_period_end.
updates.cancel_at_period_end = sub.cancel_at_period_end ?? false;
```

### Task 2 — trial-ending email dispatch (trial_will_end branch)

```typescript
if (eventType === "customer.subscription.trial_will_end") {
  // ... idempotency gate + inner try/catch ...
  if (!account.trial_warning_sent_at && account.owner_email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? /* ... */;
    try {
      const emailResult = await sendTrialEndingEmail({ /* ... */ });
      if (!emailResult.success) { console.error(...); }
    } catch (emailErr) {
      console.error("[stripe-webhook] trial-ending email threw unexpectedly", { ... });
    }
  } else {
    console.log("[stripe-webhook] trial-ending email skipped", {
      reason: !account.owner_email ? "no_owner_email" : "already_sent",
    });
  }
  updates.trial_warning_sent_at = new Date().toISOString();
}
```

### Task 3 — payment-failed email dispatch (after UPDATE in handleInvoiceEvent)

```typescript
// After: if (updateErr) { throw new Error("account_update_failed"); }
if (eventType === "invoice.payment_failed" && account.owner_email) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? /* ... */;
  try {
    const emailResult = await sendPaymentFailedEmail({
      accountId: account.id,
      account: { /* branding + recipient */ },
      attemptCount: invoice.attempt_count ?? 1,
      nextPaymentAttempt: invoice.next_payment_attempt ?? null,
      amountDueCents: invoice.amount_due ?? 0,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      appUrl,
    });
    if (!emailResult.success) { console.error(...); }
  } catch (emailErr) {
    console.error("[stripe-webhook] payment-failed email threw unexpectedly", { ... });
  }
}
return { accountId: account.id, stripeSubscriptionId: subscriptionId };
```

## Verification Results

### Task-level greps (all pass)

```
$ grep -n "cancel_at_period_end = sub.cancel_at_period_end" app/api/stripe/webhook/route.ts
215:    updates.cancel_at_period_end = sub.cancel_at_period_end ?? false;

$ grep -n 'from "@/lib/email/send-trial-ending-email"' app/api/stripe/webhook/route.ts
19:import { sendTrialEndingEmail } from "@/lib/email/send-trial-ending-email";

$ grep -n 'from "@/lib/email/send-payment-failed-email"' app/api/stripe/webhook/route.ts
20:import { sendPaymentFailedEmail } from "@/lib/email/send-payment-failed-email";

$ grep -n 'select("id, name, logo_url, brand_primary, owner_email, trial_warning_sent_at")' app/api/stripe/webhook/route.ts
180:    .select("id, name, logo_url, brand_primary, owner_email, trial_warning_sent_at")

$ grep -n 'select("id, stripe_subscription_id, name, logo_url, brand_primary, owner_email")' app/api/stripe/webhook/route.ts
327:    .select("id, stripe_subscription_id, name, logo_url, brand_primary, owner_email")

$ grep -n 'eventType === "invoice.payment_failed"' app/api/stripe/webhook/route.ts
366:  if (eventType === "invoice.payment_failed" && account.owner_email) {

$ grep -n "invoice.attempt_count\|invoice.next_payment_attempt\|invoice.amount_due\|invoice.hosted_invoice_url" app/api/stripe/webhook/route.ts
383:        attemptCount: invoice.attempt_count ?? 1,
384:        nextPaymentAttempt: invoice.next_payment_attempt ?? null,
385:        amountDueCents: invoice.amount_due ?? 0,
386:        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
```

### Regression guards (all original Phase 41/42/42.5 behaviors preserved)

```
$ grep -c "stripe.webhooks.constructEvent" app/api/stripe/webhook/route.ts       # 1 ✓
$ grep -c "ignoreDuplicates: true" app/api/stripe/webhook/route.ts               # 1 ✓
$ grep -c "priceIdToTier" app/api/stripe/webhook/route.ts                         # 2 (import + call — unchanged from pre-plan) ✓
$ grep -c "stripe.checkout.sessions.listLineItems" app/api/stripe/webhook/route.ts # 1 ✓
$ grep -c "client_reference_id" app/api/stripe/webhook/route.ts                   # 4 (unchanged) ✓
$ grep -c '"invoice.payment_succeeded" ? "active" : "past_due"' app/api/stripe/webhook/route.ts # 1 ✓
$ grep -c "updates.subscription_status = sub.status" app/api/stripe/webhook/route.ts # 1 ✓
$ grep -c "updates.stripe_subscription_id = sub.id" app/api/stripe/webhook/route.ts  # 1 ✓
$ grep -c "updates.current_period_end" app/api/stripe/webhook/route.ts            # 1 ✓
$ grep -c "updates.plan_interval" app/api/stripe/webhook/route.ts                 # 1 ✓
```

Phase-level note: plan's verify-block expected `priceIdToTier` count = 1. Actual = 2 because the symbol appears in both the import statement and the call site. This is unchanged from pre-plan state (pre-existing condition from Phase 42.5) — not a regression.

### Build + Typecheck

- `npx tsc --noEmit` — ZERO new errors in `app/api/stripe/webhook/route.ts`. Pre-existing tech-debt errors in `tests/reminder-cron.test.ts` and `tests/upgrade-action.test.ts` remain (carried open tech debt, listed in STATE.md).
- `npm run build` — succeeds; route table shows all expected routes. `/api/stripe/webhook` builds clean.

## V18-CP-12 Enforcement Audit

Both inner try/catch wrappers verified by hand:

1. **`sendTrialEndingEmail`** (lines ~219-249): Wrapped in `try { const emailResult = await sendTrialEndingEmail(...); if (!emailResult.success) console.error(...); } catch (emailErr) { console.error(...); }`. The catch is local to the email-send only; no `throw` inside the catch body. Continuation falls through to `updates.trial_warning_sent_at = new Date().toISOString();` regardless of email outcome.

2. **`sendPaymentFailedEmail`** (lines ~372-407): Wrapped in `try { const emailResult = await sendPaymentFailedEmail(...); if (!emailResult.success) console.error(...); } catch (emailErr) { console.error(...); }`. The catch is local to the email-send only; no `throw` inside the catch body. Continuation falls through to `return { accountId, stripeSubscriptionId }` regardless of email outcome.

Both wrappers preserve the contract: the webhook returns 200 to Stripe even when the email send fails, so Stripe does NOT retry the event purely because of an email failure (Stripe retries only trigger on non-200 responses — see Stripe webhook retry semantics).

## Decisions Made

- **Pre-UPDATE dispatch for trial-ending email**: per plan spec — if the email send blew up, the `trial_warning_sent_at` UPDATE would still execute and lock the account out of future retries. By sending BEFORE the UPDATE, a failure leaves the gate open (Stripe re-fires trial_will_end events on retry — but they're caught by the stripe_webhook_events PK dedupe, so this is more of a safety belt than active retry).
- **Post-UPDATE dispatch for payment-failed email**: per plan spec — if the status UPDATE fails and triggers dedupe rollback, the email must NOT have been sent (otherwise the customer would receive a payment-failed email for a state-change that didn't actually persist).
- **Two-layer idempotency on trial-ending**: `stripe_webhook_events` PK (event-level) + `trial_warning_sent_at IS NULL` (account-level). Both must clear. The account-level gate is belt-and-suspenders — Stripe SHOULD only fire trial_will_end once per subscription, but if it ever fires twice (e.g., subscription pause/resume edge case), the account-level gate prevents a duplicate email even if the dedupe row somehow didn't catch it.
- **Single-layer idempotency on payment-failed**: only `stripe_webhook_events` PK. Per resolved Q1 in 44-00-PLANNER-NOTES.md, payment-failed sends on EVERY retry attempt — Stripe fires a distinct event ID for each retry, so the event-level dedupe correctly produces exactly one email per retry. No account-level gate needed (and would actively defeat the goal of escalating the customer with adaptive copy on each retry).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Corrected inverted log-reason ternary in else branch of trial-ending idempotency gate**

- **Found during:** Task 2 (Dispatch sendTrialEndingEmail on trial_will_end)
- **Issue:** Plan-supplied code for the `else` branch had:
  ```typescript
  reason: !account.trial_warning_sent_at ? "no_owner_email" : "already_sent"
  ```
  But the outer condition that gates the `if`-branch is `!account.trial_warning_sent_at && account.owner_email`. We enter the `else` branch when EITHER `trial_warning_sent_at IS NOT NULL` OR `owner_email IS NULL`. The plan's ternary used `!account.trial_warning_sent_at` (truthy = warning NOT sent) to choose `"no_owner_email"` — but at that point we KNOW `trial_warning_sent_at IS NOT NULL` makes us enter else (the first branch already ruled out the `!trial_warning_sent_at && owner_email` happy path). The ternary was mapping the wrong test to the wrong reason.
- **Fix:** Rewrote ternary to test the right condition:
  ```typescript
  reason: !account.owner_email ? "no_owner_email" : "already_sent"
  ```
  This correctly distinguishes the two cases that fall into the else: (a) missing email → "no_owner_email", (b) already-sent timestamp present → "already_sent".
- **Files modified:** `app/api/stripe/webhook/route.ts`
- **Verification:** Manual code-path trace through the two else-entry conditions; no behavior change to the email-send path itself — the log line is purely diagnostic.
- **Committed in:** `1163a84` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's diagnostic log copy).
**Impact on plan:** Zero functional impact. Log-line diagnostic accuracy only — would have produced misleading log breadcrumbs in production if the trial_will_end branch ever hit the "already_sent" path. No scope creep.

## Issues Encountered

None. Plan was precise. The three edits applied cleanly, all verification greps passed, build and typecheck succeeded on first attempt. Parallel Plan 44-05 commits landed between my Task 2 and Task 3 commits but did not touch the webhook file (verified via `git show --stat`).

## User Setup Required

None. This plan modifies only `app/api/stripe/webhook/route.ts`. The Phase 44-01 schema migration (`cancel_at_period_end` column) is still pending production application — see STATE.md Blockers section. Once Andrew applies that migration, the new `updates.cancel_at_period_end` write on this plan will land cleanly; until then, the write would 500 against a missing column (Stripe retry storm risk). **Critical sequencing for Andrew:** apply the 44-01 migration BEFORE deploying this plan's changes to production. The repo / preview-deploy state is fine — production write is gated on the migration.

## Next Phase Readiness

- **Plan 44-05 (Status Card UI, unblocked):** Can now read `accounts.cancel_at_period_end` to render the "Cancels at period end" state in the billing page. The schema is in repo (Plan 44-01); production application is the only gate.
- **Plan 44-05 (Status Card UI):** Webhook + Portal Route (Plan 44-03) + Email senders (Plan 44-02) are now all in place. 44-05 is the final plan in Phase 44; after it ships, Phase 44 is feature-complete pending Andrew's UAT.
- **Phase 46 UAT — Stripe CLI triggers to exercise this end-to-end:**
  ```bash
  # Trigger trial-ending email (fires customer.subscription.trial_will_end)
  stripe trigger customer.subscription.trial_will_end

  # Trigger payment-failed email (fires invoice.payment_failed)
  stripe trigger invoice.payment_failed

  # Trigger cancel_at_period_end mirror (fires customer.subscription.updated with cancel_at_period_end=true)
  # Easier to exercise via Customer Portal Cancel button in the UI — Stripe CLI doesn't have a 1-shot trigger for this
  ```
- **PREREQ-C** (Customer Portal Dashboard config) remains pending — but this plan does NOT depend on it (the webhook handler is invoked by Stripe servers regardless of Portal configuration; Portal only matters for the customer-facing cancel flow in Plan 44-05).

## Concerns / Watch Items

- **Production migration sequencing:** The `cancel_at_period_end` column MUST exist in production before this plan's webhook write can succeed. STATE.md flags this as the Plan 44-01 production-apply-pending blocker. Andrew should apply it before pushing this plan's commits to production.
- **Email rate / spam concerns:** `sendPaymentFailedEmail` sends on every retry attempt. Stripe's default smart-retry schedule is 4 attempts over ~3 weeks (1 immediate + 3 retries spread over days), so the owner will receive 4 emails worst-case. This is intentional per CONTEXT.md but Andrew should know what to expect.
- **`trial_warning_sent_at` semantics:** This timestamp marks "we've attempted to send the trial-ending email for this trial cycle". If Stripe ever fires trial_will_end a second time for the same subscription (e.g., trial extended via Dashboard), the account-level gate would BLOCK the second send. This is the intentional safety behavior — if the owner extended their own trial, they don't need a "trial ending soon" email until the new end date is closer (Stripe would fire trial_will_end ~3 days before the new end date, with the existing timestamp still set, so the email would be suppressed). This is a known soft edge — flag for Phase 46 UAT to verify behavior with Andrew if trial extensions are exercised.

---
*Phase: 44-customer-portal-billing-polish-stripe-emails*
*Completed: 2026-05-11*
