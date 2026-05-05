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
  start_at: string;        // ISO UTC
  end_at: string;          // ISO UTC
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
  booker_timezone: string; // IANA
  answers: Record<string, string>;
}

interface EventTypeRecord {
  name: string;
  description: string | null;
  duration_minutes: number;
  slug: string;            // for "Book again" CTA URL
}

interface AccountRecord {
  /** Phase 31 (EMAIL-21): account UUID for the PII-free quota refusal log. */
  id: string;
  name: string;
  slug: string;            // for "Book again" CTA URL
  timezone: string;        // IANA — used for owner email times + .ics ORGANIZER tz
  owner_email: string | null;
  logo_url: string | null;
  brand_primary: string | null;
}

export interface SendCancelEmailsArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** Who triggered the cancel — controls booker email tone (CONTEXT decision). */
  actor: "booker" | "owner";
  /** Optional cancellation reason text. When non-empty:
   *    - actor='booker': surfaced PROMINENTLY in owner notification (callout block)
   *    - actor='owner':  surfaced PROMINENTLY in booker apology email
   *  Empty/undefined → omit the row entirely (NO "Reason: (none)" empty cells).
   */
  reason?: string;
  /** Base URL for "Book again" CTA. Caller resolves NEXT_PUBLIC_APP_URL. */
  appUrl: string;
  /**
   * Phase 32 (AVAIL-06): when explicitly false, suppress the owner email leg.
   * Used by batch-initiated cancels (inverse-override commit) where N owner
   * emails would be duplicate noise — the owner triggered the batch.
   * Default: true (owner leg fires; existing single-cancel callers unaffected).
   */
  sendOwner?: boolean;
}

/**
 * Orchestrator for cancellation emails (CONTEXT lock: BOTH parties always
 * notified regardless of who triggered).
 *
 * Phase 31 (EMAIL-21): switched from fire-and-forget per-leg .catch() to
 * Promise.allSettled inspection so the first QuotaExceededError surfaces to
 * the awaiting caller (lib/bookings/cancel.ts) — the owner UI needs
 * `emailFailed: "quota"` to render the Gmail-fallback callout. Non-quota
 * errors stay swallowed (the cancel itself already committed).
 *
 * Subject patterns (CONTEXT decisions):
 *   - Booker: "Booking cancelled: [event name]"
 *   - Owner:  "Booking cancelled: [booker name] — [event] on [date]"
 *
 * Both emails include METHOD:CANCEL .ics (same UID as original booking, SEQUENCE:1)
 * so any calendar that imported the original event removes it.
 */
export async function sendCancelEmails(args: SendCancelEmailsArgs): Promise<void> {
  // Phase 32 (AVAIL-06): batch-initiated cancels suppress the owner leg.
  // Default sendOwner=true preserves the original two-leg behavior for all
  // existing single-cancel callers (booker token route + owner cancel action).
  const sendOwner = args.sendOwner !== false;

  const legs: Array<Promise<void>> = [sendBookerCancelEmail(args)];
  if (sendOwner) {
    legs.push(sendOwnerCancelEmail(args));
  }

  const results = await Promise.allSettled(legs);

  // Phase 31 (EMAIL-21): re-throw the first QuotaExceededError so the
  // awaiting caller can surface emailFailed: "quota" to the owner UI. The
  // logQuotaRefusal write already happened inside the inner sender.
  const quotaErr = results.find(
    (r): r is PromiseRejectedResult =>
      r.status === "rejected" && r.reason instanceof QuotaExceededError,
  );
  if (quotaErr) throw quotaErr.reason;

  // Non-quota failures: log but don't throw. The cancel UPDATE already
  // committed; surfacing arbitrary SMTP errors would cause the owner UI to
  // believe the cancel failed.
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[cancel-emails] leg failed:", r.reason);
    }
  }
}

