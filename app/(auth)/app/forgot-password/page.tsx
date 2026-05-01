import Link from "next/link";
import { Header } from "@/app/_components/header";
import { BackgroundGlow } from "@/app/_components/background-glow";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Forgot password page (AUTH-09 / AUTH-13/15/16).
 *
 * Lives in the (auth)/app/ route group so it inherits the auth layout shell
 * (no sidebar). Served at /app/forgot-password.
 *
 * Phase 16-03 re-skin: single-column shell with bg-gray-50 + BackgroundGlow +
 * Header (auth variant) + centered white card. Functional <ForgotPasswordForm />
 * client island preserved verbatim.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header variant="auth" />
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-20 md:pt-24 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Forgot your password?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email and we'll send a reset link if it's registered.
            </p>
          </header>
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link
              href="/app/login"
              className="underline underline-offset-4 hover:text-gray-900"
            >
              Back to login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
