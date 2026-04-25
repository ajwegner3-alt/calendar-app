import "server-only";
import {
  sendBookingConfirmation,
  type SendBookingConfirmationArgs,
} from "@/lib/email/send-booking-confirmation";
import {
  sendOwnerNotification,
  type SendOwnerNotificationArgs,
} from "@/lib/email/send-owner-notification";

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
 * should fire this with `void sendBookingEmails(...)` after the booking row
 * is inserted and the 201 response is returned. Email failures must NEVER
 * roll back or delay the booking confirmation to the user.
 *
 * Error handling: each per-email error is caught and logged via console.error.
 * Promise.allSettled ensures both senders run even if one fails.
 *
 * Caller pattern in route.ts:
 *   void sendBookingEmails({ booking, eventType, account, ..., ownerArgs: { ... } });
 */
export async function sendBookingEmails(
  args: SendBookingEmailsArgs,
): Promise<void> {
  const { ownerArgs, ...confirmationArgs } = args;

  const tasks: Array<Promise<void>> = [
    sendBookingConfirmation(confirmationArgs).catch((err: unknown) => {
      console.error("[booking-emails] booker confirmation failed:", err);
    }),
    sendOwnerNotification(ownerArgs).catch((err: unknown) => {
      console.error("[booking-emails] owner notification failed:", err);
    }),
  ];

  // allSettled so both senders attempt regardless of individual failures.
  // The calling route handler has already returned 201; these run in the background.
  await Promise.allSettled(tasks);
}
