# Phase 41: Stripe SDK + Schema + Webhook Skeleton - Research

**Researched:** 2026-05-10
**Domain:** Stripe billing foundation — SDK init, accounts schema extension, idempotent webhook handler in Next.js App Router on Supabase
**Confidence:** HIGH (locked decisions inherited from milestone v1.8 research; codebase patterns verified via direct file inspection; Stripe SDK / API behavior verified against docs.stripe.com 2026-05-10)

---

## Summary

Phase 41 builds the billing foundation: install Stripe Node SDK 22.1.1 (apiVersion `2026-04-22.dahlia`), add 7 columns to `accounts`, create the `stripe_webhook_events` idempotency table, update the `provision_account_for_new_user` trigger so new signups default to `trialing` with a 14-day clock, backfill all existing accounts with the same trial window, and ship a working signature-verifying webhook at `POST /api/stripe/webhook` that routes 6 lifecycle events to atomic single-row UPDATEs and records all events (including unknowns) into the dedupe table.

Most architectural decisions are LOCKED upstream — milestone v1.8 stack/architecture/pitfalls research already prescribes the SDK version, route shape, idempotency strategy (`INSERT ... ON CONFLICT DO NOTHING`), env var names, and event vocabulary. CONTEXT.md adds 4 phase-specific decisions: 7th column (`trial_warning_sent_at`), single-migration delivery, dedupe-row-rollback on DB failure, and `console.*` logging only.

**Open questions resolved by this research:**

1. **Account lookup pattern (customer_id → accounts.id):** Recommend a `stripe_customer_id`-keyed reverse lookup via `accounts.select(...).eq('stripe_customer_id', ...).maybeSingle()`. The CHECKOUT route (Phase 42) is responsible for writing `stripe_customer_id` BEFORE the first webhook can fire — Phase 41 handlers can fail loudly if no row matches and rely on Stripe retry to converge. NOT a `metadata.account_id` JSON dive — too fragile when events come from multiple sources. See § Account Lookup.

2. **Stripe client structure:** Singleton in `lib/stripe/client.ts` mirroring the Supabase admin client convention. NO module-level memoization beyond the SDK's own internal HTTP keep-alive. See § Standard Stack.

3. **Webhook handler organization:** Single `route.ts` file with a per-event-type switch and inline helper functions. Matches the verbosity of `app/api/bookings/route.ts` (the established codebase precedent). NO separate dispatcher/handler module split for 6 events — premature abstraction. See § Architecture Patterns.

4. **TypeScript types:** Use `Stripe.Event`, `Stripe.Subscription`, `Stripe.Invoice` from the SDK. Hand-roll nothing. The SDK 22.x types are pinned to apiVersion `2026-04-22.dahlia` automatically. See § Code Examples.

**Primary recommendation:** Mirror the `getSenderForAccount` fail-closed pattern (verify → look up → write → log loudly on missing state, never throw to caller) for the webhook handler's per-event helpers. Mirror the Phase 34 migration pattern (single transaction, named file, `ALTER TABLE ... ADD COLUMN` + `CREATE TABLE` + `CREATE OR REPLACE FUNCTION` in one apply, rollback file co-shipped). Use `mcp__claude_ai_Supabase__apply_migration` like Phase 35/40.

---

## Standard Stack

### Core (one new dependency, plus existing patterns)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | **22.1.1** (LOCKED, LD-01) | Server-side Stripe API client + webhook verification | Official; only first-party Node SDK for Stripe REST |
| `@supabase/supabase-js` | already installed | Service-role client for `stripe_webhook_events` insert + `accounts` update | Existing — `lib/supabase/admin.ts` |
| `next` | 16.2.4 (already installed) | App Router native `Request` exposes `await req.text()` for raw body | Existing |

### Do NOT install

| Package | Why not |
|---------|---------|
| `@stripe/stripe-js` | Browser-side Stripe.js loader. Unused in Phase 41 (no Checkout UI yet). Phase 42 also won't need it — milestone uses hosted Checkout (redirect), not Elements. |
| `@stripe/react-stripe-js` | Wraps Elements for React. Same reason as above. |
| `micro` / `raw-body` / `body-parser` | Pages Router workarounds for raw-body capture. App Router exposes `req.text()` natively — these packages are obsolete here (verified against milestone PITFALLS V18-CP-01). |

### Stripe Client Singleton (Claude's Discretion → recommend singleton)

Create `lib/stripe/client.ts` matching the `lib/supabase/admin.ts` shape:

```typescript
// Source: milestone v1.8 STACK.md §Initialization Pattern + verified against docs.stripe.com
import "server-only";
import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * RULES (mirror lib/supabase/admin.ts conventions):
 *   - Import ONLY from server code (Route Handlers, Server Actions, Server Components).
 *     The `import "server-only"` at top throws at bundle time on client import.
 *   - Singleton at module scope — Stripe SDK maintains an internal HTTP agent
 *     with keep-alive; re-instantiating per request would burn TCP handshakes.
 *     This is OPPOSITE to the Supabase admin client guidance (which says "no
 *     singleton because Fluid compute") because the Stripe SDK is just an HTTP
 *     wrapper with no per-request session state.
 *   - apiVersion is pinned to '2026-04-22.dahlia' — the version that ships with
 *     SDK 22.x. NEVER omit apiVersion (V18-CP-08 — webhook schema breaks on
 *     Stripe's next API release if not pinned).
 *   - Test/live key switch is automatic: STRIPE_SECRET_KEY env var is set per
 *     environment in Vercel (sk_test_* in preview, sk_live_* in production).
 *     The SDK doesn't care which prefix — just uses what's there. Never check
 *     prefix in code (would force test mode in dev confusingly).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
```

