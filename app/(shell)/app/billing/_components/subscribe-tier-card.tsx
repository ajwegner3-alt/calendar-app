"use client";

/**
 * SubscribeTierCard — Client Component (Phase 42.5-05, LD-13/15/18)
 *
 * One of the two Stripe-driven cards in the 3-tier billing grid (Basic + Widget).
 * Submits {tier, interval} to /api/stripe/checkout and redirects the browser to
 * the hosted Checkout URL on success.
 *
 * Invariants preserved from the legacy single tier-selection card (LD-18):
 *   - No `@stripe/stripe-js` (LD-02) — hosted Checkout via window.location.assign.
 *   - No optimistic `subscription_status` write (LD-10) — webhook is canonical.
 *   - Cross-domain redirect uses window.location.assign, NOT router.push.
 *
 * The `interval` is controlled by the parent <TierGrid> so a single global
 * monthly/annual toggle drives both Stripe cards in lockstep.
 *
 * Error handling: the route can return `use_consult_link` if the client tried to
 * subscribe to Branding (only possible via a bug — Branding never renders this
 * card). We intentionally collapse that to the generic `checkout_failed` copy
 * rather than display the raw error code (per plan spec).
 */

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PriceTier, PriceInterval } from "@/lib/stripe/prices";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SubscribeTierCardProps {
  /** 'basic' or 'widget' — drives the POST body and copy. */
  tier: PriceTier;
  /** Controlled by parent TierGrid (single global toggle). */
  interval: PriceInterval;
  /** e.g. "$29/month" — shown when interval = 'monthly'. */
  monthlyLabel: string;
  /** e.g. "$23/month" — shown when interval = 'annual' (headline). */
  annualMonthlyEquivalentLabel: string;
  /** e.g. "$278.40/year" — shown as secondary line on annual. */
  annualTotalLabel: string;
  /** e.g. 20 — used in the "(save N%)" annual sub-line. */
  savingsPct: number;
  /** True for the Widget card — adds "Most popular" badge + default button variant. */
  featured?: boolean;
}

const TIER_COPY: Record<PriceTier, { title: string; description: string }> = {
  basic: {
    title: "Basic",
    description: "Booker access without the embeddable widget.",
  },
  widget: {
    title: "Widget",
    description: "Full booking widget + everything in Basic.",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubscribeTierCard({
  tier,
  interval,
  monthlyLabel,
  annualMonthlyEquivalentLabel,
  annualTotalLabel,
  savingsPct,
  featured = false,
}: SubscribeTierCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, interval }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          // `use_consult_link` is collapsed to `checkout_failed` so we never
          // display the raw enum value — Branding should never reach this card.
          const raw = body.error ?? "checkout_failed";
          setError(raw === "use_consult_link" ? "checkout_failed" : raw);
          return;
        }
        const { url } = (await res.json()) as { url?: string };
        if (url) {
          // Cross-domain redirect to checkout.stripe.com.
          window.location.assign(url);
        } else {
          setError("no_redirect_url");
        }
      } catch {
        setError("network_error");
      }
    });
  };

  const priceLabel =
    interval === "monthly" ? monthlyLabel : annualMonthlyEquivalentLabel;
  const secondaryLabel =
    interval === "annual" ? `${annualTotalLabel} (save ${savingsPct}%)` : null;
  const copy = TIER_COPY[tier];

  return (
    <Card
      className={featured ? "border-primary shadow-md" : undefined}
      data-tier={tier}
    >
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        {featured ? (
          <CardAction>
            <Badge variant="default">Most popular</Badge>
          </CardAction>
        ) : null}
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{priceLabel}</p>
        {secondaryLabel ? (
          <p className="mt-1 text-sm text-muted-foreground">{secondaryLabel}</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Button
          variant={featured ? "default" : "outline"}
          size="lg"
          onClick={handleSubscribe}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          {isPending ? "Redirecting…" : "Subscribe"}
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error === "missing_price_id"
              ? "Pricing not configured — contact support."
              : error === "unknown_tier"
                ? "Unexpected tier value."
                : error === "checkout_failed"
                  ? "Could not start checkout. Try again."
                  : error === "network_error"
                    ? "Network error. Try again."
                    : "Something went wrong."}
          </p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
