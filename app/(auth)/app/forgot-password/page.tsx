import Link from "next/link";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { ForgotPasswordForm } from "./forgot-password-form";

/**
 * Forgot password page (AUTH-09).
 *
 * Lives in the (auth)/app/ route group so it inherits the auth layout shell
 * (no sidebar). Served at /app/forgot-password.
 */
export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
        <div className="w-full max-w-sm">
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
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero
        headline="We've got your back"
        subtext="Enter your email and we'll send a reset link if it's registered."
      />
    </div>
  );
}
