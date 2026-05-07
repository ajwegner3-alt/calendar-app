import "server-only";
import {
  sendBookingConfirmation,
  type SendBookingConfirmationArgs,
} from "@/lib/email/send-booking-confirmation";
import {
  sendOwnerNotification,
  type SendOwnerNotificationArgs,
} from "@/lib/email/send-owner-notification";
import { REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender";
import { QuotaExceededError } from "@/lib/email-sender/quota-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SendBookingEmailsArgs
  extends SendBookingConfirmationArgs {
  /** Arguments for the owner notification email.
   *  Overlaps with the confirmation args but kept separate so each sender
   *  can evolve its interface independently.
   *  accountId is inherited from SendBookingConfirmationArgs and injected
   *  by the orchestrator — callers must NOT pass it in ownerArgs. */
  ownerArgs: Omit<SendOwnerNotificationArgs, "accountId">;
}

/**
 * Fire-and-forget orchestrator — sends both the booker confirmation and the
 * owner notification emails after a booking is committed to the database.
 *
 * CRITICAL: This function MUST NOT throw. The /api/bookings Route Handler
 * fires this inside `after(() => sendBookingEmails(...))` after the booking
 * row is inserted and the 201 response is returned. Email failures must
 * NEVER roll back or delay the booking confirmation to the user.
 *
 * Error handling:
 *   - QuotaExceededError on EITHER leg → save-and-flag: UPDATE the booking
 *     row setting confirmation_email_sent=false (Phase 31 EMAIL-24). The
 *     held slot stays claimed; the booking row stays. Plan 31-03 surfaces
 *     the dashboard alert by reading this flag.
 *   - Phase 35 OAuth refusal (result.error starts with REFUSED_SEND_ERROR_PREFIX)
 *     on the confirmation leg → same save-and-flag semantics: booking succeeds,
 *     confirmation_email_sent=false. Owner sees flag in dashboard alongside
 *     the reconnect banner (CONTEXT decision: silent partial failure preferred
 *     over surfacing errors to booker).
 *   - Other non-quota errors are caught and logged via console.error.
 *
 * Caller pattern in route.ts:
 *   after(() => sendBookingEmails({ booking, eventType, account, ..., ownerArgs }));
 *
 * Phase 35: accountId is threaded from the booking route through both leaf senders.
 * The orchestrator uses account.id (available in SendBookingConfirmationArgs) as
 * the accountId for both legs (they're sending on behalf of the same account).
 */
export async function sendBookingEmails(
  args: SendBookingEmailsArgs,
): Promise<void> {
  const { ownerArgs, ...confirmationArgs } = args;
  const bookingId = confirmationArgs.booking.id;
  // accountId is already in confirmationArgs (SendBookingConfirmationArgs has accountId)
  const accountId = confirmationArgs.accountId;

  // Run both legs concurrently. The leaf senders now return structured results
  // rather than throwing on OAuth/send failures (they only throw on QuotaExceededError).
  const [confResult, ownerResult] = await Promise.allSettled([
    sendBookingConfirmation(confirmationArgs),
    sendOwnerNotification({ ...ownerArgs, accountId }),
  ]);

  // Determine whether the confirmation leg should flag the booking row.
  // Flag on:
  //   (a) QuotaExceededError throw from the confirmation leg (Phase 31 EMAIL-24)
  //   (b) OAuth refusal return value from the confirmation leg (Phase 35)
  let confirmationFlagged = false;

  // (a) QuotaExceededError on EITHER leg → same save-and-flag as before
  const quotaHit =
    (confResult.status === "rejected" &&
      confResult.reason instanceof QuotaExceededError) ||
    (ownerResult.status === "rejected" &&
      ownerResult.reason instanceof QuotaExceededError);

  if (quotaHit) {
    confirmationFlagged = true;
  }

  // (b) OAuth send refused on the CONFIRMATION leg → flag the booking row.
  // owner-notification refusal is logged but does NOT flag confirmation_email_sent
  // (the booker's copy is what the flag tracks).
  if (
    !confirmationFlagged &&
    confResult.status === "fulfilled" &&
    !confResult.value.success &&
    confResult.value.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)
  ) {
    confirmationFlagged = true;
    console.error("[booking-emails] confirmation oauth_send_refused — flagging booking", {
      booking_id: bookingId,
      error: confResult.value.error,
    });
  }

  if (confirmationFlagged) {
    const admin = createAdminClient();
    const { error: flagErr } = await admin
      .from("bookings")
      .update({ confirmation_email_sent: false })
      .eq("id", bookingId);
    if (flagErr) {
      console.error("[EMAIL_QUOTA_EXCEEDED] failed to flag booking", {
        booking_id: bookingId,
        error: flagErr.message,
      });
    }
  }

  // Per-leg non-quota error logging (preserves the previous .catch() behavior
  // for arbitrary send failures so they remain visible in Vercel logs).
  if (
    confResult.status === "rejected" &&
    !(confResult.reason instanceof QuotaExceededError)
  ) {
    console.error(
      "[booking-emails] booker confirmation failed:",
      confResult.reason,
    );
  }
  if (
    ownerResult.status === "rejected" &&
    !(ownerResult.reason instanceof QuotaExceededError)
  ) {
    console.error(
      "[booking-emails] owner notification failed:",
      ownerResult.reason,
    );
  }
}
