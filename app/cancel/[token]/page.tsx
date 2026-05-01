import { Suspense } from "react";
import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TokenNotActive } from "@/app/_components/token-not-active";
import { resolveCancelToken } from "./_lib/resolve-cancel-token";
import { CancelConfirmForm } from "./_components/cancel-confirm-form";
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";

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
    const cancelledBranding = brandingFromRow({
      logo_url: resolved.account?.logo_url ?? null,
      brand_primary: resolved.account?.brand_primary ?? null,
    });
    return (
      <PublicShell branding={cancelledBranding} accountName={resolved.account?.name ?? "NSI"}>
        <div className="mx-auto max-w-md px-6 sm:px-10">
          <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold mb-2">Booking cancelled</h1>
            <p className="text-sm text-muted-foreground mb-6">Your appointment has been cancelled.</p>
            {resolved.account && resolved.eventType ? (
              <Link
                href={`/${resolved.account.slug}/${resolved.eventType.slug}`}
                className="inline-block px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
                style={{
                  background: "var(--brand-primary, #0A2540)",
                  color: "var(--brand-text, #ffffff)",
                }}
              >
                Book again
              </Link>
            ) : null}
          </div>
        </div>
      </PublicShell>
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

  const activeBranding = brandingFromRow({
    logo_url: account.logo_url ?? null,
    brand_primary: account.brand_primary ?? null,
  });
  return (
    <PublicShell branding={activeBranding} accountName={account.name}>
      <div className="mx-auto max-w-md px-6 sm:px-10">
        <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
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
    </PublicShell>
  );
}