**Why singleton (different from Supabase admin client):** Stripe SDK is a stateless HTTP wrapper around `fetch` with an internal connection pool. Re-instantiating per request defeats keep-alive and adds latency. The Supabase admin client guidance to avoid singletons is driven by Fluid compute connection-pool concerns specific to Postgres connections — not applicable here.

**Env validation:** Throw on missing `STRIPE_SECRET_KEY` at first import (the `!` non-null assertion is fine because `Stripe()` constructor will throw a clearer error on undefined than the route handler would much later).

### Required env vars (NEW for Phase 41)

| Variable | Purpose | Source |
|----------|---------|--------|
| `STRIPE_SECRET_KEY` | Server-side Stripe API + webhook constructEvent | `sk_test_*` from Stripe Dashboard test mode (Phase 41 deploy); `sk_live_*` for production (PREREQ-D / Phase 42 cutover) |
| `STRIPE_WEBHOOK_SECRET` | `constructEvent(body, sig, secret)` signature key | `whsec_*` — locally from `stripe listen` CLI; in deployed envs from Stripe Dashboard webhook endpoint config (PREREQ-F after deploy) |

**NOT needed in Phase 41:** `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — those are Phase 42 (Checkout) concerns.

### Alternatives considered (and rejected for this phase)

| Instead of | Could use | Why rejected |
|------------|-----------|--------------|
| Stripe SDK 22.1.1 | Older 17.x / 18.x line | LOCKED LD-01; older SDK types lag the API version we need to pin |
| `await req.text()` raw body | `await req.arrayBuffer()` then Buffer.from | Both work with `constructEvent`, but `text()` matches existing milestone v1.8 STACK.md sample code and Stripe's official Node example. Stick with the documented path. |
| Separate `stripe_webhook_log` table for full audit | `stripe_webhook_events` carries event_type + processed_at | DEFERRED in CONTEXT — sufficient for v1.8 |

**Installation:**
```bash
npm install stripe@22.1.1
```

Pin to exact version (no `^`) to prevent silent SDK upgrades that drift from the apiVersion string.

---

## Architecture Patterns

### Recommended file layout

```
lib/stripe/
└── client.ts                     # NEW — Stripe singleton (apiVersion pinned)

app/api/stripe/
└── webhook/
    └── route.ts                  # NEW — POST handler: verify, dedupe, route, write

