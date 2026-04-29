import { AuthHero } from "@/app/(auth)/_components/auth-hero";
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
 */
export default function SignupPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
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
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero
        headline="Start scheduling in minutes"
        subtext="Create your free account, pick a slug, and you'll have a live booking page before your first coffee."
      />
    </div>
  );
}
