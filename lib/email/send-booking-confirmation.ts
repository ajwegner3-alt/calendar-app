import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { sendEmail } from "@/lib/email-sender";
import { buildIcsBuffer } from "@/lib/email/build-ics";
import {
  renderEmailLogoHeader,
  renderEmailFooter,
  renderBrandedButton,
  brandedHeadingStyle,
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
}

/**
 * Send the booker confirmation email with .ics calendar invite attachment.
 *
 * Subject:  "Booking confirmed: [event] on [date]"    (CONTEXT decision #8)
 * From:     Constructed by sendEmail singleton (GMAIL_FROM_NAME + GMAIL_USER)
 *           — DO NOT pass an explicit `from` field here (would break Gmail SMTP auth)
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
): Promise<void> {
  const { booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl } = args;

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
  ${renderEmailLogoHeader(branding)}
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

  // DO NOT pass `from` — the sendEmail singleton constructs defaultFrom from
  // GMAIL_FROM_NAME + GMAIL_USER env vars. Passing `from` would break Gmail SMTP
  // authentication (must equal the authenticated GMAIL_USER address).
  await sendEmail({
    to:      booking.booker_email,
    subject: `Booking confirmed: ${eventType.name} on ${subjectDate}`,
    html,
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
