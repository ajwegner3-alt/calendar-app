import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/oauth/encrypt";
import { fetchGoogleGrantedScopes, hasGmailSendScope } from "@/lib/oauth/google";

/**
 * Direct-Google OAuth callback for the Gmail connect flow.
 *
 * Phase 35 — replaces the Supabase linkIdentity flow which silently dropped
 * provider_refresh_token. This route owns the OAuth surface end-to-end:
 *   - state cookie verified against ?state query param
 *   - code exchanged at oauth2.googleapis.com/token directly (our client_id)
 *   - gmail.send scope verified via tokeninfo before persist
 *   - refresh_token encrypted with AES-256-GCM and upserted to
 *     account_oauth_credentials via service-role admin client
 *
 * The user must already be authenticated via Supabase — this flow does NOT
 * touch auth.users or auth.identities. It only persists the Gmail credential
 * for the current user_id.
 */
const STATE_COOKIE = "gmail_connect_state";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  // Build origin from forwarded headers so redirects land on the same deploy.
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  const settingsUrl = `${origin}/app/settings/gmail`;

  // User cancelled at Google consent screen.
  if (oauthError) {
    return NextResponse.redirect(`${settingsUrl}?connect_error=cancelled`);
  }
  if (!code) {
    return NextResponse.redirect(`${settingsUrl}?connect_error=missing_code`);
  }

  // Validate state cookie (CSRF protection).
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${settingsUrl}?connect_error=invalid_state`);
  }
  cookieStore.delete(STATE_COOKIE);

  // Caller must be authenticated via Supabase already.
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.redirect(`${settingsUrl}?connect_error=not_authenticated`);
  }
  const userId = claimsData.claims.sub as string;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      "[gmail-connect] missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env",
    );
    return NextResponse.redirect(
      `${settingsUrl}?connect_error=server_misconfigured`,
    );
  }

  const redirectUri = `${origin}/auth/gmail-connect/callback`;

  // Exchange the authorization code for tokens directly with Google.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    console.error(
      "[gmail-connect] token exchange failed",
      tokenRes.status,
      errText,
    );
    return NextResponse.redirect(`${settingsUrl}?connect_error=token_exchange`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
  };

  const refreshToken = tokenData.refresh_token;
  const accessToken = tokenData.access_token;

  // Google only returns refresh_token on first consent (or with prompt=consent
  // when no prior grant exists). If absent, the user must revoke the existing
  // grant at https://myaccount.google.com/permissions and try again.
  if (!refreshToken) {
    console.error(
      "[gmail-connect] no refresh_token in token response — user must revoke prior grant",
    );
    return NextResponse.redirect(`${settingsUrl}?connect_error=no_refresh_token`);
  }

  // Verify gmail.send is in the granted scopes (authoritative via tokeninfo).
  const grantedScopes = accessToken
    ? await fetchGoogleGrantedScopes(accessToken)
    : (tokenData.scope ?? null);
  if (!hasGmailSendScope(grantedScopes)) {
    return NextResponse.redirect(`${settingsUrl}?connect_error=scope_denied`);
  }

  // Encrypt refresh_token at rest (AES-256-GCM) and upsert.
  try {
    const encrypted = encryptToken(refreshToken);
    const admin = createAdminClient();
    const { error: upsertErr } = await admin
      .from("account_oauth_credentials")
      .upsert(
        {
          user_id: userId,
          provider: "google",
          refresh_token_encrypted: encrypted,
          granted_scopes: grantedScopes,
          connected_at: new Date().toISOString(),
          last_refresh_at: new Date().toISOString(),
          status: "connected",
        },
        { onConflict: "user_id,provider" },
      );
    if (upsertErr) {
      console.error("[gmail-connect] upsert failed:", upsertErr.message);
      return NextResponse.redirect(`${settingsUrl}?connect_error=db_write`);
    }
  } catch (err) {
    console.error("[gmail-connect] encryption/persist failure:", err);
    return NextResponse.redirect(`${settingsUrl}?connect_error=encrypt`);
  }

  return NextResponse.redirect(`${settingsUrl}?connected=1`);
}
