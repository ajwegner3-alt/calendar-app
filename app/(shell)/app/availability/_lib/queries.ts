import "server-only";

import { TZDate } from "@date-fns/tz";

import { createClient } from "@/lib/supabase/server";

import type {
  AvailabilityState,
  AccountSettingsRow,
  AvailabilityRuleRow,
  DateOverrideRow,
} from "./types";

/**
 * Phase 32 (AVAIL-06): a confirmed booking projected to be cancelled by an
 * inverse-override save. Surfaced in the editor preview list AND re-queried
 * post-write inside commitInverseOverrideAction for race-safety.
 */
export interface AffectedBooking {
  id: string;
  start_at: string; // UTC ISO
  end_at: string;
  booker_name: string;
  event_type_name: string;
}

/**
 * Generic supabase client type used by this module's helpers. Matches the
 * shape returned by `createClient()` in lib/supabase/server.ts (RLS-scoped
 * server client) AND createAdminClient() in lib/supabase/admin.ts (service
 * role) — both expose the same chainable .from(...).select(...) API at the
 * call sites we need.
 */
type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolve the current owner's account_id via the SETOF uuid RPC.
 *
 * Phase 2-04 confirmed supabase-js returns this as a flat string array.
 * Single-tenant v1 → exactly one element when authenticated.
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_owner_account_ids");
  if (error) return null;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as string;
}

/**
 * Load the full availability state for the owner's account.
 *
 * Returns null if the user is not linked to any account (Plan 04-04 + 04-05's
 * page.tsx should redirect / show an unlinked-state if null).
 *
 * Three queries run in parallel via Promise.all (they share no dependencies on
 * each other's result — RESEARCH suggests no need for transactional reads,
 * RLS is sufficient).
 *
 * availability_rules ordered by (day_of_week, start_minute) — UI consumes
 * pre-grouped, pre-sorted; saves a client-side sort.
 *
 * date_overrides ordered by (override_date, start_minute) with nullsFirst so
 * the is_closed row (start_minute NULL) comes first for any date — defensive
 * against the mixed-rows case (RESEARCH Pitfall 5).
 */
export async function loadAvailabilityState(): Promise<AvailabilityState | null> {
  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return null;

  const [accountRes, rulesRes, overridesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "min_notice_hours, max_advance_days, daily_cap, timezone",
      )
      .eq("id", accountId)
      .single(),
    supabase
      .from("availability_rules")
      .select("id, account_id, day_of_week, start_minute, end_minute, created_at")
      .eq("account_id", accountId)
      .order("day_of_week", { ascending: true })
      .order("start_minute", { ascending: true }),
    supabase
      .from("date_overrides")
      .select(
        "id, account_id, override_date, is_closed, start_minute, end_minute, note, created_at",
      )
      .eq("account_id", accountId)
      .order("override_date", { ascending: true })
      .order("start_minute", { ascending: true, nullsFirst: true }),
  ]);

  if (accountRes.error || !accountRes.data) return null;

  return {
    account: accountRes.data as AccountSettingsRow,
    rules: (rulesRes.data ?? []) as AvailabilityRuleRow[],
    overrides: (overridesRes.data ?? []) as DateOverrideRow[],
  };
}

/**
 * Phase 32 (AVAIL-06): Find confirmed bookings on `overrideDate` whose
 * `start_at` falls inside any of the proposed `unavailableWindows`.
 *
 * Filtering is done in JS using the account timezone — same TZDate pattern
 * used elsewhere (e.g. countBookingsOnLocalDate in lib/slots.ts). The DB
 * filter widens to a UTC day window because the local-day boundary in
 * `accountTimezone` may span ~25–26 UTC hours due to DST edges; the JS
 * filter then narrows back to exact local-date match.
 *
 * Used by:
 *   - The editor UI (Plan 32-02) to render the live "this will cancel N
 *     bookings" preview before the owner clicks Save.
 *   - commitInverseOverrideAction (Plan 32-03) for the post-write race-safe
 *     re-query — any booking that snuck in between preview and commit is
 *     also captured.
 *
 * @param supabase RLS-scoped server client OR admin client (same API)
 * @param accountId account UUID
 * @param overrideDate "YYYY-MM-DD" in account timezone
 * @param unavailableWindows the windows the owner proposes to block
 * @param accountTimezone IANA tz (e.g. "America/Chicago")
 * @returns confirmed bookings whose start_at is inside any unavailable
 *          window, sorted chronologically by start_at
 */
export async function getAffectedBookings(
  supabase: SupabaseLike,
  accountId: string,
  overrideDate: string,
  unavailableWindows: Array<{ start_minute: number; end_minute: number }>,
  accountTimezone: string,
): Promise<AffectedBooking[]> {
  if (unavailableWindows.length === 0) return [];

  // Widen by ~24h on each side of the UTC date to safely cover any timezone
  // offset (UTC-12 .. UTC+14) plus DST edges. JS-side filter narrows back
  // to exact local-date match in `accountTimezone`.
  const startProbe = new Date(`${overrideDate}T00:00:00.000Z`);
  startProbe.setUTCDate(startProbe.getUTCDate() - 1);
  const endProbe = new Date(`${overrideDate}T00:00:00.000Z`);
  endProbe.setUTCDate(endProbe.getUTCDate() + 2);

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, booker_name, event_types!inner(name)",
    )
    .eq("account_id", accountId)
    .eq("status", "confirmed")
    .gte("start_at", startProbe.toISOString())
    .lt("start_at", endProbe.toISOString());

  if (error) throw error;
  if (!data) return [];

  type BookingRow = {
    id: string;
    start_at: string;
    end_at: string;
    booker_name: string;
    event_types:
      | { name: string }
      | { name: string }[]
      | null;
  };

  return (data as unknown as BookingRow[])
    .filter((b) => {
      const localStart = new TZDate(new Date(b.start_at), accountTimezone);
      // Confirm we're on the override date in local TZ (handles DST edges).
      const localDate = `${localStart.getFullYear()}-${String(
        localStart.getMonth() + 1,
      ).padStart(2, "0")}-${String(localStart.getDate()).padStart(2, "0")}`;
      if (localDate !== overrideDate) return false;
      const startMinute =
        localStart.getHours() * 60 + localStart.getMinutes();
      return unavailableWindows.some(
        (w) => startMinute >= w.start_minute && startMinute < w.end_minute,
      );
    })
    .map((b) => {
      const et = Array.isArray(b.event_types)
        ? b.event_types[0]
        : b.event_types;
      return {
        id: b.id,
        start_at: b.start_at,
        end_at: b.end_at,
        booker_name: b.booker_name,
        event_type_name: et?.name ?? "Unknown",
      };
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
}
