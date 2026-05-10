# Phase 42: Checkout Flow + Plan Selection Page - Research

**Researched:** 2026-05-10
**Domain:** Stripe Checkout Session creation, polling UX, Next.js App Router billing page
**Confidence:** HIGH (all findings verified against live codebase files + Stripe SDK type definitions in node_modules)

---

## Summary

Phase 42 builds the owner-facing `/app/billing` page, a Route Handler at `POST /api/stripe/checkout` to create Stripe Checkout Sessions, a GET status endpoint at `/api/stripe/checkout/status` for polling, and the return-URL polling state machine. Every decision here is grounded in the existing codebase patterns — no new dependencies are needed.

The app uses Next.js App Router 16.2.4 with server components for data fetching, `"use server"` actions for mutations, Route Handlers for HTTP-status-aware endpoints, `useRouter` from `next/navigation` for programmatic navigation, and plain `useEffect` + `setInterval` for timers (no SWR, no TanStack Query in the codebase). The Stripe SDK (`stripe@22.1.1`, `apiVersion: '2026-04-22.dahlia'`) is already installed and wired. All billing columns are live on `accounts`.

The critical architectural finding: the webhook handler (`/api/stripe/webhook`) looks up accounts by `stripe_customer_id` (`accounts.stripe_customer_id`). That column is NULL for all existing accounts. Phase 42 must write `stripe_customer_id` to `accounts` **before** redirecting to Stripe Checkout, so that subsequent subscription webhooks can resolve the account. The correct approach is to call `stripe.customers.create()` first, update `accounts.stripe_customer_id`, then pass `customer: cus_*` to `sessions.create()`. Alternatively, handle `checkout.session.completed` in the webhook using `client_reference_id` = `account.id` — this is the SC-5 gap closure path.

**Primary recommendation:** Pre-create the Stripe Customer before the Checkout Session. Write `stripe_customer_id` to the `accounts` row before returning the Checkout URL. This ensures subscription webhooks always resolve the account, even before the session completes. Use `client_reference_id: account.id` as belt-and-suspenders. Handle `checkout.session.completed` in the webhook to set `stripe_customer_id` if it is still NULL (handles the race where customer was created by Stripe but the pre-create write failed).

---

## Standard Stack

No new npm dependencies are needed. All required libraries are already installed.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 22.1.1 (exact pin) | `sessions.create()`, `customers.create()` | Already installed in Phase 41 |
| `@supabase/supabase-js` | ^2.103.1 | `createAdminClient()` for billing writes | Already installed |
| `next` | 16.2.4 | App Router Route Handlers + `useRouter` | Already installed |
| `lucide-react` | ^1.8.0 | Spinner (`Loader2`), check icons | Already installed |
| `sonner` | ^2.0.7 | Toast on error paths | Already installed |

### No new installs
Do NOT install `@stripe/stripe-js` or `@stripe/react-stripe-js`. LD-02 locks Hosted Checkout — no browser-side Stripe.js needed.

**Installation:**
```bash
# Nothing to install — all dependencies already present
```

### New environment variables required
| Variable | Purpose | Where to add |
|----------|---------|--------------|
| `STRIPE_PRICE_ID_MONTHLY` | Price ID for monthly plan | `.env.local` + Vercel |
| `STRIPE_PRICE_ID_ANNUAL` | Price ID for annual plan | `.env.local` + Vercel |
| `NEXT_PUBLIC_APP_URL` | Base URL for success/cancel redirect construction | Already exists in some envs — verify in Vercel |

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are already set (Phase 41).

**Placeholder values for development (before PREREQ-E finalizes):**
Wire prices as environment variables. Use Stripe test-mode placeholder Price IDs from PREREQ-B or hardcode a config object in `lib/stripe/prices.ts` with a `process.env` fallback. Pattern:

```typescript
// lib/stripe/prices.ts
export const PRICES = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "price_placeholder_monthly",
    amountCents: parseInt(process.env.STRIPE_PRICE_MONTHLY_CENTS ?? "2900", 10), // $29/mo placeholder
    label: "$29/month",
  },
  annual: {
    priceId: process.env.STRIPE_PRICE_ID_ANNUAL ?? "price_placeholder_annual",
    amountCents: parseInt(process.env.STRIPE_PRICE_ANNUAL_CENTS ?? "27840", 10), // $232/yr placeholder = ~$19.33/mo
    label: "$232/year",
    savingsPct: Math.round((1 - 27840 / (2900 * 12)) * 100), // "Save 20%" dynamically
  },
} as const;
```

This lets the planner swap real Price IDs and amounts via env vars without code changes.

---

## Architecture Patterns

### Recommended file layout

```
app/(shell)/app/billing/
├── page.tsx                         # NEW — Server Component: reads account row, derives page state
└── _components/
    ├── plan-selection-card.tsx      # NEW — "use client" — toggle + Subscribe button
    └── checkout-return-poller.tsx   # NEW — "use client" — polls status, transitions to active

app/api/stripe/
├── webhook/
│   └── route.ts                     # EXISTS — add checkout.session.completed handler
├── checkout/
│   └── route.ts                     # NEW — POST handler: create customer + session, return URL
└── checkout/status/
    └── route.ts                     # NEW — GET handler: return current subscription_status

lib/stripe/
├── client.ts                        # EXISTS (Phase 41)
└── prices.ts                        # NEW — centralized price/amount config
```

### Pattern 1: Shell route group (`(shell)`) — how owner pages work

Source: `app/(shell)/layout.tsx` (lines 13-65)

The `(shell)` layout:
1. Creates a Supabase server client via `createClient()` (NOT admin)
2. Calls `supabase.auth.getClaims()` — redirects to `/app/login` if no session
3. Fetches `accounts.select("id")` scoped by `owner_user_id` — redirects to `/app/unlinked` if no account
4. Wraps children in `SidebarProvider` + `AppSidebar` + `Header` inside `SidebarInset`

The billing page at `app/(shell)/app/billing/page.tsx` will be at URL `/app/billing` automatically.

**The billing page Server Component must:**
```typescript
// app/(shell)/app/billing/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const { data: account } = await supabase
    .from("accounts")
    .select("id, subscription_status, trial_ends_at, stripe_customer_id, plan_interval")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  const { session_id } = await searchParams;
  // ... derive pageState, render appropriate sub-component
}
```

Note: `searchParams` is async in Next.js 16 (must be `await`ed — same as `cookies()`). Source: existing pattern from Phase 2 research comment in `app/(shell)/layout.tsx` line 31.

### Pattern 2: Route Handler for "Create Checkout Session"

Source: `app/api/slots/route.ts` (GET) and `app/api/bookings/route.ts` (POST) for pattern reference.

Use a Route Handler (NOT a Server Action) for checkout session creation because:
- It needs to return a URL string with HTTP 200 cleanly
- Server Actions are idiomatic for form mutations that revalidate — this is a "get redirect URL" operation
- The client component calls it via `fetch()` then does `window.location.href = url` (similar to how `initiateGoogleOAuthAction` does server-side redirect, but here client-side redirect is better since we want the URL for the billing page to stay in view momentarily)

```typescript
// app/api/stripe/checkout/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1. Verify auth (RLS client)
  // 2. Fetch account (id, owner_email, stripe_customer_id)
  // 3. Upsert Stripe Customer (create if no stripe_customer_id, else reuse)
  // 4. Write stripe_customer_id to accounts (admin client)
  // 5. Create Checkout Session with customer, line_items, success_url, cancel_url
  // 6. Return { url: session.url }
}
```

### Pattern 3: Stripe Customer creation + account linkage (SC-5 gap)

This is the critical step that closes Phase 41's deferred SC-5.

**Step A — Determine if customer already exists:**
```typescript
const supabase = await createClient();
const { data: account } = await supabase
  .from("accounts")
  .select("id, owner_email, stripe_customer_id")
  .is("deleted_at", null)
  .maybeSingle();
```

