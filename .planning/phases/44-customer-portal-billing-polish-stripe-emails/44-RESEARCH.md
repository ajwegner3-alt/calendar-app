# Phase 44: Customer Portal + Billing Polish + Stripe Emails - Research

**Researched:** 2026-05-11
**Domain:** Stripe Customer Portal API, webhook email dispatch, billing page state machine
**Confidence:** HIGH (codebase verified by direct file inspection; Stripe API verified against docs.stripe.com 2026-05-11)

---

## Executive Summary

- **Portal session creation is straightforward.** `stripe.billingPortal.sessions.create()` requires only `customer` + `return_url`. The `flow_data: { type: 'payment_method_update' }` deep-link IS supported on the current API version and requires no additional fields beyond `type`. No configuration ID is required — the default configuration is used automatically.
- **`cancel_at_period_end` is a top-level boolean on `Stripe.Subscription`** (not migrated to SubscriptionItem like `current_period_end`). It is already returned by `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` — the webhook handler can read it from `sub.cancel_at_period_end` directly.
- **The webhook handler already handles both new Phase 44 events.** `customer.subscription.trial_will_end` and `invoice.payment_failed` are already in the `switch` block in `app/api/stripe/webhook/route.ts` (lines 101, 110). The Phase 41 VERIFICATION report confirms the live endpoint ID is `we_1TVfOTJ7PLcBbY73Groz1G13`. Whether both events are in the endpoint's `enabled_events` list must be verified via CLI — Phase 41 registered 6 events, and the Phase 41 CONTEXT explicitly lists `customer.subscription.trial_will_end` and `invoice.payment_failed` as two of those 6.
- **`getSenderForAccount` never throws.** Every failure path returns a refused sender (`{ success: false, error: '...' }`). Billing email failure handlers must call `isRefusedSend(result.error)` + log, then return 200 from the webhook. Identical pattern to booking confirmations.
- **The `trial_warning_sent_at` column already exists** (Phase 41 migration added it; the comment on that column says "Phase 44 reads this to gate the trial-ending email"). This column is the idempotency guard for the trial-ending email — check it before sending, set it on send.
- **Billing page needs `cancel_at_period_end` + `plan_tier` + `current_period_end` added to the server component's SELECT** and the state derivation logic extended to emit `cancel_scheduled` and `past_due` variants of the Status Card.

---

## API Surface Notes

### `stripe.billingPortal.sessions.create()` — Full Parameter Map

```typescript
// Source: https://docs.stripe.com/api/customer_portal/sessions/create (verified 2026-05-11)
const session = await stripe.billingPortal.sessions.create({
  customer: customerId,        // REQUIRED — Stripe Customer ID (cus_*)
  return_url: returnUrl,       // REQUIRED — where to send owner after Portal actions

  // Optional — only needed when multiple portal configurations exist.
  // Omit to use the default configuration (PREREQ-C configures the default).
  configuration: undefined,   // omit entirely

  // Optional — for deep-linking to a specific flow.
  // For past_due CTA: deep-link to payment method update.
  flow_data: {
    type: 'payment_method_update',
    // No additional fields required for payment_method_update.
    // Other types that need more data:
    //   subscription_cancel: { subscription_cancel: { subscription: subId } }
    //   subscription_update: { subscription_update: { subscription: subId } }
  },
});
// Returns: { url: string, return_url: string, ... }
// The portal session URL is session.url — redirect browser here.
```

**Session URL TTL:** Portal session URLs are short-lived (documented as ~5 minutes). Generate a new session on each button click — never cache or reuse a portal URL.

**Return value:** `session.url` is the portal URL to redirect to. It is never null for a successful call (unlike `checkout.sessions.create` which can have null `url` in embedded mode). Still guard defensively.

### `flow_data` — Supported Types (HIGH confidence)

| Type | Extra fields required | Use case |
|------|-----------------------|----------|
| `payment_method_update` | none | Past_due: "Update payment method" deep-link |
| `subscription_cancel` | `{ subscription_cancel: { subscription: subId } }` | Not used in Phase 44 |
| `subscription_update` | `{ subscription_update: { subscription: subId } }` | Not used in Phase 44 |
| `subscription_update_confirm` | more fields | Not used in Phase 44 |

Phase 44 only uses `payment_method_update` (no subscription ID required). Generic portal (no `flow_data`) is used for the standard "Manage Subscription" button.

### Portal Configuration

**No configuration ID needed.** `stripe.billingPortal.sessions.create()` uses the default configuration when `configuration` is omitted. PREREQ-C sets up the default configuration in the Stripe Dashboard. Phase 44 code never needs to reference a configuration ID.

**If multiple configurations exist** (e.g., one with plan-switching, one without), pass the specific configuration ID in the `configuration` field. Since PREREQ-C creates/configures a single default configuration, omit this field.

### Error Modes for Portal Session Creation

