"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getRemainingDailyQuota } from "@/lib/email-sender/quota-guard";
import { cancelBooking } from "@/lib/bookings/cancel";

import { getAffectedBookings, type AffectedBooking } from "./queries";
import { timeWindowSchema, findOverlap } from "./schema";

/**
 * Phase 32 (AVAIL-06, EMAIL-23): commit an inverse date-override save with
 * quota-safe batch auto-cancel of any confirmed bookings that fall inside
 * the proposed unavailable windows.
 *
 * The action is the SINGLE server-side entry point for the inverse-override
 * editor (Plan 32-02 UI). It performs:
 *
 *   1. Auth + input validation (zod, with overlap refinement).
 *   2. HARD quota pre-flight using getRemainingDailyQuota() — refuses with
 *      a structured quotaError result if needed > remaining. NO writes,
 *      NO sends. (EMAIL-23 hard gate per ROADMAP / Phase 31 contract.)
 *   3. Override row write (delete-all-for-date + insert; matches the
 *      existing upsertDateOverrideAction pattern).
 *   4. Race-safe re-query of affected bookings AFTER the override rows
 *      land — covers any booking that snuck in between the UI preview
 *      and now.
 *   5. Batch cancel via Promise.allSettled over cancelBooking() with
 *      actor="owner" and skipOwnerEmail=true (single owner-initiated
 *      batch should not generate N duplicate owner notifications).
 *   6. revalidatePath of the availability + bookings pages.
 *
 * Quota math: with skipOwnerEmail=true each cancelBooking() sends exactly
 * one email (booker leg). Therefore: needed = ids.length.
 *
 * LD-07: this action does NOT touch email content — it only orchestrates
 * calls. The brand-neutral booker copy + rebook CTA URL pattern
 * `${appUrl}/${account.slug}/${eventType.slug}` lives in
 * lib/email/send-cancel-emails.ts and is unchanged.
 */

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const baseFields = {
  override_date: z
    .string()
    .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
  affectedBookingIds: z.array(z.string().uuid()),
  reason: z
    .string()
    .max(500, "Reason must be 500 characters or fewer.")
    .optional(),
};

const inputSchema = z.discriminatedUnion("isFullDayBlock", [
  z.object({
    isFullDayBlock: z.literal(true),
    ...baseFields,
    unavailableWindows: z.array(timeWindowSchema).length(0),
  }),
  z
    .object({
      isFullDayBlock: z.literal(false),
      ...baseFields,
      unavailableWindows: z
        .array(timeWindowSchema)
        .min(1, "Add at least one unavailable window or block the entire day.")
        .max(20, "Too many unavailable windows for one day."),
    })
    .superRefine((data, ctx) => {
      const sorted = [...data.unavailableWindows].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
      const overlap = findOverlap(sorted);
      if (overlap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unavailableWindows"],
          message: "Unavailable windows cannot overlap.",
        });
      }
    }),
]);

// Phase 40 Plan 05 (2026-05-09): CommitInverseOverrideInput type deleted —
// zero consumers; action uses inputSchema.parse() directly with no exposed
// type boundary.

export type CommitOverrideResult =
  | {
      ok: true;
      cancelledCount: number;
      emailFailures: Array<{ bookingId: string; error: string }>;
    }
  | {
      ok: false;
      quotaError: true;
      needed: number;
      remaining: number;
    }
  | {
      ok: false;
      formError: string;
    };

/**
 * Resolve the current owner's account_id + timezone via the same RPC the
 * other availability actions use. Returns null if not authenticated /
 * not linked to an account.
 */
async function resolveOwnerContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ accountId: string; accountTimezone: string } | null> {
  const { data: ids, error: rpcError } = await supabase.rpc(
    "current_owner_account_ids",
  );
  if (rpcError) return null;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const accountId = ids[0] as string;

  const { data: account, error: acctError } = await supabase
    .from("accounts")
    .select("timezone")
    .eq("id", accountId)
    .single();
  if (acctError || !account) return null;

  return { accountId, accountTimezone: account.timezone as string };
}

/**
 * Helper for the full-day case — every confirmed booking on the date is
 * affected. Implemented as a thin wrapper over getAffectedBookings with a
 * window of [00:00, 24:00) so all bookings match.
 */
async function getAllConfirmedBookingsOnDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  overrideDate: string,
  accountTimezone: string,
): Promise<AffectedBooking[]> {
  return getAffectedBookings(
    supabase,
    accountId,
    overrideDate,
    [{ start_minute: 0, end_minute: 1440 }],
    accountTimezone,
  );
}

/**
 * Phase 32 Plan 02 (UI-coupled read-only helper): preview the affected
 * bookings + remaining quota for a proposed inverse-override save.
 *
 * Called from the override modal on Save click — the response drives:
 *   - the inline affected-bookings list (preview)
 *   - the EMAIL-23 quota gate (Confirm button disabled when needed > remaining)
 *   - the no-affected-bookings fast path (modal calls upsertDateOverrideAction
 *     directly when affected.length === 0 — skipping commitInverseOverrideAction)
 *
 * Read-only: no DB writes, no sends. Safe to call repeatedly as the owner
 * tweaks windows.
 *
 * Lives next to commitInverseOverrideAction (same file) because both are the
 * UI-facing surface for inverse-override commits and share auth + the
 * isFullDayBlock-vs-windows shape. Plan 32-03 deliberately deferred this
 * helper to 32-02 because its return shape is UI-driven.
 */
const previewInputSchema = z.discriminatedUnion("isFullDayBlock", [
  z.object({
    isFullDayBlock: z.literal(true),
    override_date: z
      .string()
      .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
    unavailableWindows: z.array(timeWindowSchema).length(0),
  }),
  z
    .object({
      isFullDayBlock: z.literal(false),
      override_date: z
        .string()
        .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
      unavailableWindows: z
        .array(timeWindowSchema)
        .min(1, "Add at least one unavailable window or block the entire day.")
        .max(20, "Too many unavailable windows for one day."),
    })
    .superRefine((data, ctx) => {
      const sorted = [...data.unavailableWindows].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
      const overlap = findOverlap(sorted);
      if (overlap) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["unavailableWindows"],
          message: "Unavailable windows cannot overlap.",
        });
      }
    }),
]);

export type PreviewAffectedBookingsResult =
  | {
      ok: true;
      affected: AffectedBooking[];
      remainingQuota: number;
    }
  | {
      ok: false;
      error: string;
    };

export async function previewAffectedBookingsAction(
  rawInput: unknown,
): Promise<PreviewAffectedBookingsResult> {
  const parsed = previewInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: first };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const ctx = await resolveOwnerContext(supabase);
  if (!ctx) {
    return { ok: false, error: "Account not found." };
  }
  const { accountId, accountTimezone } = ctx;

  let affected: AffectedBooking[];
  try {
    affected = input.isFullDayBlock
      ? await getAllConfirmedBookingsOnDate(
          supabase,
          accountId,
          input.override_date,
          accountTimezone,
        )
      : await getAffectedBookings(
          supabase,
          accountId,
          input.override_date,
          input.unavailableWindows,
          accountTimezone,
        );
  } catch (err) {
    console.error("[previewAffectedBookingsAction] query failed:", err);
    return { ok: false, error: "Failed to load bookings. Please try again." };
  }

  const remainingQuota = await getRemainingDailyQuota(accountId);
  return { ok: true, affected, remainingQuota };
}

