# Stack Research: v1.8 Stripe Paywall + Login UX Polish

**Domain:** SaaS calendar/booking tool — Stripe subscription paywall
**Researched:** 2026-05-09
**Confidence:** HIGH (all Stripe findings verified against live docs.stripe.com and npm registry at research time)

---

## Summary

v1.8 has one meaningful new-stack question: Stripe. The other four themes (login reorder, 3-fail nudge, quota constant raise, magic-link inline helper) require zero new packages. That finding is stated explicitly per theme below.

---

## Theme Verdicts: "No New Packages" for Non-Stripe Work

| Theme | Verdict | Rationale |
|-------|---------|-----------|
| Login: move `<GoogleOAuthButton />` below password form | No new packages | Pure JSX reorder inside an existing component; no new behavior, no new dependency surface. |
| Login: password-first tab + 3-fail in-memory nudge | No new packages | Tab default is a `defaultValue` prop change (shadcn Tabs, already installed). Counter is `useState`. The magic-link prompt is conditional JSX. Nothing added. |
| Gmail quota constant `200 → 450` | No new packages | Single numeric literal change in `lib/email-sender/quota-guard.ts` per Phase 36 OQ-1 centralization; no import changes. |
| Magic-link tab: inline helper `<p>` | No new packages | Static text node, identical wording for all users (AUTH-29 invariant preserved by construction). No lib needed. |

---

## New Dependency: Stripe Node SDK

### Package

| Package | Current Version (verified npm 2026-05-09) | Install Command |
|---------|------------------------------------------|-----------------|
| `stripe` | **22.1.1** | `npm install stripe` |

**Do NOT install `@stripe/stripe-js`.** That package is the browser-side Stripe.js loader used only when embedding Stripe Elements directly in your React tree. For hosted Checkout (redirect to stripe.com), all work is server-side. Installing `@stripe/stripe-js` adds a client bundle for no benefit and creates a temptation to do client-side work that belongs on the server.

**Do NOT install `@stripe/react-stripe-js`.** Same reason: it wraps Elements for React; irrelevant for hosted Checkout.

### Initialization Pattern (TypeScript, App Router)

Create a singleton at `lib/stripe/client.ts`:

```typescript
import Stripe from 'stripe';

// Stripe 22.x (sdk-released alongside API 2026-04-22.dahlia) pins the API
// version automatically to the version current at SDK release time.
// Explicitly setting apiVersion keeps TypeScript types and runtime behavior
// in sync regardless of future SDK upgrades. Pin to the value that matches
// the SDK you installed; update intentionally during major SDK upgrades.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});
```

**API version pinning gotcha:** Starting with stripe-node v12, the SDK defaults to the API version current at its release date — NOT your account's default. However, if you upgrade the SDK later without updating `apiVersion`, the TypeScript types will drift from the pinned string you set. Rule: when you run `npm install stripe@<new-version>`, check the SDK changelog for the new `apiVersion` and update the string. Never leave `apiVersion` unset; the TypeScript compiler cannot help you if the version is implicit.

**Server-only guard:** This file must never be imported from client components. Add a comment or co-locate with other server-only utilities. If Next.js edge runtime is ever used, note that `stripe` SDK requires Node.js runtime (not Edge).

---

## Webhook Signature Verification

### Pattern for Next.js App Router Route Handler

App Router route handlers expose the native `Request` object, not an Express `req`. The raw body is available via `req.text()` — no middleware needed, no `bodyParser` configuration, no `export const config = { api: { bodyParser: false } }` (that was the Pages Router escape hatch).

Create `app/api/stripe/webhook/route.ts`:

```typescript
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import type Stripe from 'stripe';

export async function POST(req: Request) {
  const body = await req.text();                        // raw body, preserved
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    // Return 400 fast; Stripe retries on non-2xx
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  // Handle events — see webhook event list below
  switch (event.type) {
    case 'checkout.session.completed': { /* ... */ break; }
    case 'customer.subscription.updated': { /* ... */ break; }
    case 'customer.subscription.deleted': { /* ... */ break; }
    case 'invoice.paid': { /* ... */ break; }
    case 'invoice.payment_failed': { /* ... */ break; }
    case 'customer.subscription.trial_will_end': { /* ... */ break; }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
```

**Key differences from Pages Router:**
- `await req.text()` replaces the `buffer` accumulation hack (`req.on('data', ...)`)
- `headers()` from `next/headers` replaces `req.headers['stripe-signature']`
- No `export const config` needed
- `constructEvent` signature is unchanged: `(rawBody: string | Buffer, sig: string, secret: string)`

**Do NOT call `await req.json()` before `constructEvent`.** JSON parsing transforms the body; signature verification will fail. Always call `req.text()` first.

---

## Checkout Flow: Hosted Checkout (Recommended)

**Recommendation: Use Stripe-hosted Checkout.** Do not build embedded Elements for v1.8.

Rationale: This is a single-plan tool. The owner signs up once, rarely returns to billing. Hosted Checkout requires one server-side API call, handles card validation, 3DS, Apple Pay/Google Pay, PSD2 compliance, and localization with zero frontend code. Elements requires installing `@stripe/stripe-js` + `@stripe/react-stripe-js`, building and styling a payment form, handling validation states, and maintaining PCI scope awareness in your own components. The complexity cost is not justified.

