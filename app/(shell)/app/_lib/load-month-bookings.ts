import "server-only";
import { startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";

export interface MonthBooking {
  id: string;
  start_at: string; // ISO timestamptz
  booker_name: string;
  booker_email: string;
  status: "confirmed" | "rescheduled" | "cancelled";
  event_type: { name: string };
  reschedule_token_hash: string | null; // exposed only so the action can confirm hash exists; raw token lives only in email
}

/**
 * Load confirmed bookings for a given calendar month, scoped to the currently
 * authenticated user's account.
 *
 * RLS already restricts reads to the owner's account; the explicit
 * event_types.account_id filter is defense-in-depth.
 *
 * Returns [] (not throws) on any auth/account miss — page.tsx guards
 * for redirects before calling this, so empty array is the correct
 * fallback for edge cases (e.g. mid-request sign-out).
 */
export async function loadMonthBookings(month: Date): Promise<MonthBooking[]> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return [];

  // VERIFIED CANONICAL PATTERN — inline accounts lookup (no helper wrapper exists).
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", claimsData.claims.sub)
    .is("deleted_at", null)
    .limit(1);
  const accountId = accounts?.[0]?.id;
  if (!accountId) return [];

  const from = startOfMonth(month).toISOString();
  const to = endOfMonth(month).toISOString();

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, start_at, booker_name, booker_email, status, reschedule_token_hash, event_types!inner(name, account_id)",
    )
    .eq("event_types.account_id", accountId)
    .eq("status", "confirmed")
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    id: row.id,
    start_at: row.start_at,
    booker_name: row.booker_name,
    booker_email: row.booker_email,
    status: row.status,
    reschedule_token_hash: row.reschedule_token_hash,
    event_type: { name: row.event_types?.name ?? "" },
  }));
}
