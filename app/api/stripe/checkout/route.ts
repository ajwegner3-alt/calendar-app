/**
 * POST /api/stripe/checkout — Create a Stripe Checkout Session for plan subscription.
 *
 * SC-5 closure: Writes stripe_customer_id to accounts BEFORE returning the session URL,
 * ensuring subscription webhooks (customer.subscription.*) can always resolve the account
 * via stripe_customer_id. Passes client_reference_id=account.id as belt-and-suspenders
 * for the webhook's checkout.session.completed handler (42-02).
 *
 * LD-10 invariant: MUST NOT write subscription_status or plan_interval — these are
 * written exclusively by the webhook (canonical source of truth per Phase 41 carry).
 *
 * Race safety: Customer ID write uses conditional update (.is("stripe_customer_id", null))
 * so concurrent "Subscribe" clicks don't orphan multiple Stripe Customers (Pitfall 2).
 * If the race is lost, re-fetches the winner's customer ID.
 *
 * Pitfall 9: MUST NOT pass subscription_data.trial_end — trial is app-side only.
 * Stripe charges immediately on checkout completion; subscription_status flips from
 * 'trialing' to 'active' via webhook on invoice.payment_succeeded.
 *
 * Request body (Phase 42.5):
 *   { tier: 'basic' | 'widget' | 'branding', interval: 'monthly' | 'annual' }
 *
 * Response shapes:
 *   200 → { url: string }                         checkout.stripe.com URL
 *   400 → { error: "use_consult_link" }           tier=branding (LD-16: consult CTA, not Stripe)
 *   400 → { error: "unknown_tier" }               tier missing or not 'basic'|'widget'|'branding'
 *   400 → { error: "missing_price_id" }           placeholder price in production
 *   401 → { error: "unauthorized" }               no auth session
 *   404 → { error: "account_not_found" }          no accounts row for authed user
 *   500 → { error: "no_session_url" | "stripe_error" | "db_error" }
 */

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import {
  getPriceId,
  type PriceInterval,
  type PriceTier,
} from "@/lib/stripe/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // ── 1. Auth gate ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    console.log("[stripe-checkout] unauthorized request", { outcome: "unauthorized" });
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  // ── 2. Fetch account (RLS-scoped — only the authed owner's row) ──────────
  // Account lookup runs BEFORE body parsing per plan invariant: existing
  // auth (401) and account-not-found (404) checks must still fire before tier
  // validation (LD-18: Phase 42 plumbing preserved).
  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id, owner_email, stripe_customer_id")
    .is("deleted_at", null)
    .maybeSingle();

  if (accountErr || !account) {
    console.log("[stripe-checkout] account not found", {
      err: accountErr?.message,
      outcome: "account_not_found",
    });
    return NextResponse.json(
      { error: "account_not_found" },
      { status: 404, headers: NO_STORE },
    );
  }

  const accountId = account.id;

  // ── 3. Parse body + resolve price ────────────────────────────────────────
  // Body shape (Phase 42.5): { tier: 'basic' | 'widget' | 'branding', interval: 'monthly' | 'annual' }
  // Order of validations: auth (401, above) → account (404, above) → branding-reject (400)
  // → unknown-tier-reject (400) → placeholder-price-reject (400 in prod) → stripe call.
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const rawTier = body?.tier;
  const rawInterval = body?.interval;

  // Reject Branding tier immediately — it uses the consult link (LD-16), not Stripe.
  // The UI should never POST this; if it does, we surface a stable error code so
  // the client can route the user to the consult booking URL.
  if (rawTier === "branding") {
    console.log("[stripe-checkout] branding tier rejected", {
      account_id: accountId,
      outcome: "use_consult_link",
    });
    return NextResponse.json(
      { error: "use_consult_link" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Validate tier is one of the two Stripe-backed tiers.
  if (rawTier !== "basic" && rawTier !== "widget") {
    console.log("[stripe-checkout] unknown tier rejected", {
      account_id: accountId,
      rawTier,
      outcome: "unknown_tier",
    });
    return NextResponse.json(
      { error: "unknown_tier" },
      { status: 400, headers: NO_STORE },
    );
  }
  const tier: PriceTier = rawTier;
  const interval: PriceInterval = rawInterval === "annual" ? "annual" : "monthly";

  const priceId = getPriceId(tier, interval);

  // Production safety net: reject placeholder price IDs so a misconfigured
  // production env doesn't create broken Checkout sessions.
  if (
    priceId.startsWith("price_placeholder_") &&
    process.env.NODE_ENV === "production"
  ) {
    console.log("[stripe-checkout] placeholder priceId in production", {
      account_id: accountId,
      tier,
      interval,
      priceId,
      outcome: "missing_price_id",
    });
    return NextResponse.json(
      { error: "missing_price_id" },
      { status: 400, headers: NO_STORE },
    );
  }

  // ── 4. Stripe Customer upsert (SC-5 closure — RESEARCH Pitfall 1 + 2) ───
  // If the account already has a customer ID, reuse it (idempotent subscribe).
  // Otherwise, create a new Stripe Customer, then write it to accounts using
  // a conditional UPDATE (.is("stripe_customer_id", null)) — race-safe.
  let customerId = account.stripe_customer_id;

  if (!customerId) {
    let newCustomerId: string;
    try {
      const customer = await stripe.customers.create({
        email: account.owner_email ?? undefined,
        metadata: { account_id: accountId },
      });
      newCustomerId = customer.id;
    } catch (stripeErr) {
      const message =
        stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      console.error("[stripe-checkout] stripe.customers.create failed", {
        account_id: accountId,
        err: message,
        outcome: "stripe_error",
      });
      return NextResponse.json(
        { error: "stripe_error" },
        { status: 500, headers: NO_STORE },
      );
    }

    // Conditional update — only writes if stripe_customer_id is still NULL.
    // If the race is lost (another concurrent request already wrote a customer ID),
    // this returns an error and we re-fetch the winner's value.
    const admin = createAdminClient();
    const { error: writeErr } = await admin
      .from("accounts")
      .update({ stripe_customer_id: newCustomerId })
      .eq("id", accountId)
      .is("stripe_customer_id", null);

    if (writeErr) {
      // Race lost: re-fetch the winner's stripe_customer_id and use it.
      // The orphaned newCustomerId is left in Stripe — Phase 44 cleanup concern, out of scope.
      const { data: refetched, error: refetchErr } = await admin
        .from("accounts")
        .select("stripe_customer_id")
        .eq("id", accountId)
        .maybeSingle();

      if (refetchErr || !refetched?.stripe_customer_id) {
        console.error("[stripe-checkout] race re-fetch failed", {
          account_id: accountId,
          writeErr: writeErr.message,
          refetchErr: refetchErr?.message,
          outcome: "db_error",
        });
        return NextResponse.json(
          { error: "db_error" },
          { status: 500, headers: NO_STORE },
        );
      }
      customerId = refetched.stripe_customer_id;
    } else {
      customerId = newCustomerId;
    }
  }

  // ── 5. Derive origin for success/cancel URLs ──────────────────────────────
  // Pattern mirrored from app/api/bookings/route.ts resolveAppUrl() lines ~76-83.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  // ── 6. Create Checkout Session ────────────────────────────────────────────
  // MUST NOT pass subscription_data.trial_end (Pitfall 9 — trial is app-side only).
  // MUST NOT pass customer_creation (invalid in subscription mode per RESEARCH State of the Art).
  // MUST NOT write subscription_status or plan_interval (LD-10).
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      // belt-and-suspenders for checkout.session.completed webhook handler (42-02)
      client_reference_id: accountId,
      line_items: [{ price: priceId, quantity: 1 }],
      // Debug breadcrumb only — webhook tier-derivation (42.5-04) uses Price ID
      // reverse-lookup against PRICE_ID_TO_TIER, NOT this metadata field.
      metadata: { accountId, tier, interval },
      success_url: `${origin}/app/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/billing`,
    });
  } catch (stripeErr) {
    const message =
      stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.error("[stripe-checkout] stripe.checkout.sessions.create failed", {
      account_id: accountId,
      customer_id: customerId,
      tier,
      interval,
      err: message,
      outcome: "stripe_error",
    });
    return NextResponse.json(
      { error: "stripe_error" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 7. Validate session.url (RESEARCH Pitfall 3) ─────────────────────────
  // session.url is null when ui_mode is 'embedded' (not our case) or on SDK error.
  if (!session.url) {
    console.error("[stripe-checkout] session.url is null", {
      account_id: accountId,
      customer_id: customerId,
      session_id: session.id,
      tier,
      interval,
      outcome: "no_session_url",
    });
    return NextResponse.json(
      { error: "no_session_url" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 8. Success ────────────────────────────────────────────────────────────
  console.log("[stripe-checkout] session created", {
    account_id: accountId,
    customer_id: customerId,
    session_id: session.id,
    tier,
    interval,
    outcome: "success",
  });

  return NextResponse.json({ url: session.url }, { headers: NO_STORE });
}
