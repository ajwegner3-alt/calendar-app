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
import {
  renderEmailBrandedHeader,
  renderEmailFooter,
  brandedHeadingStyle,
} from "./branding-blocks";

interface BookingRecord {
  id: string;
  start_at: string;       // ISO UTC
  booker_name: string;
  booker_email: string;
  booker_phone: string | null;
  booker_timezone: string; // IANA — informational only in owner email
  answers: Record<string, string>; // custom-question answers
}

interface EventTypeRecord {
  name: string;
}

interface AccountRecord {
  /** Phase 31 (EMAIL-21): account UUID for the PII-free quota refusal log. */
  id: string;
  name: string;
  timezone: string;       // IANA — owner email shows times in OWNER timezone
  owner_email: string | null;
  logo_url: string | null;
  brand_primary: string | null;
}

export interface SendOwnerNotificationArgs {
  booking: BookingRecord;
  eventType: EventTypeRecord;
  account: AccountRecord;
  /** Phase 35: account UUID for per-account Gmail OAuth sender factory. */
  accountId: string;
}

export interface SendOwnerNotificationResult {
  success: boolean;
  error?: string;
}

/**
 * Send a booking notification email to the account owner.
 *
 * Subject:  "New booking: [booker name] — [event] on [date]"  (CONTEXT decision #8)
 * From:     Owned by the OAuth factory (must equal authenticated Gmail address); cannot be overridden.
 * To:       account.owner_email
 * Reply-To: booking.booker_email  (CONTEXT decision #9 — owner hits Reply to contact booker)
 *
 * Times shown in OWNER timezone (account.timezone), not booker timezone.
 * Full custom-question answers are included in the body.
 *
 * Graceful skip: if account.owner_email is null, logs a warning and returns without
 * sending. Should not happen post Plan 05-01 seed but protects against null in tests.
 */
export async function sendOwnerNotification(
  args: SendOwnerNotificationArgs,
): Promise<SendOwnerNotificationResult> {
  const { booking, eventType, account, accountId } = args;

  if (!account.owner_email) {
    console.warn(
      `[owner-notification] account.owner_email is null — skipping owner notification for booking ${booking.id}`,
    );
    return { success: true };
  }

  // Format times in OWNER timezone (not booker timezone)
  const startOwnerTz  = new TZDate(new Date(booking.start_at), account.timezone);
  const dateLine      = format(startOwnerTz, "EEEE, MMMM d, yyyy"); // "Tuesday, June 16, 2026"
  const timeLine      = format(startOwnerTz, "h:mm a (z)");         // "10:00 AM (CDT)"
  const subjectDate   = format(startOwnerTz, "MMM d, yyyy");        // "Jun 16, 2026"

  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  // Build custom-question answers rows (only rendered if answers exist)
  const answerEntries = Object.entries(booking.answers);
  const answersHtml =
    answerEntries.length > 0
      ? `<h2 style="font-size: 15px; font-weight: 600; margin: 24px 0 8px 0;">Answers</h2>
<table style="border-collapse: collapse; width: 100%;">
${answerEntries
  .map(
    ([k, v]) =>
      `  <tr>
    <td style="padding: 5px 16px 5px 0; color: #555; white-space: nowrap; vertical-align: top;">${escapeHtml(k)}:</td>
    <td style="padding: 5px 0; vertical-align: top;">${escapeHtml(v)}</td>
  </tr>`,
  )
  .join("\n")}
</table>`
      : "";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">New booking</h1>

  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Event:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(eventType.name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">When:</td>
      <td style="padding: 6px 0; vertical-align: top;">${dateLine}<br/>${timeLine}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_name)}</td>
    </tr>
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Email:</td>
      <td style="padding: 6px 0; vertical-align: top;">
        <a href="mailto:${escapeHtml(booking.booker_email)}" style="color: ${escapeHtml(account.brand_primary ?? '#3B82F6')};">${escapeHtml(booking.booker_email)}</a>
      </td>
    </tr>
    ${
      booking.booker_phone
        ? `<tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Phone:</td>
      <td style="padding: 6px 0; vertical-align: top;">${escapeHtml(booking.booker_phone)}</td>
    </tr>`
        : ""
    }
    <tr>
      <td style="padding: 6px 16px 6px 0; color: #555; white-space: nowrap; vertical-align: top;">Booker TZ:</td>
      <td style="padding: 6px 0; vertical-align: top; color: #555;">${escapeHtml(booking.booker_timezone)}</td>
    </tr>
  </table>

  ${answersHtml}

  <p style="margin: 16px 0 0 0; font-size: 12px; color: #888;">
    ${escapeHtml(account.name)}${account.owner_email ? " &nbsp;·&nbsp; " + escapeHtml(account.owner_email) : ""}
  </p>
  ${renderEmailFooter()}
</div>`;

  // Phase 31 (EMAIL-21): refuse-send fail-closed at the daily cap.
  // Re-throw so sendBookingEmails can apply save-and-flag semantics.
  try {
    await checkAndConsumeQuota("owner-notification", accountId);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      logQuotaRefusal({
        account_id: account.id,
        sender_type: "owner-notification",
        count: err.count,
        cap: err.cap,
      });
    }
    throw err;
  }

  // Phase 35: use per-account OAuth sender factory.
  // from is owned by the OAuth factory (must equal authenticated Gmail address); cannot be overridden.
  // DO pass `replyTo` = booker_email so Andrew can hit Reply to contact the booker directly.
  const sender = await getSenderForAccount(accountId);
  const result = await sender.send({
    to:      account.owner_email,
    replyTo: booking.booker_email, // CONTEXT decision #9 — reply-to booker
    subject: `New booking: ${booking.booker_name} — ${eventType.name} on ${subjectDate}`,
    html,
  });

  if (!result.success) {
    if (result.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)) {
      console.error("[owner-notification] OAuth send refused", {
        account_id: accountId,
        error: result.error,
      });
    } else {
      console.error("[owner-notification] send failed", {
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
