import "server-only";

import { createClient } from "@/lib/supabase/server";

import type {
  AvailabilityState,
  AccountSettingsRow,
  AvailabilityRuleRow,
  DateOverrideRow,
} from "./types";

/**
 * Resolve the current owner's account_id via the SETOF uuid RPC.
 *
 * Phase 2-04 confirmed supabase-js returns this as a flat string array.
 * Single-tenant v1 → exactly one element when authenticated.
 */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("current_owner_account_ids");
  if (error) return null;
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0] as string;
}

/**
 * Load the full availability state for the owner's account.
 *
 * Returns null if the user is not linked to any account (Plan 04-04 + 04-05's
 * page.tsx should redirect / show an unlinked-state if null).
 *
 * Three queries run in parallel via Promise.all (they share no dependencies on
 * each other's result — RESEARCH suggests no need for transactional reads,
 * RLS is sufficient).
 *
 * availability_rules ordered by (day_of_week, start_minute) — UI consumes
 * pre-grouped, pre-sorted; saves a client-side sort.
 *
 * date_overrides ordered by (override_date, start_minute) with nullsFirst so
 * the is_closed row (start_minute NULL) comes first for any date — defensive
 * against the mixed-rows case (RESEARCH Pitfall 5).
 */
export async function loadAvailabilityState(): Promise<AvailabilityState | null> {
  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return null;

  const [accountRes, rulesRes, overridesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "min_notice_hours, max_advance_days, daily_cap, timezone",
      )
      .eq("id", accountId)
      .single(),
    supabase
      .from("availability_rules")
      .select("id, account_id, day_of_week, start_minute, end_minute, created_at")
      .eq("account_id", accountId)
      .order("day_of_week", { ascending: true })
      .order("start_minute", { ascending: true }),
    supabase
      .from("date_overrides")
      .select(
        "id, account_id, override_date, is_closed, start_minute, end_minute, note, created_at",
      )
      .eq("account_id", accountId)
      .order("override_date", { ascending: true })
      .order("start_minute", { ascending: true, nullsFirst: true }),
  ]);

  if (accountRes.error || !accountRes.data) return null;

  return {
    account: accountRes.data as AccountSettingsRow,
    rules: (rulesRes.data ?? []) as AvailabilityRuleRow[],
    overrides: (overridesRes.data ?? []) as DateOverrideRow[],
  };
}