export async function commitInverseOverrideAction(
  rawInput: unknown,
): Promise<CommitOverrideResult> {
  // ── 1. Validate input ────────────────────────────────────────────────────
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const first =
      parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, formError: first };
  }
  const input = parsed.data;

  // ── 2. Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const ctx = await resolveOwnerContext(supabase);
  if (!ctx) {
    return { ok: false, formError: "Account not found." };
  }
  const { accountId, accountTimezone } = ctx;

  // ── 3. HARD quota pre-flight (EMAIL-23) ──────────────────────────────────
  // skipOwnerEmail=true means each cancelBooking() sends exactly 1 email
  // (booker leg only). Therefore needed = affectedBookingIds.length.
  const remaining = await getRemainingDailyQuota(accountId);
  const needed = input.affectedBookingIds.length;
  if (needed > remaining) {
    // No DB writes, no sends. Editor UI surfaces "needed N, remaining M".
    return { ok: false, quotaError: true, needed, remaining };
  }

  // ── 4. Override row write — delete-all-for-date + insert ─────────────────
  // Matches the established upsertDateOverrideAction pattern (RESEARCH
  // Pitfall 5: enforce mutual exclusion at the action layer).
  const { error: delError } = await supabase
    .from("date_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("override_date", input.override_date);
  if (delError) {
    return {
      ok: false,
      formError: "Failed to save override. Please try again.",
    };
  }

  if (input.isFullDayBlock) {
    const { error: insError } = await supabase
      .from("date_overrides")
      .insert({
        account_id: accountId,
        override_date: input.override_date,
        is_closed: true,
        start_minute: null,
        end_minute: null,
        note: input.reason ?? null,
      });
    if (insError) {
      return {
        ok: false,
        formError: "Failed to save override. Please try again.",
      };
    }
  } else {
    const rows = input.unavailableWindows.map((w) => ({
      account_id: accountId,
      override_date: input.override_date,
      is_closed: false,
      start_minute: w.start_minute,
      end_minute: w.end_minute,
      note: input.reason ?? null,
    }));
    const { error: insError } = await supabase
      .from("date_overrides")
      .insert(rows);
    if (insError) {
      return {
        ok: false,
        formError: "Failed to save override. Please try again.",
      };
    }
  }

  // ── 5. Race-safe re-query ────────────────────────────────────────────────
  // Override rows are now written; the slot engine blocks new bookings on
  // this date. Re-query catches any booking that snuck in between the UI
  // preview and now. Union with the preview IDs ensures no booking is
  // missed even if an inflight booking COMMITs after this re-query.
  let raceSafeIds: string[] = [];
  try {
    const finalAffected = input.isFullDayBlock
      ? await getAllConfirmedBookingsOnDate(
          supabase,
          accountId,
          input.override_date,
          accountTimezone,
        )
      : await getAffectedBookings(
          supabase,
          accountId,
          input.override_date,
          input.unavailableWindows,
          accountTimezone,
        );
    raceSafeIds = finalAffected.map((b) => b.id);
  } catch (err) {
    // Don't fail the whole commit on a re-query glitch; we still have the
    // preview IDs the owner approved. Log for diagnostics.
    console.error(
      "[commitInverseOverrideAction] race-safe re-query failed:",
      err,
    );
  }

  const idsToCancel = Array.from(
    new Set([...input.affectedBookingIds, ...raceSafeIds]),
  );

  // ── 6. Batch cancel via existing cancelBooking() lifecycle ───────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const reasonText =
    input.reason && input.reason.trim().length > 0
      ? input.reason
      : "Owner marked this time as unavailable";

  const settled = await Promise.allSettled(
    idsToCancel.map((id) =>
      cancelBooking({
        bookingId: id,
        actor: "owner",
        reason: reasonText,
        appUrl,
        ip: null,
        skipOwnerEmail: true, // suppress N duplicate owner emails
      }),
    ),
  );

  let cancelledCount = 0;
  const emailFailures: Array<{ bookingId: string; error: string }> = [];
  settled.forEach((r, idx) => {
    const bookingId = idsToCancel[idx];
    if (r.status === "fulfilled") {
      if (r.value.ok) {
        cancelledCount += 1;
        if ("emailFailed" in r.value && r.value.emailFailed) {
          emailFailures.push({
            bookingId,
            error: `email-${r.value.emailFailed}`,
          });
        }
      } else {
        // not_active or db_error — booking was already not-cancellable
        // (e.g. cancelled in another tab, or in the past). Don't surface
        // as an email failure; the row state is already terminal.
        if (r.value.reason === "db_error") {
          emailFailures.push({
            bookingId,
            error: r.value.error ?? "db_error",
          });
        }
      }
    } else {
      emailFailures.push({
        bookingId,
        error: String(r.reason),
      });
    }
  });

  // ── 7. Revalidate caches ─────────────────────────────────────────────────
  revalidatePath("/app/availability");
  revalidatePath("/app/bookings");

  return { ok: true, cancelledCount, emailFailures };
}
