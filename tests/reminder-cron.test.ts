// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import {
  adminClient,
  getOrCreateTestAccount,
  getOrCreateTestEventType,
} from "@/tests/helpers/supabase";
import { createConfirmedBooking } from "@/tests/helpers/booking-fixtures";

import { GET as cronGET } from "@/app/api/cron/send-reminders/route";
import { __mockSendCalls, __resetMockSendCalls } from "@/lib/email-sender";

/**
 * Plan 08-04 Task 3 Step B — reminder cron integration tests.
 *
 * Real DB writes/reads against the test Supabase project; email-sender
 * mocked via vitest.config.ts alias (Plan 05-08 baseline). Mirrors the
 * setup pattern of cancel-reschedule-api.test.ts.
 *
 * Coverage (8 cases):
 *   1. Auth: no Bearer → 401
 *   2. Auth: wrong Bearer → 401
 *   3. Auth: valid Bearer + empty window → 200 with scanned/claimed counts
 *   4. Scan + claim: in-window booking → reminder_sent_at set, email fired
 *   5. Idempotency: two rapid invocations → only first claims
 *   6. Window boundary: 25h-out booking → not claimed
 *   7. Past booking: start_at < now → not claimed
 *   8. Cancelled booking: status='cancelled' → not claimed
 *   (+ token rotation assertion folded into case 4: cancel/reschedule
 *    hashes differ post-cron from the seeded values.)
 */

const VALID_SECRET =
  process.env.CRON_SECRET ??
  "test-cron-secret-do-not-use-in-prod-7c4f9e2b8a3d1f5e6c0a9b8d7e3f2c1a";

let TEST_ACCOUNT_ID = "";
let TEST_EVENT_TYPE_ID = "";
const insertedBookingIds: string[] = [];

beforeAll(async () => {
  // Ensure CRON_SECRET is set for the route handler (it reads process.env at
  // request time). If the .env.local default leaks through dotenv-loading in
  // setup.ts this is a no-op; otherwise force-set here.
  if (!process.env.CRON_SECRET) {
    process.env.CRON_SECRET = VALID_SECRET;
  }

  TEST_ACCOUNT_ID = await getOrCreateTestAccount();
  TEST_EVENT_TYPE_ID = await getOrCreateTestEventType(TEST_ACCOUNT_ID);
});

afterAll(async () => {
  const admin = adminClient();
  if (insertedBookingIds.length) {
    // booking_events FK on_delete cascade handles audit-row cleanup
    await admin.from("bookings").delete().in("id", insertedBookingIds);
  }
});

beforeEach(() => {
  __resetMockSendCalls();
});

// Suppress expected route logs
const origError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0] ?? "");
    if (msg.includes("[cron/send-reminders]")) {
      return;
    }
    origError(...args);
  };
});
afterAll(() => {
  console.error = origError;
});

/** Build a NextRequest with optional Authorization header. */
function buildCronRequest(authValue?: string): NextRequest {
  const headers: HeadersInit = {};
  if (authValue !== undefined) headers["authorization"] = authValue;
  return new NextRequest("https://example.com/api/cron/send-reminders", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/send-reminders — auth", () => {
  it("[#1] no Bearer header → 401 + Cache-Control: no-store", async () => {
    const res = await cronGET(buildCronRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toMatch(/no-store/);
  });

  it("[#2] wrong Bearer secret → 401", async () => {
    const res = await cronGET(buildCronRequest("Bearer not-the-secret"));
    expect(res.status).toBe(401);
  });

  it("[#3] valid Bearer + no candidates → 200 with scanned/claimed counts", async () => {
    // Don't seed any in-window bookings — just hit the endpoint with valid auth.
    // Other suite seeds may pre-exist if running in parallel, but we only assert
    // on the response shape here, not exact counts.
    const res = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.scanned).toBe("number");
    expect(typeof body.claimed).toBe("number");
  });
});

