import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadEventTypeForBookingPage } from "./_lib/load-event-type";
import type { AccountSummary, EventTypeSummary } from "./_lib/types";

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

      {/*
        BookingShell is a "use client" component (Plan 05-06). It owns:
          - browser TZ detection (Intl.DateTimeFormat().resolvedOptions().timeZone)
          - "Times shown in [TZ]" line above slot list
          - calendar + slot picker, fetching /api/slots
          - booking form with Turnstile
          - 409 race-loser banner + Turnstile reset on error
          - empty-state w/ mailto:[owner_email] link
        Server Component passes the loaded data as serializable props.

        When Plan 05-06 ships:
          1. Delete the inline BookingShell stub function below.
          2. Replace the import marker section with:
             import { BookingShell } from "./_components/booking-shell";
          3. Remove the @ts-expect-error comment on the JSX line.
      */}

      {/* PLAN-05-06-REPLACE-IMPORT-START */}
      {/* import { BookingShell } from "./_components/booking-shell"; */}
      {/* PLAN-05-06-REPLACE-IMPORT-END */}

      <BookingShell account={data.account} eventType={data.eventType} />
    </main>
  );
}

// PLAN-05-06-REPLACE-INLINE-START
// Until Plan 05-06 ships BookingShell, render a placeholder so the route 200s
// during Wave 2 verification. Plan 05-06 will:
//   1. Create app/[account]/[event-slug]/_components/booking-shell.tsx
//   2. Add the real import above (PLAN-05-06-REPLACE-IMPORT-START/END block)
//   3. Delete this entire stub function
// Keep the export name stable so the page.tsx JSX is unchanged when the swap happens.
function BookingShell(props: {
  account: AccountSummary;
  eventType: EventTypeSummary;
}) {
  return (
    <section className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
      <p>Booking interface loads here (Plan 05-06).</p>
      {props.account.owner_email ? (
        <p className="mt-2">
          Or email{" "}
          <a
            className="underline hover:text-foreground transition-colors"
            href={`mailto:${props.account.owner_email}`}
          >
            {props.account.owner_email}
          </a>{" "}
          to book directly.
        </p>
      ) : null}
    </section>
  );
}
// PLAN-05-06-REPLACE-INLINE-END