**Step B — Create or reuse customer:**
```typescript
import { stripe } from "@/lib/stripe/client";

let customerId = account.stripe_customer_id;
if (!customerId) {
  const customer = await stripe.customers.create({
    email: account.owner_email,
    metadata: { account_id: account.id },
  });
  customerId = customer.id;
  // Write to accounts immediately
  const admin = createAdminClient();
  await admin
    .from("accounts")
    .update({ stripe_customer_id: customerId })
    .eq("id", account.id);
}
```

**Step C — Create Checkout Session:**
```typescript
const { body } = await req.json(); // { interval: 'monthly' | 'annual' }
const priceId = interval === 'annual'
  ? process.env.STRIPE_PRICE_ID_ANNUAL!
  : process.env.STRIPE_PRICE_ID_MONTHLY!;

const origin = process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: customerId,
  client_reference_id: account.id, // belt-and-suspenders for webhook reconciliation
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${origin}/app/billing`,
  // No trial_end — trial is app-side only (subscription charges immediately)
});

return NextResponse.json({ url: session.url });
```

**Source:** Stripe SDK type `Checkout.SessionCreateParams` (node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts lines 2072-2308). In `subscription` mode, Stripe always creates a Customer if one isn't passed; by passing `customer: customerId` we reuse the existing one. `client_reference_id` is a string field on the session that survives to the `checkout.session.completed` webhook event.

### Pattern 4: Webhook — add `checkout.session.completed` handler

The existing webhook at `app/api/stripe/webhook/route.ts` does NOT handle `checkout.session.completed`. Add it to the switch:

```typescript
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const accountId = session.client_reference_id;
  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;

  if (accountId && stripeCustomerId) {
    // Idempotent: only write if stripe_customer_id is still null
    await admin
      .from("accounts")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", accountId)
      .is("stripe_customer_id", null); // only if not already set
  }
  break;
}
```

This is the SC-5 closure. It handles the race: if `stripe_customer_id` was already written by the checkout route, this is a no-op (the `.is("stripe_customer_id", null)` guard). If the DB write in step B failed but Stripe completed, this corrects it.

### Pattern 5: Polling Route Handler

```typescript
// app/api/stripe/checkout/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_status")
    .is("deleted_at", null)
    .maybeSingle();

  return NextResponse.json(
    { subscription_status: account?.subscription_status ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
```

The client component polls this endpoint every 2s for up to 30s (per BILL-11).

### Pattern 6: Client-side polling state machine

Source: `app/(auth)/app/login/magic-link-success.tsx` for the `setInterval` + `clearInterval` cleanup pattern.

```typescript
// app/(shell)/app/billing/_components/checkout-return-poller.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PollState = "polling" | "active" | "timeout";

export function CheckoutReturnPoller({ sessionId }: { sessionId: string }) {
  const [pollState, setPollState] = useState<PollState>("polling");
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const POLL_INTERVAL_MS = 2000;
    const TIMEOUT_MS = 30_000;

    async function poll() {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        clearInterval(intervalRef.current!);
        setPollState("timeout");
        return;
      }

      const res = await fetch("/api/stripe/checkout/status", {
        cache: "no-store",
      });
      if (!res.ok) return; // transient error — keep polling

      const { subscription_status } = await res.json();
      if (subscription_status === "active") {
        clearInterval(intervalRef.current!);
        setPollState("active");
        // Auto-redirect after ~2s
        setTimeout(() => router.push("/app"), 2000);
      }
    }

    // Poll immediately on mount (handles "webhook already fired before mount" case)
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current!);
  }, [router, sessionId]);

  if (pollState === "active") {
    return <p>You&apos;re all set! Redirecting...</p>;
  }
  if (pollState === "timeout") {
    return (
      <div>
        <p>Your payment went through — we&apos;re still confirming your subscription.</p>
        <button onClick={() => window.location.reload()}>Refresh</button>
      </div>
    );
  }
  // polling state — spinner
  return <p>Confirming your subscription...</p>;
}
```

**Key design decisions verified:**
- Poll immediately on mount (`poll()` before `setInterval`) — handles the fast-webhook case where `subscription_status` is already `active` when the return URL loads
- `sessionId` prop is passed to give useEffect a dep to avoid lint warnings (not actually used in the fetch — the status endpoint uses the auth session)
- `router.push("/app")` matches the established pattern (`useRouter` + `router.push`/`router.replace` in `google-link-toast.tsx`, `cancel-button.tsx`, etc.)
- `window.location.reload()` is acceptable for the timeout fallback refresh CTA (simpler than router.push for a full re-init)

### Pattern 7: Page state derivation

Given the `accounts` row, derive which UI to render:

```typescript
type BillingPageState =
  | { type: "polling"; sessionId: string }    // ?session_id= in URL
  | { type: "active" }                        // subscription_status = 'active'
  | { type: "plan_selection"; trialDaysLeft: number | null }  // trialing
  | { type: "locked" }                        // canceled / unpaid / incomplete / incomplete_expired

