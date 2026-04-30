import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BookingRow } from "../_lib/queries";

// Status badge color (CONTEXT.md decision):
//   confirmed   → green (Tailwind raw classes for v1; status-only signal)
//   cancelled   → red   (uses shadcn destructive variant for token alignment)
//   rescheduled → amber (Tailwind raw classes; no warning variant in shadcn v4)
// Row text styling is unchanged across statuses — color carries the entire
// signal (CONTEXT lock: no strikethrough, no opacity dim on the row itself).
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

function formatBookerStart(row: BookingRow): string {
  // Phase 4 lock: show times in BOOKER's timezone on owner surfaces — this
  // matches the times in confirmation/reminder emails. Showing the OWNER's
  // timezone on this list would mislead the owner about what the booker sees.
  const z = new TZDate(new Date(row.start_at), row.booker_timezone);
  return format(z, "MMM d, yyyy 'at' h:mm a (zzz)");
}

export function BookingsTable({ rows }: { rows: BookingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
        <p className="text-base font-medium">No bookings match these filters</p>
        <p className="text-sm text-muted-foreground mt-2">
          Try widening the date range or selecting &ldquo;All&rdquo; status.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booker</TableHead>
            <TableHead className="w-40">Phone</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Start time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const eventName = row.event_types?.name ?? "(deleted event type)";
            const duration = row.event_types?.duration_minutes;
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-accent/50"
              >
                <TableCell>
                  <Link
                    href={`/app/bookings/${row.id}`}
                    className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    <div className="font-medium">{row.booker_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.booker_email}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/app/bookings/${row.id}`}
                    className="block focus:outline-none"
                  >
                    {row.booker_phone ? (
                      <a
                        href={`tel:${row.booker_phone}`}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.booker_phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/app/bookings/${row.id}`}
                    className="block focus:outline-none"
                  >
                    <div className="font-medium">{eventName}</div>
                    {typeof duration === "number" ? (
                      <div className="text-xs text-muted-foreground">
                        {duration} min
                      </div>
                    ) : null}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/app/bookings/${row.id}`}
                    className="flex items-center gap-2 focus:outline-none"
                  >
                    <span className="text-sm">{formatBookerStart(row)}</span>
                    <Badge
                      className={cn(
                        "capitalize",
                        statusBadgeClass(row.status),
                      )}
                    >
                      {row.status}
                    </Badge>
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
