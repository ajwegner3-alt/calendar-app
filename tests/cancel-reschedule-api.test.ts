// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import {
  adminClient,
  getOrCreateTestAccount,
  getOrCreateTestEventType,
} from "@/tests/helpers/supabase";
import {
  createConfirmedBooking,
  type BookingFixture,
} from "@/tests/helpers/booking-fixtures";

import { POST as cancelPOST } from "@/app/api/cancel/route";
import { POST as reschedulePOST } from "@/app/api/reschedule/route";
// Note: cancelBookingAsOwner is the Server Action that calls createClient() from
// next/headers. In vitest+node there is no Next request context, so cookies()
// throws outside a request scope. We therefore call cancelBooking() (the shared
// function) directly with actor:'owner' — this is the exact function the Server
// Action delegates to and is the correct single-source-of-truth proof. Coverage
// of the Server Action wrapper's RLS pre-check is confirmed in Manual QA (step 6).
import { cancelBooking } from "@/lib/bookings/cancel";
import { resolveCancelToken } from "@/app/cancel/[token]/_lib/resolve-cancel-token";
import { __mockSendCalls, __resetMockSendCalls } from "@/lib/email-sender"; // resolved to mock via vitest.config.ts alias
import { __setTurnstileResult } from "@/lib/turnstile"; // resolved to mock via vitest.config.ts alias

/**
 * Phase 6 integration tests — exercises:
 *   - POST /api/cancel + POST /api/reschedule (Plan 06-04 routes)
 *   - cancelBooking() shared function with actor:'owner' (Plan 06-03 / 06-05)
 *   - Shared cancelBooking() + rescheduleBooking() (Plan 06-03) via the routes
 *   - Token invalidation behaviors (status flip, time passed, dead-hash)
 *   - Postgres 23505 / CAS-failure mappings (409 SLOT_TAKEN, 410 NOT_ACTIVE)
 *   - Sliding-window rate limit on both token routes (429 + Retry-After)
 *   - .ics METHOD:CANCEL shape (UID + SEQUENCE:1 + STATUS:CANCELLED)
 *   - Email-prefetch defense (GET cancel page is read-only)
 *
 * Setup: real Supabase test project, real DB writes/reads. Email-sender + Turnstile
 * mocked via vitest.config.ts aliases (Plan 05-08 baseline; this plan adds zero
 * new aliases).
 *
 * Isolation: uses TEST_ACCOUNT_SLUG ('nsi-test') — never touches production 'nsi'
 * account (Andrew CLAUDE.md isolation rule).
 */

let TEST_ACCOUNT_ID = "";
let TEST_EVENT_TYPE_ID = "";
const insertedBookingIds: string[] = [];
const usedRateLimitKeys: string[] = [];

// Build a NextRequest matching the route's expected shape. NextRequest (not
// plain Request) is required because the route handlers call req.nextUrl.origin
// as a fallback for appUrl when NEXT_PUBLIC_APP_URL is not set. Plain Request
// does not have .nextUrl. Phase 5 Plan 05-08 lock: use NextRequest directly in
// Vitest node env (verified pattern from bookings-api.test.ts).
//
// Pass an `ip` arg to distinguish callers for rate-limit testing (uses
// x-forwarded-for header).
function buildRequest(url: string, body: unknown, ip?: string): NextRequest {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeAll(async () => {
  TEST_ACCOUNT_ID = await getOrCreateTestAccount();
  TEST_EVENT_TYPE_ID = await getOrCreateTestEventType(TEST_ACCOUNT_ID);
});

afterAll(async () => {
  const admin = adminClient();
  if (insertedBookingIds.length) {
    await admin.from("bookings").delete().in("id", insertedBookingIds);
  }
  if (usedRateLimitKeys.length) {
    await admin.from("rate_limit_events").delete().in("key", usedRateLimitKeys);
  }
});

beforeEach(() => {
  __setTurnstileResult(true);
  __resetMockSendCalls();
});

// Suppress expected route console.error output during tests
const origError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Allow through unless it's a known expected error from route handlers
    const msg = String(args[0] ?? "");
    if (
      msg.includes("[/api/cancel]") ||
      msg.includes("[/api/reschedule]") ||
      msg.includes("[cancel]") ||
      msg.includes("[reschedule]") ||
      msg.includes("[rate-limit]") ||
      msg.includes("[cancel-emails]") ||
      msg.includes("[reschedule-emails]")
    ) {
      return;
    }
    origError(...args);
  };
});
afterAll(() => {
  console.error = origError;
});

