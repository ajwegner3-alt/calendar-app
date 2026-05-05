"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  accountSettingsSchema,
  type AccountSettingsInput,
  weeklyRulesSchema,
  type WeeklyRulesInput,
  dateOverrideSchema,
  type DateOverrideFormInput,
} from "./schema";

/**
 * Generic action result shape (mirrors Phase 3's EventTypeState).
 *
 * fieldErrors: Per-field RHF errors keyed by schema field name.
 * formError:   Form-level alert banner.
 * Actions DO NOT redirect — UI handles toasts + state refresh after revalidate.
 */
export type AvailabilityActionState = {
  fieldErrors?: Record<string, string[]>;
  formError?: string;
};

const REVALIDATE = "/app/availability";

/**
 * Resolve the current owner's account_id via the SETOF uuid RPC.
 * (Phase 2-04 evidence: returns flat string array.)
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
 * AVAIL-03..06: Save the four account-wide settings.
 *
 * Validates input against accountSettingsSchema (bounds match migration CHECK
 * constraints). Updates the accounts row for the owner's account.
 */
export async function saveAccountSettingsAction(
  input: AccountSettingsInput,
): Promise<AvailabilityActionState> {
  const parsed = accountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  const { error } = await supabase
    .from("accounts")
    .update({
      min_notice_hours: parsed.data.min_notice_hours,
      max_advance_days: parsed.data.max_advance_days,
      daily_cap: parsed.data.daily_cap,
    })
    .eq("id", accountId);

  if (error) {
    // CHECK constraint violations from the migration (e.g. someone bypassed
    // client validation). Map to a friendly form-level error.
    if (error.code === "23514") {
      return { formError: "One of the values is out of range. Try again." };
    }
    return { formError: "Failed to save settings. Please try again." };
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * AVAIL-01: Replace ALL weekly rules for a given day_of_week.
 *
 * "Replace" semantics: DELETE all existing rules for (account_id, day_of_week),
 * then INSERT the new windows. This matches the per-row editor:
 *   - empty array → "Closed" (delete only, no insert)
 *   - 1+ windows  → delete + bulk insert
 *
 * The two writes are not transactional (supabase-js doesn't expose explicit tx),
 * but they are scoped to a single weekday and are idempotent at the row level.
 * Worst case (delete succeeds, insert fails): the day shows as Closed until the
 * user retries. Acceptable for v1 single-tenant.
 */
export async function saveWeeklyRulesAction(
  input: WeeklyRulesInput,
): Promise<AvailabilityActionState> {
  const parsed = weeklyRulesSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Step 1: delete existing rows for (account_id, day_of_week).
  const { error: delError } = await supabase
    .from("availability_rules")
    .delete()
    .eq("account_id", accountId)
    .eq("day_of_week", parsed.data.day_of_week);

  if (delError) {
    return { formError: "Failed to update weekly rules. Please try again." };
  }

  // Step 2: insert new windows (skip if "Closed" / empty array).
  if (parsed.data.windows.length > 0) {
    const rows = parsed.data.windows.map((w) => ({
      account_id: accountId,
      day_of_week: parsed.data.day_of_week,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
    }));

    const { error: insError } = await supabase
      .from("availability_rules")
      .insert(rows);

    if (insError) {
      // CHECK constraint violation: end_minute > start_minute. Should be
      // impossible (Zod already validated), but handle defensively.
      if (insError.code === "23514") {
        return {
          fieldErrors: { windows: ["End time must be after start time."] },
        };
      }
      return { formError: "Failed to save weekly rules. Please try again." };
    }
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * AVAIL-02: Upsert a date override (Block entire day or Unavailable windows).
 *
 * RESEARCH Pitfall 5: enforces mutual exclusion at the action layer —
 * deletes ALL rows for the date first, then writes the new shape.
 *
 *   "block" save:       DELETE all rows for date → INSERT one is_closed=true row
 *   "unavailable" save: DELETE all rows for date → INSERT N window rows
 *                       (Phase 32: windows are BLOCKED times — slot engine
 *                       subtracts from weekly base.)
 *
 * Always delete-all-first so orphaned mixed-state rows never exist.
 *
 * Note: when saving "unavailable" rows, Plan 32-02's editor first calls
 * `previewAffectedBookingsAction` to detect confirmed bookings inside the
 * proposed windows. If any are found, the editor routes to
 * `commitInverseOverrideAction` (which adds quota pre-flight + batch cancel).
 * This action remains the no-affected-bookings fast path.
 */
export async function upsertDateOverrideAction(
  input: DateOverrideFormInput,
): Promise<AvailabilityActionState> {
  const parsed = dateOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Step 1: clear ALL existing rows for this date (enforces mutual exclusion).
  const { error: delError } = await supabase
    .from("date_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("override_date", parsed.data.override_date);

  if (delError) {
    return { formError: "Failed to save override. Please try again." };
  }

  // Step 2: insert the new shape.
  if (parsed.data.type === "block") {
    const { error: insError } = await supabase.from("date_overrides").insert({
      account_id: accountId,
      override_date: parsed.data.override_date,
      is_closed: true,
      start_minute: null,
      end_minute: null,
      note: parsed.data.note ?? null,
    });

    if (insError) {
      return { formError: "Failed to save override. Please try again." };
    }
  } else {
    // unavailable: insert N window rows (BLOCKED times — inverse semantics).
    const rows = parsed.data.windows.map((w) => ({
      account_id: accountId,
      override_date: parsed.data.override_date,
      is_closed: false,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
      note: parsed.data.note ?? null,
    }));

    const { error: insError } = await supabase.from("date_overrides").insert(rows);

    if (insError) {
      // 23505 = unique_violation on (account_id, override_date, start_minute).
      // Two windows with the same start_minute — Zod overlap check should have
      // caught equal starts already; handling defensively.
      if (insError.code === "23505") {
        return {
          fieldErrors: {
            windows: [
              "Two windows have the same start time. Adjust them and retry.",
            ],
          },
        };
      }
      if (insError.code === "23514") {
        return {
          fieldErrors: { windows: ["End time must be after start time."] },
        };
      }
      return { formError: "Failed to save override. Please try again." };
    }
  }

  revalidatePath(REVALIDATE);
  return {};
}

/**
 * Remove an override entirely (returns a date to its weekly rules).
 *
 * Deletes ALL rows for (account_id, override_date) so an "Unavailable
 * windows" override with multiple windows is removed atomically from the
 * caller's perspective.
 */
export async function deleteDateOverrideAction(
  override_date: string,
): Promise<AvailabilityActionState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(override_date)) {
    return { formError: "Invalid date." };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  const { error } = await supabase
    .from("date_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("override_date", override_date);

  if (error) {
    return { formError: "Failed to remove override. Please try again." };
  }

  revalidatePath(REVALIDATE);
  return {};
}
