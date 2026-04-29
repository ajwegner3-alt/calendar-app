"use client";

import { useState } from "react";
import { HomeCalendar } from "./home-calendar";
import { DayDetailSheet } from "./day-detail-sheet";
import type { MonthBooking } from "../_lib/load-month-bookings";

interface HomeDashboardProps {
  bookings: MonthBooking[];
  /** IANA timezone string, forwarded to DayDetailSheet and DayDetailRow */
  accountTimezone: string;
}

/**
 * HomeDashboard
 *
 * Client wrapper that owns the day-detail drawer open/close state.
 * Renders HomeCalendar and DayDetailSheet as siblings; connects
 * HomeCalendar's onDayClick to the drawer.
 *
 * State:
 *   - open: controls Sheet visibility
 *   - selectedDate: the day that was clicked (null when closed)
 *   - selectedBookings: bookings for that day ([] for empty-state branch)
 *
 * HomeCalendar calls onDayClick for every day click (including days with
 * zero bookings), so empty-state branch fires naturally.
 */
export function HomeDashboard({ bookings, accountTimezone }: HomeDashboardProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBookings, setSelectedBookings] = useState<MonthBooking[]>([]);

  function handleDayClick(date: Date, dayBookings: MonthBooking[]) {
    setSelectedDate(date);
    setSelectedBookings(dayBookings);
    setOpen(true);
  }

  return (
    <>
      <HomeCalendar bookings={bookings} onDayClick={handleDayClick} />
      <DayDetailSheet
        open={open}
        onOpenChange={setOpen}
        date={selectedDate}
        bookings={selectedBookings}
        accountTimezone={accountTimezone}
      />
    </>
  );
}