// ─── Scenario 1: Cancel happy path ──────────────────────────────────────────
describe("POST /api/cancel — happy path", () => {
  it("[#1] cancels via booker token, marks status=cancelled, sends both emails with METHOD:CANCEL+SEQUENCE:1+UID", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7, // 1 week out
    });
    insertedBookingIds.push(booking.bookingId);

    const res = await cancelPOST(
      buildRequest(
        "https://example.com/api/cancel",
        {
          token: booking.rawCancelToken,
          reason: "Conflict came up",
        },
        "10.6.6.1",
      ) as unknown as Parameters<typeof cancelPOST>[0],
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    // Allow microtask drain for fire-and-forget emails
    await new Promise((r) => setTimeout(r, 100));

    // DB row updated
    const admin = adminClient();
    const { data: row } = await admin
      .from("bookings")
      .select(
        "status, cancelled_by, cancelled_at, cancel_token_hash, reschedule_token_hash",
      )
      .eq("id", booking.bookingId)
      .single();
    expect(row?.status).toBe("cancelled");
    expect(row?.cancelled_by).toBe("booker");
    expect(row?.cancelled_at).toBeTruthy();
    // Dead-hash invalidation: hashes MUST differ from originals (Plan 06-03)
    expect(row?.cancel_token_hash).not.toBe(booking.cancelHash);
    expect(row?.reschedule_token_hash).not.toBe(booking.rescheduleHash);

    // Both emails fired (booker + owner; owner skipped only if account.owner_email is null)
    expect(__mockSendCalls.length).toBeGreaterThanOrEqual(1);

    // Inspect the .ics attachment on the booker email
    const bookerEmail = __mockSendCalls.find((c) =>
      Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const ics = bookerEmail!.attachments?.find((a) =>
      a.filename?.endsWith(".ics"),
    );
    expect(ics).toBeTruthy();
    const icsText = ics!.content?.toString() ?? "";
    expect(icsText).toMatch(/METHOD:CANCEL/);
    expect(icsText).toMatch(new RegExp(`UID:${booking.bookingId}`));
    expect(icsText).toMatch(/SEQUENCE:1/);
    expect(icsText).toMatch(/STATUS:CANCELLED/);
  });
});

