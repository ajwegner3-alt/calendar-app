import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BookingStatusFilter =
  | "upcoming"
  | "all"
  | "confirmed"
  | "cancelled"
  | "rescheduled";

export interface BookingsQueryParams {
  statusFilter: BookingStatusFilter;
  from?: string | null; // ISO date string (yyyy-mm-dd) or null
  to?: string | null;
  eventTypeIds?: string[]; // multi-select
  q?: string | null; // free-text search
  page: number; // 1-based
  pageSize: number; // default 25
}

export interface BookingRow {
  id: string;
  start_at: string;
  end_at: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
  booker_timezone: string;
  event_types: {
    id: string;
    name: string;
    duration_minutes: number;
  };
}

export async function queryBookings(params: BookingsQueryParams): Promise<{
  rows: BookingRow[];
  total: number;
}> {
  const supabase = await createClient();
  const offset = (params.page - 1) * params.pageSize;

  let q = supabase
    .from("bookings")
    .select(
      `id, start_at, end_at, status, booker_name, booker_email, booker_phone, booker_timezone,
       event_types!inner(id, name, duration_minutes)`,
      { count: "exact" },
    )
    .order("start_at", { ascending: true })
    .range(offset, offset + params.pageSize - 1);

  // Status filter (CONTEXT.md decision: default = upcoming-only).
  // "upcoming" applies ONLY a time filter (start_at >= now); it does NOT
  // constrain status. Future cancelled/rescheduled bookings remain visible in
  // the upcoming view so the owner can see lifecycle changes that have
  // already happened to future bookings. Status filtering is user-controlled
  // via the dropdown (confirmed/cancelled/rescheduled options).
  if (params.statusFilter === "upcoming") {
    q = q.gte("start_at", new Date().toISOString());
  } else if (params.statusFilter !== "all") {
    q = q.eq("status", params.statusFilter);
  }

  if (params.from) q = q.gte("start_at", new Date(params.from).toISOString());
  if (params.to) {
    // Inclusive end-of-day for the to-date
    const toEnd = new Date(params.to);
    toEnd.setUTCHours(23, 59, 59, 999);
    q = q.lte("start_at", toEnd.toISOString());
  }

  if (params.eventTypeIds && params.eventTypeIds.length > 0) {
    q = q.in("event_type_id", params.eventTypeIds);
  }

  if (params.q && params.q.trim()) {
    const term = params.q.trim();
    // Sanitize for ilike (basic: escape % and _)
    const safe = term.replace(/[%_]/g, "\\$&");
    q = q.or(`booker_name.ilike.%${safe}%,booker_email.ilike.%${safe}%`);
  }

  const { data, count, error } = await q;
  if (error) throw error;

  // supabase-js join cardinality: event_types!inner returns either an object
  // or a single-element array depending on schema-cache state. Defensively
  // normalize to the object shape (matches Phase 5/6 lock).
  const rows = (data ?? []).map((row) => {
    const et = Array.isArray(row.event_types)
      ? row.event_types[0]
      : row.event_types;
    return {
      ...row,
      event_types: et,
    };
  }) as BookingRow[];

  return {
    rows,
    total: count ?? 0,
  };
}

export async function listEventTypesForFilter(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_types")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  return data ?? [];
}
