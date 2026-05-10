# Architecture Research — v1.8 Stripe Paywall + Login UX Polish

**Domain:** Multi-tenant SaaS booking tool — Stripe subscription enforcement layer
**Researched:** 2026-05-09
**Confidence:** HIGH (grounded against live codebase; Stripe-specific patterns HIGH via docs and established App Router conventions)

---

## System Overview (post-v1.8)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Browser                                                              │
│  ┌──────────────────┐   ┌─────────────────┐   ┌────────────────────┐ │
│  │  /[account]/*    │   │  /app/*          │   │  /app/billing/*    │ │
│  │  Public booker   │   │  Owner dashboard │   │  Always accessible │ │
│  │  NEVER paywalled │   │  Paywalled when  │   │  even when locked  │ │
│  │  (LD-07)         │   │  locked          │   │                    │ │
│  └────────┬─────────┘   └────────┬────────┘   └─────────┬──────────┘ │
└───────────┼──────────────────────┼──────────────────────┼────────────┘
            │                      │                       │
┌───────────▼──────────────────────▼───────────────────────▼────────────┐
│  proxy.ts (middleware — runs on every non-static request)             │
│  1. Supabase session refresh (updateSession)                          │
│  2. Auth gate: unauthenticated → /app/login                           │
│  3. NEW v1.8: Subscription gate: locked + not /app/billing/* → lock  │
│     page. Public /[account]/* paths SKIP this gate entirely.          │
└───────────────────────────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────────────┐
│  Supabase Postgres                                                    │
│  accounts table (subscription columns — Stripe cache)                │
│  stripe_webhook_events table (idempotency log)                        │
└───────────────────────────────────────────────────────────────────────┘
            │                              ▲
            │                              │ webhook (async, <5s typical)
            ▼                              │
┌───────────────────────────────┐  ┌───────────────────────────────────┐
│  Stripe Hosted Checkout       │  │  app/api/stripe/webhook/route.ts   │
│  Stripe Customer Portal       │  │  (raw body, sig verify, idempotent)│
└───────────────────────────────┘  └───────────────────────────────────┘
```

---

## 1. Schema Additions

### 1a. New columns on `accounts`

```sql
-- Migration: supabase/migrations/20260509_v18_stripe_accounts.sql

ALTER TABLE accounts
  ADD COLUMN stripe_customer_id        TEXT        UNIQUE,
  ADD COLUMN stripe_subscription_id    TEXT        UNIQUE,
  ADD COLUMN subscription_status       TEXT        NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing',     -- within 14-day trial window
      'active',       -- paid and current
      'past_due',     -- invoice payment failed; grace period (Stripe retries)
      'canceled',     -- explicitly canceled; access revoked
      'locked'        -- trial expired without subscribing
    )),
  ADD COLUMN trial_ends_at             TIMESTAMPTZ,
  ADD COLUMN current_period_end        TIMESTAMPTZ,
  ADD COLUMN plan_interval             TEXT
    CHECK (plan_interval IN ('month', 'year', NULL));
```

**Column semantics and nullability:**

| Column | NULL semantics | Constraint | Notes |
|--------|----------------|------------|-------|
| `stripe_customer_id` | NULL until first Checkout Session is created | UNIQUE (NULLs are distinct in Postgres — multiple NULL rows are allowed) | Set in `checkout/route.ts` before redirecting; confirmed via `customer.subscription.created` webhook |
| `stripe_subscription_id` | NULL until subscription is active | UNIQUE | Set by `customer.subscription.created` webhook |
| `subscription_status` | Never NULL | DEFAULT `'trialing'` | Middleware reads this column — it must always have a value |
| `trial_ends_at` | NULL for pre-v1.8 accounts until backfill | No constraint | See section 6 for backfill strategy |
| `current_period_end` | NULL until first subscription | No constraint | Set by webhook on each `invoice.payment_succeeded` |
| `plan_interval` | NULL until subscription created | CHECK allows NULL | `'month'` or `'year'` from Price metadata |

**Why NOT a separate `subscriptions` table at this stage:**
A single plan with two price IDs (monthly/annual toggle) does not benefit from a subscription history table. The full audit trail lives in Stripe. The `accounts` columns are a read cache. Adding a `subscriptions` table would introduce a join on every middleware subscription-status check. Defer until multi-plan or subscription history UI is needed (v1.9+).

**Why `'locked'` is a distinct status from `'canceled'`:**
`'locked'` = trial expired without ever subscribing (Andrew's product decision — "everything is waiting for you"). `'canceled'` = was a paying customer, explicitly canceled. These have different unlock copy and different re-engagement flows. Do not collapse them.

**RLS:** Existing `accounts` RLS policies (owners read/update their own row) already cover new columns — no new policies needed. The subscription-status write path goes through the admin client in the webhook handler, identical to the Phase 36 provider-flip pattern.

### 1b. New table: `stripe_webhook_events`

```sql
-- Migration: supabase/migrations/20260509_v18_stripe_webhook_events.sql
-- Separate migration file so it can be applied and verified before
-- the webhook handler goes live.

CREATE TABLE public.stripe_webhook_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT        NOT NULL UNIQUE,   -- e.g. "evt_1ABC..."
  event_type      TEXT        NOT NULL,           -- e.g. "customer.subscription.created"
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  account_id      UUID        REFERENCES accounts(id) ON DELETE SET NULL,
  payload_summary JSONB,                          -- slim digest for debugging; NOT full payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX stripe_webhook_events_stripe_event_id_idx
  ON public.stripe_webhook_events (stripe_event_id);

-- No RLS needed — only the service-role admin client writes here.
-- No authenticated read policy — webhook events are internal infrastructure.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- (RLS enabled but zero policies = no user can read or write via anon/authenticated)
```

**Why a dedicated events table over checking `accounts.stripe_subscription_id` for idempotency:**
Stripe retries failed webhooks with exponential backoff for up to 3 days. The same event can arrive 2-6 times. Checking "did we already apply this `event.id`?" is the only safe idempotency strategy — the accounts-column approach would incorrectly re-apply status transitions on retry. The `stripe_event_id` UNIQUE constraint makes the duplicate check a single `INSERT ... ON CONFLICT DO NOTHING` — if 0 rows inserted, skip processing. Cost: one extra table. Benefit: correct behavior under Stripe retry.

**`payload_summary` JSONB rationale:** Store a slim digest (e.g., `{customer_id, subscription_id, status, period_end}`) for debugging, not the full Stripe event. Full events contain PII (billing email) and are already retrievable from the Stripe dashboard. Never store full Stripe payloads in your own DB.

### 1c. Migration ordering

**Phase A (ship first — unblocks all subsequent phases):**
```
supabase/migrations/20260509_v18_stripe_accounts.sql
supabase/migrations/20260509_v18_stripe_webhook_events.sql
```

These ship together but must land before any webhook handler or paywall enforcement. The subscription_status DEFAULT `'trialing'` means all existing accounts get `'trialing'` at migration apply time — they will NOT be locked out when the paywall middleware turns on in Phase C.

**Trial backfill (in the same migration or a separate follow-up):**

Existing accounts (pre-v1.8) should have `trial_ends_at` set at migration time to give them a grace window. Recommended approach:

```sql
-- Backfill: existing accounts get a 14-day trial from NOW() at deploy time,
-- NOT from their original created_at (which could be months ago).
-- This prevents immediately locking out every pre-v1.8 account on deploy.
UPDATE accounts
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL
  AND deleted_at IS NULL;
```

This is a safe approach: the status column already DEFAULT `'trialing'`, so they see normal app behavior. When the paywall enforcement layer turns on in Phase C, the middleware reads `trial_ends_at` to decide if trial is still valid. Pre-v1.8 accounts get 14 days from deploy to convert — that is the product intent.

**New account signups (post-v1.8):** The `provision_account_for_new_user` Postgres trigger (currently creates the accounts stub on `auth.users` INSERT) should be updated to also set `trial_ends_at = NOW() + INTERVAL '14 days'` and `subscription_status = 'trialing'`. This is a trigger-level change, not just a migration column addition — it ensures new signups never land with a NULL trial_ends_at.

---

## 2. Webhook Handler Architecture

**File location:** `app/api/stripe/webhook/route.ts`

This matches the existing `app/api/` convention (bookings, cancel, cron routes all live here). Route handlers, not Server Actions — identical rationale to the bookings endpoint: need arbitrary HTTP status codes and raw body access.

### App Router raw-body gotcha

The App Router parses the request body automatically when you call `await request.json()`. Stripe signature verification requires the **raw, unparsed bytes** — if you parse first, the signature will always fail.

**Correct pattern for App Router (not Pages Router):**

```typescript
// app/api/stripe/webhook/route.ts
import { headers } from "next/headers";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Read raw bytes — do NOT call request.json() first.
  const body = await request.text(); // or request.arrayBuffer() → Buffer
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) return new Response("Missing stripe-signature header", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  // Idempotency check: INSERT ... ON CONFLICT DO NOTHING
  const { count } = await admin
    .from("stripe_webhook_events")
    .insert({ stripe_event_id: event.id, event_type: event.type, ... }, 
             { count: "exact" })
    .onConflict("stripe_event_id")
    .ignore(); // Supabase: upsert with ignoreDuplicates

  if (count === 0) {
    // Already processed — return 200 immediately so Stripe stops retrying.
    return new Response("Already processed", { status: 200 });
  }

  // Route to handler by event type
  await routeStripeEvent(event);

  return new Response("OK", { status: 200 });
}
```

**Critical:** The `export const dynamic = "force-dynamic"` directive prevents Next.js from accidentally caching or statically rendering this route.

**The Pages Router pattern (`req.body` + `bodyParser: false`) does NOT work in App Router.** App Router does not expose `req` — it exposes a `Request` object. Use `await request.text()` before any JSON parsing.

### Idempotency strategy

1. Attempt `INSERT` into `stripe_webhook_events` with `stripe_event_id` as the unique key.
2. If 0 rows were inserted (conflict), the event was already processed — return `200 OK` immediately. Stripe stops retrying on `2xx`.
3. If 1 row inserted, proceed with state mutation.

This is correct under all retry scenarios, including:
- Stripe retrying because your handler returned `5xx` (DB was down mid-processing): the event may have partially processed. The `INSERT` idempotency only tells you "did we start processing" — for full safety, make the state mutations themselves idempotent (setting `subscription_status = 'active'` on an already-active account is a no-op).
- Stripe retrying because your handler timed out: same as above.

Do NOT use `event.created` timestamp for idempotency — Stripe can deliver events out of order. Event ID is the only stable idempotency key.

### Event routing

Handle these events, in this priority order:

| Event | Action on `accounts` |
|-------|----------------------|
| `customer.subscription.created` | Set `stripe_subscription_id`, `subscription_status = 'active'` (or `'trialing'` if Stripe trial), `current_period_end`, `plan_interval` |
| `customer.subscription.updated` | Update `subscription_status`, `current_period_end`, `plan_interval` |
| `customer.subscription.deleted` | Set `subscription_status = 'canceled'` |
| `invoice.payment_succeeded` | Set `subscription_status = 'active'`, `current_period_end` |
| `invoice.payment_failed` | Set `subscription_status = 'past_due'` |
| `customer.subscription.trial_will_end` | Trigger "trial ending in 3 days" email via `getSenderForAccount` |

**What happens when a webhook handler returns `5xx`:** Stripe retries with exponential backoff: 5m, 30m, 2h, 5h, 10h, etc., for up to 3 days. The idempotency check ensures replayed events are safe. The handler should never block on slow operations — do the DB write, return 200, fire emails async if needed.

---

## 3. Checkout Session Architecture

**File:** `app/api/stripe/checkout/route.ts` — Route Handler, not a Server Action.

**Why Route Handler not Server Action:** Server Actions redirect (throw NEXT_REDIRECT) or return data. A Checkout session creation needs to return a redirect URL for a client component to navigate to. The `stripe.checkout.sessions.create()` call returns a `url` property — route handler returns `{ url }` as JSON, client does `window.location.href = url`. This is cleaner than wrapping in a Server Action that would need `redirect()`.

**Flow:**

```
Client: "Subscribe" button click
  ↓
POST /api/stripe/checkout
  - Verify Supabase session (getClaims — do not skip)
  - Load account by owner_user_id
  - If no stripe_customer_id: stripe.customers.create({ email, metadata: { account_id } })
    then UPDATE accounts SET stripe_customer_id = ... (via admin client)
  - stripe.checkout.sessions.create({
      customer: stripe_customer_id,
      line_items: [{ price: priceId, quantity: 1 }],  // priceId from query param: monthly or annual
      mode: 'subscription',
      success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/billing`,
      subscription_data: { trial_period_days: 14 },  // only if no active trial yet
      metadata: { account_id: account.id }
    })
  - Return JSON: { url: session.url }
  ↓
Client: window.location.href = url  →  Stripe Hosted Checkout
  ↓
User completes payment → Stripe redirects to /app/billing?session_id=cs_xxx
  ↓
Webhook fires async: customer.subscription.created → updates accounts.subscription_status
```

**`metadata: { account_id }`** on both the Customer and the Checkout Session is critical — it lets the webhook handler look up the correct `accounts` row from Stripe's event data without an additional DB round-trip.

### Customer Portal

**File:** `app/api/stripe/portal/route.ts`

```
POST /api/stripe/portal
  - Verify Supabase session
  - Load account → stripe_customer_id (must exist; 400 if missing)
  - stripe.billingPortal.sessions.create({
      customer: stripe_customer_id,
      return_url: `${origin}/app/billing`
    })
  - Return JSON: { url: session.url }
```

Client: "Manage subscription" button → POST → redirect to portal URL → user manages → returns to `/app/billing`.

---

## 4. Paywall Enforcement Layer

### Decision: Middleware check in `lib/supabase/proxy.ts`

**Recommendation: extend `proxy.ts` (currently `lib/supabase/proxy.ts`, invoked from root `proxy.ts`).**

Three options considered:

**Option A: Middleware in `proxy.ts` (RECOMMENDED)**
- One place to read `subscription_status`.
- Redirects happen before any RSC tree renders — faster, consistent.
- Matches the existing auth gate pattern already in `updateSession`.
- Downside: middleware cannot use the normal Supabase server client — must use the same `createServerClient` already there. Requires a second DB query per request.

**Option B: Server Component check in `(shell)/layout.tsx`**
- Runs after middleware, in the RSC tree.
- Can use `createClient()` normally.
- Harder to guarantee it runs on every sub-route — layout is cached between navigations in some scenarios.
- Requires propagating the locked state down to every page, or relying on layout redirect. Layout redirects are less reliable than middleware redirects for protecting nested routes.

**Option C: Per-page `if (status === 'locked') redirect('/app/billing')` in each page.tsx**
- Most explicit, hardest to maintain, easiest to forget.
- Rejected.

**Recommended middleware extension:**

Add to `lib/supabase/proxy.ts`, after the existing auth gate:

```typescript
// v1.8 Subscription gate — runs only for authenticated users on /app/* paths
// MUST NOT run on /[account]/* (public booker — LD-07)
// MUST NOT run on /app/billing/* (billing pages always accessible)
// MUST NOT run on public auth paths (already exempted above)

const billingPaths = ["/app/billing"];
const isOwnerRoute = pathname.startsWith("/app");
const isBillingRoute = billingPaths.some(p => pathname.startsWith(p));
const isPublicBooker = !pathname.startsWith("/app") && !pathname.startsWith("/auth") && !pathname.startsWith("/api");

if (user && isOwnerRoute && !isBillingRoute && !publicAuthPaths.includes(pathname)) {
  // Read subscription status from accounts table.
  // Use the existing supabase server client (already created above).
  const { data: accountRow } = await supabase
    .from("accounts")
    .select("subscription_status, trial_ends_at")
    .eq("owner_user_id", user.sub)
    .is("deleted_at", null)
    .maybeSingle();

  if (accountRow) {
    const isLocked =
      accountRow.subscription_status === "locked" ||
      accountRow.subscription_status === "canceled" ||
      (accountRow.subscription_status === "trialing" &&
        accountRow.trial_ends_at &&
        new Date(accountRow.trial_ends_at) < new Date());

    if (isLocked) {
      const url = request.nextUrl.clone();
      url.pathname = "/app/billing";
      return NextResponse.redirect(url);
    }
  }
}
```

**LD-07 preservation:** The `/[account]/*` route segment never starts with `/app`, so `isOwnerRoute` is false. The subscription gate never runs for public booker traffic. This is enforced structurally, not by a string comparison that could be accidentally broken.

**Performance note:** This adds one DB query per authenticated owner request. Acceptable at current scale. For v1.9+, cache `subscription_status` in the JWT via a custom claim, eliminating the DB round-trip.

---

## 5. Lag-Window Strategy (Checkout Return Before Webhook)

**The window:** User completes Stripe Checkout → redirected to `/app/billing?session_id=cs_xxx` → their `subscription_status` is still `'trialing'` in your DB → webhook fires 1-10 seconds later.

**Recommendation: Poll-with-timeout on the `/app/billing` success page.**

When `/app/billing` detects `?session_id=` in the URL:

1. Show "Your subscription is being confirmed..." with a spinner.
2. Poll `GET /api/stripe/checkout/status?session_id=xxx` every 2 seconds for up to 30 seconds.
3. The status endpoint reads `accounts.subscription_status` for the current user — when it becomes `'active'`, return `{ status: 'active' }`.
4. On `'active'`: hide spinner, show "You're all set!" and revalidate/navigate to `/app`.
5. On timeout (30s): show "This is taking longer than expected. Refresh in a moment."

**Why not optimistic update:** Setting `subscription_status = 'active'` optimistically in the client would de-sync from the DB and from the paywall middleware. If the user navigates away and back, middleware would still see `'trialing'` and block them.

**Why not `router.refresh()` loop on billing page:** `router.refresh()` re-runs Server Components, which re-queries the DB. This is correct behavior but requires the SC tree to propagate the new status. The explicit poll endpoint is cleaner because it gives you a typed response and a definite timeout path.

**File:** `app/api/stripe/checkout/status/route.ts` — a simple `GET` handler that reads `accounts.subscription_status` for the authenticated user.

---

## 6. Trial Clock Initialization

**When `trial_ends_at` is set:**

1. **Existing accounts (pre-v1.8):** Set in the migration backfill (see section 1c) to `NOW() + INTERVAL '14 days'` at deploy time.

2. **New accounts (post-v1.8 signup):** Set in the `provision_account_for_new_user` trigger:
   ```sql
   -- Add to the existing trigger function:
   trial_ends_at = NOW() + INTERVAL '14 days',
   subscription_status = 'trialing'
   ```
   Do NOT rely on the Checkout Session or webhook to set this — the trial starts the moment the account exists, not the moment they see the billing page.

3. **Stripe trial vs. your DB trial:** If you pass `trial_period_days: 14` to `stripe.checkout.sessions.create()`, Stripe also tracks a trial on the subscription. Keep both in sync: when `customer.subscription.created` fires with `status: 'trialing'`, update `accounts.trial_ends_at` to match `subscription.trial_end` (the Stripe timestamp is authoritative once a subscription exists).

**The pre-Stripe backfill is the critical path.** At v1.8 deploy, the migration runs, existing accounts get `subscription_status = 'trialing'` (DEFAULT) and `trial_ends_at = NOW() + 14d` (from the UPDATE). When Phase C paywall enforcement turns on, those accounts are in a valid trial — they are not locked out.

---

## 7. Billing Page Architecture

**New route:** `app/(shell)/app/billing/page.tsx`

This is a protected page inside the `(shell)` route group, accessible at `/app/billing`. It must be exempted from the paywall middleware redirect (see section 4). It is the one `/app/*` page a locked owner can always reach.

**Page structure:**

```
app/(shell)/app/billing/
├── page.tsx              -- Server Component: loads account subscription state
├── _components/
│   ├── trial-status-card.tsx       -- shows trial days remaining
│   ├── locked-state-card.tsx       -- shown when subscription_status='locked'|'canceled'
│   ├── active-subscription-card.tsx -- shows plan, renewal date, "Manage" button
│   ├── past-due-banner.tsx          -- shown when status='past_due'
│   ├── plan-selector.tsx            -- monthly/annual toggle + Subscribe button
│   ├── checkout-return-poller.tsx   -- client component: polls on ?session_id= query param
│   └── global-paywall-banner.tsx    -- exported for use in (shell)/layout.tsx
```

**Global paywall banner:** A subtle top banner visible on ALL `/app/*` pages when `subscription_status` is `'trialing'` and fewer than 3 days remain, or when `'past_due'`. The banner includes a link to `/app/billing`. Implement in `(shell)/layout.tsx` — it reads the account row once and passes status down to the banner component.

Banner copy (per milestone context): "Everything is waiting for you! Head over to payments to get set up."

---

## 8. Email Integration for Stripe Events

**Recommendation: Route all Stripe lifecycle emails through `getSenderForAccount(accountId)` — NOT Stripe's built-in receipts.**

Rationale:
- Brand consistency: owner sees emails from their own Gmail or from `bookings@nsintegrations.com` (Resend path), not from `no-reply@stripe.com`.
- Existing infrastructure: `getSenderForAccount` + `checkAndConsumeQuota` already handles both Gmail and Resend routing transparently.
- The refused-send fail-closed contract is correct here: if the account's email provider is broken, skip the lifecycle email and log it — don't crash the webhook handler.

**Exception for dollar-amount receipts:** Stripe's built-in receipt emails (sent on successful charge) include the charge amount, invoice PDF link, and are Stripe-branded. These are worth keeping enabled in the Stripe Dashboard for legal/compliance reasons — they are the authoritative payment confirmation. Your custom emails are supplementary (trial-ending reminders, locked-account notification, etc.).

**Emails to send from webhook handler:**

| Trigger | Event | Template |
|---------|-------|----------|
| Trial ending soon | `customer.subscription.trial_will_end` (fires 3 days before) | `trial-ending.tsx` |
| Payment failed | `invoice.payment_failed` | `payment-failed.tsx` |
| Account locked | When middleware would transition to `locked` — OR via a scheduled check | `account-locked.tsx` |
| Welcome to paid | `invoice.payment_succeeded` (first payment) | `welcome-paid.tsx` |

**Email call pattern in webhook handler:**

```typescript
// Fire-and-forget pattern matching existing booking email pattern:
void getSenderForAccount(accountId).then(sender =>
  sender.send({ to: ownerEmail, subject: "...", html: "..." })
).catch(err => console.error("[stripe-webhook] email send failed", err));
```

The webhook handler must return `200` immediately — never await email sending inside the webhook critical path. The existing booking email pattern already uses fire-and-forget; mirror it.

---

## 9. Login Form Changes (`LoginForm` component)

**File:** `app/(auth)/app/login/login-form.tsx`

**Current state (verified from codebase):**
- Google OAuth button appears FIRST (CONTEXT.md lock — cannot move).
- Below: Card with `Tabs defaultValue="password"` — Password tab is already default. The tab already shows password-first.
- The current form already has `Password | Magic link` tabs with password as default.

**v1.8 changes:**

1. **Login button reorder (minimal):** Currently the Card shows "Sign in" as the CardTitle before the tabs. The only reorder in scope is ensuring "Sign in with Google" button visually precedes the card — already true. Verify against final spec; may be a no-op.

2. **3-fail nudge counter:** Add `useState<number>(0)` for `failCount` directly in `LoginForm` (not a hook — too simple to warrant extraction). On each `loginAction` failure (`state.formError` transitions to a new value), increment `failCount`. When `failCount >= 3`, render an additional `<Alert>` below the error suggesting the Magic link tab:

   ```tsx
   // In LoginForm, after the state/form setup:
   const [failCount, setFailCount] = useState(0);
   const prevFormError = useRef(state.formError);
   
   useEffect(() => {
     if (state.formError && state.formError !== prevFormError.current) {
       setFailCount(c => c + 1);
     }
     prevFormError.current = state.formError;
   }, [state.formError]);
   ```

   The counter resets on tab close (browser unload) by default — `useState` is ephemeral to the component mount. No `localStorage` persistence needed. Switching tabs unmounts the password TabsContent (Radix default), resetting state — this is correct behavior.

3. **Magic-link inline helper text:** Add a `<p className="text-sm text-muted-foreground">` below the MagicLinkTabContent email input describing what to expect. One paragraph, no architecture impact.

**AUTH-29 four-way ambiguity invariant:** The login form changes do not alter the loginAction server action or the underlying Supabase auth calls. The tab restructuring is pure JSX within the existing `Tabs` component. The Google OAuth button position is locked and unchanged. AUTH-29 is preserved.

**V15-MP-05 Turnstile lifecycle lock:** Turnstile is on the public booking form, not the login form. No intersection with login form changes.

---

## 10. New File Paths (complete manifest for v1.8)

### Migrations (Phase A — ship first)

```
supabase/migrations/20260509_v18_stripe_accounts.sql
supabase/migrations/20260509_v18_stripe_webhook_events.sql
```

### Stripe API routes (Phase A skeleton, Phase B–D flesh out)

```
app/api/stripe/
├── webhook/
│   └── route.ts          -- POST; raw body; signature verify; idempotent event routing
├── checkout/
│   ├── route.ts           -- POST; create Checkout Session; return { url }
│   └── status/
│       └── route.ts       -- GET; return { status } for polling on return from Checkout
└── portal/
    └── route.ts           -- POST; create Customer Portal session; return { url }
```

### Billing page (Phase B–C)

```
app/(shell)/app/billing/
├── page.tsx
└── _components/
    ├── trial-status-card.tsx
    ├── locked-state-card.tsx
    ├── active-subscription-card.tsx
    ├── past-due-banner.tsx
    ├── plan-selector.tsx
    ├── checkout-return-poller.tsx
    └── global-paywall-banner.tsx
```

### Stripe client lib

```
lib/stripe/
├── client.ts             -- export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-...' })
└── price-ids.ts          -- export const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID!
                          -- export const ANNUAL_PRICE_ID  = process.env.STRIPE_ANNUAL_PRICE_ID!
```

### Email templates for Stripe events

```
lib/email/templates/
├── trial-ending.tsx
├── payment-failed.tsx
├── account-locked.tsx
└── welcome-paid.tsx
```

### Modified files

```
lib/supabase/proxy.ts          -- Add subscription gate after existing auth gate
app/(shell)/layout.tsx         -- Add global paywall banner
app/(auth)/app/login/login-form.tsx  -- 3-fail nudge counter + magic-link helper text
lib/email-sender/quota-guard.ts      -- SIGNUP_DAILY_EMAIL_CAP: 200 → 450
```

---

## 11. Build Order — Phase Dependency Graph

### Phase A: Schema + Stripe SDK + Webhook Skeleton

**What ships:** Both migrations, `lib/stripe/client.ts`, `lib/stripe/price-ids.ts`, `app/api/stripe/webhook/route.ts` (idempotent — processes events but does not enforce paywall yet).

**Why first:** Every subsequent phase depends on the DB columns existing. The webhook handler can be deployed and connected to Stripe in test mode before UI exists — this lets you verify event routing independently.

**Unblocks:** Phases B, C, D can now all begin (schema is stable). B and D can parallelize after A.

**Dependencies:** None. No UI required, no paywall yet.

### Phase B: Checkout Flow + Plan Selection Page

**What ships:** `app/(shell)/app/billing/page.tsx` (initial), `plan-selector.tsx`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout/status/route.ts`, `checkout-return-poller.tsx`.

**Depends on:** Phase A (stripe_customer_id and subscription columns must exist before checkout route can update them).

**Does not depend on:** Phase C (paywall enforcement). Users can check out before enforcement is on.

**Can parallelize with:** Phase D (portal), Phase E (login UX). No shared files.

### Phase C: Paywall Enforcement + Locked-State UI + Global Banner

**What ships:** `proxy.ts` subscription gate, `locked-state-card.tsx`, `global-paywall-banner.tsx`, updated `(shell)/layout.tsx`.

**Depends on:** Phase A (subscription_status column must exist) AND Phase B (billing page must exist before middleware can redirect to it — otherwise locked users hit a 404).

**This is the most sensitive phase:** Touches the auth/navigation critical path. LD-07 must be verified before merge (public booker `/[account]/*` traffic must never see the billing redirect). AUTH-29 is unaffected (paywall runs after auth, only for authenticated users).

**Sensitive surface test checklist:**
- LD-07: Book a slot on a locked account's public page → booking succeeds, no redirect.
- LD-07: Load `/[account]/event-type-slug` → page renders, no subscription check.
- Billing exempt: Navigate to `/app/billing` while locked → page loads (no redirect loop).
- Auth-first: Unauthenticated visit to `/app/settings` → redirected to `/app/login` (existing auth gate fires first, subscription gate never runs without a user).
- Trial valid: Account with trial_ends_at = tomorrow → dashboard accessible.
- Trial expired: Account with trial_ends_at = yesterday, status='trialing' → middleware sets locked redirect.

### Phase D: Customer Portal + Billing Settings + Email Templates

**What ships:** `app/api/stripe/portal/route.ts`, `active-subscription-card.tsx`, `past-due-banner.tsx`, `trial-status-card.tsx`, all email templates, webhook email dispatch.

**Depends on:** Phase A (webhook events table), Phase B (billing page exists). Can run after Phase B is merged.

**Can parallelize with:** Phase C at the file level — different files. However, shipping Phase D before Phase C means users can manage their subscription but paywall isn't enforced yet. This is fine — "early access to portal" is a safe state. Merge Phase C last.

### Phase E: Login UX Polish + Gmail Quota Raise

**What ships:** `login-form.tsx` changes (3-fail nudge, magic-link helper text), `quota-guard.ts` constant change (200 → 450).

**Depends on:** Nothing from Phases A–D. Completely independent.

**Can ship:** Anytime — even before Phase A if desired. Recommended to bundle as the final phase so v1.8 QA can verify the full set in one pass.

**Quota raise note:** The constant `SIGNUP_DAILY_EMAIL_CAP = 200` in `lib/email-sender/quota-guard.ts` is a one-line change. Verify the Gmail account's actual daily limit supports 450 before deploying (standard Gmail 500/day, so 450 leaves 50 headroom).

---

## 12. Anti-Patterns to Avoid

### Anti-Pattern 1: Reading raw body after parsing

**What people do (wrong):** Call `await request.json()` first, then pass it to `stripe.webhooks.constructEvent()`.
**Why it's wrong:** Stripe verifies the HMAC signature against the raw bytes. Re-serializing JSON can change byte order, spacing, or encoding — the signature will fail every time.
**Do this instead:** `const body = await request.text()` before any JSON parsing. Keep `body` as a string for `constructEvent`.

### Anti-Pattern 2: Paywall middleware on `/[account]/*`

**What people do:** Write `pathname.startsWith("/app") || pathname.startsWith("/")` in the subscription gate.
**Why it's wrong:** Violates LD-07. A paying customer's bookers (who are not the owner, have no Supabase session) would be redirected to `/app/billing` — a broken, confusing dead end.
**Do this instead:** Gate only on `pathname.startsWith("/app")` with explicit exclusions for `/app/billing` and `publicAuthPaths`. The `/[account]/*` namespace never contains `/app`.

### Anti-Pattern 3: Trusting Stripe Checkout return URL as proof of payment

**What people do:** On `/app/billing?session_id=xxx`, immediately set `subscription_status = 'active'` in the DB without waiting for the webhook.
**Why it's wrong:** The checkout return URL fires the moment the user is redirected from Stripe — before the webhook. If you write directly, you bypass the idempotency table. If the user hits back/forward, the URL fires again.
**Do this instead:** The `?session_id=` param triggers a poll. The poll reads the DB which is only updated by the webhook. The checkout `success_url` is cosmetic confirmation UX, not a payment confirmation signal.

### Anti-Pattern 4: Storing full Stripe event payload

**What people do:** `payload JSONB` column that stores the full `event.data.object`.
**Why it's wrong:** Full Stripe events contain billing emails (PII), card last-4 digits, IP addresses. Storing them in your DB creates a GDPR/CCPA surface you must manage.
**Do this instead:** Store a slim `payload_summary` (subscription_id, status, period_end). Full event is always retrievable from the Stripe Dashboard.

### Anti-Pattern 5: Using Server Actions for Checkout Session creation

**What people do:** `"use server"` action that calls `stripe.checkout.sessions.create()` and returns the URL.
**Why it's wrong:** Server Actions that return URLs work, but the standard pattern for external redirects triggered by client actions is a Route Handler returning JSON. Server Actions throw `NEXT_REDIRECT` for redirects — you cannot inspect the redirect URL or add a loading state.
**Do this instead:** Route Handler returns `{ url }`, client does `window.location.href = url`. Gives you full control over loading state and error handling.

---

## Sources

- Live codebase: `lib/supabase/proxy.ts` (middleware auth gate pattern, confirmed)
- Live codebase: `lib/email-sender/account-sender.ts` (getSenderForAccount factory pattern, confirmed)
- Live codebase: `lib/email-sender/quota-guard.ts` (SIGNUP_DAILY_EMAIL_CAP constant location, confirmed)
- Live codebase: `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql` (migration pattern: table creation, RLS, trigger convention)
- Live codebase: `supabase/migrations/20260507120000_phase36_resend_provider.sql` (ALTER TABLE ADD COLUMN backfill pattern with DEFAULT fast-path)
- Live codebase: `proxy.ts` (root middleware exports `config.matcher` — regex excludes static assets; subscription gate must match same pathname logic)
- Live codebase: `app/(auth)/app/login/login-form.tsx` (confirmed: password-first tab is already default; Google button position locked)
- Live codebase: `app/api/bookings/route.ts` (confirmed: App Router Route Handler pattern for POST endpoints needing raw HTTP status codes)
- Live codebase: `app/auth/gmail-connect/callback/route.ts` (confirmed: App Router GET handler with `await request.text()` pattern not needed here — but shows the request lifecycle pattern)
- Stripe App Router webhook documentation pattern: `request.text()` for raw body (HIGH confidence — established pattern, multiple official Stripe examples confirm this)
- Stripe idempotency: event.id as dedup key (HIGH confidence — Stripe official docs specify this)

---

*Architecture research for: NSI Booking Tool v1.8 — Stripe Paywall*
*Researched: 2026-05-09*
