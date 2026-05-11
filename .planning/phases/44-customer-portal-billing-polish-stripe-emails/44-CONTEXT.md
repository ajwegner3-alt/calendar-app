# Phase 44: Customer Portal + Billing Polish + Stripe Emails - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `/app/billing` to the Stripe Customer Portal for actively-subscribed owners (the Portal owns cancel / update-payment / invoices / plan-switching per LD-03), communicate the cancel-at-period-end lifecycle so owners aren't surprised when access ends, and dispatch the two Stripe-triggered transactional emails required by BILL-24 (`customer.subscription.trial_will_end` and `invoice.payment_failed`) through the existing `getSenderForAccount(accountId)` factory.

**In scope:** "Manage subscription" entry point on `/app/billing`, billing-page state variants (active / trialing / cancel-scheduled / past_due), cancellation lifecycle UX surface(s), the two emails listed in BILL-24, sender resolution via `getSenderForAccount`.

**Out of scope:** Custom cancel UI, in-app invoice list, in-app payment-method update form, dunning UI, additional transactional emails beyond BILL-24 (plan-change / interval-change / goodbye emails — see Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion — full delegation across all four areas

Andrew delegated all 16 specific decisions across the four discussed areas (Billing page states, Cancellation lifecycle, Plan-switching effects, Email content & tone) to Claude's discretion. The planner and researcher should treat the **defaults below as the implementation direction** and only escalate back to Andrew if they discover a hard constraint (LD violation, technical impossibility, or material cost/risk surprise).

### Billing page states (`/app/billing`)

The page already renders the 3-tier TierGrid for locked owners (Phase 42.5). Phase 44 extends it with state-aware rendering. **Default direction:**

- **Active** (`subscription_status='active'`, `plan_tier` set, `cancel_at_period_end=false`): Replace TierGrid with a Status Card at top showing current plan name, interval, next renewal date, and a primary "Manage Subscription" button that POSTs to a new `/api/stripe/portal` route returning a Stripe Billing Portal session URL. TierGrid is for selection — once selected, hide it.
- **Trialing** (`subscription_status='trialing'`, `plan_tier=NULL`): Keep current TierGrid behavior unchanged. The existing Phase 43 `SubscriptionBanner` already handles trial messaging app-wide. No Portal button (no Stripe customer linkage yet — Customer Portal session creation requires `stripe_customer_id`).
- **Cancel-scheduled** (`cancel_at_period_end=true`, still `active`): Status Card variant — amber-themed, headline "Subscription ends {period_end_date}", body "You'll keep access until then." Primary CTA is "Manage Subscription" (Portal handles reactivation per LD-03). No custom in-app reactivate button.
- **Past_due** (`subscription_status='past_due'`): Status Card variant with prominent "Update payment method" CTA. If Stripe Portal supports deep-linking to the payment-method page, use that; otherwise generic Portal session. Banner (Phase 43) carries app-wide urgency; billing page is the resolution point.
- **Canceled / Locked**: Existing Phase 43 + 42.5 behavior — TierGrid for re-selection. No change.

### Cancellation lifecycle

**Default direction:**

- **Detection:** Add `accounts.cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE` column via migration. Webhook handler writes it on `customer.subscription.updated` from `subscription.cancel_at_period_end`. Same pattern as the other billing columns — avoids per-render Stripe API calls. Phase 44 migration block.
- **Surfacing:** No new global banner (avoid banner fatigue stacking on top of the existing trial/past_due banner). The cancel-scheduled state is contained to `/app/billing` via the amber Status Card variant above. The owner explicitly clicked cancel — they know.
- **Access-loss day:** Standard Phase 43 paywall fall-through. When period-end arrives and webhook flips `subscription_status='canceled'`, the next `/app/*` request redirects to `/app/billing` and TierGrid renders for re-subscription. No custom "goodbye" moment in-app (the Stripe-triggered emails handle the operational notification).
- **Reactivation:** Portal-only, strict LD-03 adherence. No in-app reactivate button — `cancel_at_period_end=true` Status Card directs to "Manage Subscription" → Portal → Reactivate flow.

### Plan-switching effects

**Default direction:**

- **Silent.** Webhook writes new `plan_tier` / `plan_interval`, and existing Phase 42.6 feature gating reacts immediately on the next page load. Stripe sends its own receipt/proration email for the financial side; no in-app banner, toast, or NSI-sent confirmation email.
- The owner deliberately initiated the switch through the Portal — they don't need an in-app receipt of the action they just took. Add only if Phase 46 manual QA reveals a UX gap.
- Plan-change / interval-change emails are **explicitly deferred** to keep BILL-24 scope tight (see Deferred Ideas).

### Email content & tone

**Default direction:**

- **Tone:** Match existing NSI transactional emails (booking confirmation, magic-link). Reuse the existing email layout helpers / brand chrome so owner experience stays visually consistent. Voice = warm-professional, mirrors current templates.
- **Sender identity:** Per LD-11 strict reading, route through `getSenderForAccount(accountId)` exactly as configured for the account (account's Gmail or Resend, same as today). Owner sees billing emails arrive from the same address they send booking confirmations from. Researcher should verify this is actually desirable for *billing* emails specifically — if there's a reason to override to an NSI house address for the billing class (e.g., owner's quota concerns, deliverability of failure notices), call it out in RESEARCH.md as a planning-stage open question.
- **`trial_will_end` email:**
  - Subject: short, urgency-appropriate (e.g., "Your trial ends in 3 days")
  - Body: trial-end date, what they keep / lose, single primary CTA "Choose a plan" → `/app/billing`
  - No Branding consult cross-promo in this email — keep it focused on the conversion path the trial flow is built around. Branding CTA already lives on the billing page itself.
- **`invoice.payment_failed` email:**
  - Subject: clear, non-alarming (e.g., "We couldn't process your payment")
  - Body: brief explanation that Stripe will retry, what happens if all retries fail, what they should do
  - Primary CTA: "Update payment method" → `/app/billing` (the Status Card past_due variant routes them to Portal in one more click). Keeping them inside the app first preserves the owner's mental model of "the app is where I manage things."

### Sender factory contract preserved

`getSenderForAccount(accountId)` must remain the single dispatch point. Phase 44 must NOT introduce a parallel send path. Reuse `isRefusedSend(error)` dual-prefix helper for error handling (carried from v1.7). Failure to send a billing email must not block the webhook from completing — log and continue; the Stripe Dashboard / Customer Portal is the authoritative source of payment state.

### Webhook events to subscribe

Phase 41 registered 6 events; Phase 42-02 added `checkout.session.completed`. Phase 44 may need to verify the Stripe webhook endpoint includes `customer.subscription.trial_will_end` and `invoice.payment_failed`. If not, the researcher must add them to PREREQ verification (similar to PREREQ-G for Phase 42.5). Use `stripe webhook_endpoints update` CLI (v2 Dashboard UI restriction noted in Phase 41 decisions).

</decisions>

<specifics>
## Specific Ideas

- "Manage Subscription" is the user-facing label — matches Stripe's own Portal terminology, avoids inventing new vocabulary.
- Status Card visual treatment should mirror Phase 42.5 TierGrid card styling for cohesion (same Card primitive, same spacing scale, same typography).
- Past_due Status Card CTA prefers Stripe Portal's payment-method deep-link if `flow_data: { type: 'payment_method_update' }` is supported on the API version pinned by LD-01 (`2026-04-22.dahlia`). Researcher to confirm.
- Both transactional email templates should support the existing per-account branding (logo, account name) the same way booking-confirmation emails do today.

</specifics>

<deferred>
## Deferred Ideas

- **Plan-change confirmation emails** (downgrade / upgrade / interval-switch) — outside BILL-24 scope; revisit after Phase 46 QA if owners report confusion.
- **In-app reactivate button** — would create a custom equivalent of a Portal action, mild LD-03 tension. Defer unless Portal flow proves friction-heavy.
- **Goodbye / "subscription ended" email** when `canceled` status hits — outside BILL-24 spec; Stripe's own receipts cover the financial transaction side.
- **Global cancel-scheduled banner** on every `/app/*` page — chose contained billing-page surface instead; revisit if QA reveals owners forget they scheduled cancellation.
- **In-app invoice list** — explicit LD-03 — Portal owns invoice history.
- **Custom dunning UI** for past_due — Stripe handles dunning; we only show the banner + payment-method CTA.

</deferred>

---

*Phase: 44-customer-portal-billing-polish-stripe-emails*
*Context gathered: 2026-05-11*
