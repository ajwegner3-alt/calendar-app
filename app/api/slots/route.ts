/**
 * GET /api/slots — DST-safe slot computation API (AVAIL-08).
 *
 * Query params:
 *   - event_type_id (uuid, required)
 *   - from (YYYY-MM-DD local-date, required) — inclusive start of range
 *   - to   (YYYY-MM-DD local-date, required) — inclusive end of range
 *
 * Response:
 *   200 → { slots: Array<{ start_at: string; end_at: string; remaining_capacity?: number }> }   // UTC ISO
 *   400 → { error: string }   // missing/malformed params
 *   404 → { error: string }   // event_type or account not found
 *   500 → { error: string }   // unexpected DB error
 *
 * Forward contract for Phase 5: empty slots array == "no times available";
 * Phase 5 renders the friendly empty-state.
 *
 * Caching: NEVER. Both `dynamic = "force-dynamic"` (route-level) and
 * Cache-Control: no-store header (response-level). RESEARCH Pitfall 4 is
 * the canonical "why not cache" reasoning.
 *
 * Client: admin (service-role) — this endpoint is PUBLIC (hit by anon Phase 5
 * booking-page visitors with no auth session). RLS-scoped client would silently
 * return 0 rows for unauthenticated callers and break booking. Reads are
 * explicitly scoped to the resolved account_id. `import "server-only"` in
 * lib/supabase/admin.ts prevents misuse in client bundles.
 */

import { NextResponse, type NextRequest } from "next/server";

