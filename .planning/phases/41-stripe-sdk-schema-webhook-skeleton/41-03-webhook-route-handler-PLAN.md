---
phase: 41-stripe-sdk-schema-webhook-skeleton
plan: 03
type: execute
wave: 2
depends_on: ["41-01"]
files_modified:
  - app/api/stripe/webhook/route.ts
autonomous: true

must_haves:
  truths:
    - "POST /api/stripe/webhook reads raw body via await req.text() — never req.json() — before stripe.webhooks.constructEvent (V18-CP-01)"
    - "Missing or invalid stripe-signature header returns 400 with minimal log (timestamp + IP + error message only, no payload)"
    - "Successful signature verification triggers a dedupe upsert into stripe_webhook_events with onConflict 'stripe_event_id' + ignoreDuplicates true"
    - "Duplicate event (already in stripe_webhook_events) returns 200 immediately and logs outcome=duplicate (BILL-06)"
    - "All 6 lifecycle events route to atomic single-row UPDATEs on accounts: customer.subscription.created/updated/deleted/trial_will_end + invoice.payment_succeeded/failed (BILL-07, BILL-08)"
    - "Account lookup uses stripe_customer_id reverse-lookup (.eq('stripe_customer_id', customerId).maybeSingle()) — missing account fails loud with 500 + dedupe rollback so Stripe retries"
    - "Unknown event types log + return 200 + record event into stripe_webhook_events (full audit trail per CONTEXT)"
    - "Any DB-write failure AFTER dedupe insert deletes the just-inserted dedupe row and returns 500 (so Stripe retry succeeds cleanly on next attempt)"
    - "subscription_status is read from event payload (sub.status), never inferred from event_type (V18-CP-11 out-of-order events)"
    - "Stripe Unix-second timestamps multiplied by 1000 before new Date(...) to produce correct ISO timestamptz values"
  artifacts:
    - path: "app/api/stripe/webhook/route.ts"
      provides: "POST handler for Stripe webhook events with signature verification, dedupe, routing, and atomic accounts updates"
      exports: ["POST", "runtime", "dynamic"]
      min_lines: 200
  key_links:
    - from: "app/api/stripe/webhook/route.ts"
      to: "lib/stripe/client.ts"
      via: "import { stripe } from '@/lib/stripe/client'"
      pattern: "from\\s+[\"']@/lib/stripe/client[\"']"
    - from: "app/api/stripe/webhook/route.ts POST handler"
      to: "raw request body"
      via: "await req.text() — NEVER req.json()"
      pattern: "await\\s+req\\.text\\(\\)"
    - from: "app/api/stripe/webhook/route.ts POST handler"
      to: "Stripe signature verification"
      via: "stripe.webhooks.constructEvent(body, signature, secret)"
      pattern: "stripe\\.webhooks\\.constructEvent"
    - from: "app/api/stripe/webhook/route.ts"
      to: "stripe_webhook_events table dedupe"
      via: "admin.from('stripe_webhook_events').upsert(..., { onConflict: 'stripe_event_id', ignoreDuplicates: true })"
      pattern: "stripe_webhook_events.*onConflict.*stripe_event_id"
    - from: "Account lookup helper"
      to: "accounts table reverse lookup"
      via: ".eq('stripe_customer_id', customerId).maybeSingle()"
      pattern: "stripe_customer_id.*maybeSingle"
    - from: "Subscription event handler"
      to: "atomic single-row UPDATE on accounts"
      via: "admin.from('accounts').update({ subscription_status, current_period_end, ... }).eq('id', accountId)"
      pattern: "from\\([\"']accounts[\"']\\)\\.update"
---

<objective>
Build `app/api/stripe/webhook/route.ts` — the signature-verifying, deduplicating, single-route handler that ingests Stripe webhook events and writes the resulting state to `accounts`. This is the code-side counterpart to Plan 41-02's schema (and the only Phase 41 plan that produces TypeScript).

