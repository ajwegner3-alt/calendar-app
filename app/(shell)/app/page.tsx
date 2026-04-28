import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeCard } from "@/components/welcome-card";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

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
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select(
      "id, slug, onboarding_complete, onboarding_checklist_dismissed_at, created_at",
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

  return (
    <div className="flex flex-col gap-6">
      {/* Onboarding checklist — renders only within first 7 days, before dismiss */}
      <OnboardingChecklist
        account={account}
        availabilityCount={availabilityCount}
        eventTypeCount={eventTypeCount}
      />

      <WelcomeCard />
    </div>
  );
}