supabase/migrations/
├── 20260510120000_phase41_stripe_billing_foundation.sql           # NEW — single forward migration
└── 20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql  # NEW — co-shipped rollback (do not apply unless needed)
```

**File-naming alignment with established convention:**
- Timestamp `20260510120000` matches `YYYYMMDDHHMMSS` format from Phase 32–37 migrations.
- `phase41_*` prefix matches Phase 32/35/36/37 migration naming.
- `_ROLLBACK.sql` suffix matches the Phase 27 cross-event-exclude pattern (`20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql`).

### Pattern 1: Single-file webhook with switch + inline helpers (Claude's Discretion → recommend)

**What:** One `app/api/stripe/webhook/route.ts` containing the POST handler, signature verification, dedupe, and per-event-type helper functions in the same file. NO separate `lib/stripe/handlers/*.ts` modules.

**Rationale:** Codebase precedent. `app/api/bookings/route.ts` (430 lines) and `app/api/cron/send-reminders/route.ts` (300 lines) both consolidate all logic in a single file with rich JSDoc and inline comments. Splitting into per-event modules would force readers to context-switch across 6 files to verify the dedupe + write pattern is consistent. At 6 events, a switch statement with one small helper per case fits comfortably in ~250 lines.

**When to refactor:** If event count grows beyond 10 OR if any per-event handler exceeds 50 lines (e.g., complex side-effects in Phase 44), extract that handler to `lib/stripe/handlers/<event-type>.ts` then. Not before.

### Pattern 2: Fail-closed mirror of `getSenderForAccount`

The webhook handler's per-event helpers should mirror the v1.7 `getSenderForAccount` discipline (`lib/email-sender/account-sender.ts:104-204`):

| `getSenderForAccount` step | Webhook handler equivalent |
|---------------------------|----------------------------|
| `admin.from('accounts').select(...).eq('id', accountId).maybeSingle()` | `admin.from('accounts').select('id').eq('stripe_customer_id', stripeCustomerId).maybeSingle()` |
| `if (accountErr) { console.error(...); return refusedSender(...) }` | `if (lookupErr) { console.error('[stripe-webhook] account lookup failed', {...}); return rollbackAndRetry(...) }` |
| Never throws — every path returns an `EmailClient` (real or refused) | Never throws — every path returns a `Response` with appropriate status (200 / 400 / 500) |
| Logs use `console.error("[account-sender] ...", { accountId, accountErr })` | Logs use `console.error("[stripe-webhook] ...", { stripe_event_id, account_id, ... })` |

**Key invariant:** No exceptions escape the `POST` handler. Every code path ends in an explicit `return new Response(...)` so Stripe receives a deterministic status code. Unhandled throws return 500 from the framework but lose all log context — wrap event routing in `try/catch` at the top of the switch.

### Pattern 3: Atomic single-row UPDATE per event (CONTEXT-locked)

Each handler does ONE `UPDATE accounts SET col1 = ?, col2 = ?, ... WHERE id = ?` — not multiple sequential UPDATEs, not a transaction wrapper. Postgres single-row updates are already atomic; supabase-js exposes this directly:

```typescript
const { error } = await admin
  .from("accounts")
  .update({
    subscription_status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    plan_interval: subscription.items.data[0]?.price.recurring?.interval ?? null,
  })
  .eq("id", accountId);
```

If the UPDATE returns an error AFTER the dedupe row was inserted, the handler must:
1. `DELETE FROM stripe_webhook_events WHERE stripe_event_id = ?` (revert dedupe so retry can succeed)
2. `console.error('[stripe-webhook] db write failed', { stripe_event_id, account_id, err })`
3. Return 500 (Stripe retries with exponential backoff)

This is the CONTEXT-locked rollback semantic.

### Pattern 4: Idempotency via `INSERT ... ON CONFLICT DO NOTHING`

The supabase-js equivalent is `.upsert(..., { onConflict: 'stripe_event_id', ignoreDuplicates: true })` — verified pattern in `app/auth/google-callback/route.ts:73-86` (uses upsert + onConflict, though without ignoreDuplicates because that path wants to update). For Phase 41 we DO want to ignore duplicates:

```typescript
const { data: insertResult, error: dedupeErr } = await admin
  .from("stripe_webhook_events")
  .upsert(
    {
      stripe_event_id: event.id,
      event_type: event.type,
      received_at: new Date().toISOString(),
    },
    { onConflict: "stripe_event_id", ignoreDuplicates: true }
  )
  .select("stripe_event_id")  // returns [] on duplicate, [{...}] on first-write
  .maybeSingle();

if (dedupeErr) {
  console.error("[stripe-webhook] dedupe insert failed", { stripe_event_id: event.id, dedupeErr });
  return new Response("dedupe_failed", { status: 500 });
}
if (!insertResult) {
  // Already processed — return 200 so Stripe stops retrying.
  console.log("[stripe-webhook] duplicate", { stripe_event_id: event.id, event_type: event.type });
  return new Response("ok_duplicate", { status: 200 });
}
// First time we've seen this event — proceed to route.
```

**Why `.select().maybeSingle()` after upsert:** The `ignoreDuplicates: true` flag silently swallows the conflict. Without `.select()` you cannot distinguish "first-write" from "duplicate" — both return `error: null`. With `.select().maybeSingle()` you get back the row on first-write and `null` on duplicate.

### Anti-Patterns to Avoid

- **Calling `req.json()` anywhere in the webhook file** — even in a debug branch — instantly invalidates signature verification. Stripe's `constructEvent` requires byte-identical raw body. Lock this with a code comment at the top of the file (V18-CP-01).
- **Storing the full Stripe event JSON in `stripe_webhook_events`** — events contain billing email + plan details (PII + business confidential). The dedupe table needs only `stripe_event_id`, `event_type`, `received_at` (and optionally `account_id` for join queries). Stripe Dashboard is the system of record for full event payloads.
- **Reading `event.created` for ordering** — Stripe explicitly does NOT guarantee delivery order. Trust the `subscription.status` field on each event (CONTEXT-locked, V18-CP-11).
- **Wrapping the dedupe-insert + accounts-update in a Postgres transaction** — supabase-js doesn't expose multi-statement transactions over the REST API anyway, and the rollback semantics in CONTEXT (delete the dedupe row on failure) achieve the same effect at the application layer with simpler code.
- **Trusting `event.account` for tenant lookup** — that field is the Stripe Account ID (your platform account in Stripe Connect contexts), not your `accounts.id`. Always look up via `stripe_customer_id`.
- **Using `Promise.all` to dispatch handlers** — there's only ever ONE event per request; serialize execution.

---

## Account Lookup: customer_id → accounts.id

This is the question CONTEXT explicitly asked to be researched. Three viable strategies:

### Option A (RECOMMENDED): `stripe_customer_id` reverse lookup

```typescript
const customerId = typeof subscription.customer === "string"
  ? subscription.customer
  : subscription.customer.id;

const { data: account, error } = await admin
  .from("accounts")
  .select("id")
  .eq("stripe_customer_id", customerId)
  .maybeSingle();

if (error || !account) {
  console.error("[stripe-webhook] no account for customer", {
    stripe_event_id: event.id,
    stripe_customer_id: customerId,
  });
  // Phase 41 posture: roll back dedupe + return 500 to trigger Stripe retry.
  // The Phase 42 checkout route is responsible for writing stripe_customer_id
  // BEFORE Stripe can fire customer.subscription.created — so a missing row
  // here means either (a) Phase 42 race (rare, retry will succeed once
  // Phase 42 finishes), or (b) a manual Stripe Dashboard test against a
  // customer not linked to an account (operator error — should fail loudly).
  await rollbackDedupe(event.id);
  return new Response("account_not_found", { status: 500 });
}
```

**Why this is the right answer:**
- `stripe_customer_id` is a stable, indexed column (UNIQUE NULL-allowed per milestone ARCHITECTURE.md §1a) — fast lookup with no ambiguity.
- It's how every existing Stripe SaaS implementation works. The customer object is the "tenant" in Stripe's mental model.
- It survives across event types: `customer.subscription.*`, `invoice.payment_*`, and `customer.subscription.trial_will_end` ALL carry the customer ID at a known location.
- It's symmetric with the `getSenderForAccount` lookup pattern (look up by an external key, fail loudly if missing).

### Option B: `event.data.object.metadata.account_id`

When Phase 42 creates the Checkout Session, it sets `subscription_data.metadata = { account_id }` so the Subscription object carries it. This survives onto invoice events too via `subscription.metadata`.

```typescript
const accountId = subscription.metadata?.account_id;
if (!accountId) { /* fail */ }
```

**Why NOT this as primary:** Metadata is set ONCE at checkout. If anyone (Andrew, future support staff) creates a subscription via the Stripe Dashboard for testing, metadata is empty. Reverse lookup via `stripe_customer_id` works in BOTH paths because it's set by the SDK regardless of event source. Use metadata as a secondary cross-check (defense in depth) only if Phase 42 sets it.

### Option C: Look up via Stripe API on each webhook

`stripe.customers.retrieve(customerId)` to read the customer's metadata. **Rejected:** adds 200ms latency per webhook + an extra failure mode + completely unnecessary.

### Helper function shape

```typescript
async function findAccountByStripeCustomerId(
  admin: SupabaseClient,
  stripeCustomerId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .from("accounts")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) {
    console.error("[stripe-webhook] account lookup db error", { stripeCustomerId, error });
    return null;
  }
  return data;
}
```

The helper returns `null` for both "no row" and "DB error" — caller logs the specific case and decides whether to return 500 (retry) or 200 (give up). For Phase 41, ALL not-found cases return 500 (retry) because Phase 42 may not have completed its `accounts.update({ stripe_customer_id })` call yet.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Manual HMAC-SHA256 with the signing secret | `stripe.webhooks.constructEvent(body, sig, secret)` | The SDK handles timestamp tolerance (5min default), multiple `v1=` signatures (key rotation), and constant-time comparison. Hand-rolling these gets you V18-CP-01 in production. |
| Idempotency tracking | A custom Map<eventId, processedAt> in Redis / memory | `stripe_webhook_events` table + `INSERT ON CONFLICT DO NOTHING` | Postgres unique constraint is the only correct idempotency primitive in a multi-instance serverless world. In-memory caches reset on cold start. |
| Stripe API version pinning | "We'll just keep up with the latest" | Explicit `apiVersion: '2026-04-22.dahlia'` in client init | V18-CP-08 — Stripe ships breaking schema changes between versions. Pinning is the only way to guarantee TypeScript types match runtime payloads. |
| Subscription state mirror | Querying Stripe API on every paywall check | Local `subscription_status` column synced via webhooks | One DB query (already authenticated session) vs. one network hop to Stripe (200ms + their availability becomes yours). Standard SaaS pattern. |
| Trial clock | `created_at + 14 days` computed on read | `trial_ends_at timestamptz` set at row creation | Allows manual extension via Andrew's dashboard later (just bump the column). Read-time computation forces every paywall check to reach for `created_at` AND know the trial-length constant. |
| Webhook event type → handler dispatch | Reflection / dynamic import maps | Plain `switch (event.type)` statement | TypeScript narrows `event.data.object` to the correct subtype on a discriminated switch — type-safe routing at zero runtime cost. |

**Key insight:** Stripe billing has been a solved problem for 10+ years. Every "interesting" architectural decision in this phase (signature verification, idempotency, customer-tenant mapping, trial tracking) has a canonical answer. Phase 41 is execution, not invention.

---

## Common Pitfalls

(All inherited from milestone v1.8 PITFALLS.md — repeated here so the planner can write verification steps without cross-referencing.)

### Pitfall 1: V18-CP-01 — Webhook body parsed as JSON before signature verification

**What goes wrong:** Calling `req.json()` anywhere in the webhook route — even for "let me just log the body for debugging" — re-serializes the payload with sorted keys / different whitespace. The signature was computed over the original byte stream and will no longer match. Result: every event fails signature verification.

**Why it happens:** Next.js App Router parses bodies lazily. `req.text()` and `req.json()` are mutually exclusive — once one is called, the body stream is consumed. Even after returning a 400, future events fail because the developer's mental model is "json is just convenience, the signature must use the same bytes" — but Next.js doesn't preserve the original bytes after `.json()`.

**How to avoid:**
- FIRST line in `POST(req)` body: `const body = await req.text();`
- Add a code comment: `// MUST be req.text() — req.json() breaks signature verification (V18-CP-01)`
- Vitest test: mock `req.text()` to return a known string, `req.json()` should NEVER be called by the handler — verify via spy.

