/**
 * GET /api/cron/send-reminders — reminder dispatch cron.
 *
 * Triggered by:
 *   - Vercel Cron (vercel.json — Hobby-tier daily fallback at 0 8 * * *)
 *   - cron-job.org hourly driver (configured in Plan 08-08 manual checkpoint)
 *
 * Both senders pass `Authorization: Bearer <CRON_SECRET>`. Unauthorized
 * invocations get 401 + Cache-Control: no-store. The handler is fully
 * idempotent — invoking via Vercel daily AND cron-job.org hourly is safe
 * and produces the same exactly-once outcome per booking thanks to the
 * compare-and-set claim on `reminder_sent_at`.
 *
 * Flow:
 *   1. Bearer auth — reject 401 on miss.
 *   2. Scan: confirmed bookings with reminder_sent_at IS NULL whose
 *      start_at falls in [now, now+24h). Uses bookings_reminder_scan_idx
 *      (Phase 1 partial index — exists since initial schema).
 *   3. Per candidate, atomically:
 *        - generate fresh raw cancel + reschedule tokens
 *        - UPDATE bookings SET reminder_sent_at = now(), cancel_token_hash = ?,
 *            reschedule_token_hash = ? WHERE id = ? AND reminder_sent_at IS NULL
 *      The CAS guard makes a second cron tick a no-op for already-claimed rows.
 *      The token rotation invalidates the original confirmation-email tokens —
 *      acceptable trade-off (RESEARCH Open Q 3): single canonical "current"
 *      lifecycle link per booking.
 *   4. Insert booking_events row (event_type='reminder_sent', actor='system').
 *   5. after() — send reminder emails AFTER the response is flushed (RESEARCH
 *      Pattern 4 — keeps the worker alive long enough on Vercel serverless).
 *   6. Return 200 with { ok, scanned, claimed } counts.
 *
 * Failure handling: per RESEARCH Pitfall 4, we do NOT clear reminder_sent_at
 * on email send failure. Acceptable for low-volume v1 — prevents retry spam.
 * Manual remediation: an owner can resend via the future dashboard UI (out
 * of scope for Plan 08-04 — see ROADMAP).
 *
 * Service-role rationale: cron is a system-level invocation with no logged-in
 * user. RLS on bookings would block the cross-account scan. Identical
 * justification to /api/bookings and /api/cancel.
 */

import { after, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateRawToken, hashToken } from "@/lib/booking-tokens";
import { sendReminderBooker } from "@/lib/email/send-reminder-booker";

const NO_STORE = { "Cache-Control": "no-store, no-transform" } as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Resolve the base URL for cancel/reschedule links in reminder emails.
 *  Cron has no incoming request URL to fall back to (no booking-page origin),
 *  so we require an explicit env var with the Vercel URL as a last-resort fallback. */
function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "")
  );
}

/** Shape of a row returned from the scan query (typed locally so we don't
 *  depend on generated Supabase types — the joined relations come back as
 *  arrays in supabase-js typings even when !inner makes them objects). */
interface ScanRow {
  id: string;
  account_id: string;
  start_at: string;
  end_at: string;
  booker_name: string;
  booker_email: string;
  booker_timezone: string;
  answers: Record<string, string> | null;
  event_types: {
    name: string;
    duration_minutes: number;
    location: string | null;
  };
  accounts: {
    slug: string;
    name: string;
    logo_url: string | null;
    brand_primary: string | null;
    /** Phase 12-01 column: accounts.background_color. */
    background_color: string | null;
    /** Phase 12.5 column: accounts.chrome_tint_intensity. */
    chrome_tint_intensity: string | null;
    owner_email: string | null;
    reminder_include_custom_answers: boolean;
    reminder_include_location: boolean;
    reminder_include_lifecycle_links: boolean;
  };
}

