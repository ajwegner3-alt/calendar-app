import Link from "next/link";

export interface TokenNotActiveProps {
  /** When known, show the owner contact line. Pass null when token resolved
   *  but couldn't load the account (defensive). */
  ownerEmail: string | null;
  /** Optional account name for the contact line. */
  ownerName?: string | null;
}

/** Friendly "no longer active" page for cancel + reschedule when token is invalid
 *  or expired. Renders WITHOUT PublicShell because no branding context is
 *  available at this point (account may not have been resolved). Phase 17 (PUB-11):
 *  bg-gray-50 outer + v1.2 card lock for visual continuity with the rest of the
 *  public surface family. */
export function TokenNotActive({ ownerEmail, ownerName }: TokenNotActiveProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-md px-6 py-24">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold mb-2">This link is no longer active</h1>
          <p className="text-sm text-muted-foreground mb-6">
            The booking may have already been cancelled, rescheduled, or the
            appointment time has passed.
          </p>
          {ownerEmail ? (
            <p className="text-sm">
              Need help?{" "}
              <a href={`mailto:${ownerEmail}`} className="text-primary font-medium hover:underline">
                Contact {ownerName ?? ownerEmail}
              </a>
            </p>
          ) : null}
          <p className="text-sm mt-6">
            <Link href="/" className="text-muted-foreground hover:underline">Return home</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
