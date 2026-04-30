import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/bookings/tokens";
import { sendCancelEmails } from "@/lib/email/send-cancel-emails";

export interface CancelBookingArgs {
  /** UUID of the booking to cancel. Caller is responsible for any prior auth
   *  (e.g. owner Server Action verifies booking belongs to logged-in account
   *  via RLS BEFORE invoking this function). */
  bookingId: string;
  /** Who triggered the cancel — controls the apologetic-vs-confirmation tone in
   *  the booker email and the actor field on the audit row. */
  actor: "booker" | "owner";
  /** Optional cancellation reason text. Surfaced in the OPPOSITE party's email
   *  (booker reason → owner email; owner reason → booker email) when non-empty.
   *  Stored on the audit row regardless. */
  reason?: string;
  /** Caller-resolved app URL for the "Book again" CTA in the booker email.
   *  Typical caller pattern: process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin */
  appUrl: string;
  /** Optional client IP for the audit row (forensics for rate-limit / abuse).
   *  Public token routes pass it; owner Server Action may pass null. */
  ip?: string | null;
}

export type CancelBookingResult =
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
    }
  | {
      ok: false;
      /** 'not_active': booking is already cancelled, already rescheduled past, or start_at is past now().
       *               Maps to the friendly "no longer active" page in the public route.
       *  'db_error':  unexpected DB error (logged server-side); maps to 500 in routes. */
      reason: "not_active" | "db_error";
      error?: string;
    };

/**
 * Atomically cancel a confirmed booking.
 *
 * Single UPDATE with CAS-style WHERE clause (RESEARCH §Pattern 2):
 *   - status='cancelled', cancelled_at=now(), cancelled_by=actor
 *   - cancel_token_hash + reschedule_token_hash replaced with dead hashes
 *     (RESEARCH Pitfall 4: NOT NULL columns can't be cleared; a hash of a fresh
 *      crypto.randomUUID() is unreachable from any email and so functionally
 *      invalidates both tokens permanently)
 *   - WHERE id=? AND status='confirmed' AND start_at > now() — token validity
 *     check (CONTEXT lock) embedded in the UPDATE itself, no TOCTOU race
 *
 * If 0 rows match → PGRST116 from .single() → result.reason='not_active'.
 *
 * After UPDATE: fire-and-forget sendCancelEmails (BOTH parties; CONTEXT lock)
 * + booking_events audit row insert. Email/audit failure must NOT block or
 * roll back the cancel — the row is already updated.
 *
 * Caller is responsible for:
 *   - Authorization (owner Server Action: verify RLS scope; public token route:
 *     verify the URL token hashes to a valid booking BEFORE calling this).
 *   - HTTP response shape (Server Action returns void/{error}; route handler
 *     returns NextResponse).
 *   - Rate limiting (public route only).
 */
