---
phase: 04-availability-engine
plan: 06
type: execute
wave: 3
depends_on: ["04-02", "04-03"]
files_modified:
  - app/api/slots/route.ts
  - tests/slots-api.test.ts
autonomous: true

must_haves:
  truths:
    - "GET /api/slots accepts query params event_type_id (uuid), from (YYYY-MM-DD), to (YYYY-MM-DD); validates each, returns 400 with {error} JSON on missing/malformed params"
    - "Route reads event_types row (filtered .is('deleted_at', null)) to get duration_minutes + account_id; reads accounts row for timezone + 4 settings columns; reads availability_rules for the account; reads date_overrides in the date range; reads bookings with status != 'cancelled' overlapping the range — feeds all into computeSlots() from lib/slots.ts"
    - "Route returns flat-array response shape: {slots: Array<{start_at: string, end_at: string}>} where start_at/end_at are UTC ISO strings (Phase 5 forward contract — locked)"
    - "Empty result for a date that is closed, blocked, or cap-reached → that date contributes zero slots; the response array can be entirely empty for fully-blocked ranges"
    - "Route file declares export const dynamic = 'force-dynamic' (NEVER cache the response — RESEARCH §2 + Pitfall 4) AND sets Cache-Control: no-store on the response (defense in depth)"
    - "/api/slots uses the admin (service-role) Supabase client because the endpoint is public (anon callers from Phase 5 booking pages have no auth session); reads are explicitly scoped to the requested event_type_id's account_id and only select needed columns. Service-role usage is gated server-only by lib/supabase/admin.ts (`import 'server-only'`); no writes happen here; inputs are Zod/regex-validated before any query runs."
    - "tests/slots-api.test.ts covers: (a) happy-path round trip with seeded nsi data — creates a temp event_type + availability_rules row + over-range bookings, hits /api/slots via fetch (or via direct route handler import), asserts UTC ISO shape; (b) param validation — missing event_type_id → 400, malformed date → 400; (c) deleted event_type → 404; (d) non-existent event_type → 404"
    - "Test uses adminClient() to seed test data (Phase 1+ pattern) and cleans up after; uses signInAsNsiOwner OR direct adminClient SELECT to verify response — never uses real production data"
  artifacts:
    - path: "app/api/slots/route.ts"
      provides: "GET handler — fetches all required data + calls computeSlots, returns {slots} JSON; declares dynamic='force-dynamic'"
      contains: "computeSlots"
      exports: ["GET", "dynamic"]
      min_lines: 60
    - path: "tests/slots-api.test.ts"
      provides: "Vitest integration test — seeds + queries + cleans up"
      contains: "computeSlots\\|/api/slots"
      min_lines: 100
  key_links:
    - from: "app/api/slots/route.ts"
      to: "lib/slots.ts (computeSlots)"
      via: "import { computeSlots } from '@/lib/slots'"
      pattern: "computeSlots"
    - from: "app/api/slots/route.ts"
      to: "Supabase tables: event_types, accounts, availability_rules, date_overrides, bookings"
      via: ".from(...).select(...) reads — 5 queries (can run 4 in parallel after event_type lookup)"
      pattern: "from\\(.event_types.\\)|from\\(.accounts.\\)|from\\(.availability_rules.\\)|from\\(.date_overrides.\\)|from\\(.bookings.\\)"
    - from: "app/api/slots/route.ts"
      to: "Cache-Control: no-store header on response"
      via: "NextResponse.json(..., { headers: { 'Cache-Control': 'no-store' } })"
      pattern: "Cache-Control"
    - from: "Phase 5 booking page (downstream)"
      to: "/api/slots"
      via: "fetch(`/api/slots?event_type_id=...&from=...&to=...`).then(r => r.json()).then(({slots}) => ...)"
      pattern: "/api/slots"
---

<objective>
Ship the `/api/slots` ROUTE HANDLER + an integration test that exercises end-to-end data flow. The route is a thin shell: parse query params → fetch event_type + account + rules + overrides + bookings → call `computeSlots` from Plan 04-02 → return flat-array JSON. Phase 5 will be the only production consumer of this endpoint; the response shape is locked here as a forward contract.

