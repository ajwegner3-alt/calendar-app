"use client";

/**
 * PlanSelectionCard — Client Component
 *
 * Renders the monthly/annual toggle + Subscribe button.
 * Annual is pre-selected on first load (CONTEXT decision).
 *
 * Subscribe handler: POST /api/stripe/checkout → window.location.href redirect.
 * No @stripe/stripe-js (LD-02 — hosted Checkout only).
 * No router.push for the Stripe redirect — uses window.location.href (cross-domain).
 * No optimistic subscription_status update (LD-10 — webhook is canonical).
 */

import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlanSelectionCardProps {
  /** e.g. "$29/month" */
  monthlyLabel: string;
  /** e.g. "$232/year" */
  annualTotalLabel: string;
  /** e.g. "$19/month" — the prominent annual-tab label per CONTEXT */
  annualMonthlyEquivalentLabel: string;
  /** e.g. 20 — rendered as "Save 20%" badge (never hardcoded) */
  savingsPct: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlanSelectionCard({
  monthlyLabel,
  annualTotalLabel,
  annualMonthlyEquivalentLabel,
  savingsPct,
}: PlanSelectionCardProps) {
  // Annual pre-selected on first load (CONTEXT decision — nudges higher LTV)
  const [intervalChoice, setIntervalChoice] = useState<"monthly" | "annual">(
    "annual",
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Subscribe handler — POST /api/stripe/checkout → browser redirect to Stripe
  // -------------------------------------------------------------------------

  function handleSubscribe() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval: intervalChoice }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          setError("Something went wrong. Please try again.");
          return;
        }
        // cross-domain redirect to checkout.stripe.com — must use window.location
        // (NOT router.push, which only handles same-origin navigation).
        window.location.href = data.url;
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Interval toggle */}
        <Tabs
          value={intervalChoice}
          onValueChange={(v) => setIntervalChoice(v as "monthly" | "annual")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual" className="gap-2">
              Annual
              <Badge variant="default">Save {savingsPct}%</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Price display — prominent monthly-equivalent for annual, single label for monthly */}
        <div className="text-center">
          {intervalChoice === "annual" ? (
            <>
              <p className="text-3xl font-bold">
                {annualMonthlyEquivalentLabel}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ({annualTotalLabel} billed annually)
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold">{monthlyLabel}</p>
          )}
        </div>

        {/* Inline error */}
        {error && (
          <p className="text-sm text-destructive text-center" role="alert">
            {error}
          </p>
        )}

        {/* Subscribe CTA */}
        <Button
          onClick={handleSubscribe}
          disabled={isPending}
          size="lg"
          className="w-full"
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isPending ? "Redirecting…" : "Subscribe"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Cancel anytime. Secure checkout via Stripe.
        </p>
      </CardContent>
    </Card>
  );
}
