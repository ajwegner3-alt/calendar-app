import "server-only";

/**
 * Centralized pricing config for Phase 42 plan-selection UI + Checkout session creation.
 *
 * RULES:
 *   - Reads price IDs and amounts from env vars so PREREQ-E can finalize values
 *     without code changes. Falls back to placeholder values so the dev server boots
 *     without manual setup (placeholder priceIds are blocked in production — see checkout
 *     route guard).
 *   - The webhook writes plan_interval from Stripe's payload ('month' or 'year').
 *     This file is for UI display + Checkout session creation only — NEVER for writing
 *     subscription_status or plan_interval (LD-10).
 *   - Do NOT call stripe.prices.retrieve() at render time — env vars are the source of
 *     truth for amounts (RESEARCH Open Question 1). No Stripe API roundtrip on page load.
 *   - savingsPct is computed dynamically from actual amounts — do NOT hardcode a
 *     percentage (e.g., 20%). The final value must reflect PREREQ-E pricing exactly.
 */

const monthlyCents = parseInt(process.env.STRIPE_PRICE_MONTHLY_CENTS ?? "2900", 10);
const annualCents = parseInt(process.env.STRIPE_PRICE_ANNUAL_CENTS ?? "27840", 10);

/**
 * Format cents to a dollar string.
 * Preserves cents when present (e.g., 2999 → "$29.99") so $X.99 pricing displays correctly.
 * When cents portion is exactly 0, omits the decimal (e.g., 2900 → "$29").
 */
function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export const PRICES = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_ID_MONTHLY ?? "price_placeholder_monthly",
    amountCents: monthlyCents,
    label: `${dollars(monthlyCents)}/month`,
  },
  annual: {
    priceId: process.env.STRIPE_PRICE_ID_ANNUAL ?? "price_placeholder_annual",
    amountCents: annualCents,
    /** Total billed once per year, e.g. "$232/year" */
    totalLabel: `${dollars(annualCents)}/year`,
    /** Monthly equivalent for headline display, e.g. "$19/month" (rounded) */
    monthlyEquivalentLabel: `${dollars(Math.round(annualCents / 12))}/month`,
    /**
     * Computed savings vs monthly × 12. Uses Math.max(0, ...) to ensure we never
     * display a negative savings percentage if annual is priced above monthly × 12
     * (edge case guard). Do NOT hardcode — must match actual PREREQ-E amounts.
     */
    savingsPct: Math.max(
      0,
      Math.round((1 - annualCents / (monthlyCents * 12)) * 100),
    ),
  },
} as const;

export type PriceInterval = "monthly" | "annual";
