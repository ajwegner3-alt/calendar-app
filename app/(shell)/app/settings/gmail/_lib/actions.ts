"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";
import { revokeGoogleRefreshToken } from "@/lib/oauth/google";

const STATE_COOKIE = "gmail_connect_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * Connect: redirect to Google's OAuth screen directly.
 *
 * Phase 35 — replaced Supabase linkIdentity (which silently dropped
 * provider_refresh_token under several conditions and exposed Supabase's
 * domain on the Google /permissions page). This action constructs the
 * Google auth URL ourselves; the callback at /auth/gmail-connect/callback
 * exchanges the code with Google directly and persists the credential.
 */
export async function connectGmailAction(): Promise<void> {
  // Caller must be authenticated (the credential is bound to user_id).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    redirect("/app/login");
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const forwardedHost = h.get("x-forwarded-host");
  const hostHeader = h.get("host");
  const origin =
    h.get("origin") ??
    (forwardedHost ? `${proto}://${forwardedHost}` : null) ??
    (hostHeader ? `${proto}://${hostHeader}` : null) ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[connectGmailAction] GOOGLE_CLIENT_ID not set");
    redirect("/app/settings/gmail?connect_error=server_misconfigured");
  }

  // CSRF state token — verified by the callback against this cookie.
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: proto === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/gmail-connect/callback`,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  });

  redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

/** Disconnect: revoke at Google + delete local credential row. */
export async function disconnectGmailAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) return { ok: false, error: "Not authenticated" };
  const userId = claimsData.claims.sub as string;

  const admin = createAdminClient();
  const { data: cred } = await admin
    .from("account_oauth_credentials")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  // Best-effort revoke at Google.
  if (cred?.refresh_token_encrypted) {
    try {
      const refreshToken = decryptToken(cred.refresh_token_encrypted);
      await revokeGoogleRefreshToken(refreshToken);
    } catch (err) {
      console.error(
        "[disconnectGmailAction] decrypt/revoke (non-fatal):",
        err,
      );
    }
  }

  const { error: delError } = await admin
    .from("account_oauth_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");
  if (delError) return { ok: false, error: delError.message };

  return { ok: true };
}
