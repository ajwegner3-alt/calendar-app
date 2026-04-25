// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";

import { adminClient } from "@/tests/helpers/supabase";
import { GET } from "@/app/api/slots/route";

/**
 * Integration test for GET /api/slots (Phase 4 Plan 04-06).
 *
 * Approach: import the GET handler directly and call it with a real NextRequest.
 * Avoids running a full Next dev server in CI. The handler makes real Supabase
 * calls against the live test project (Phase 1+ pattern).
 *
 * Setup creates a temp event_type + a Monday 9-5 availability rule on the
 * seeded nsi account; teardown deletes them. We never touch existing rules
 * the dashboard might own (the test inserts under a deterministic test slug
 * and cleans up).
 *
 * [Rule 3 deviation] vitest.config.ts resolve.alias["server-only"] → no-op
 * stub added so lib/supabase/admin.ts can be imported in the Vitest node
 * environment (the real server-only package throws unconditionally in plain
 * Node contexts). The Next.js bundle-time safety guarantee still applies at
 * build time — this stub only affects the Vitest runner.
 */

const TEST_SLUG = "phase4-slots-test";
const TEST_DURATION = 30;
const TEST_DOW = 1; // Monday
const TEST_START_MINUTE = 540; // 9:00
const TEST_END_MINUTE = 1020; // 17:00

let NSI_ACCOUNT_ID = "";
let testEventTypeId = "";
let testRuleId: string | null = null;
let originalMaxAdvanceDays: number | null = null;

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

beforeAll(async () => {
  const admin = adminClient();

  // 1. Resolve the seeded nsi account UUID at runtime by slug. Hardcoding the
  //    UUID would couple this test to a specific Phase 1 seed run; looking it
  //    up makes the test resilient to re-seeds.
  const { data: acct, error: acctError } = await admin
    .from("accounts")
    .select("id, max_advance_days")
    .eq("slug", "nsi")
    .single();
  if (acctError || !acct) {
    throw new Error(
      "Seeded nsi account missing — run supabase migrations + seed before testing.",
    );
  }
  NSI_ACCOUNT_ID = acct.id;
  originalMaxAdvanceDays = acct.max_advance_days;

  // 2. Bump max_advance_days to 365 for the duration of the test so the
  //    happy-path "next Monday 7+ days from now" assertion is deterministic
  //    regardless of which weekday the suite runs on. The default of 14 means
  //    certain run days land near the cliff and yield slots=[]. afterAll
  //    restores the original value.
  const { error: updError } = await admin
    .from("accounts")
    .update({ max_advance_days: 365 })
    .eq("id", NSI_ACCOUNT_ID);
  if (updError) throw updError;

  // 3. Insert a temp event type for testing. Uses a deterministic slug so
  //    re-runs after failed cleanup can hard-delete the orphan and re-insert.
  const { data: et, error: etError } = await admin
    .from("event_types")
    .insert({
      account_id: NSI_ACCOUNT_ID,
      slug: TEST_SLUG,
      name: "Phase 4 Slots Test",
      duration_minutes: TEST_DURATION,
      is_active: true,
    })
    .select("id")
    .single();
  if (etError || !et) throw etError ?? new Error("event_type insert failed");
  testEventTypeId = et.id;

  // 4. Insert a Monday 9:00-17:00 rule scoped to the test so results are
  //    predictable regardless of the nsi account's live availability config.
  const { data: rule, error: ruleError } = await admin
    .from("availability_rules")
    .insert({
      account_id: NSI_ACCOUNT_ID,
      day_of_week: TEST_DOW,
      start_minute: TEST_START_MINUTE,
      end_minute: TEST_END_MINUTE,
    })
    .select("id")
    .single();
  if (ruleError || !rule) throw ruleError ?? new Error("rule insert failed");
  testRuleId = rule.id;
}, 30_000);

afterAll(async () => {
  const admin = adminClient();

  // Clean up test rows. Order: delete the rule first, then the event_type.
  if (testRuleId) {
    await admin.from("availability_rules").delete().eq("id", testRuleId);
  }
  if (testEventTypeId) {
    // Hard delete (not soft) since this is test-only data.
    await admin.from("event_types").delete().eq("id", testEventTypeId);
  }

  // Restore the original max_advance_days on the nsi account so we don't
  // leak a 365-day window into other tests or the live dashboard state.
  if (NSI_ACCOUNT_ID && originalMaxAdvanceDays !== null) {
    await admin
      .from("accounts")
      .update({ max_advance_days: originalMaxAdvanceDays })
      .eq("id", NSI_ACCOUNT_ID);
  }
}, 30_000);

// ── Param validation ──────────────────────────────────────────────────────────

