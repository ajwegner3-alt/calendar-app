import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Canonical auth confirmation handler (AUTH-08).
 *
 * Handles all email-based OTP flows using the modern verifyOtp pattern:
 *   - signup confirmation
 *   - password recovery
 *   - future: magic-link, email-change
 *
 * Closes v1.0 BLOCKER: /auth/callback 404 (never deployed).
 * Pattern: verifyOtp({ type, token_hash }) — NOT the legacy exchangeCodeForSession.
 *
 * Query params:
 *   token_hash  — PKCE token from Supabase email link
 *   type        — EmailOtpType: "signup" | "recovery" | "magiclink" | "email_change"
 *   next        — optional redirect path (default /app); ignored for recovery type
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  // Both params are required — missing either means a malformed or truncated link.
  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/auth/auth-error?reason=missing_params", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    // URL-encode the message so special characters don't break the redirect URL.
    // Common values: "otp_expired", "Email link is invalid or has expired", etc.
    return NextResponse.redirect(
      new URL(
        `/auth/auth-error?reason=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  // Recovery sessions are scoped to password update only — always forward to
  // the password-update page regardless of `next`. Respecting `next` here would
  // allow an attacker to redirect into /app with an authenticated recovery session.
  if (type === "recovery") {
    return NextResponse.redirect(
      new URL("/auth/reset-password", request.url),
    );
  }

  // All other types (signup, magiclink, email_change) — redirect to `next`.
  // Plan 10-07 will add a middleware redirect from /app → /onboarding when no
  // accounts row exists; this handler doesn't need to know about that.
  return NextResponse.redirect(new URL(next, request.url));
}