Purpose: Without this handler, the schema is dead weight. With this handler, every Stripe lifecycle event for every account is reflected back into the database within seconds — making `accounts.subscription_status` the source of truth for the Phase 43 paywall middleware and `accounts.trial_warning_sent_at` the gate for the Phase 44 trial-ending email. This plan ALSO depends on Plan 41-02's schema being live in production, but only at runtime — the code itself depends only on Plan 41-01's `lib/stripe/client.ts`.

Output:
- One file: `app/api/stripe/webhook/route.ts` (~250 lines).
- Implements: raw-body capture, signature verification, dedupe upsert, switch over 6 event types + unknown fallback, per-event helpers for subscription and invoice events, dedupe-rollback on DB failure, fail-loud on missing account.
- All logs go through `console.log` / `console.error` only (CONTEXT: no Sentry, no DB log table beyond `stripe_webhook_events`).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-CONTEXT.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-RESEARCH.md

# Required: Stripe singleton from Plan 41-01
@lib/stripe/client.ts

# Required: Supabase service-role client (the admin client used inside the route)
@lib/supabase/admin.ts

# Pattern precedents to mirror (file shape, runtime/dynamic exports, NO_STORE, structured logs)
@app/api/cron/send-reminders/route.ts
@app/api/bookings/route.ts

# Fail-closed discipline reference (mirror this in per-event helpers)
@lib/email-sender/account-sender.ts

# Existing .upsert + onConflict precedent in this codebase
@app/auth/google-callback/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create app/api/stripe/webhook/route.ts with POST handler, signature verification, dedupe, and routing</name>
  <files>app/api/stripe/webhook/route.ts</files>
  <action>
Create the file `app/api/stripe/webhook/route.ts` implementing the structure from RESEARCH §Code Examples Examples 1–3 (verbatim except for type imports and helper signatures, which adapt to this codebase).

**File structure** (in this exact order):

1. Top-of-file comment block (3–5 lines) explaining: (a) this file processes Stripe webhooks, (b) the body MUST be read with `req.text()` not `req.json()` (V18-CP-01), (c) idempotency is enforced via the `stripe_webhook_events` table.
2. Imports:
   ```typescript
   import { headers } from "next/headers";
   import type Stripe from "stripe";
   import type { SupabaseClient } from "@supabase/supabase-js";
   import { stripe } from "@/lib/stripe/client";
   import { createAdminClient } from "@/lib/supabase/admin";
   ```
   (Adapt the `createAdminClient` import name to whatever `lib/supabase/admin.ts` actually exports — read that file first to confirm the export name.)
3. Route exports:
   ```typescript
   export const runtime = "nodejs";
   export const dynamic = "force-dynamic";

   const NO_STORE = { "Cache-Control": "no-store" } as const;
   ```
4. `POST(req: Request)` handler implementing:

   **a) Raw body read.** First non-blank line of the function body MUST be:
   ```typescript
   // V18-CP-01: signature verification requires byte-identical body. NEVER call req.json() in this file.
   const body = await req.text();
   ```

   **b) Header read + missing-signature short-circuit.**
   ```typescript
   const headersList = await headers();
   const signature = headersList.get("stripe-signature");
   if (!signature) {
     const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
     console.error("[stripe-webhook] missing signature", { ip, ts: new Date().toISOString() });
     return new Response("missing_signature", { status: 400, headers: NO_STORE });
   }
   ```

   **c) Signature verification via SDK.** Wrap `stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)` in try/catch. On failure: log timestamp + IP + error message only (no payload — PII risk per CONTEXT). Return 400.

   **d) Create admin client + dedupe upsert.**
   ```typescript
   const admin = createAdminClient();

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
   ```
   - On `dedupeErr`: log + return 500 (NOT a rollback — there's nothing to roll back yet). Stripe will retry.
   - On `dedupeRow == null`: this event_id already existed. Log `outcome: "duplicate"` + return 200 (ok_duplicate body). DO NOT proceed to routing.
   - Otherwise: proceed.

   **e) Per-event routing inside try/catch.** A switch over `event.type`:

   - Cases `customer.subscription.created` | `customer.subscription.updated` | `customer.subscription.deleted` | `customer.subscription.trial_will_end`:
     - Cast `event.data.object as Stripe.Subscription`.
     - Call `handleSubscriptionEvent(admin, event.type, sub)`.
   - Cases `invoice.payment_succeeded` | `invoice.payment_failed`:
     - Cast `event.data.object as Stripe.Invoice`.
     - Call `handleInvoiceEvent(admin, event.type, invoice)`.
   - Default: set `outcome = "unknown"`. The dedupe row is already inserted, so the audit trail is preserved. Just log + fall through to the success log + return 200.

   On caught error: delete the just-inserted dedupe row (`await admin.from("stripe_webhook_events").delete().eq("stripe_event_id", event.id)`), log error with event_id + event_type, return 500 with body `handler_error`.

   On success: console.log structured outcome `{ stripe_event_id, event_type, account_id, stripe_subscription_id, outcome }` and return 200 with body `ok`.