| Condition | Stripe Error | Phase 44 Handling |
|-----------|-------------|-------------------|
| `stripe_customer_id` is NULL | API call never made (guard before calling) | Return 400 `{ error: "no_customer" }` |
| Customer deleted in Stripe | Stripe throws `StripeInvalidRequestError` | Catch + return 500 |
| No active subscription | Portal still works (owner can add payment method) | Not an error; allow |
| Invalid return_url | Stripe validates URL | Catch + return 500 |

---

## Migration Plan

### `cancel_at_period_end` Column Shape

```sql
-- supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql
BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.accounts.cancel_at_period_end IS
  'Mirror of Stripe subscription.cancel_at_period_end. Written by webhook on customer.subscription.updated/created/deleted. True = owner scheduled cancellation via Portal; access continues until current_period_end.';

COMMIT;
```

**Notes:**
- `ADD COLUMN IF NOT EXISTS` — idempotent, safe to re-apply.
- `NOT NULL DEFAULT FALSE` — no backfill needed; all existing rows default to false (no one has cancelled yet).
- No RLS changes needed — `accounts` RLS is already configured; this column inherits the same policy.
- `cancel_at_period_end` is a **top-level boolean** on `Stripe.Subscription` in `2026-04-22.dahlia` — it did NOT move to `SubscriptionItem` like `current_period_end` did. Access via `sub.cancel_at_period_end` directly.

### Where to Write It in the Webhook Handler

In `app/api/stripe/webhook/route.ts`, `handleSubscriptionEvent()` at lines 169–231, inside the `else` branch (lines 202–213) that handles everything except `trial_will_end`:

```typescript
// Add this line to the updates object at line ~211:
updates.cancel_at_period_end = sub.cancel_at_period_end ?? false;
```

Events that carry `cancel_at_period_end` on the subscription object:
- `customer.subscription.created` — always `false` on creation
- `customer.subscription.updated` — becomes `true` when owner cancels via Portal
- `customer.subscription.deleted` — `false` after deletion (moot, but include for consistency)

### Migration Application Path

**Tech debt context:** The Phase 41 RESEARCH notes that prior migration files (phases 36/37) exist on disk but may not be registered in `schema_migrations` in production. Phase 44's migration faces the same gap.

**Recommended path (matches Phase 41/42.5 precedent):**
1. Apply via Supabase MCP `apply_migration` — this is the proven approach for phases 41 and 42.5.
2. If MCP apply fails with "already applied" or schema conflict, fall back to the Supabase Dashboard SQL editor (run the body of the migration manually).
3. Verify: `SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='cancel_at_period_end'` — should return 1 row.

**Andrew's manual step:** Apply via MCP or Dashboard. The planner should include a PREREQ verification step.

---

## Webhook Event Subscription

### Current Endpoint State (HIGH confidence — from Phase 41 VERIFICATION)

- **Endpoint ID:** `we_1TVfOTJ7PLcBbY73Groz1G13`
- **URL:** `https://booking.nsintegrations.com/api/stripe/webhook`
- **API Version:** `2026-04-22.dahlia`
- **Events registered (Phase 41 CONTEXT list):**
  1. `customer.subscription.created`
  2. `customer.subscription.updated`
  3. `customer.subscription.deleted`
  4. `customer.subscription.trial_will_end`
  5. `invoice.payment_failed`
  6. `invoice.payment_succeeded`
  - Plus `checkout.session.completed` added in Phase 42-02

**Both Phase 44 events (`customer.subscription.trial_will_end` and `invoice.payment_failed`) were in Phase 41's original 6-event list.** However, verify the live endpoint actually has them — the Dashboard v2 UI restriction noted in Phase 41 means only CLI can add events reliably.

### Verification Command

```bash
# Verify current enabled_events on the live endpoint:
stripe webhook_endpoints retrieve we_1TVfOTJ7PLcBbY73Groz1G13

# Or list all endpoints:
stripe webhook_endpoints list
```

### Add Events if Missing (CLI — bypasses v2 Dashboard UI restriction)

```bash
# If customer.subscription.trial_will_end or invoice.payment_failed are NOT in enabled_events:
stripe webhook_endpoints update we_1TVfOTJ7PLcBbY73Groz1G13 \
  --enabled-events customer.subscription.created \
  --enabled-events customer.subscription.updated \
  --enabled-events customer.subscription.deleted \
  --enabled-events customer.subscription.trial_will_end \
  --enabled-events invoice.payment_failed \
  --enabled-events invoice.payment_succeeded \
  --enabled-events checkout.session.completed
```

**Note:** When using `--enabled-events` on an update, you must pass the FULL list you want. Passing only the new events replaces (not appends to) the existing list.

**Test vs. Live:** These are separate webhook endpoints in Stripe. The endpoint above is the live endpoint. If a test endpoint exists, it requires a separate update with the test mode CLI. During development, `stripe listen --forward-to localhost:3000/api/stripe/webhook` creates a temporary test listener.

