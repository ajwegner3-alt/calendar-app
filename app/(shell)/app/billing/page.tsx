import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRICES } from "@/lib/stripe/prices";
import {
  TrialingHeader,
  ActiveView,
  LockedView,
} from "./_components/billing-state-views";
import { PlanSelectionCard } from "./_components/plan-selection-card";
import { CheckoutReturnPoller } from "./_components/checkout-return-poller";

export const metadata = { title: "Billing | Calendar" };

// ---------------------------------------------------------------------------
// Page-state type — drives conditional render
// ---------------------------------------------------------------------------

type BillingPageState =
  | { type: "polling"; sessionId: string }
  | { type: "active" }
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
    .select("id, subscription_status, trial_ends_at")
    .is("deleted_at", null)
    .maybeSingle();

  if (!account) redirect("/app/unlinked");

  // Await searchParams (Next 16 invariant)
  const { session_id } = await searchParams;

  // ---------------------------------------------------------------------------
  // State derivation — RESEARCH Pattern 7
  //
  // Priority order:
  //   1. session_id present  → polling state (Checkout just completed)
  //   2. active              → show ActiveView (no plan card needed)
  //   3. trialing            → plan_selection with trial countdown
  //   4. past_due            → plan_selection (no trial header, allow re-subscribe)
  //                            LD-08: past_due is NOT lockout — banner only (Phase 43)
  //   5. everything else     → locked (canceled / unpaid / incomplete / incomplete_expired)
  //                            LD-04: locked states show LockedView + plan card so owner
  //                            can re-subscribe from the same page
  //
  // Note: account is always non-null here — the redirect() above exits if null,
  // but TypeScript needs the account variable in scope, so we reference it below.
  // ---------------------------------------------------------------------------

  let state: BillingPageState;

  if (session_id) {
    state = { type: "polling", sessionId: session_id };
  } else if (account.subscription_status === "active") {
    state = { type: "active" };
  } else if (account.subscription_status === "trialing") {
    // Compute days remaining. If trial_ends_at is NULL we cannot compute a
    // numeric countdown — deriveTrialDaysLeft returns null so TrialingHeader
    // renders the fallback "Your trial is active" copy (LD-09 invariant).
    const trialDaysLeft = deriveTrialDaysLeft(account.trial_ends_at);
    state = { type: "plan_selection", trialDaysLeft };
  } else if (account.subscription_status === "past_due") {
    // Phase 43 concern: past_due gets a banner but NOT a lockout.
    // Show the plan card so the owner can update payment / re-subscribe.
    state = { type: "plan_selection", trialDaysLeft: null };
  } else {
    // canceled / unpaid / incomplete / incomplete_expired → locked
    // Owner still needs a path to re-subscribe (plan card renders below LockedView).
    state = { type: "locked" };
  }

  // ---------------------------------------------------------------------------
  // Pricing props — server-side from PRICES (env-var-driven, no Stripe API call)
  // ---------------------------------------------------------------------------

  const priceProps = {
    monthlyLabel: PRICES.monthly.label,
    annualTotalLabel: PRICES.annual.totalLabel,
    annualMonthlyEquivalentLabel: PRICES.annual.monthlyEquivalentLabel,
    savingsPct: PRICES.annual.savingsPct,
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
        <ActiveView />
      </div>
    );
  }

  if (state.type === "plan_selection") {
    return (
      <div className="container mx-auto max-w-2xl py-8 space-y-6">
        {/* Trial countdown ONLY for trialing accounts. past_due falls into
            plan_selection too but does NOT get the TrialingHeader.
            Gate on raw subscription_status, not trialDaysLeft, so that
            trialing accounts with NULL trial_ends_at still render the
            fallback "Your trial is active" sub-line (CONTEXT always-render lock). */}
        {account.subscription_status === "trialing" && (
          <TrialingHeader daysLeft={state.trialDaysLeft} />
        )}
        <PlanSelectionCard {...priceProps} />
      </div>
    );
  }

  // locked state — show the tonal anchor + plan card for re-subscribe path
  return (
    <div className="container mx-auto max-w-2xl py-8 space-y-6">
      <LockedView />
      <PlanSelectionCard {...priceProps} />
    </div>
  );
}
