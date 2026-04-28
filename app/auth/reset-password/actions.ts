"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/auth/rate-limits";
import { resetPasswordSchema } from "./schema";

export type ResetPasswordState = {
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string[]>>;
  formError?: string;
};

/**
 * Server Action: update password after recovery email verification (AUTH-09).
 *
 * Only reachable when:
 *   1. User clicked a recovery email link.
 *   2. /auth/confirm?type=recovery verified the token and established a recovery session.
 *   3. /auth/confirm redirected here with that session in cookies.
 *
 * If there is no active session (e.g. user navigated here directly), the
 * action returns an error message rather than attempting the update.
 *
 * redirect() throws NEXT_REDIRECT — must remain outside try/catch (RESEARCH §7.1).
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  // 1. Zod validate (server-side re-validation of the client form)
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { password } = parsed.data;

  // 2. Rate limit: 5 per IP per hour (AUTH-11). Limits brute-force of reset
  //    tokens even when a valid recovery session has been established.
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";
  const rl = await checkAuthRateLimit("resetPassword", ip);
  if (!rl.allowed) {
    return { formError: "Too many attempts. Please wait an hour and try again." };
  }

  // 3. Verify an active session exists (recovery session set by /auth/confirm)
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return {
      formError:
        "Reset link expired. Please request a new one.",
    };
  }

  // 4. Update the password
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { formError: error.message };
  }

  // 5. Success — bust root layout cache and redirect to login with a success flag.
  //    The login page reads ?reset=success and shows an inline notice.
  revalidatePath("/", "layout");
  redirect("/app/login?reset=success");
}
