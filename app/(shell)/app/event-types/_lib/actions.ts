"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eventTypeSchema, type EventTypeInput } from "./schema";

/**
 * Action result shape for create + update.
 *
 * Mirrors Phase 2's LoginState contract: optional fieldErrors for per-field
 * RHF feedback, optional formError for the form-level alert banner.
 *
 * `redirectTo` is set on success so the caller can route to it AFTER unwrapping
 * the result — keeps redirect() out of try/catch (Phase 2 RESEARCH §7.1 + Phase 3
 * RESEARCH Pitfall 3). Caller pattern:
 *
 *   const result = await createEventTypeAction(input);
 *   if (result.redirectTo) router.push(result.redirectTo);
 *   else { showErrors(result); }
 *
 * Note: For the create + update actions specifically we ALSO call
 * redirect("/app/event-types") inside the action when there are no errors,
 * because the action runs server-side via direct call from the form's
 * onSubmit. redirect() inside a Server Action triggers a server-side
 * navigation. We keep redirectTo in the type for future-flexibility but
 * the canonical path is the in-action redirect.
 */
export type EventTypeState = {
  fieldErrors?: Partial<Record<keyof EventTypeInput, string[]>>;
  formError?: string;
  redirectTo?: string;
  // Phase 11 Plan 11-07: CAP-09 capacity-decrease warning variant.
  // When present, the form shows a confirmation modal instead of surfacing an error.
  warning?: "capacity_decrease_overflow";
  details?: {
    newCap: number;
    currentCap: number;
    affectedSlots: number;
    maxAffected: number;
  };
};

export type RestoreResult =
  | { ok: true }
  | { slugCollision: true; currentSlug: string }
  | { error: string };

/**
 * Resolve the current owner's account_id.
 *
 * `current_owner_account_ids()` is a SETOF uuid RPC; supabase-js returns it as a
 * flat string array (verified Plan 02-04, see STATE.md "RPC shape" decision).
 * We pick the first id — single-tenant v1 only ever has one.
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
 * EVENT-01: Create a new event type.
 *
 * - Zod validation
 * - Resolve account_id
 * - Pre-flight slug uniqueness check (filtered to deleted_at IS NULL)
 * - Insert
 * - Race-condition defense: catch 23505 and return slug field error
 * - revalidatePath + redirect
 */
export async function createEventTypeAction(
  input: EventTypeInput,
): Promise<EventTypeState> {
  // 1. Server-side Zod re-validation (defense in depth — the form already
  //    validated, but never trust the client).
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // 2. Resolve account_id (RLS ensures the user can only insert into their own
  //    account, but we need the explicit value for the INSERT column).
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // 3. Pre-flight slug uniqueness check among non-deleted rows.
  const { data: existing } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", parsed.data.slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return {
      fieldErrors: {
        slug: ["This slug is already in use. Choose a different one."],
      },
    };
  }

  // 4. Insert.
  const { error } = await supabase.from("event_types").insert({
    account_id: accountId,
    name: parsed.data.name,
    slug: parsed.data.slug,
    duration_minutes: parsed.data.duration_minutes,
    description: parsed.data.description ?? null,
    is_active: parsed.data.is_active,
    custom_questions: parsed.data.custom_questions,
    // Phase 8 Plan 08-05: location is edit-only in v1 UI but the schema accepts
    // it on create for symmetry; missing/empty input writes NULL.
    location: parsed.data.location ?? null,
    // Phase 11 Plan 11-07: capacity fields (DB defaults match Zod defaults).
    max_bookings_per_slot: parsed.data.max_bookings_per_slot,
    show_remaining_capacity: parsed.data.show_remaining_capacity,
  });

  if (error) {
    // Postgres unique_violation — race condition between pre-flight check + insert.
    // RESEARCH §"Slug Uniqueness Validation": THIS is the one place where gating
    // on error.code (not error.status) is correct, because it's a DB constraint
    // violation, not an auth-js bug.
    if (error.code === "23505") {
      return {
        fieldErrors: {
          slug: ["This slug is already in use. Choose a different one."],
        },
      };
    }
    return { formError: "Failed to create event type. Please try again." };
  }

  // 5. Revalidate then redirect — outside try/catch (RESEARCH Pitfall 3).
  revalidatePath("/app/event-types");
  redirect("/app/event-types");
}

/**
 * EVENT-02: Update an existing event type.
 *
 * Same shape as create, but with .update().eq("id", id) and an EXCLUDED-self
 * pre-flight slug check (a row can keep its own slug across edits).
 */