5. **Helper `handleSubscriptionEvent`** below the POST handler. Signature:
   ```typescript
   async function handleSubscriptionEvent(
     admin: SupabaseClient,
     eventType: string,
     sub: Stripe.Subscription,
   ): Promise<{ accountId: string | null }>
   ```
   Body (mirrors RESEARCH Example 2 — copy verbatim except adapt `SupabaseClient` import path if needed):

   ```typescript
   const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

   const { data: account, error: lookupErr } = await admin
     .from("accounts")
     .select("id")
     .eq("stripe_customer_id", customerId)
     .maybeSingle();

   if (lookupErr) {
     console.error("[stripe-webhook] account lookup failed", { customerId, err: lookupErr.message });
     throw new Error("account_lookup_db_error");
   }
   if (!account) {
     console.error("[stripe-webhook] no account for customer", { customerId, eventType });
     throw new Error("account_not_found");
   }

   const updates: Record<string, unknown> = {};

   if (eventType === "customer.subscription.trial_will_end") {
     updates.trial_warning_sent_at = new Date().toISOString();
   } else {
     updates.subscription_status = sub.status;  // CONTEXT-locked: trust payload status, NOT event type (V18-CP-11)
     updates.stripe_subscription_id = sub.id;
     updates.current_period_end = sub.current_period_end
       ? new Date(sub.current_period_end * 1000).toISOString()  // Stripe gives Unix SECONDS — multiply by 1000
       : null;
     updates.plan_interval = sub.items.data[0]?.price.recurring?.interval ?? null;
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
     throw new Error("account_update_failed");
   }

   return { accountId: account.id };
   ```

6. **Helper `handleInvoiceEvent`** below `handleSubscriptionEvent`. Signature:
   ```typescript
   async function handleInvoiceEvent(
     admin: SupabaseClient,
     eventType: string,
     invoice: Stripe.Invoice,
   ): Promise<{ accountId: string | null; stripeSubscriptionId: string | null }>
   ```
   Body (mirrors RESEARCH Example 3):

   ```typescript
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

   // Invoice events: payment_succeeded => 'active', payment_failed => 'past_due'.
   // CONTEXT says "update subscription_status per payload" — interpret as: derive from event outcome.
   // Do NOT make a Stripe API roundtrip to retrieve subscription status (latency + extra failure mode).
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
   ```

**What to AVOID:**
- Do NOT call `req.json()` ANYWHERE in this file, even in a debug branch (V18-CP-01). Add a code comment at the top of the POST handler reminding readers.
- Do NOT add `STRIPE_WEBHOOK_SECRET` to `lib/stripe/client.ts` — keep it as `process.env.STRIPE_WEBHOOK_SECRET!` directly at the `constructEvent` call site so the dependency is co-located with the use.
- Do NOT use `Promise.all` to dispatch handlers — one event per request, serialize.
- Do NOT wrap the dedupe-insert + accounts-update in a Postgres transaction. supabase-js doesn't expose multi-statement transactions over REST anyway, and the application-layer rollback (delete dedupe row on DB failure) achieves the same effect more simply.
- Do NOT store the full Stripe event JSON anywhere — `stripe_webhook_events` carries only `stripe_event_id`, `event_type`, `received_at`. Stripe Dashboard is the system of record for full payloads.
- Do NOT trust `event.created` ordering. Always read `subscription.status` from the payload (V18-CP-11).
- Do NOT trust `event.account` for tenant lookup — that's the platform Stripe Account ID in Connect contexts. Use `stripe_customer_id` reverse-lookup.
- Do NOT add `.upsert` for account updates — they must be `.update().eq('id', ...)` so a missing account fails loud (the alternative would silently insert a new account).
- Do NOT set `processed_at` on the dedupe row in this plan. Open Question #2 in RESEARCH suggests adding it, but CONTEXT didn't require it; defer to a future polish phase.
- Do NOT add Sentry / structured-log integration. CONTEXT explicitly defers this to a future improvement.
- Do NOT add a JSON-shaped response body. Plain string bodies (`"ok"`, `"ok_duplicate"`, `"signature_failed"`, etc.) — Stripe ignores the body, so optimize for log readability.
- Do NOT add type narrowing helpers like `isSubscriptionEvent(event)` — the switch-statement type-narrowing on `event.type` already gives correct typings on `event.data.object`.
  </action>
  <verify>
