import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadMonthBookings } from "./_lib/load-month-bookings";
import { HomeDashboard } from "./_components/home-dashboard";
import { OnboardingBanner } from "./_components/onboarding-banner";
import { GoogleLinkToast } from "./_components/google-link-toast";

// 7-day onboarding checklist visibility window (matches OnboardingChecklist
// client-side gate in components/onboarding-checklist.tsx).
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims) {
    redirect("/app/login");
  }

  // Load the user's account row directly (RLS-scoped: only their own row is
  // returned). Selects all columns needed for the onboarding checklist
  // visibility gate plus the 10-06 onboarding_complete redirect.
  // timezone added for 12-04b DayDetailSheet time formatting.
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select(
      "id, slug, timezone, onboarding_complete, onboarding_checklist_dismissed_at, created_at",
    )
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null)
    .limit(1);

  if (error) {
    // Infrastructure failure — surface rather than silently hide.
    throw new Error(`Failed to load account: ${error.message}`);
  }

  // Defense in depth: trigger should have created the stub, but if it's missing
  // fall back to the v1.0 /app/unlinked route rather than a blank dashboard.
  if (!accounts || accounts.length === 0) {
    redirect("/app/unlinked");
  }

  const account = accounts[0];

  // New users (onboarding_complete=false) must complete the wizard first.
  // Preserved from 10-06 — do not remove.
  if (!account.onboarding_complete) {
    redirect("/onboarding");
  }

  // Determine whether the onboarding checklist should be shown at all before
  // fetching the extra counts (avoids two round-trips for established users).
  const checklistWindowOpen =
    account.onboarding_checklist_dismissed_at === null &&
    new Date(account.created_at).getTime() + SEVEN_DAYS_MS > Date.now();

  // Only load availability + event_type counts when the checklist window is
  // open — no-op for users who have already dismissed or are past 7 days.
  let availabilityCount = 0;
  let eventTypeCount = 0;

  if (checklistWindowOpen) {
    const [availResult, evtResult] = await Promise.all([
      supabase
        .from("availability_rules")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id),
      supabase
        .from("event_types")
        .select("id", { count: "exact", head: true })
        .eq("account_id", account.id)
        .eq("is_active", true),
    ]);

    availabilityCount = availResult.count ?? 0;
    eventTypeCount = evtResult.count ?? 0;
  }

  const today = new Date();
  const bookings = await loadMonthBookings(today);

  const currentMonth = today.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Google link toast — reads ?google_linked=1, fires once, strips param. Returns null. */}
      <Suspense fallback={null}>
        <GoogleLinkToast />
      </Suspense>

      {/* Onboarding banner — renders only within first 7 days, before dismiss.
          Wraps the existing OnboardingChecklist in a compact above-calendar layout. */}
      {checklistWindowOpen && (
        <OnboardingBanner
          account={account}
          availabilityCount={availabilityCount}
          eventTypeCount={eventTypeCount}
        />
      )}

      {/* Month header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {currentMonth}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Your bookings at a glance.
        </p>
      </header>

      {/* Empty state — shown above the calendar so owner can still navigate months */}
      {bookings.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
          <p className="text-sm text-muted-foreground">
            No bookings in {currentMonth}. Bookings will appear here as
            they&apos;re scheduled.
          </p>
        </div>
      )}

      {/* Calendar with day-detail drawer — HomeDashboard owns Sheet open state;
          clicking any day opens DayDetailSheet (empty-state for days with no bookings). */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <HomeDashboard bookings={bookings} accountTimezone={account.timezone} />
      </div>
    </div>
  );
}
