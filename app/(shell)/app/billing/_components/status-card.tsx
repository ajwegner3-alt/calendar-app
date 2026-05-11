import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { PortalButton } from "./portal-button";

interface ActiveStatusCardProps {
  variant: "active";
  planTier: "basic" | "widget" | null;
  planInterval: "monthly" | "annual" | "month" | "year" | string | null;
  renewalDate: string | null;
}

interface CancelScheduledStatusCardProps {
  variant: "cancel_scheduled";
  planTier: "basic" | "widget" | null;
  periodEndDate: string | null;
}

interface PastDueStatusCardProps {
  variant: "past_due";
}

type StatusCardProps =
  | ActiveStatusCardProps
  | CancelScheduledStatusCardProps
  | PastDueStatusCardProps;

/**
 * Phase 44 (BILL-21, BILL-22, BILL-23): server-rendered Status Card for the three
 * non-trialing / non-locked billing page states.
 *
 * Visual variants:
 *   active           — neutral framing; plan name + renewal date + "Manage Subscription"
 *   cancel_scheduled — amber framing; "Subscription ending {date}" + "Manage Subscription"
 *   past_due         — amber framing; "Payment required" + "Update payment method" (deep-link)
 *
 * data-variant attribute makes the card targetable in DOM for UAT screenshots/automation.
 */
export function StatusCard(props: StatusCardProps) {
  if (props.variant === "active") {
    return <ActiveStatusCard {...props} />;
  }
  if (props.variant === "cancel_scheduled") {
    return <CancelScheduledStatusCard {...props} />;
  }
  return <PastDueStatusCard />;
}

function tierLabel(tier: "basic" | "widget" | null): string {
  if (tier === "basic") return "Basic";
  if (tier === "widget") return "Widget";
  return "Subscription";
}

function intervalLabel(interval: string | null): string {
  if (interval === "annual" || interval === "year") return "Annual";
  if (interval === "monthly" || interval === "month") return "Monthly";
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Active variant — neutral framing
// ─────────────────────────────────────────────────────────────────────────────

function ActiveStatusCard({ planTier, planInterval, renewalDate }: ActiveStatusCardProps) {
  const intLabel = intervalLabel(planInterval);
  return (
    <Card data-variant="active">
      <CardHeader>
        <CardTitle>{tierLabel(planTier)} Plan</CardTitle>
        <CardDescription>Your subscription is active.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {intLabel ? <p className="text-sm text-muted-foreground">Billing: {intLabel}</p> : null}
        {renewalDate ? (
          <p className="text-sm text-muted-foreground">Renews on {renewalDate}</p>
        ) : null}
      </CardContent>
      <CardFooter>
        <PortalButton />
      </CardFooter>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel-scheduled variant — amber framing
// ─────────────────────────────────────────────────────────────────────────────

function CancelScheduledStatusCard({ planTier, periodEndDate }: CancelScheduledStatusCardProps) {
  return (
    <Card data-variant="cancel_scheduled" className="border-amber-200">
      <CardHeader>
        <CardTitle>Subscription ending</CardTitle>
        <CardDescription>Your {tierLabel(planTier)} plan is scheduled to cancel.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {periodEndDate
            ? `Your subscription ends on ${periodEndDate}. You'll keep full access until then.`
            : "You'll keep full access until the end of your current billing period."}
        </p>
      </CardContent>
      <CardFooter>
        <PortalButton />
      </CardFooter>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Past_due variant — amber framing with payment-method deep-link
// ─────────────────────────────────────────────────────────────────────────────

function PastDueStatusCard() {
  return (
    <Card data-variant="past_due" className="border-amber-200">
      <CardHeader>
        <CardTitle>Payment required</CardTitle>
        <CardDescription>We couldn&apos;t process your most recent payment.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Please update your payment method to keep your account active. Stripe is retrying the
          charge automatically, but updating your card now is the fastest fix.
        </p>
      </CardContent>
      <CardFooter>
        <PortalButton flow="payment_method_update" />
      </CardFooter>
    </Card>
  );
}