describe("GET /api/cron/send-reminders — claim + email fire", () => {
  it(
    "[#4] in-window booking is claimed: reminder_sent_at set, email sent, tokens rotated",
    async () => {
      // Seed a confirmed booking 12h out (well within the 24h window)
      const fixture = await createConfirmedBooking({
        accountId: TEST_ACCOUNT_ID,
        eventTypeId: TEST_EVENT_TYPE_ID,
        minutesAhead: 60 * 12,
      });
      insertedBookingIds.push(fixture.bookingId);

      const res = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.claimed).toBeGreaterThanOrEqual(1);

      // Drain after() microtask so the email mock receives the call
      await new Promise((r) => setTimeout(r, 200));

      // DB: reminder_sent_at populated, hashes rotated
      const admin = adminClient();
      const { data: row } = await admin
        .from("bookings")
        .select("reminder_sent_at, cancel_token_hash, reschedule_token_hash, status")
        .eq("id", fixture.bookingId)
        .single();
      expect(row?.reminder_sent_at).toBeTruthy();
      expect(row?.status).toBe("confirmed"); // unchanged — only reminder_sent_at + hashes touched
      expect(row?.cancel_token_hash).not.toBe(fixture.cancelHash); // rotated
      expect(row?.reschedule_token_hash).not.toBe(fixture.rescheduleHash); // rotated

      // Email sent to the booker
      const bookerEmail = __mockSendCalls.find((c) =>
        Array.isArray(c.to) ? c.to.includes(fixture.bookerEmail) : c.to === fixture.bookerEmail,
      );
      expect(bookerEmail).toBeTruthy();
      expect(bookerEmail?.subject).toMatch(/^Reminder: /);

      // booking_events audit row inserted (event_type='reminder_sent', actor='system')
      const { data: events } = await admin
        .from("booking_events")
        .select("event_type, actor, metadata")
        .eq("booking_id", fixture.bookingId)
        .eq("event_type", "reminder_sent");
      expect(events?.length).toBeGreaterThanOrEqual(1);
      expect(events?.[0]?.actor).toBe("system");
    },
    30_000,
  );

  it(
    "[#5] idempotency: two rapid invocations claim the same booking only once",
    async () => {
      const fixture = await createConfirmedBooking({
        accountId: TEST_ACCOUNT_ID,
        eventTypeId: TEST_EVENT_TYPE_ID,
        minutesAhead: 60 * 6,
        bookerEmail: `idem-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      insertedBookingIds.push(fixture.bookingId);

      // First invocation should claim
      const res1 = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      const firstClaimed = body1.claimed as number;
      expect(firstClaimed).toBeGreaterThanOrEqual(1);

      await new Promise((r) => setTimeout(r, 200));

      // Snapshot reminder_sent_at after first claim
      const admin = adminClient();
      const { data: afterFirst } = await admin
        .from("bookings")
        .select("reminder_sent_at, cancel_token_hash")
        .eq("id", fixture.bookingId)
        .single();
      const firstSentAt = afterFirst?.reminder_sent_at;
      const firstCancelHash = afterFirst?.cancel_token_hash;
      expect(firstSentAt).toBeTruthy();

      // Second invocation immediately after — should NOT re-claim THIS booking
      const callsBeforeSecond = __mockSendCalls.length;
      const res2 = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res2.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200));

      // reminder_sent_at unchanged (CAS guard prevented re-claim) AND
      // tokens unchanged (rotation didn't happen on the second tick)
      const { data: afterSecond } = await admin
        .from("bookings")
        .select("reminder_sent_at, cancel_token_hash")
        .eq("id", fixture.bookingId)
        .single();
      expect(afterSecond?.reminder_sent_at).toBe(firstSentAt);
      expect(afterSecond?.cancel_token_hash).toBe(firstCancelHash);

      // No additional email fired for THIS booking on the second tick
      const additionalForThisBooker = __mockSendCalls
        .slice(callsBeforeSecond)
        .filter((c) =>
          Array.isArray(c.to)
            ? c.to.includes(fixture.bookerEmail)
            : c.to === fixture.bookerEmail,
        );
      expect(additionalForThisBooker.length).toBe(0);

      // booking_events audit log: still exactly one 'reminder_sent' row for this booking
      const { data: events } = await admin
        .from("booking_events")
        .select("id")
        .eq("booking_id", fixture.bookingId)
        .eq("event_type", "reminder_sent");
      expect(events?.length).toBe(1);
    },
    30_000,
  );

  it(
    "[#6] window boundary: booking 25h out is NOT claimed",
    async () => {
      const fixture = await createConfirmedBooking({
        accountId: TEST_ACCOUNT_ID,
        eventTypeId: TEST_EVENT_TYPE_ID,
        minutesAhead: 60 * 25, // 1h past the 24h horizon
        bookerEmail: `out-of-window-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      insertedBookingIds.push(fixture.bookingId);

      const res = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200));

      const admin = adminClient();
      const { data: row } = await admin
        .from("bookings")
        .select("reminder_sent_at, cancel_token_hash")
        .eq("id", fixture.bookingId)
        .single();
      expect(row?.reminder_sent_at).toBeNull();
      expect(row?.cancel_token_hash).toBe(fixture.cancelHash); // not rotated

      // No email for this booker
      const sent = __mockSendCalls.find((c) =>
        Array.isArray(c.to) ? c.to.includes(fixture.bookerEmail) : c.to === fixture.bookerEmail,
      );
      expect(sent).toBeUndefined();
    },
    30_000,
  );

  it(
    "[#7] past booking is NOT claimed (start_at < now)",
    async () => {
      const fixture = await createConfirmedBooking({
        accountId: TEST_ACCOUNT_ID,
        eventTypeId: TEST_EVENT_TYPE_ID,
        minutesAhead: -30, // 30 minutes ago
        bookerEmail: `past-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      insertedBookingIds.push(fixture.bookingId);

      const res = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200));

      const admin = adminClient();
      const { data: row } = await admin
        .from("bookings")
        .select("reminder_sent_at")
        .eq("id", fixture.bookingId)
        .single();
      expect(row?.reminder_sent_at).toBeNull();

      const sent = __mockSendCalls.find((c) =>
        Array.isArray(c.to) ? c.to.includes(fixture.bookerEmail) : c.to === fixture.bookerEmail,
      );
      expect(sent).toBeUndefined();
    },
    30_000,
  );

  it(
    "[#8] cancelled booking inside window is NOT claimed",
    async () => {
      const fixture = await createConfirmedBooking({
        accountId: TEST_ACCOUNT_ID,
        eventTypeId: TEST_EVENT_TYPE_ID,
        minutesAhead: 60 * 8,
        bookerEmail: `cancelled-${Math.random().toString(36).slice(2, 8)}@example.com`,
      });
      insertedBookingIds.push(fixture.bookingId);

      // Mark the booking cancelled directly via admin client (bypasses the
      // cancel route — we just need status='cancelled' for the filter test)
      const admin = adminClient();
      await admin
        .from("bookings")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "owner" })
        .eq("id", fixture.bookingId);

      const res = await cronGET(buildCronRequest(`Bearer ${VALID_SECRET}`));
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 200));

      const { data: row } = await admin
        .from("bookings")
        .select("reminder_sent_at")
        .eq("id", fixture.bookingId)
        .single();
      expect(row?.reminder_sent_at).toBeNull();

      const sent = __mockSendCalls.find((c) =>
        Array.isArray(c.to) ? c.to.includes(fixture.bookerEmail) : c.to === fixture.bookerEmail,
      );
      expect(sent).toBeUndefined();
    },
    30_000,
  );
});
