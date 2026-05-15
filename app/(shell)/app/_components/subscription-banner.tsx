import Link from "next/link";
import { BILLING_ENABLED } from "@/lib/stripe/billing-flag";

/**
 * Phase 43 (BILL-16/17/18) — SubscriptionBanner.
 *
 * Renders a subscription-state strip above the page content on every
 * /app/* page when the owner's subscription requires attention.
 *
 * Locked CONTEXT decisions (DO NOT relax):
 *   - This banner is NOT dismissible. No X button, no localStorage,
 *     no close mechanism of any kind. Always visible during trial/past_due.
 *   - Banner is a SERVER component. No "use client" directive.
 *   - Subscription state flows from app/(shell)/layout.tsx via props.
 *     No client-side fetch; no client bundle exposure of subscription_status.
 *   - active accounts → returns null (no banner).
 *   - Locked statuses → returns null (middleware already redirected;
 *     belt-and-suspenders guard here).
 *   - Trialing + null trial_ends_at (grandfathered edge case) → neutral
 *     generic copy (cannot compute countdown, but must still show something).
 *
 * Urgency threshold: daysLeft <= 3 (BILL-17 invariant).
 *
 * Copy strings are LOCKED — do not paraphrase:
 *   - Neutral (>3 days): "Trial ends in N days. Head over to payments to get set up."
 *   - Urgent (2 < daysLeft ≤ 3): "Only N days left in your trial. Head over to payments to get set up."
 *   - Urgent (daysLeft === 1): "Trial ends tomorrow. Head over to payments to get set up."
 *   - Urgent (daysLeft === 0): "Trial ends today. Head over to payments to get set up."
 *   - Null trial_ends_at fallback: "You're on the free trial. Head over to payments to get set up."
 *   - Past-due: "Your payment is past due. Stripe is retrying — update your billing information to keep your account active."
 */

interface SubscriptionBannerProps {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

// Mirrors app/(shell)/app/billing/page.tsx deriveTrialDaysLeft() verbatim.
// Returns null when trial_ends_at is null, 0 when expired (but still trialing),
// or N whole days remaining (Math.ceil so "1 second remaining" = "1 day").
function deriveTrialDaysLeft(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(
    0,
    Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000),
  );
}

export function SubscriptionBanner({
  subscriptionStatus,
  trialEndsAt,
}: SubscriptionBannerProps) {
  // v1.9 free-offering scope change (2026-05-15): billing is parked, so there
  // is no trial or past-due state worth nagging the owner about. Render nothing.
  if (!BILLING_ENABLED) {
    return null;
  }

  // active / null → nothing
  if (subscriptionStatus === "active" || !subscriptionStatus) {
    return null;
  }

  // Locked statuses never reach the banner — middleware redirects them.
  // Belt-and-suspenders: render nothing for anything not in the trio below.
  if (
    subscriptionStatus !== "trialing" &&
    subscriptionStatus !== "past_due"
  ) {
    return null;
  }

  if (subscriptionStatus === "trialing") {
    const daysLeft = deriveTrialDaysLeft(trialEndsAt);

    // Grandfathered edge case: status='trialing' with null trial_ends_at.
    // Fall back to neutral generic copy rather than render nothing.
    if (daysLeft === null) {
      return (
        <div
          role="status"
          className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          You&rsquo;re on the free trial.{" "}
          <Link
            href="/app/billing"
            className="font-medium underline underline-offset-2 hover:text-blue-700"
          >
            Head over to payments to get set up.
          </Link>
        </div>
      );
    }

    const isUrgent = daysLeft <= 3;

    let copy: string;
    if (daysLeft === 0) copy = "Trial ends today.";
    else if (daysLeft === 1) copy = "Trial ends tomorrow.";
    else if (isUrgent) copy = `Only ${daysLeft} days left in your trial.`;
    else copy = `Trial ends in ${daysLeft} days.`;

    const classes = isUrgent
      ? "mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      : "mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900";
    const linkClasses = isUrgent
      ? "font-semibold underline underline-offset-2 hover:text-amber-700"
      : "font-medium underline underline-offset-2 hover:text-blue-700";

    return (
      <div role="status" className={classes}>
        {copy}{" "}
        <Link href="/app/billing" className={linkClasses}>
          Head over to payments to get set up.
        </Link>
      </div>
    );
  }

  // past_due — non-blocking amber banner (LD-08; BILL-18).
  // No "Manage payment" Portal CTA (Phase 44 owns that).
  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Your payment is past due. Stripe is retrying &mdash;{" "}
      <Link
        href="/app/billing"
        className="font-medium underline underline-offset-2 hover:text-amber-700"
      >
        update your billing information
      </Link>{" "}
      to keep your account active.
    </div>
  );
}