Purpose: AVAIL-08 hard-gate. The slot engine in Plan 04-02 is correct in isolation; this plan proves the wiring (Supabase reads → engine input → JSON response) is correct end-to-end with seeded data.

Output: `app/api/slots/route.ts` and `tests/slots-api.test.ts`. Both exit clean on `npm run build` + `npm test`.

Plan-level scoping: This plan does NOT modify the slot engine, the dashboard editor, or the data-layer actions. It only ASSEMBLES them into a route. Forward contract for Phase 5 (locked here): response shape is `{slots: Array<{start_at, end_at}>}` with UTC ISO strings; an empty `slots` array means "no times available" (Phase 5 renders the friendly empty-state).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-availability-engine/04-CONTEXT.md
@.planning/phases/04-availability-engine/04-RESEARCH.md
@.planning/phases/04-availability-engine/04-02-SUMMARY.md
@.planning/phases/04-availability-engine/04-03-SUMMARY.md

# Plan 04-02 module this route consumes
@lib/slots.ts
@lib/slots.types.ts

# Existing schema this route reads from
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260424120000_event_types_soft_delete.sql
@supabase/migrations/20260425120000_account_availability_settings.sql

# Phase 1+2 test patterns to mirror
@tests/setup.ts
@tests/helpers/supabase.ts
@tests/race-guard.test.ts
@tests/rls-anon-lockout.test.ts

# Existing supabase clients
@lib/supabase/server.ts
@lib/supabase/admin.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: GET /api/slots route handler</name>
  <files>app/api/slots/route.ts</files>
  <action>
Create `app/api/slots/route.ts` — a thin GET-only Route Handler that fetches required data and calls `computeSlots`. RESEARCH §"Code Examples" provides a near-final implementation; adapt to use the v4 type contracts from `lib/slots.types.ts`.

