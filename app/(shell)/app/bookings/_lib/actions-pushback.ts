"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBookingsForPushback, type PushbackBooking } from "./queries";
import { getEndOfDayMinute } from "@/lib/slots";
import {
  computeCascadePreview,
  countMoved,
  type CascadeRow,
} from "@/lib/bookings/pushback";
import {
  getRemainingDailyQuota,
  QuotaExceededError,
} from "@/lib/email-sender/quota-guard";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { generateBookingTokens } from "@/lib/bookings/tokens";
import { sendRescheduleEmails } from "@/lib/email/send-reschedule-emails";
import { TZDate } from "@date-fns/tz";

// ─── getBookingsForPushbackAction ────────────────────────────────────────────
// Plan 33-01: thin server action wrapper exposing getBookingsForPushback to the
// client dialog. Validates that the caller owns the accountId (ownership check
// on accounts.owner_user_id) before executing the query.

export interface GetBookingsForPushbackResult {
  ok: boolean;
  bookings: PushbackBooking[];
  error?: string;
}

export async function getBookingsForPushbackAction(input: {
  accountId: string;
  date: string; // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
}): Promise<GetBookingsForPushbackResult> {
  const supabase = await createClient();

  // Auth: confirm caller is authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, bookings: [], error: "Unauthorized" };
  }

  // Ownership: confirm caller owns the supplied accountId (defense-in-depth —
  // RLS also enforces this, but explicit check matches Phase 32 pattern and
  // clarifies the intent).
  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", input.accountId)
    .single();

  if (account?.owner_user_id !== user.id) {
    return { ok: false, bookings: [], error: "Unauthorized" };
  }

  try {
    const bookings = await getBookingsForPushback(supabase, {
      accountId: input.accountId,
      dateIsoYmd: input.date,
      accountTimezone: input.accountTimezone,
    });
    return { ok: true, bookings };
  } catch (e) {
    return {
      ok: false,
      bookings: [],
      error: e instanceof Error ? e.message : "Failed to load bookings",
    };
  }
}

// ─── previewPushbackAction ────────────────────────────────────────────────────
// Plan 33-02: cascade preview with quota pre-flight (EMAIL-22).
//
// Returns the full per-row CascadeRow[] with state badges + old_start_at /
// new_start_at + booker first name + duration, plus remainingQuota and a
// quotaError boolean.
//
// Quota math: movedCount = MOVE + PAST_EOD count (= emails to send on commit).
// With skipOwnerEmail=true on commit, each moved booking sends 1 email (booker
// only), so movedCount === emailsNeeded. Do NOT multiply by 2 (CONTEXT.md lock).

export interface PreviewPushbackInput {
  accountId: string;
  date: string; // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
  anchorId: string;
  delayMinutes: number; // already converted from min/hr in the dialog
  reason?: string;
}

export type PreviewPushbackResult =
  | {
      ok: true;
      rows: CascadeRow[];
      movedCount: number; // MOVE + PAST_EOD count (= emails to send)
      remainingQuota: number;
      quotaError: boolean; // true when movedCount > remainingQuota
    }
  | { ok: false; error: string };