function deriveBillingState(
  account: { subscription_status: string; trial_ends_at: string | null },
  sessionId: string | undefined,
): BillingPageState {
  if (sessionId) return { type: "polling", sessionId };
  if (account.subscription_status === "active") return { type: "active" };
  if (account.subscription_status === "trialing") {
    const daysLeft = account.trial_ends_at
      ? Math.ceil((new Date(account.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    return { type: "plan_selection", trialDaysLeft: daysLeft };
  }
  // past_due shows plan card too — owner can re-subscribe
  if (account.subscription_status === "past_due") {
    return { type: "plan_selection", trialDaysLeft: null };
  }
  return { type: "locked" };
}
```

**Note on `past_due`:** Phase 43 handles `past_due` banners. Phase 42 should render the plan card for `past_due` so the owner has a path to re-subscribe (though the webhook-driven dunning retry is the primary recovery mechanism). The locked state is for `canceled`, `unpaid`, `incomplete`, and `incomplete_expired`.

### Anti-Patterns to Avoid

- **Server Action for checkout session creation:** Server Actions cannot cleanly return arbitrary URLs to client components — they redirect or return structured data, but the pattern `startTransition(async () => { const url = await action(); window.location.href = url; })` works fine. However, a Route Handler is cleaner here since this is purely "give me a URL" — no form state, no revalidatePath needed.
- **Optimistic update of `subscription_status`:** LD-10 lock — never write `subscription_status = 'active'` in the checkout route. Only the webhook is canonical.
- **Polling `subscription_status` from the client Supabase SDK directly:** Use a Route Handler endpoint (`/api/stripe/checkout/status`) rather than the Supabase client in the browser. The billing columns require RLS — the server-side approach is simpler and avoids exposing Supabase service role key client-side.
- **Redirect from Server Action for checkout:** The auth actions use `redirect()` from `next/navigation`, but that's for full page navigation. Here the client needs to land on `stripe.com` — using `window.location.href` from the client after receiving the session URL is the correct approach (same as what Google OAuth flow does, but inverted — there `initiateGoogleOAuthAction` does the redirect server-side; here the URL needs to go to a third-party domain from a client click).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment form with card inputs | Custom card field + Stripe.js Elements | Stripe Hosted Checkout | LD-02 lock; PCI compliance complexity |
| Customer ID storage | Rolling your own metadata system | `accounts.stripe_customer_id` column (Phase 41 migration already added it) | Column exists, RLS-scoped, webhook-readable |
| Polling state UI | Building a generic state machine library | Plain `useEffect` + `setInterval` (codebase pattern) | Already used in `magic-link-success.tsx`; no library needed for 30s single-use polling |
| Savings percentage calculation | Hard-coding "20%" | `Math.round((1 - annualCents / (monthlyCents * 12)) * 100)` computed from env-var amounts | Must be computed from actual PREREQ-E prices |
| Toggle between monthly/annual | Custom segmented control | shadcn `<Tabs>` (already installed at `components/ui/tabs.tsx`) | Fully accessible Radix primitive, existing in codebase |
| "Save X%" badge | Custom badge component | shadcn `<Badge>` (already at `components/ui/badge.tsx`) | Radix primitive, existing, supports `variant="default"` (primary color = blue) |
| Spinner during polling | Custom spinner | `<Loader2 className="animate-spin">` from lucide-react | Used throughout app (e.g., `magic-link-success.tsx`) |

---

## Common Pitfalls

### Pitfall 1: Webhook account lookup fails if `stripe_customer_id` is not written first

**What goes wrong:** Checkout completes → `customer.subscription.created` fires → webhook looks up `accounts` by `stripe_customer_id` → finds NULL → throws "account_not_found" → 500 → Stripe retries but same result until `stripe_customer_id` is written.

**Why it happens:** Phase 41's webhook handler ONLY looks up by `stripe_customer_id`. No fallback to `client_reference_id`. The column is NULL on all existing accounts.

**How to avoid:** Write `stripe_customer_id` to `accounts` before creating the Checkout Session (Pattern 3). Also add `checkout.session.completed` handler in the webhook as a safety net (Pattern 4).

**Warning signs:** Webhook returns 500; `stripe_webhook_events` has no row (dedupe-row rollback deletes it on error).

### Pitfall 2: `stripe_customer_id` write race

**What goes wrong:** Two concurrent "Subscribe" clicks → two calls to `stripe.customers.create()` → two `cus_*` IDs → second write to `accounts.stripe_customer_id` wins → first `cus_*` is orphaned.

**Why it happens:** No lock between the read ("is stripe_customer_id null?") and the write.

**How to avoid:** Use a Postgres upsert with `onConflict` OR do a conditional update: `UPDATE accounts SET stripe_customer_id = $1 WHERE id = $2 AND stripe_customer_id IS NULL`. If 0 rows updated, read the existing `stripe_customer_id` and use it. Alternatively, the `UNIQUE` constraint on `stripe_customer_id` prevents two rows from having the same value, but does not prevent two different `cus_*` IDs being written sequentially. The correct guard is the `.is("stripe_customer_id", null)` conditional update.

**Warning signs:** Two Stripe Customer objects for the same account in the Stripe Dashboard.

### Pitfall 3: `session.url` is null for hosted Checkout

**What goes wrong:** `session.url` is null → `window.location.href = null` → navigation to `"null"` string.

**Why it happens:** `session.url` is `string | null` in the Stripe SDK types. It is only non-null when `ui_mode` is `hosted` (the default). If `ui_mode` is accidentally set to `embedded`, `url` is null.

**How to avoid:** Validate `session.url` in the Route Handler before returning it. Return 500 if null.

**Warning signs:** Client navigates to `"null"` or throws. Guard: `if (!session.url) return NextResponse.json({ error: "no_session_url" }, { status: 500 });`.

### Pitfall 4: Polling sees stale `subscription_status` due to Next.js caching

**What goes wrong:** First poll returns `trialing` even after webhook writes `active`. Subsequent polls also return cached `trialing`. Poller times out at 30s.

**Why it happens:** Next.js App Router caches GET Route Handlers by default (though `force-dynamic` disables this). Without `Cache-Control: no-store`, the status endpoint can be cached.

**How to avoid:** Add `export const dynamic = "force-dynamic"` AND `{ headers: { "Cache-Control": "no-store" } }` on every response from the status endpoint. Client-side `fetch` should also use `{ cache: "no-store" }`.

**Warning signs:** Poller always times out; checking DB manually shows `active` while UI shows "still confirming."

### Pitfall 5: `searchParams` must be awaited in Next.js 16

**What goes wrong:** `const { session_id } = searchParams` throws "searchParams must be awaited."

**Why it happens:** Next.js 16 made `searchParams` async (same as `cookies()`). This is documented in Phase 2's layout comment: `// Next 16 cookies() is async — await is required (RESEARCH §7.8).`

**How to avoid:**
```typescript
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
```

### Pitfall 6: Polling fires on every render if useEffect deps are wrong

**What goes wrong:** Every re-render triggers a new `setInterval`, creating multiple concurrent poll loops. Memory leak.

**Why it happens:** Missing or incorrect deps array in `useEffect`.

**How to avoid:** Use `useRef` for the interval ID and the start timestamp. The `useEffect` that starts the interval should only run once (or when `sessionId` changes). Return a cleanup function that clears the interval.

### Pitfall 7: Fast webhook — first poll sees `active` immediately

This is NOT an error but must be handled. The client mounts the poller after Stripe redirects back to the `success_url`. If the webhook fires during the Stripe Checkout flow (before the user is redirected back), the first poll will see `active` immediately.

**How to handle:** Call `poll()` synchronously before `setInterval` starts (Pattern 6). The immediate poll catches the fast case; the interval handles the slow case.

### Pitfall 8: `plan_interval` written by webhook, not by checkout route

**What goes wrong:** Checkout route writes `plan_interval = 'monthly'` or `plan_interval = 'annual'` directly. But the DB CHECK constraint accepts `'month'` and `'year'` (from Stripe payload) AND `'monthly'` / `'annual'`.

**Why it happens:** Phase 42 CONTEXT lock: "Phase 42 writes whatever Stripe returns via webhook — does not write `monthly`/`annual` directly from checkout-return code."

**How to avoid:** The checkout Route Handler does NOT write `plan_interval`. Only the webhook writes it, and it writes `sub.items.data[0]?.price.recurring?.interval ?? null` which will be `'month'` or `'year'` from the Stripe payload.

### Pitfall 9: Trial alignment — do not pass `trial_end` to Stripe

**What goes wrong:** Checkout creates a Stripe subscription with `subscription_data.trial_end = account.trial_ends_at`. Stripe charges the customer at the trial-end date, but the owner has already been using the app in trial mode.

**Why it happens:** Confusion between app-side trial tracking and Stripe-side trial.

**How to avoid:** Do NOT pass `subscription_data.trial_end` or any trial configuration to Stripe Checkout. The trial is tracked purely in `accounts.trial_ends_at` and `accounts.subscription_status = 'trialing'`. When the owner subscribes, Stripe charges immediately (no Stripe-side free trial). The `subscription_status` flips from `trialing` to `active` via webhook.

**Verified:** The Phase 41 migration sets `subscription_status = 'trialing'` at signup; the webhook flips it to `active` on `invoice.payment_succeeded`. There is no Stripe-side trial configuration in any existing code.

---

## Code Examples

### Full Checkout Route Handler skeleton

```typescript
// Source: codebase pattern from app/api/bookings/route.ts + Stripe SDK types
import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  // 2. Parse body
  const body = await req.json().catch(() => ({}));
  const interval = body?.interval === "annual" ? "annual" : "monthly";
  const priceId = interval === "annual"
    ? process.env.STRIPE_PRICE_ID_ANNUAL!
    : process.env.STRIPE_PRICE_ID_MONTHLY!;

  // 3. Load account
  const { data: account } = await supabase
    .from("accounts")
    .select("id, owner_email, stripe_customer_id")
    .is("deleted_at", null)
    .maybeSingle();
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404, headers: NO_STORE });
  }

  // 4. Upsert Stripe Customer
  let customerId = account.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account.owner_email ?? undefined,
      metadata: { account_id: account.id },
    });
    customerId = customer.id;
    // Conditional update — guard against race (only write if still null)
    const admin = createAdminClient();
    const { error: writeErr } = await admin
      .from("accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", account.id)
      .is("stripe_customer_id", null);
    if (writeErr) {
      // Race lost — re-fetch the winner's customer ID
      const { data: refetched } = await admin
        .from("accounts")
        .select("stripe_customer_id")
        .eq("id", account.id)
        .maybeSingle();
      customerId = refetched?.stripe_customer_id ?? customerId;
    }
  }

  // 5. Build origin for URLs
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  // 6. Create Checkout Session
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: account.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/billing`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "no_session_url" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ url: session.url }, { headers: NO_STORE });
}
```

### Plan Selection Card (client component pattern)

```typescript
// Source: tabs.tsx pattern + button.tsx pattern from existing UI components
"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type Interval = "monthly" | "annual";

