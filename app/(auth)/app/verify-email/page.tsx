import Link from "next/link";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { ResendVerificationButton } from "./resend-verification-button";
import { resendVerification } from "./actions";

interface Props {
  searchParams: Promise<{ email?: string }>;
}

/**
 * Post-signup waiting page (CONTEXT.md: dedicated verify-email page with resend button).
 *
 * Shown immediately after signup (Plan 10-05 wires the redirect here).
 * Reads ?email= from query string to display the address to the user and
 * pre-fill the resend form.
 *
 * "Use a different email" link resolves to /app/signup (Plan 10-05).
 */
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
        <div className="w-full max-w-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              Check your inbox
            </h2>
            {email ? (
              <p className="mt-2 text-sm text-gray-600">
                We sent a confirmation link to{" "}
                <span className="font-medium text-gray-900">{email}</span>.
                Click the link to continue.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                We sent a confirmation link to your email address. Click the
                link to continue.
              </p>
            )}
          </header>

          <ResendVerificationButton
            action={resendVerification}
            initialEmail={email}
          />

          <p className="mt-6 text-center text-sm text-gray-600">
            Wrong address?{" "}
            <Link
              href="/app/signup"
              className="underline underline-offset-4 hover:text-gray-900"
            >
              Use a different email
            </Link>
          </p>
        </div>
      </main>
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero
        headline="One quick step"
        subtext="Check your inbox for the verification link. Click it to finish setting up your account."
      />
    </div>
  );
}
