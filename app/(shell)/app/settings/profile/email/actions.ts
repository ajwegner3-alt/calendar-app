"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import { checkAndConsumeQuota, QuotaExceededError } from "@/lib/email-sender/quota-guard";
import { emailChangeSchema } from "./schema";

export type EmailChangeState = {
  success?: boolean;
  message?: string;
  formError?: string;
  fieldErrors?: { new_email?: string[] };
} | null;

/**
 * Server Action: request an email-address change.
 *
 * Calls supabase.auth.updateUser({ email }) which triggers Supabase to send
 * a confirmation link to the NEW email. The user must click it before
 * auth.users.email (and accounts.owner_email via the 10-08 trigger) updates.
 *
 * Security notes:
 *   - P-A1 (generic response): never distinguish "email already in use" from
 *     success. Either branch returns the same success message.
 *   - Rate limit: 3/hour per (ip:uid) — uses the "emailChange" key in
 *     AUTH_RATE_LIMITS (added in Plan 10-05). Separate from forgotPassword
 *     so future threshold changes affect only email-change traffic.
 *   - Quota guard: counted against the daily 200-email Gmail SMTP cap.
 */
export async function requestEmailChangeAction(
  _prev: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  // 1. Validate input
  const parsed = emailChangeSchema.safeParse({ new_email: formData.get("new_email") });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // 2. Require authenticated session
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return { formError: "Please log in to change your email." };
  }

  const uid = claimsData.claims.sub as string;

  // 3. Rate limit — key: `${ip}:${uid}` (per AUTH_RATE_LIMITS.emailChange)
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const origin = h.get("origin") ?? "";

  const rl = await checkAuthRateLimit("emailChange", `${ip}:${uid}`);
  if (!rl.allowed) {
    return { formError: "Too many email-change attempts. Please wait an hour before trying again." };
  }

  // 4. Quota guard — count against daily signup-class email budget
  try {
    await checkAndConsumeQuota("email-change");
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return { formError: "Email changes are temporarily unavailable. Please try again tomorrow." };
    }
    // Unexpected error — let it propagate (will surface as unhandled in logs)
    throw e;
  }

  // 5. Trigger the Supabase email-change flow.
  //    updateUser({ email }) sends a confirmation link to the NEW email.
  //    If "Secure email change" is ON (Supabase default), it ALSO sends a
  //    notice/revocation link to the OLD email. Both are handled by Supabase.
  //    Our /auth/confirm route (type=email_change) already handles the OTP click.
  //
  //    emailRedirectTo is included so Supabase embeds the correct redirect in the
  //    email link. The `next` param lands the user on /app/settings/profile after
  //    confirmation so they see the updated email immediately.
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.new_email },
    {
      emailRedirectTo: `${origin}/auth/confirm?next=/app/settings/profile&type_hint=email_change`,
    },
  );

  if (error) {
    // Log the real error server-side for ops visibility, but return a generic
    // message to the user (P-A1 — never leak whether the email is already in use).
    console.error("[email-change] updateUser error (returning generic success):", error.message);
  }

  revalidatePath("/app/settings/profile");
  return {
    success: true,
    message:
      "If that email address is available, you will receive a confirmation link. Your email won't change until you click it.",
  };
}
