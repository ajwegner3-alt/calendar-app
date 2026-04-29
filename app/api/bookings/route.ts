/**
 * POST /api/bookings — race-safe public booking creation.
 *
 * Flow:
 *   1. Parse + validate body via bookingInputSchema (Zod).
 *   2. IP-based rate limit (20/IP/5min sliding window) BEFORE Turnstile + DB.
 *   3. Verify Cloudflare Turnstile token server-side BEFORE any DB hit.
 *   4. Resolve event_type (must be active, not soft-deleted) with service-role client.
 *   5. Resolve account by event_type.account_id.
 *   6. Generate raw + hashed cancel/reschedule tokens.
 *   7. INSERT booking row.
 *      Postgres 23505 on bookings_no_double_book partial unique index → 409.
 *   8. Fire emails (booker confirmation + owner notification) — fire-and-forget.
 *   9. Return 201 with bookingId + suggested redirect path.
 *
 * Why a Route Handler (NOT a Server Action):
 *   Server Actions cannot return 409 — redirects or throws are the only escape
 *   hatches and neither maps cleanly to "that slot was just taken, pick a new time"
 *   UX. Route Handlers return arbitrary HTTP status codes. (RESEARCH Pitfall 1, locked.)
 *
 * Caching: NEVER. dynamic="force-dynamic" + Cache-Control: no-store on every response.
 *   POST endpoints should never be cached, but Next.js can attach headers incorrectly
 *   without explicit signals.
 *
 * Service-role rationale: identical to /api/slots — endpoint is hit by
 * unauthenticated booking-page visitors with no session cookie; RLS would
 * silently block all reads + writes for anon. Inputs are Zod-validated before
 * any query; reads + writes are scoped to the resolved account_id.
 *
 * Pre-flight slot validity check: DEFERRED. The DB-level partial unique index
 * `bookings_capacity_slot_idx ON (event_type_id, start_at, slot_index) WHERE status='confirmed'`
 * is the authoritative race-safe gate. Pre-flighting via computeSlots() would add
 * latency without closing the race window (gap between check and INSERT still exists).
 * Plan 05-08 integration tests verify the end-to-end 409 path.
 *
 * Capacity retry loop (Plan 11-04 / CAP-05 + CAP-07):
 *   The handler reads max_bookings_per_slot from the resolved event_type. It then
 *   attempts slot_index=1..N. On Postgres 23505, that (event_type_id, start_at,
 *   slot_index) triplet is taken — retry with slot_index+1. After exhausting all N:
 *   409 code=SLOT_TAKEN (capacity=1) or code=SLOT_CAPACITY_REACHED (capacity>1).
 *
 * Rate limiting: 20 req / IP / 5-min sliding window (Plan 08-03 / INFRA-04).
 *   Reuses Phase 6 lib/rate-limit.ts; key prefix `bookings:`. Fails open on DB
 *   errors. 21st request from same IP within window returns 429 + Retry-After.
 *
 * Response shapes:
 *   201 → { bookingId: string; redirectTo: string }
 *   400 → { error: string; code: "BAD_REQUEST" | "VALIDATION"; fieldErrors?: ... }
 *   403 → { error: string; code: "TURNSTILE" }
 *   404 → { error: string; code: "NOT_FOUND" }
 *   409 → { error: string; code: "SLOT_TAKEN" }            ← capacity=1 race-loser (CAP-07)
 *   409 → { error: string; code: "SLOT_CAPACITY_REACHED" } ← capacity>1 fully booked (CAP-07)
 *   429 → { error: string; code: "RATE_LIMITED" } ← rate-limit path (Retry-After header)
 *   500 → { error: string; code: "INTERNAL" }
 */

import { NextResponse, after, type NextRequest } from "next/server";

import { bookingInputSchema } from "@/lib/bookings/schema";
import { generateBookingTokens } from "@/lib/bookings/tokens";
import { generateRawToken, hashToken } from "@/lib/booking-tokens";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendBookingEmails } from "@/lib/email/send-booking-emails";
import { sendReminderBooker } from "@/lib/email/send-reminder-booker";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

/** Resolve the base URL for cancel/reschedule links.
 *  Prefers explicit env (set in Vercel); falls back to request origin for local dev. */
function resolveAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : req.nextUrl.origin)
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Parse JSON body ───────────────────────────────────────────────────
  // req.json() throws on invalid JSON; catch → 400 BAD_REQUEST
  const body = await req.json().catch(() => null);
  if (body === null || body === undefined) {
    return NextResponse.json(
      { error: "Invalid JSON.", code: "BAD_REQUEST" },
      { status: 400, headers: NO_STORE },
    );
  }

  // ── 2. Zod validation ────────────────────────────────────────────────────
  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        code: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: NO_STORE },
    );
  }
  const input = parsed.data;

  // ── 3. Rate limit (Plan 08-03 / INFRA-04) ────────────────────────────────
  // 20 req / IP / 5-min sliding window — runs BEFORE Turnstile + DB to fail
  // fast on enumeration / flood. Reuses Phase 6 lib/rate-limit.ts (same
  // rate_limit_events table, key prefix `bookings:` distinguishes from
  // `cancel:` / `reschedule:`). Threshold rationale: token routes use 10/5min
  // (low-frequency); booking flow can produce 2-3 calls per real session, so
  // 20/5min blocks bots while tolerating real users (RESEARCH §Pattern 7).
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const rl = await checkRateLimit(`bookings:${ip}`, 20, 5 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  // ── 4. Turnstile verify (BEFORE any DB hit) ──────────────────────────────
  // Pass the IP extracted above for Cloudflare's additional validation.
  // `unknown` (the rate-limit fallback) is harmless — Turnstile treats missing
  // IP as a no-op rather than a hard failure.
  const turnstileIp = ip === "unknown" ? undefined : ip;
  const turnstileOk = await verifyTurnstile(input.turnstileToken, turnstileIp);
  if (!turnstileOk) {
    return NextResponse.json(
      { error: "Bot check failed. Please refresh and try again.", code: "TURNSTILE" },
      { status: 403, headers: NO_STORE },
    );
  }

  // ── 5. Resolve event_type + account via service-role client ─────────────
  const supabase = createAdminClient();

  // Must be active AND not soft-deleted. maybeSingle() returns null (not error)
  // if no row matches — handled as 404.
  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("id, account_id, slug, name, description, duration_minutes, custom_questions, max_bookings_per_slot")
    .eq("id", input.eventTypeId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError || !eventType) {
    return NextResponse.json(
      { error: "Event type not found.", code: "NOT_FOUND" },
      { status: 404, headers: NO_STORE },
    );
  }

  // Defensive fallback: DB has NOT NULL DEFAULT 1, but ?? 1 guards against
  // any lag between migration and TS type generation.
  const maxBookingsPerSlot = eventType.max_bookings_per_slot ?? 1;

  const { data: account, error: acctError } = await supabase
    .from("accounts")
    .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
    .eq("id", eventType.account_id)
    .single();

  if (acctError || !account) {
    return NextResponse.json(
      { error: "Account not found.", code: "NOT_FOUND" },
      { status: 404, headers: NO_STORE },
    );
  }

  // ── 6. Generate raw tokens + SHA-256 hashes ──────────────────────────────
  // Raw tokens go ONLY into the confirmation email (via sendBookingEmails).
  // Hashes are stored in the DB. Phase 6 cancel/reschedule routes hash the URL
  // token and look up the row by hash. NEVER include raw tokens in the response body.
  const tokens = await generateBookingTokens();

  // ── 7. Insert booking row (slot_index retry loop) ────────────────────────
  // The partial unique index `bookings_capacity_slot_idx ON (event_type_id,
  // start_at, slot_index) WHERE status='confirmed'` is the authoritative race
  // guard (Plan 11-03). On collision, Postgres raises error code 23505
  // (unique_violation). We retry with slot_index=2..N (N=max_bookings_per_slot).
  // If all N slots are exhausted, 409 SLOT_TAKEN (capacity=1) or
  // SLOT_CAPACITY_REACHED (capacity>1). Non-23505 errors fail fast → 500.
  //
  // CAP-05: application-layer capacity-aware retry.
  // CAP-07: code field distinguishes capacity=1 from capacity>1 for the booker UI.
  type BookingRow = {
    id: string;
    start_at: string;
    end_at: string;
    booker_name: string;
    booker_email: string;
    booker_phone: string | null;
    booker_timezone: string;
    answers: unknown;
  };

  let booking: BookingRow | null = null;
  let insertError: { code?: string; message: string } | null = null;

  for (let slotIndex = 1; slotIndex <= maxBookingsPerSlot; slotIndex++) {
    const result = await supabase
      .from("bookings")
      .insert({
        account_id: account.id,
        event_type_id: input.eventTypeId,
        start_at: input.startAt,
        end_at: input.endAt,
        booker_name: input.bookerName,
        booker_email: input.bookerEmail,
        booker_phone: input.bookerPhone,
        booker_timezone: input.bookerTimezone,
        answers: input.answers,
        cancel_token_hash: tokens.hashCancel,
        reschedule_token_hash: tokens.hashReschedule,
        status: "confirmed",
        slot_index: slotIndex,
      })
      .select(
        "id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers",
      )
      .single();

    if (!result.error) {
      booking = result.data as BookingRow;
      insertError = null;
      break;
    }

    insertError = result.error;

    if (result.error.code !== "23505") {
      // Non-capacity error: do not retry. Propagate immediately.
      break;
    }
    // 23505 = that (event_type_id, start_at, slot_index) triplet is already
    // taken. Try next slot_index value in next iteration.
  }

  if (!booking) {
    if (insertError?.code === "23505") {
      // All slot_index values 1..maxBookingsPerSlot were taken — capacity
      // fully exhausted for this (event_type_id, start_at) pair.
      // CAP-07: distinguish capacity=1 (SLOT_TAKEN) vs capacity>1 (SLOT_CAPACITY_REACHED)
      // so the booker UI can render appropriate copy and the client can switch on code.
      const code = maxBookingsPerSlot === 1 ? "SLOT_TAKEN" : "SLOT_CAPACITY_REACHED";
      const message =
        maxBookingsPerSlot === 1
          ? "That time was just booked. Pick a new time below."
          : "That time is fully booked. Please choose a different time.";
      return NextResponse.json(
        { error: message, code },
        { status: 409, headers: NO_STORE },
      );
    }
    // Non-capacity error (insertError.code !== "23505" or null unexpectedly)
    console.error("[/api/bookings] insert error:", insertError);
    return NextResponse.json(
      { error: "Booking failed. Please try again.", code: "INTERNAL" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 8. Fire emails — scheduled via next/server after() ───────────────────
  // Email failures must not roll back the booking or delay the 201 response.
  // sendBookingEmails uses Promise.allSettled internally and logs per-email errors.
  // Raw tokens passed here only — they will NOT appear in the response body.
  //
  // Plan 08-02: switched from `void sendBookingEmails(...)` to `after(() => …)`
  // so the runtime keeps the function alive until emails resolve. On serverless
  // (Vercel) `void` can be killed mid-flight when the response is flushed and
  // the lambda spins down; `after()` is the canonical Next.js 15.1+ primitive
  // for "run this after the response, but before the worker is reaped."
  after(() => sendBookingEmails({
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      booker_name: booking.booker_name,
      booker_email: booking.booker_email,
      booker_timezone: booking.booker_timezone,
    },
    eventType: {
      name: eventType.name,
      description: eventType.description,
      duration_minutes: eventType.duration_minutes,
    },
    account: {
      name: account.name,
      timezone: account.timezone,
      owner_email: account.owner_email,
      slug: account.slug,
      logo_url: account.logo_url ?? null,
      brand_primary: account.brand_primary ?? null,
    },
    rawCancelToken: tokens.rawCancel,
    rawRescheduleToken: tokens.rawReschedule,
    appUrl: resolveAppUrl(req),
    ownerArgs: {
      booking: {
        id: booking.id,
        start_at: booking.start_at,
        booker_name: booking.booker_name,
        booker_email: booking.booker_email,
        booker_phone: booking.booker_phone,
        booker_timezone: booking.booker_timezone,
        answers: (booking.answers ?? {}) as Record<string, string>,
      },
      eventType: { name: eventType.name },
      account: {
        name: account.name,
        timezone: account.timezone,
        owner_email: account.owner_email,
        logo_url: account.logo_url ?? null,
        brand_primary: account.brand_primary ?? null,
      },
    },
  }));

  // ── 8b. Immediate reminder for in-window bookings (Plan 08-04 / INFRA-03) ─
  // If start_at falls inside the next 24h, fire a reminder immediately so the
  // booker doesn't wait for the next cron tick (which could be up to a day
  // away on the Hobby-tier daily fallback). The compare-and-set claim mirrors
  // the cron route so a future cron tick won't double-send for the same row.
  //
  // Token rotation side effect: this also invalidates the just-sent
  // confirmation-email lifecycle links. Acceptable trade-off — same-day
  // bookings rarely need the confirmation tokens because the reminder
  // arrives within seconds with newer links (RESEARCH Open Q 3).
  const startMs = new Date(booking.start_at).getTime();
  const horizonMs = Date.now() + 24 * 60 * 60 * 1000;

  if (startMs <= horizonMs) {
    const rawCancel = generateRawToken();
    const rawReschedule = generateRawToken();
    const cancelHash = await hashToken(rawCancel);
    const rescheduleHash = await hashToken(rawReschedule);

    // Atomic claim — UPDATE only when reminder_sent_at is still NULL. Same
    // CAS pattern as the cron route. Returns null if a concurrent invocation
    // (or future cron) somehow already claimed (extremely unlikely here
    // because we just inserted the row, but defensive).
    const { data: claimedRow } = await supabase
      .from("bookings")
      .update({
        reminder_sent_at: new Date().toISOString(),
        cancel_token_hash: cancelHash,
        reschedule_token_hash: rescheduleHash,
      })
      .eq("id", booking.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimedRow) {
      // Audit log — same shape as cron route. account_id is denormalized
      // (NOT NULL — RLS owners-read policy). Errors logged, not propagated.
      const { error: auditErr } = await supabase.from("booking_events").insert({
        booking_id: booking.id,
        account_id: account.id,
        event_type: "reminder_sent",
        actor: "system",
        metadata: { source: "immediate" },
      });
      if (auditErr) {
        console.error("[/api/bookings] reminder audit log error:", auditErr);
      }

      // Fetch enriched account + event_type fields needed by sendReminderBooker
      // that aren't in the local `account` / `eventType` variables. Specifically:
      //   - accounts.reminder_include_* toggles (Plan 08-01)
      //   - event_types.location (Plan 08-01)
      // Single round-trip: SELECT both via a join keyed off the just-inserted
      // booking row.
      const { data: enriched, error: enrichErr } = await supabase
        .from("bookings")
        .select(`
          event_types!inner(name, duration_minutes, location),
          accounts!inner(
            slug, name, logo_url, brand_primary, owner_email,
            reminder_include_custom_answers,
            reminder_include_location,
            reminder_include_lifecycle_links
          )
        `)
        .eq("id", booking.id)
        .single();

      if (enrichErr || !enriched) {
        // Should never happen — we just inserted this row. Log + skip the
        // immediate reminder; the future cron tick is now also a no-op
        // (reminder_sent_at populated). Tradeoff: this booking gets no
        // reminder. Defensive logging makes this visible.
        console.error("[/api/bookings] reminder enrich error:", enrichErr);
      } else {
        const enrichedEventType = Array.isArray(enriched.event_types)
          ? enriched.event_types[0]
          : enriched.event_types;
        const enrichedAccount = Array.isArray(enriched.accounts)
          ? enriched.accounts[0]
          : enriched.accounts;

        const reminderAppUrl = resolveAppUrl(req);
        after(() => sendReminderBooker({
          booking: {
            id: booking.id,
            start_at: booking.start_at,
            end_at: booking.end_at,
            booker_name: booking.booker_name,
            booker_email: booking.booker_email,
            booker_timezone: booking.booker_timezone,
            answers: (booking.answers ?? null) as Record<string, string> | null,
          },
          eventType: {
            name: enrichedEventType.name,
            duration_minutes: enrichedEventType.duration_minutes,
            location: enrichedEventType.location,
          },
          account: {
            slug: enrichedAccount.slug,
            name: enrichedAccount.name,
            logo_url: enrichedAccount.logo_url,
            brand_primary: enrichedAccount.brand_primary,
            owner_email: enrichedAccount.owner_email,
            reminder_include_custom_answers: enrichedAccount.reminder_include_custom_answers,
            reminder_include_location: enrichedAccount.reminder_include_location,
            reminder_include_lifecycle_links: enrichedAccount.reminder_include_lifecycle_links,
          },
          rawCancelToken: rawCancel,
          rawRescheduleToken: rawReschedule,
          appUrl: reminderAppUrl,
        }));
      }
    }
  }

  // ── 9. Return 201 ────────────────────────────────────────────────────────
  // redirectTo follows the LOCKED confirmation route format (CONTEXT decision #10):
  //   /${account.slug}/${eventType.slug}/confirmed/${booking.id}
  // The client (booking form) will router.push(redirectTo) on success.
  // Raw tokens are NOT included in this response — they live only in the email.
  return NextResponse.json(
    {
      bookingId: booking.id,
      redirectTo: `/${account.slug}/${eventType.slug}/confirmed/${booking.id}`,
    },
    { status: 201, headers: NO_STORE },
  );
}
