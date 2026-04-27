import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * Booking history timeline (Plan 08-07).
 *
 * Server Component (no interactivity). Renders booking_events ordered
 * ASCending by occurred_at.
 *
 * Synthesized "Created" entry (RESEARCH Pitfall 7):
 *   If `events` is empty OR no event of kind 'created' exists, prepend
 *   a synthesized entry derived from `bookingCreatedAt`. This keeps the
 *   timeline meaningful for legacy bookings that pre-date the Phase 1
 *   booking_events audit log (or for any booking where the 'created'
 *   row was never written for some reason).
 *
 * Timezone:
 *   This is the OWNER-facing dashboard surface. Render in the OWNER's
 *   account timezone (passed via `accountTimezone`) — same convention
 *   as the parent detail page header.
 */

type BookingEvent = {
  id: string;
  event_type: "created" | "cancelled" | "rescheduled" | "reminder_sent";
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

const EVENT_LABELS: Record<BookingEvent["event_type"], string> = {
  created: "Created",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  reminder_sent: "Reminder sent",
};

interface BookingHistoryProps {
  events: BookingEvent[];
  bookingCreatedAt: string;
  accountTimezone: string;
}

export function BookingHistory({
  events,
  bookingCreatedAt,
  accountTimezone,
}: BookingHistoryProps) {
  // Synthesize a "Created" entry from bookings.created_at when no
  // event_type='created' row exists for this booking.
  const hasCreated = events.some((e) => e.event_type === "created");
  const timeline: BookingEvent[] = hasCreated
    ? events
    : [
        {
          id: "synthesized-created",
          event_type: "created",
          occurred_at: bookingCreatedAt,
          metadata: null,
        },
        ...events,
      ];

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No history yet.</p>
    );
  }

  return (
    <ol className="border-l border-border space-y-4 pl-4">
      {timeline.map((entry) => {
        const when = new TZDate(new Date(entry.occurred_at), accountTimezone);
        return (
          <li key={entry.id} className="relative">
            {/* Dot indicator on the left border */}
            <span
              aria-hidden
              className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-foreground/40"
            />
            <div className="text-sm font-medium">
              {EVENT_LABELS[entry.event_type] ?? entry.event_type}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(when, "MMM d, yyyy 'at' h:mm a (z)")}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
