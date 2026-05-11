/**
 * POST /api/stripe/webhook — Stripe lifecycle event handler.
 *
 * V18-CP-01: The raw request body MUST be read via `await req.text()` — NEVER
 * the JSON body-reader variant. Stripe signature verification requires byte-identical
 * body bytes; JSON-parsing destroys that guarantee (different whitespace normalisation).
 *
 * Idempotency: enforced via the `stripe_webhook_events` table. Every verified
 * event is upserted with onConflict='stripe_event_id' + ignoreDuplicates=true
 * before routing. Duplicate delivery returns 200 immediately without re-processing.
 */

import { headers } from "next/headers";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe/client";
import { priceIdToTier } from "@/lib/stripe/prices";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // V18-CP-01: signature verification requires byte-identical body. Use req.text() — NEVER the JSON reader.
  const body = await req.text();

  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  if (!signature) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    console.error("[stripe-webhook] missing signature", { ip, ts: new Date().toISOString() });
    return new Response("missing_signature", { status: 400, headers: NO_STORE });
  }

  // ── Signature verification ───────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed", {
      ip,
      ts: new Date().toISOString(),
      err: message,
    });
    return new Response("signature_failed", { status: 400, headers: NO_STORE });
  }

  // ── Create admin client + dedupe upsert ──────────────────────────────────
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

  if (dedupeErr) {
    console.error("[stripe-webhook] dedupe upsert failed", {
      stripe_event_id: event.id,
      event_type: event.type,
      err: dedupeErr.message,
    });
    return new Response("dedupe_error", { status: 500, headers: NO_STORE });
  }

  if (dedupeRow == null) {
    // event.id already existed in stripe_webhook_events — this is a duplicate delivery.
    console.log("[stripe-webhook] duplicate event skipped", {
      stripe_event_id: event.id,
      event_type: event.type,
      outcome: "duplicate",
    });
    return new Response("ok_duplicate", { status: 200, headers: NO_STORE });
  }

  // ── Per-event routing ────────────────────────────────────────────────────
  let accountId: string | null = null;
  let stripeSubscriptionId: string | null = null;
  let outcome = "handled";

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await handleSubscriptionEvent(admin, event.type, sub);
        accountId = result.accountId;
        stripeSubscriptionId = sub.id;
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const result = await handleInvoiceEvent(admin, event.type, invoice);
        accountId = result.accountId;
        stripeSubscriptionId = result.stripeSubscriptionId;
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const result = await handleCheckoutSessionCompleted(admin, session);
        accountId = result.accountId;
        stripeSubscriptionId = null; // subscription ID arrives via customer.subscription.created
        break;
      }

      default: {
        outcome = "unknown";
        console.log("[stripe-webhook] unhandled event type (audit preserved)", {
          stripe_event_id: event.id,
          event_type: event.type,
        });
        break;
      }
    }
  } catch (err) {
    // DB-write failure after dedupe insert — delete the dedupe row so Stripe
    // will retry and we can reprocess cleanly on the next attempt.
    await admin
      .from("stripe_webhook_events")
      .delete()
      .eq("stripe_event_id", event.id);

    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] handler error — dedupe row rolled back", {
      stripe_event_id: event.id,
      event_type: event.type,
      err: message,
    });
    return new Response("handler_error", { status: 500, headers: NO_STORE });
  }

  console.log("[stripe-webhook] event processed", {
    stripe_event_id: event.id,
    event_type: event.type,
    account_id: accountId,
    stripe_subscription_id: stripeSubscriptionId,
    outcome,
  });

  return new Response("ok", { status: 200, headers: NO_STORE });
}

// ── handleSubscriptionEvent ──────────────────────────────────────────────────
// Handles customer.subscription.{created,updated,deleted,trial_will_end}.
// Writes a single-row atomic UPDATE to accounts.
// V18-CP-11: subscription_status is read from sub.status (payload), NOT
// inferred from event_type — handles out-of-order event delivery correctly.

async function handleSubscriptionEvent(
  admin: SupabaseClient,
  eventType: string,
  sub: Stripe.Subscription,
): Promise<{ accountId: string | null }> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: account, error: lookupErr } = await admin
    .from("accounts")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[stripe-webhook] account lookup failed", {
      customerId,
      err: lookupErr.message,
    });
    throw new Error("account_lookup_db_error");
  }
  if (!account) {
    console.error("[stripe-webhook] no account for customer", {
      customerId,
      eventType,
    });
    throw new Error("account_not_found");
  }

  const updates: Record<string, unknown> = {};

  if (eventType === "customer.subscription.trial_will_end") {
    updates.trial_warning_sent_at = new Date().toISOString();
  } else {
    updates.subscription_status = sub.status; // CONTEXT-locked: trust payload status, NOT event type (V18-CP-11)
    updates.stripe_subscription_id = sub.id;
    // In Stripe API 2026-04-22.dahlia, current_period_end moved from Subscription to SubscriptionItem.
    // Read it from the first item — that's the canonical billing period boundary for single-price subscriptions.
    const periodEnd = sub.items.data[0]?.current_period_end ?? null;
    updates.current_period_end = periodEnd
      ? new Date(periodEnd * 1000).toISOString() // Stripe gives Unix SECONDS — multiply by 1000
      : null;
    updates.plan_interval =
      sub.items.data[0]?.price.recurring?.interval ?? null;
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
}

// ── handleInvoiceEvent ───────────────────────────────────────────────────────
// Handles invoice.payment_succeeded and invoice.payment_failed.
// Derives subscription_status from event outcome:
//   invoice.payment_succeeded → 'active'
//   invoice.payment_failed    → 'past_due'
// (No Stripe API roundtrip — avoids extra latency + failure mode.)

