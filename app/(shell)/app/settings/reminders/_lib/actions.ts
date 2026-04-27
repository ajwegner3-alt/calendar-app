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
 * Direct-call contract (Phase 3 lock): action accepts a structured TS object
 * — NOT FormData — so the client can call it from a Switch onCheckedChange
 * handler without serialization gymnastics.
 *
 * Tests call `saveReminderTogglesCore` directly with structural-mock clients
 * (mirrors Plan 08-07 owner-note pattern + Phase 6 cancel-test pattern from
 * STATE.md): cookies() / next/cache require a Next request scope vitest
 * doesn't provide.
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

interface SaveReminderTogglesArgs {
  accountId: string;
  key: ToggleKey;
  value: boolean;
}

/**
 * Minimal structural shape of the supabase-js auth surface we exercise.
 * Kept narrow so vitest mocks don't need to satisfy the full SupabaseClient.
 */
interface RlsClientShape {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  rpc: (fn: string) => Promise<{ data: unknown }>;
}

interface AdminClientShape {
  from: (table: string) => unknown;
}

/**
 * Inner authorization + write logic, exported for direct vitest invocation.
 *
 * Same DI pattern as Plan 08-07's saveOwnerNoteCore. The Server Action wrapper
 * `saveReminderTogglesAction` below constructs real clients and delegates here.
 */
export async function saveReminderTogglesCore(
  args: SaveReminderTogglesArgs,
  deps: {
    rlsClient: RlsClientShape;
    adminClient: AdminClientShape;
  },
): Promise<SaveReminderTogglesResult> {
  // Stage 1a: must be signed in.
  const {
    data: { user },
  } = await deps.rlsClient.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Stage 1b: must own the accountId being mutated.
  const { data: ownership } = await deps.rlsClient.rpc(
    "current_owner_account_ids",
  );
  const ids = (Array.isArray(ownership) ? ownership : []) as string[];
  if (!ids.includes(args.accountId)) {
    return { ok: false, error: "Forbidden" };
  }

  // Defensive: validate the toggle key before mapping to a DB column.
  const column = COLUMN_BY_KEY[args.key];
  if (!column) return { ok: false, error: "Unknown toggle key" };

  // Stage 2: service-role write (RLS bypass intentional after stage 1).
  // Structural call: from("accounts").update({ [column]: value }).eq("id", id)
  const updateChain = (
    deps.adminClient.from("accounts") as {
      update: (payload: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    }
  )
    .update({ [column]: args.value })
    .eq("id", args.accountId);

  const { error } = await updateChain;
  if (error) return { ok: false, error: "Save failed" };

  return { ok: true };
}

/**
 * Public Server Action — what the client component imports.
 *
 * Constructs real RLS + admin clients then delegates to `saveReminderTogglesCore`.
 * Wraps the success path with `revalidatePath` so the Server Component re-reads
 * the freshly-written toggle values on next navigation/refresh.
 */
export async function saveReminderTogglesAction(
  args: SaveReminderTogglesArgs,
): Promise<SaveReminderTogglesResult> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const result = await saveReminderTogglesCore(args, {
    // Cast through the structural shape — production supabase-js clients
    // satisfy the surface we exercise even though TS can't see the narrowing.
    rlsClient: supabase as unknown as RlsClientShape,
    adminClient: admin as unknown as AdminClientShape,
  });

  if (result.ok) {
    revalidatePath("/app/settings/reminders");
  }
  return result;
}