**Warning signs:** Stripe Dashboard event log shows "endpoint returned 400" for every event with body `"Webhook signature verification failed"`.

### Pitfall 2: V18-CP-02 — Webhook handler not idempotent

**What goes wrong:** Stripe retries with exponential backoff for up to 3 days on any non-2xx (and on timeout). Without `INSERT ON CONFLICT DO NOTHING` against `stripe_event_id`, a slow handler that completes the DB write but times out before returning 200 will be replayed — and the second invocation will run the UPDATE again. For idempotent UPDATEs (status assignments) this is harmless; for any future side-effect (sending an email, charging a card) this duplicates the action.

**Why it happens:** Developers test the happy path locally where the handler completes in 200ms. Production cold starts + Vercel timeouts surface this only after a few weeks.

**How to avoid:**
- `INSERT INTO stripe_webhook_events (stripe_event_id, ...) ON CONFLICT (stripe_event_id) DO NOTHING` is the FIRST DB op after signature verification.
- If the insert returned 0 rows → 200 immediately (already processed).
- If 1 row → proceed.
- Phase 44 emails MUST also check `trial_warning_sent_at` before sending (CONTEXT decision — that's the column's purpose).

**Warning signs:** Same `accounts.subscription_status` UPDATE applied multiple times in Vercel logs for one Stripe event ID; duplicate rows in any future `stripe_*_log` table.

### Pitfall 3: V18-CP-03 — Test/live key bleed

**What goes wrong:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are environment-specific. Setting test-mode keys in Vercel production (or vice versa) means: customers don't appear where you expect, webhook signatures don't verify (test webhook secret ≠ live webhook secret), and you can accidentally charge real cards from a Preview deployment.

**How to avoid:**
- Vercel Preview env: `sk_test_*` + `whsec_*` from a Stripe Dashboard test-mode webhook endpoint pointed at the Preview URL.
- Vercel Production env: `sk_live_*` + `whsec_*` from a Stripe Dashboard live-mode webhook endpoint.
- Local dev: `sk_test_*` + `whsec_*` from `stripe listen` CLI (different value than the dashboard one).
- Never hardcode any key. Never check key prefix in code (would lock dev to test mode).

