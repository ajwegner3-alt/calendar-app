import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";
import { LoginForm } from "./login-form";

interface Props {
  searchParams: Promise<{ reset?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/app");

  const { reset } = await searchParams;

  return (
    // Phase 16-02: page-level wrapper provides ambient glow on mobile (<lg).
    // On desktop, AuthHero's own BackgroundGlow takes over inside the right column;
    // the lg:hidden glow here only renders on mobile to satisfy the form-only-with-glow
    // visual contract from CONTEXT.md.
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <Header variant="auth" />
      <div className="lg:hidden">
        <BackgroundGlow />
      </div>
      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Left: NSI hero (lg+ only) — AUTH-19 v1.3: hero LEFT, form RIGHT */}
        <AuthHero headline="Welcome back to your bookings" />
        {/* Right: form column */}
        <main className="flex flex-col items-center justify-center bg-white/0 px-6 pt-20 pb-12 md:pt-24 md:pb-20 lg:bg-white lg:px-12">
          <div className="w-full max-w-sm">
            <header className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Sign in to your dashboard
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Sign in with your email and password or a magic link.
              </p>
            </header>
            <LoginForm resetSuccess={reset === "success"} />
          </div>
        </main>
      </div>
    </div>
  );
}
