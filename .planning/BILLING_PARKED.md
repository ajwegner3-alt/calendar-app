# Billing Parked — v1.9 Free-Offering Scope Change

**Date:** 2026-05-15
**Decision:** Andrew is offering the app for free for the time being. All Stripe
billing is disabled but **no code was deleted** — every paid-billing artifact is
preserved in place and re-arms cleanly when billing is turned back on.

---

## The kill-switch

A single constant controls the entire paywall:

```
lib/stripe/billing-flag.ts  →  export const BILLING_ENABLED = false;
```

While `BILLING_ENABLED` is `false`:

| Surface | Behavior when billing disabled |
|---------|--------------------------------|
| Paywall middleware (`lib/supabase/proxy.ts`) | Subscription gate skipped — no account is ever locked out of `/app/*`. Per-request `accounts` lookup also skipped. |
| Widget gate — public embed (`app/embed/[account]/[event-slug]/page.tsx`) | `requireWidgetTier` bypassed — the booking widget renders for every account. |
| Widget gate — owner embed dialog (`app/(shell)/app/event-types/page.tsx`) | `isWidgetAllowed` forced `true` — embed code shown to every owner. |
| Trial / past-due banners (`app/(shell)/app/_components/subscription-banner.tsx`) | Renders nothing. |
| Billing page (`app/(shell)/app/billing/page.tsx`) | Shows a neutral "Calendar is free to use" notice instead of the pricing grid. |
| Sidebar nav (`components/app-sidebar.tsx`) | Billing entry hidden. |

## Where the parked Stripe code lives (preserved, not removed)

| Path | What it is |
|------|-----------|
| `lib/stripe/` | Stripe SDK client, price map (`prices.ts`), webhook helpers, widget-tier gate (`widget-gate.ts`) |
| `app/api/stripe/checkout/route.ts` | Hosted Checkout session route |
| `app/api/stripe/portal/route.ts` | Customer Portal session route |
| `app/api/stripe/webhook/route.ts` | Stripe webhook handler |
| `app/(shell)/app/billing/` | Billing page + tier grid + status card + checkout-return poller |
| `lib/email/send-trial-ending-email.ts` | Stripe trial-ending email sender |
| `lib/email/send-payment-failed-email.ts` | Stripe payment-failed email sender |
| `lib/supabase/proxy.ts` (paywall block) | Subscription lockout middleware — flag-guarded, code intact |

DB columns added for billing (`accounts.subscription_status`, `plan_tier`,
`plan_interval`, `trial_ends_at`, `cancel_at_period_end`, `current_period_end`,
`stripe_customer_id`, `stripe_subscription_id`; table `stripe_webhook_events`)
are left in place — they are harmless when unused and required if billing is
re-enabled.

## v1.8 billing work that is suspended (not cancelled)

- Live-mode Stripe stack setup (live Product + 4 Prices, Customer Portal config,
  webhook endpoint, promo code, Vercel live env vars). Live Price IDs already
  created 2026-05-13 — see `.planning/memory/v1.8-live-mode-uat-handoff.md` §3a.
- Live-mode UAT for the 5 deferred scenarios (3.2, 3.3, 3.4, 6.1, 6.2) + the
  re-keyed 7.4 — see `46-VERIFICATION.md`.
- Plan 46-04 (v1.8 archival docs) and Plan 46-05 (v1.8.0 annotated git tag).

## How to re-enable paid billing later

1. Flip `BILLING_ENABLED` to `true` in `lib/stripe/billing-flag.ts`.
2. Restore the live-mode Stripe stack — full step-by-step in
   `.planning/memory/v1.8-live-mode-uat-handoff.md` §3 (Product + Prices,
   Customer Portal, webhook endpoint, promo code, 11 Vercel env vars).
3. Decide trial policy for accounts that signed up during the free period
   (their `subscription_status` / `trial_ends_at` may be stale).
4. Redeploy and run the live-mode UAT scenarios.
5. Resume Plans 46-04 and 46-05.

Nothing in the parked code needs to be rewritten — the flag is the only switch.
