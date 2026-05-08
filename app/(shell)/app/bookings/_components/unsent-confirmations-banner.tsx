import Link from "next/link";

/**
 * Phase 31 (EMAIL-24) — UnsentConfirmationsBanner.
 *
 * Renders an alert above the /app/bookings table when one or more bookings
 * have confirmation_email_sent=false (i.e. the daily Gmail SMTP quota refused
 * the booker's confirmation email AFTER the row was inserted).
 *
 * Locked CONTEXT decisions (DO NOT relax):
 *   - This banner returns null when count <= 0. There is NO always-visible
 *     widget, NO quota counter, NO 80% warn banner. Error-only, by design.
 *   - The copy MUST contain the literal "Use Gmail to notify these bookers
 *     manually" — that exact wording is the locked Gmail-fallback hint.
 *   - Booker-facing surfaces stay generic (LD-07). This component is OWNER-
 *     facing only — it is rendered inside the (shell) layout which is gated
 *     by owner auth.
 *
 * No props beyond `count` because the page server component fetches the count
 * via countUnsentConfirmations() and passes it down. Server-component-safe.
 */
export function UnsentConfirmationsBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  const noun = count === 1 ? "booking" : "bookings";
  const verb = count === 1 ? "has" : "have";
  return (
    <div
      role="alert"
      data-testid="unsent-confirmations-banner"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <strong>
        {count} {noun}
      </strong>{" "}
      {verb} an unsent confirmation email because the daily email quota
      (200/day) was reached. Use Gmail to notify these bookers manually. The
      quota resets at UTC midnight.{" "}
      <Link
        href="/app/settings/upgrade"
        className="underline underline-offset-2 font-medium"
      >
        Request upgrade
      </Link>
    </div>
  );
}
