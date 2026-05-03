import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { Header } from "@/app/_components/header";
import { SignupForm } from "./signup-form";

/**
 * Public signup page (AUTH-05, AUTH-07).
 *
 * Server Component shell — delegates all state and submission logic to the
 * <SignupForm /> client component.
 *
 * Post-submit: Server Action redirects to /app/verify-email?email={email}.
 * Email-confirm gate is ON (Supabase Dashboard) so users cannot access /app
 * until clicking the confirmation link.
 *
 * Phase 16-02: Header pill (variant="auth") added at top spanning both columns.
 * Mobile (<lg) gets ambient BackgroundGlow via page-level wrapper; on desktop,
 * AuthHero's own glow takes over inside the right column.
 */
export default function SignupPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <Header variant="auth" />
      <div className="lg:hidden">
        <BackgroundGlow />
      </div>
      <div className="relative grid min-h-screen lg:grid-cols-2">
        {/* Left: NSI hero (lg+ only) — matches login layout */}
        <AuthHero
          headline="Start scheduling in minutes"
          subtext="Create your free account, pick a slug, and you'll have a live booking page before your first coffee."
        />
        {/* Right: form column */}
        <main className="flex flex-col items-center justify-center bg-white/0 px-6 pt-20 pb-12 md:pt-24 md:pb-20 lg:bg-white lg:px-12">
          <div className="w-full max-w-sm">
            <header className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
                Create your account
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Free to start — no credit card required.
              </p>
            </header>
            <SignupForm />
          </div>
        </main>
      </div>
    </div>
  );
}
