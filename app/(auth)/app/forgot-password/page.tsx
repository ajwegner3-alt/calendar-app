import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Forgot password page (AUTH-09).
 *
 * Lives in the (auth)/app/ route group so it inherits the auth layout shell
 * (no sidebar). Served at /app/forgot-password.
 *
 * UI-12 (Phase 12) will restyle all auth pages — this ships unstyled-but-functional.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="mb-2 text-center">
          <div className="text-2xl font-semibold text-primary">NSI</div>
          <div className="text-sm text-muted-foreground mt-1">
            North Star Integrations
          </div>
        </div>

        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/app/login"
            className="underline underline-offset-4"
          >
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