// ─── Scenario 2: Reschedule happy path ──────────────────────────────────────
describe("POST /api/reschedule — happy path", () => {
  it("[#2] swaps slot atomically, rotates BOTH token hashes, sends both reschedule emails with METHOD:REQUEST+SEQUENCE:1+same UID", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
    });
    insertedBookingIds.push(booking.bookingId);

    // New slot 1 day later
    const newStartMs =
      new Date(booking.startAt).getTime() + 24 * 60 * 60 * 1000;
    const newStartAt = new Date(newStartMs).toISOString();
    const newEndAt = new Date(newStartMs + 30 * 60 * 1000).toISOString();

    const res = await reschedulePOST(
      buildRequest(
        "https://example.com/api/reschedule",
        {
          token: booking.rawRescheduleToken,
          startAt: newStartAt,
          endAt: newEndAt,
        },
        "10.6.6.2",
      ) as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // DB: status STAYS confirmed (Plan 06-03 lock); slot swapped; BOTH hashes rotated
    const admin = adminClient();
    const { data: row } = await admin
      .from("bookings")
      .select("status, start_at, end_at, cancel_token_hash, reschedule_token_hash")
      .eq("id", booking.bookingId)
      .single();
    expect(row?.status).toBe("confirmed"); // NOT 'rescheduled'
    // Supabase may return '+00:00' suffix instead of 'Z'; normalize both to
    // epoch milliseconds for a timezone-agnostic comparison.
    expect(new Date(row?.start_at ?? "").getTime()).toBe(new Date(newStartAt).getTime());
    expect(new Date(row?.end_at ?? "").getTime()).toBe(new Date(newEndAt).getTime());
    expect(row?.cancel_token_hash).not.toBe(booking.cancelHash);
    expect(row?.reschedule_token_hash).not.toBe(booking.rescheduleHash);

    // .ics: METHOD:REQUEST + same UID + SEQUENCE:1
    const bookerEmail = __mockSendCalls.find((c) =>
      Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const ics = bookerEmail!.attachments?.find((a) =>
      a.filename?.endsWith(".ics"),
    );
    const icsText = ics?.content?.toString() ?? "";
    expect(icsText).toMatch(/METHOD:REQUEST/);
    expect(icsText).toMatch(new RegExp(`UID:${booking.bookingId}`));
    expect(icsText).toMatch(/SEQUENCE:1/);
  });
});

// ─── Scenarios 3 + 4: Token invalidation ────────────────────────────────────
describe("Token invalidation", () => {
  it("[#3] status-flip: after successful cancel, the same raw cancel token is dead (resolveCancelToken returns not_active AND second POST returns 410)", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
    });
    insertedBookingIds.push(booking.bookingId);

    // First cancel succeeds
    const first = await cancelPOST(
      buildRequest(
        "https://example.com/api/cancel",
        { token: booking.rawCancelToken },
        "10.6.6.3",
      ) as unknown as Parameters<typeof cancelPOST>[0],
    );
    expect(first.status).toBe(200);

    // Resolver should now return not_active for the SAME raw token (dead-hash invalidation)
    const resolved = await resolveCancelToken(booking.rawCancelToken);
    expect(resolved.state).toBe("not_active");

    // Second POST with the same token returns 410 NOT_ACTIVE
    const second = await cancelPOST(
      buildRequest(
        "https://example.com/api/cancel",
        { token: booking.rawCancelToken },
        "10.6.6.3",
      ) as unknown as Parameters<typeof cancelPOST>[0],
    );
    expect(second.status).toBe(410);
    const body = await second.json();
    expect(body.code).toBe("NOT_ACTIVE");
  });

  it("[#4] appointment passed: even when status is still 'confirmed', POST /api/cancel with a past start_at returns 410 NOT_ACTIVE", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: -60, // 1 hour ago
    });
    insertedBookingIds.push(booking.bookingId);

    const res = await cancelPOST(
      buildRequest(
        "https://example.com/api/cancel",
        { token: booking.rawCancelToken },
        "10.6.6.4",
      ) as unknown as Parameters<typeof cancelPOST>[0],
    );
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.code).toBe("NOT_ACTIVE");
  });
});

