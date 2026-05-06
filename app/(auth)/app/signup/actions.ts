"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import {
  checkAndConsumeQuota,
  QuotaExceededError,
} from "@/lib/email-sender/quota-guard";
import { signupSchema } from "./schema";

export type SignupState = {
  fieldErrors?: { email?: string[]; password?: string[] };
  formError?: string;
};

/**
 * Server Action: public signup (AUTH-05, AUTH-06, AUTH-07, AUTH-11).
 *
 * Security guarantees:
 *   - Rate limited: 5 signup attempts per IP per hour (AUTH-11).
 *   - Quota guarded: fail-closed at 200 signup-verify emails per day (10-04).
 *   - Email-enumeration-safe: ALWAYS redirects to /verify-email regardless of
 *     whether the email is already registered (P-A1 / AUTH-06). Supabase duplicate
 *     errors are logged server-side only.
 *   - Post-signup: redirects to /app/verify-email?email={email} (AUTH-07).
 *
 * Email flow:
 *   signUpAction → supabase.auth.signUp →
 *   Supabase sends confirmation email with link:
 *     {origin}/auth/confirm?token_hash={hash}&type=signup&next=/onboarding
 *   /auth/confirm verifies token → redirects to /onboarding (Plan 10-06).
 *
 * redirect() throws NEXT_REDIRECT — must remain outside try/catch (RESEARCH §7.1).
 */
export async function signUpAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // 1. Zod validate — server-side re-validation (defense in depth).
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Rate limit: 5 per IP per hour (AUTH-11).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const rl = await checkAuthRateLimit("signup", ip);
  if (!rl.allowed) {
    return {
      formError: "Too many signup attempts. Please wait an hour and try again.",
    };
  }

  // 3. Gmail SMTP quota guard: fail-closed at daily cap (ARCH DECISION #2 / Plan 10-04).
  //    Unexpected errors (non-QuotaExceededError) are logged but do not block signup
  //    per the quota-guard contract (fail-open for unexpected DB errors).
  try {
    await checkAndConsumeQuota("signup-verify");
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return {
        formError:
          "Signup is temporarily unavailable. Please try again tomorrow.",
      };
    }
    // Unexpected error — log and continue (fail-open per quota-guard contract).
    console.error("[signup] checkAndConsumeQuota unexpected error:", e);
  }

  // 4. Supabase signUp — emailRedirectTo points to /auth/confirm so the 10-02
  //    handler verifies the token and redirects to /onboarding (10-06 catches it).
  const origin =
    h.get("origin") ??
    h.get("referer")?.replace(/\/[^/]*$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/onboarding`,
    },
  });

  // 5. Generic response — never distinguish "already registered" from "new user" (P-A1).
  if (error) {
    if (error.status === 429) {
      // Supabase's own rate limiting (separate from our application-level guard).
      return { formError: "Too many attempts. Please wait and try again." };
    }
    // "User already registered" and all other Supabase errors: log server-side only.
    // The client ALWAYS sees the same redirect — no enumeration leak.
    console.error(
      "[signup] supabase.auth.signUp error (returning generic to client):",
      error.message,
    );
  }

  // 6. Always redirect to verify-email — regardless of error (AUTH-06 enumeration safety).
  //    redirect() throws NEXT_REDIRECT — keep outside try/catch.
  redirect(`/app/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

/**
 * Server Action: initiate Google OAuth flow (Phase 34).
 *
 * Kicks off Supabase signInWithOAuth with combined scopes:
 *   email + profile + gmail.send (single consent screen).
 *
 * access_type: "offline" — required for refresh_token issuance.
 * prompt: "consent"      — required to RE-issue refresh_token even if user previously consented.
 *
 * redirect() throws NEXT_REDIRECT — keep outside try/catch.
 */
export async function initiateGoogleOAuthAction(): Promise<void> {
  const h = await headers();
  const origin =
    h.get("origin") ??
    h.get("referer")?.replace(/\/[^/]*$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/google-callback`,
      scopes: "email profile https://www.googleapis.com/auth/gmail.send",
      queryParams: {
        access_type: "offline",  // required for refresh_token
        prompt: "consent",       // required to RE-issue refresh_token even if user previously consented
      },
    },
  });

  if (error || !data.url) {
    // No good error UX exists yet for OAuth init failures; log and bounce back to the page.
    console.error("[initiateGoogleOAuthAction] init failed:", error?.message);
    redirect("/app/signup?google_error=init_failed");
  }

  // redirect() throws NEXT_REDIRECT — keep outside try/catch.
  redirect(data.url);
}