export async function previewPushbackAction(
  input: PreviewPushbackInput,
): Promise<PreviewPushbackResult> {
  const supabase = await createClient();

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Ownership
  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", input.accountId)
    .single();
  if (account?.owner_user_id !== user.id) return { ok: false, error: "Unauthorized" };

  // Validate delay
  if (!Number.isInteger(input.delayMinutes) || input.delayMinutes <= 0) {
    return { ok: false, error: "Delay must be a positive integer" };
  }

  // Fetch bookings for the date
  const bookings = await getBookingsForPushback(supabase, {
    accountId: input.accountId,
    dateIsoYmd: input.date,
    accountTimezone: input.accountTimezone,
  });
  if (bookings.length === 0) {
    return { ok: false, error: "No bookings on this date" };
  }

  // Fetch availability rules + date overrides for endOfDayMinute computation.
  // Both fetched in parallel to minimise round-trips.
  const [{ data: rules }, { data: overrides }] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("account_id", input.accountId),
    supabase
      .from("date_overrides")
      .select("*")
      .eq("account_id", input.accountId)
      .eq("override_date", input.date),
  ]);

  // Day-of-week for the chosen date in accountTimezone.
  // TZDate constructed from a local ISO string returns wall-clock day — DST-safe.
  const localMidnight = new TZDate(`${input.date}T00:00:00`, input.accountTimezone);
  const dow = localMidnight.getDay();

  const endOfDayMinutes = getEndOfDayMinute(
    input.date,
    dow,
    rules ?? [],
    overrides ?? [],
  );

  const rows = computeCascadePreview({
    bookings,
    anchorId: input.anchorId,
    delayMs: input.delayMinutes * 60_000,
    endOfDayMinutes,
    accountTimezone: input.accountTimezone,
  });

  const movedCount = countMoved(rows);
  const remainingQuota = await getRemainingDailyQuota();

  return {
    ok: true,
    rows,
    movedCount,
    remainingQuota,
    quotaError: movedCount > remainingQuota,
  };
}

// ─── commitPushbackAction ─────────────────────────────────────────────────────
// Plan 33-03: destructive commit path.
//
// Race strategy: ABORT-on-diverge (NOT union, per RESEARCH.md Risk 7 +
// CONTEXT.md). If the day's confirmed booking set changed between preview and
// commit, the entire batch is aborted — cascade math is order-dependent and
// any added or removed booking invalidates the preview.
//
// Per-booking result shape distinguishes:
//   'sent'         — DB updated + booker email sent (happy path)
//   'email_failed' — DB updated, email did NOT send (retryable in 33-04)
//   'slot_taken'   — DB rejected (constraint 23505/23P01); booking unchanged
//   'not_active'   — DB rejected (CAS: token rotated, cancelled, or past);
//                    booking unchanged
//   'skipped'      — ABSORBED booking; no DB change, no email
//
// Quota math: skipOwnerEmail=true → 1 email per moved booking → needed =
// movedBookings.length. (Plan 33-02 decision, locked.)

export interface CommitPushbackInput {
  accountId: string;
  date: string;                  // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
  reason?: string;
  /** Moving bookings from the preview (MOVE + PAST_EOD rows only). */
  movedBookings: Array<{
    booking_id: string;
    new_start_at: string;        // UTC ISO from CascadeRow.new_start_at
    new_end_at: string;          // UTC ISO from CascadeRow.new_end_at
  }>;
  /**
   * Full list of confirmed-booking IDs the preview saw (MOVE + ABSORBED +
   * PAST_EOD). Used for the abort-on-diverge re-query comparison — any
   * addition or removal aborts the commit.
   */
  previewBookingIds: string[];
}

export interface CommitPushbackResultRow {
  booking_id: string;
  booker_name: string;           // full name; first-name derivation at render
  old_start_at: string;
  new_start_at: string | null;   // null when ABSORBED (skipped) or DB failure
  status: "sent" | "email_failed" | "slot_taken" | "not_active" | "skipped";
  error_message?: string;        // set when status !== 'sent' and !== 'skipped'
}

export type CommitPushbackResult =
  | { ok: true; rows: CommitPushbackResultRow[] }
  | { ok: false; quotaError: true; needed: number; remaining: number }
  | { ok: false; diverged: true; message: string }
  | { ok: false; formError: string };

