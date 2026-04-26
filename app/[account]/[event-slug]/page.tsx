import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEventTypeForBookingPage } from "./_lib/load-event-type";
// PLAN-05-06-REPLACE-IMPORT-START
import { BookingShell } from "./_components/booking-shell";
// PLAN-05-06-REPLACE-IMPORT-END
import { BrandedPage } from "@/app/_components/branded-page";

interface RouteParams {
  account: string;
  "event-slug": string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account, "event-slug": eventSlug } = await params;
  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) {
    return { title: "Page not found" };
  }
  return {
    title: `${data.eventType.name} — ${data.account.name}`,
    description:
      data.eventType.description?.slice(0, 160) ??
      `Book a time with ${data.account.name}.`,
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { account, "event-slug": eventSlug } = await params;
  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) notFound();

  return (
    <BrandedPage
      logoUrl={data.account.logo_url}
      primaryColor={data.account.brand_primary}
      accountName={data.account.name}
    >
      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-8">
          <p className="text-sm text-muted-foreground">{data.account.name}</p>
          <h1 className="text-2xl font-semibold mt-1">{data.eventType.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.eventType.duration_minutes} min
            {data.eventType.description
              ? ` · ${data.eventType.description}`
              : ""}
          </p>
        </header>

        {/* PLAN-05-06-REPLACE-INLINE-START */}
        {/* BookingShell is a "use client" component (Plan 05-06). Real import above. */}
        {/* PLAN-05-06-REPLACE-INLINE-END */}

        <BookingShell account={data.account} eventType={data.eventType} />
      </main>
    </BrandedPage>
  );
}
