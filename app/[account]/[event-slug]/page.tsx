import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEventTypeForBookingPage } from "./_lib/load-event-type";
import { BookingShell } from "./_components/booking-shell";
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";

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

  const branding = brandingFromRow(data.account);

  return (
    <PublicShell branding={branding} accountName={data.account.name}>
      <BookingShell account={data.account} eventType={data.eventType} />
    </PublicShell>
  );
}
