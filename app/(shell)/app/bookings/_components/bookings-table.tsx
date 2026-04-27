import type { BookingRow } from "../_lib/queries";

// Stub — fleshed out in Task 2.
export function BookingsTable({ rows }: { rows: BookingRow[] }) {
  return (
    <div data-slot="bookings-table-stub">
      {rows.length} rows
    </div>
  );
}