async function sendBookerCancelEmail(args: SendCancelEmailsArgs): Promise<void> {
  const { booking, eventType, account, actor, reason, appUrl } = args;

  // Times rendered in BOOKER timezone (mirrors Phase 5 confirmation pattern)
  const startTz = new TZDate(new Date(booking.start_at), booking.booker_timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");

  const rebookUrl = `${appUrl}/${account.slug}/${eventType.slug}`;

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  // Apology copy when owner cancelled (CONTEXT lock); confirmation copy when booker cancelled
  const intro =
    actor === "owner"
      ? `<p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
         <p style="margin: 0 0 24px 0;"><strong>${escapeHtml(account.name)}</strong> had to cancel your appointment for ${dateLine} at ${timeLine}. We apologize for the inconvenience.</p>`
      : `<p style="margin: 0 0 8px 0;">Hi ${escapeHtml(booking.booker_name)},</p>
         <p style="margin: 0 0 24px 0;">Your appointment with <strong>${escapeHtml(account.name)}</strong> has been cancelled.</p>`;

  // Owner-cancel reason callout — only when actor=owner AND reason is non-empty
  // (CONTEXT decision: reason callout only for the OPPOSITE party of the trigger; empty → omit entirely)
  const reasonBlock =
    actor === "owner" && reason && reason.trim().length > 0
      ? `<div style="background: #fff7ed; border-left: 3px solid #F97316; padding: 12px 16px; margin: 0 0 24px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 13px; color: #555;">Reason from ${escapeHtml(account.name)}:</p>
           <p style="margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(reason)}</p>
         </div>`
      : "";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">Appointment cancelled</h1>
  ${intro}
  ${reasonBlock}

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">What:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Was scheduled for:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
  </table>

  <p style="margin: 0 0 8px 0; font-size: 14px;">Need to book another time?</p>
  <p style="margin: 0 0 32px 0;">
    ${renderBrandedButton({ href: rebookUrl, label: "Book again", primaryColor: account.brand_primary })}
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 16px 0;"/>
  <p style="margin: 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
  ${renderEmailFooter()}
</div>`;

  const organizerEmail = account.owner_email ?? "noreply@nsi.tools";

  // METHOD:CANCEL .ics with SEQUENCE:1 — same UID as original booking
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
    method:        ICalCalendarMethod.CANCEL,
    sequence:      1,
  });

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  try {
    await checkAndConsumeQuota("cancel-booker");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "cancel-booker",
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
    subject: `Booking cancelled: ${eventType.name}`,
    html,
    text:    stripHtml(html), // EMAIL-10 extended: plain-text alt on booker cancel (Plan 12-06)
    attachments: [
      {
        filename:    "cancelled.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=CANCEL",
      },
    ],
  });
}

async function sendOwnerCancelEmail(args: SendCancelEmailsArgs): Promise<void> {
  const { booking, eventType, account, actor, reason } = args;

  if (!account.owner_email) {
    // No owner email seeded → silently skip (Phase 5 pattern; email-sender doesn't crash)
    return;
  }

  // Times in OWNER (account) timezone
  const startTz  = new TZDate(new Date(booking.start_at), account.timezone);
  const dateLine = format(startTz, "EEEE, MMMM d, yyyy");
  const timeLine = format(startTz, "h:mm a (z)");
  const subjectDate = format(startTz, "MMM d, yyyy");

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  // Booker-cancel reason callout — only when actor=booker AND reason is non-empty
  // (CONTEXT decision: reason callout only for the OPPOSITE party of the trigger)
  const reasonBlock =
    actor === "booker" && reason && reason.trim().length > 0
      ? `<div style="background: #fff7ed; border-left: 3px solid #F97316; padding: 12px 16px; margin: 0 0 24px 0; border-radius: 4px;">
           <p style="margin: 0; font-size: 13px; color: #555;">Reason from ${escapeHtml(booking.booker_name)}:</p>
           <p style="margin: 4px 0 0 0; font-size: 14px;">${escapeHtml(reason)}</p>
         </div>`
      : "";

  const triggeredBy =
    actor === "booker"
      ? `<strong>${escapeHtml(booking.booker_name)}</strong> cancelled their booking.`
      : `You cancelled this booking.`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">Booking cancelled</h1>
  <p style="margin: 0 0 24px 0;">${triggeredBy}</p>
  ${reasonBlock}

  <table style="border-collapse: collapse; margin: 0 0 24px 0; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Event:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Was scheduled for:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_name)}<br/>${escapeHtml(booking.booker_email)}${booking.booker_phone ? "<br/>" + escapeHtml(booking.booker_phone) : ""}</td>
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
    method:        ICalCalendarMethod.CANCEL,
    sequence:      1,
  });

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  try {
    await checkAndConsumeQuota("cancel-owner");
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "cancel-owner",
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
    subject: `Booking cancelled: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
    attachments: [
      {
        filename:    "cancelled.ics",
        content:     icsBuffer,
        contentType: "text/calendar; method=CANCEL",
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