export async function cancelBooking(
  args: CancelBookingArgs,
): Promise<CancelBookingResult> {
  const { bookingId, actor, reason, appUrl, ip } = args;
  const supabase = createAdminClient();

  // ── 1. Need event_type + account context for the email senders BEFORE the
  //       UPDATE (so we don't have to refetch after invalidating tokens). ─────
  // We can fetch this in parallel with no risk because the UPDATE is the
  // serialization point — even if status flipped between fetch and UPDATE,
  // the UPDATE's WHERE clause guards against it.
  const { data: pre, error: preError } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers,
       event_types!inner(name, description, duration_minutes, slug),
       accounts!inner(name, slug, timezone, owner_email, logo_url, brand_primary, background_color, chrome_tint_intensity, sidebar_color)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (preError) {
    console.error("[cancel] pre-fetch error:", preError);
    return { ok: false, reason: "db_error", error: preError.message };
  }
  if (!pre) {
    return { ok: false, reason: "not_active" };
  }

  // ── 2. Generate dead hashes for token invalidation ─────────────────────────
  // RESEARCH Pitfall 4: cancel_token_hash + reschedule_token_hash are TEXT NOT NULL.
  // Cannot set to null. Replace with unreachable hash values (hash of a random UUID
  // that was never stored anywhere — functionally invalidates both tokens).
  const deadCancel = await hashToken(crypto.randomUUID());
  const deadReschedule = await hashToken(crypto.randomUUID());

  // ── 3. Atomic cancel UPDATE with CAS guards ────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor,
      cancel_token_hash: deadCancel,
      reschedule_token_hash: deadReschedule,
    })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .gt("start_at", new Date().toISOString())
    .select("id")
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") {
      // 0 rows matched — booking is no longer in 'confirmed' OR start_at passed
      return { ok: false, reason: "not_active" };
    }
    console.error("[cancel] update error:", updateError);
    return { ok: false, reason: "db_error", error: updateError.message };
  }
  if (!updated) {
    return { ok: false, reason: "not_active" };
  }

  // ── 4. Fire-and-forget cancellation emails (BOTH parties; CONTEXT lock) ───
  // Use the pre-fetched booking + event_type + account snapshot — these are the
  // values at the moment the cancel succeeded. Email failure must not block.
  // supabase-js returns nested join objects either as a single row or as
  // arrays depending on the join cardinality; force shape via array index.
  // event_types and accounts are 1:1 from the perspective of bookings.
  const eventType = Array.isArray(pre.event_types)
    ? pre.event_types[0]
    : pre.event_types;
  const account = Array.isArray(pre.accounts)
    ? pre.accounts[0]
    : pre.accounts;

  // Plan 08-02: scheduled via next/server after() instead of `void` so the
  // serverless worker is kept alive until the email orchestrator resolves.
  // sendCancelEmails is called from request scopes only (the public /api/cancel
  // Route Handler and the cancelBookingAsOwner Server Action), both of which
  // satisfy after()'s request-context requirement.
  after(() =>
    sendCancelEmails({
      booking: {
        id: pre.id,
        start_at: pre.start_at,
        end_at: pre.end_at,
        booker_name: pre.booker_name,
        booker_email: pre.booker_email,
        booker_phone: pre.booker_phone ?? null,
        booker_timezone: pre.booker_timezone,
        answers: (pre.answers ?? {}) as Record<string, string>,
      },
      eventType: {
        name: eventType.name,
        description: eventType.description ?? null,
        duration_minutes: eventType.duration_minutes,
        slug: eventType.slug,
      },
      account: {
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
        logo_url: account.logo_url ?? null,
        brand_primary: account.brand_primary ?? null,
        background_color: account.background_color ?? null,
        chrome_tint_intensity: account.chrome_tint_intensity ?? null,
        sidebar_color: account.sidebar_color ?? null,
      },
      actor,
      reason,
      appUrl,
    }),
  );

  // ── 5. Fire-and-forget audit row (Open Question C resolution) ──────────────
  // booking_events.event_type='cancelled', actor=booker|owner, metadata jsonb
  // carries the cancellation reason + ip for forensics. Failure logged.
  // Plan 09-01: scheduled via next/server after() (matches sendCancelEmails
  // above) so the serverless worker keeps the audit-insert alive past the
  // response flush. Same request-scope guarantee — caller is /api/cancel route
  // or cancelBookingAsOwner Server Action.
  after(async () => {
    const { error } = await supabase
      .from("booking_events")
      .insert({
        booking_id: pre.id,
        account_id: pre.account_id,
        event_type: "cancelled",
        actor,
        metadata: {
          reason: reason ?? null,
          ip: ip ?? null,
        },
      });
    if (error) console.error("[cancel] audit insert error:", error);
  });

  return {
    ok: true,
    booking: {
      id: pre.id,
      account_id: pre.account_id,
      start_at: pre.start_at,
      end_at: pre.end_at,
      booker_name: pre.booker_name,
      booker_email: pre.booker_email,
      booker_timezone: pre.booker_timezone,
    },
  };
}
