import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Password reset page (AUTH-09).
 *
 * Served at /auth/reset-password (NOT in the (auth) route group) because
 * /auth/confirm recovery handler redirects here after token verification.
 *
 * Pre-check: if no active session exists, the user reached this page without
 * going through the email recovery link. Show an "expired link" placeholder
 * instead of the form.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const hasSession = !!claimsData?.claims;

  if (!hasSession) {
    return (
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left: expired-link fallback */}
        <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
          <div className="w-full max-w-sm space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Link expired
            </h1>
            <p className="text-sm text-gray-600">
              This password reset link has expired or was already used.
            </p>
            <Link
              href="/app/forgot-password"
              className="text-sm underline underline-offset-4 hover:text-gray-900"
            >
              Request a new reset email
            </Link>
          </div>
        </main>
        {/* Right: NSI hero (lg+ only) */}
        <AuthHero
          headline="Set a new password"
          subtext="Choose a strong password (8+ characters) to finish resetting your account."
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
        <div className="w-full max-w-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Set a new password
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Choose a strong password (8+ characters) to finish resetting your
              account.
            </p>
          </header>
          <ResetPasswordForm />
        </div>
      </main>
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero
        headline="Set a new password"
        subtext="Choose a strong password (8+ characters) to finish resetting your account."
      />
    </div>
  );
}