### Test Trigger Commands (for Phase 44 verification)

```bash
# Trigger trial_will_end (fires 3 days before trial ends):
stripe trigger customer.subscription.trial_will_end

# Trigger invoice.payment_failed:
stripe trigger invoice.payment_failed

# Trigger subscription.updated (for cancel_at_period_end write):
stripe trigger customer.subscription.updated

# Note: stripe trigger uses synthetic fixtures. Real payloads may have
# slightly different field values (especially nested objects). Test clocks
# are more accurate for trial_will_end timing verification.
```

---

## Email Mechanics

### `customer.subscription.trial_will_end`

**Timing (HIGH confidence — Stripe docs):**
- Fires exactly **3 days before `trial_end`**.
- For **trials shorter than 3 days**, the event fires **immediately when the subscription is created** (not 3 days before — it fires right away since the trial is already less than 3 days out).
- Fires **once per trial** — not repeated. The webhook idempotency table (`stripe_webhook_events` PRIMARY KEY) plus `trial_warning_sent_at` together prevent double-sends.

**Payload fields to extract:**

```typescript
// event.data.object is Stripe.Subscription
const sub = event.data.object as Stripe.Subscription;
const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
const trialEnd = sub.trial_end; // Unix timestamp (seconds)
// Convert: new Date(trialEnd * 1000).toISOString()
```

**Idempotency strategy:**
- `stripe_webhook_events` PRIMARY KEY prevents duplicate webhook processing.
- `trial_warning_sent_at` column (Phase 41) provides a second guard: check before sending, set after sending.
- The existing webhook handler already writes `trial_warning_sent_at = new Date().toISOString()` on `customer.subscription.trial_will_end` (line 201 of `app/api/stripe/webhook/route.ts`). Phase 44 must send the email **inside `handleSubscriptionEvent`** (or a new `handleTrialWillEnd` helper) **before** or **around** the existing `trial_warning_sent_at` write.
- Recommended approach: check if `trial_warning_sent_at` is already set on the account row before sending. If set, skip email send (extra safety beyond webhook idempotency).

**Email fields needed from DB:**
```typescript
// Additional account columns to SELECT in handleSubscriptionEvent for trial_will_end:
// id, trial_warning_sent_at (for idempotency check), owner_email, name, logo_url, brand_primary
```

### `invoice.payment_failed`

**Timing (HIGH confidence — multiple Stripe sources):**
- Fires on **every failed payment attempt**, including each automatic retry.
- Stripe's default retry schedule: attempts at day 0, day 3, day 5, day 7 (4 total). Configurable in Dashboard under "Subscription and recovery" → "Smart Retries".
- `invoice.attempt_count` increments with each retry (1 for first attempt, 2 for second, etc.).
- `invoice.next_payment_attempt` is a Unix timestamp for the next scheduled attempt; it is `null` on the final failure.

**Payload fields to extract:**

```typescript
// event.data.object is Stripe.Invoice
const invoice = event.data.object as Stripe.Invoice;
const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
// In 2026-04-22.dahlia: invoice.parent.subscription_details.subscription (not invoice.subscription)
const subscriptionId = invoice.parent?.subscription_details?.subscription;
const amountDue = invoice.amount_due; // in cents
const attemptCount = invoice.attempt_count;
const nextPaymentAttempt = invoice.next_payment_attempt; // Unix timestamp or null (final failure)
const hostedInvoiceUrl = invoice.hosted_invoice_url; // URL to Stripe-hosted invoice page
```

**Send on first failure only vs. every retry:**
- The CONTEXT.md says send the `invoice.payment_failed` email through `getSenderForAccount`. Since the event fires on every retry, the email would send on every retry if not guarded.
- **Recommendation:** Send on every retry attempt (not just first). This is the common pattern — each retry is another opportunity for the owner to act. The email copy ("Stripe will retry, here's what to do") remains accurate for all retries. The `attempt_count` field can be included in the email body for context ("This is attempt 2 of 4"). Do NOT add a `payment_failed_email_sent_at` column — the copy already sets correct expectations and multiple sends are acceptable for payment failures.
- **If spamming is a concern for Andrew:** guard on `attemptCount === 1` (send only on first failure). This is a planning decision — document as an open question.

**Idempotency:** Webhook idempotency table prevents duplicate sends for the same Stripe event ID. Each retry is a distinct event with a distinct event ID, so each retry gets one email.

---

## Codebase Patterns to Reuse

### `getSenderForAccount(accountId)` — Full Signature

```typescript
// lib/email-sender/account-sender.ts — line 104
export async function getSenderForAccount(accountId: string): Promise<EmailClient>
```

