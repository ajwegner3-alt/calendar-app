import "server-only";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/lib/supabase/server";

/**
 * Phase 33 (PUSH-02, PUSH-03): A confirmed booking returned by the pushback
 * query. Includes event_types join fields needed for cascade math (33-02) and
 * the CAS guard token needed by commitPushbackAction (33-03).
 */
export interface PushbackBooking {
  id: string;
  start_at: string; // UTC ISO
  end_at: string; // UTC ISO
  status: "confirmed"; // narrowed
  booker_first_name: string;
  booker_email: string;
  duration_minutes: number; // from event_types join
  buffer_after_minutes: number; // from event_types join
  event_type_id: string;
  event_type_name: string; // for owner-facing display
  reschedule_token_hash: string; // 33-03 CAS guard pre-fetch
}

/**
 * Minimal SupabaseLike type for this module — same shape as createClient() return.
 */
type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/**
 * Phase 33 (PUSH-02): Fetch confirmed bookings for a single local date
 * (in accountTimezone), with event_types join for cascade math.
 *
 * Uses the canonical TZDate day-window pattern from Phase 32
 * `getAffectedBookings()` in app/(shell)/app/availability/_lib/queries.ts:
 * convert the local midnight in accountTimezone to UTC boundaries, then query
 * on start_at. Results are sorted chronologically ascending so the caller can
 * directly render them in order.
 *
 * @param supabase RLS-scoped server client
 * @param params.accountId account UUID
 * @param params.dateIsoYmd "YYYY-MM-DD" in account timezone
 * @param params.accountTimezone IANA tz (e.g. "America/Chicago")
 */
export async function getBookingsForPushback(
  supabase: SupabaseLike,
  params: { accountId: string; dateIsoYmd: string; accountTimezone: string },
): Promise<PushbackBooking[]> {
  // Compute UTC day-window bounds from the local date in accountTimezone.
  // TZDate interprets the string as local-midnight in the given zone.
  const localMidnight = new TZDate(
    `${params.dateIsoYmd}T00:00:00`,
    params.accountTimezone,
  );
  const dayStartUtc = localMidnight.toISOString();
  const dayEndUtc = new TZDate(
    localMidnight.getTime() + 24 * 60 * 60 * 1000,
    params.accountTimezone,
  ).toISOString();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      start_at,
      end_at,
      status,
      booker_first_name,
      booker_email,
      reschedule_token_hash,
      event_type_id,
      event_types!inner ( id, name, duration_minutes, buffer_after_minutes )
    `,
    )
    .eq("account_id", params.accountId)
    .eq("status", "confirmed")
    .gte("start_at", dayStartUtc)
    .lt("start_at", dayEndUtc)
    .order("start_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    // Normalize join cardinality (same defensive pattern as queryBookings).
    const et = Array.isArray(row.event_types)
      ? row.event_types[0]
      : row.event_types;
    return {
      id: row.id,
      start_at: row.start_at,
      end_at: row.end_at,
      status: "confirmed" as const,
      booker_first_name: row.booker_first_name,
      booker_email: row.booker_email,
      reschedule_token_hash: row.reschedule_token_hash,
      event_type_id: row.event_type_id,
      duration_minutes: et.duration_minutes,
      buffer_after_minutes: et.buffer_after_minutes,
      event_type_name: et.name,
    };
  });
}

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

/**
 * Phase 31 (EMAIL-24): count bookings whose confirmation email was refused by
 * the quota guard for the given account. Backed by the partial index
 * `bookings_confirmation_email_unsent_idx` (Plan 31-01) — keeps this cheap
 * even at high booking volume because the index only covers
 * confirmation_email_sent=false rows.
 *
 * Used by the /app/bookings dashboard banner. Does NOT filter by date so the
 * owner sees the full backlog of unsent confirmations.
 *
 * Returns 0 on error (banner self-suppresses) — a transient DB hiccup must
 * NOT swallow the rest of the page.
 */
export async function countUnsentConfirmations(accountId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("confirmation_email_sent", false);
  if (error) {
    console.error("[BOOKINGS_QUERY_FAILED] countUnsentConfirmations", {
      account_id: accountId,
      error: error.message,
    });
    return 0;
  }
  return count ?? 0;
}
