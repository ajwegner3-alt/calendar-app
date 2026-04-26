import Link from "next/link";

export interface TokenNotActiveProps {
  /** When known, show the owner contact line. Pass null when token resolved
   *  but couldn't load the account (defensive). */
  ownerEmail: string | null;
  /** Optional account name for the contact line. */
  ownerName?: string | null;
}

/** Friendly "no longer active" branded page — same shape for cancel + reschedule
 *  invalid/used token UX (CONTEXT decision). */
export function TokenNotActive({ ownerEmail, ownerName }: TokenNotActiveProps) {
  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
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
    </div>
  );
}
