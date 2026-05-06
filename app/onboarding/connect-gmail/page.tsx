import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConnectGmailCard } from "./_components/connect-gmail-card";

export default async function OnboardingConnectGmailPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/app/login");

  // If onboarding is already complete, this page shouldn't show — bounce to /app.
  const { data: account } = await supabase
    .from("accounts")
    .select("onboarding_complete")
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null)
    .maybeSingle();
  if (account?.onboarding_complete) redirect("/app");

  return <ConnectGmailCard />;
}
