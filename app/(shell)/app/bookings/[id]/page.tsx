import { notFound } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CancelButton } from "./_components/cancel-button";
import { OwnerNote } from "./_components/owner-note";
import { BookingHistory } from "./_components/booking-history";

// Next.js 16 lock (Phase 1 + Phase 3): params is a Promise — must be awaited.
export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // RLS-scoped fetch. Phase 1 policies restrict bookings SELECT to the
  // authenticated owner's account_id; foreign rows return zero results → 404.
  // Plan 08-07 extends the select with `owner_note` (added by 08-01 schema)
  // and additionally fetches booking_events for the history timeline.
  const supabase = await createClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, status, owner_note,
       booker_name, booker_email, booker_phone, booker_timezone, answers,
       cancelled_at, cancelled_by, created_at,
       event_types!inner(name, slug, duration_minutes, location),
       accounts!inner(name, slug, timezone)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !booking) {
    notFound();
  }

  // Defensive normalization — supabase-js join cardinality varies by FK direction
  // (Phase 5 + Phase 6 plans 06-03/06-04 lock this defensive shape). event_types
  // and accounts are 1:1 from bookings' perspective.
  const eventType = Array.isArray(booking.event_types)
    ? booking.event_types[0]
    : booking.event_types;
  const account = Array.isArray(booking.accounts)
    ? booking.accounts[0]
    : booking.accounts;

  // Booking history events — RLS-scoped (booking_events policies restrict to
  // authenticated owner's account_id, same as bookings). Ordered ASCending so
  // the timeline reads top-down: oldest at top, newest at bottom.
  const { data: rawEvents } = await supabase
    .from("booking_events")
    .select("id, event_type, occurred_at, metadata")
    .eq("booking_id", booking.id)
    .order("occurred_at", { ascending: true });

  const events = (rawEvents ?? []) as Array<{
    id: string;
    event_type: "created" | "cancelled" | "rescheduled" | "reminder_sent";
    occurred_at: string;
    metadata: Record<string, unknown> | null;
  }>;

  // Render scheduled time in BOTH zones — owner-primary (account.timezone) on
  // top, booker-secondary below. Mirrors the Phase 5 confirmed page pattern but
  // inverts primary/secondary because this is the owner surface.
  const startAccountTz = new TZDate(new Date(booking.start_at), account.timezone);
  const startBookerTz = new TZDate(
    new Date(booking.start_at),
    booking.booker_timezone,
  );
  const dateLineAccount = format(startAccountTz, "EEEE, MMMM d, yyyy");
  const timeLineAccount = format(startAccountTz, "h:mm a (z)");
  const timeLineBooker = format(startBookerTz, "h:mm a (z)");
  const scheduledLine = `${dateLineAccount}, ${timeLineAccount}`;

  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";
  const isPast = new Date(booking.start_at) <= new Date();
  const canCancel = isConfirmed && !isPast;

  // Cancellation banner copy (only shown when cancelled)
  const cancelledAtLine =
    isCancelled && booking.cancelled_at
      ? format(
          new TZDate(new Date(booking.cancelled_at), account.timezone),
          "MMM d, yyyy 'at' h:mm a (z)",
        )
      : null;
  const cancelledByLine =
    booking.cancelled_by === "owner"
      ? "by you"
      : booking.cancelled_by === "booker"
        ? "by the booker"
        : booking.cancelled_by === "system"
          ? "by the system"
          : "";

  // Custom-question answers as a key/value list — the answers JSONB is
  // shaped { [questionLabel]: stringAnswer } per Phase 5 schema.
  const answers = (booking.answers ?? {}) as Record<string, string>;
  const answerEntries = Object.entries(answers).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  );

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{eventType.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{scheduledLine}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Booker time: {timeLineBooker}
          </p>
        </div>
        {/* Action bar (Plan 08-07): preserves Phase 6 Cancel button + adds a
            kebab placeholder for future per-booking actions. The Cancel
            component itself is unchanged — only its container has changed. */}
        <div className="flex items-center gap-2">
          <Badge
            variant={
              isCancelled ? "destructive" : isConfirmed ? "default" : "secondary"
            }
          >
            {booking.status}
          </Badge>
          {canCancel ? (
            <CancelButton
              bookingId={booking.id}
              eventTypeName={eventType.name}
              scheduledLine={scheduledLine}
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="More actions"
                className="size-8"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* CONTEXT.md: kebab is currently empty in v1; placeholder
                  signals the slot exists for future per-booking actions
                  (manual reminder, mark no-show, etc). */}
              <DropdownMenuItem disabled>
                More actions coming soon
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {isCancelled ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            This booking was cancelled.
          </p>
          {cancelledAtLine ? (
            <p className="text-muted-foreground mt-1">
              Cancelled on {cancelledAtLine}
              {cancelledByLine ? ` ${cancelledByLine}` : ""}.
            </p>
          ) : null}
        </div>
      ) : null}

      {isConfirmed && isPast ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This appointment has already passed.
        </div>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Booker</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">
              Name
            </dt>
            <dd className="mt-0.5">{booking.booker_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">
              Email
            </dt>
            <dd className="mt-0.5">
              <a href={`mailto:${booking.booker_email}`} className="hover:underline">
                {booking.booker_email}
              </a>
            </dd>
          </div>
          {booking.booker_phone ? (
            <div>
              <dt className="text-xs uppercase text-muted-foreground tracking-wide">
                Phone
              </dt>
              <dd className="mt-0.5">
                {/* Plan 08-07: phone surfaces as tel: link for one-tap
                    dial from mobile devices. */}
                <a href={`tel:${booking.booker_phone}`} className="hover:underline">
                  {booking.booker_phone}
                </a>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase text-muted-foreground tracking-wide">
              Timezone
            </dt>
            <dd className="mt-0.5">{booking.booker_timezone}</dd>
          </div>
        </dl>

        {answerEntries.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold mt-6 mb-2">Custom answers</h3>
            <dl className="space-y-2 text-sm">
              {answerEntries.map(([q, a]) => (
                <div key={q}>
                  <dt className="text-xs uppercase text-muted-foreground tracking-wide">
                    {q}
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{a}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>

      {eventType.location ? (
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-2">Location</h2>
          <p className="text-sm whitespace-pre-line">{eventType.location}</p>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-2">Owner note</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Private to you — never shown to the booker.
        </p>
        <OwnerNote bookingId={booking.id} initialNote={booking.owner_note} />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-3">History</h2>
        <BookingHistory
          events={events}
          bookingCreatedAt={booking.created_at}
          accountTimezone={account.timezone}
        />
      </section>
    </div>
  );
}
