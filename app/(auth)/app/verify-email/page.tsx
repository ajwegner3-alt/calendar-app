import Link from "next/link";
import { Header } from "@/app/_components/header";
import { BackgroundGlow } from "@/app/_components/background-glow";
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
 * Phase 16-03 re-skin: single-column shell with bg-gray-50 + BackgroundGlow +
 * Header (auth variant) + centered white card. Server-side searchParams parsing
 * and <ResendVerificationButton action={resendVerification} initialEmail={email} />
 * preserved verbatim.
 */
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <BackgroundGlow />
      <Header variant="auth" />
      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-20 md:pt-24 pb-12">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
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
    </div>
  );
}
