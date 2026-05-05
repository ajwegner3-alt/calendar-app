import { createClient } from "@/lib/supabase/server";
import {
  queryBookings,
  listEventTypesForFilter,
  countUnsentConfirmations,
} from "./_lib/queries";
import type { BookingStatusFilter } from "./_lib/queries";
import { BookingsTable } from "./_components/bookings-table";
import { BookingsFilters } from "./_components/bookings-filters";
import { BookingsPagination } from "./_components/bookings-pagination";
import { UnsentConfirmationsBanner } from "./_components/unsent-confirmations-banner";

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

  // Phase 31 (EMAIL-24): resolve accountId via the canonical inline accounts
  // lookup (matches load-month-bookings.ts pattern) so countUnsentConfirmations
  // can scope to this account. The bookings table itself is RLS-scoped, but
  // the count helper takes accountId explicitly — defense in depth + index hit.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const ownerSub = claimsData?.claims?.sub;
  let accountId: string | null = null;
  if (ownerSub) {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("owner_user_id", ownerSub)
      .is("deleted_at", null)
      .limit(1);
    accountId = accounts?.[0]?.id ?? null;
  }

  const [{ rows, total }, eventTypes, unsentCount] = await Promise.all([
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
    accountId ? countUnsentConfirmations(accountId) : Promise.resolve(0),
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
      {/* Phase 31 (EMAIL-24): self-suppressing banner — renders only when
          unsentCount > 0. No always-visible widget per locked CONTEXT decision. */}
      <UnsentConfirmationsBanner count={unsentCount} />
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
