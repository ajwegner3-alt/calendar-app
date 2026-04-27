"use client";

// Stub — fleshed out in Task 3.
export function BookingsPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  return (
    <div data-slot="bookings-pagination-stub">
      page {page} of {totalPages}
    </div>
  );
}
