import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEventTypeForBookingPage } from "@/app/[account]/[event-slug]/_lib/load-event-type";
import { EmbedShell } from "./_components/embed-shell";

interface RouteParams {
  account: string;
  "event-slug": string;
}

interface SearchParams {
  previewColor?: string;
  previewLogo?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account, "event-slug": eventSlug } = await params;
  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) {
    return {
      title: "Booking unavailable",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `${data.eventType.name} — ${data.account.name}`,
    // RESEARCH Open Q4 lock: noindex /embed/* — canonical URL is /[account]/[event-slug]
    robots: { index: false, follow: false },
  };
}

export default async function EmbedBookingPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<SearchParams>;
}) {
  const { account, "event-slug": eventSlug } = await params;
  const sp = await searchParams;

  const data = await loadEventTypeForBookingPage(account, eventSlug);
  if (!data) notFound();

  // Sanitize preview overrides server-side — only accept #RRGGBB hex and https:// URLs.
  // Prevents querystring injection if someone shares the embed URL with custom params.
  const previewColor =
    typeof sp.previewColor === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(sp.previewColor)
      ? sp.previewColor
      : undefined;

  const previewLogo =
    typeof sp.previewLogo === "string" && /^https:\/\//.test(sp.previewLogo)
      ? sp.previewLogo
      : undefined;

  return (
    <main className="mx-auto max-w-3xl">
      <EmbedShell
        account={data.account}
        eventType={data.eventType}
        previewColor={previewColor}
        previewLogo={previewLogo}
      />
    </main>
  );
}
