import Link from "next/link";
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
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">{headline}</h1>
          <p className="text-sm text-muted-foreground">{body}</p>
        </div>

        <ResendVerificationButton
          action={resendVerification}
          initialEmail={email}
        />

        <p className="text-center text-sm text-muted-foreground">
          Already confirmed?{" "}
          <Link href="/app/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
