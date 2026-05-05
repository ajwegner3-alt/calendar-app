import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBookingTokens } from "@/lib/bookings/tokens";
import { sendRescheduleEmails } from "@/lib/email/send-reschedule-emails";
import { QuotaExceededError } from "@/lib/email-sender/quota-guard";

export interface RescheduleBookingArgs {
  /** UUID of the booking to reschedule. Caller (Plan 06-04 public route) hashes
   *  the URL token and looks up by reschedule_token_hash BEFORE calling this. */
  bookingId: string;
  /** The CURRENT (pre-rotation) reschedule token hash — embedded in the UPDATE
   *  WHERE clause as a CAS guard so concurrent requests using the same token
   *  cannot both succeed (RESEARCH Pitfall 6). The caller already hashed the
   *  URL token to look up the booking; pass that hash here. */
  oldRescheduleHash: string;
  /** New slot start (ISO UTC) — typically from the SlotPicker submission */
  newStartAt: string;
  /** New slot end (ISO UTC) — must equal newStartAt + duration_minutes */
  newEndAt: string;
  /** Caller-resolved app URL for cancel/reschedule links in the new email */
  appUrl: string;
  /** Optional client IP for the audit row */
  ip?: string | null;
}

export type RescheduleBookingResult =
  | {
      ok: true;
      booking: {
        id: string;
        account_id: string;
        start_at: string;
        end_at: string;
        booker_name: string;
        booker_email: string;
        booker_timezone: string;
      };
      /** Phase 31 (EMAIL-24): set when the email send leg of the reschedule
       *  failed AFTER the DB UPDATE committed. Same semantics as
       *  CancelBookingResult.emailFailed. */
      emailFailed?: "quota" | "send";
    }
  | {
      ok: false;
      /** 'not_active': CAS failed — token already rotated, booking already cancelled, or start_at passed.
       *                Maps to friendly "no longer active" page.
       *  'slot_taken': bookings_no_double_book partial unique index violation (23505) — RESEARCH Pitfall 5.
       *                Maps to "that time was just booked, pick another" UX (mirror Phase 5 SLOT_TAKEN).
       *  'bad_slot':   newStartAt is in the past, or newEndAt <= newStartAt — invariant violation BEFORE UPDATE.
       *  'db_error':   unexpected DB error. */
      reason: "not_active" | "slot_taken" | "bad_slot" | "db_error";
      error?: string;
    };

/**
 * Atomically reschedule a confirmed booking to a new slot, rotating both
 * cancel + reschedule tokens (RESEARCH §Pattern 3).
 *
 * Single UPDATE:
 *   - SET start_at, end_at, cancel_token_hash, reschedule_token_hash
 *   - Status STAYS 'confirmed' (RESEARCH §Pattern 3 commentary: 'rescheduled'
 *     enum value is for booking_events.event_type only; bookings.status remains
 *     'confirmed' so the new tokens are valid)
 *   - WHERE id=? AND status='confirmed' AND reschedule_token_hash=oldHash
 *     AND start_at > now() — DOUBLE CAS guard (status + old token hash)
 *
 * Three failure modes:
 *   - 0 rows matched (PGRST116) → 'not_active' (token already rotated/used)
 *   - Postgres 23505 → 'slot_taken' (target slot is already booked)
 *   - Other DB error → 'db_error'
 *
 * After successful UPDATE: fire-and-forget sendRescheduleEmails (BOTH parties)
 * with the FRESH raw cancel + reschedule tokens + the OLD start/end (for the
 * "Was → New" body), and a fire-and-forget booking_events audit row.
 */
