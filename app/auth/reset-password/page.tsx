import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/header";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { ResetPasswordForm } from "./reset-password-form";

/**
 * Password reset page (AUTH-09 / AUTH-13/15/16).
 *
 * Served at /auth/reset-password (NOT in the (auth) route group) because
 * /auth/confirm recovery handler redirects here after token verification.
 *
 * Pre-check: if no active session exists, the user reached this page without
 * going through the email recovery link. Show an "expired link" placeholder
 * instead of the form.
 *
 * Phase 16-03 re-skin: single-column shell with bg-gray-50 + BackgroundGlow +
 * Header (auth variant) + centered white card. Both the expired-link fallback
 * and the form branch render INSIDE the same shell. createClient() + getClaims()
 * + hasSession branching preserved verbatim.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const hasSession = !!claimsData?.claims;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header variant="auth" />
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-20 md:pt-24 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          {hasSession ? (
            <>
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
            </>
          ) : (
            <div className="space-y-4 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Link expired
              </h1>
              <p className="text-sm text-gray-600">
                This password reset link has expired or was already used.
              </p>
              <Link
                href="/app/forgot-password"
                className="inline-block text-sm underline underline-offset-4 hover:text-gray-900"
              >
                Request a new reset email
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
