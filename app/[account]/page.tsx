import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandedPage } from "@/app/_components/branded-page";
import { loadAccountListing } from "./_lib/load-account-listing";
import { EventTypeCard } from "./_components/event-type-card";
import { AccountEmptyState } from "./_components/empty-state";

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
    title: `${data.account.name} \u2014 Book a time`,
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

  return (
    <BrandedPage
      logoUrl={data.account.logo_url}
      primaryColor={data.account.brand_primary}
      accountName={data.account.name}
    >
      <main className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">{data.account.name}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Pick a time to meet.
          </p>
        </header>
        {data.eventTypes.length === 0 ? (
          <AccountEmptyState
            accountName={data.account.name}
            ownerEmail={data.account.owner_email}
          />
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {data.eventTypes.map((event) => (
              <EventTypeCard
                key={event.id}
                accountSlug={data.account.slug}
                event={event}
                brandPrimary={data.account.brand_primary}
              />
            ))}
          </section>
        )}
      </main>
    </BrandedPage>
  );
}
