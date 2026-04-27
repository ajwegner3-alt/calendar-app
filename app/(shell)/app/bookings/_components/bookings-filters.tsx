"use client";

import type { BookingStatusFilter } from "../_lib/queries";

interface FiltersInitial {
  status: BookingStatusFilter;
  from: string;
  to: string;
  eventTypeIds: string[];
  q: string;
}

// Stub — fleshed out in Task 3.
export function BookingsFilters({
  initial,
  eventTypes,
}: {
  initial: FiltersInitial;
  eventTypes: Array<{ id: string; name: string }>;
}) {
  return (
    <div data-slot="bookings-filters-stub">
      filters ({initial.status} / {eventTypes.length} types)
    </div>
  );
}