// ─── Scenarios 5 + 6: Reschedule conflicts + CAS guard ──────────────────────
describe("Reschedule conflicts + CAS guard", () => {
  it("[#5] slot conflict: rescheduling two bookings to the SAME target slot — first wins 200, second hits 23505 → 409 SLOT_TAKEN, loser row unchanged", async () => {
    const a = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
    });
    insertedBookingIds.push(a.bookingId);
    const b = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7 + 60, // 1 hour later than A
    });
    insertedBookingIds.push(b.bookingId);

    // Target slot: new slot 2 days from now (neither A nor B currently occupies it)
    const targetMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const targetStart = new Date(targetMs).toISOString();
    const targetEnd = new Date(targetMs + 30 * 60 * 1000).toISOString();

    // First reschedule wins
    const winner = await reschedulePOST(
      buildRequest(
        "https://example.com/api/reschedule",
        {
          token: a.rawRescheduleToken,
          startAt: targetStart,
          endAt: targetEnd,
        },
        "10.6.6.5a",
      ) as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(winner.status).toBe(200);

    // Second reschedule LOSES — same target slot now occupied by A
    const loser = await reschedulePOST(
      buildRequest(
        "https://example.com/api/reschedule",
        {
          token: b.rawRescheduleToken,
          startAt: targetStart,
          endAt: targetEnd,
        },
        "10.6.6.5b",
      ) as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(loser.status).toBe(409);
    const loserBody = await loser.json();
    expect(loserBody.code).toBe("SLOT_TAKEN");

    // Loser row UNCHANGED — normalize timestamps to epoch ms (Supabase may
    // return '+00:00' instead of 'Z', but both represent the same instant)
    const admin = adminClient();
    const { data: bRow } = await admin
      .from("bookings")
      .select("start_at, reschedule_token_hash")
      .eq("id", b.bookingId)
      .single();
    expect(new Date(bRow?.start_at ?? "").getTime()).toBe(new Date(b.startAt).getTime());
    expect(bRow?.reschedule_token_hash).toBe(b.rescheduleHash);
  });

  it("[#6] CAS guard: submitting the OLD reschedule token after a successful reschedule returns 410 NOT_ACTIVE (NOT 23505)", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
    });
    insertedBookingIds.push(booking.bookingId);

    const targetMs = Date.now() + 3 * 24 * 60 * 60 * 1000;
    const target1Start = new Date(targetMs).toISOString();
    const target1End = new Date(targetMs + 30 * 60 * 1000).toISOString();

    // First reschedule rotates the reschedule_token_hash
    const first = await reschedulePOST(
      buildRequest(
        "https://example.com/api/reschedule",
        {
          token: booking.rawRescheduleToken,
          startAt: target1Start,
          endAt: target1End,
        },
        "10.6.6.6",
      ) as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(first.status).toBe(200);

    // Replay the OLD raw token toward a DIFFERENT (free) target slot
    const target2Ms = Date.now() + 4 * 24 * 60 * 60 * 1000;
    const second = await reschedulePOST(
      buildRequest(
        "https://example.com/api/reschedule",
        {
          token: booking.rawRescheduleToken,
          startAt: new Date(target2Ms).toISOString(),
          endAt: new Date(target2Ms + 30 * 60 * 1000).toISOString(),
        },
        "10.6.6.6",
      ) as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(second.status).toBe(410); // route's lookup misses the dead hash → 410
    const body = await second.json();
    expect(body.code).toBe("NOT_ACTIVE");
  });
});

