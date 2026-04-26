"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/bookings/cancel";

/**
 * Server Action result shape — narrow discriminated union.
 *
 * - `{ ok: true }`  — booking was cancelled. Caller flips the dialog closed and toasts success.
 *                      revalidatePath(...) inside the action ensures the next render shows the
 *                      cancelled-state read-only banner (no optimistic UI per CONTEXT lock).
 * - `{ error }`     — anything that prevented the cancel. Caller toasts the message; the dialog
 *                      stays open so the owner can retry or cancel out.
 */
export type CancelBookingAsOwnerResult = { ok: true } | { error: string };

/**
 * OWNER-SIDE cancel.
 *
 * Two-step pipeline (RLS auth → shared function delegate). The shared cancelBooking()
 * (Plan 06-03) is a service-role module that trusts its bookingId arg — meaning IT
 * does no ownership check. We MUST do the ownership check here before delegating,
 * otherwise any logged-in owner could cancel any other account's booking by guessing
 * a UUID.
 *
 * The RLS policies on `bookings` (Phase 1) restrict SELECT to the authenticated owner's
 * account, so a missing row at the auth-check step means "not yours OR doesn't exist" —
 * either way we return a benign "Booking not found." (we do NOT distinguish 404 from 403
 * to avoid leaking other-account UUIDs).
 *
 * On success we delegate to cancelBooking({ actor: 'owner', reason, ip: null, appUrl }):
 *  - actor: 'owner' selects the apologetic + re-book-link booker email branch (Plan 06-02)
 *  - ip: null because Server Actions don't have request headers; audit row tolerates null
 *  - appUrl: from env (NEXT_PUBLIC_APP_URL ?? VERCEL_URL ?? localhost) — Server Actions
 *           can't reach req.nextUrl so we read env directly
 *  - reason: normalized — empty string or whitespace-only becomes undefined so the
 *           booker email omits the reason row entirely (Plan 06-02 EMAIL-07 lock)
 */
export async function cancelBookingAsOwner(
  bookingId: string,
  reason?: string,
): Promise<CancelBookingAsOwnerResult> {
  // ── 1. RLS-scoped ownership check ───────────────────────────────────────
  // Phase 1 RLS policies restrict bookings SELECT to the authenticated owner's
  // account_id. If this returns null, the booking either doesn't exist OR belongs
  // to a different account — both map to "not found" from the owner's POV.
  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (lookupError) {
    console.error("[cancelBookingAsOwner] lookup error:", lookupError);
    return { error: "Cancel failed. Please try again." };
  }
  if (!existing) {
    return { error: "Booking not found." };
  }

  // ── 2. Normalize reason ─────────────────────────────────────────────────
  const trimmedReason = reason?.trim();
  const normalizedReason =
    trimmedReason && trimmedReason.length > 0 ? trimmedReason : undefined;

  // ── 3. Resolve appUrl (no req in a Server Action) ───────────────────────
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  // ── 4. Delegate to shared cancelBooking() — single source of truth ──────
  // This is the SAME function that /api/cancel (Plan 06-04) calls. The only
  // difference between the booker path and the owner path is the `actor` field
  // (and that the booker path also passes a captured IP). All email + audit +
  // dead-hash invalidation logic lives in cancelBooking(); we do NOT duplicate it.
  const result = await cancelBooking({
    bookingId,
    actor: "owner",
    reason: normalizedReason,
    appUrl,
    ip: null,
  });

  if (!result.ok) {
    if (result.reason === "not_active") {
      return {
        error:
          "This booking is no longer active. It may have already been cancelled.",
      };
    }
    // db_error and any other unexpected failure
    return { error: "Cancel failed. Please try again." };
  }

  // ── 5. Refresh the detail page so the cancelled-state branch renders ────
  revalidatePath(`/app/bookings/${bookingId}`);

  return { ok: true };
}
