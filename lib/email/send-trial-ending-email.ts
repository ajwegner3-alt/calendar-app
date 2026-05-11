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

export interface SendTrialEndingEmailArgs {
  /** Account ID — drives sender factory routing per LD-11 strict. */
  accountId: string;
  /** Account branding + recipient context. */
  account: AccountRecord;
  /** Trial end timestamp (ISO string or Date). Used to render days-remaining copy. */
  trialEndAt: string | Date;
  /** Base URL for the in-app CTA link.
   *  Source: process.env.NEXT_PUBLIC_APP_URL with fallback to the Vercel URL. */
  appUrl: string;
}

export interface SendTrialEndingEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Phase 44 (BILL-24 — trial-ending-3-days-out): send the trial-will-end transactional
 * email when Stripe fires customer.subscription.trial_will_end (~3 days before trial_end).
 *
 * LD-11 strict: routes through getSenderForAccount(accountId) — owner sees this email
 * arrive from the same address as their booking confirmations. For Resend-provider accounts,
 * the sender is bookings@nsintegrations.com with reply-to: owner_email. See 44-00-PLANNER-NOTES.md.
 *
 * Never throws: any failure (refused sender, network error, send error) is returned as
 * {success: false, error}. The webhook handler (Plan 44-04) MUST NOT block on email failures —
 * Stripe Dashboard / Customer Portal remains the authoritative source of subscription state.
 */
export async function sendTrialEndingEmail(
  args: SendTrialEndingEmailArgs,
): Promise<SendTrialEndingEmailResult> {
  const { accountId, account, trialEndAt, appUrl } = args;

  if (!account.owner_email) {
    // Cannot send without a recipient. Log + soft-fail (do not throw — webhook continues).
    console.error("[trial-ending-email] no owner_email on account", { account_id: accountId });
    return { success: false, error: "no_owner_email" };
  }

  // Compute days remaining from trialEndAt for the copy.
  const trialEndDate = trialEndAt instanceof Date ? trialEndAt : new Date(trialEndAt);
  const msRemaining = trialEndDate.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msRemaining / 86_400_000));

  const subject =
    daysLeft <= 0
      ? "Your trial ends today"
      : daysLeft === 1
        ? "Your trial ends tomorrow"
        : `Your trial ends in ${daysLeft} days`;

  const ctaUrl = `${appUrl}/app/billing`;
  const branding = {
    name: account.name,
    logo_url: account.logo_url,
    brand_primary: account.brand_primary,
  };

  const formattedEndDate = trialEndDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  ${renderEmailBrandedHeader(branding)}
  <h1 style="${brandedHeadingStyle(account.brand_primary)}">${escapeHtml(subject)}</h1>
  <p style="margin: 0 0 16px 0;">Hi ${escapeHtml(account.name)},</p>
  <p style="margin: 0 0 16px 0;">
    Your free trial ends on <strong>${escapeHtml(formattedEndDate)}</strong>.
    Choose a plan today to keep your booking page, embed widget, and all your settings active without interruption.
  </p>
  <p style="margin: 0 0 24px 0; color: #555; font-size: 14px;">
    If you don't choose a plan before your trial ends, your booking page will be paused until you do.
    Your data stays safe either way.
  </p>
  <p style="margin: 0 0 32px 0;">
    ${renderBrandedButton({ href: ctaUrl, label: "Choose a plan", primaryColor: account.brand_primary })}
  </p>
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
      console.error("[trial-ending-email] sender refused", {
        account_id: accountId,
        error: result.error,
      });
    } else {
      console.error("[trial-ending-email] send failed", {
        account_id: accountId,
        error: result.error,
      });
    }
  } else {
    console.log("[trial-ending-email] sent", {
      account_id: accountId,
      to: account.owner_email,
      days_left: daysLeft,
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