export async function rescheduleBooking(
  args: RescheduleBookingArgs,
): Promise<RescheduleBookingResult> {
  const { bookingId, oldRescheduleHash, newStartAt, newEndAt, appUrl, ip } =
    args;

  // ── 0. Invariant checks BEFORE UPDATE ──────────────────────────────────────
  const newStartDate = new Date(newStartAt);
  const newEndDate = new Date(newEndAt);
  if (
    Number.isNaN(newStartDate.getTime()) ||
    Number.isNaN(newEndDate.getTime())
  ) {
    return { ok: false, reason: "bad_slot", error: "Invalid date format." };
  }
  if (newStartDate <= new Date()) {
    return {
      ok: false,
      reason: "bad_slot",
      error: "New slot must be in the future.",
    };
  }
  if (newEndDate <= newStartDate) {
    return {
      ok: false,
      reason: "bad_slot",
      error: "End time must be after start time.",
    };
  }

  const supabase = createAdminClient();

  // ── 1. Pre-fetch booking + event_type + account for the email senders ──────
  // (Same join pattern as cancel.ts — 1 round-trip.)
  const { data: pre, error: preError } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_timezone,
       event_types!inner(name, description, duration_minutes, slug),
       accounts!inner(name, slug, timezone, owner_email, logo_url, brand_primary)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (preError) {
    console.error("[reschedule] pre-fetch error:", preError);
    return { ok: false, reason: "db_error", error: preError.message };
  }
  if (!pre) {
    return { ok: false, reason: "not_active" };
  }

  // Capture OLD slot for the email body BEFORE the UPDATE rotates them away.
  const oldStartAt = pre.start_at;
  const oldEndAt = pre.end_at;

  // ── 2. Generate fresh cancel + reschedule tokens for the new slot ──────────
  const fresh = await generateBookingTokens();

  // ── 3. Atomic reschedule UPDATE with double CAS guard ──────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      start_at: newStartAt,
      end_at: newEndAt,
      cancel_token_hash: fresh.hashCancel,
      reschedule_token_hash: fresh.hashReschedule,
      // status stays 'confirmed' — see RESEARCH §Pattern 3 commentary
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .eq("reschedule_token_hash", oldRescheduleHash) // CAS guard: only the original token holder wins (RESEARCH Pitfall 6)
    .gt("start_at", new Date().toISOString())
    .select("id, start_at, end_at")
    .single();

  if (updateError) {
    if (updateError.code === "23505") {
      // bookings_no_double_book fired — target slot is taken (RESEARCH Pitfall 5)
      return { ok: false, reason: "slot_taken" };
    }
    // V14-MP-02 (Phase 27): 23P01 is the EXCLUDE constraint
    // bookings_no_account_cross_event_overlap firing on the in-place UPDATE.
    // The booker is trying to reschedule into a time held by a DIFFERENT
    // event type on the same account. Map to 'slot_taken' so the upstream
    // /api/reschedule handler returns its existing 409 SLOT_TAKEN response —
    // generic copy, no event-type leak (CONTEXT-locked).
    if (updateError.code === "23P01") {
      // Observability: distinct log signal for prod monitoring. No PII.
      console.error("[reschedule] 23P01 cross-event overlap", {
        code: "CROSS_EVENT_CONFLICT",
        booking_id: bookingId,
      });
      return { ok: false, reason: "slot_taken" };
    }
    if (updateError.code === "PGRST116") {
      // 0 rows matched — CAS failed (token already rotated, booking already
      // cancelled, or start_at passed during the call)
      return { ok: false, reason: "not_active" };
    }
    console.error("[reschedule] update error:", updateError);
    return { ok: false, reason: "db_error", error: updateError.message };
  }
  if (!updated) {
    return { ok: false, reason: "not_active" };
  }

  // ── 4. Reschedule emails ─────────────────────────────────────────────────
  // Phase 31 (EMAIL-24): switched from after() to await so QuotaExceededError
  // bubbles synchronously and the owner UI can surface emailFailed: "quota".
  // supabase-js join shape varies by foreign key direction and PostgREST version;
  // defensive normalization (Array.isArray ? [0] : ...) is the established pattern.
  const eventType = Array.isArray(pre.event_types)
    ? pre.event_types[0]
    : pre.event_types;
  const account = Array.isArray(pre.accounts)
    ? pre.accounts[0]
    : pre.accounts;

  let emailFailed: "quota" | "send" | undefined;
  try {
    await sendRescheduleEmails({
      booking: {
        id: pre.id,
        start_at: updated.start_at, // NEW start (post-rotation)
        end_at: updated.end_at, // NEW end
        booker_name: pre.booker_name,
        booker_email: pre.booker_email,
        booker_timezone: pre.booker_timezone,
      },
      eventType: {
        name: eventType.name,
        description: eventType.description ?? null,
        duration_minutes: eventType.duration_minutes,
      },
      account: {
        id: pre.account_id, // Phase 31: required for quota refusal log
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
        logo_url: account.logo_url ?? null,
        brand_primary: account.brand_primary ?? null,
      },
      oldStartAt,
      oldEndAt,
      rawCancelToken: fresh.rawCancel,
      rawRescheduleToken: fresh.rawReschedule,
      appUrl,
    });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      emailFailed = "quota";
      // logQuotaRefusal already wrote inside the inner sender; no double-log.
    } else {
      emailFailed = "send";
      console.error("[RESCHEDULE_EMAIL_FAILED]", {
        booking_id: pre.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 5. Fire-and-forget audit row ──────────────────────────────────────────
  // Plan 09-01: scheduled via next/server after() (matches sendRescheduleEmails
  // above). Same request-scope guarantee — caller is /api/reschedule route.
  after(async () => {
    const { error } = await supabase
      .from("booking_events")
      .insert({
        booking_id: pre.id,
        account_id: pre.account_id,
        event_type: "rescheduled",
        actor: "booker", // public reschedule path is booker-initiated only in v1
        metadata: {
          old_start_at: oldStartAt,
          new_start_at: updated.start_at,
          ip: ip ?? null,
        },
      });
    if (error) console.error("[reschedule] audit insert error:", error);
  });

  return {
    ok: true,
    booking: {
      id: pre.id,
      account_id: pre.account_id,
      start_at: updated.start_at,
      end_at: updated.end_at,
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_timezone: pre.booker_timezone,
    },
    ...(emailFailed ? { emailFailed } : {}),
  };
}
