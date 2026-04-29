import Link from "next/link";
import { AuthHero } from "@/app/(auth)/_components/auth-hero";
import { ResendVerificationButton } from "@/app/(auth)/app/verify-email/resend-verification-button";
import { resendVerification } from "@/app/(auth)/app/verify-email/actions";

interface Props {
  searchParams: Promise<{ reason?: string; email?: string }>;
}

/**
 * Generic auth error page shown when /auth/confirm fails.
 *
 * Common reasons:
 *   missing_params  — link was truncated or malformed
 *   otp_expired     — token has expired (Supabase default: 24h for signup, 1h for recovery)
 *   (other)         — invalid token, already used, etc.
 *
 * Renders a friendly headline and a resend verification form so the user can
 * recover without contacting support. Email can be pre-filled via ?email= query
 * param (10-05 signup page sets this); otherwise a small email input is shown.
 */
export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason, email } = await searchParams;

  const isExpired =
    !reason ||
    reason === "missing_params" ||
    reason.toLowerCase().includes("expired") ||
    reason.toLowerCase().includes("invalid");

  const headline = isExpired ? "That link has expired" : "That link didn't work";
  const body = isExpired
    ? "Email confirmation links expire after 24 hours. Request a new one below."
    : "Something went wrong with your confirmation link. You can request a new one below.";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: form column */}
      <main className="flex flex-col items-center justify-center bg-white px-6 py-12 md:py-20 lg:px-12">
        <div className="w-full max-w-sm">
          <header className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
              {headline}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{body}</p>
          </header>

          <ResendVerificationButton
            action={resendVerification}
            initialEmail={email}
          />

          <p className="mt-6 text-center text-sm text-gray-600">
            Already confirmed?{" "}
            <Link
              href="/app/login"
              className="underline underline-offset-4 hover:text-gray-900"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
      {/* Right: NSI hero (lg+ only) */}
      <AuthHero
        headline="That link didn't work"
        subtext="Auth links expire after a set time or when used. Sign in or request a fresh one below."
      />
    </div>
  );
}
