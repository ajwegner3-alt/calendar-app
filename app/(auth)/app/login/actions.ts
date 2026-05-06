"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import { loginSchema } from "./schema";

export type LoginState = {
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  formError?: string;
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
    return { formError: "Too many login attempts. Please wait a few minutes and try again." };
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
    return { formError };
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
