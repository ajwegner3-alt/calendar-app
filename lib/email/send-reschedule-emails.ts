import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ICalCalendarMethod } from "ical-generator";
import { sendEmail } from "@/lib/email-sender";
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
  start_at: string;          // NEW start (post-reschedule, ISO UTC)
  end_at: string;            // NEW end   (post-reschedule, ISO UTC)
  booker_name: string;
  booker_email: string;
  booker_timezone: string;   // IANA
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
  slug: string;
  timezone: string;          // IANA
  owner_email: string | null;
  logo_url: string | null;
  brand_primary: string | null;
}

export interface SendRescheduleEmailsArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** PREVIOUS slot — rendered as "Was: [old time]" in both emails (CONTEXT decision: show OLD → NEW) */
  oldStartAt: string;        // ISO UTC
  oldEndAt: string;          // ISO UTC
  /** Fresh raw cancel token for the NEW booking — Phase 6 token rotation;
   *  goes into the booker email's cancel link */
  rawCancelToken: string;
  /** Fresh raw reschedule token for the NEW booking */
  rawRescheduleToken: string;
  /** Base URL for cancel/reschedule links. Caller resolves NEXT_PUBLIC_APP_URL. */
  appUrl: string;
  /**
   * Phase 33 (PUSH-09): when explicitly false, suppresses the owner notification
   * email leg. Used by batch-initiated reschedules (pushback commit) where N owner
   * emails would be duplicate noise — the owner triggered the batch.
   * Default: true (owner leg fires; existing single-reschedule callers unaffected).
   * Mirrors send-cancel-emails.ts sendOwner pattern (Phase 32 AVAIL-06).
   */
  sendOwner?: boolean;
}

/**
 * Fire-and-forget orchestrator for reschedule emails (CONTEXT lock: ONE
 * "rescheduled" email per party — booker + owner).
 *
 * MUST NOT throw — caller pattern is `void sendRescheduleEmails(...)` after the
 * atomic reschedule UPDATE succeeds. Errors caught per-sender and logged.
 *
 * Subject pattern (CONTEXT decision): "Booking rescheduled: [event name]"
 *
 * Both emails attach METHOD:REQUEST .ics with SAME UID as original booking +
 * SEQUENCE:1 + NEW startAt/endAt — calendar clients UPDATE the existing event
 * in place (RESEARCH §Pattern 7: no orphan events).
 *
 * Plan 12-06: Migrated to renderEmailBrandedHeader (solid-color header band, CONTEXT lock).
 * Plan 12-06: Added text: stripHtml(html) to booker reschedule (EMAIL-10 extended).
 */
export async function sendRescheduleEmails(args: SendRescheduleEmailsArgs): Promise<void> {
  // Phase 33 (PUSH-09): batch-initiated reschedules suppress the owner leg.
  // Default sendOwner=true preserves the original two-leg behavior for all
  // existing single-reschedule callers (public /api/reschedule route).
  const sendOwner = args.sendOwner !== false;

  const legs: Array<Promise<void>> = [sendBookerRescheduleEmail(args)];
  if (sendOwner) {
    legs.push(sendOwnerRescheduleEmail(args));
  }

  const results = await Promise.allSettled(legs);

  // Phase 31 (EMAIL-21): re-throw the first QuotaExceededError so the
  // awaiting caller (lib/bookings/reschedule.ts) can surface emailFailed:
  // "quota" to the owner UI. logQuotaRefusal already wrote inside the inner
  // sender; do not double-log.
  const quotaErr = results.find(
    (r): r is PromiseRejectedResult =>
      r.status === "rejected" && r.reason instanceof QuotaExceededError,
  );
  if (quotaErr) throw quotaErr.reason;

  // Non-quota failures: log but don't throw. The reschedule UPDATE already
  // committed; surfacing arbitrary SMTP errors would cause the owner UI to
  // believe the reschedule failed.
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[reschedule-emails] leg failed:", r.reason);
    }
  }
}