- **Never throws.** Every failure path (account not found, no credential, decrypt failed, token exchange failed, revoked OAuth) returns a `refusedSender` — an `EmailClient` whose `.send()` always returns `{ success: false, error: '...' }`.
- **Routing:** If `account.email_provider === 'resend'` and `resend_status !== 'suspended'`, returns Resend client. Otherwise, goes through Gmail OAuth flow.
- **Resend fromAddress:** `"bookings@nsintegrations.com"` (hardcoded in line 148). Billing emails sent via Resend would also use this `from`. If this feels wrong for billing emails (owner receiving from their own booking address), that is the LD-11 behavior — surfaced as open question below.

### `isRefusedSend(error)` — Signature

```typescript
// lib/email-sender/account-sender.ts — line 28
export function isRefusedSend(error?: string): boolean
// Returns true if error starts with "oauth_send_refused:" OR "resend_send_refused:"
```

**Pattern for billing email failure in webhook handler:**

```typescript
const sender = await getSenderForAccount(accountId);
const result = await sender.send({ to, subject, html, text });
if (!result.success) {
  if (isRefusedSend(result.error)) {
    console.error('[billing-email] send refused', { accountId, error: result.error, eventType });
  } else {
    console.error('[billing-email] send failed', { accountId, error: result.error, eventType });
  }
  // DO NOT throw — webhook must return 200 regardless of email failure.
  // The Stripe Portal / Dashboard remains authoritative for payment state.
}
```

### Email Template Helpers (from `lib/email/branding-blocks.ts`)

```typescript
// All four helpers are available server-only:
renderEmailBrandedHeader(branding: EmailBranding): string
  // EmailBranding = { name: string; logo_url: string | null; brand_primary: string | null }

renderEmailFooter(): string
  // Returns "Powered by North Star Integrations" footer HTML

renderBrandedButton(opts: { href: string; label: string; primaryColor: string | null }): string
  // Returns inline-styled <a> button HTML

brandedHeadingStyle(primaryColor: string | null): string
  // Returns inline CSS string for H1 styling with brand color

stripHtml(html: string): string
  // Strips HTML for plain-text alternative

escapeHtml(s: string): string  // internal — duplicate in each sender file
```

**Template structure to follow:**

```typescript
// Mirror send-booking-confirmation.ts pattern:
const branding = { name: account.name, logo_url: account.logo_url, brand_primary: account.brand_primary };
const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">Subject-like heading</h1>
  <p>Body copy...</p>
  ${renderBrandedButton({ href: ctaUrl, label: 'CTA label', primaryColor: account.brand_primary })}
  ${renderEmailFooter()}
</div>`;
const text = stripHtml(html);
```

### New Email Files to Create

- `lib/email/send-trial-ending-email.ts` — mirrors `send-booking-confirmation.ts` shape
- `lib/email/send-payment-failed-email.ts` — mirrors `send-booking-confirmation.ts` shape

Both files: `import "server-only"`, use `getSenderForAccount`, use `isRefusedSend`, return `{ success: boolean; error?: string }`, never throw.

### Phase 42 Checkout Route — Mirror Structure for Portal Route

`app/api/stripe/checkout/route.ts` is the direct mirror for `app/api/stripe/portal/route.ts`:

| Step | Checkout route | Portal route |
|------|---------------|--------------|
| Auth | `supabase.auth.getClaims()` | same |
| Account fetch | `.from("accounts").select("id, owner_email, stripe_customer_id")` | same, add `subscription_status, plan_tier, cancel_at_period_end` |
| Guard | No-account → 404 | same |
| Customer guard | Creates customer if null | Return 400 if null (trialing user hits button — should be hidden in UI, but guard API) |
| Stripe call | `stripe.checkout.sessions.create()` | `stripe.billingPortal.sessions.create()` |
| Return | `{ url: session.url }` JSON 200 | same |
| Error handling | try/catch → 500 | same |

**Return shape:** JSON `{ url: string }` with status 200 (matches checkout). Client uses `window.location.assign(url)` to redirect to Portal.

**`return_url` construction:**

```typescript
const origin =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000');
const return_url = `${origin}/app/billing`;
```

Mirror the exact pattern from `app/api/stripe/checkout/route.ts` lines 208–213.

### Past_due Deep-Link

The portal route should accept an optional `flow` body parameter:

```typescript
// Request body (optional):
// { flow?: 'payment_method_update' }
// When flow === 'payment_method_update', add flow_data to session.create()
const body = await req.json().catch(() => ({})) as Record<string, unknown>;
const usePaymentMethodFlow = body.flow === 'payment_method_update';
// Then conditionally include flow_data in the session.create() call
```

This lets the billing page's past_due CTA pass `{ flow: 'payment_method_update' }` in the POST body.

### Card Primitive

`components/ui/card.tsx` exports: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction`.

The component uses `data-slot` attributes and container-query-based responsive spacing. The Status Card should use the same `Card` + `CardHeader` + `CardContent` structure as `ActiveView` and `LockedView` in `billing-state-views.tsx`.

### Date Formatting

`SubscriptionBanner` uses `new Date(trialEndsAt).getTime()` and direct arithmetic — no external date helper for simple date display. For `current_period_end` formatting in the Status Card:

```typescript
// Mirror billing page's deriveTrialDaysLeft pattern:
const renewalDate = account.current_period_end
  ? new Date(account.current_period_end).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    })
  : null;
// e.g., "June 10, 2026"
```

No `date-fns` needed for this display (booking confirmations use `date-fns` for complex timezone formatting — billing dates are simpler).

---

## Billing Page State Machine

### Extended Account SELECT (billing page needs these columns)

Current (Phase 42.5): `select("id, subscription_status, trial_ends_at")`

Phase 44 needs: `select("id, subscription_status, trial_ends_at, plan_tier, cancel_at_period_end, current_period_end, stripe_customer_id")`

### State Derivation Table

| `subscription_status` | `cancel_at_period_end` | `stripe_customer_id` | UI State | Component |
|-----------------------|------------------------|----------------------|----------|-----------|
| `trialing` | (any) | NULL | plan_selection | TrialingHeader + TierGrid (no change) |
| `trialing` | (any) | non-null | plan_selection | TrialingHeader + TierGrid (no change) |
| `active` | `false` | non-null | active | StatusCard (green — current plan, renewal date, "Manage Subscription") |
| `active` | `true` | non-null | cancel_scheduled | StatusCard (amber — "Subscription ends {date}", "Manage Subscription") |
| `past_due` | (any) | non-null | past_due | StatusCard (amber — "Update payment method" w/ deep-link flow) |
| `canceled` / `unpaid` / `incomplete` / `incomplete_expired` | (any) | (any) | locked | LockedView + TierGrid (no change — Phase 42.5/43) |

### Extended BillingPageState Type

```typescript
type BillingPageState =
  | { type: "polling"; sessionId: string }
  | { type: "active"; planTier: string | null; planInterval: string | null; renewalDate: string | null }
  | { type: "cancel_scheduled"; planTier: string | null; periodEndDate: string | null }
  | { type: "past_due" }
  | { type: "plan_selection"; trialDaysLeft: number | null }
  | { type: "locked" };
```

### Priority Order (evaluation order matters)

```
1. session_id present → polling
2. subscription_status === 'active' AND cancel_at_period_end === true → cancel_scheduled
3. subscription_status === 'active' → active
4. subscription_status === 'trialing' → plan_selection (with trial countdown)
5. subscription_status === 'past_due' → past_due
6. everything else → locked
```

Note: `cancel_scheduled` must be checked BEFORE generic `active` since both have `subscription_status='active'`.

### StatusCard Variants (new component)

**File:** `app/(shell)/app/billing/_components/status-card.tsx`

Three visual variants — all use `Card` + `CardHeader` + `CardContent` + `CardFooter`:

**Active variant:**
- CardTitle: "{plan_tier} Plan" (e.g., "Widget Plan")
- CardContent: "Monthly" or "Annual" · "Renews {date}"
- CardFooter: "Manage Subscription" Button (default variant, full-width)

**Cancel-scheduled variant (amber-themed):**
- Add `className="border-amber-200"` to Card
- CardTitle: "Subscription ending"
- CardContent: "Your subscription ends on {period_end_date}. You'll keep access until then."
- CardFooter: "Manage Subscription" Button (to Portal — handles reactivation per LD-03)

**Past_due variant:**
- Add `className="border-amber-200"` to Card
- CardTitle: "Payment required"
- CardContent: "We couldn't process your last payment. Please update your payment method to keep your account active."
- CardFooter: "Update payment method" Button — POSTs `{ flow: 'payment_method_update' }` to `/api/stripe/portal`

### "Manage Subscription" Button Pattern

The button is a **client component** (needs `onClick` / `useTransition`). Mirror `SubscribeTierCard`'s pattern exactly:

```typescript
"use client";
// fetch('/api/stripe/portal', { method: 'POST', body: JSON.stringify({ flow: 'payment_method_update' }) })
// on success: window.location.assign(data.url)
// on failure: setError(...)
```

Alternatively: wrap only the button in a client component; keep StatusCard itself as server-rendered. The status data (plan name, date) is server-fetched and passed as props to the client button component.

---

## Portal Route Implementation Sketch

