import { TZDate } from "@date-fns/tz";
import { createClient } from "@/lib/supabase/server";
import {
  queryBookings,
  listEventTypesForFilter,
  countUnsentConfirmations,
} from "./_lib/queries";
import type { BookingStatusFilter } from "./_lib/queries";
import { BookingsTable } from "./_components/bookings-table";
import { BookingsDayGroupedView } from "./_components/bookings-day-grouped-view";
import { BookingsFilters } from "./_components/bookings-filters";
import { BookingsPagination } from "./_components/bookings-pagination";
import { UnsentConfirmationsBanner } from "./_components/unsent-confirmations-banner";
import {
  PushbackDialogProvider,
  PushbackHeaderButton,
} from "./_components/pushback-dialog-provider";

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
  // Phase 33: also fetch timezone for pushback dialog (threaded as serializable
  // string prop — no browser timezone involved, consistent with Phase 32 lock).
  let accountTimezone = "America/Chicago"; // project-standard default
  if (ownerSub) {
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, timezone")
      .eq("owner_user_id", ownerSub)
      .is("deleted_at", null)
      .limit(1);
    accountId = accounts?.[0]?.id ?? null;
    if (accounts?.[0]?.timezone) {
      accountTimezone = accounts[0].timezone as string;
    }
  }

  // Phase 33: compute today YYYY-MM-DD in the account's timezone for the
  // pushback dialog default date. Uses TZDate — same idiom as Phase 32.
  const todayTzDate = new TZDate(new Date(), accountTimezone);
  const todayIsoYmd = `${todayTzDate.getFullYear()}-${String(todayTzDate.getMonth() + 1).padStart(2, "0")}-${String(todayTzDate.getDate()).padStart(2, "0")}`;

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

  // Phase 33: day-grouped view for the "upcoming" filter (CONTEXT.md decision).
  // All other filters keep the flat paginated BookingsTable.
  const isUpcomingFilter = statusFilter === "upcoming";

  return (
    <PushbackDialogProvider
      accountId={accountId ?? ""}
      accountTimezone={accountTimezone}
      todayIsoYmd={todayIsoYmd}
    >
      <div className="max-w-6xl flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {total} {total === 1 ? "booking" : "bookings"} matching current
              filters
            </p>
          </div>
          {/* Phase 33: header-level Pushback button — client component leaf
              inside the PushbackDialogProvider tree; opens dialog with today
              pre-selected. Positioned right via flex justify-between. */}
          <PushbackHeaderButton todayIsoYmd={todayIsoYmd} />
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
        {isUpcomingFilter ? (
          /* Phase 33: day-grouped layout with per-day Pushback shortcuts */
          <BookingsDayGroupedView
            bookings={rows}
            accountTimezone={accountTimezone}
          />
        ) : (
          <>
            <BookingsTable rows={rows} />
            <BookingsPagination page={page} totalPages={totalPages} />
          </>
        )}
      </div>
    </PushbackDialogProvider>
  );
}