**Warning signs:** Dashboard event log empty after deploy (wrong env got the webhook). `customer.subscription.retrieve` succeeds but the customer isn't visible in the Dashboard (test/live toggle wrong).

### Pitfall 4: V18-CP-08 — Stripe API version unpinned, schema drifts on next Stripe release

**How to avoid:** `apiVersion: '2026-04-22.dahlia'` in `lib/stripe/client.ts` is non-negotiable. ALSO set the same version on the webhook endpoint in the Stripe Dashboard (PREREQ-F). When upgrading the SDK in a future phase, change BOTH.

### Pitfall 5: V18-CP-11 — Out-of-order events corrupt subscription state

**What goes wrong:** Stripe's docs do not guarantee event delivery order. A `customer.subscription.updated` (status: active) can arrive AFTER a `customer.subscription.deleted` (status: canceled) due to network reordering. Naive handlers that only check event type (not the payload status) will set `active` after `canceled` and silently grant access to a canceled subscription.

**How to avoid (CONTEXT-locked):** Always read `subscription.status` from the payload. NEVER assume event_type alone implies a status transition. The state on the payload IS the source of truth — the event_type just tells you what happened, not what's true now.

### Pitfall 6: Stripe timestamps are Unix SECONDS, not milliseconds

**What goes wrong:** Subscription objects expose `current_period_end`, `trial_end`, `canceled_at` as **Unix seconds** (integer). JavaScript `new Date(timestamp)` expects milliseconds. Passing the seconds value yields a date in 1970.

**How to avoid:** Always multiply by 1000:

```typescript
new Date(subscription.current_period_end * 1000).toISOString()
```

Add a small util `lib/stripe/timestamps.ts`:
```typescript
export function stripeTimestampToIso(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds == null) return null;
  return new Date(unixSeconds * 1000).toISOString();
}
```

### Pitfall 7: Forgetting `export const dynamic = "force-dynamic"`

**What goes wrong:** Next.js may attempt to statically render or cache route handlers in some configurations. A cached webhook response means new events return the OLD response from cache — DB never updated.

**How to avoid:** Add `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"` at top of `route.ts`. Both are present in `app/api/cron/send-reminders/route.ts:51-53` — copy that pattern.

### Pitfall 8: Trigger function update doesn't include the existing column write

**What goes wrong:** When updating `provision_account_for_new_user()` to include `trial_ends_at` and `subscription_status`, accidentally dropping `owner_email`, `slug`, `name`, `timezone`, `onboarding_complete`, or `onboarding_step` from the INSERT breaks all future signups silently (trigger succeeds with NULLs in required columns).

**How to avoid:**
- Use `CREATE OR REPLACE FUNCTION` — full re-definition.
- Diff the new function against the existing one in `20260428120002_phase10_accounts_rls_and_trigger.sql:57-83` BEFORE applying.
- Verification step: after migration apply, sign up a fresh test user via Supabase Dashboard, verify the resulting `accounts` row has all of: `owner_email` set, `onboarding_complete = false`, `onboarding_step = 1`, `subscription_status = 'trialing'`, `trial_ends_at ≈ NOW() + 14 days`.

---

## Code Examples

### Example 1: The full webhook handler skeleton

```typescript
// Source: synthesizes milestone v1.7 cron route style (app/api/cron/send-reminders/route.ts)
//         + milestone v1.8 ARCHITECTURE.md §2 webhook pattern
//         + Stripe official Node.js example
// File: app/api/stripe/webhook/route.ts

import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // ── 1. Read RAW body — req.text() ONLY. NEVER req.json() in this file. ──
  // V18-CP-01: signature verification requires byte-identical body.
  const body = await req.text();

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    // No header = not a real Stripe webhook (or misconfigured client).
    // Don't log body — could be a probe.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    console.error("[stripe-webhook] missing signature", { ip, ts: new Date().toISOString() });
    return new Response("missing_signature", { status: 400, headers: NO_STORE });
  }

  // ── 2. Verify signature via SDK ─────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    // CONTEXT decision: log timestamp + source IP + error message ONLY.
    // No payload — that's PII risk + attacker probe surface.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const errMessage = err instanceof Error ? err.message : "unknown_error";
    console.error("[stripe-webhook] signature verification failed", {
      ip,
      ts: new Date().toISOString(),
      err: errMessage,
    });
    return new Response("signature_failed", { status: 400, headers: NO_STORE });
  }

  const admin = createAdminClient();

  // ── 3. Idempotency — INSERT ... ON CONFLICT DO NOTHING ──────────────────
  // upsert + ignoreDuplicates is the supabase-js equivalent. .select() lets
  // us distinguish first-write (returns row) from duplicate (returns null).
  const { data: dedupeRow, error: dedupeErr } = await admin
    .from("stripe_webhook_events")
    .upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        received_at: new Date().toISOString(),
      },
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    )
    .select("stripe_event_id")
    .maybeSingle();

  if (dedupeErr) {
    console.error("[stripe-webhook] dedupe insert failed", {
      stripe_event_id: event.id,
      event_type: event.type,
      err: dedupeErr.message,
    });
    return new Response("dedupe_failed", { status: 500, headers: NO_STORE });
  }

  if (!dedupeRow) {
    // Already processed — return 200 so Stripe stops retrying.
    console.log("[stripe-webhook] duplicate", {
      stripe_event_id: event.id,
      event_type: event.type,
      outcome: "duplicate",
    });
    return new Response("ok_duplicate", { status: 200, headers: NO_STORE });
  }

  // ── 4. Route by event type ──────────────────────────────────────────────
  // Wrap in try/catch so any unexpected throw rolls back dedupe + returns 500.
  try {
    let outcome: "routed" | "unknown";
    let accountId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await handleSubscriptionEvent(admin, event.type, sub);
        accountId = result.accountId;
        stripeSubscriptionId = sub.id;
        outcome = "routed";
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const result = await handleInvoiceEvent(admin, event.type, invoice);
        accountId = result.accountId;
        stripeSubscriptionId = result.stripeSubscriptionId;
        outcome = "routed";
        break;
      }
      default:
        // CONTEXT decision: unknown events log + return 200 + stay in dedupe table.
        outcome = "unknown";
    }

    console.log("[stripe-webhook] processed", {
      stripe_event_id: event.id,
      event_type: event.type,
      account_id: accountId,
      stripe_subscription_id: stripeSubscriptionId,
      outcome,
    });
    return new Response("ok", { status: 200, headers: NO_STORE });
  } catch (err) {
    // Unexpected throw inside a handler — roll back dedupe + 500 so Stripe retries.
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] handler threw", {
      stripe_event_id: event.id,
      event_type: event.type,
      err: errMessage,
    });
    await admin.from("stripe_webhook_events").delete().eq("stripe_event_id", event.id);
    return new Response("handler_error", { status: 500, headers: NO_STORE });
  }
}
```

