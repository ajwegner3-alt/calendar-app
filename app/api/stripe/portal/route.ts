/**
 * POST /api/stripe/portal — Create a Stripe Customer Portal session for the authenticated owner.
 *
 * LD-03: Customer Portal owns cancel / update-payment / invoices / plan-switching.
 * Phase 44 (BILL-21, BILL-22): this route is the single entry point for the
 * "Manage Subscription" button on /app/billing.
 *
 * Pitfall 1 (RESEARCH.md): Portal session URLs are short-lived (~5 min). This route
 * MUST be called fresh on every button click; the client MUST NOT cache the URL.
 * Enforced via dynamic='force-dynamic' + Cache-Control: no-store on all responses.
 *
 * Pitfall 2: The Status Card in Plan 44-05 only renders the "Manage Subscription"
 * button when the account is active/cancel_scheduled/past_due (all of which require
 * stripe_customer_id to exist). This route still guards with a 400 if the column is
 * NULL — belt-and-suspenders.
 *
 * V18-CP-09 invariant (ROADMAP verification gate): Portal session URLs are NEVER
 * logged server-side. Logs include account_id + session_id but NOT session.url.
 *
 * Request body (all optional):
 *   { flow?: 'payment_method_update' }
 *   - When flow === 'payment_method_update', adds flow_data to session.create
 *     (past_due deep-link to Stripe's payment-method update page).
 *   - Any other value (or no body) creates a generic portal session (lands on Portal home).
 *
 * Response shapes:
 *   200 → { url: string }                       Portal session URL — client redirects here
 *   401 → { error: 'unauthorized' }             no auth session
 *   404 → { error: 'account_not_found' }        no accounts row for authed user
 *   400 → { error: 'no_stripe_customer' }       account exists but has no stripe_customer_id
 *   500 → { error: 'stripe_error' }             stripe.billingPortal.sessions.create threw
 *   500 → { error: 'no_session_url' }           session created but url is empty (defensive)
 */

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";

// Derive the flow_data parameter type from the SDK function signature itself,
// sidestepping the namespace-merging quirk where Stripe.BillingPortal.SessionCreateParams
// is both an interface and a namespace — TS type-only imports don't always resolve
// the namespace merge under noUncheckedSideEffectImports. This Parameters<>-derived
// approach matches the v22.x SDK exactly and survives version bumps.
type PortalSessionCreateParams = Parameters<
  typeof stripe.billingPortal.sessions.create
>[0];
type PortalFlowData = NonNullable<PortalSessionCreateParams>["flow_data"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(req: Request) {
  // ── 1. Auth gate ─────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    console.log("[stripe-portal] unauthorized request", { outcome: "unauthorized" });
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  // ── 2. Fetch account (RLS-scoped — only the authed owner's row) ──────────
  const { data: account, error: accountErr } = await supabase
    .from("accounts")
    .select("id, stripe_customer_id")
    .is("deleted_at", null)
    .maybeSingle();

  if (accountErr || !account) {
    console.log("[stripe-portal] account not found", {
      err: accountErr?.message,
      outcome: "account_not_found",
    });
    return NextResponse.json(
      { error: "account_not_found" },
      { status: 404, headers: NO_STORE },
    );
  }

  // ── 3. Guard: stripe_customer_id must exist (trialing owners do not have one) ─
  if (!account.stripe_customer_id) {
    console.log("[stripe-portal] no stripe_customer_id on account", {
      account_id: account.id,
      outcome: "no_stripe_customer",
    });
    return NextResponse.json(
      { error: "no_stripe_customer" },
      { status: 400, headers: NO_STORE },
    );
  }

  // ── 4. Parse optional flow body parameter ─────────────────────────────────
  // The Status Card past_due variant (Plan 44-05) POSTs { flow: 'payment_method_update' }
  // to deep-link directly to Stripe's payment-method update page. Any other value
  // (or no body) creates a generic portal session.
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const usePaymentMethodFlow = body.flow === "payment_method_update";

  // Type-safe flow_data construction (RESEARCH.md Pitfall 6).
  const flowData: PortalFlowData | undefined = usePaymentMethodFlow
    ? { type: "payment_method_update" }
    : undefined;

  // ── 5. Derive return URL (mirror checkout route pattern lines 208-213) ────
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  const returnUrl = `${origin}/app/billing`;

  // ── 6. Create Portal session ──────────────────────────────────────────────
  let session: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>;
  try {
    session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: returnUrl,
      ...(flowData ? { flow_data: flowData } : {}),
    });
  } catch (stripeErr) {
    const message =
      stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    console.error("[stripe-portal] stripe.billingPortal.sessions.create failed", {
      account_id: account.id,
      flow: usePaymentMethodFlow ? "payment_method_update" : "generic",
      err: message,
      outcome: "stripe_error",
    });
    return NextResponse.json(
      { error: "stripe_error" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 7. Defensive: session.url should never be empty for a successful create ─
  if (!session.url) {
    console.error("[stripe-portal] portal session created without a redirect URL", {
      account_id: account.id,
      session_id: session.id,
      outcome: "no_session_url",
    });
    return NextResponse.json(
      { error: "no_session_url" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 8. Success ────────────────────────────────────────────────────────────
  // V18-CP-09: do NOT log session.url. account_id + session.id are safe breadcrumbs.
  console.log("[stripe-portal] session created", {
    account_id: account.id,
    session_id: session.id,
    flow: usePaymentMethodFlow ? "payment_method_update" : "generic",
    outcome: "success",
  });

  return NextResponse.json({ url: session.url }, { headers: NO_STORE });
}
