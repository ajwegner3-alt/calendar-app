import Link from "next/link";
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
 * Note: /signup resolves in Plan 10-05. The "Use a different email" link is
 * rendered as-is now so the page is complete; it will resolve correctly once
 * 10-05 ships.
 */
export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <main className="min-h-screen grid place-items-center bg-muted px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Check your inbox</h1>
          {email ? (
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click the link to continue.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to your email address. Click the link
              to continue.
            </p>
          )}
        </div>

        <ResendVerificationButton
          action={resendVerification}
          initialEmail={email}
        />

        <p className="text-center text-sm text-muted-foreground">
          Wrong address?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Use a different email
          </Link>
        </p>
      </div>
    </main>
  );
}