export async function commitPushbackAction(
  input: CommitPushbackInput,
): Promise<CommitPushbackResult> {
  const supabase = await createClient();

  // ── 1. AUTH ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: "Unauthorized" };

  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", input.accountId)
    .single();
  if (account?.owner_user_id !== user.id)
    return { ok: false, formError: "Unauthorized" };

  // ── 2. HARD QUOTA PRE-FLIGHT (re-checked at commit time, not just at preview) ─
  // skipOwnerEmail=true → 1 booker email per moved booking → needed = count.
  const remaining = await getRemainingDailyQuota();
  const needed = input.movedBookings.length;
  if (needed > remaining) {
    return { ok: false, quotaError: true, needed, remaining };
  }

  // ── 3. RACE-SAFE RE-QUERY ────────────────────────────────────────────────────
  // Re-fetch the day's confirmed bookings RIGHT NOW. Any addition or removal
  // since the preview means the cascade math is stale → ABORT (no union).
  const currentBookings = await getBookingsForPushback(supabase, {
    accountId: input.accountId,
    dateIsoYmd: input.date,
    accountTimezone: input.accountTimezone,
  });

  const currentIds = new Set(currentBookings.map((b) => b.id));
  const previewIds = new Set(input.previewBookingIds);

  // ── 4. ABORT ON DIVERGE ──────────────────────────────────────────────────────
  // Both sets must be identical — no additions, no removals.
  // Phase 33 deliberately does NOT union (contrast: Phase 32 unions).
  const sameSet =
    currentIds.size === previewIds.size &&
    [...previewIds].every((id) => currentIds.has(id));

  if (!sameSet) {
    return {
      ok: false,
      diverged: true,
      message:
        "Bookings on this date changed since preview. Please review and preview again.",
    };
  }

  // ── 5. PRE-FETCH reschedule_token_hash ────────────────────────────────────────
  // All token hashes are already in the currentBookings rows (getBookingsForPushback
  // selects reschedule_token_hash). Build a lookup map by booking ID.
  const movingIds = new Set(input.movedBookings.map((m) => m.booking_id));
  const bookingMap = new Map(currentBookings.map((b) => [b.id, b]));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: CommitPushbackResultRow[] = [];

  // ── 6. ABSORBED bookings → emit 'skipped' rows (complete summary for 33-04) ──
  for (const id of input.previewBookingIds) {
    if (movingIds.has(id)) continue; // moving rows handled below
    const b = bookingMap.get(id);
    if (!b) continue; // safety: diverge check above guarantees this exists
    results.push({
      booking_id: id,
      booker_name: b.booker_name,
      old_start_at: b.start_at,
      new_start_at: null,
      status: "skipped",
    });
  }

  // ── 7. BATCH RESCHEDULE via Promise.allSettled ────────────────────────────────
  // One failure does not abort the rest. Each settled result maps to a row.
  // rescheduleBooking() returns a discriminated union (ok/not-ok) — it does NOT
  // throw on DB failures (slot_taken, not_active). Errors on the happy path
  // surface via the emailFailed field.
  const movingResults = await Promise.allSettled(
    input.movedBookings.map(async (m) => {
      const b = bookingMap.get(m.booking_id);
      if (!b) {
        // Should not happen given diverge check — defensive path only.
        return {
          booking_id: m.booking_id,
          booker_name: "?",
          old_start_at: "?",
          new_start_at: m.new_start_at,
          status: "not_active" as const,
          error_message: "Booking not found at commit (should not happen)",
        } satisfies CommitPushbackResultRow;
      }

      const rescheduleResult = await rescheduleBooking({
        bookingId: b.id,
        oldRescheduleHash: b.reschedule_token_hash, // CAS guard pre-fetched
        newStartAt: m.new_start_at,
        newEndAt: m.new_end_at,
        appUrl,
        // Note: rescheduleBooking does not expose a 'reason' param — the reason
        // text is recorded on the commitPushbackAction input and stored in the
        // dialog summary for the owner. The audit row captures the action via
        // actor='owner' + event_type='rescheduled'. PUSH-10 (reason in email)
        // is a deviation to document: the existing reschedule email template
        // does not include a reason field, so the reason is currently for
        // owner-internal context only. Tracked as tech debt for future polish.
        skipOwnerEmail: true,  // Phase 33 lock: owner sees in-dialog summary
        actor: "owner",        // Phase 33 lock: audit row records owner action
        ip: null,
      });

      if (!rescheduleResult.ok) {
        // DB-layer failure — booking NOT updated (RESEARCH.md Risk 7).
        // slot_taken: constraint violation 23505 or 23P01.
        // not_active: CAS guard failed (token rotated, cancelled, or past).
        // bad_slot / db_error: map to not_active (unexpected; booking unchanged).
        const status: CommitPushbackResultRow["status"] =
          rescheduleResult.reason === "slot_taken"
            ? "slot_taken"
            : "not_active";

        return {
          booking_id: b.id,
          booker_name: b.booker_name,
          old_start_at: b.start_at,
          new_start_at: null, // booking NOT updated; no new time
          status,
          error_message: rescheduleResult.error ?? rescheduleResult.reason,
        } satisfies CommitPushbackResultRow;
      }

      // DB success. Check whether the email leg succeeded.
      // emailFailed is undefined on happy path, "quota" or "send" on failure.
      // Booking IS updated in both cases. email_failed is retryable (33-04).
      const emailFailed = rescheduleResult.emailFailed;
      if (emailFailed) {
        return {
          booking_id: b.id,
          booker_name: b.booker_name,
          old_start_at: b.start_at,
          new_start_at: m.new_start_at, // booking WAS updated
          status: "email_failed" as const,
          error_message: `email-${emailFailed}`,
        } satisfies CommitPushbackResultRow;
      }

      return {
        booking_id: b.id,
        booker_name: b.booker_name,
        old_start_at: b.start_at,
        new_start_at: m.new_start_at,
        status: "sent" as const,
      } satisfies CommitPushbackResultRow;
    }),
  );

  // Collect moving results (Promise.allSettled: each is 'fulfilled' or 'rejected').
  // The inner async function should not throw (all branches have explicit returns),
  // but handle rejected case defensively.
  for (const settled of movingResults) {
    if (settled.status === "fulfilled") {
      results.push(settled.value);
    } else {
      // Unexpected unhandled throw — defensive fallback.
      results.push({
        booking_id: "?",
        booker_name: "?",
        old_start_at: "?",
        new_start_at: null,
        status: "email_failed",
        error_message: String(settled.reason),
      });
    }
  }

  // ── 8. REVALIDATE ────────────────────────────────────────────────────────────
  revalidatePath("/app/bookings");

  return { ok: true, rows: results };
}

