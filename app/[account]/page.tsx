import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/app/_components/public-shell";
import { brandingFromRow } from "@/lib/branding/read-branding";
import { loadAccountListing } from "./_lib/load-account-listing";
import { EventTypeCard } from "./_components/event-type-card";
import { AccountEmptyState } from "./_components/empty-state";
import { ListingHero } from "./_components/listing-hero";

interface RouteParams {
  account: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { account } = await params;
  const data = await loadAccountListing(account);
  if (!data) {
    return { title: "Page not found" };
  }
  return {
    title: `${data.account.name} — Book a time`,
    description: `Pick a time to meet with ${data.account.name}.`,
  };
}

export default async function AccountIndexPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { account } = await params;
  const data = await loadAccountListing(account);
  if (!data) notFound();

  const branding = brandingFromRow(data.account);

  return (
    <PublicShell branding={branding} accountName={data.account.name}>
      <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
        <ListingHero
          accountName={data.account.name}
          logoUrl={data.account.logo_url}
          brandPrimary={data.account.brand_primary}
        />
        <section className="mt-10">
          {data.eventTypes.length === 0 ? (
            <AccountEmptyState
              accountName={data.account.name}
              ownerEmail={data.account.owner_email}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.eventTypes.map((event) => (
                <EventTypeCard
                  key={event.id}
                  accountSlug={data.account.slug}
                  event={event}
                  brandPrimary={data.account.brand_primary}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
