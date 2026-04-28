import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeCard } from "@/components/welcome-card";

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims) {
    redirect("/app/login");
  }

  // Load the user's account row directly (RLS-scoped: only their own row is
  // returned). This replaces the v1.0 current_owner_account_ids() RPC which
  // only checked whether an account row existed — it did not check
  // onboarding_complete, so new users would land on the dashboard before
  // completing the wizard.
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("onboarding_complete")
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

  // New users (onboarding_complete=false) must complete the wizard first.
  if (!accounts[0].onboarding_complete) {
    redirect("/onboarding");
  }

  return <WelcomeCard />;
}
