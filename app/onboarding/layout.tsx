import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/app/login");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, onboarding_complete, onboarding_step")
    .eq("owner_user_id", claims.claims.sub)
    .is("deleted_at", null)
    .limit(1);

  const me = accounts?.[0];
  if (!me) {
    // Trigger should have created a stub. If absent, send to /app — error fallback.
    redirect("/app");
  }
  if (me.onboarding_complete) redirect("/app");

  // Wizard chrome — Phase 16 re-skin: bg-gray-50 + BackgroundGlow + Header pill ("Setup").
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header variant="auth" rightLabel="Setup" />
      <main className="relative z-10 mx-auto w-full max-w-xl px-4 pt-20 md:pt-24 pb-12">
        <div>
          <p className="mt-1 text-sm text-gray-500">
            Step {me.onboarding_step} of 3
          </p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  s <= me.onboarding_step ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