```typescript
// app/api/stripe/portal/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // 1. Auth gate — mirror checkout route
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  // 2. Fetch account (RLS-scoped)
  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id, stripe_customer_id")
    .is("deleted_at", null)
    .maybeSingle();

  if (accountErr || !account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404, headers: NO_STORE });
  }

  // 3. Guard: Portal requires a Stripe customer ID (trialing users without first checkout)
  if (!account.stripe_customer_id) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 400, headers: NO_STORE });
  }

  // 4. Parse optional flow param
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const usePaymentMethodFlow = body.flow === 'payment_method_update';

  // 5. Derive return URL (mirror checkout route pattern)
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'http://localhost:3000');

  // 6. Create portal session
  let session: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${origin}/app/billing`,
      ...(usePaymentMethodFlow ? { flow_data: { type: 'payment_method_update' } } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-portal] session create failed", { account_id: account.id, err: message });
    return NextResponse.json({ error: "stripe_error" }, { status: 500, headers: NO_STORE });
  }

  if (!session.url) {
    console.error("[stripe-portal] session.url is null", { account_id: account.id });
    return NextResponse.json({ error: "no_session_url" }, { status: 500, headers: NO_STORE });
  }

  console.log("[stripe-portal] session created", { account_id: account.id, outcome: "success" });
  return NextResponse.json({ url: session.url }, { headers: NO_STORE });
}
```

---

## Webhook Email Dispatch — Integration Points

### Where to Plug In

Both email sends go inside `app/api/stripe/webhook/route.ts`. The switch block already routes both events:

**`customer.subscription.trial_will_end` (line 101–106):**
Currently calls `handleSubscriptionEvent()` which writes `trial_warning_sent_at`. Phase 44 adds a new `handleTrialWillEnd()` call **before** or **as part of** the existing handler. The new handler:
1. Looks up account by `stripe_customer_id`
2. Checks `trial_warning_sent_at` — if already set, skip email (extra idempotency beyond webhook dedup)
3. Fetches account branding columns (`name, logo_url, brand_primary, owner_email`)
4. Calls `sendTrialEndingEmail(accountId, trialEndDate, account)`
5. The existing `handleSubscriptionEvent` still writes `trial_warning_sent_at`

**`invoice.payment_failed` (line 110–115):**
Currently calls `handleInvoiceEvent()` which sets `subscription_status='past_due'`. Phase 44 adds `sendPaymentFailedEmail(accountId, invoice, account)` call after the DB write succeeds.

**Important:** Both email sends must be inside the `try` block. If send throws (it shouldn't — `getSenderForAccount` never throws), the 500 + dedupe rollback would retry. Since the email send returns a result object (not throws), this is not a concern — just log failures.

### Account Columns Needed for Email Sends

Add to account lookup in `handleSubscriptionEvent` and `handleInvoiceEvent`:

```typescript
const { data: account } = await admin
  .from("accounts")
  .select("id, name, logo_url, brand_primary, owner_email, trial_warning_sent_at")
  .eq("stripe_customer_id", customerId)
  .maybeSingle();
```

---

## Testing and Verification Commands

### Stripe CLI Test Triggers

```bash
# Must have stripe CLI installed and authenticated
stripe login

# Trigger trial_will_end (uses synthetic fixture):
stripe trigger customer.subscription.trial_will_end

# Trigger invoice.payment_failed:
stripe trigger invoice.payment_failed

# Trigger subscription updated with cancel_at_period_end=true:
# (stripe trigger doesn't support custom field overrides for this;
# use Stripe Dashboard → Subscriptions → Cancel subscription (cancel at period end)
# OR use Stripe test clocks for accurate simulation)

# Forward to local dev server:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Stripe CLI fixture caveat:** `stripe trigger` uses synthetic payloads. The `customer` field in these fixtures is a test customer that does NOT exist in your `accounts` table — the webhook handler will log `[stripe-webhook] no account for customer` and return 500. This is expected behavior for synthetic triggers against a real DB. To test end-to-end:
1. Use a real test-mode Stripe customer that has a linked account row.
2. OR: temporarily swap the `handleSubscriptionEvent` account lookup to accept a test customer ID.

### Static Analysis Grep Targets (for VERIFICATION.md)

```bash
# Verify portal session creation exists:
grep -r "billingPortal.sessions.create" app/api/stripe/portal/

# Verify cancel_at_period_end written in webhook:
grep -n "cancel_at_period_end" app/api/stripe/webhook/route.ts

# Verify trial_will_end email call:
grep -n "trial_will_end" app/api/stripe/webhook/route.ts
grep -r "sendTrialEndingEmail\|trial-ending\|trial_ending" lib/email/

# Verify payment_failed email call:
grep -n "payment_failed" app/api/stripe/webhook/route.ts
grep -r "sendPaymentFailedEmail\|payment-failed" lib/email/

# Verify getSenderForAccount used in new email files:
grep -r "getSenderForAccount" lib/email/send-trial-ending*.ts lib/email/send-payment-failed*.ts

# Verify isRefusedSend used in new email files:
grep -r "isRefusedSend" lib/email/send-trial-ending*.ts lib/email/send-payment-failed*.ts
```

### Live Verification Scenarios

1. **Portal navigation:** Login as active owner → `/app/billing` → click "Manage Subscription" → should redirect to Stripe Customer Portal URL.
2. **Portal return:** Complete any Portal action → should return to `/app/billing`.
3. **Past_due deep-link:** Use Supabase MCP to set `subscription_status='past_due'` on test account → reload `/app/billing` → click "Update payment method" → should land directly on payment method page in Portal (not Portal home).
4. **Cancel-scheduled state:** Cancel subscription in Portal with "cancel at period end" → return to `/app/billing` → should show amber Status Card with period end date.
5. **Trial-ending email:** Use Stripe test clock to advance to 3 days before trial end → check Vercel logs for email send confirmation.
6. **Payment-failed email:** Use Stripe Dashboard to trigger a failed payment on test subscription → check Vercel logs.

