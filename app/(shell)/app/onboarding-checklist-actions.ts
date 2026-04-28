"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks the onboarding checklist as dismissed for the current authenticated
 * user by writing the current UTC timestamp to
 * `accounts.onboarding_checklist_dismissed_at`.
 *
 * RLS-scoped UPDATE — the `.eq("owner_user_id", uid)` filter is enforced by
 * the `accounts_owner_update` policy from Plan 10-03, meaning this action
 * cannot modify another tenant's row even if the uid is somehow manipulated.
 *
 * After a successful update, revalidates the `/app` path so the dashboard
 * re-renders without the checklist on the next navigation.
 *
 * Returns `{ success: true }` on success, `{ error: string }` on DB error,
 * or redirects to `/app/login` when there is no authenticated session.
 */
export async function dismissChecklistAction(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims?.claims) {
    redirect("/app/login");
  }

  const uid = claims.claims.sub;

  const { error } = await supabase
    .from("accounts")
    .update({ onboarding_checklist_dismissed_at: new Date().toISOString() })
    .eq("owner_user_id", uid);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app");
  return { success: true };
}
