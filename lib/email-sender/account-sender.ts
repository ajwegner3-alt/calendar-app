import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";
import { fetchGoogleAccessToken } from "@/lib/oauth/google";
import { createGmailOAuthClient } from "./providers/gmail-oauth";
import type { EmailClient, EmailOptions, EmailResult } from "./types";

/** Stable prefix callers can match on to distinguish OAuth refusal from other send errors. */
export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";

function refusedSender(reason: string): EmailClient {
  return {
    provider: "gmail",
    async send(_: EmailOptions): Promise<EmailResult> {
      return { success: false, error: `${REFUSED_SEND_ERROR_PREFIX}: ${reason}` };
    },
  };
}

/**
 * Per-account Gmail OAuth sender factory.
 *
 * Flow (RESEARCH §Pattern 1):
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
    .select("owner_user_id, owner_email")
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