1. File exists: `ls app/api/stripe/webhook/route.ts`.
2. Required imports + exports present:
   - `grep -F "import { stripe } from \"@/lib/stripe/client\"" app/api/stripe/webhook/route.ts` returns 1 match.
   - `grep -F "export const runtime = \"nodejs\"" app/api/stripe/webhook/route.ts` returns 1 match.
   - `grep -F "export const dynamic = \"force-dynamic\"" app/api/stripe/webhook/route.ts` returns 1 match.
   - `grep -F "export async function POST" app/api/stripe/webhook/route.ts` returns 1 match.
3. Critical pitfall guards:
   - `grep -F "await req.text()" app/api/stripe/webhook/route.ts` returns at least 1 match.
   - `grep -F "req.json()" app/api/stripe/webhook/route.ts` returns 0 matches (V18-CP-01 must hold).
   - `grep -F "stripe.webhooks.constructEvent" app/api/stripe/webhook/route.ts` returns 1 match.
   - `grep -E "apiVersion" app/api/stripe/webhook/route.ts` returns 0 matches (apiVersion lives only in lib/stripe/client.ts).
4. Dedupe pattern:
   - `grep -F "stripe_webhook_events" app/api/stripe/webhook/route.ts` returns at least 2 matches (insert + delete-on-rollback).
   - `grep -F "onConflict: \"stripe_event_id\"" app/api/stripe/webhook/route.ts` returns 1 match.
   - `grep -F "ignoreDuplicates: true" app/api/stripe/webhook/route.ts` returns 1 match.
5. Account lookup pattern:
   - `grep -F ".eq(\"stripe_customer_id\"" app/api/stripe/webhook/route.ts` returns at least 2 matches (subscription + invoice helpers).
   - `grep -F ".maybeSingle()" app/api/stripe/webhook/route.ts` returns at least 2 matches.
6. Atomic update pattern:
   - `grep -F ".from(\"accounts\")" app/api/stripe/webhook/route.ts` returns at least 2 matches.
   - `grep -F ".update(" app/api/stripe/webhook/route.ts` returns at least 2 matches (subscription + invoice).
7. Event type coverage — all 6 event types present in the file:
   - For each of `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_succeeded`, `invoice.payment_failed`: `grep -F "$event_type" app/api/stripe/webhook/route.ts` returns at least 1 match.
8. Status status read from payload (V18-CP-11):
   - `grep -F "sub.status" app/api/stripe/webhook/route.ts` returns at least 1 match.
9. Unix-seconds → ms conversion:
   - `grep -F "* 1000" app/api/stripe/webhook/route.ts` returns at least 1 match.
10. TypeScript compiles: `npx tsc --noEmit` exits 0.
11. Build succeeds: `npx next build` exits 0 (route is registered without errors).
  </verify>
  <done>
