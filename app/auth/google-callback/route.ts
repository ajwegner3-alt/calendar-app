import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/oauth/encrypt";
import { fetchGoogleGrantedScopes, hasGmailSendScope } from "@/lib/oauth/google";

/**
 * Google OAuth callback for the Phase 34 signup/login flow (signInWithOAuth).
 *
 * Phase 35 split the Gmail "connect" flow off this route — that path now lives
 * at /auth/gmail-connect/callback and exchanges the code with Google directly,
 * which guarantees provider_refresh_token capture. This route remains for the
 * Supabase signInWithOAuth flow used by /app/signup and /app/login (where the
 * goal is to create or sign-in the auth.users row, not to capture Gmail send
 * credentials reliably).
 *
 * If the signup flow happens to capture provider_refresh_token from Supabase's
 * session, we still upsert it as a convenience — but the user can always
 * re-run the dedicated Connect Gmail flow from /app/settings/gmail.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // User clicked "Cancel" at Google consent screen.
  if (oauthError) {
    return NextResponse.redirect(
      new URL("/app/signup?google_error=access_denied", request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/auth-error?reason=missing_code", request.url),
    );
  }

  // Exchange the PKCE authorization code for a session.
  // provider_refresh_token is ONLY available here — must be captured in this request.
  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !data.session) {
    return NextResponse.redirect(
      new URL(
        `/auth/auth-error?reason=${encodeURIComponent(exchangeError?.message ?? "exchange_failed")}`,
        request.url,
      ),
    );
  }

  const session = data.session;
  const userId = session.user.id;
  const providerRefreshToken = session.provider_refresh_token ?? null;
  const providerAccessToken = session.provider_token ?? null;

  // Detect partial grant via Google tokeninfo (authoritative source — RESEARCH Open Q #1).
  // Do NOT use heuristics on scope strings; use the tokeninfo endpoint.
  let grantedScopes: string | null = null;
  let gmailGranted = false;
  if (providerAccessToken) {
    grantedScopes = await fetchGoogleGrantedScopes(providerAccessToken);
    gmailGranted = hasGmailSendScope(grantedScopes);
  }

  // Persist credential ONLY if we have a refresh token AND gmail.send was granted.
  // If gmail.send was denied, no point storing a token that can't send mail —
  // user must reconnect with full scope. Plan 04's settings flow handles reconnect.
  if (providerRefreshToken && gmailGranted) {
    try {
      const refreshTokenEncrypted = encryptToken(providerRefreshToken);
      const admin = createAdminClient();
      const { error: upsertError } = await admin
        .from("account_oauth_credentials")
        .upsert(
          {
            user_id: userId,
            provider: "google",
            refresh_token_encrypted: refreshTokenEncrypted,
            granted_scopes: grantedScopes,
            connected_at: new Date().toISOString(),
            last_refresh_at: new Date().toISOString(),
            status: "connected",
          },
          { onConflict: "user_id,provider" },
        );
      if (upsertError) {
        // Don't 500 — log the error and continue.
        // Phase 35 will fail-closed on send and surface reconnect prompt to user.
        console.error("[google-callback] credential upsert failed:", upsertError.message);
      }
    } catch (err) {
      // Log the error object only — the raw refresh token is never interpolated here.
      console.error("[google-callback] encryption/persist failure:", err);
    }
  }

  // Route based on onboarding state.
  // New users (Google-initiated signup) won't have onboarding_complete = true yet —
  // the existing provision_account_for_new_user trigger creates the stub row.
  // Existing users (linked via signInWithOAuth with matching email) will already have
  // onboarding_complete = true.
  const { data: account } = await supabase
    .from("accounts")
    .select("onboarding_complete")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  const isExistingUser = !!account?.onboarding_complete;

  if (isExistingUser) {
    // Auto-link case: Google email matched existing email/password account.
    // Banner UI (?google_linked=1 param) is implemented in Plan 04 shell section.
    return NextResponse.redirect(new URL("/app?google_linked=1", request.url));
  }

  // New signup flow: route to onboarding.
  // Surface gmail_skipped=1 when user declined gmail.send scope so Plan 04's
  // optional "Connect Gmail" step is visible during onboarding.
  const onboardingUrl = gmailGranted ? "/onboarding" : "/onboarding?gmail_skipped=1";
  return NextResponse.redirect(new URL(onboardingUrl, request.url));
}
