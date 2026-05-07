import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import {
  getSenderForAccount,
  REFUSED_SEND_ERROR_PREFIX,
} from "@/lib/email-sender/account-sender";
import {
  checkAndConsumeQuota,
  QuotaExceededError,
  logQuotaRefusal,
} from "@/lib/email-sender/quota-guard";
import { buildIcsBuffer } from "@/lib/email/build-ics";
import {
  renderEmailBrandedHeader,
  renderEmailFooter,
  renderBrandedButton,
  brandedHeadingStyle,
  stripHtml,
} from "./branding-blocks";

interface BookingRecord {
  id: string;
  start_at: string; // ISO UTC, e.g. "2026-06-15T14:00:00.000Z"
  end_at: string;   // ISO UTC
  booker_name: string;
  booker_email: string;
  booker_timezone: string; // IANA — times in the email are rendered in THIS timezone
}

interface EventTypeRecord {
  name: string;
  description: string | null;
  duration_minutes: number;
}

interface AccountRecord {
  /** Phase 31 (EMAIL-21): account UUID for the PII-free quota refusal log. */
  id: string;
  name: string;
  timezone: string;   // IANA — .ics uses ACCOUNT timezone; calendar clients adapt
  owner_email: string | null;
  slug: string;
  logo_url: string | null;
  brand_primary: string | null;
}

export interface SendBookingConfirmationArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** Raw (pre-hash) cancel token — Phase 6 routes consume `/cancel/:rawToken` */
  rawCancelToken: string;
  /** Raw (pre-hash) reschedule token — Phase 6 routes consume `/reschedule/:rawToken` */
  rawRescheduleToken: string;
  /** Base URL for cancel/reschedule links.
   *  Source: process.env.NEXT_PUBLIC_APP_URL with fallback to the Vercel URL. */
  appUrl: string;
  /** Phase 35: account UUID for per-account Gmail OAuth sender factory. */
  accountId: string;
}

export interface SendBookingConfirmationResult {
  success: boolean;
  error?: string;
}

/**
 * Send the booker confirmation email with .ics calendar invite attachment.
 *
 * Subject:  "Booking confirmed: [event] on [date]"    (CONTEXT decision #8)
 * From:     Owned by the OAuth factory (must equal authenticated Gmail address); cannot be overridden.
 * To:       booking.booker_email
 * Attach:   invite.ics with content-type "text/calendar; method=REQUEST"
 *
 * Times in the EMAIL body are rendered in BOOKER timezone (CONTEXT decision #7).
 * Times in the .ics use ACCOUNT timezone so calendar clients localize naturally.
 * Cancel + reschedule URLs follow LOCKED format (CONTEXT decision #10):
 *   ${appUrl}/cancel/${rawToken}
 *   ${appUrl}/reschedule/${rawToken}
 */
export async function sendBookingConfirmation(
  args: SendBookingConfirmationArgs,
): Promise<SendBookingConfirmationResult> {
  const { booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl, accountId } = args;

  // Format times in BOOKER timezone for the email body
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine   = format(startTz, "EEEE, MMMM d, yyyy"); // "Tuesday, June 16, 2026"
  const timeLine   = format(startTz, "h:mm a (z)");         // "10:00 AM (CDT)"
  const subjectDate = format(startTz, "MMM d, yyyy");       // "Jun 16, 2026"

  // LOCKED URL format — Phase 6 route handlers consume these tokens
  const cancelUrl      = `${appUrl}/cancel/${rawCancelToken}`;
  const rescheduleUrl  = `${appUrl}/reschedule/${rawRescheduleToken}`;

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  // Table-based layout for broad email-client compatibility.
  // All styles inline (Gmail/Outlook/Apple Mail lock from Phase 5 STATE).
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">You're booked.</h1>
  <p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
  <p style="margin: 0 0 24px 0;">Your appointment with <strong>${escapeHtml(account.name)}</strong> is confirmed.</p>

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">What:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">When:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Duration:</td>
      <td style="padding: 6px 0; vertical-align: top;">${eventType.duration_minutes} minutes</td>
    </tr>
  </table>

  <p style="margin: 0 0 24px 0; color: #555; font-size: 14px;">
    A calendar invite (.ics) is attached — open it to add this event to your calendar.
  </p>

  <p style="margin: 0 0 8px 0;">Need to make a change?</p>
  <p style="margin: 0 0 32px 0;">
    ${renderBrandedButton({ href: rescheduleUrl, label: "Reschedule", primaryColor: account.brand_primary })}
    &nbsp;
    ${renderBrandedButton({ href: cancelUrl, label: "Cancel", primaryColor: account.brand_primary })}
  </p>

  <p style="margin: 0 0 16px 0; font-size: 13px; color: #888;">If you don't see this email, check your spam or junk folder and mark it as "Not Spam."</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
  ${renderEmailFooter()}
</div>`;

  // .ics uses owner email for ORGANIZER. If null (shouldn't happen post Plan 05-01
  // seed but handle defensively), fall back to a placeholder — Gmail still renders
  // the inline calendar card; ORGANIZER email isn't displayed to the attendee.
  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";

  const icsBuffer = buildIcsBuffer({
    uid:            booking.id,                        // MUST be stable; Phase 6 reschedule depends on this
    summary:        eventType.name,
    description:    eventType.description ?? undefined,
    startAt:        new Date(booking.start_at),
    endAt:          new Date(booking.end_at),
    timezone:       account.timezone,                 // owner TZ; calendar clients adapt for attendee
    organizerName:  account.name,
    organizerEmail,
    attendeeEmail:  booking.booker_email,
    attendeeName:   booking.booker_name,
  });

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  // logQuotaRefusal is PII-free; re-throw so callers (sendBookingEmails) can
  // detect QuotaExceededError and apply save-and-flag semantics.
  try {
    await checkAndConsumeQuota("booking-confirmation", accountId);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "booking-confirmation",
        count: err.count,
        cap: err.cap,
      });
    }
    throw err;
  }

  // Phase 35: use per-account OAuth sender factory.
  // from is owned by the OAuth factory (must equal authenticated Gmail address); cannot be overridden.
  const sender = await getSenderForAccount(accountId);
  const result = await sender.send({
    to:      booking.booker_email,
    subject: `Booking confirmed: ${eventType.name} on ${subjectDate}`,
    html,
    text:    stripHtml(html), // EMAIL-10: plain-text alternative for spam-score + accessibility
    attachments: [
      {
        filename:    "invite.ics",
        content:     icsBuffer,
        // MUST be "text/calendar; method=REQUEST" — not application/octet-stream.
        // Gmail shows inline "Add to Calendar" card only with this content-type.
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });

  if (!result.success) {
    if (result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)) {
      console.error("[booking-confirmation] OAuth send refused", {
        account_id: accountId,
        error: result.error,
      });
    } else {
      console.error("[booking-confirmation] send failed", {
        account_id: accountId,
        error: result.error,
      });
    }
  }

  return { success: result.success, error: result.error };
}

/** Escape HTML special characters in user-supplied strings before inserting into email HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
