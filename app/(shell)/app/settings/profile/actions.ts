"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseSdkClient } from "@supabase/supabase-js";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { displayNameSchema, slugSchema, passwordSchema } from "./schema";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type ActionResult<F extends string = never> =
  | { success: true }
  | { fieldErrors: Partial<Record<F, string[]>> }
  | { formError: string };

// ---------------------------------------------------------------------------
// updateDisplayNameAction
// Writes to accounts.name (the DB column) even though the form field is
// labeled "Display Name" — see schema correction note from 10-03.
// ---------------------------------------------------------------------------

export async function updateDisplayNameAction(
  input: { display_name: string },
): Promise<ActionResult<"display_name">> {
  const parsed = displayNameSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const uid = claimsData.claims.sub as string;

  const { error } = await supabase
    .from("accounts")
    // DB column is `name` (not display_name) — 10-03 schema correction
    .update({ name: parsed.data.display_name })
    .eq("owner_user_id", uid);

  if (error) return { formError: error.message };

  revalidatePath("/app/settings/profile");
  return { success: true };
}

// ---------------------------------------------------------------------------
// updateSlugAction
// Option B: inline reserved-slug check on server; rely on UNIQUE constraint
// + catch for collision. No dependency on 10-06's slug_is_taken RPC to avoid
// wave race.
// ---------------------------------------------------------------------------

export async function updateSlugAction(
  input: { slug: string },
): Promise<ActionResult<"slug">> {
  const parsed = slugSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const newSlug = parsed.data.slug;

  // Reserved slug check
  if (isReservedSlug(newSlug)) {
    return { fieldErrors: { slug: ["That slug is reserved and cannot be used."] } };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const uid = claimsData.claims.sub as string;

  const { error } = await supabase
    .from("accounts")
    .update({ slug: newSlug })
    .eq("owner_user_id", uid);

  if (error) {
    // Postgres unique violation code 23505 → slug is taken
    if (error.code === "23505") {
      return { fieldErrors: { slug: ["That slug is already taken."] } };
    }
    return { formError: error.message };
  }

  revalidatePath("/app/settings/profile");
  return { success: true };
}

// ---------------------------------------------------------------------------
// changePasswordAction
// Current-password challenge via a transient, cookie-less Supabase client.
// This client CANNOT affect the user's active session — no persistence hooks.
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  input: { current_password: string; new_password: string },
): Promise<ActionResult<"current_password" | "new_password">> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Get active session for the current user's email
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const email = claimsData.claims.email as string | undefined;
  if (!email) return { formError: "Could not determine your email address." };

  // Transient, cookie-less client for current-password verification.
  // persistSession: false ensures this cannot displace the user's active session.
  const verifier = createSupabaseSdkClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { error: pwError } = await verifier.auth.signInWithPassword({
    email,
    password: parsed.data.current_password,
  });

  if (pwError) {
    return { fieldErrors: { current_password: ["Current password is incorrect."] } };
  }
  // Discard verifier — nothing to sign out since persistSession: false.

  // Update password on the active session
  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });

  if (updateError) return { formError: updateError.message };

  revalidatePath("/app/settings/profile");
  return { success: true };
}

// ---------------------------------------------------------------------------
// softDeleteAccountAction
// Sets accounts.deleted_at = now(), signs user out, redirects to /account-deleted.
// Server-side slug confirmation is a defense-in-depth check.
// ---------------------------------------------------------------------------

export async function softDeleteAccountAction(input: {
  confirmation: string;
}): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/app/login");

  const uid = claimsData.claims.sub as string;

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, slug")
    .eq("owner_user_id", uid)
    .is("deleted_at", null)
    .limit(1);

  const me = accounts?.[0];
  if (!me) redirect("/app");

  // Server-side confirmation guard (defense-in-depth; client also gates)
  if (input.confirmation !== me.slug) {
    return { error: "Confirmation must match your account slug exactly." };
  }

  const { error } = await supabase
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", me.id);

  if (error) return { error: error.message };

  // Sign out and redirect to account-deleted page
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/account-deleted");
}