import { computeSlots } from "@/lib/slots";
import type {
  AvailabilityRuleRow,
  DateOverrideRow,
  BookingRow,
  AccountSettings,
} from "@/lib/slots.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const eventTypeId = sp.get("event_type_id") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  // ── Param validation ────────────────────────────────────────────────────
  if (!eventTypeId || !UUID_REGEX.test(eventTypeId)) {
    return NextResponse.json(
      { error: "event_type_id is required and must be a UUID." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!from || !DATE_REGEX.test(from)) {
    return NextResponse.json(
      { error: "from is required and must be YYYY-MM-DD." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!to || !DATE_REGEX.test(to)) {
    return NextResponse.json(
      { error: "to is required and must be YYYY-MM-DD." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from must be on or before to." },
      { status: 400, headers: NO_STORE },
    );
  }

  // Admin (service-role) client: /api/slots is a PUBLIC endpoint hit by
  // unauthenticated booking-page visitors (Phase 5). RLS would silently return
  // 0 rows for anon callers and break booking. We scope every query below to
  // the resolved account_id and select only the columns the engine consumes.
  const supabase = createAdminClient();

  // ── Step 1: load event_type to get duration + account_id + capacity fields ──
  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("id, account_id, duration_minutes, buffer_after_minutes, max_bookings_per_slot, show_remaining_capacity")
    .eq("id", eventTypeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError) {
    return NextResponse.json(
      { error: "Failed to load event type." },
      { status: 500, headers: NO_STORE },
    );
  }
  if (!eventType) {
    return NextResponse.json(
      { error: "Event type not found." },
      { status: 404, headers: NO_STORE },
    );
  }

  // ── Step 2: parallel-fetch account + rules + overrides + bookings ────────
  // Build the bookings range as full UTC days for safety. Account TZ is
  // unknown until the account query returns, but UTC bookends ±1 day around
  // the requested date range cover all possible TZ offsets without missing
  // an edge booking. The engine then filters precisely by local-date in the
  // account's timezone.
  const bookingsRangeStart = `${from}T00:00:00.000Z`;
  // To-end is exclusive in the engine's mental model but our query uses lte
  // for the upper bound on the next day, which captures all bookings that
  // start on or before the requested 'to' date in any TZ.
  const [accountRes, rulesRes, overridesRes, bookingsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "timezone, min_notice_hours, max_advance_days, daily_cap",
      )
      .eq("id", eventType.account_id)
      .single(),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_minute, end_minute")
      .eq("account_id", eventType.account_id),
    supabase
      .from("date_overrides")
      .select("override_date, is_closed, start_minute, end_minute")
      .eq("account_id", eventType.account_id)
      .gte("override_date", from)
      .lte("override_date", to),
    supabase
      .from("bookings")
      // Phase 28 LD-04: join event_types so each booking row carries its own
      // event type's post-event buffer (used asymmetrically in the slot engine).
      .select("start_at, end_at, event_types!inner(buffer_after_minutes)")
      .eq("account_id", eventType.account_id)
      // Pitfall 4 fix (Plan 11-05): filter to confirmed only (NOT .neq('cancelled')).
      // The v1.0 .neq('cancelled') included 'rescheduled' rows, which over-blocked
      // slots freed by reschedule. After a reschedule the old slot should be re-bookable.
      // Semantic alignment: bookings_capacity_slot_idx ALSO uses WHERE status='confirmed'.
      .eq("status", "confirmed")
      // Bookings range padded by ±1 day around requested range to cover
      // TZ-edge bookings (e.g. a Chicago-local 11pm booking on `from` is a
      // UTC date later than `from`). The engine then filters precisely.
      .gte("start_at", bookingsRangeStart)
      .lte("start_at", `${to}T23:59:59.999Z`),
  ]);

  if (accountRes.error || !accountRes.data) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404, headers: NO_STORE },
    );
  }

  const account: AccountSettings = {
    timezone: accountRes.data.timezone,
    min_notice_hours: accountRes.data.min_notice_hours,
    max_advance_days: accountRes.data.max_advance_days,
    daily_cap: accountRes.data.daily_cap,
  };
  const rules: AvailabilityRuleRow[] = (rulesRes.data ?? []).map((r) => ({
    day_of_week: r.day_of_week,
    start_minute: r.start_minute,
    end_minute: r.end_minute,
  }));
  const overrides: DateOverrideRow[] = (overridesRes.data ?? []).map((o) => ({
    override_date: o.override_date,
    is_closed: o.is_closed,
    start_minute: o.start_minute,
    end_minute: o.end_minute,
  }));
  const bookings: BookingRow[] = (bookingsRes.data ?? []).map((b) => {
    // Phase 28 LD-04: per-booking post-buffer comes from the joined event_types
    // row. Supabase's generated types model the join as either a single object
    // or an array (depending on inferred relationship cardinality); the actual
    // runtime shape for `event_types!inner(...)` on a many-to-one FK is a
    // single object. Normalize both shapes defensively. Defaults to 0 if the
    // join is somehow null/missing.
    const et = b.event_types as
      | { buffer_after_minutes: number }
      | { buffer_after_minutes: number }[]
      | null
      | undefined;
    const bufferAfter = Array.isArray(et)
      ? (et[0]?.buffer_after_minutes ?? 0)
      : (et?.buffer_after_minutes ?? 0);
    return {
      start_at: b.start_at,
      end_at: b.end_at,
      buffer_after_minutes: bufferAfter,
    };
  });

  // ── Step 3: compute and return ──────────────────────────────────────────
  const slots = computeSlots({
    rangeStart: from,
    rangeEnd: to,
    durationMinutes: eventType.duration_minutes,
    // Phase 28 LD-04: candidate event type's post-buffer (asymmetric — applied
    // to the candidate slot's own forward edge in the conflict check).
    slotBufferAfterMinutes: eventType.buffer_after_minutes,
    account,
    rules,
    overrides,
    bookings,
    now: new Date(),
    // CAP-04 + CAP-08 (Plan 11-05): pass capacity fields from event_types row.
    maxBookingsPerSlot: eventType.max_bookings_per_slot,
    showRemainingCapacity: eventType.show_remaining_capacity,
  });

  return NextResponse.json({ slots }, { status: 200, headers: NO_STORE });
}
