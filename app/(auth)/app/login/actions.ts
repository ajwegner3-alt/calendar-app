"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import { loginSchema, magicLinkSchema } from "./schema";

export type LoginState = {
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  formError?: string;
  /**
   * Phase 45 (AUTH-38): which class of error fired, used by the client
   * to gate the 3-fail magic-link nudge counter on credentials-only.
   * Undefined on success or on rate-limit/server error branches.
   */
  errorKind?: "credentials" | "rateLimit" | "server";
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 1. Server-side Zod re-validation (defense in depth).
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Rate limit: 10 attempts per IP per 5 minutes (AUTH-11).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const rl = await checkAuthRateLimit("login", ip);
  if (!rl.allowed) {
    return { formError: "Too many login attempts. Please wait a few minutes and try again.", errorKind: "rateLimit" };
  }

  // 3. Supabase auth. createClient is async (Phase 1 uses await cookies()).
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Generic for 400 (credentials) — do NOT distinguish email-unknown vs
    // wrong-password (user enumeration). Only tailor 429 + 5xx.
    // Gate on error.status, not error.code (upstream auth-js bug: code is
    // undefined on invalid credentials — RESEARCH §7.3).
    let formError = "Invalid email or password.";
    if (error.status === 429) {
      formError = "Too many attempts. Please wait a minute and try again.";
    } else if (!error.status || error.status >= 500) {
      formError = "Something went wrong. Please try again.";
    }
    // Phase 45 (AUTH-38): emit errorKind discriminant so the client can gate
    // the 3-fail magic-link nudge counter on credentials-only. Order of the
    // ternaries matches the formError if-chain above so the two stay in sync.
    const errorKind: "credentials" | "rateLimit" | "server" =
      error.status === 429 ? "rateLimit"
      : (!error.status || error.status >= 500) ? "server"
      : "credentials";
    return { formError, errorKind };
  }

  // 4. Success. revalidatePath busts the root layout cache so the shell
  //    re-renders with the new session. redirect() throws NEXT_REDIRECT —
  //    MUST be outside any try/catch (RESEARCH §7.1).
  revalidatePath("/", "layout");
  redirect("/app");
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
    redirect("/app/login?google_error=init_failed");
  }

  // redirect() throws NEXT_REDIRECT — keep outside try/catch.
  redirect(data.url);
}

export type MagicLinkState = {
  success?: boolean;
  formError?: string;
  fieldErrors?: Partial<Record<"email", string[]>>;
};

/**
 * Server Action: request a magic-link login email (AUTH-24).
 *
 * Login-only mode: shouldCreateUser:false. Supabase returns an error for unknown
 * emails in this mode (GitHub supabase/auth#1547) — the error is logged
 * server-side and NEVER surfaced to the client. This guarantees identical
 * response bodies for known and unknown emails (AUTH-29 enumeration safety).
 *
 * Rate limit: 5 requests per (IP + email) per hour. On throttle the action
 * returns the SAME { success: true } shape as a real send — silent rate-limit
 * (CONTEXT lock; an attacker probing throttle status learns nothing).
 *
 * Landing target after click-through: /app (CONTEXT lock — no redirectTo
 * honoring; /auth/confirm route already routes type=magiclink to `next`).
 */
export async function requestMagicLinkAction(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  // 1. Zod validate
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email } = parsed.data;

  // 2. Rate limit: 5 / hour / (IP + email). Silent throttle — same success
  //    shape as a real send so attackers cannot distinguish.
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const rl = await checkAuthRateLimit("magicLink", `${ip}:${email}`);
  if (!rl.allowed) {
    return { success: true };
  }

  // 3. Send via Supabase. shouldCreateUser:false is CRITICAL — defaults to
  //    true, which would silently auto-register every unknown email.
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/app`,
    },
  });

  // 4. True server error path — surface a generic message so the user knows
  //    to retry. 4xx (including the unknown-email 400) is swallowed for
  //    enumeration safety. Mirror loginAction's status-based gating (the
  //    auth-js error.code is unreliable on credential errors per existing
  //    pattern; gate on status only).
  if (error && (!error.status || error.status >= 500)) {
    console.error("[magic-link] signInWithOtp 5xx:", error.message);
    return { formError: "Something went wrong. Please try again." };
  }
  if (error) {
    // 4xx — log and swallow (enumeration safety; could be unknown email).
    console.error(
      "[magic-link] signInWithOtp swallowed (not returned to client):",
      error.message,
    );
  }

  // 5. Always return success for any non-5xx outcome.
  return { success: true };
}
