import "server-only";
import { sendEmail } from "@/lib/email-sender";
import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";

// Resolved email-sender entry point (verified 2026-04-28): the project uses a
// vendored email-sender at lib/email-sender/index.ts. The exported function is
// `sendEmail(options)` — same pattern as send-booking-confirmation.ts.

/**
 * Send a post-wizard welcome email to the newly onboarded account owner.
 *
 * Fire-and-forget: the caller (completeOnboardingAction) does NOT await this
 * function — it calls `.catch()` on the returned Promise. Failures are logged
 * but do NOT block the wizard completion redirect.
 *
 * Quota-guarded: uses "signup-welcome" category against the 200/day Gmail SMTP
 * cap from Plan 10-04. If quota is exceeded, logs and returns silently (the
 * wizard has already completed; withholding the email is acceptable).
 *
 * @param account.owner_email  Where to send the email (accounts.owner_email).
 * @param account.name         accounts.name (DB column; UI label is "Display Name").
 * @param account.slug         accounts.slug (their booking URL segment).
 */
export async function sendWelcomeEmail(account: {
  owner_email: string;
  name: string;
  slug: string;
}): Promise<void> {
  // Quota guard FIRST (per 10-04 contract — signup-side callers gate before send).
  try {
    // Nil UUID sentinel: no per-account context at welcome-email time (Phase 35).
    // The email is sent on behalf of the system (singleton SMTP) until Phase 36
    // migrates this path to per-account Gmail OAuth.
    await checkAndConsumeQuota("signup-welcome", "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      console.error("[welcome-email] quota exceeded; skipping welcome", e.message);
      return; // Fire-and-forget — wizard already succeeded.
    }
    // Non-quota error from guard means "fail open" already happened inside
    // the guard (DB hiccup); proceed with the send rather than blocking.
    console.error("[welcome-email] quota-guard unexpected error; proceeding with send:", e);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://calendar-app.example.com";
  const bookingUrl = `${siteUrl}/${account.slug}`;
  const subject = "Your booking link is live";

  const html = `
    <p>Hi ${escapeHtml(account.name)},</p>
    <p>Your booking link is live:</p>
    <p><a href="${bookingUrl}">${bookingUrl}</a></p>
    <p>Share it on your website, business card, or anywhere clients reach you.</p>
    <p>— NSI Booking</p>
  `.trim();

  const text = [
    `Hi ${account.name},`,
    "",
    "Your booking link is live:",
    bookingUrl,
    "",
    "Share it on your website, business card, or anywhere clients reach you.",
    "",
    "— NSI Booking",
  ].join("\n");

  // DO NOT pass `from` — sendEmail singleton constructs defaultFrom from
  // GMAIL_FROM_NAME + GMAIL_USER env vars. (Same pattern as send-booking-confirmation.ts.)
  const result = await sendEmail({
    to: account.owner_email,
    subject,
    html,
    text,
  });

  if (!result.success) {
    // Welcome email is fire-and-forget per wizard spec — log and continue.
    console.error("[welcome-email] sendEmail failed (non-fatal):", result.error);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
