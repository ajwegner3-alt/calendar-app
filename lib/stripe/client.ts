import "server-only";
import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * RULES:
 *   - Import ONLY from server code (Route Handlers, Server Actions, Server Components).
 *     The `import "server-only"` at top throws at bundle time on client import.
 *   - Singleton at module scope — the Stripe SDK maintains an internal HTTP agent
 *     with keep-alive. Re-instantiating per request would burn TCP handshakes.
 *     This is OPPOSITE to lib/supabase/admin.ts (no singleton due to Fluid compute
 *     Postgres connection pooling) because the Stripe SDK has no per-request
 *     session state — it's just a typed fetch wrapper.
 *   - apiVersion is pinned to '2026-04-22.dahlia' — the version that ships with
 *     SDK 22.x. NEVER omit apiVersion (V18-CP-08 — webhook schema breaks on
 *     Stripe's next API release if apiVersion is unpinned).
 *   - Test/live key switching is automatic via the STRIPE_SECRET_KEY env var,
 *     which is set per Vercel environment (sk_test_* in preview, sk_live_* in
 *     production). Never inspect the prefix in code — that would lock dev to
 *     test mode and confuse the live cutover (V18-CP-03).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});