- `app/api/stripe/webhook/route.ts` exists with full POST handler + helpers.
- All grep verification probes pass (no `req.json()`, all 6 event types present, atomic updates only, etc.).
- TypeScript and Next.js build both succeed.
- File is committed: `feat(41-03): add Stripe webhook route handler skeleton`.
- Deployment to production happens via the standard push-to-main flow (Vercel auto-deploys on push). Confirm Vercel deploy succeeds before considering the plan done. (Production live verification of webhook signature handling is Plan 41-04's job — this plan only ships the code.)
  </done>
</task>

</tasks>

<verification>

Phase-level checks for this plan:

1. File `app/api/stripe/webhook/route.ts` exists with the structure documented above.
2. All grep probes from Task 1 verification pass:
   - 0 occurrences of `req.json()`.
   - At least 1 occurrence of `await req.text()`, `stripe.webhooks.constructEvent`, `onConflict: "stripe_event_id"`, `ignoreDuplicates: true`, `* 1000`, `sub.status`.
   - All 6 lifecycle event types appear by name.
3. `npx tsc --noEmit` exits 0.
4. `npx next build` exits 0; the route appears in the build's route manifest as a dynamic node route at `/api/stripe/webhook`.
5. Vercel deployment of the commit succeeds (preview or production — whichever environment the push targets).

</verification>

<success_criteria>

This plan is complete when:

- [ ] `app/api/stripe/webhook/route.ts` exists with `POST`, `runtime`, `dynamic` exports.
- [ ] Body read via `await req.text()` (verified by grep — and `req.json()` returns 0 matches).
- [ ] Signature verification via `stripe.webhooks.constructEvent`; failure returns 400 with minimal log.
- [ ] Dedupe upsert into `stripe_webhook_events` with `onConflict: "stripe_event_id", ignoreDuplicates: true`; duplicate detection returns 200 immediately.
- [ ] Account lookup uses `stripe_customer_id` reverse-lookup; missing account fails loud with dedupe rollback + 500.
- [ ] All 6 lifecycle events route to atomic single-row UPDATEs (subscription_status from payload, current_period_end converted from Unix seconds, plan_interval from items.data[0].price.recurring).
- [ ] Trial-will-end event sets `trial_warning_sent_at` only.
- [ ] Invoice events derive subscription_status from event type (succeeded→active, failed→past_due).
- [ ] Unknown event types log + return 200 + remain in `stripe_webhook_events` for audit.
- [ ] DB-write failure after dedupe insert deletes the dedupe row + returns 500.
- [ ] All logs use `console.log` / `console.error` only (no Sentry, no DB log table).
- [ ] TypeScript + Next.js build both succeed.
- [ ] Code committed: `feat(41-03): add Stripe webhook route handler skeleton`.
- [ ] Vercel deployment confirmed green.

</success_criteria>

<output>
After completion, create `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-03-SUMMARY.md` documenting:

1. Final line count of `app/api/stripe/webhook/route.ts`.
2. Confirmation grid: each of the 6 event types -> which helper handles it -> which columns it writes:
   | Event type | Helper | Columns updated |
   |------------|--------|-----------------|
   | customer.subscription.created | handleSubscriptionEvent | subscription_status, stripe_subscription_id, current_period_end, plan_interval |
   | customer.subscription.updated | handleSubscriptionEvent | (same) |
   | customer.subscription.deleted | handleSubscriptionEvent | (same — payload.status='canceled' is what gets written) |
   | customer.subscription.trial_will_end | handleSubscriptionEvent | trial_warning_sent_at |
   | invoice.payment_succeeded | handleInvoiceEvent | subscription_status='active' |
   | invoice.payment_failed | handleInvoiceEvent | subscription_status='past_due' |
3. Vercel deploy URL + commit SHA.
4. Note for Plan 41-04: the endpoint is now live but UNREGISTERED in Stripe Dashboard (PREREQ-F). Plan 41-04 covers the registration + first live trigger.
5. Note for Phase 43: the paywall middleware (`lib/supabase/proxy.ts`) MUST exempt `/api/stripe/webhook` from any auth gating — it is invoked by Stripe servers, never by an authenticated user. Flag this for the Phase 43 plan.
6. Frontmatter must include:
   - `subsystem: billing`
   - `affects: [41-04, 42-02, 43-01, 44-01]`
   - `requires: [41-01]`
   - `key-files: ["app/api/stripe/webhook/route.ts"]`
</output>
