import "server-only";
import {
  getSenderForAccount,
  isRefusedSend,
} from "@/lib/email-sender/account-sender";
import {
  renderEmailBrandedHeader,
  renderEmailFooter,
  renderBrandedButton,
  brandedHeadingStyle,
  stripHtml,
} from "./branding-blocks";

interface AccountRecord {
  /** Account UUID — used for getSenderForAccount routing + log breadcrumbs. */
  id: string;
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  owner_email: string | null;
}

export interface SendPaymentFailedEmailArgs {
  /** Account ID — drives sender factory routing per LD-11 strict. */
  accountId: string;
  /** Account branding + recipient context. */
  account: AccountRecord;
  /** Stripe invoice.attempt_count (1-based: 1 = first failure, 2 = first retry, etc.). */
  attemptCount: number;
  /** Stripe invoice.next_payment_attempt (Unix seconds) or null (null = final attempt). */
  nextPaymentAttempt: number | null;
  /** Invoice amount in cents (for human-readable amount in the email body). */
  amountDueCents: number;
  /** Stripe-hosted invoice URL (optional — included in the email as a secondary link if present). */
  hostedInvoiceUrl: string | null;
  /** Base URL for the in-app CTA link.
   *  Source: process.env.NEXT_PUBLIC_APP_URL with fallback to the Vercel URL. */
  appUrl: string;
}

export interface SendPaymentFailedEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Phase 44 (BILL-24 — payment-failed): send the payment-failed transactional email
 * when Stripe fires invoice.payment_failed. Sends on EVERY retry attempt (not just first) —
 * see 44-00-PLANNER-NOTES.md for the resolved open question. Each retry is a distinct Stripe
 * event with a distinct event ID, so the stripe_webhook_events dedupe table prevents
 * duplicate sends for the same Stripe event.
 *
 * Email copy adapts to attempt context:
 *   nextPaymentAttempt !== null → "Stripe will retry on {date}"
 *   nextPaymentAttempt === null → "This was our last attempt — please update your payment method"
 *
 * LD-11 strict: routes through getSenderForAccount(accountId). For Resend-provider accounts,
 * the sender is bookings@nsintegrations.com — see 44-00-PLANNER-NOTES.md.
 *
 * Never throws: any failure is returned as {success: false, error}. The webhook handler
 * (Plan 44-04) MUST NOT block on email failures.
 */
export async function sendPaymentFailedEmail(
  args: SendPaymentFailedEmailArgs,
): Promise<SendPaymentFailedEmailResult> {
  const {
    accountId,
    account,
    attemptCount,
    nextPaymentAttempt,
    amountDueCents,
    hostedInvoiceUrl,
    appUrl,
  } = args;

  if (!account.owner_email) {
    console.error("[payment-failed-email] no owner_email on account", { account_id: accountId });
    return { success: false, error: "no_owner_email" };
  }

  const isFinalAttempt = nextPaymentAttempt === null;
  const subject = isFinalAttempt
    ? "Final notice: please update your payment method"
    : "We couldn't process your payment";

  const ctaUrl = `${appUrl}/app/billing`;
  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  const amountUsd = (amountDueCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  const nextRetryLine = !isFinalAttempt && nextPaymentAttempt
    ? `<p style="margin: 0 0 16px 0;">Stripe will retry the charge on <strong>${escapeHtml(
        new Date(nextPaymentAttempt * 1000).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      )}</strong>. You can update your payment method now to avoid waiting.</p>`
    : "";

  const finalAttemptLine = isFinalAttempt
    ? `<p style="margin: 0 0 16px 0; color: #b45309;"><strong>This was our last automatic retry.</strong>
       If your payment method isn't updated soon, your subscription will be canceled and your booking page will be paused.</p>`
    : "";

  const hostedInvoiceLine = hostedInvoiceUrl
    ? `<p style="margin: 0 0 24px 0; font-size: 14px; color: #555;">
        You can <a href="${escapeHtml(hostedInvoiceUrl)}" style="color:#3B82F6;">view the invoice on Stripe</a> for details.
      </p>`
    : "";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">${escapeHtml(subject)}</h1>
  <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(account.name)},</p>
  <p style="margin: 0 0 16px 0;">
    Your most recent payment of <strong>${escapeHtml(amountUsd)}</strong> couldn't be processed
    (attempt ${attemptCount}).
    This usually means an expired card, an updated billing address, or a temporary bank decline.
  </p>
  ${nextRetryLine}
  ${finalAttemptLine}
  <p style="margin: 0 0 24px 0;">
    The fastest fix is to update your payment method in your billing settings.
  </p>
  <p style="margin: 0 0 24px 0;">
    ${renderBrandedButton({ href: ctaUrl, label: "Update payment method", primaryColor: account.brand_primary })}
  </p>
  ${hostedInvoiceLine}
  <p style="margin: 0; font-size: 12px; color: #888;">
    Questions? Just reply to this email.
  </p>
  ${renderEmailFooter()}
</div>`;

  const sender = await getSenderForAccount(accountId);
  const result = await sender.send({
    to: account.owner_email,
    subject,
    html,
    text: stripHtml(html),
  });

  if (!result.success) {
    if (isRefusedSend(result.error)) {
      console.error("[payment-failed-email] sender refused", {
        account_id: accountId,
        error: result.error,
        attempt_count: attemptCount,
        is_final: isFinalAttempt,
      });
    } else {
      console.error("[payment-failed-email] send failed", {
        account_id: accountId,
        error: result.error,
        attempt_count: attemptCount,
        is_final: isFinalAttempt,
      });
    }
  } else {
    console.log("[payment-failed-email] sent", {
      account_id: accountId,
      to: account.owner_email,
      attempt_count: attemptCount,
      is_final: isFinalAttempt,
    });
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
