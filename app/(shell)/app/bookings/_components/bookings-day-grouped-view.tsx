/**
 * Phase 33 Plan 01 — BookingsDayGroupedView.
 *
 * Renders upcoming confirmed bookings grouped by local date in accountTimezone,
 * with a per-day section header showing the date label and a Pushback shortcut
 * button. Replaces <BookingsTable> only when statusFilter === "upcoming".
 *
 * This component is server-renderable (no "use client" directive) because:
 *   - TZDate is used for date computation (same pattern as availability queries)
 *   - PushbackDaySectionButton IS a client component but is imported as a leaf
 *     — the RSC boundary is at the button level, not here (Phase 26 pattern)
 *
 * BookingRow.booker_name is used for display (Phase 4 convention).
 * Times are shown in the BOOKER's timezone (matching BookingsTable pattern per
 * Phase 4 lock comment in bookings-table.tsx: "show times in BOOKER's timezone
 * on owner surfaces — this matches the times in confirmation/reminder emails").
 */

import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookingRow } from "../_lib/queries";
import { PushbackDaySectionButton } from "./pushback-dialog-provider";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BookingsDayGroupedViewProps {
  /** Already-fetched bookings (all upcoming, sorted ascending by start_at). */
  bookings: BookingRow[];
  /** IANA tz string — used for grouping by local date. */
  accountTimezone: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the local YYYY-MM-DD key for a booking's start_at in accountTimezone.
 * Used for grouping — same TZDate pattern as availability queries.
 */
function localDayKey(startAtIso: string, timezone: string): string {
  const local = new TZDate(new Date(startAtIso), timezone);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

/**
 * Render a human-friendly day label like "Mon, May 6".
 * Intl.DateTimeFormat with the account timezone ensures the label matches the
 * local date, not the UTC date (handles bookings near midnight correctly).
 */
function formatDayLabel(ymd: string, timezone: string): string {
  // Parse to a UTC midnight for the local date then format in the account TZ.
  // Using Date.UTC avoids the UTC-date-parsing ambiguity for "YYYY-MM-DD" strings.
  const [y, m, d] = ymd.split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // noon UTC
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(utcMidnight);
}

/** Format a booking's start time in BOOKER timezone (Phase 4 lock). */
function formatBookerStart(row: BookingRow): string {
  const z = new TZDate(new Date(row.start_at), row.booker_timezone);
  return format(z, "MMM d, yyyy 'at' h:mm a (zzz)");
}

/** Status badge class (copied from bookings-table.tsx for visual consistency). */
function statusBadgeClass(status: BookingRow["status"]): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-800 border-transparent";
    case "cancelled":
      return "bg-red-100 text-red-800 border-transparent";
    case "rescheduled":
      return "bg-amber-100 text-amber-800 border-transparent";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookingsDayGroupedView({
  bookings,
  accountTimezone,
}: BookingsDayGroupedViewProps) {
  // Group bookings by local day in accountTimezone.
  // Using a Map preserves insertion order (bookings already sorted ascending).
  const groups = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const key = localDayKey(b.start_at, accountTimezone);
    const arr = groups.get(key);
    if (arr) {
      arr.push(b);
    } else {
      groups.set(key, [b]);
    }
  }
  const orderedKeys = [...groups.keys()].sort(); // lexicographic YYYY-MM-DD sort

  if (orderedKeys.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-base font-medium">No upcoming bookings</p>
        <p className="text-sm text-muted-foreground mt-2">
          New bookings will appear here when they&apos;re confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orderedKeys.map((dayKey) => {
        const dayBookings = groups.get(dayKey)!;
        const label = formatDayLabel(dayKey, accountTimezone);

        return (
          <section key={dayKey} aria-label={label}>
            {/* Day section header — date label (left) + Pushback button (right) */}
            <div className="flex items-center justify-between mb-2 pb-1 border-b">
              <h2 className="text-sm font-semibold">{label}</h2>
              {/* PushbackDaySectionButton is a client component; the RSC
                  boundary is here (it accesses usePushbackDialog context). */}
              <PushbackDaySectionButton date={dayKey} />
            </div>

            {/* Booking rows for this day */}
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
              <ul className="divide-y" role="list">
                {dayBookings.map((row) => {
                  const eventName =
                    row.event_types?.name ?? "(deleted event type)";
                  const duration = row.event_types?.duration_minutes;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/app/bookings/${row.id}`}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {/* Booker */}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {row.booker_name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {row.booker_email}
                          </div>
                        </div>

                        {/* Event */}
                        <div className="hidden sm:block min-w-0 w-36 shrink-0">
                          <div className="font-medium truncate text-sm">
                            {eventName}
                          </div>
                          {typeof duration === "number" ? (
                            <div className="text-xs text-muted-foreground">
                              {duration} min
                            </div>
                          ) : null}
                        </div>

                        {/* Time + status badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm">
                            {formatBookerStart(row)}
                          </span>
                          <Badge
                            className={cn(
                              "capitalize",
                              statusBadgeClass(row.status),
                            )}
                          >
                            {row.status}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