async function handleInvoiceEvent(
  admin: SupabaseClient,
  eventType: string,
  invoice: Stripe.Invoice,
): Promise<{ accountId: string | null; stripeSubscriptionId: string | null }> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  // In Stripe API 2026-04-22.dahlia, invoice.subscription moved to invoice.parent.subscription_details.subscription.
  const rawSub = invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId =
    typeof rawSub === "string"
      ? rawSub
      : rawSub?.id ?? null;

  if (!customerId) {
    console.error("[stripe-webhook] invoice has no customer", {
      eventType,
      invoiceId: invoice.id,
    });
    throw new Error("invoice_no_customer");
  }

  const { data: account, error: lookupErr } = await admin
    .from("accounts")
    .select("id, stripe_subscription_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (lookupErr || !account) {
    console.error("[stripe-webhook] no account for invoice customer", {
      customerId,
      eventType,
    });
    throw new Error("account_not_found");
  }

  // Invoice events: payment_succeeded => 'active', payment_failed => 'past_due'.
  // CONTEXT says "update subscription_status per payload" — interpret as: derive from event outcome.
  // Do NOT make a Stripe API roundtrip to retrieve subscription status (latency + extra failure mode).
  const newStatus =
    eventType === "invoice.payment_succeeded" ? "active" : "past_due";

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

// ── handleCheckoutSessionCompleted ──────────────────────────────────────────
// SC-5 safety net: if 42-01's checkout route failed to write stripe_customer_id
// before redirect, this handler corrects it using session.client_reference_id
// (= account.id, set in 42-01's session.create call) to find the account.
//
// Idempotent: the .is("stripe_customer_id", null) conditional UPDATE means this
// is a no-op when the column is already populated (the common case — 42-01's
// pre-create write succeeded for the same session).
//
// LD-10: does NOT write billing status columns — those come from subscription.*
// and invoice.* events only (canonical source of truth per LD-10 + Phase 41 carry).

async function handleCheckoutSessionCompleted(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<{ accountId: string | null }> {
  const accountId = session.client_reference_id;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  if (!accountId) {
    // Defensive — if 42-01 ever sends a session without client_reference_id, log + skip.
    // Don't throw (would trigger Stripe retry loop with no path to recovery).
    console.warn("[stripe-webhook] checkout.session.completed missing client_reference_id", {
      sessionId: session.id,
    });
    return { accountId: null };
  }

  if (!stripeCustomerId) {
    console.warn("[stripe-webhook] checkout.session.completed missing customer", {
      sessionId: session.id,
      accountId,
    });
    return { accountId };
  }

  // Conditional update — only writes if column is still NULL (idempotent / race-safe).
  const { error: writeErr } = await admin
    .from("accounts")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", accountId)
    .is("stripe_customer_id", null);

  if (writeErr) {
    // Don't throw — this is a safety net, not the primary write. Log and let the
    // subscription event handler proceed; it can resolve via the customer ID
    // that was likely already written by 42-01.
    console.error("[stripe-webhook] checkout.session.completed write failed", {
      sessionId: session.id,
      accountId,
      stripeCustomerId,
      err: writeErr.message,
    });
  }

  // === Phase 42.5: derive plan_tier from line items ===
  // The checkout.session.completed event payload does NOT include line_items by default
  // (field is `line_items?: ApiList<LineItem>` — optional, absent unless explicitly fetched).
  // Stripe's official fulfillment docs require this listLineItems call to access them.
  // The ROADMAP verification gate explicitly forbids metadata-based or hardcoded tier inference.

  let lineItems: Stripe.ApiList<Stripe.LineItem>;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 1,
      expand: ["data.price"],
    });
  } catch (err) {
    // Stripe API failure — throw so dedupe row rolls back + Stripe retries the entire event.
    // The stripe_customer_id write above is idempotent on retry (.is('stripe_customer_id', null) guard).
    console.error("[stripe-webhook] checkout.session.completed: listLineItems failed", {
      sessionId: session.id,
      accountId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error("listLineItems_failed");
  }

  const priceId = lineItems.data[0]?.price?.id ?? null;
  const planTier = priceId ? priceIdToTier(priceId) : null;

  if (!planTier) {
    // Unknown/unmapped Price ID — log a clear warning and skip plan_tier write.
    // The subscription will still transition to active via subsequent events;
    // plan_tier remains NULL (Phase 42.6 gating treats NULL as trialing — allowed access).
    // This is non-fatal: do NOT throw, return 200 to Stripe.
    console.warn("[stripe-webhook] checkout.session.completed: could not derive plan_tier", {
      sessionId: session.id,
      priceId,
      accountId,
    });
  } else {
    const { error: tierWriteErr } = await admin
      .from("accounts")
      .update({ plan_tier: planTier })
      .eq("id", accountId);

    if (tierWriteErr) {
      // DB write failure — throw so dedupe rolls back and Stripe retries.
      // UPDATE is idempotent (writing the same plan_tier value twice is harmless).
      console.error("[stripe-webhook] checkout.session.completed: plan_tier write failed", {
        sessionId: session.id,
        accountId,
        planTier,
        error: tierWriteErr.message,
      });
      throw new Error("plan_tier_write_failed");
    }

    console.log("[stripe-webhook] checkout.session.completed: plan_tier set", {
      sessionId: session.id,
      accountId,
      priceId,
      planTier,
    });
  }

  return { accountId };
}