interface PlanSelectionCardProps {
  monthlyLabel: string;        // "$29/month"
  annualLabel: string;         // "$232/year"
  annualMonthlyRate: string;   // "$19.33/month"
  savingsPct: number;          // 20
}

export function PlanSelectionCard({
  monthlyLabel,
  annualLabel,
  annualMonthlyRate,
  savingsPct,
}: PlanSelectionCardProps) {
  const [interval, setInterval] = useState<Interval>("annual"); // annual pre-selected
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError("Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.url; // redirect to stripe.com
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={interval} onValueChange={(v) => setInterval(v as Interval)}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">
              Annual
              <Badge variant="default" className="ml-2">Save {savingsPct}%</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div>
          {interval === "annual" ? (
            <>
              <p className="text-2xl font-bold">{annualMonthlyRate}</p>
              <p className="text-sm text-muted-foreground">{annualLabel} billed annually</p>
            </>
          ) : (
            <p className="text-2xl font-bold">{monthlyLabel}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSubscribe}
          disabled={isPending}
          size="lg"
          className="w-full"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Redirecting..." : "Subscribe"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Cancel anytime. Secure checkout via Stripe.
        </p>
      </CardContent>
    </Card>
  );
}
```

### NSI brand/tone reference

Source: `app/(shell)/app/page.tsx` (dashboard copy), `app/(shell)/app/settings/profile/page.tsx`, `app/(shell)/app/settings/upgrade/page.tsx`

Tone anchors from existing copy:
- Straightforward and practical: "Your bookings at a glance." / "Manage your account identity..."
- Non-alarming on error: "Something went wrong. Please try again." (not "Error!")
- Reassuring in wait states: "Andrew will be in touch within 1 business day."
- Locked-state tonal anchor from CONTEXT: "Everything is waiting for you! Head over to payments to get set up."
- Feature framing: action-oriented, no fluff

Recommended billing page copy:
- `trialing` headline: "Upgrade to keep the momentum going." + countdown: "{N} days left in your trial"
- `locked` headline: "Everything is waiting for you." + subtext: "Head over to payments to get set up."
- polling state: "Confirming your subscription..." (single line, no alarm)
- success state: "You're all set!" + auto-redirect notice
- timeout fallback: "Your payment went through — we're still confirming in the background. Refresh to check your status, or wait a moment and we'll catch up."
- cancel return: No copy needed — just land on the plan-selection card silently (non-judgmental per CONTEXT)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `@stripe/stripe-js` + Elements (in-page payment form) | Stripe Hosted Checkout (`mode: "subscription"`, redirect to `checkout.stripe.com`) | LD-02 lock; no PCI burden |
| `invoice.subscription` on Invoice object | `invoice.parent?.subscription_details?.subscription` (Stripe API 2026-04-22.dahlia) | Already handled in Phase 41 webhook |
| `subscription.current_period_end` | `sub.items.data[0]?.current_period_end` (2026-04-22.dahlia) | Already handled in Phase 41 webhook |

**Deprecated/outdated:**
- `customer_creation: 'always'` on Checkout Sessions in `subscription` mode: This parameter is only valid in `payment` mode (SDK type confirms: "Can only be set in `payment` and `setup` mode"). In `subscription` mode, Stripe always creates a Customer — passing `customer_creation` would be ignored or error. Pre-create the customer explicitly instead.

---

## Open Questions

1. **PREREQ-E pricing (amounts) — pending**
   - What we know: `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` are the env vars (from ROADMAP PREREQ-D). The `lib/stripe/prices.ts` config file must read both the price IDs AND the corresponding amounts (in cents) so the UI can display "$X/month" and compute "Save X%".
   - What's unclear: Whether the price amounts will be fetched from Stripe API at page-load time or hardcoded in env vars. Fetching from Stripe (`stripe.prices.retrieve(priceId)`) would be authoritative but adds ~200ms latency on every billing page load.
   - Recommendation: Store amounts as env vars (`STRIPE_PRICE_MONTHLY_CENTS`, `STRIPE_PRICE_ANNUAL_CENTS`) alongside the Price IDs. No Stripe API call at page-load time. The billing page is a server component — read the env vars at build/render time.

2. **`plan_price_id` column referenced in additional_context but absent from migration**
   - What we know: The additional_context mentions `plan_price_id` in the `accounts` billing columns list. However, the Phase 41 migration (`20260510120000_phase41_stripe_billing_foundation.sql`) does NOT add a `plan_price_id` column. The column does not exist in the schema.
   - What's unclear: Whether this column was intentionally dropped from scope or was an oversight.
   - Recommendation: Do not add `plan_price_id` in Phase 42 without confirming with the roadmap. The webhook already captures `plan_interval` from `sub.items.data[0]?.price.recurring?.interval`. The price ID is not needed for billing logic (interval + status are sufficient). Flag for verification.

3. **Stripe Stripe CLI / test mode webhook for Phase 42 verification**
   - What we know: Phase 41 registered the webhook endpoint in the Stripe Dashboard (`we_1TVfOTJ7PLcBbY73Groz1G13`). The CLI workaround for webhook creation was noted.
   - What's unclear: Whether the `checkout.session.completed` event was added to the registered events in the Stripe Dashboard when Phase 41 registered the webhook (only 6 events are listed in Phase 41 VERIFICATION.md). This event needs to be enabled.
   - Recommendation: During Phase 42 verification, confirm that `checkout.session.completed` is enabled on the Stripe Dashboard webhook endpoint. If not, add it manually.

---

## Sources

### Primary (HIGH confidence)
- `app/api/stripe/webhook/route.ts` — full webhook handler, lookup patterns, Dahlia field paths
- `app/(shell)/layout.tsx` — shell auth pattern, account query pattern
- `app/(shell)/app/page.tsx` — dashboard Server Component data-fetching pattern
- `lib/stripe/client.ts` — Stripe singleton pattern
- `lib/supabase/server.ts` / `lib/supabase/admin.ts` — client creation patterns
- `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` — live schema (7 columns, plan_interval CHECK)
- `node_modules/stripe/cjs/resources/Checkout/Sessions.d.ts` — Stripe SDK type definitions for `SessionCreateParams`, `customer`, `client_reference_id`, `mode`, `success_url`, `cancel_url`, `line_items`
- `components/ui/card.tsx`, `tabs.tsx`, `badge.tsx`, `button.tsx` — existing UI component APIs
- `app/globals.css` — NSI brand tokens (primary: #3B82F6, accent: #F97316)
- `app/(auth)/app/login/magic-link-success.tsx` — `setInterval` + `clearInterval` cleanup pattern
- `app/(shell)/app/_components/google-link-toast.tsx` — `useRouter` + `router.replace` pattern
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-VERIFICATION.md` — SC-5 deferred scope
- `.planning/REQUIREMENTS.md` lines 44-46 — BILL-09, BILL-10, BILL-11 requirements

### Secondary (MEDIUM confidence)
- `app/(shell)/app/settings/upgrade/_lib/actions.ts` + `_components/upgrade-form.tsx` — `startTransition` + async action + error display pattern
- `app/(shell)/app/bookings/[id]/_components/cancel-button.tsx` — `useTransition` + `router.refresh()` pattern
- `app/api/bookings/route.ts` — rationale for Route Handler vs Server Action (HTTP status flexibility)
- `.env.local` (NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_VERCEL_URL fallback pattern, confirmed in bookings action line 85-88)
- Stripe docs (WebFetch): `stripe.checkout.sessions.create()` with `mode: 'subscription'`, `customer`, `line_items`, `success_url`

### Tertiary (LOW confidence)
- Stripe docs on `customer_creation` behavior in subscription mode — inferred from SDK type comment at line 2122: "Can only be set in `payment` and `setup` mode" — this means `customer_creation` is NOT valid in subscription mode.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json + existing imports
- App architecture: HIGH — read directly from layout.tsx + existing pages
- Stripe Checkout Session API: HIGH — read from installed SDK types in node_modules
- Polling pattern: HIGH — derived from existing `setInterval` pattern in magic-link-success.tsx
- SC-5 linkage strategy: HIGH — derived from Phase 41 RESEARCH.md + verification report + webhook handler source
- Pricing/env var strategy: MEDIUM — env var names from ROADMAP.md + amounts from PREREQ-E (pending)
- `plan_price_id` column: LOW — column mentioned in additional_context but absent from migration; flagged as open question

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (Stripe SDK pinned; stable patterns)
