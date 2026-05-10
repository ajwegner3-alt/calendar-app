# Phase 42: Checkout Flow + Plan Selection Page - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Owners can visit `/app/billing`, choose monthly or annual billing, and complete a Stripe-hosted Checkout session. On return, the page polls subscription status (no optimistic update) and transitions to an "active" UI once the webhook flips `subscription_status` to `active`. A 30s polling window with reassuring fallback handles webhook lag.

Out of scope for this phase: paywall middleware enforcement (Phase 43), Customer Portal / cancel UI (Phase 44), Stripe-triggered emails (Phase 44).

</domain>

<decisions>
## Implementation Decisions

### Plan-selection card
- **Layout:** Claude's discretion — single-card-with-toggle or side-by-side cards both acceptable.
- **Price display:** Both formats, with monthly prominent. Large `$X/month`, small `($Y billed annually)` underneath for the annual option. Monthly option shows `$X/month`.
- **Savings callout:** "Save X%" badge on annual option (calculated from PREREQ-E pricing — e.g., "Save 20%"). Single callout, no doubled framing.
- **Card visual style:** Claude's discretion — fit the existing NSI brand tokens (use existing app card patterns unless an elevated billing card reads better in context).

### Interval selection
- **Default:** Annual is pre-selected/highlighted on first load. Nudges higher LTV; user can still flip to monthly with one click.
- **Recommended indicator:** Claude's discretion — savings badge may be enough, but a subtle "Best value" label on annual is acceptable if it doesn't feel cluttered.
- **Plan switching after subscribe:** Customer Portal only. No in-app interval toggle once `subscription_status = 'active'`. Matches **LD-03** (Portal handles plan-switch). Phase 44 ships the Portal link.
- **Microcopy:** Claude's discretion — reassuring tone fitting NSI voice (e.g., "Cancel anytime" is acceptable but not required).

### Post-checkout return UX (`/app/billing?session_id=...`)
- **Polling state (within 30s window):** Claude's discretion — pick presentation that doesn't feel broken during a ~5-30s wait. Spinner with reassuring single line OR multi-step indicator both acceptable.
- **Success state (when `subscription_status` flips to `active`):** Brief "You're all set!" confirmation, then **auto-redirect to `/app` after ~2s** (note: `/app` IS the dashboard route in this codebase — there is no separate `/app/dashboard` page). Don't strand the user on `/app/billing` after success.
- **Timeout fallback (30s exceeded, no webhook):** Claude's discretion on copy — must be reassuring (payment is safe), non-alarming, and offer clear next action (continue silent slow polling OR manual refresh CTA). User must not see "failed" framing during webhook lag.
- **Cancel return (user closes Checkout / Stripe `cancel_url`):** Claude's discretion — non-judgmental return to plan-selection card. No error state, no nag.

### Landing-state copy on `/app/billing`
- **Trial-active headline (voluntary visit):** Claude's discretion — pick what fits NSI voice (plan-focused, trial-aware, or welcome-tone are all acceptable framings).
- **Locked-state headline (trial expired / canceled / unpaid — redirected here by paywall in Phase 43):** Claude's discretion. ROADMAP's reference line "Everything is waiting for you! Head over to payments to get set up." is the tonal anchor — warm, non-punitive. Final copy may iterate on that.
  - **Note:** The page must render this locked-state framing in Phase 42 even though Phase 43 wires the redirect. Phase 43 should not need to add new copy; it just enables routing.
- **Trial countdown:** **YES — always display on `/app/billing` when account is `trialing`**, regardless of urgency threshold. (Phase 43's global banner uses the ≤3-day urgency threshold; the billing page itself shows the countdown unconditionally for trialing accounts so users on the billing page always see exactly how long they have.)
- **Feature list on plan card:** Claude's discretion — user is already on trial and knows the product, so minimal card (price + Subscribe) is acceptable. If a feature list reduces conversion friction, 3-5 bullets is the cap.

### Claude's Discretion (summary)
The user explicitly delegated these areas — choose what fits the NSI brand and existing UI patterns:
- Card layout (single-card-toggle vs side-by-side)
- "Best value" recommended indicator
- Card visual treatment vs existing app cards
- Polling-state presentation
- Timeout fallback copy and behavior (slow-poll vs manual-refresh)
- Cancel-return UX details
- Trial-active and locked-state headline wording
- Feature list inclusion
- Microcopy ("Cancel anytime" etc.)

### Locked from prior phases (must not be re-litigated)
- **LD-02:** Hosted Stripe Checkout only — no `@stripe/stripe-js`, no in-app payment form.
- **LD-03:** Customer Portal handles plan-switch/cancel — no in-app equivalent in Phase 42.
- **LD-10:** Return URL uses polling; webhook is canonical source of truth; **no optimistic update** of `subscription_status`.
- **Phase 41 carry:** Stripe API `2026-04-22.dahlia` field migration — `current_period_end` lives on `Stripe.SubscriptionItem` (`sub.items.data[0]?.current_period_end`), not `Stripe.Subscription`. Invoice subscription reference is `invoice.parent?.subscription_details?.subscription`.
- **Phase 41 carry:** `plan_interval` CHECK accepts both `month`/`year` (Stripe payload) and `monthly`/`annual` (CONTEXT vocabulary). Phase 42 **writes whatever Stripe returns via webhook** — does not write `monthly`/`annual` directly from checkout-return code.
- **Phase 41 carry — SC-5 obligation:** Phase 41's "real Stripe trigger writes to a real `accounts` row" was deferred to Phase 42's first checkout. Verification for Phase 42 must include an end-to-end sign-off that captures: checkout completes → webhook fires → `stripe_customer_id` populated on `accounts` row → `subscription_status = 'active'`.

</decisions>

<specifics>
## Specific Ideas

- Locked-state tonal anchor: "Everything is waiting for you! Head over to payments to get set up." (from ROADMAP Phase 43 SC-3 — Phase 42 owns the page, Phase 43 owns the redirect).
- "Save X%" annual badge: percentage computed from the actual PREREQ-E prices (e.g., if monthly = $20 and annual = $192, badge reads "Save 20%"). Don't hard-code 20%.
- Auto-redirect after success: ~2s feels right — long enough to register "active," short enough to not feel stuck.
- Phase 42 verification must close the Phase 41 SC-5 gap (first real `stripe_customer_id` linkage proves the full Stripe → webhook → accounts pipeline).

</specifics>

<deferred>
## Deferred Ideas

- **Customer Portal "Manage subscription" button** — Phase 44 (LD-03).
- **Paywall middleware redirect of locked owners to `/app/billing`** — Phase 43 (LD-07 + LD-08).
- **Trial banner across `/app/*`** (urgent at ≤3 days, neutral otherwise) — Phase 43 (BILL-15..17).
- **Stripe-triggered transactional emails** (`trial_will_end`, `invoice.payment_failed`) — Phase 44 (BILL-24).
- **`past_due` banner** — Phase 43 (LD-08).
- **Multi-tier pricing / plan upgrades** — not on v1.8 roadmap. Single plan only.

</deferred>

---

*Phase: 42-checkout-flow-and-plan-selection*
*Context gathered: 2026-05-10*
