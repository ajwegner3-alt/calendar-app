/**
 * billing-state-views.tsx
 *
 * Server-rendered framing blocks for the four billing page states.
 * No "use client" — these are pure server-rendered JSX.
 *
 * Locked-state copy is the CONTEXT.md tonal anchor — Phase 43's redirect
 * lands here and must NOT need to add new copy.
 *
 * Trial countdown block ALWAYS renders for trialing accounts (CONTEXT lock):
 *   - When trial_ends_at IS set: "N days left in your trial" (numeric countdown)
 *   - When trial_ends_at IS NULL: "Your trial is active" (reassuring fallback)
 *   Never silently absent for a trialing account.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// TrialingHeader — shown above the plan card for trialing accounts
// ---------------------------------------------------------------------------

export function TrialingHeader({ daysLeft }: { daysLeft: number | null }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        Upgrade to keep the momentum going.
      </h1>
      <p className="text-sm text-muted-foreground">
        {daysLeft === null
          ? "Your trial is active"
          : daysLeft === 1
            ? "1 day left in your trial"
            : `${daysLeft} days left in your trial`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActiveView — shown when subscription_status = 'active' (voluntary visit)
// Phase 44 will add the Customer Portal "Manage subscription" link here.
// ---------------------------------------------------------------------------

export function ActiveView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your subscription is active.</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Thanks for being a customer.</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LockedView — shown for canceled / unpaid / incomplete / incomplete_expired
// CONTEXT.md tonal anchor — warm, non-punitive framing.
// Phase 43 wires the redirect here; Phase 42 owns the copy.
// The TierGrid renders below this in page.tsx so the owner can
// re-subscribe (or book a Branding consult) from the same page.
// ---------------------------------------------------------------------------

export function LockedView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Everything is waiting for you!</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Head over to payments to get set up.
        </p>
      </CardContent>
    </Card>
  );
}
