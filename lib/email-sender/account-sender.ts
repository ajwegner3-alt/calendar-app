import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";
import { fetchGoogleAccessToken } from "@/lib/oauth/google";
import { createGmailOAuthClient } from "./providers/gmail-oauth";
import {
  createResendClient,
  RESEND_REFUSED_SEND_ERROR_PREFIX,
} from "./providers/resend";
import type { EmailClient, EmailOptions, EmailResult } from "./types";

/** Stable prefix callers can match on to distinguish OAuth refusal from other send errors. */
export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";

// Re-export so callers can `import { RESEND_REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender"`
// — single import location for both refusal prefixes.
export { RESEND_REFUSED_SEND_ERROR_PREFIX };

/**
 * Phase 36 OQ-2 fix: shared helper for callers that need to detect a refused
 * send regardless of which provider produced it. Returns true if the error
 * string starts with either the OAuth or Resend refusal prefix.
 *
 * Used by lib/email/send-booking-emails.ts to set confirmation_email_sent=false
 * on either provider's refusal (was previously OAuth-prefix-only — Resend
 * refusals slipped through and the booking row stayed flagged "sent").
 */
export function isRefusedSend(error?: string): boolean {
  if (!error) return false;
  return (
    error.startsWith(REFUSED_SEND_ERROR_PREFIX + ":") ||
    error.startsWith(RESEND_REFUSED_SEND_ERROR_PREFIX + ":")
  );
}

function refusedSender(
  reason: string,
  opts?: { provider?: "gmail" | "resend"; prefix?: string },
): EmailClient {
  const provider = opts?.provider ?? "gmail";
  const prefix = opts?.prefix ?? REFUSED_SEND_ERROR_PREFIX;
  return {
    provider,
    async send(_: EmailOptions): Promise<EmailResult> {
      return { success: false, error: `${prefix}: ${reason}` };
    },
  };
}

/**
 * Phase 36 soft abuse ceiling — 5000 sends/day per Resend account.
 * Emits console.warn with structured fields when crossed; does NOT block
 * the send (CONTEXT decision: warn-log only, hard cap deferred until abuse
 * is observed). Counts ALL email_send_log rows for the account, not just
 * Resend rows — the threshold is total per-account-day volume.
 */
const RESEND_ABUSE_WARN_THRESHOLD = 5000;
async function warnIfResendAbuseThresholdCrossed(accountId: string): Promise<void> {
  try {
    const { getDailySendCount } = await import("./quota-guard");
    const count = await getDailySendCount(accountId);
    if (count >= RESEND_ABUSE_WARN_THRESHOLD) {
      console.warn("[RESEND_ABUSE_THRESHOLD_CROSSED]", {
        account_id: accountId,
        count,
        threshold: RESEND_ABUSE_WARN_THRESHOLD,
      });
    }
  } catch (err) {
    // Advisory only — never let this break a send.
    console.error("[account-sender] abuse-threshold check failed (non-fatal)", err);
  }
}

/**
 * Per-account email sender factory.
 *
 * Phase 36: Routes on accounts.email_provider.
 *   - 'resend' + resend_status='active'     → Resend HTTP provider (provider:'resend')
 *   - 'resend' + resend_status='suspended'  → refused sender (resend_send_refused: account_suspended)
 *   - 'gmail' (default)                     → existing Gmail OAuth path
 *
 * CONTEXT decision: Resend wins. If email_provider='resend', Resend is used even
 * when an account_oauth_credentials row exists. Flipping back to 'gmail' restores
 * the OAuth path without touching the stored credential.
 *
 * Gmail OAuth flow (RESEARCH §Pattern 1):
 *   1. Look up account → owner_user_id, owner_email.
 *   2. Look up account_oauth_credentials by user_id + provider='google'.
 *   3. Decrypt refresh_token_encrypted.
 *   4. Exchange refresh token for fresh access token.
 *   5. On invalid_grant: UPDATE status='needs_reconnect' and return refused sender (AUTH-30).
 *   6. Return EmailClient backed by createGmailOAuthClient.
 *
 * Never throws. Every failure path returns a sender (real or refused) so
 * callers can do `const result = await sender.send(...)` and only branch
 * on result.success — booking flows never raise on OAuth issues
 * (CONTEXT decision: booking succeeds, email skipped on revoked token).
 *
 * No caching — Vercel serverless functions don't share memory between
 * invocations and access tokens are short-lived (RESEARCH §Pattern 1
 * "Anti-pattern: Caching access tokens").
 */
