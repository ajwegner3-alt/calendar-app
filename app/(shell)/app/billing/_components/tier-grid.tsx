"use client";

/**
 * TierGrid — Client Component (Phase 42.5-05, LD-13/15/16/18)
 *
 * The 3-card layout that replaces the legacy single tier-selection card:
 *   [ Basic ]  [ Widget — Most popular ]  [ Branding ]
 *
 * Owns the single global Monthly/Annual toggle that drives BOTH Stripe cards in
 * lockstep. Branding is interval-agnostic and ignores the toggle (it's a static
 * consult link per LD-16).
 *
 * Default toggle value = "annual" — annual is the "headline savings" tab and
 * matches the legacy single-card default to preserve return-flow expectations.
 *
 * Layout:
 *   - `grid-cols-1 md:grid-cols-3` satisfies the 1024px-no-scroll verification
 *     gate (md = 768px breakpoint, so 1024px renders 3 columns).
 *   - On mobile (<768px) the cards stack vertically.
 */

// React's default export ships `useState`, but we deliberately import the named
// hook so the interval-state hook line isn't shadowed by the global setInterval.
import { useState as useReactState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SubscribeTierCard } from "./subscribe-tier-card";
import { ConsultTierCard } from "./consult-tier-card";
import type { PriceInterval } from "@/lib/stripe/prices";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TierGridProps {
  basicMonthlyLabel: string;
  basicAnnualMonthlyEquivalentLabel: string;
  basicAnnualTotalLabel: string;
  basicSavingsPct: number;
  widgetMonthlyLabel: string;
  widgetAnnualMonthlyEquivalentLabel: string;
  widgetAnnualTotalLabel: string;
  widgetSavingsPct: number;
  brandingBookingUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TierGrid({
  basicMonthlyLabel,
  basicAnnualMonthlyEquivalentLabel,
  basicAnnualTotalLabel,
  basicSavingsPct,
  widgetMonthlyLabel,
  widgetAnnualMonthlyEquivalentLabel,
  widgetAnnualTotalLabel,
  widgetSavingsPct,
  brandingBookingUrl,
}: TierGridProps) {
  const [interval, setIntervalChoice] =
    useReactState<PriceInterval>("annual");
  const maxSavings = Math.max(basicSavingsPct, widgetSavingsPct);

  return (
    <div className="space-y-6">
      {/* Global monthly/annual toggle — drives both Stripe cards. */}
      <div className="flex justify-center">
        <Tabs
          value={interval}
          onValueChange={(v) => setIntervalChoice(v as PriceInterval)}
        >
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual" className="gap-2">
              Annual
              {maxSavings > 0 ? (
                <Badge variant="secondary">Save up to {maxSavings}%</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 3-card grid. md:grid-cols-3 satisfies the 1024px-no-scroll gate. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <SubscribeTierCard
          tier="basic"
          interval={interval}
          monthlyLabel={basicMonthlyLabel}
          annualMonthlyEquivalentLabel={basicAnnualMonthlyEquivalentLabel}
          annualTotalLabel={basicAnnualTotalLabel}
          savingsPct={basicSavingsPct}
        />
        <SubscribeTierCard
          tier="widget"
          interval={interval}
          monthlyLabel={widgetMonthlyLabel}
          annualMonthlyEquivalentLabel={widgetAnnualMonthlyEquivalentLabel}
          annualTotalLabel={widgetAnnualTotalLabel}
          savingsPct={widgetSavingsPct}
          featured
        />
        <ConsultTierCard bookingUrl={brandingBookingUrl} />
      </div>
    </div>
  );
}