### Checkout Session Creation (server action or route handler)

```typescript
import { stripe } from '@/lib/stripe/client';

export async function createCheckoutSession({
  accountId,
  customerId,
  priceId,
  trialDays = 14,
}: {
  accountId: string;
  customerId: string;
  priceId: string;          // STRIPE_PRICE_ID_MONTHLY or STRIPE_PRICE_ID_ANNUAL
  trialDays?: number;
}) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { account_id: accountId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?setup=complete`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
  });

  return session.url; // redirect owner to this URL
}
```

**Trial note:** `subscription_data.trial_period_days: 14` starts the 14-day trial. By default, Checkout collects a payment method upfront (card required before trial begins). If you want card-free trial signup, set `payment_method_collection: 'if_required'` — but this means the user can reach trial-end without a card on file; the subscription then moves to `paused` unless `trial_settings.end_behavior.missing_payment_method` is set to `cancel`. For a paywall scenario that converts to paid, requiring the card upfront (default) is the safer conversion path.

---

## Customer Portal (Recommended for Billing Management)

**Recommendation: Use Stripe Customer Portal for cancel/update card/view invoices.** Do not build a custom billing UI.

Rationale: Single plan means there is no plan-switching UI to customize. The portal handles cancel, update payment method, and invoice history for free. The only limitation relevant here — "trialing subscription modifications end the free trial immediately" — is acceptable and should be documented in the UI. Portal session creation is one API call; the portal is hosted on Stripe's domain.

### Portal Session Creation

```typescript
import { stripe } from '@/lib/stripe/client';

export async function createPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl, // e.g. `${NEXT_PUBLIC_APP_URL}/app/billing`
  });
  return session.url;
}
```

The `/app/billing` page calls this on a button press, then does `router.push(session.url)` (or a server redirect). No client-side Stripe library needed.

**Dashboard configuration required (manual step):** Enable the Customer Portal in Stripe Dashboard > Billing > Customer portal. Set allowed features (cancel, update payment method, invoice history). Set default return URL to `https://yourdomain.com/app/billing` so `return_url` can be omitted from API calls in production.

---

## Supabase Schema: `accounts` Table Additions

Add these columns to the existing `accounts` table. No new table needed for a single-plan tool.

| Column | Type | Nullable | Default | Rationale |
|--------|------|----------|---------|-----------|
| `stripe_customer_id` | `text` | YES (null before first Stripe interaction) | `NULL` | Foreign key into Stripe's customer namespace. Create the Stripe Customer object at owner signup (or lazily at first billing page visit). Not a secret — safe to store plaintext. AES-256-GCM encryption is NOT warranted; customer IDs are non-secret opaque identifiers. |
| `stripe_subscription_id` | `text` | YES | `NULL` | The `sub_xxx` ID. Null during free trial if trial is created without a subscription object (Checkout creates a subscription object immediately even for trials, so this will be populated after `checkout.session.completed`). |
| `subscription_status` | `text` | YES | `NULL` | Mirror of Stripe's subscription `.status` field. Use Stripe's exact vocabulary (see below). This is your fast-path gate for the paywall middleware — check this column, do not call Stripe API on every request. |
| `trial_ends_at` | `timestamptz` | YES | `NULL` | Populated from the subscription object's `trial_end` Unix timestamp at `checkout.session.completed`. Used to show countdown banner ("X days left in trial"). |
| `current_period_end` | `timestamptz` | YES | `NULL` | Populated from `current_period_end` on the subscription. Updated on every `customer.subscription.updated` webhook. Used to display next billing date and to determine grace periods on `past_due`. |

### Subscription Status Vocabulary (Stripe canonical values)

The `subscription_status` column must only ever contain these strings (verified against Stripe docs):

```
trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
```

**Paywall gate logic:** Allow `/app/*` access when `subscription_status IN ('trialing', 'active')`. Redirect to `/app/billing` for all other statuses (including `NULL` — account created but Checkout not yet completed). Public booker `/[account]/*` is never gated — do not read this column in booker middleware (LD-07 booker-neutrality).

### Recommended Index