export async function getSenderForAccount(accountId: string): Promise<EmailClient> {
  const admin = createAdminClient();

  const { data: account, error: accountErr } = await admin
    .from("accounts")
    .select("owner_user_id, owner_email, email_provider, resend_status, name")
    .eq("id", accountId)
    .maybeSingle();

  if (accountErr) {
    console.error("[account-sender] account lookup failed", { accountId, accountErr });
    return refusedSender("account lookup failed");
  }
  if (!account?.owner_user_id) {
    console.error("[account-sender] no account row", { accountId });
    return refusedSender("no account row");
  }
  if (!account.owner_email) {
    console.error("[account-sender] account has no owner_email", { accountId });
    return refusedSender("missing owner_email");
  }

  // ----- Phase 36: Resend routing -----
  // CONTEXT decision: Resend wins. If email_provider='resend', we use Resend
  // even when an account_oauth_credentials row exists (so Andrew can flip
  // back to 'gmail' later without forcing a re-OAuth — Gmail credential is
  // left untouched on flip).
  if (account.email_provider === "resend") {
    // Suspension takes precedence over RESEND_API_KEY checks etc — once Andrew
    // marks an account suspended we want a clear, fast refusal log entry.
    if (account.resend_status === "suspended") {
      console.error("[account-sender] resend account suspended", { accountId });
      return refusedSender("account_suspended", {
        provider: "resend",
        prefix: RESEND_REFUSED_SEND_ERROR_PREFIX,
      });
    }

    // Soft abuse threshold (CONTEXT decision: warn-log only, no block).
    // Fire-and-forget so the send path is not blocked by an advisory check.
    void warnIfResendAbuseThresholdCrossed(accountId);

    const fromName = account.name ?? "Bookings";
    return createResendClient({
      fromName,
      fromAddress: "bookings@nsintegrations.com",
      replyToAddress: account.owner_email,
    });
  }
  // ----- end Resend routing -----

  const { data: cred, error: credErr } = await admin
    .from("account_oauth_credentials")
    .select("refresh_token_encrypted, status")
    .eq("user_id", account.owner_user_id)
    .eq("provider", "google")
    .maybeSingle();

  if (credErr) {
    console.error("[account-sender] credential lookup failed", { accountId, credErr });
    return refusedSender("credential lookup failed");
  }
  if (!cred?.refresh_token_encrypted) {
    console.error("[account-sender] no credential", { accountId });
    return refusedSender("no credential");
  }
  if (cred.status === "needs_reconnect") {
    console.error("[account-sender] credential needs_reconnect", { accountId });
    return refusedSender("needs_reconnect");
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(cred.refresh_token_encrypted);
  } catch (err) {
    console.error("[account-sender] decrypt failed", { accountId, err });
    return refusedSender("decrypt failed");
  }

  const tokenResult = await fetchGoogleAccessToken(refreshToken);
  if (tokenResult.error === "invalid_grant") {
    // Authoritative revocation flag — set here once, surfaces in /app/settings/gmail
    // (gmail-status-panel.tsx renders the Reconnect button on this status).
    await admin
      .from("account_oauth_credentials")
      .update({ status: "needs_reconnect" })
      .eq("user_id", account.owner_user_id)
      .eq("provider", "google");
    console.error("[EMAIL_OAUTH_REVOKED]", { account_id: accountId });
    return refusedSender("invalid_grant — flagged needs_reconnect");
  }
  if (!tokenResult.accessToken) {
    console.error("[account-sender] token exchange failed", { accountId, error: tokenResult.error });
    return refusedSender(`token exchange failed: ${tokenResult.error}`);
  }

  return createGmailOAuthClient({
    user: account.owner_email,
    accessToken: tokenResult.accessToken,
  });
}