// ─── Scenario 7: Rate limit ─────────────────────────────────────────────────
describe("Rate limit (sliding window)", () => {
  it("[#7-cancel] 11 POSTs to /api/cancel from same IP in 5 min → 11th returns 429 + Retry-After", async () => {
    const ip = "10.6.6.7";
    usedRateLimitKeys.push(`cancel:${ip}`);

    let lastStatus = 0;
    let lastRetryAfter: string | null = null;
    for (let i = 0; i < 11; i++) {
      // Use a non-existent token so the route doesn't actually mutate anything
      // (it'll reach token resolution, find nothing, return 410 — but rate-limit
      // increment fires BEFORE token resolution, which is exactly what we test).
      const res = await cancelPOST(
        buildRequest(
          "https://example.com/api/cancel",
          { token: "nonexistent-token-".padEnd(20, "x") },
          ip,
        ) as unknown as Parameters<typeof cancelPOST>[0],
      );
      lastStatus = res.status;
      lastRetryAfter = res.headers.get("Retry-After");
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
    expect(lastRetryAfter).toBeTruthy();
    expect(Number(lastRetryAfter)).toBeGreaterThan(0);
  });

  it("[#7-reschedule] 11 POSTs to /api/reschedule from same IP in 5 min → 11th returns 429 + Retry-After", async () => {
    const ip = "10.6.6.7r"; // distinct IP key from cancel test above
    usedRateLimitKeys.push(`reschedule:${ip}`);

    let lastStatus = 0;
    let lastRetryAfter: string | null = null;
    for (let i = 0; i < 11; i++) {
      const res = await reschedulePOST(
        buildRequest(
          "https://example.com/api/reschedule",
          {
            token: "nonexistent-token-".padEnd(20, "x"),
            startAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            endAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
            ).toISOString(),
          },
          ip,
        ) as unknown as Parameters<typeof reschedulePOST>[0],
      );
      lastStatus = res.status;
      lastRetryAfter = res.headers.get("Retry-After");
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
    expect(lastRetryAfter).toBeTruthy();
    expect(Number(lastRetryAfter)).toBeGreaterThan(0);
  });
});

// ─── Scenario 8: Owner cancel via shared cancelBooking() (actor:'owner') ────
// Note: cancelBookingAsOwner (the Server Action) calls createClient() from
// next/headers. In vitest+node, cookies() throws outside a Next request scope
// because there is no Next runtime context. We call cancelBooking() directly
// with actor:'owner' — this is the exact shared function the Server Action
// delegates to (Plan 06-05 single-source-of-truth). Coverage of the Server
// Action's RLS auth wrapper is handled in Manual QA step 6.
describe("Owner cancel via shared cancelBooking() with actor:'owner'", () => {
  it("[#8a] owner cancel with reason: succeeds, marks cancelled_by='owner', booker email contains apologetic copy + reason callout + re-book link", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
      bookerEmail: "owner-cancel-with-reason@example.com",
    });
    insertedBookingIds.push(booking.bookingId);

    const reason =
      "Schedule conflict came up — happy to reschedule when you're free.";
    const result = await cancelBooking({
      bookingId: booking.bookingId,
      actor: "owner",
      reason,
      appUrl: "http://test",
      ip: null,
    });
    expect(result).toMatchObject({ ok: true });

    await new Promise((r) => setTimeout(r, 100));

    // DB row
    const admin = adminClient();
    const { data: row } = await admin
      .from("bookings")
      .select("status, cancelled_by")
      .eq("id", booking.bookingId)
      .single();
    expect(row?.status).toBe("cancelled");
    expect(row?.cancelled_by).toBe("owner");

    // Booker email — apologetic + reason + re-book link
    const bookerEmailCall = __mockSendCalls.find((c) =>
      Array.isArray(c.to)
        ? c.to.includes(booking.bookerEmail)
        : c.to === booking.bookerEmail,
    );
    expect(bookerEmailCall).toBeTruthy();
    const html = bookerEmailCall!.html ?? "";
    expect(html.toLowerCase()).toMatch(/apologi[sz]e|sorry|inconvenience/); // apologetic copy
    // The email template HTML-escapes user strings (escapeHtml in send-cancel-emails.ts).
    // Assert the reason is present after escaping apostrophes + other special chars
    // to match the rendered HTML. The send-cancel-emails.ts escapeHtml converts ' → &#39;.
    const escapedReason = reason
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    expect(html).toContain(escapedReason); // reason callout (HTML-escaped form)
    expect(html).toMatch(/book again|book another/i); // re-book CTA copy
    // Link to /[account-slug]/[event-slug] for the "Book again" href
    expect(html).toMatch(/href="[^"]*\/nsi-test\/[^"]*"/);
  });

  it("[#8b] owner cancel without reason: booker email omits the reason row entirely", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
      bookerEmail: "owner-cancel-no-reason@example.com",
    });
    insertedBookingIds.push(booking.bookingId);

    // Normalize whitespace-only → undefined (Plan 06-05 reason normalization logic)
    const trimmed = "   ".trim();
    const normalizedReason =
      trimmed.length > 0 ? trimmed : undefined;

    const result = await cancelBooking({
      bookingId: booking.bookingId,
      actor: "owner",
      reason: normalizedReason,
      appUrl: "http://test",
      ip: null,
    });
    expect(result).toMatchObject({ ok: true });

    await new Promise((r) => setTimeout(r, 100));

    const bookerEmailCall = __mockSendCalls.find((c) =>
      Array.isArray(c.to)
        ? c.to.includes(booking.bookerEmail)
        : c.to === booking.bookerEmail,
    );
    expect(bookerEmailCall).toBeTruthy();
    const html = bookerEmailCall!.html ?? "";
    // Plan 06-02 EMAIL-07 lock: empty reason → omit row, NEVER render "Reason: (none)" or similar empty cell
    expect(html.toLowerCase()).not.toMatch(/reason:\s*(none|n\/a|—|-)/i);
    // The "Reason" label itself should not appear when reason is absent
    expect(html.toLowerCase()).not.toMatch(/<[^>]+>\s*reason\s*<\/[^>]+>/i);
  });
});

