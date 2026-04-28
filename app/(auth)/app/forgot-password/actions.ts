"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "./schema";

export type ForgotPasswordState = {
  success?: boolean;
  message?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"email", string[]>>;
};

/**
 * Server Action: request a password reset email (AUTH-09).
 *
 * Rate limit: 3 requests per IP per hour — prevents enumeration-via-timing and
 * abuse of outbound email quota.
 *
 * P-A1 enumeration prevention: ALWAYS returns the same generic success message
 * regardless of whether the email belongs to a registered account. Supabase errors
 * that would reveal account existence are caught and logged server-side only.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  // 1. Zod validate
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { email } = parsed.data;

  // 2. Rate limit: 3 per IP per hour
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const rateLimit = await checkRateLimit(
    `forgot-password:${ip}`,
    3,
    60 * 60 * 1000,
  );
  if (!rateLimit.allowed) {
    return { formError: "Too many attempts. Please wait." };
  }

  // 3. Send reset email via Supabase
  //    redirectTo is the URL Supabase embeds in the email link.
  //    /auth/confirm?next=/auth/reset-password routes to the password-update page
  //    after verifying the recovery token.
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/reset-password`,
  });

  // Log the error server-side but NEVER return it to the client. Supabase returns
  // an error for unregistered emails, which would leak account existence (P-A1).
  if (error) {
    console.error("[forgot-password] resetPasswordForEmail error:", error);
  }

  // 4. Always return the same generic success message (P-A1)
  return {
    success: true,
    message: "If an account exists for that email, we've sent a reset link.",
  };
}
