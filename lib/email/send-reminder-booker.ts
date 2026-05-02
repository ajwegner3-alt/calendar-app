import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { sendEmail } from "@/lib/email-sender";
import {
  renderEmailBrandedHeader,
  renderEmailFooter,
  renderBrandedButton,
  brandedHeadingStyle,
  stripHtml,
} from "./branding-blocks";

/**
 * Reminder email sent ~24h before a confirmed booking's start_at.
 *
 * Mirrors the visual frame of send-booking-confirmation.ts (Phase 5/7) so the
 * booker sees a consistent branded experience — same logo header, same H1
 * style, same branded CTA button, same NSI footer. Only the BODY content
 * differs (reminder copy + conditional toggle blocks + rotated lifecycle links).
 *
 * Subject (LOCKED — Plan 08-04 / CONTEXT.md): exactly
 *   "Reminder: {event_name} tomorrow at {time_local}"
 * where time_local is rendered in the booker's submitted timezone (matches
 * Phase 5/6 convention — booker sees their own clock, not the owner's).
 *
 * Conditional content (per-account toggles from Plan 08-01):
 *   - reminder_include_location → render `<p><strong>Location:</strong> ...</p>`
 *   - reminder_include_custom_answers → render the answers table when answers
 *     object is non-empty
 *   - reminder_include_lifecycle_links → render Reschedule + Cancel CTA pair
 *
 * Token rotation (Plan 08-04 design):
 *   The CALLER generates fresh raw cancel + reschedule tokens (via
 *   lib/booking-tokens.ts#generateRawToken) and stores their SHA-256 hashes
 *   on the booking row in the SAME UPDATE that claims reminder_sent_at.
 *   This sender just receives the raw tokens to embed in the URL — it does
 *   NOT regenerate or hash. Side effect: the original confirmation-email
 *   lifecycle links are invalidated by the rotation. This is intentional
 *   (RESEARCH Open Q 3 — single canonical "current" link).
 *
 * Visual parity with confirmation: the only structural difference is no .ics
 * attachment (the booker already added the event from the confirmation email),
 * no race-loser banner, and a "See you tomorrow" H1 instead of "You're booked."
 */

interface ReminderBookingRecord {
  id: string;
  start_at: string;          // ISO UTC
  end_at: string;            // ISO UTC
  booker_name: string;
  booker_email: string;
  booker_timezone: string;   // IANA — formats the email's date/time
  answers: Record<string, string> | null;
}

interface ReminderEventTypeRecord {
  name: string;
  duration_minutes: number;
  /** Phase 8 column — event_types.location, free-text. Surfaced when account
   *  toggle reminder_include_location is true AND this value is non-empty. */
  location: string | null;
}

interface ReminderAccountRecord {
  slug: string;
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  owner_email?: string | null;
  /** Phase 8 toggles — Plan 08-01 added these as boolean NOT NULL DEFAULT true. */
  reminder_include_custom_answers: boolean;
  reminder_include_location: boolean;
  reminder_include_lifecycle_links: boolean;
}

export interface SendReminderBookerArgs {
  booking: ReminderBookingRecord;
  eventType: ReminderEventTypeRecord;
  account: ReminderAccountRecord;
  /** Raw (pre-hash) cancel token — caller already stored the hash on the
   *  booking row. The /cancel/[token] route hashes the URL token and looks
   *  up cancel_token_hash. */
  rawCancelToken: string;
  /** Raw (pre-hash) reschedule token — same contract as rawCancelToken. */
  rawRescheduleToken: string;
  /** Base URL for cancel/reschedule links. Match what the bookings route
   *  passes — typically resolveAppUrl(req). */
  appUrl: string;
}