// ─── retryPushbackEmailAction ─────────────────────────────────────────────────
// Plan 33-04: Re-send a single reschedule email for a booking whose DB UPDATE
// succeeded during commitPushbackAction but whose email leg failed (status
// === 'email_failed'). The booking is already at its new time — only the email
// needs to be re-sent.
//
// Token pattern: mirrors sendReminderForBookingAction (actions.ts) — fresh raw
// tokens are minted and their hashes persisted to the booking, invalidating any
// older links in the booker's inbox.
//
// Quota: sendRescheduleEmails calls checkAndConsumeQuota internally and throws
// QuotaExceededError if at cap. Caught here and mapped to { ok: false, quotaError }.
//
// LD-07 lock: sendOwner=false — booker leg only; owner already knows via the
// in-dialog summary.

export interface RetryPushbackEmailInput {
  accountId: string;
  bookingId: string;
  /** From CommitPushbackResultRow.old_start_at — needed for the "Was:" field in
   *  the email. The booking.start_at is now the NEW time after the commit. */
  oldStartAt: string;
  reason?: string; // same reason text used in the original batch (informational)
}

export type RetryPushbackEmailResult =
  | { ok: true }
  | { ok: false; quotaError: true; remaining: number }
  | { ok: false; error: string };

export async function retryPushbackEmailAction(
  input: RetryPushbackEmailInput,
): Promise<RetryPushbackEmailResult> {
  const supabase = await createClient();

  // ── 1. AUTH ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // ── 2. OWNERSHIP + account fields for email ──────────────────────────────────
  // Fetch account row including all fields needed for sendRescheduleEmails branding.
  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, owner_user_id, slug, name, timezone, owner_email, logo_url, brand_primary",
    )
    .eq("id", input.accountId)
    .single();
  if (account?.owner_user_id !== user.id)
    return { ok: false, error: "Unauthorized" };

  // ── 3. QUOTA PRE-FLIGHT ───────────────────────────────────────────────────────
  // Pre-flight check to return a friendly error before attempting the send.
  // sendRescheduleEmails also guards internally via checkAndConsumeQuota.
  const remaining = await getRemainingDailyQuota();
  if (remaining < 1) return { ok: false, quotaError: true, remaining };

  // ── 4. FETCH BOOKING (current state — start_at is now the NEW time) ───────────
  const { data: bookingRaw, error: fetchErr } = await supabase
    .from("bookings")
    .select(
      `
      id, account_id, status,
      start_at, end_at,
      booker_name, booker_email, booker_timezone,
      event_types!inner ( id, name, description, duration_minutes )
    `,
    )
    .eq("id", input.bookingId)
    .eq("account_id", input.accountId)
    .single();

  if (fetchErr || !bookingRaw)
    return { ok: false, error: "Booking not found" };
  if (bookingRaw.status !== "confirmed")
    return { ok: false, error: "Booking is not confirmed" };

  // Normalize event_types join cardinality (Supabase can return object or array).
  const etRaw = bookingRaw.event_types as unknown;
  const et = (Array.isArray(etRaw) ? etRaw[0] : etRaw) as {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
  };

  // ── 5. MINT FRESH TOKENS ──────────────────────────────────────────────────────
  // Matches Phase 8 cron + sendReminderForBookingAction precedent.
  // Invalidates any older raw cancel/reschedule links in the booker's inbox.
  const { rawCancel, rawReschedule, hashCancel, hashReschedule } =
    await generateBookingTokens();

  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      cancel_token_hash: hashCancel,
      reschedule_token_hash: hashReschedule,
    })
    .eq("id", bookingRaw.id);
  if (updateErr)
    return {
      ok: false,
      error: "Failed to refresh tokens: " + updateErr.message,
    };

  // ── 6. SEND BOOKER EMAIL ONLY ─────────────────────────────────────────────────
  // sendOwner=false: LD-07 booker-neutrality + owner already knows via in-dialog summary.
  // oldStartAt from input: booking.start_at is now the NEW time after the batch commit.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");

  try {
    await sendRescheduleEmails({
      booking: {
        id: bookingRaw.id,
        start_at: bookingRaw.start_at,   // NEW time (already committed)
        end_at: bookingRaw.end_at,
        booker_name: bookingRaw.booker_name,
        booker_email: bookingRaw.booker_email,
        booker_timezone: bookingRaw.booker_timezone,
      },
      eventType: {
        name: et.name,
        description: et.description,
        duration_minutes: et.duration_minutes,
      },
      account: {
        id: account.id,
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email,
        logo_url: account.logo_url,
        brand_primary: account.brand_primary,
      },
      oldStartAt: input.oldStartAt,       // original pre-commit time for "Was:" line
      oldEndAt: input.oldStartAt,         // oldEndAt only used by owner leg (sendOwner=false skips it)
      rawCancelToken: rawCancel,
      rawRescheduleToken: rawReschedule,
      appUrl,
      sendOwner: false,
    });
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      const currentRemaining = await getRemainingDailyQuota();
      return { ok: false, quotaError: true, remaining: currentRemaining };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email send failed",
    };
  }

  revalidatePath("/app/bookings");
  return { ok: true };
}