```sql
CREATE UNIQUE INDEX accounts_stripe_customer_id_idx
  ON accounts (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

---

## Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Write `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` (`trialing` or `active`), `trial_ends_at`, `current_period_end` |
| `customer.subscription.updated` | Sync `subscription_status`, `current_period_end`, `trial_ends_at` (handles plan changes, payment recovery, trial end) |
| `customer.subscription.deleted` | Set `subscription_status = 'canceled'` |
| `invoice.paid` | Optionally send "payment received" email via `getSenderForAccount()` |
| `invoice.payment_failed` | Set `subscription_status = 'past_due'`; send dunning email via `getSenderForAccount()` |
| `customer.subscription.trial_will_end` | Fires 3 days before trial end; send trial-ending reminder via `getSenderForAccount()` |

**Email routing note:** All Stripe-triggered transactional emails (trial ending, payment failed) MUST route through `getSenderForAccount(accountId)` — the existing single sender factory. Do not call nodemailer or Resend directly from webhook handlers.

---

## Environment Variables

### Required (all environments)

| Variable | Purpose | Notes |
|----------|---------|-------|
| `STRIPE_SECRET_KEY` | Server-side Stripe API calls | `sk_test_...` in dev/staging, `sk_live_...` in production |
| `STRIPE_WEBHOOK_SECRET` | `constructEvent` signature verification | `whsec_...` from Stripe CLI (local dev) or Dashboard (deployed) |
| `STRIPE_PRICE_ID_MONTHLY` | Monthly billing price ID | `price_...` from Stripe Dashboard; test and live values differ |
| `STRIPE_PRICE_ID_ANNUAL` | Annual billing price ID | `price_...` from Stripe Dashboard; test and live values differ |
| `NEXT_PUBLIC_APP_URL` | Absolute base URL for Checkout success/cancel/return URLs | Already likely set; verify it exists |

### Test-Mode vs Live-Mode Discipline

**Never mix test and live keys in the same environment.** Test keys start with `sk_test_` and `pk_test_`; live keys start with `sk_live_` and `pk_live_`. Webhook secrets are environment-specific — the `whsec_...` from the Stripe CLI is different from the one in the Stripe Dashboard.

Recommended env setup:

| Environment | Keys | Webhook Secret Source |
|-------------|------|----------------------|
| Local dev | `sk_test_...` | Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) |
| Vercel Preview | `sk_test_...` | Stripe Dashboard webhook endpoint for preview URL |
| Vercel Production | `sk_live_...` | Stripe Dashboard webhook endpoint for production URL |

Set all Stripe variables in Vercel Dashboard under project environment variables. Do not commit any Stripe key to the repo. Do not add Stripe keys to `.env.local` if that file is committed (check `.gitignore`).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Checkout flow | Hosted Checkout (redirect) | Stripe Elements (embedded) | Elements requires `@stripe/stripe-js` + `@stripe/react-stripe-js`, custom form build, style maintenance. No benefit for single-plan v1.8. |
| Billing management UI | Stripe Customer Portal | Custom billing UI | Custom UI requires building cancel flow, card update, invoice list — 200-500 hours per industry estimate. Portal does it in one API call. |
| Subscription status storage | Local DB column synced via webhooks | Live Stripe API call per request | API call per request adds latency and couples availability to Stripe. Webhook sync is the standard SaaS pattern. |
| Sensitive data encryption | Plaintext for `stripe_customer_id` | AES-256-GCM | Customer IDs are non-secret opaque identifiers; no encryption warranted. The AES pattern in `lib/oauth/encrypt.ts` is reserved for OAuth tokens (actual secrets). |

---

## What NOT to Install

| Package | Why Not |
|---------|---------|
| `@stripe/stripe-js` | Browser-side Stripe.js loader; only needed for Elements. Hosted Checkout requires zero client-side Stripe code. |
| `@stripe/react-stripe-js` | React wrapper for Elements; same reason. Installing this is a signal the integration has drifted toward embedded Elements. |
| Any "stripe helper" wrapper (`stripe-node-webhooks`, etc.) | The `stripe` SDK's built-in `stripe.webhooks.constructEvent` is sufficient and official. Third-party wrappers add maintenance surface. |

---

## Installation

```bash
npm install stripe
```

That is the only `npm install` command for v1.8.

---

## Sources

- npm registry (live query 2026-05-09): `stripe` is at **22.1.1**
- [Stripe API Versioning](https://docs.stripe.com/api/versioning) — current API version `2026-04-22.dahlia`, pinning strategy
- [Set a Stripe API Version](https://docs.stripe.com/sdks/set-version) — TypeScript init pattern, behavior when `apiVersion` omitted
- [Stripe Webhooks](https://docs.stripe.com/webhooks) — raw body requirement, `constructEvent` inputs
- [Next.js App Router + Stripe Webhook Signature Verification](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f) — `req.text()` pattern, `headers()` import (MEDIUM confidence; cross-verified with official raw-body requirement)
- [stripe/stripe-node PR #2259](https://github.com/stripe/stripe-node/pull/2259) — official App Router webhook example in stripe-node repo
- [Stripe Customer Portal](https://docs.stripe.com/customer-management) — out-of-box capabilities, session creation API
- [Integrate the Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal) — `billingPortal.sessions.create` pattern, `return_url`
- [Stripe Hosted Checkout Quickstart](https://docs.stripe.com/checkout/quickstart) — session creation, mode: subscription, redirect pattern
- [Configure Free Trials](https://docs.stripe.com/payments/checkout/free-trials) — `trial_period_days`, `payment_method_collection`, `trial_settings.end_behavior`
- [Subscription Status Vocabulary](https://docs.stripe.com/billing/subscriptions/overview) — all 8 status strings verified
- [Build a Subscriptions Integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — webhook event list, fulfillment pattern

---

*Stack research for: v1.8 Stripe Paywall + Login UX Polish*
*Researched: 2026-05-09*