---

## PREREQ-C Checklist

**Dashboard path:** `https://dashboard.stripe.com/settings/billing/portal`
(For test mode: `https://dashboard.stripe.com/test/settings/billing/portal`)

**Checkboxes Andrew must verify/enable:**

1. **Payment methods** — enabled → "Customer can update their payment method"
2. **Invoice history** — enabled → "Customer can view invoice history"
3. **Cancel subscription** → mode = "At end of billing period" (cancel_at_period_end = true)
4. **Subscription updates / Plan switching** — enabled → select all 4 Price IDs:
   - Basic Monthly (`STRIPE_PRICE_ID_BASIC_MONTHLY`)
   - Basic Annual (`STRIPE_PRICE_ID_BASIC_ANNUAL`)
   - Widget Monthly (`STRIPE_PRICE_ID_WIDGET_MONTHLY`)
   - Widget Annual (`STRIPE_PRICE_ID_WIDGET_ANNUAL`)

**Programmatic verification (MEDIUM confidence — API supports it, CLI wrapper likely works):**

```bash
# List portal configurations — shows features.invoice_history.enabled, 
# features.payment_method_update.enabled, features.subscription_cancel.mode,
# features.subscription_update.enabled:
stripe billing_portal configurations list

# Retrieve specific config:
stripe billing_portal configurations retrieve bpc_XXXXXXXXXX
```

**Test mode vs. Live mode:** The portal configuration is separate per mode. Configure both if needed. Phase 44 development uses test mode; production uses live mode.

---

## Open Questions for Planner

### 1. `invoice.payment_failed` email — send on every retry vs. first failure only

**What we know:** The event fires on every retry attempt (Stripe confirmed). CONTEXT.md says route through `getSenderForAccount` but doesn't specify filtering.

**What's unclear:** Is it acceptable UX to email the owner 3-4 times over 3 weeks about the same payment failure? Or send only on first attempt?

**Recommendation:** Send on **every retry** (attempt 1, 2, 3, 4) but make the email copy intelligent: include `attempt_count` and whether `next_payment_attempt` is null (final failure → stronger language). This avoids adding a new DB column while still giving actionable information. The final-attempt email can say "This is our last attempt — update your payment method now or your account will be locked."

**If Andrew wants first-only:** add a `payment_failed_email_sent_at TIMESTAMPTZ` column (same pattern as `trial_warning_sent_at`) and guard on it.

### 2. Sender identity for billing emails

**What we know:** `getSenderForAccount` for Resend accounts uses `from: "bookings@nsintegrations.com"`. A payment failure email arriving from "bookings@nsintegrations.com" may be confusing to the owner.

**What's unclear:** Whether the owner expects billing emails from the same address as their booking confirmations, or from a dedicated billing address.

**Recommendation:** Keep LD-11 strict (use `getSenderForAccount`) for Phase 44. Note that for Resend accounts, billing emails will arrive from `bookings@nsintegrations.com` with `reply-to: owner@gmail.com`. This is acceptable for MVP. A `billing@nsintegrations.com` Resend sender could be added in a later phase if owners report confusion.

---

## Pitfalls

### Pitfall 1: Portal session URL is short-lived (~5 minutes)

**What goes wrong:** Owner opens billing page, leaves tab open, comes back 10 minutes later, clicks "Manage Subscription" — URL is expired, gets Stripe error page.

**How to avoid:** Generate a new portal session on **every button click** (via POST to `/api/stripe/portal`). Never cache the URL in component state, localStorage, or server-side cache. The `dynamic = 'force-dynamic'` on the route handler + `no-store` cache header prevents any CDN caching.

**Warning signs:** If the portal URL is ever stored in state with `useState` across re-renders, it may expire.

### Pitfall 2: `stripe_customer_id` is NULL for trialing users

**What goes wrong:** A trialing owner visits `/app/billing`, sees the "Manage Subscription" button rendered (bug), clicks it, portal API returns 400.

**How to avoid:** The Status Card active/cancel_scheduled variants are only rendered when `subscription_status === 'active'`. A trialing account with `stripe_customer_id = NULL` falls into `plan_selection` state (TierGrid) which has no Portal button. The API route also guards with a 400 if `stripe_customer_id` is NULL. Belt-and-suspenders.

### Pitfall 3: Race condition — webhook writes `cancel_at_period_end=true` while Portal is open

**What goes wrong:** Owner cancels in Portal (tab 1), webhook fires and writes `cancel_at_period_end=true`. Owner's billing page (tab 2) still shows "active" state.