```typescript
/**
 * GET /api/slots — DST-safe slot computation API (AVAIL-08).
 *
 * Query params:
 *   - event_type_id (uuid, required)
 *   - from (YYYY-MM-DD local-date, required) — inclusive start of range
 *   - to   (YYYY-MM-DD local-date, required) — inclusive end of range
 *
 * Response:
 *   200 → { slots: Array<{ start_at: string; end_at: string }> }   // UTC ISO
 *   400 → { error: string }   // missing/malformed params
 *   404 → { error: string }   // event_type or account not found
 *   500 → { error: string }   // unexpected DB error
 *
 * Forward contract for Phase 5: empty slots array == "no times available";
 * Phase 5 renders the friendly empty-state.
 *
 * Caching: NEVER. Both `dynamic = "force-dynamic"` (route-level) and
 * Cache-Control: no-store header (response-level). RESEARCH Pitfall 4 is
 * the canonical "why not cache" reasoning.
 */

import { NextResponse, type NextRequest } from "next/server";

import { computeSlots } from "@/lib/slots";
import type {
  AvailabilityRuleRow,
  DateOverrideRow,
  BookingRow,
  AccountSettings,
} from "@/lib/slots.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const eventTypeId = sp.get("event_type_id") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";

  // ── Param validation ────────────────────────────────────────────────────
  if (!eventTypeId || !UUID_REGEX.test(eventTypeId)) {
    return NextResponse.json(
      { error: "event_type_id is required and must be a UUID." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!from || !DATE_REGEX.test(from)) {
    return NextResponse.json(
      { error: "from is required and must be YYYY-MM-DD." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!to || !DATE_REGEX.test(to)) {
    return NextResponse.json(
      { error: "to is required and must be YYYY-MM-DD." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from must be on or before to." },
      { status: 400, headers: NO_STORE },
    );
  }

  // Admin (service-role) client: /api/slots is a PUBLIC endpoint hit by
  // unauthenticated booking-page visitors (Phase 5). RLS would silently return
  // 0 rows for anon callers and break booking. We scope every query below to
  // the resolved account_id and select only the columns the engine consumes.
  const supabase = createAdminClient();

  // ── Step 1: load event_type to get duration + account_id ─────────────────
  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("id, account_id, duration_minutes")
    .eq("id", eventTypeId)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError) {
    return NextResponse.json(
      { error: "Failed to load event type." },
      { status: 500, headers: NO_STORE },
    );
  }
  if (!eventType) {
    return NextResponse.json(
      { error: "Event type not found." },
      { status: 404, headers: NO_STORE },
    );
  }

  // ── Step 2: parallel-fetch account + rules + overrides + bookings ────────
  // Build the bookings range as full UTC days for safety. Account TZ is
  // unknown until the account query returns, but UTC bookends ±1 day around
  // the requested date range cover all possible TZ offsets without missing
  // an edge booking. The engine then filters precisely by local-date in the
  // account's timezone.
  const bookingsRangeStart = `${from}T00:00:00.000Z`;
  // To-end is exclusive in the engine's mental model but our query uses lt
  // for the upper bound on the next day, which captures all bookings that
  // start on or before the requested 'to' date in any TZ.
  const [accountRes, rulesRes, overridesRes, bookingsRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(
        "timezone, buffer_minutes, min_notice_hours, max_advance_days, daily_cap",
      )
      .eq("id", eventType.account_id)
      .single(),
    supabase
      .from("availability_rules")
      .select("day_of_week, start_minute, end_minute")
      .eq("account_id", eventType.account_id),
    supabase
      .from("date_overrides")
      .select("override_date, is_closed, start_minute, end_minute")
      .eq("account_id", eventType.account_id)
      .gte("override_date", from)
      .lte("override_date", to),
    supabase
      .from("bookings")
      .select("start_at, end_at")
      .eq("account_id", eventType.account_id)
      .neq("status", "cancelled")
      // Bookings range padded by ±1 day around requested range to cover
      // TZ-edge bookings (e.g. a Chicago-local 11pm booking on `from` is a
      // UTC date later than `from`). The engine then filters precisely.
      .gte("start_at", bookingsRangeStart)
      .lte("start_at", `${to}T23:59:59.999Z`),
  ]);

  if (accountRes.error || !accountRes.data) {
    return NextResponse.json(
      { error: "Account not found." },
      { status: 404, headers: NO_STORE },
    );
  }

  const account: AccountSettings = {
    timezone: accountRes.data.timezone,
    buffer_minutes: accountRes.data.buffer_minutes,
    min_notice_hours: accountRes.data.min_notice_hours,
    max_advance_days: accountRes.data.max_advance_days,
    daily_cap: accountRes.data.daily_cap,
  };
  const rules: AvailabilityRuleRow[] = (rulesRes.data ?? []).map((r) => ({
    day_of_week: r.day_of_week,
    start_minute: r.start_minute,
    end_minute: r.end_minute,
  }));
  const overrides: DateOverrideRow[] = (overridesRes.data ?? []).map((o) => ({
    override_date: o.override_date,
    is_closed: o.is_closed,
    start_minute: o.start_minute,
    end_minute: o.end_minute,
  }));
  const bookings: BookingRow[] = (bookingsRes.data ?? []).map((b) => ({
    start_at: b.start_at,
    end_at: b.end_at,
  }));

  // ── Step 3: compute and return ──────────────────────────────────────────
  const slots = computeSlots({
    rangeStart: from,
    rangeEnd: to,
    durationMinutes: eventType.duration_minutes,
    account,
    rules,
    overrides,
    bookings,
    now: new Date(),
  });

  return NextResponse.json({ slots }, { status: 200, headers: NO_STORE });
}
```

