import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WelcomeCard } from "@/components/welcome-card";

export default async function DashboardHome() {
  const supabase = await createClient();

  // RESEARCH Open Question #1: verify the RPC return shape at runtime.
  // current_owner_account_ids() is `returns setof uuid`, which in supabase-js
  // returns an array of raw UUID strings (not wrapped objects). A length check
  // is correct. If this surprises in practice (e.g., shape is
  // [{current_owner_account_ids: uuid}, ...]), fall back to the direct query:
  //
  //   const { data } = await supabase
  //     .from("accounts")
  //     .select("id")
  //     .eq("owner_user_id", claims.sub);
  //
  // Plan 04 Task 3 inspects this shape end-to-end with a transient console.log
  // and documents the observed form in the plan-04 SUMMARY. If wrapped, the
  // length check below should become:
  //   data.filter(r => r.current_owner_account_ids).length === 0
  // Do NOT ship the console.log — it's transient, removed in the same commit.
  const { data, error } = await supabase.rpc("current_owner_account_ids");

  if (error) {
    // Infrastructure failure — surface rather than silently hide.
    throw new Error(`Failed to load account linkage: ${error.message}`);
  }

  const linkedCount = Array.isArray(data) ? data.length : 0;
  if (linkedCount === 0) redirect("/app/unlinked");

  return <WelcomeCard />;
}