async function sendBookerRescheduleEmail(args: SendRescheduleEmailsArgs): Promise<void> {
  const { booking, eventType, account, oldStartAt, rawCancelToken, rawRescheduleToken, appUrl } = args;

  // Booker-tz formatting for both old and new times
  const oldTz = new TZDate(new Date(oldStartAt), booking.booker_timezone);
  const newTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);

  const oldDate = format(oldTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldTz, "h:mm a (z)");
  const newDate = format(newTz, "EEEE, MMMM d, yyyy");
  const newTime = format(newTz, "h:mm a (z)");

  const cancelUrl     = `${appUrl}/cancel/${rawCancelToken}`;
  const rescheduleUrl = `${appUrl}/reschedule/${rawRescheduleToken}`;

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">Your appointment was rescheduled</h1>
  <p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
  <p style="margin: 0 0 24px 0;">Your appointment with <strong>${escapeHtml(account.name)}</strong> has been moved.</p>

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">What:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #999; white-space: nowrap; vertical-align: top;"><s>Was:</s></td>
      <td style="padding: 6px 0; vertical-align: top; color: #999;"><s>${oldDate}<br/>${oldTime}</s></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>New time:</strong></td>
      <td style="padding: 6px 0; vertical-align: top;"><strong>${newDate}<br/>${newTime}</strong></td>
    </tr>
  </table>

  <p style="margin: 0 0 24px 0; color: #555; font-size: 14px;">
    An updated calendar invite (.ics) is attached — open it to update your calendar.
  </p>

  <p style="margin: 0 0 8px 0;">Need to make another change?</p>
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

  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";

  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,                    // SAME UID as original — calendar updates in place
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),   // NEW start
    endAt:         new Date(booking.end_at),     // NEW end
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.REQUEST,
    sequence:      1,                             // RFC 5546: increment on update
  });

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  try {
    await checkAndConsumeQuota("reschedule-booker");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "reschedule-booker",
        count: err.count,
        cap: err.cap,
      });
    }
    throw err;
  }

  // DO NOT pass `from` — the sendEmail singleton constructs defaultFrom from
  // GMAIL_FROM_NAME + GMAIL_USER env vars. Passing `from` would break Gmail SMTP auth.
  await sendEmail({
    to:      booking.booker_email,
    subject: `Booking rescheduled: ${eventType.name}`,
    html,
    text:    stripHtml(html), // EMAIL-10 extended: plain-text alt on booker reschedule (Plan 12-06)
    attachments: [
      {
        filename:    "invite.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=REQUEST",
      },
    ],
  });
}

async function sendOwnerRescheduleEmail(args: SendRescheduleEmailsArgs): Promise<void> {
  const { booking, eventType, account, oldStartAt } = args;

  if (!account.owner_email) {
    // No owner email seeded → silently skip (Phase 5 pattern)
    return;
  }

  // Owner-tz formatting for both old and new times
  const oldTz = new TZDate(new Date(oldStartAt), account.timezone);
  const newTz = new TZDate(new Date(booking.start_at), account.timezone);

  const oldDate = format(oldTz, "EEEE, MMMM d, yyyy");
  const oldTime = format(oldTz, "h:mm a (z)");
  const newDate = format(newTz, "EEEE, MMMM d, yyyy");
  const newTime = format(newTz, "h:mm a (z)");
  const subjectDate = format(newTz, "MMM d, yyyy");

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">Booking rescheduled</h1>
  <p style="margin: 0 0 24px 0;"><strong>${escapeHtml(booking.booker_name)}</strong> rescheduled their booking.</p>

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Event:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #999; white-space: nowrap; vertical-align: top;"><s>Was:</s></td>
      <td style="padding: 6px 0; vertical-align: top; color: #999;"><s>${oldDate}<br/>${oldTime}</s></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>New time:</strong></td>
      <td style="padding: 6px 0; vertical-align: top;"><strong>${newDate}<br/>${newTime}</strong></td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_name)}<br/>${escapeHtml(booking.booker_email)}</td>
    </tr>
  </table>

  <p style="margin: 0 0 16px 0; font-size: 12px; color: #888;">Booking ID: ${booking.id}</p>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
  ${renderEmailFooter()}
</div>`;

  const organizerEmail = account.owner_email;

  const icsBuffer = buildIcsBuffer({
    uid:           booking.id,
    summary:       eventType.name,
    description:   eventType.description ?? undefined,
    startAt:       new Date(booking.start_at),
    endAt:         new Date(booking.end_at),
    timezone:      account.timezone,
    organizerName: account.name,
    organizerEmail,
    attendeeEmail: booking.booker_email,
    attendeeName:  booking.booker_name,
    method:        ICalCalendarMethod.REQUEST,
    sequence:      1,
  });

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  try {
    await checkAndConsumeQuota("reschedule-owner");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "reschedule-owner",
        count: err.count,
        cap: err.cap,
      });
    }
    throw err;
  }

  // DO NOT pass `from` — the sendEmail singleton constructs defaultFrom from
  // GMAIL_FROM_NAME + GMAIL_USER env vars. Passing `from` would break Gmail SMTP auth.
  await sendEmail({
    to:      account.owner_email,
    subject: `Booking rescheduled: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
    attachments: [
      {
        filename:    "invite.ics",
        content:     icsBuffer,
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