export async function GET(request: NextRequest) {
  // ── 1. Bearer auth ───────────────────────────────────────────────────────
  // Both Vercel Cron and cron-job.org pass `Authorization: Bearer <secret>`.
  // Constant-time comparison would be ideal but the secret is a long random
  // string with no per-char shortcut for an attacker; equality is safe enough
  // for v1 (matches the Phase 6 token-route auth shape).
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401, headers: NO_STORE });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // ── 2. Scan candidates ───────────────────────────────────────────────────
  // Filters:
  //   - status='confirmed'                — never remind cancelled/rescheduled-past
  //   - reminder_sent_at IS NULL          — exactly-once guard (Phase 1 partial idx)
  //   - start_at >= now() AND <= now()+24h — only the next 24h window
  //
  // `!inner` joins ensure we only get bookings whose event_type AND account
  // still exist (defensive — soft-deleted event types are filtered separately
  // because the bookings table has FK to event_types with no on-delete cascade
  // for soft-delete; the `is_active` filter would be inappropriate here because
  // a soft-deleted event type's existing bookings should still get reminders).
  const { data: candidates, error: scanErr } = await supabase
    .from("bookings")
    .select(`
      id, account_id, start_at, end_at, booker_name, booker_email, booker_timezone, answers,
      event_types!inner(name, duration_minutes, location),
      accounts!inner(
        slug, name, logo_url, brand_primary, background_color, chrome_tint_intensity,
        owner_email,
        reminder_include_custom_answers,
        reminder_include_location,
        reminder_include_lifecycle_links
      )
    `)
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("start_at", now.toISOString())
    .lte("start_at", windowEnd.toISOString());

  if (scanErr) {
    console.error("[cron/send-reminders] scan error", scanErr);
    return Response.json(
      { ok: false, error: "scan_failed" },
      { status: 500, headers: NO_STORE },
    );
  }

  // supabase-js returns joined relations as arrays in its TS shape even for
  // !inner. Normalize to single objects.
  const normalized: ScanRow[] = (candidates ?? []).map((c) => {
    const eventType = Array.isArray(c.event_types) ? c.event_types[0] : c.event_types;
    const account = Array.isArray(c.accounts) ? c.accounts[0] : c.accounts;
    return {
      id: c.id,
      account_id: c.account_id,
      start_at: c.start_at,
      end_at: c.end_at,
      booker_name: c.booker_name,
      booker_email: c.booker_email,
      booker_timezone: c.booker_timezone,
      answers: c.answers as Record<string, string> | null,
      event_types: eventType,
      accounts: account,
    };
  });

  const claimed: ScanRow[] = [];
  const tokensByBookingId = new Map<string, { rawCancel: string; rawReschedule: string }>();

  // ── 3. Compare-and-set claim per row + rotate tokens ────────────────────
  // Per-row UPDATE (not a single batched UPDATE) because we need a fresh
  // token pair per booking and each booking goes into its own claim WHERE
  // clause. For a low-volume v1 (under a few dozen bookings/day) this is
  // fine; if volume grows, batch into chunks of N parallel UPDATEs.
  for (const c of normalized) {
    const rawCancel = generateRawToken();
    const rawReschedule = generateRawToken();
    const cancelHash = await hashToken(rawCancel);
    const rescheduleHash = await hashToken(rawReschedule);

    const { data: claimedRow, error: claimErr } = await supabase
      .from("bookings")
      .update({
        reminder_sent_at: new Date().toISOString(),
        cancel_token_hash: cancelHash,
        reschedule_token_hash: rescheduleHash,
      })
      .eq("id", c.id)
      .is("reminder_sent_at", null) // CAS guard — second cron tick gets null back
      .select("id")
      .maybeSingle();

    if (claimErr) {
      console.error("[cron/send-reminders] claim error", { bookingId: c.id, err: claimErr });
      continue;
    }
    if (!claimedRow) {
      // Another invocation already claimed this booking. Silent skip — this
      // is the expected idempotency path on overlapping cron triggers.
      continue;
    }

    claimed.push(c);
    tokensByBookingId.set(c.id, { rawCancel, rawReschedule });

    // ── 4. Audit log ────────────────────────────────────────────────────────
    // booking_events.event_type uses the booking_event_kind enum; 'reminder_sent'
    // is one of its values (Phase 1 schema). actor='system' for cron-driven sends.
    // account_id is NOT NULL — denormalized for RLS on the owners-read-events policy.
    const { error: logErr } = await supabase.from("booking_events").insert({
      booking_id: c.id,
      account_id: c.account_id,
      event_type: "reminder_sent",
      actor: "system",
      metadata: { source: "cron" },
    });
    if (logErr) {
      // Audit-log failure should not block the email send. Log and continue.
      console.error("[cron/send-reminders] audit log error", { bookingId: c.id, err: logErr });
    }
  }

  // ── 5. Fire-and-forget email send AFTER response is flushed ─────────────
  // after() keeps the worker alive past the response so the emails actually
  // ship on Vercel serverless. Errors per email are caught + logged so a
  // single SMTP failure doesn't kill the rest of the batch.
  const appUrl = resolveAppUrl();
  after(async () => {
    for (const c of claimed) {
      const tokens = tokensByBookingId.get(c.id);
      if (!tokens) continue; // defensive — should never happen
      try {
        await sendReminderBooker({
          booking: {
            id: c.id,
            start_at: c.start_at,
            end_at: c.end_at,
            booker_name: c.booker_name,
            booker_email: c.booker_email,
            booker_timezone: c.booker_timezone,
            answers: c.answers,
          },
          eventType: {
            name: c.event_types.name,
            duration_minutes: c.event_types.duration_minutes,
            location: c.event_types.location,
          },
          account: {
            slug: c.accounts.slug,
            name: c.accounts.name,
            logo_url: c.accounts.logo_url,
            brand_primary: c.accounts.brand_primary,
            background_color: c.accounts.background_color ?? null,
            chrome_tint_intensity: c.accounts.chrome_tint_intensity ?? null,
            owner_email: c.accounts.owner_email,
            reminder_include_custom_answers: c.accounts.reminder_include_custom_answers,
            reminder_include_location: c.accounts.reminder_include_location,
            reminder_include_lifecycle_links: c.accounts.reminder_include_lifecycle_links,
          },
          rawCancelToken: tokens.rawCancel,
          rawRescheduleToken: tokens.rawReschedule,
          appUrl,
        });
      } catch (err) {
        // RESEARCH Pitfall 4 anti-pattern note: do NOT clear reminder_sent_at
        // on failure (that would re-send next tick = retry spam). Manual
        // remediation by the owner via dashboard (out of scope for v1).
        console.error("[cron/send-reminders] send error", { bookingId: c.id, err });
      }
    }
  });

  return Response.json(
    { ok: true, scanned: normalized.length, claimed: claimed.length },
    { headers: NO_STORE },
  );
}
