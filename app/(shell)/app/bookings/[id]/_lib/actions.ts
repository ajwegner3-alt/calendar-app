"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/bookings/cancel";
import { hashToken } from "@/lib/bookings/tokens";
import { sendReminderBooker } from "@/lib/email/send-reminder-booker";

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

// ---------------------------------------------------------------------------
// sendReminderForBookingAction
// ---------------------------------------------------------------------------

export type SendReminderForBookingResult = { ok: true } | { error: string };

/**
 * OWNER-INITIATED manual reminder send.
 *
 * Wraps the canonical reminder send path (sendReminderBooker — see
 * lib/email/send-reminder-booker.ts). Mirrors the cancelBookingAsOwner
 * authorization pattern: RLS-scoped accounts SELECT, then booking ownership
 * check via event_types FK join, then delegate to sendReminderBooker.
 *
 * RAW-TOKEN PROBLEM: sendReminderBooker requires {rawCancelToken, rawRescheduleToken}
 * (see SendReminderBookerArgs in lib/email/send-reminder-booker.ts), but the
 * DB stores ONLY hashes (Phase 6 contract). Phase 8's cron rotates tokens before
 * sending — we follow that precedent here:
 *   1. Mint fresh raw cancel + reschedule tokens via crypto.randomUUID().
 *   2. Hash both via hashToken() and persist to bookings.cancel_token_hash + reschedule_token_hash.
 *   3. Pass the freshly-minted RAW tokens to sendReminderBooker.
 *
 * Side effect: previously-emailed cancel/reschedule links are INVALIDATED because
 * their stored hashes are replaced. This matches Phase 8 cron behavior — accepted
 * per project pattern (STATE.md: "Token rotation on every reminder send").
 */
export async function sendReminderForBookingAction(
  bookingId: string,
): Promise<SendReminderForBookingResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return { error: "Not signed in." };

  // ── 1. Inline accounts lookup (canonical pattern — no helper wrapper) ───
  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "id, slug, name, logo_url, brand_primary, owner_email, reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links",
    )
    .eq("owner_user_id", claimsData.claims.sub)
    .is("deleted_at", null)
    .limit(1);
  const account = accounts?.[0];
  if (!account) return { error: "No account found." };

  // ── 2. Booking + event_type fetch + ownership guard ──────────────────────
  // Mirrors cancelBookingAsOwner ownership check but also loads full booking
  // data needed for the email.
  const { data: booking, error: lookupError } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, booker_name, booker_email, booker_timezone, answers, status, event_types!inner(name, duration_minutes, location, account_id)",
    )
    .eq("id", bookingId)
    .eq("event_types.account_id", account.id)
    .maybeSingle();
  if (lookupError || !booking) return { error: "Booking not found." };
  if (booking.status !== "confirmed")
    return { error: "Reminder is only available for confirmed bookings." };

  // ── 3. Mint fresh tokens (Phase 8 cron precedent) ────────────────────────
  // Old emailed cancel/reschedule links are invalidated by this step.
  const rawCancelToken = crypto.randomUUID();
  const rawRescheduleToken = crypto.randomUUID();
  const [hashCancel, hashReschedule] = await Promise.all([
    hashToken(rawCancelToken),
    hashToken(rawRescheduleToken),
  ]);
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      cancel_token_hash: hashCancel,
      reschedule_token_hash: hashReschedule,
    })
    .eq("id", bookingId);
  if (updateError) return { error: "Reminder failed. Please try again." };

  // ── 4. Resolve appUrl ────────────────────────────────────────────────────
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  // ── 5. Delegate to canonical reminder sender ─────────────────────────────
  // Supabase returns FK join as single object (via !inner) but TS infers array.
  const eventTypesRaw = booking.event_types as unknown;
  const eventTypesRow = (
    Array.isArray(eventTypesRaw) ? eventTypesRaw[0] : eventTypesRaw
  ) as {
    name: string;
    duration_minutes: number;
    location: string | null;
    account_id: string;
  };

  try {
    await sendReminderBooker({
      booking: {
        id: booking.id,
        start_at: booking.start_at,
        end_at: booking.end_at,
        booker_name: booking.booker_name,
        booker_email: booking.booker_email,
        booker_timezone: booking.booker_timezone,
        answers: booking.answers,
      },
      eventType: {
        name: eventTypesRow.name,
        duration_minutes: eventTypesRow.duration_minutes,
        location: eventTypesRow.location,
      },
      account: {
        id: account.id, // Phase 31: required for quota refusal log
        slug: account.slug,
        name: account.name,
        logo_url: account.logo_url,
        brand_primary: account.brand_primary,
        owner_email: account.owner_email,
        reminder_include_custom_answers: account.reminder_include_custom_answers,
        reminder_include_location: account.reminder_include_location,
        reminder_include_lifecycle_links: account.reminder_include_lifecycle_links,
      },
      rawCancelToken,
      rawRescheduleToken,
      appUrl,
    });
  } catch (err) {
    console.error("[sendReminderForBookingAction] send error:", err);
    return { error: "Reminder send failed. Please try again." };
  }

  return { ok: true };
}