export async function sendReminderBooker(args: SendReminderBookerArgs): Promise<void> {
  const { booking, eventType, account, rawCancelToken, rawRescheduleToken, appUrl } = args;

  // Format times in BOOKER timezone (CONTEXT decision #7 — booker sees their clock)
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy"); // "Wednesday, April 27, 2026"
  const timeLine = format(startTz, "h:mm a (z)");          // "10:00 AM (CDT)"

  // LOCKED subject template — automated content-quality test asserts the prefix
  const subject = `Reminder: ${eventType.name} tomorrow at ${timeLine}`;

  // LOCKED URL format — Phase 6 cancel/reschedule resolvers consume these tokens
  const cancelUrl = `${appUrl}/cancel/${rawCancelToken}`;
  const rescheduleUrl = `${appUrl}/reschedule/${rawRescheduleToken}`;

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  // Build the body in segments so toggle-gated blocks can be omitted entirely
  // (omission, not empty-render — keeps the email clean when toggles are off).
  const segments: string[] = [];

  segments.push(renderEmailBrandedHeader(branding));

  segments.push(
    `<h1 style="${brandedHeadingStyle(account.brand_primary)}">See you tomorrow</h1>`,
  );
  segments.push(`<p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>`);
  segments.push(
    `<p style="margin: 0 0 24px 0;">This is a friendly reminder of your upcoming <strong>${escapeHtml(eventType.name)}</strong> with <strong>${escapeHtml(account.name)}</strong>.</p>`,
  );

  // Core booking details — always shown (the reminder's reason for being)
  segments.push(`
  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">When:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Duration:</td>
      <td style="padding: 6px 0; vertical-align: top;">${eventType.duration_minutes} minutes</td>
    </tr>
  </table>`);

  // Location — toggle-gated AND must be non-empty (Plan 08-01 column allows NULL)
  if (account.reminder_include_location && eventType.location && eventType.location.trim().length > 0) {
    // Preserve newlines in the location text — owners often paste multi-line addresses
    const locationHtml = escapeHtml(eventType.location).replace(/\n/g, "<br/>");
    segments.push(`
  <p style="margin: 0 0 16px 0;"><strong style="color:#555;">Location:</strong><br/>${locationHtml}</p>`);
  }

  // Custom answers — toggle-gated AND only when there are actually answers
  if (
    account.reminder_include_custom_answers &&
    booking.answers &&
    Object.keys(booking.answers).length > 0
  ) {
    const rows = Object.entries(booking.answers)
      .map(
        ([q, a]) =>
          `<tr><td style="padding:6px 16px 6px 0;color:#555;vertical-align:top;"><strong>${escapeHtml(q)}</strong></td><td style="padding:6px 0;vertical-align:top;">${escapeHtml(String(a))}</td></tr>`,
      )
      .join("");
    segments.push(`
  <p style="margin: 0 0 8px 0; color:#555;"><strong>Your answers:</strong></p>
  <table style="border-collapse: collapse; margin: 0 0 24px 0;">${rows}</table>`);
  }

  // Lifecycle links — toggle-gated. Reschedule = primary CTA; Cancel = secondary text link.
  if (account.reminder_include_lifecycle_links) {
    segments.push(`
  <p style="margin: 0 0 8px 0;">Need to make a change?</p>
  <p style="margin: 0 0 32px 0;">
    ${renderBrandedButton({ href: rescheduleUrl, label: "Reschedule", primaryColor: account.brand_primary })}
    &nbsp;
    ${renderBrandedButton({ href: cancelUrl, label: "Cancel", primaryColor: account.brand_primary })}
  </p>`);
  }

  // Spam-folder deliverability nudge — Phase 9 fix-as-you-go (Plan 09-01 Task 2).
  // Generic line, no toggle gate, rendered for ALL recipients. Plain-text version
  // auto-derives via stripHtml(html) below — no separate text edit needed.
  segments.push(`<p style="margin: 0 0 16px 0; font-size: 13px; color: #888;">If you don't see this email, check your spam or junk folder and mark it as "Not Spam."</p>`);

  // Footer — always present (NSI attribution, CONTEXT lock)
  segments.push(`
  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>`);
  segments.push(renderEmailFooter());

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
${segments.join("\n")}
</div>`;

  // Plain-text alternative — the email-sender mock and real nodemailer both
  // accept text. Without it, spam scores rise (mail-tester EMAIL-08).
  const text = stripHtml(html);

  // DO NOT pass `from` — sendEmail singleton constructs from GMAIL_FROM_NAME +
  // GMAIL_USER. Passing `from` breaks Gmail SMTP auth (matches Phase 5 lock).
  await sendEmail({
    to: booking.booker_email,
    subject,
    html,
    text,
  });
}

/** Escape HTML special characters in user-supplied strings before insertion into email HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// stripHtml is now imported from branding-blocks (shared across all booker senders, Plan 12-06)
