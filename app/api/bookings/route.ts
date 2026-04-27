/**
 * POST /api/bookings — race-safe public booking creation.
 *
 * Flow:
 *   1. Parse + validate body via bookingInputSchema (Zod).
 *   2. Verify Cloudflare Turnstile token server-side BEFORE any DB hit.
 *   3. Resolve event_type (must be active, not soft-deleted) with service-role client.
 *   4. Resolve account by event_type.account_id.
 *   5. Generate raw + hashed cancel/reschedule tokens.
 *   6. INSERT booking row.
 *      Postgres 23505 on bookings_no_double_book partial unique index → 409.
 *   7. Fire emails (booker confirmation + owner notification) — fire-and-forget.
 *   8. Return 201 with bookingId + suggested redirect path.
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
 * `bookings_no_double_book ON (event_type_id, start_at) WHERE status='confirmed'`
 * is the authoritative race-safe gate. Pre-flighting via computeSlots() would add
 * latency without closing the race window (gap between check and INSERT still exists).
 * Plan 05-08 integration tests verify the end-to-end 409 path.
 *
 * Rate limiting: DEFERRED to Phase 8 (INFRA-01).
 *
 * Response shapes:
 *   201 → { bookingId: string; redirectTo: string }
 *   400 → { error: string; code: "BAD_REQUEST" | "VALIDATION"; fieldErrors?: ... }
 *   403 → { error: string; code: "TURNSTILE" }
 *   404 → { error: string; code: "NOT_FOUND" }
 *   409 → { error: string; code: "SLOT_TAKEN" }   ← race-loser path
 *   500 → { error: string; code: "INTERNAL" }
 */

import { NextResponse, after, type NextRequest } from "next/server";

import { bookingInputSchema } from "@/lib/bookings/schema";
import { generateBookingTokens } from "@/lib/bookings/tokens";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendBookingEmails } from "@/lib/email/send-booking-emails";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // ── 3. Turnstile verify (BEFORE any DB hit) ──────────────────────────────
  // Extract visitor IP from standard proxy headers for additional validation.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined;

  const turnstileOk = await verifyTurnstile(input.turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json(
      { error: "Bot check failed. Please refresh and try again.", code: "TURNSTILE" },
      { status: 403, headers: NO_STORE },
    );
  }

  // ── 4. Resolve event_type + account via service-role client ─────────────
  const supabase = createAdminClient();

  // Must be active AND not soft-deleted. maybeSingle() returns null (not error)
  // if no row matches — handled as 404.
  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("id, account_id, slug, name, description, duration_minutes, custom_questions")
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

  // ── 5. Generate raw tokens + SHA-256 hashes ──────────────────────────────
  // Raw tokens go ONLY into the confirmation email (via sendBookingEmails).
  // Hashes are stored in the DB. Phase 6 cancel/reschedule routes hash the URL
  // token and look up the row by hash. NEVER include raw tokens in the response body.
  const tokens = await generateBookingTokens();

  // ── 6. Insert booking row ────────────────────────────────────────────────
  // The partial unique index `bookings_no_double_book ON (event_type_id, start_at)
  // WHERE status='confirmed'` is the authoritative race guard. On collision,
  // Postgres raises error code 23505 (unique_violation). supabase-js surfaces
  // this on insertError.code. We return 409 so the client can display the
  // race-loser inline banner and prompt the visitor to pick a new time.
  const { data: booking, error: insertError } = await supabase
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
    })
    .select(
      "id, start_at, end_at, booker_name, booker_email, booker_phone, booker_timezone, answers",
    )
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // bookings_no_double_book partial unique index violation — slot was taken
      // in the race window between the visitor picking a time and submitting.
      // CONTEXT decision #5: use this exact copy for the race-loser banner.
      return NextResponse.json(
        {
          error: "That time was just booked. Pick a new time below.",
          code: "SLOT_TAKEN",
        },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error("[/api/bookings] insert error:", insertError);
    return NextResponse.json(
      { error: "Booking failed. Please try again.", code: "INTERNAL" },
      { status: 500, headers: NO_STORE },
    );
  }

  // ── 7. Fire emails — scheduled via next/server after() ───────────────────
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

  // ── 8. Return 201 ────────────────────────────────────────────────────────
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