export async function updateEventTypeAction(
  id: string,
  input: EventTypeInput,
): Promise<EventTypeState> {
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const accountId = await resolveAccountId(supabase);
  if (!accountId) return { formError: "Account not found." };

  // Pre-flight slug uniqueness — same as create, but EXCLUDE the row being edited.
  const { data: collision } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", parsed.data.slug)
    .is("deleted_at", null)
    .neq("id", id)
    .maybeSingle();

  if (collision) {
    return {
      fieldErrors: {
        slug: ["This slug is already in use. Choose a different one."],
      },
    };
  }

  // CAP-09: Over-cap pre-check on capacity decrease (Phase 11 Plan 11-07).
  //
  // Fires only when:
  //   (a) This is an UPDATE (has id)
  //   (b) New cap < current cap (owner is decreasing capacity)
  //   (c) confirmCapacityDecrease !== true (owner has not yet acknowledged modal)
  //
  // Uses JS group-by of supabase SELECT results per RESEARCH.md §Pitfall 6:
  // supabase-js doesn't expose GROUP BY/HAVING; data volume is small (one
  // owner's future bookings for one event type — typically <100 rows).
  if (parsed.data.confirmCapacityDecrease !== true) {
    const { data: currentRow } = await supabase
      .from("event_types")
      .select("max_bookings_per_slot")
      .eq("id", id)
      .single();

    const currentCap = currentRow?.max_bookings_per_slot ?? 1;
    const newCap = parsed.data.max_bookings_per_slot;

    if (newCap < currentCap) {
      const { data: overCapRows, error: overCapErr } = await supabase
        .from("bookings")
        .select("start_at")
        .eq("event_type_id", id)
        .eq("status", "confirmed")
        .gt("start_at", new Date().toISOString());

      if (overCapErr) {
        // Fail closed — cannot verify, refuse to save silently.
        return { formError: "Could not verify capacity change. Please try again." };
      }

      const slotCounts = new Map<string, number>();
      for (const row of overCapRows ?? []) {
        slotCounts.set(row.start_at, (slotCounts.get(row.start_at) ?? 0) + 1);
      }

      let maxAffected = 0;
      let affectedSlots = 0;
      for (const cnt of slotCounts.values()) {
        if (cnt > newCap) {
          affectedSlots++;
          if (cnt > maxAffected) maxAffected = cnt;
        }
      }

      if (affectedSlots > 0) {
        // Return structured warning — form shows confirmation modal.
        return {
          warning: "capacity_decrease_overflow",
          details: { newCap, currentCap, affectedSlots, maxAffected },
        };
      }
    }
  }

  const { error } = await supabase
    .from("event_types")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      duration_minutes: parsed.data.duration_minutes,
      description: parsed.data.description ?? null,
      is_active: parsed.data.is_active,
      custom_questions: parsed.data.custom_questions,
      // Phase 8 Plan 08-05: persist location/address. Empty input → NULL.
      location: parsed.data.location ?? null,
      // Phase 11 Plan 11-07: capacity fields.
      max_bookings_per_slot: parsed.data.max_bookings_per_slot,
      show_remaining_capacity: parsed.data.show_remaining_capacity,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        fieldErrors: {
          slug: ["This slug is already in use. Choose a different one."],
        },
      };
    }
    return { formError: "Failed to update event type. Please try again." };
  }

  revalidatePath("/app/event-types");
  redirect("/app/event-types");
}

/**
 * EVENT-03: Soft-delete an event type (sets deleted_at).
 *
 * Returns {} on success, {formError} on failure. Does NOT redirect — the caller
 * (a client component dialog) handles the toast + dismiss.
 */
export async function softDeleteEventTypeAction(
  id: string,
): Promise<EventTypeState> {
  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { formError: "Failed to archive event type." };
  }

  revalidatePath("/app/event-types");
  return {};
}

/**
 * Restore a soft-deleted event type with optional new slug for collision case.
 *
 * Behavior (RESEARCH §"Restore with Slug Collision"):
 *   1. Look up the archived row's original slug + account_id.
 *   2. Determine effective slug to use: newSlug if supplied, else original.
 *   3. Check for collision against active (deleted_at IS NULL) rows in the same
 *      account. If collision AND no newSlug was supplied, return
 *      {slugCollision: true, currentSlug} so the client opens a Dialog with a
 *      slug input. If collision AND newSlug WAS supplied, that means the user's
 *      proposed slug ALSO collides — return {error}. If no collision, proceed.
 *   4. Restore: deleted_at = null, is_active = false, slug = effective slug.
 *      Restored types come back as Inactive per CONTEXT decision.
 *
 * Returns RestoreResult discriminated union.
 */
export async function restoreEventTypeAction(
  id: string,
  newSlug?: string,
): Promise<RestoreResult> {
  if (!id || typeof id !== "string") {
    return { error: "Missing event type id." };
  }

  const supabase = await createClient();

  const { data: et, error: lookupError } = await supabase
    .from("event_types")
    .select("slug, account_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !et) {
    return { error: "Event type not found." };
  }

  const slugToUse = newSlug ?? et.slug;

  // If newSlug supplied, validate it through the slug rule by running the regex
  // inline (cheaper than spinning up a partial schema).
  if (!/^[a-z0-9-]+$/.test(slugToUse) || slugToUse.length === 0 || slugToUse.length > 100) {
    return {
      error:
        "URL slug may only contain lowercase letters, numbers, and hyphens (1-100 chars).",
    };
  }

  const { data: collision } = await supabase
    .from("event_types")
    .select("id")
    .eq("account_id", et.account_id)
    .eq("slug", slugToUse)
    .is("deleted_at", null)
    .neq("id", id)
    .maybeSingle();

  if (collision) {
    if (newSlug) {
      // User supplied a slug but it ALSO collides.
      return { error: "That slug is also in use. Try another." };
    }
    // Original slug is taken — prompt the user.
    return { slugCollision: true, currentSlug: et.slug };
  }

  const { error } = await supabase
    .from("event_types")
    .update({
      deleted_at: null,
      is_active: false,
      slug: slugToUse,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      // Race: someone else took the slug between our check and update.
      return { error: "That slug was just taken. Try another." };
    }
    return { error: "Failed to restore event type." };
  }

  revalidatePath("/app/event-types");
  return { ok: true };
}

/**
 * EVENT-04: Toggle active/inactive for an event type.
 *
 * Called from the kebab menu (no confirm — reversible) and from the edit form's
 * Switch (already covered by updateEventTypeAction). This is the kebab-menu
 * fast path — no schema parse, no slug check, just flip the bit.
 */
export async function toggleActiveAction(
  id: string,
  nextActive: boolean,
): Promise<EventTypeState> {
  if (!id || typeof id !== "string") {
    return { formError: "Missing event type id." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_types")
    .update({ is_active: nextActive })
    .eq("id", id);

  if (error) {
    return { formError: "Failed to update status." };
  }

  revalidatePath("/app/event-types");
  return {};
}
