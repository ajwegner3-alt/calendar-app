import "server-only";

/**
 * Centralized 4-SKU pricing config for Phase 42.5 multi-tier model.
 *
 * RULES:
 *   - Reads price IDs and amounts from env vars so PREREQ-E (revised) can finalize values
 *     without code changes. Falls back to placeholder values so the dev server boots
 *     without manual setup (placeholder priceIds are blocked in production — see checkout
 *     route guard).
 *   - The webhook writes plan_interval from Stripe's payload ('month' or 'year') and
 *     derives plan_tier by reverse-lookup against PRICE_ID_TO_TIER (LD-14: no metadata,
 *     no hardcoding).
 *   - Do NOT call stripe.prices.retrieve() at render time — env vars are the source of
 *     truth for amounts. No Stripe API roundtrip on page load.
 *   - savingsPct is computed dynamically from actual amounts — do NOT hardcode a
 *     percentage (e.g., 20%). The final value must reflect PREREQ-E pricing exactly.
 *   - `import "server-only"` directive is mandatory: env vars must NEVER leak to the
 *     client bundle.
 */

export type PriceTier = "basic" | "widget";
export type PriceInterval = "monthly" | "annual";

/**
 * Format cents to a dollar string.
 * Preserves cents when present (e.g., 2999 → "$29.99") so $X.99 pricing displays correctly.
 * When cents portion is exactly 0, omits the decimal (e.g., 2900 → "$29").
 */
function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const basicMonthlyCents = parseInt(process.env.STRIPE_PRICE_BASIC_MONTHLY_CENTS ?? "2900", 10);
const basicAnnualCents = parseInt(process.env.STRIPE_PRICE_BASIC_ANNUAL_CENTS ?? "27840", 10);
const widgetMonthlyCents = parseInt(process.env.STRIPE_PRICE_WIDGET_MONTHLY_CENTS ?? "4900", 10);
const widgetAnnualCents = parseInt(process.env.STRIPE_PRICE_WIDGET_ANNUAL_CENTS ?? "47040", 10);

export const PRICES = {
  basic: {
    monthly: {
      priceId: process.env.STRIPE_PRICE_ID_BASIC_MONTHLY ?? "price_placeholder_basic_monthly",
      amountCents: basicMonthlyCents,
      label: `${dollars(basicMonthlyCents)}/month`,
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_ID_BASIC_ANNUAL ?? "price_placeholder_basic_annual",
      amountCents: basicAnnualCents,
      /** Total billed once per year, e.g. "$278.40/year" */
      totalLabel: `${dollars(basicAnnualCents)}/year`,
      /** Monthly equivalent for headline display, e.g. "$23/month" (rounded) */
      monthlyEquivalentLabel: `${dollars(Math.round(basicAnnualCents / 12))}/month`,
      /**
       * Computed savings vs monthly × 12. Uses Math.max(0, ...) to ensure we never
       * display a negative savings percentage if annual is priced above monthly × 12.
       */
      savingsPct: Math.max(
        0,
        Math.round((1 - basicAnnualCents / (basicMonthlyCents * 12)) * 100),
      ),
    },
  },
  widget: {
    monthly: {
      priceId: process.env.STRIPE_PRICE_ID_WIDGET_MONTHLY ?? "price_placeholder_widget_monthly",
      amountCents: widgetMonthlyCents,
      label: `${dollars(widgetMonthlyCents)}/month`,
    },
    annual: {
      priceId: process.env.STRIPE_PRICE_ID_WIDGET_ANNUAL ?? "price_placeholder_widget_annual",
      amountCents: widgetAnnualCents,
      /** Total billed once per year, e.g. "$470.40/year" */
      totalLabel: `${dollars(widgetAnnualCents)}/year`,
      /** Monthly equivalent for headline display, e.g. "$39/month" (rounded) */
      monthlyEquivalentLabel: `${dollars(Math.round(widgetAnnualCents / 12))}/month`,
      /**
       * Computed savings vs monthly × 12. Uses Math.max(0, ...) to ensure we never
       * display a negative savings percentage if annual is priced above monthly × 12.
       */
      savingsPct: Math.max(
        0,
        Math.round((1 - widgetAnnualCents / (widgetMonthlyCents * 12)) * 100),
      ),
    },
  },
} as const;

/**
 * Reverse-lookup map: Stripe Price ID → plan_tier value.
 * Used by webhook handleCheckoutSessionCompleted to derive plan_tier
 * from listLineItems result (verification gate requirement: no metadata, no hardcoding).
 *
 * MUST contain exactly 4 distinct keys — if any two placeholder strings collide,
 * the map silently aliases and the webhook will write the wrong tier.
 */
export const PRICE_ID_TO_TIER: Record<string, PriceTier> = {
  [PRICES.basic.monthly.priceId]: "basic",
  [PRICES.basic.annual.priceId]: "basic",
  [PRICES.widget.monthly.priceId]: "widget",
  [PRICES.widget.annual.priceId]: "widget",
};

/**
 * Resolve Price ID from tier + interval. Returns the env-driven Price ID
 * or the placeholder if env var is unset (dev/local).
 */
export function getPriceId(tier: PriceTier, interval: PriceInterval): string {
  return PRICES[tier][interval].priceId;
}

/**
 * Derive plan_tier from a Price ID. Returns null for unknown IDs
 * (do NOT throw — let webhook log warning and skip the plan_tier write).
 */
export function priceIdToTier(priceId: string): PriceTier | null {
  return PRICE_ID_TO_TIER[priceId] ?? null;
}
