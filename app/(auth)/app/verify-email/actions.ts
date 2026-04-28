"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const resendSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export type ResendVerificationState = {
  success?: boolean;
  message?: string;
  formError?: string;
};

/**
 * Server Action: resend signup confirmation email.
 *
 * Shared by:
 *   - /app/verify-email (post-signup waiting page)
 *   - /auth/auth-error (expired/invalid token recovery)
 *
 * Rate limits (CONTEXT.md Claude's Discretion):
 *   - 1 per minute per email+IP
 *   - 5 per hour per email+IP
 *
 * P-A1 enumeration prevention: always returns generic success regardless of
 * whether the email belongs to a registered user.
 */
export async function resendVerification(
  _prev: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  // 1. Validate email
  const parsed = resendSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { formError: parsed.error.flatten().fieldErrors.email?.[0] ?? "Invalid email." };
  }
  const { email } = parsed.data;

  // 2. Get client IP for rate-limit key
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  // 3. Per-minute rate limit (1/min)
  const perMinute = await checkRateLimit(
    `resend-verify-min:${email}:${ip}`,
    1,
    60 * 1000,
  );
  if (!perMinute.allowed) {
    return {
      formError: "Please wait before requesting another verification email.",
    };
  }

  // 4. Per-hour rate limit (5/hour)
  const perHour = await checkRateLimit(
    `resend-verify-hour:${email}:${ip}`,
    5,
    60 * 60 * 1000,
  );
  if (!perHour.allowed) {
    return {
      formError: "Please wait before requesting another verification email.",
    };
  }

  // 5. Resend the signup confirmation email
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/app`,
    },
  });

  // Log errors server-side but never surface them to the client (P-A1 enumeration
  // prevention — don't reveal whether an email is registered or not).
  if (error) {
    console.error("[resend-verification] supabase.auth.resend error:", error);
  }

  return {
    success: true,
    message: "Verification email sent. Check your inbox.",
  };
}
