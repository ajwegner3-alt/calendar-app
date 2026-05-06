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
