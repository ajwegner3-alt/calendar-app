import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRICES } from "@/lib/stripe/prices";
import {
  TrialingHeader,
  LockedView,
} from "./_components/billing-state-views";
import { TierGrid, type TierGridProps } from "./_components/tier-grid";
import { CheckoutReturnPoller } from "./_components/checkout-return-poller";
import { StatusCard } from "./_components/status-card";

export const metadata = { title: "Billing | Calendar" };

// ---------------------------------------------------------------------------
// Page-state type — drives conditional render
// ---------------------------------------------------------------------------

type BillingPageState =
  | { type: "polling"; sessionId: string }
  | { type: "active"; planTier: "basic" | "widget" | null; planInterval: string | null; renewalDate: string | null }
  | { type: "cancel_scheduled"; planTier: "basic" | "widget" | null; periodEndDate: string | null }
  | { type: "past_due" }
  | { type: "plan_selection"; trialDaysLeft: number | null }
  | { type: "locked" };

// ---------------------------------------------------------------------------
// deriveTrialDaysLeft — pure helper, no Date.now() inside component body
// ---------------------------------------------------------------------------

function deriveTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil(
      (new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000,
    ),
  );
}

// ---------------------------------------------------------------------------
// formatBillingDate — pure helper (Phase 44 BILL-21/23)
//
// Formats Stripe's ISO timestamps (current_period_end) into a human-readable
// "Month D, YYYY" string for the Status Card. Returns null on null input so
// the StatusCard variants can omit the renewal-date line when the column has
// not yet been hydrated (pre-first-webhook trialing accounts).
// ---------------------------------------------------------------------------

