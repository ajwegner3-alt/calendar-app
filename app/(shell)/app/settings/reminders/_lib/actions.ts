"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server Action for the Reminder Settings page (Phase 8 Plan 08-05).
 *
 * Two-stage owner authorization (matches Phase 7 branding pattern):
 *   1. RLS-scoped Supabase client confirms current owner OWNS the accountId
 *      via current_owner_account_ids() RPC.
 *   2. Service-role admin client performs the column UPDATE.
 *
 * Why two-stage: RLS-scoped UPDATEs would also work for this single-table
 * write, but the Phase 7 lock established service-role writes after an
 * explicit ownership pre-check as the canonical owner-mutation contract.
 * Future toggles / settings actions should reuse this shape verbatim.
 *
 * Direct-call contract (Phase 3 lock): Action accepts a structured TS object
 * — NOT FormData — so the client can call it from a Switch onCheckedChange
 * handler without serialization gymnastics.
 */

type ToggleKey = "custom_answers" | "location" | "lifecycle_links";

const COLUMN_BY_KEY: Record<ToggleKey, string> = {
  custom_answers: "reminder_include_custom_answers",
  location: "reminder_include_location",
  lifecycle_links: "reminder_include_lifecycle_links",
};

export type SaveReminderTogglesResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReminderTogglesAction(args: {
  accountId: string;
  key: ToggleKey;
  value: boolean;
}): Promise<SaveReminderTogglesResult> {
  // Stage 1: RLS-scoped owner check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: ownership } = await supabase.rpc("current_owner_account_ids");
  const ids = (Array.isArray(ownership) ? ownership : []) as string[];
  if (!ids.includes(args.accountId)) {
    return { ok: false, error: "Forbidden" };
  }

  // Defensive: validate the toggle key is one we recognize before mapping
  // to a DB column. Keeps the column name out of the action surface.
  const column = COLUMN_BY_KEY[args.key];
  if (!column) return { ok: false, error: "Unknown toggle key" };

  // Stage 2: service-role write (RLS bypass intentional after stage 1).
  const admin = createAdminClient();
  const { error } = await admin
    .from("accounts")
    .update({ [column]: args.value })
    .eq("id", args.accountId);

  if (error) return { ok: false, error: "Save failed" };

  revalidatePath("/app/settings/reminders");
  return { ok: true };
}