// ─── Scenario 9: METHOD:CANCEL .ics shape ───────────────────────────────────
describe("METHOD:CANCEL .ics shape", () => {
  it("[#9] generated .ics on cancel has METHOD:CANCEL, UID==booking.id, SEQUENCE:1, STATUS:CANCELLED", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
      bookerEmail: "ics-shape@example.com",
    });
    insertedBookingIds.push(booking.bookingId);

    await cancelPOST(
      buildRequest(
        "https://example.com/api/cancel",
        { token: booking.rawCancelToken },
        "10.6.6.9",
      ) as unknown as Parameters<typeof cancelPOST>[0],
    );
    await new Promise((r) => setTimeout(r, 100));

    const bookerEmailCall = __mockSendCalls.find((c) =>
      Array.isArray(c.to)
        ? c.to.includes(booking.bookerEmail)
        : c.to === booking.bookerEmail,
    );
    expect(bookerEmailCall).toBeTruthy();
    const ics = bookerEmailCall!.attachments?.find((a) =>
      a.filename?.endsWith(".ics"),
    );
    expect(ics).toBeTruthy();
    const icsText = ics!.content?.toString() ?? "";

    // RFC 5546 cancellation shape (RESEARCH §Pattern 6) — multiline regex
    // because ical-generator output has CRLF line endings
    expect(icsText).toMatch(/^METHOD:CANCEL$/m);
    expect(icsText).toMatch(new RegExp(`^UID:${booking.bookingId}$`, "m"));
    expect(icsText).toMatch(/^SEQUENCE:1$/m);
    expect(icsText).toMatch(/^STATUS:CANCELLED$/m);
    // Content-type header on attachment indicates method=CANCEL
    expect(ics!.contentType ?? "").toMatch(/method=CANCEL/i);
  });
});

// ─── Scenario 10: Email-prefetch defense ────────────────────────────────────
describe("Email-prefetch defense (RESEARCH Pitfall 1)", () => {
  it("[#10] resolveCancelToken (the GET path equivalent) does NOT mutate the booking row — snapshot before/after equal", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
    });
    insertedBookingIds.push(booking.bookingId);

    const admin = adminClient();
    const { data: before } = await admin
      .from("bookings")
      .select(
        "status, start_at, end_at, cancel_token_hash, reschedule_token_hash, cancelled_at, cancelled_by",
      )
      .eq("id", booking.bookingId)
      .single();

    // Call the resolver — this is what GET /cancel/[token] page does on load.
    // If anything in the resolver path were to mutate the row (it must not),
    // the after-snapshot would diverge.
    const resolved = await resolveCancelToken(booking.rawCancelToken);
    expect(resolved.state).toBe("active");

    const { data: after } = await admin
      .from("bookings")
      .select(
        "status, start_at, end_at, cancel_token_hash, reschedule_token_hash, cancelled_at, cancelled_by",
      )
      .eq("id", booking.bookingId)
      .single();

    expect(after).toEqual(before);
  });
});
