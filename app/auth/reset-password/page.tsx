import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
 *
 * UI-12 (Phase 12) restyles all auth pages — this ships unstyled-but-functional.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const hasSession = !!claimsData?.claims;

  if (!hasSession) {
    return (
      <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link has expired or was already used.
          </p>
          <Link
            href="/app/forgot-password"
            className="text-sm underline underline-offset-4"
          >
            Request a new reset email
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="mb-2 text-center">
          <div className="text-2xl font-semibold text-primary">NSI</div>
          <div className="text-sm text-muted-foreground mt-1">
            North Star Integrations
          </div>
        </div>

        <ResetPasswordForm />
      </div>
    </main>
  );
}