### Example 2: Per-event helper for subscription events

```typescript
// In the same file, below POST. Returns { accountId } so logger can record it.

async function handleSubscriptionEvent(
  admin: SupabaseClient,
  eventType: string,
  sub: Stripe.Subscription,
): Promise<{ accountId: string | null }> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: account, error: lookupErr } = await admin
    .from("accounts")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[stripe-webhook] account lookup failed", { customerId, err: lookupErr.message });
    throw new Error("account_lookup_db_error");  // outer catch rolls back dedupe
  }
  if (!account) {
    console.error("[stripe-webhook] no account for customer", { customerId, eventType });
    throw new Error("account_not_found");  // outer catch rolls back dedupe + 500 so retry catches Phase 42 race
  }

  // Build the update payload — different events touch different columns.
  const updates: Record<string, unknown> = {};

  if (eventType === "customer.subscription.trial_will_end") {
    // CONTEXT decision: only the warning timestamp on this event.
    updates.trial_warning_sent_at = new Date().toISOString();
  } else {
    // created / updated / deleted all touch status + period + plan.
    updates.subscription_status = sub.status;  // CONTEXT-locked: trust payload status
    updates.stripe_subscription_id = sub.id;
    updates.current_period_end = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
    updates.plan_interval = sub.items.data[0]?.price.recurring?.interval ?? null;
    // 'deleted' event payload also carries status='canceled' so the above suffices.
  }

  const { error: updateErr } = await admin
    .from("accounts")
    .update(updates)
    .eq("id", account.id);

  if (updateErr) {
    console.error("[stripe-webhook] account update failed", {
      account_id: account.id,
      stripe_subscription_id: sub.id,
      eventType,
      err: updateErr.message,
    });
    throw new Error("account_update_failed");  // outer catch handles rollback
  }

  return { accountId: account.id };
}
```

### Example 3: Per-event helper for invoice events

```typescript
async function handleInvoiceEvent(
  admin: SupabaseClient,
  eventType: string,
  invoice: Stripe.Invoice,
): Promise<{ accountId: string | null; stripeSubscriptionId: string | null }> {
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id ?? null;
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id ?? null;

  if (!customerId) {
    console.error("[stripe-webhook] invoice has no customer", { eventType, invoiceId: invoice.id });
    throw new Error("invoice_no_customer");
  }

  const { data: account, error: lookupErr } = await admin
    .from("accounts")
    .select("id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupErr || !account) {
    console.error("[stripe-webhook] no account for invoice customer", { customerId, eventType });
    throw new Error("account_not_found");
  }

  // Both invoice events: trust the related subscription's status if present.
  // The invoice payload has invoice.status (paid/open/uncollectible) but NOT the
  // subscription status. For subscription_status updates, retrieve the subscription
  // OR derive: payment_succeeded → 'active', payment_failed → 'past_due' (CONTEXT
  // says "update subscription_status per payload" — interpret as: set the status
  // that matches the invoice outcome, not via a Stripe API roundtrip).
  const newStatus = eventType === "invoice.payment_succeeded" ? "active" : "past_due";

  const { error: updateErr } = await admin
    .from("accounts")
    .update({ subscription_status: newStatus })
    .eq("id", account.id);

  if (updateErr) {
    console.error("[stripe-webhook] invoice-driven update failed", {
      account_id: account.id,
      eventType,
      err: updateErr.message,
    });
    throw new Error("account_update_failed");
  }

  return { accountId: account.id, stripeSubscriptionId: subscriptionId };
}
```

### Example 4: Forward migration

