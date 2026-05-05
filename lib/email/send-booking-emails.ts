import "server-only";
import {
  sendBookingConfirmation,
  type SendBookingConfirmationArgs,
} from "@/lib/email/send-booking-confirmation";
import {
  sendOwnerNotification,
  type SendOwnerNotificationArgs,
} from "@/lib/email/send-owner-notification";
import { QuotaExceededError } from "@/lib/email-sender/quota-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SendBookingEmailsArgs
  extends SendBookingConfirmationArgs {
  /** Arguments for the owner notification email.
   *  Overlaps with the confirmation args but kept separate so each sender
   *  can evolve its interface independently. */
  ownerArgs: SendOwnerNotificationArgs;
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
 *   - Each leg's non-quota errors are caught and logged via console.error.
 *   - QuotaExceededError on EITHER leg → save-and-flag: UPDATE the booking
 *     row setting confirmation_email_sent=false (Phase 31 EMAIL-24). The
 *     held slot stays claimed; the booking row stays. Plan 31-03 surfaces
 *     the dashboard alert by reading this flag.
 *
 * Caller pattern in route.ts:
 *   after(() => sendBookingEmails({ booking, eventType, account, ..., ownerArgs }));
 */
export async function sendBookingEmails(
  args: SendBookingEmailsArgs,
): Promise<void> {
  const { ownerArgs, ...confirmationArgs } = args;
  const bookingId = confirmationArgs.booking.id;

  const [confResult, ownerResult] = await Promise.allSettled([
    sendBookingConfirmation(confirmationArgs),
    sendOwnerNotification(ownerArgs),
  ]);

  // Phase 31 (EMAIL-24): save-and-flag on booker confirmation refusal.
  // If EITHER leg hit the quota, flag the booking row for the dashboard alert
  // in Plan 31-03. The held slot is NOT released — booking stays committed.
  const quotaHit =
    (confResult.status === "rejected" &&
      confResult.reason instanceof QuotaExceededError) ||
    (ownerResult.status === "rejected" &&
      ownerResult.reason instanceof QuotaExceededError);

  if (quotaHit) {
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
  // for arbitrary SMTP failures so they remain visible in Vercel logs).
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
