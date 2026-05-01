import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { loadConfirmedBooking } from "./_lib/load-confirmed-booking";
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";

interface RouteParams {
  account: string;
  "event-slug": string;
  "booking-id": string;
}

/**
 * Per-booking metadata — sets a human-readable title and reinforces noindex.
 * Uses the same loadConfirmedBooking call as the page (two DB round-trips per
 * request — acceptable v1; Phase 8 can wrap in React cache() if latency matters).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const {
    account,
    "event-slug": eventSlug,
    "booking-id": bookingId,
  } = await params;

  const data = await loadConfirmedBooking({
    accountSlug: account,
    eventSlug,
    bookingId,
  });

  if (!data) {
    return {
      title: "Page not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Booking confirmed — ${data.eventType.name}`,
    robots: { index: false, follow: false },
  };
}

/**
 * Confirmation screen (Server Component — no client interactivity needed).
 *
 * Access model:
 *   - Route is keyed by booking.id (UUID v4, 122-bit entropy = unguessable).
 *   - Loader verifies URL slugs match booking's actual account + event_type
 *     parents (cross-tenant defense-in-depth). Any mismatch → notFound().
 *   - Service-role Supabase client used (RLS blocks anon reads on bookings).
 *
 * Content contract (CONTEXT decision #7):
 *   - Event name, date/time in BOOKER timezone, owner name, masked-email copy.
 *   - NO Add-to-Calendar deeplinks (.ics is in the email).
 *   - NO cancel/reschedule links (those live in the email only).
 *   - NO full email, phone, or custom-question answers.
 *
 * Status branching:
 *   - "confirmed" → happy-path confirmation card
 *   - "cancelled" | "rescheduled" | any other → friendly "no longer active" state
 *     This future-proofs Phase 6 cancel/reschedule flows without changing this URL.
 */
export default async function ConfirmedBookingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const {
    account,
    "event-slug": eventSlug,
    "booking-id": bookingId,
  } = await params;

  const data = await loadConfirmedBooking({
    accountSlug: account,
    eventSlug,
    bookingId,
  });

  if (!data) notFound();

  const { booking, account: acct, eventType } = data;
  const isConfirmed = booking.status === "confirmed";

  const branding = brandingFromRow({
    logo_url: acct.logo_url,
    brand_primary: acct.brand_primary,
  });

  // Format date/time in the BOOKER's own timezone (CONTEXT decision #7).
  // TZDate from @date-fns/tz v1 — same pattern as lib/email/send-booking-confirmation.ts.
  const startInBookerTz = new TZDate(
    new Date(booking.start_at),
    booking.booker_timezone,
  );
  const dateLine = format(startInBookerTz, "EEEE, MMMM d, yyyy"); // "Friday, May 15, 2026"
  const timeLine = format(startInBookerTz, "h:mm a (z)");         // "2:00 PM (CDT)"

  // Mask booker email: show full local part + first-letter-and-stars domain.
  // Full email is in the booker's inbox already. This page is bookmarkable so
  // masking prevents splash of PII to anyone who happens to see the URL.
  // Example: "andrew@example.com" → "andrew@e***.com"
  const maskedEmail = maskEmail(booking.booker_email);

  if (!isConfirmed) {
    // Phase 6 may set status to 'cancelled' or 'rescheduled'.
    // Render a friendly fallback without breaking this URL for the booker.
    return (
      <PublicShell branding={branding} accountName={acct.name}>
        <div className="mx-auto max-w-xl px-6 py-16">
          <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold mb-3">
              This booking is no longer active.
            </h1>
            <p className="text-sm text-muted-foreground">
              Check your email for the latest details about your appointment.
            </p>
          </section>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell branding={branding} accountName={acct.name}>
      <div className="mx-auto max-w-xl px-6 py-16">
        {/* Success header */}
        <header className="mb-8 text-center">
          <div
            className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full text-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--brand-primary, #0A2540) 15%, transparent)",
              color: "var(--brand-primary, #0A2540)",
            }}
            aria-hidden="true"
          >
            ✓
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            You&apos;re booked.
          </h1>
        </header>

        {/* Booking details card */}
        <dl className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 space-y-3 text-sm shadow-sm">
          <BookingRow label="Event">{eventType.name}</BookingRow>
          <BookingRow label="When">
            <span>{dateLine}</span>
            <span className="block text-muted-foreground">{timeLine}</span>
          </BookingRow>
          <BookingRow label="Duration">{eventType.duration_minutes} min</BookingRow>
          <BookingRow label="With">{acct.name}</BookingRow>
        </dl>

        {/* Confirmation note — CONTEXT decision #7 verbatim copy */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Confirmation sent to <strong>{maskedEmail}</strong> with calendar invite.
        </p>
      </div>
    </PublicShell>
  );
}

/** Two-column definition list row: label on left, content on right. */
function BookingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 items-baseline">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

/**
 * Lightly masks a booker email address for display.
 *
 * Algorithm:
 *   - Local part (before @) is shown in full — it's the booker's own name.
 *   - Domain-name part (between @ and last .) is replaced with first letter + stars.
 *   - TLD (after last .) is shown in full.
 *
 * Examples:
 *   "andrew@example.com"    → "andrew@e***.com"
 *   "j@ab.io"               → "j@a*.io"
 *   "user@gmail.com"        → "user@g****.com"
 *   "bad-email"             → "bad-email" (no @ → returned as-is)
 */
function maskEmail(email: string): string {
  const atIdx = email.lastIndexOf("@");
  if (atIdx < 0) return email;

  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);

  const dotIdx = domain.lastIndexOf(".");
  if (dotIdx < 0) {
    // No dot in domain — just show first char + stars
    const masked = domain.charAt(0) + "*".repeat(Math.max(2, domain.length - 1));
    return `${local}@${masked}`;
  }

  const domainName = domain.slice(0, dotIdx); // e.g. "example" from "example.com"
  const tld = domain.slice(dotIdx);           // e.g. ".com"
  const stars = "*".repeat(Math.max(2, domainName.length - 1));
  const maskedDomain = domainName.charAt(0) + stars;

  return `${local}@${maskedDomain}${tld}`;
}
