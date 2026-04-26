import { Suspense } from "react";
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TokenNotActive } from "@/app/_components/token-not-active";
import { resolveCancelToken } from "./_lib/resolve-cancel-token";
import { CancelConfirmForm } from "./_components/cancel-confirm-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
  return {
    title: "Cancel booking",
    robots: { index: false, follow: false },
  };
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function CancelPage({ params }: PageProps) {
  // Next.js 16: params is a Promise (STATE.md lock)
  const { token } = await params;
  const resolved = await resolveCancelToken(token);

  if (resolved.state === "not_active") {
    return <TokenNotActive ownerEmail={null} />;
  }

  if (resolved.state === "cancelled") {
    return (
      <div className="mx-auto max-w-md p-6 sm:p-10">
        <div className="rounded-lg border bg-card p-6 sm:p-8 text-center">
          <h1 className="text-xl font-semibold mb-2">Booking cancelled</h1>
          <p className="text-sm text-muted-foreground mb-6">Your appointment has been cancelled.</p>
          {resolved.account && resolved.eventType ? (
            <Link
              href={`/${resolved.account.slug}/${resolved.eventType.slug}`}
              className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Book again
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  // state === 'active'
  const booking = resolved.booking!;
  const account = resolved.account!;
  const eventType = resolved.eventType!;

  // Times in BOOKER timezone (mirror Phase 5 confirmation page)
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");

  return (
    <div className="mx-auto max-w-md p-6 sm:p-10">
      <div className="rounded-lg border bg-card p-6 sm:p-8">
        <h1 className="text-xl font-semibold mb-2">Cancel this booking?</h1>
        <p className="text-sm text-muted-foreground mb-6">
          You&apos;re about to cancel your appointment with <strong>{account.name}</strong>.
        </p>

        <dl className="space-y-3 mb-6">
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">What</dt>
            <dd className="text-sm">{eventType.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">When</dt>
            <dd className="text-sm">{dateLine}<br />{timeLine}</dd>
          </div>
        </dl>

        <Suspense fallback={null}>
          <CancelConfirmForm
            token={token}
            accountSlug={account.slug}
            eventSlug={eventType.slug}
          />
        </Suspense>
      </div>
    </div>
  );
}
