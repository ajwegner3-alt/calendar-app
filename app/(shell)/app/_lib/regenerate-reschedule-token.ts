"use server";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/bookings/tokens"; // VERIFIED export — see lib/bookings/tokens.ts:21
import { revalidatePath } from "next/cache";

interface ActionResult {
  ok: boolean;
  rawToken?: string;
  error?: string;
}

/**
 * OWNER-INITIATED reschedule token rotation.
 *
 * Mints a fresh reschedule token, stores its SHA-256 hash in
 * bookings.reschedule_token_hash, and returns the raw token to the caller
 * (12-04b DayDetailRow will display it in an AlertDialog and offer copy).
 *
 * Side effect: the previously-emailed reschedule link is INVALIDATED because
 * its stored hash no longer matches. This matches Phase 8 cron precedent
 * (token rotation on every reminder send). The caller (12-04b AlertDialog)
 * must warn the owner before invoking.
 *
 * Token minting primitive:
 *   - NO `mintRescheduleToken` helper exists.
 *   - `generateBookingTokens()` mints both cancel + reschedule — overshoots scope.
 *   - We compose existing crypto.randomUUID() + hashToken() directly.
 *
 * Authorization follows cancelBookingAsOwner pattern:
 *   1. getClaims() — bail on unauthenticated
 *   2. Inline accounts SELECT — bail on missing account
 *   3. Booking ownership guard via event_types FK join
 */
export async function regenerateRescheduleTokenAction(
  bookingId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return { ok: false, error: "unauthenticated" };

  // VERIFIED CANONICAL PATTERN — inline accounts lookup.
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("owner_user_id", claimsData.claims.sub)
    .is("deleted_at", null)
    .limit(1);
  const accountId = accounts?.[0]?.id;
  if (!accountId) return { ok: false, error: "no account" };

  // Belt-and-suspenders ownership check: booking belongs to this account
  // (RLS-scoped + explicit guard via event_types FK join).
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_types!inner(account_id)")
    .eq("id", bookingId)
    .eq("event_types.account_id", accountId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "not found" };

  // Mint a NEW reschedule token. NO `mintRescheduleToken` helper exists —
  // generateBookingTokens() mints both cancel + reschedule, but we only want
  // reschedule. Replicate its primitive: crypto.randomUUID() + hashToken().
  const rawToken = crypto.randomUUID();
  const hash = await hashToken(rawToken);

  const { error } = await supabase
    .from("bookings")
    .update({ reschedule_token_hash: hash })
    .eq("id", bookingId);

  if (error) return { ok: false, error: "db_error" };

  revalidatePath("/app");
  return { ok: true, rawToken };
}