```sql
-- Source: synthesizes milestone v1.8 ARCHITECTURE.md §1a-1c + CONTEXT 7-column scope
-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql
--
-- Phase 41: Stripe billing foundation.
-- Single transaction (Postgres DDL is transactional). All-or-nothing apply.
-- Rollback: see paired _ROLLBACK.sql file. Do not apply unless reverting.
--
-- Apply via: mcp__claude_ai_Supabase__apply_migration with
--   name='phase41_stripe_billing_foundation' and the file body below.
-- Validate first on a Supabase preview branch (mcp__Supabase__create_branch).

BEGIN;

-- 1. Add 7 billing columns to accounts.
ALTER TABLE public.accounts
  ADD COLUMN stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN subscription_status      TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing', 'active', 'past_due', 'canceled',
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )),
  ADD COLUMN trial_ends_at            TIMESTAMPTZ,
  ADD COLUMN current_period_end       TIMESTAMPTZ,
  ADD COLUMN plan_interval            TEXT
    CHECK (plan_interval IS NULL OR plan_interval IN ('monthly', 'annual', 'month', 'year')),
  ADD COLUMN trial_warning_sent_at    TIMESTAMPTZ;
-- NOTE: plan_interval CHECK accepts both ('month'/'year') from Stripe payload AND
-- ('monthly'/'annual') from CONTEXT vocabulary. Phase 42 normalizes — for now
-- accept both so neither path breaks.

COMMENT ON COLUMN public.accounts.stripe_customer_id IS
  'Stripe Customer ID (cus_*). Set by Phase 42 checkout route before redirect to hosted Checkout.';
COMMENT ON COLUMN public.accounts.subscription_status IS
  'Mirror of Stripe subscription.status. Source of truth for paywall middleware (Phase 43).';
COMMENT ON COLUMN public.accounts.trial_ends_at IS
  '14-day trial deadline. Set by trigger on signup; backfilled to NOW()+14d on v1.8 deploy.';
COMMENT ON COLUMN public.accounts.trial_warning_sent_at IS
  'Set by webhook on customer.subscription.trial_will_end. Phase 44 reads this to gate the trial-ending email.';

-- 2. Backfill: grandfather all existing accounts with trial starting at deploy.
-- LD-09 + V18-CP-06: anchor trial to NOW() (deploy time), NOT created_at.
-- WHERE stripe_customer_id IS NULL = "every existing account" since no one has one yet.
UPDATE public.accounts
SET
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trialing'
WHERE stripe_customer_id IS NULL;

-- 3. Idempotency table for webhook deduplication.
CREATE TABLE public.stripe_webhook_events (
  stripe_event_id TEXT        PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

-- RLS: service-role-only writes. No authenticated read policy needed.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- (RLS enabled with zero policies = no anon/authenticated access.)

COMMENT ON TABLE public.stripe_webhook_events IS
  'Stripe webhook idempotency log. Phase 41+: INSERT ... ON CONFLICT DO NOTHING on stripe_event_id; if 0 rows inserted, event already processed.';

-- 4. Update provision_account_for_new_user trigger to set trial defaults on signup.
-- Mirrors the original from 20260428120002_phase10_accounts_rls_and_trigger.sql,
-- adding trial_ends_at + subscription_status. All other columns preserved unchanged.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id,
    owner_email,
    slug,
    name,
    timezone,
    onboarding_complete,
    onboarding_step,
    subscription_status,
    trial_ends_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NULL,                         -- slug filled by wizard step 1
    NULL,                         -- name filled by wizard step 1
    'UTC',                        -- placeholder; wizard step 2 sets real timezone
    FALSE,
    1,
    'trialing',                   -- BILL-04: every new signup starts trialing
    NOW() + INTERVAL '14 days'    -- BILL-04: 14-day clock starts at signup
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- The trigger itself (provision_account_on_signup on auth.users) was created in
-- the Phase 10 migration and points at the function name — CREATE OR REPLACE
-- above re-binds without needing to drop+recreate the trigger.

COMMIT;
```

### Example 5: Rollback migration (co-shipped, NOT applied unless needed)

```sql
-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql
--
-- Reverse of phase41_stripe_billing_foundation.sql.
-- DO NOT APPLY unless reverting Phase 41. Co-shipped per CONTEXT migration policy.

BEGIN;

-- 1. Restore the original (Phase 10) trigger function.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step
  ) VALUES (
    NEW.id, NEW.email, NULL, NULL, 'UTC', FALSE, 1
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- 2. Drop dedupe table.
DROP TABLE IF EXISTS public.stripe_webhook_events;

-- 3. Drop billing columns. (DROP COLUMN auto-removes any CHECK / UNIQUE constraints.)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS trial_warning_sent_at,
  DROP COLUMN IF EXISTS plan_interval,
  DROP COLUMN IF EXISTS current_period_end,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;

COMMIT;
```

---

## State of the Art

| Old Approach | Current Approach (2026) | Why changed |
|--------------|-------------------------|-------------|
| Pages Router `bodyParser: false` + `micro.buffer(req)` for raw body | App Router `await req.text()` | Native Request API; no middleware needed |
| In-memory or Redis idempotency cache | DB unique constraint + `ON CONFLICT DO NOTHING` | Serverless = no shared memory; DB is the only durable choice |
| Custom HMAC-SHA256 signature verification | `stripe.webhooks.constructEvent(...)` | SDK handles timestamp tolerance, multi-signature, constant-time compare — every roll-your-own implementation has had a bug |
| Full event payload stored in DB for "audit" | event_id + event_type + timestamps only | Stripe Dashboard is the system of record; storing payloads risks PII duplication |
| Polling Stripe API on every paywall check | Webhook-synced status column | Removes Stripe availability from your app's critical path |

**Deprecated/outdated patterns — DO NOT use:**
- `const buffer = await rawBody(req)` (Pages Router pattern)
- `apiVersion: undefined` (uses SDK-default, drifts on Stripe upgrade — V18-CP-08)
- `stripe.subscriptions.retrieve(...)` inside webhook handler to verify status (the payload IS the source of truth — V18-CP-11 + CONTEXT)

---

## Open Questions

### 1. Should the webhook handler actively verify event signature timestamp tolerance?

**Status:** Default is fine. `stripe.webhooks.constructEvent` enforces a 5-minute tolerance by default — sufficient. No need to override.

### 2. Should `stripe_webhook_events.processed_at` be set on duplicate detection?

**Recommendation:** No. The column is `NULL` until the handler successfully completes, then a separate `UPDATE stripe_webhook_events SET processed_at = NOW() WHERE stripe_event_id = ?` after the accounts UPDATE. Lets future debugging distinguish "received but never processed" from "received and processed".

**Concretely:** Add this after the per-event handler succeeds (inside the try block, after the switch):