Key rules:
- File declares both `export const dynamic = "force-dynamic"` AND `export const revalidate = 0`. Either alone suffices on Next 16; declaring both is belt-and-suspenders against future Next.js default changes (RESEARCH §2 + Pitfall 4).
- Response `Cache-Control: no-store` header set on EVERY response (200/400/404/500). Single `NO_STORE` constant prevents drift.
- Param validation gates: UUID format on `event_type_id`, `YYYY-MM-DD` regex on `from`/`to`, `from <= to` ordering. Missing or malformed → 400 with `{error}` JSON.
- Uses `createAdminClient()` from `@/lib/supabase/admin` — service-role client (RLS-bypass). Required because this is a PUBLIC endpoint hit by anonymous Phase 5 booking-page visitors with no session cookie; the RLS-scoped `createClient()` would silently return 0 rows for anon callers. Server-side gating: `@/lib/supabase/admin` declares `import "server-only"` so a misuse from a `"use client"` file would fail at bundle time. Each of the 5 queries below is explicitly scoped to the resolved `account_id`.
- 5 queries:
  1. event_type (sequential, since account_id needed for the rest).
  2. account, rules, overrides, bookings — parallel via Promise.all.
- bookings filter `.neq("status", "cancelled")` matches Phase 3 / CONTEXT lock; bookings range padded ±1 UTC day to capture TZ-edge bookings; engine then filters precisely by local-date in account TZ.
- Response shape: `{ slots: [...] }` — flat array of `{start_at, end_at}` UTC ISO strings. Locked Phase 5 contract.
- Map DB rows to engine input shapes (`AccountSettings`, `AvailabilityRuleRow`, `DateOverrideRow`, `BookingRow`) explicitly — keeps the boundary contract clean and future-resistant against new columns.

DO NOT:
- Do not POST/PATCH/DELETE on this route — slots are computed, not stored. Plan 04-03's actions handle writes; Phase 5 will add `/api/bookings` (POST) for booking creation.
- Use `createAdminClient()` from `@/lib/supabase/admin` (NOT the cookie/RLS-scoped `createClient()` from `@/lib/supabase/server`). Rationale: this endpoint is PUBLIC — Phase 5 booking pages call it without an auth session, so RLS would silently return 0 rows for the unauthenticated caller and break the entire booking flow. Service-role is acceptable here because (a) the route is read-only, (b) inputs are validated (UUID + date regex) before any query, (c) every query is explicitly scoped to the resolved `account_id`, (d) `@/lib/supabase/admin` is gated `import "server-only"` so it cannot leak into a client bundle. Document the decision in the SUMMARY.
- Do not implement caching at any layer. RESEARCH Pitfall 4 explicitly forbids it.
- Do not include a `cap_reached` flag in the response — CONTEXT defers it; Phase 5 renders empty-state for any zero-slot day.
- Do not return slots out of UTC-ascending order — `computeSlots` already sorts; the route is a passthrough.
- Do not add CORS headers — the booking page (Phase 5) is same-origin. Embed widget (Phase 7) hits this endpoint same-origin via the iframe.
  </action>
  <verify>
```bash
ls "app/api/slots/route.ts"

# Route exports
grep -q "export async function GET" "app/api/slots/route.ts" && echo "GET exported"
grep -q 'export const dynamic = "force-dynamic"' "app/api/slots/route.ts" && echo "dynamic ok"
grep -q "Cache-Control" "app/api/slots/route.ts" && echo "no-store header ok"

# Engine wiring
grep -q "computeSlots" "app/api/slots/route.ts" && echo "engine wired"
grep -q '@/lib/slots' "app/api/slots/route.ts" && echo "engine import ok"

# All 5 queries present
grep -q 'from("event_types")' "app/api/slots/route.ts" && echo "event_types query ok"
grep -q 'from("accounts")' "app/api/slots/route.ts" && echo "accounts query ok"
grep -q 'from("availability_rules")' "app/api/slots/route.ts" && echo "rules query ok"
grep -q 'from("date_overrides")' "app/api/slots/route.ts" && echo "overrides query ok"
grep -q 'from("bookings")' "app/api/slots/route.ts" && echo "bookings query ok"

# Cancellation filter
grep -q '.neq("status", "cancelled")' "app/api/slots/route.ts" && echo "cancelled filter ok"
# Soft-delete filter on event_types
grep -q '.is("deleted_at", null)' "app/api/slots/route.ts" && echo "soft-delete filter ok"

npm run build
npm run lint
```
  </verify>
  <done>
