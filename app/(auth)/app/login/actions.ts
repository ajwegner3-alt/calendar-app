"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  // 2. Supabase auth. createClient is async (Phase 1 uses await cookies()).
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

  // 3. Success. revalidatePath busts the root layout cache so the shell
  //    re-renders with the new session. redirect() throws NEXT_REDIRECT —
  //    MUST be outside any try/catch (RESEARCH §7.1).
  revalidatePath("/", "layout");
  redirect("/app");
}