```typescript
await admin
  .from("stripe_webhook_events")
  .update({ processed_at: new Date().toISOString() })
  .eq("stripe_event_id", event.id);
```

Plan can decide whether to include this column update in the handler or skip it (CONTEXT didn't explicitly require it but the table has the column per ARCHITECTURE §1b).

### 3. How to test the webhook handler in Vitest without hitting Stripe?

**Recommendation:** Use `stripe.webhooks.generateTestHeaderString({ payload, secret })` to produce a valid test signature, then call the handler with a constructed `Request`. The Stripe SDK ships this helper specifically for unit tests. Document this in the test file.

### 4. Should the webhook be exempted in `proxy.ts`?

**Status:** Not strictly required for Phase 41 (proxy doesn't currently gate `/api/stripe/*`). When Phase 43 adds the paywall check, ensure `/api/stripe/webhook` is in the exempted list (it must always succeed regardless of any account's subscription state). Flag for Phase 43 plan.

### 5. Should `stripe_customer_id` use a partial unique index or table-level UNIQUE?

**Recommendation:** Table-level `UNIQUE` is fine because Postgres treats NULL values as distinct under UNIQUE — multiple rows with NULL `stripe_customer_id` are allowed without a partial index. Verified in milestone ARCHITECTURE.md §1a. The `CREATE UNIQUE INDEX ... WHERE stripe_customer_id IS NOT NULL` from STACK.md is functionally equivalent and slightly more defensive — either is acceptable. Plan recommended: table-level UNIQUE for simplicity.

---

## Sources

### Primary (HIGH confidence)

- **Codebase: `app/api/cron/send-reminders/route.ts`** — established route handler shape (runtime/dynamic exports, NO_STORE pattern, structured console.error logging, fail-soft per-row error handling).
- **Codebase: `app/api/bookings/route.ts`** — single-file route handler with inline helpers + verbose JSDoc; the pattern Phase 41 should mirror.
- **Codebase: `lib/email-sender/account-sender.ts`** — `getSenderForAccount` fail-closed pattern (verify, look up, write, log loudly, never throw).
- **Codebase: `lib/supabase/admin.ts`** — service-role client conventions (`server-only` import, env validation, no singleton because of Fluid compute).
- **Codebase: `app/auth/google-callback/route.ts:73-86`** — concrete `.upsert(..., { onConflict })` example used in this codebase.
- **Codebase: `supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql`** — the existing `provision_account_for_new_user` definition that must be preserved during update.
- **Codebase: `supabase/migrations/20260507120000_phase36_resend_provider.sql`** — exemplar for ALTER TABLE ADD COLUMN with CHECK + DEFAULT + comments.
- **Codebase: `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql`** — exemplar for CREATE TABLE + RLS + comment style.
- **`.planning/research/STACK.md`** (milestone v1.8) — verified Stripe SDK version, apiVersion, init pattern, env var inventory.
- **`.planning/research/ARCHITECTURE.md`** (milestone v1.8) — webhook architecture, event routing table, schema decisions.
- **`.planning/research/PITFALLS.md`** (milestone v1.8) — V18-CP-01 through V18-CP-11 catalog with prevention guidance.
- **docs.stripe.com/api/subscriptions/object** (verified 2026-05-10) — confirmed timestamps are Unix seconds; status enum vocabulary; `items.data[0].price.recurring.interval` for plan interval.
- **docs.stripe.com/webhooks** (verified 2026-05-10) — confirmed status code semantics (400 for sig failure, 5xx triggers retry, 2xx stops retry), 3-day retry window with exponential backoff.
- **docs.stripe.com/billing/subscriptions/webhooks** (verified 2026-05-10) — confirmed `customer.subscription.trial_will_end` fires 3 days before trial end (or immediately if trial < 3 days).
- **GitHub: stripe/stripe-node releases** — confirmed v22.1.1 release date 2025-05-06; v22.1.0 pins to apiVersion `2026-04-22.dahlia`.

### Secondary (MEDIUM confidence)

- **CONTEXT.md decisions** — user-locked phase choices (7-column scope, single-migration delivery, console-only logging, dedupe rollback semantics) treated as binding.
- **Supabase JS docs (training-recall)** — `.upsert(..., { ignoreDuplicates: true, onConflict: 'col' })` is the standard pattern; verified by partial codebase usage of `.upsert(..., { onConflict })` in Google OAuth callback. The `ignoreDuplicates: true` flag is documented but not yet used in this codebase — confidence MEDIUM that it works as expected; verify in preview branch test.

### Tertiary (LOW confidence — flagged for verification)

- Exact behavior of `.select().maybeSingle()` AFTER an `.upsert()` with `ignoreDuplicates: true` — needs a smoke test on the preview branch to confirm it returns `null` on conflict and the row on first-write. If supabase-js returns the row on BOTH paths, the dedupe logic must be reworked to use a separate count query.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version + apiVersion verified against npm + Stripe docs at research time
- Webhook architecture: HIGH — synthesizes verified milestone research + existing codebase patterns
- Schema migration: HIGH — column shapes inherited from milestone ARCHITECTURE; trigger update preserves all Phase 10 columns
- Account lookup pattern: HIGH — recommendation grounded in milestone PITFALLS + standard SaaS practice
- Pitfalls catalog: HIGH — inherited from milestone v1.8 PITFALLS.md (V18-CP-01 through V18-CP-11)
- Idempotency dedupe via `.select().maybeSingle()` after `.upsert(ignoreDuplicates: true)`: MEDIUM — pattern is logically sound but not yet exercised in this codebase; verify on preview branch

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (Stripe SDK release cadence is ~monthly; if Phase 41 work slips beyond this date, re-verify SDK version + apiVersion against npm).