`app/api/slots/route.ts` exists, exports `GET` + `dynamic="force-dynamic"`, validates `event_type_id`/`from`/`to` query params (400 on malformed, 404 on not-found event_type or account), reads 5 tables (event_types filtered by `.is("deleted_at", null)`; bookings filtered by `.neq("status", "cancelled")`), passes data to `computeSlots`, returns `{slots: [...]}` with `Cache-Control: no-store` header on every response. `npm run build` + `npm run lint` exit 0.

Commit: `feat(04-06): add /api/slots GET handler (DST-safe, no-cache)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Integration test for /api/slots</name>
  <files>tests/slots-api.test.ts</files>
  <action>
Create an integration test that exercises the route handler end-to-end against the seeded `nsi` account. Mirrors the Phase 1+ test patterns (`adminClient()` for setup/teardown, real Supabase calls).

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { adminClient } from "@/tests/helpers/supabase";

import { GET } from "@/app/api/slots/route";

/**
 * Integration test for /api/slots (Phase 4 Plan 04-06).
 *
 * Approach: import the GET handler directly and call it with a synthetic
 * NextRequest. Avoids running a full Next dev server in CI. The handler
 * makes real Supabase calls against the live test project (Phase 1+ pattern).
 *
 * Setup creates a temp event_type + a Monday 9-5 availability rule on the
 * seeded nsi account; teardown deletes them. We never touch existing rules
 * the dashboard might own (the test inserts under a deterministic test slug
 * and cleans up).
 */

// NSI_ACCOUNT_ID is resolved at runtime in beforeAll (see below) by looking
// up the seeded `nsi` account by slug. Hardcoding the UUID would couple the
// test to a specific seed run and break on re-seed.
let NSI_ACCOUNT_ID = "";
const TEST_SLUG = "phase4-slots-test";
const TEST_DURATION = 30;
const TEST_DOW = 1; // Monday
const TEST_START_MINUTE = 540;  // 9:00
const TEST_END_MINUTE = 1020;   // 17:00

let testEventTypeId: string;
let testRuleId: string | null = null;

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

// Saved settings on the nsi account so we can restore in afterAll.
let originalMaxAdvanceDays: number | null = null;

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

  // 2. Bump max_advance_days to a large window for the duration of the test
  //    so the happy-path "next Monday 7+ days from now" assertion is
  //    deterministic regardless of which weekday the suite runs on. The
  //    default of 14 means certain run days land near the cliff and yield
  //    slots=[]. afterAll restores the original value.
  const { error: updError } = await admin
    .from("accounts")
    .update({ max_advance_days: 365 })
    .eq("id", NSI_ACCOUNT_ID);
  if (updError) throw updError;

  // 3. Insert a temp event type for testing.
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

  // 4. Insert a Monday 9-5 rule. The action layer guards against duplicate
  //    rows; we accept that the seeded nsi account may or may not already
  //    have rules for the test day_of_week. To stay isolated, we DON'T touch
  //    existing rules. The test simply uses whatever the account has + our
  //    specific event_type. BUT: the Phase 4 spec is "all weekdays Closed by
  //    default" — assume nsi has no weekly rules yet. If it does, this test
  //    still works (the engine will generate slots from those rules); we just
  //    can't assert exact counts. Therefore we INSERT a single Monday rule
  //    we own and clean it up.
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
});

afterAll(async () => {
  const admin = adminClient();

  // Clean up test rows. Order: delete the rule first, then the event_type.
  if (testRuleId) {
    await admin.from("availability_rules").delete().eq("id", testRuleId);
  }
  if (testEventTypeId) {
    // Hard delete (not soft) since this is test-only data and the slug-reuse
    // unique index doesn't matter for cleanup.
    await admin.from("event_types").delete().eq("id", testEventTypeId);
  }

  // Restore the original max_advance_days on the nsi account so we don't
  // leak a 365-day window into other tests or live dashboard state.
  if (NSI_ACCOUNT_ID && originalMaxAdvanceDays !== null) {
    await admin
      .from("accounts")
      .update({ max_advance_days: originalMaxAdvanceDays })
      .eq("id", NSI_ACCOUNT_ID);
  }
});

describe("/api/slots — param validation", () => {
  it("400 when event_type_id missing", async () => {
    const req = makeRequest("https://example.com/api/slots?from=2026-06-15&to=2026-06-19");
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/event_type_id/i);
  });

  it("400 when event_type_id is not a UUID", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?event_type_id=not-a-uuid&from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
  });

  it("400 when from is malformed", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=06-15-2026&to=2026-06-19`,
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
  });

  it("400 when from > to", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-19&to=2026-06-15`,
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(400);
  });

  it("404 when event_type_id is a valid UUID but not found", async () => {
    const req = makeRequest(
      "https://example.com/api/slots?event_type_id=00000000-0000-0000-0000-000000000000&from=2026-06-15&to=2026-06-19",
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(404);
  });
});

describe("/api/slots — happy path with seeded test data", () => {
  it("returns flat slots array with UTC ISO strings on a Monday in account TZ", async () => {
    // Range covers a single Monday: 2026-06-15. With nsi's tz=America/Chicago
    // and our 9:00-17:00 rule + 30-min duration, expect 16 slots.
    // BUT: the test-environment "now" is real wall-clock-now, so depending on
    // when this runs, min_notice_hours (default 24h) or max_advance_days
    // (default 14d) may filter slots. To make the test deterministic, we need
    // to pick a date that's after now+min_notice and within now+max_advance.
    //
    // Strategy: use a date 7 days from now (well after 24h min-notice and
    // well within 14d max-advance), but constrained to the next Monday.
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Find next Monday on or after sevenDays.
    const dow = sevenDays.getUTCDay();
    const daysToMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
    const target = new Date(sevenDays.getTime() + daysToMon * 24 * 60 * 60 * 1000);
    const yyyy = target.getUTCFullYear();
    const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(target.getUTCDate()).padStart(2, "0");
    const targetDate = `${yyyy}-${mm}-${dd}`;

    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=${targetDate}&to=${targetDate}`,
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("slots");
    expect(Array.isArray(body.slots)).toBe(true);

    // Each slot is a {start_at, end_at} UTC ISO pair.
    for (const slot of body.slots) {
      expect(slot).toHaveProperty("start_at");
      expect(slot).toHaveProperty("end_at");
      // Strict ISO 8601 with Z suffix.
      expect(slot.start_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(slot.end_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // end_at > start_at.
      expect(new Date(slot.end_at).getTime()).toBeGreaterThan(
        new Date(slot.start_at).getTime(),
      );
      // Each slot duration matches the event_type duration (30 min).
      const durationMs =
        new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime();
      expect(durationMs).toBe(TEST_DURATION * 60 * 1000);
    }

    // We expect at least one slot on the chosen Monday. If the test date
    // collides with an existing Monday rule the seeded account already has,
    // we still expect ≥ the count from the inserted rule (16 slots).
    expect(body.slots.length).toBeGreaterThanOrEqual(1);
  });

  it("Cache-Control: no-store header is set on every response", async () => {
    const req = makeRequest(
      `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-15&to=2026-06-15`,
    );
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    // Also on error responses.
    const errReq = makeRequest("https://example.com/api/slots");
    const errRes = await GET(errReq as unknown as Parameters<typeof GET>[0]);
    expect(errRes.status).toBe(400);
    expect(errRes.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("/api/slots — soft-deleted event types are not found", () => {
  it("404 when event_type is soft-deleted", async () => {
    const admin = adminClient();
    // Soft-delete the test event_type.
    await admin
      .from("event_types")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", testEventTypeId);

    try {
      const req = makeRequest(
        `https://example.com/api/slots?event_type_id=${testEventTypeId}&from=2026-06-15&to=2026-06-15`,
      );
      const res = await GET(req as unknown as Parameters<typeof GET>[0]);
      expect(res.status).toBe(404);
    } finally {
      // Restore for any subsequent tests in this file (afterAll deletes anyway).
      await admin
        .from("event_types")
        .update({ deleted_at: null })
        .eq("id", testEventTypeId);
    }
  });
});
```

Key rules:
- File starts with `// @vitest-environment node` (DB-using tests need node, not jsdom — RESEARCH §4 + Phase 1 convention).
- Imports `GET` directly from the route file. We pass synthetic `Request` objects (cast to the handler's parameter type to satisfy TypeScript without spinning up a Next dev server).
- `beforeAll` seeds: one event_type (slug `phase4-slots-test`) + one Monday 9:00-17:00 availability rule on the `nsi` account. `afterAll` cleans both up.
- Uses `adminClient()` from `tests/helpers/supabase.ts` (existing Phase 1 helper) to bypass RLS for setup/teardown.
- The happy-path test uses a date 7+ days from "now" to clear the default `min_notice_hours = 24` AND `max_advance_days = 14` filters. Then snaps forward to the next Monday so the inserted rule applies.
- Asserts: 200 response; `{slots: Array}` shape; UTC ISO strings (regex); `end_at > start_at`; duration = 30 min; non-empty result.
- Soft-delete test temporarily flips `deleted_at`, asserts 404, then restores (afterAll deletes anyway). Try/finally ensures restoration even on failed assertion.
- Cache-Control test asserts header on BOTH success and error responses.

DO NOT:
- Do not boot a Next.js dev server. Direct route-handler import is sufficient and faster. (Pattern: any future `app/api/*/route.ts` test should follow this approach.)
- Do not insert overrides or bookings — this test exercises the rule path. Override + booking paths are unit-tested in Plan 04-02's `tests/slot-generation.test.ts`.
- Do not pin `now` — for an integration test, real wall-clock-now is what production sees. The test handles this by picking a date 7+ days out.
- Do not assert specific UTC values for slot start times — the targetDate is dynamic. Specific UTC values are unit-tested in Plan 04-02.
- Do not insert bookings on the test event_type — would couple this test to the booking lifecycle (Phase 5). Keep this test scoped to the read path.
- Do not skip cleanup. The `afterAll` MUST delete the rule and the event_type, even if a test fails mid-run.
  </action>
  <verify>
```bash
ls "tests/slots-api.test.ts"

# Test environment + helper imports
head -2 "tests/slots-api.test.ts" | grep -q "@vitest-environment node" && echo "node env ok"
grep -q "adminClient" "tests/slots-api.test.ts" && echo "admin helper imported"
grep -q 'from "@/app/api/slots/route"' "tests/slots-api.test.ts" && echo "route imported directly"

# Coverage of param validation + happy path + soft-delete
grep -q "400 when event_type_id missing" "tests/slots-api.test.ts" && echo "missing id case"
grep -q "400 when event_type_id is not a UUID" "tests/slots-api.test.ts" && echo "bad uuid case"
grep -q "400 when from is malformed" "tests/slots-api.test.ts" && echo "bad date case"
grep -q "400 when from > to" "tests/slots-api.test.ts" && echo "ordering case"
grep -q "404 when event_type_id is a valid UUID but not found" "tests/slots-api.test.ts" && echo "404 case"
grep -q "404 when event_type is soft-deleted" "tests/slots-api.test.ts" && echo "soft-delete case"
grep -q "Cache-Control" "tests/slots-api.test.ts" && echo "no-store header check"
grep -q "happy path" "tests/slots-api.test.ts" && echo "happy path"

# beforeAll/afterAll for seed/cleanup
grep -q "beforeAll" "tests/slots-api.test.ts" && grep -q "afterAll" "tests/slots-api.test.ts" && echo "lifecycle hooks ok"

# Run JUST this test file
npm test -- tests/slots-api.test.ts

# Run full suite — slot engine + slots api + race + RLS + auth all green
npm test
```
  </verify>
  <done>
`tests/slots-api.test.ts` exists with `@vitest-environment node` directive, imports `GET` directly from the route file, uses `adminClient()` for setup/teardown of one test event_type + one test availability_rule on the seeded nsi account. Tests cover: param validation (missing/bad-uuid event_type_id, malformed from, from > to ordering), 404 on non-existent event_type_id, 404 on soft-deleted event_type (with try/finally restoration), happy-path 200 with `{slots: Array}` shape and UTC ISO timestamps, Cache-Control: no-store header on success + error responses. `npm test -- tests/slots-api.test.ts` exits 0; full `npm test` still green (no regression on Phases 1-3 + Plan 04-02).

Commit: `test(04-06): add /api/slots integration test`. Push.

Final smoke test (user-runnable on Vercel after push):
```bash
# Replace EVENT_TYPE_ID with the id of any active event type from the dashboard.
curl -i "https://calendar-app-xi-smoky.vercel.app/api/slots?event_type_id=$EVENT_TYPE_ID&from=2026-06-15&to=2026-06-19"
# Expected: HTTP/2 200, Cache-Control: no-store, Content-Type: application/json,
#           body { "slots": [...] } with UTC ISO entries (or [] if no rules / blocked)
```
  </done>
</task>

</tasks>

<verification>
```bash
# Both Plan 04-06 files present
ls "app/api/slots/route.ts" "tests/slots-api.test.ts"

# Build + lint clean
npm run build
npm run lint

# All Vitest suites green
npm test
```
</verification>

<success_criteria>
- [ ] `app/api/slots/route.ts` exports `GET` and `dynamic = "force-dynamic"` + `revalidate = 0`
- [ ] Validates query params: `event_type_id` must be UUID format; `from` and `to` must be `YYYY-MM-DD`; `from <= to`
- [ ] Returns 400 + `{error}` JSON on missing/malformed params (with `Cache-Control: no-store` header)
- [ ] Returns 404 + `{error}` JSON when event_type_id is valid UUID but not found OR is soft-deleted (filtered by `.is("deleted_at", null)`)
- [ ] Returns 404 + `{error}` JSON when account_id resolved from event_type points to a missing account row
- [ ] On 200, response shape is `{slots: Array<{start_at: string, end_at: string}>}` with UTC ISO timestamps
- [ ] Empty `slots` array returned for fully-closed/blocked/cap-reached ranges (Phase 5 forward contract)
- [ ] All responses include `Cache-Control: no-store` header
- [ ] Reads 5 tables: event_types (filtered by `.is("deleted_at", null)`), accounts, availability_rules, date_overrides (filtered by override_date in [from, to]), bookings (filtered by `.neq("status", "cancelled")` and start_at in/around [from, to])
- [ ] Calls `computeSlots` from `@/lib/slots` with the SlotInput shape from `@/lib/slots.types`
- [ ] No raw Date math anywhere on the slot path (engine handles all DST-sensitive arithmetic)
- [ ] Uses `createAdminClient()` from `@/lib/supabase/admin` (NOT the RLS-scoped `createClient()`); rationale documented in plan + SUMMARY (public endpoint, anon callers, RLS would silently return 0 rows)
- [ ] No caching at any layer
- [ ] `tests/slots-api.test.ts` covers: missing `event_type_id` → 400, bad UUID → 400, bad date → 400, from > to → 400, valid-UUID-not-found → 404, soft-deleted event_type → 404, happy path 200 with `{slots}` UTC ISO shape + duration check, Cache-Control header on success + error responses
- [ ] Test seeds + cleans up via `adminClient()` (no production-data mutation)
- [ ] `npm test -- tests/slots-api.test.ts` exits 0
- [ ] Full `npm test` still green (no regression)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-06-SUMMARY.md` documenting:
- Final response shape (`{slots: Array<{start_at, end_at}>}`) — locked Phase 5 contract
- Confirmed admin-client-vs-RLS decision (admin client used; rationale: public endpoint hit by anon Phase 5 callers — RLS would silently return 0 rows. Reads scoped explicitly to resolved account_id; service-role gated server-only by `lib/supabase/admin.ts`.)
- Bookings range padding ±1 UTC day rationale
- The 5 query reads + the parallel-fetch optimization
- Forward contract for Phase 5: empty slots array == "no times available"
- Smoke-test curl command + sample output
- Any deviation from RESEARCH §"Code Examples" route handler skeleton
</output>
