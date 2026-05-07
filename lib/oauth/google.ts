import "server-only";

/**
 * Fetches the granted scopes for a Google access token by querying
 * Google's tokeninfo endpoint. Returns the space-delimited scopes string
 * or null on any error (expired token, network failure, etc.).
 *
 * Used in the OAuth callback route to detect whether gmail.send was granted.
 */
export async function fetchGoogleGrantedScopes(
  accessToken: string
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { method: "GET", cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { scope?: string };
    return data.scope ?? null;
  } catch (err) {
    console.error("[google] fetchGoogleGrantedScopes failed:", err);
    return null;
  }
}

/**
 * Revokes a Google refresh token by POSTing to Google's revoke endpoint.
 * Returns true if the revocation succeeded (HTTP 200), false otherwise.
 *
 * This helper swallows network errors — callers must not throw on false.
 * Used by disconnectGmailAction as a best-effort cleanup before deleting
 * the local credential row.
 */
export async function revokeGoogleRefreshToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        cache: "no-store",
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[google] revokeGoogleRefreshToken failed (non-fatal):", err);
    return false;
  }
}

/**
 * Returns true if the gmail.send scope is present in the grantedScopes string.
 * Accepts null/undefined — returns false rather than throwing.
 *
 * Used by the OAuth callback route and Phase 35 send logic to gate email sending.
 */
export function hasGmailSendScope(
  grantedScopes: string | null | undefined
): boolean {
  if (!grantedScopes) return false;
  return grantedScopes
    .split(/\s+/)
    .includes("https://www.googleapis.com/auth/gmail.send");
}

export interface TokenResult {
  accessToken?: string;
  /** "invalid_grant" indicates the refresh token is revoked. Other strings are network/config failures. */
  error?: string;
}

/**
 * Exchange a Google refresh token for a short-lived (1h) access token.
 * Never throws — returns { error } on any failure path so callers can branch
 * cleanly (the sender factory uses "invalid_grant" to flag needs_reconnect).
 *
 * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Phase 35 PREREQ).
 * Read lazily inside the function so test setup can mutate process.env
 * (matches lib/oauth/encrypt.ts pattern from Phase 34, Plan 02).
 */
export async function fetchGoogleAccessToken(
  refreshToken: string
): Promise<TokenResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set" };
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    if (data.access_token) return { accessToken: data.access_token };
    return { error: data.error ?? "token_exchange_failed" };
  } catch (err) {
    console.error("[google] fetchGoogleAccessToken network error:", err);
    return { error: "network_error" };
  }
}
