import { queryBookings, listEventTypesForFilter } from "./_lib/queries";
import type { BookingStatusFilter } from "./_lib/queries";
import { BookingsTable } from "./_components/bookings-table";
import { BookingsFilters } from "./_components/bookings-filters";
import { BookingsPagination } from "./_components/bookings-pagination";

const PAGE_SIZE = 25;

const VALID_STATUSES: BookingStatusFilter[] = [
  "upcoming",
  "all",
  "confirmed",
  "cancelled",
  "rescheduled",
];

type SP = {
  status?: string;
  from?: string;
  to?: string;
  event_type?: string | string[];
  q?: string;
  page?: string;
};

// Next.js 16 lock: searchParams is a Promise — must be awaited (Phase 3 lock).
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const statusFilter: BookingStatusFilter = VALID_STATUSES.includes(
    (sp.status ?? "") as BookingStatusFilter,
  )
    ? (sp.status as BookingStatusFilter)
    : "upcoming";
  const eventTypeIds = Array.isArray(sp.event_type)
    ? sp.event_type
    : sp.event_type
      ? [sp.event_type]
      : [];

  const [{ rows, total }, eventTypes] = await Promise.all([
    queryBookings({
      statusFilter,
      from: sp.from ?? null,
      to: sp.to ?? null,
      eventTypeIds,
      q: sp.q ?? null,
      page,
      pageSize: PAGE_SIZE,
    }),
    listEventTypesForFilter(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} {total === 1 ? "booking" : "bookings"} matching current filters
        </p>
      </header>
      <BookingsFilters
        initial={{
          status: statusFilter,
          from: sp.from ?? "",
          to: sp.to ?? "",
          eventTypeIds,
          q: sp.q ?? "",
        }}
        eventTypes={eventTypes}
      />
      <BookingsTable rows={rows} />
      <BookingsPagination page={page} totalPages={totalPages} />
    </div>
  );
}
