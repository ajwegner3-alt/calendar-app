import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Wizard chrome (minimal — Phase 12 restyles): step indicator + container.
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Set up your booking page
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Step {me.onboarding_step} of 3
          </p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full ${
                  s <= me.onboarding_step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
