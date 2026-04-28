import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingRouter() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("onboarding_step")
    .eq("owner_user_id", claims!.claims.sub)
    .limit(1);
  const step = accounts?.[0]?.onboarding_step ?? 1;
  redirect(`/onboarding/step-${step}-${stepName(step)}`);
}

function stepName(s: number) {
  return s === 1 ? "account" : s === 2 ? "timezone" : "event-type";
}
