// Vendored from @nsi/email-sender sibling project (2026-04-25).
// Copied verbatim from ../email-sender/src/utils.ts.
// Required by providers/resend.ts (stripHtml for plain-text fallback).

// Phase 40 Plan 05 (2026-05-09): escapeHtml removed — every email sender
// inlines its own private copy (send-booking-confirmation.ts, send-cancel-emails.ts,
// send-reminder-booker.ts, send-reschedule-emails.ts, send-owner-notification.ts,
// branding-blocks.ts, onboarding/welcome-email.ts, settings/upgrade/_lib/actions.ts).
// Zero consumers imported it from this file. stripHtml stays — used by
// providers/gmail-oauth.ts and providers/resend.ts for plain-text fallback.

/** Strip HTML tags for a plain-text fallback. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&bull;/g, "•")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