function formatBillingDate(timestamp: string | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// BillingPage — Server Component
// searchParams MUST be awaited (Next 16 invariant — RESEARCH Pitfall 5).
// ---------------------------------------------------------------------------

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  // Auth gate — mirror layout.tsx pattern
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  // Account fetch (RLS-scoped: only the owner's row is returned)
  const { data: account } = await supabase
    .from("accounts")
    .select("id, subscription_status, trial_ends_at, plan_tier, cancel_at_period_end, current_period_end, plan_interval, stripe_customer_id")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  // Await searchParams (Next 16 invariant)
  const { session_id } = await searchParams;

  // ---------------------------------------------------------------------------
  // State derivation — RESEARCH Pattern 7 (Phase 44 extended)
  //
  // Priority order:
  //   1. session_id present                           → polling (Checkout just completed)
  //   2. active && cancel_at_period_end === true      → cancel_scheduled (Pitfall 4:
  //                                                     MUST be checked before generic
  //                                                     active — both share status=active)
  //   3. active                                       → Status Card (active variant)
  //   4. trialing                                     → plan_selection with trial countdown
  //   5. past_due                                     → Status Card (past_due variant)
  //                                                     LD-08: past_due is NOT lockout —
  //                                                     banner only (Phase 43) + payment-
  //                                                     method deep-link card (Phase 44)
  //   6. everything else                              → locked (canceled / unpaid /
  //                                                     incomplete / incomplete_expired).
  //                                                     LD-04: locked states show LockedView
  //                                                     + plan card so owner can re-subscribe
  //                                                     from the same page.
  //
  // Note: account is always non-null here — the redirect() above exits if null,
  // but TypeScript needs the account variable in scope, so we reference it below.
  // ---------------------------------------------------------------------------

  let state: BillingPageState;

  if (session_id) {
    state = { type: "polling", sessionId: session_id };
  } else if (
    account.subscription_status === "active" &&
    account.cancel_at_period_end === true
  ) {
    // Pitfall 4 (state machine priority): cancel_scheduled MUST be checked BEFORE
    // the generic active branch below. Both share subscription_status='active' —
    // only the cancel_at_period_end boolean distinguishes them. If the order were
    // reversed, the green Active card would render even for owners who scheduled
    // cancellation in the Stripe Portal (silent UX bug).
    state = {
      type: "cancel_scheduled",
      planTier: account.plan_tier as "basic" | "widget" | null,
      periodEndDate: formatBillingDate(account.current_period_end),
    };
  } else if (account.subscription_status === "active") {
    state = {
      type: "active",
      planTier: account.plan_tier as "basic" | "widget" | null,
      planInterval: account.plan_interval,
      renewalDate: formatBillingDate(account.current_period_end),
    };
  } else if (account.subscription_status === "trialing") {
    // Compute days remaining. If trial_ends_at is NULL we cannot compute a
    // numeric countdown — deriveTrialDaysLeft returns null so TrialingHeader
    // renders the fallback "Your trial is active" copy (LD-09 invariant).
    const trialDaysLeft = deriveTrialDaysLeft(account.trial_ends_at);
    state = { type: "plan_selection", trialDaysLeft };
  } else if (account.subscription_status === "past_due") {
    // Phase 44 (BILL-22): past_due now gets its own Status Card variant with
    // payment-method deep-link. Previously fell into plan_selection (Phase 42.5).
    // LD-08 invariant still honored — past_due is NOT a lockout, just a friendly
    // amber card surfacing the Portal's payment-method-update flow.
    state = { type: "past_due" };
  } else {
    // canceled / unpaid / incomplete / incomplete_expired → locked
    // Owner still needs a path to re-subscribe (plan card renders below LockedView).
    state = { type: "locked" };
  }

  // ---------------------------------------------------------------------------
  // Pricing + tier-grid props — server-side from PRICES (env-var-driven,
  // no Stripe API call). Phase 42.5 multi-tier shape — see lib/stripe/prices.ts
  // for the nested {basic,widget}.{monthly,annual} structure.
  //
  // brandingBookingUrl is read here (server boundary) per LD-16: env var must
  // NEVER leak to the client bundle. ConsultTierCard receives the resolved URL
  // as a prop. The hardcoded fallback matches the Calendly/booking destination
  // documented in LD-16 so the dev server boots even without .env.local.
  // ---------------------------------------------------------------------------

  const brandingBookingUrl =
    process.env.NSI_BRANDING_BOOKING_URL ??
    "https://booking.nsintegrations.com/nsi/branding-consultation";

  const tierGridProps: TierGridProps = {
    basicMonthlyLabel: PRICES.basic.monthly.label,
    basicAnnualMonthlyEquivalentLabel:
      PRICES.basic.annual.monthlyEquivalentLabel,
    basicAnnualTotalLabel: PRICES.basic.annual.totalLabel,
    basicSavingsPct: PRICES.basic.annual.savingsPct,
    widgetMonthlyLabel: PRICES.widget.monthly.label,
    widgetAnnualMonthlyEquivalentLabel:
      PRICES.widget.annual.monthlyEquivalentLabel,
    widgetAnnualTotalLabel: PRICES.widget.annual.totalLabel,
    widgetSavingsPct: PRICES.widget.annual.savingsPct,
    brandingBookingUrl,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (state.type === "polling") {
    return (
      <div className="container mx-auto max-w-2xl py-8 space-y-6">
        <CheckoutReturnPoller sessionId={state.sessionId} />
      </div>
    );
  }

  if (state.type === "active") {
    return (
      <div className="container mx-auto max-w-2xl py-8 space-y-6">
        <StatusCard
          variant="active"
          planTier={state.planTier}
          planInterval={state.planInterval}
          renewalDate={state.renewalDate}
        />
      </div>
    );
  }

  if (state.type === "cancel_scheduled") {
    return (
      <div className="container mx-auto max-w-2xl py-8 space-y-6">
        <StatusCard
          variant="cancel_scheduled"
          planTier={state.planTier}
          periodEndDate={state.periodEndDate}
        />
      </div>
    );
  }

  if (state.type === "past_due") {
    return (
      <div className="container mx-auto max-w-2xl py-8 space-y-6">
        <StatusCard variant="past_due" />
      </div>
    );
  }

  if (state.type === "plan_selection") {
    return (
      // max-w-5xl (1024px) widens the container for the 3-card grid so that
      // md:grid-cols-3 actually renders three columns at desktop breakpoints
      // — the legacy max-w-2xl (672px) fit the previous single tier-selection
      // card and would compress the new grid below the 1024px-no-scroll gate.
      <div className="container mx-auto max-w-5xl py-8 space-y-6">
        {/* Trial countdown ONLY for trialing accounts. past_due falls into
            plan_selection too but does NOT get the TrialingHeader.
            Gate on raw subscription_status, not trialDaysLeft, so that
            trialing accounts with NULL trial_ends_at still render the
            fallback "Your trial is active" sub-line (CONTEXT always-render lock). */}
        {account.subscription_status === "trialing" && (
          <TrialingHeader daysLeft={state.trialDaysLeft} />
        )}
        <TierGrid {...tierGridProps} />
      </div>
    );
  }

  // locked state — show the tonal anchor + plan grid for re-subscribe path
  // max-w-5xl: same rationale as the plan_selection branch above (3-card grid).
  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <LockedView />
      <TierGrid {...tierGridProps} />
    </div>
  );
}