**How to avoid:** This is not a bug — it resolves on next page load (server component re-fetches). No JS reactivity needed. The owner will see the amber Status Card on their next visit. Document in VERIFICATION.md that real-time UI update is not expected.

### Pitfall 4: `cancel_at_period_end` check order in state machine

**What goes wrong:** State machine checks `subscription_status === 'active'` first, renders the green active card even when `cancel_at_period_end = true`.

**How to avoid:** Check `cancel_at_period_end` BEFORE the generic active check (see state machine priority order above). The cancel_scheduled state must be the first branch inside the `active` status check.

### Pitfall 5: Webhook email send throws (it shouldn't, but)

**What goes wrong:** `getSenderForAccount` or `sender.send()` throws unexpectedly → webhook handler's `try` block catches it → dedupe row deleted → Stripe retries → email may send twice if the second attempt succeeds.

**How to avoid:** `getSenderForAccount` is documented as never-throw (every path returns a refused sender). `sender.send()` is also never-throw (`EmailResult` is always returned). However, wrap email send in its own try/catch in the webhook handler to be safe — catch, log, and continue (do NOT rethrow from email send failures).

### Pitfall 6: `flow_data.type = 'payment_method_update'` TypeScript type

**What goes wrong:** The Stripe SDK TypeScript types for `flow_data` may require literal string values for `type`. The union type from the SDK must be respected.

**How to avoid:**
```typescript
// Type-safe flow_data construction:
const flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined =
  usePaymentMethodFlow
    ? { type: 'payment_method_update' }
    : undefined;
// Then: ...(flowData ? { flow_data: flowData } : {})
```

### Pitfall 7: Migration tech debt — phases 36/37/41 not in `schema_migrations`

**What goes wrong:** Phase 44's `cancel_at_period_end` migration may fail if the Supabase migration tracker is out of sync with what's actually applied to the production DB.

**How to avoid:** Use `ADD COLUMN IF NOT EXISTS` (already included in the migration shape above). If the MCP `apply_migration` tool fails, run the SQL directly in the Supabase Dashboard SQL editor. The `IF NOT EXISTS` guard makes this safe to run even if something goes wrong and it gets applied twice.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection (verified 2026-05-11):
  - `app/api/stripe/webhook/route.ts`
  - `app/api/stripe/checkout/route.ts`
  - `app/(shell)/app/billing/page.tsx`
  - `app/(shell)/app/billing/_components/billing-state-views.tsx`
  - `app/(shell)/app/billing/_components/subscribe-tier-card.tsx`
  - `app/(shell)/app/_components/subscription-banner.tsx`
  - `app/(shell)/layout.tsx`
  - `lib/email-sender/account-sender.ts`
  - `lib/email/send-booking-confirmation.ts`
  - `lib/email/send-booking-emails.ts`
  - `lib/email/branding-blocks.ts`
  - `lib/email-sender/types.ts`
  - `lib/stripe/client.ts`
  - `lib/stripe/prices.ts`
  - `lib/stripe/widget-gate.ts`
  - `components/ui/card.tsx`
  - `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql`
  - `supabase/migrations/20260510130000_phase42_5_plan_tier.sql`
  - `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-CONTEXT.md`
  - `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-VERIFICATION.md`

- [Stripe Customer Portal Sessions Create](https://docs.stripe.com/api/customer_portal/sessions/create) — verified 2026-05-11
- [Stripe Portal Deep Links](https://docs.stripe.com/customer-management/portal-deep-links) — verified 2026-05-11
- [Stripe Configure Portal](https://docs.stripe.com/customer-management/configure-portal) — verified 2026-05-11
- [Stripe Invoice Object](https://docs.stripe.com/api/invoices/object) — `next_payment_attempt`, `hosted_invoice_url`, `amount_due`, `attempt_count` fields verified

### Secondary (MEDIUM confidence)
- [Stripe Subscriptions Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — `trial_will_end` timing (3 days before; immediate for short trials); `payment_failed` fires on every retry
- WebSearch corroboration: `invoice.payment_failed` fires on each retry attempt; `attempt_count` increments; `next_payment_attempt` is null on final failure

### Tertiary (LOW confidence — verify in production)
- Portal configuration verification via `stripe billing_portal configurations list` CLI — should work but not tested against this specific project's Stripe account
- `stripe webhook_endpoints retrieve we_1TVfOTJ7PLcBbY73Groz1G13` — endpoint ID from Phase 41 VERIFICATION.md; verify still accurate

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Stripe client already exists; no new dependencies
- Architecture: HIGH — mirrored from Phase 42 checkout (direct codebase inspection)
- Pitfalls: HIGH — most derived from existing codebase patterns and Stripe docs
- Email mechanics timing: HIGH — documented Stripe behavior verified across multiple sources
- Portal `flow_data` shape: HIGH — confirmed in Stripe API docs

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (30 days; Stripe API version pinned so changes unlikely)
