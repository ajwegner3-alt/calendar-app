import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingRouter({
  searchParams,
}: {
  searchParams: Promise<{ gmail_skipped?: string }>;
}) {
  const params = await searchParams;
  if (params.gmail_skipped === "1") {
    // Google OAuth signup denied gmail.send — surface the optional Connect Gmail step.
    // After connecting OR skipping, the connect-gmail page redirects into the normal step router.
    redirect("/onboarding/connect-gmail");
  }

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
