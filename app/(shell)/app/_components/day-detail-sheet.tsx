"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { DayDetailRow } from "./day-detail-row";
import type { MonthBooking } from "../_lib/load-month-bookings";

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null when the sheet is closed — avoids stale date display during close animation */
  date: Date | null;
  /** Empty array triggers the empty-state branch */
  bookings: MonthBooking[];
  accountTimezone: string;
}

/**
 * DayDetailSheet
 *
 * Thin wrapper around shadcn Sheet that renders a list of DayDetailRow items
 * for a selected calendar day.
 *
 * - side="right" (default — suitable for desktop; Sheet handles full-height)
 * - Width override: "w-full sm:max-w-md" applied via className on SheetContent
 * - Empty state: when bookings.length === 0, shows "No bookings on this day."
 * - Date heading formatted via Intl.DateTimeFormat with account timezone
 */
export function DayDetailSheet({
  open,
  onOpenChange,
  date,
  bookings,
  accountTimezone,
}: DayDetailSheetProps) {
  const formattedDate = date
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: accountTimezone,
      }).format(date)
    : "";

  const count = bookings.length;
  const descriptionText =
    count === 0
      ? "No bookings on this day."
      : `${count} booking${count === 1 ? "" : "s"}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{formattedDate}</SheetTitle>
          <SheetDescription>{descriptionText}</SheetDescription>
        </SheetHeader>

        {count === 0 ? (
          <div className="px-4 py-12" />
        ) : (
          <div className="px-4 divide-y divide-border">
            {bookings.map((booking) => (
              <DayDetailRow
                key={booking.id}
                booking={booking}
                accountTimezone={accountTimezone}
              />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
