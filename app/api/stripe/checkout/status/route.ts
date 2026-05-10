/**
 * GET /api/stripe/checkout/status — Polling endpoint for post-checkout return UX.
 *
 * Purpose: After Stripe redirects the owner to /app/billing?session_id=..., the
 * billing page client-component polls this endpoint every 2s (up to 30s) until
 * subscription_status flips from 'trialing' to 'active'. The webhook is the
 * canonical writer (LD-10); this endpoint is read-only.
 *
 * Critical anti-stale-cache guards (RESEARCH Pitfall 4):
 *   - export const dynamic = "force-dynamic"   → disables Next.js GET cache
 *   - Cache-Control: no-store on every response → disables CDN/browser cache
 *   Without BOTH, the poller can see a stale 'trialing' forever and time out at 30s.
 *
 * Scope: Single-purpose — returns ONLY subscription_status. Does NOT include
 * stripe_customer_id, current_period_end, or any other column. The poller only
 * needs to know when the webhook has flipped status to 'active'.
 *
 * Identity: Auth cookie identifies the account. No session_id query-param check —
 * the session_id in the URL is for forensic/UX framing only (the auth session
 * is sufficient to scope the query).
 *
 * Response shapes:
 *   200 → { subscription_status: string | null }
 *   401 → { error: "unauthorized", subscription_status: null }   no auth session
 *   500 → { error: "db_error",     subscription_status: null }   DB read error
 *          (client treats 500 as transient — continues polling)
 */

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // CRITICAL: disables Next.js GET caching (Pitfall 4)

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(_req: Request) {
  // ── Auth gate ─────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json(
      { error: "unauthorized", subscription_status: null },
      { status: 401, headers: NO_STORE },
    );
  }

  // ── Read subscription_status (RLS-scoped — only authed owner's row) ──────
  const { data: account, error: dbErr } = await supabase
    .from("accounts")
    .select("subscription_status")
    .is("deleted_at", null)
    .maybeSingle();

  if (dbErr) {
    // Transient DB error — client treats 500 as "keep polling" (non-terminal).
    // Do NOT throw; return structured 500 so client can distinguish from network errors.
    console.error("[stripe-checkout-status] db read error", {
      err: dbErr.message,
    });
    return NextResponse.json(
      { error: "db_error", subscription_status: null },
      { status: 500, headers: NO_STORE },
    );
  }

  // CRITICAL: Cache-Control: no-store on the 200 response ensures the poller
  // always reads from DB, never from a cached response (Pitfall 4).
  return NextResponse.json(
    { subscription_status: account?.subscription_status ?? null },
    { headers: NO_STORE },
  );
}