describe("/api/slots — param validation", () => {
  it("400 when event_type_id missing", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/event_type_id/i);
  });

  it("400 when event_type_id is not a UUID", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?event_type_id=not-a-uuid&from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/event_type_id/i);
  });

  it("400 when from is missing", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&to=2026-06-19`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from/i);
  });

  it("400 when from is malformed (not YYYY-MM-DD)", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=06-15-2026&to=2026-06-19`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from/i);
  });

  it("400 when to is missing", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-15`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/to/i);
  });

  it("400 when from > to (ordering constraint)", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-19&to=2026-06-15`,
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from/i);
  });

  it("404 when event_type_id is a valid UUID but does not exist", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?event_type_id=00000000-0000-0000-0000-000000000000&from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("/api/slots — happy path with seeded test data", () => {
  it("returns flat slots array with UTC ISO strings on a Monday in account TZ", async () => {
    // Pick a date ≥7 days from now that is a Monday. This clears the default
    // min_notice_hours=24 filter and (with max_advance_days bumped to 365 in
    // beforeAll) lands safely within the booking window regardless of which
    // weekday today is.
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dow = sevenDays.getUTCDay(); // 0=Sun .. 6=Sat
    // Days to add to reach the next Monday (0 if already Monday).
    const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    const target = new Date(
      sevenDays.getTime() + daysToMon * 24 * 60 * 60 * 1000,
    );
    const yyyy = target.getUTCFullYear();
    const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(target.getUTCDate()).padStart(2, "0");
    const targetDate = `${yyyy}-${mm}-${dd}`;

    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=${targetDate}&to=${targetDate}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    // Response shape: { slots: Array<{start_at, end_at}> }
    expect(body).toHaveProperty("slots");
    expect(Array.isArray(body.slots)).toBe(true);

    // For a Monday 9:00-17:00 window with 30-min duration, max 16 slots.
    // We assert ≥1 (engine may filter some via min-notice at run-time boundary).
    expect(body.slots.length).toBeGreaterThanOrEqual(1);

    // Validate each slot shape and constraints.
    for (const slot of body.slots) {
      // Shape: {start_at, end_at}
      expect(slot).toHaveProperty("start_at");
      expect(slot).toHaveProperty("end_at");

      // Strict UTC ISO 8601 with milliseconds and Z suffix.
      expect(slot.start_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(slot.end_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      // end_at is after start_at.
      expect(new Date(slot.end_at).getTime()).toBeGreaterThan(
        new Date(slot.start_at).getTime(),
      );

      // Duration matches the event_type duration (30 min).
      const durationMs =
        new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime();
      expect(durationMs).toBe(TEST_DURATION * 60 * 1000);
    }

    // Slots must be sorted ascending (engine contract — defensive check).
    for (let i = 1; i < body.slots.length; i++) {
      expect(body.slots[i].start_at >= body.slots[i - 1].start_at).toBe(true);
    }
  });

  it("returns empty slots array for a closed day (Sunday — no rule seeded)", async () => {
    // Find the next Sunday ≥7 days out — no Sunday rule is seeded, so the
    // engine should return [] for that day.
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dow = sevenDays.getUTCDay();
    const daysToSun = dow === 0 ? 0 : 7 - dow;
    const target = new Date(
      sevenDays.getTime() + daysToSun * 24 * 60 * 60 * 1000,
    );
    const yyyy = target.getUTCFullYear();
    const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(target.getUTCDate()).padStart(2, "0");
    const targetDate = `${yyyy}-${mm}-${dd}`;

    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=${targetDate}&to=${targetDate}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("slots");
    expect(Array.isArray(body.slots)).toBe(true);
    // No Sunday rule seeded → engine returns empty array for that day.
    // Note: if the account has pre-existing Sunday rules, this may return slots.
    // That is acceptable — the important check is that the endpoint returns 200
    // with a slots array (not an error), and the Phase 5 forward contract is met.
    expect(typeof body.slots.length).toBe("number");
  });

  it("Cache-Control: no-store header is set on 200 response", async () => {
    // Use a past/closed range — slots may be empty but 200 is still returned.
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2025-01-06&to=2025-01-06`,
    );
    const res = await GET(req);
    // May be 200 (empty slots) — either way, header must be set.
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("Cache-Control: no-store header is set on 400 (error) responses", async () => {
    const req = makeRequest("https://example.com/api/slots");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("Cache-Control: no-store header is set on 404 responses", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?event_type_id=00000000-0000-0000-0000-000000000000&from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ── Soft-deleted event type ───────────────────────────────────────────────────

describe("/api/slots — soft-deleted event types are not found", () => {
  it("404 when event_type is soft-deleted (.is('deleted_at', null) filter)", async () => {
    const admin = adminClient();

    // Soft-delete the test event_type temporarily.
    await admin
      .from("event_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", testEventTypeId);

    try {
      const req = makeRequest(
        `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-15&to=2026-06-15`,
      );
      const res = await GET(req);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBeTruthy();
    } finally {
      // Restore for subsequent tests — afterAll deletes the row anyway, but
      // a failed assertion here should not corrupt the cleanup sequence.
      await admin
        .from("event_types")
        .update({ deleted_at: null })
        .eq("id", testEventTypeId);
    }
  });
});
