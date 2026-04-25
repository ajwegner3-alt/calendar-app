---
phase: 05-public-booking-flow
plan: 08
type: execute
wave: 4
depends_on: ["05-05"]
files_modified:
  - tests/bookings-api.test.ts
  - tests/__mocks__/turnstile.ts
  - tests/__mocks__/email-sender.ts
  - vitest.config.ts
autonomous: true

must_haves:
  truths:
    - "tests/bookings-api.test.ts is a node-env Vitest integration test that imports POST directly from app/api/bookings/route.ts"
    - "Test mocks lib/turnstile.ts so verifyTurnstile() returns true (controllable per-test); avoids external Cloudflare network call in CI"
    - "Test mocks lib/email-sender so sendEmail() is a no-op spy; verifies the route fires emails (call count) without sending real email"
    - "vitest.config.ts updated with resolve.alias entries for the two mocks (path.resolve based, not new URL — Phase 4 STATE.md lock for Windows path safety)"
    - "Coverage cases: (a) happy path 201 with bookingId + redirectTo; (b) 400 on bad JSON; (c) 400 on Zod validation fail (missing bookerEmail); (d) 403 on Turnstile fail (mock returns false); (e) 404 on unknown event_type_id; (f) 409 SLOT_TAKEN race-loser path — second insert with same {event_type_id, start_at} returns 409 + code SLOT_TAKEN; (g) Cache-Control: no-store on success and error responses; (h) raw cancel/reschedule tokens NOT in 201 response body"
    - "Test setup creates a temp event_type on the seeded nsi account; teardown deletes the temp event_type AND any bookings created during the run (uses adminClient for both)"
    - "Race-safe path is a TRUE end-to-end check: first POST succeeds with 201; second POST with identical payload (mocked Turnstile→true) gets 409 SLOT_TAKEN. This proves the partial unique index is wired correctly through the route handler."
    - "After all tests, npm test (full suite) still green — no regressions on Phases 1-4 (45 tests passing baseline; goal: 45 + new bookings cases all green)"
  artifacts:
    - path: "tests/bookings-api.test.ts"
      provides: "Integration test for POST /api/bookings"
      contains: "POST\\|SLOT_TAKEN\\|TURNSTILE"
      min_lines: 200
    - path: "tests/__mocks__/turnstile.ts"
      provides: "Vitest module mock for lib/turnstile.ts"
      contains: "verifyTurnstile"
      exports: ["verifyTurnstile", "__setTurnstileResult"]
      min_lines: 15
    - path: "tests/__mocks__/email-sender.ts"
      provides: "Vitest module mock for lib/email-sender"
      contains: "sendEmail"
      exports: ["sendEmail"]
      min_lines: 15
    - path: "vitest.config.ts"
      provides: "Adds alias entries for the two mocks (existing file modified)"
      contains: "turnstile"
      min_lines: 10
  key_links:
    - from: "tests/bookings-api.test.ts"
      to: "app/api/bookings/route.ts (POST)"
      via: "import { POST } from '@/app/api/bookings/route'"
      pattern: "@/app/api/bookings/route"
    - from: "tests/bookings-api.test.ts"
      to: "lib/turnstile (mocked)"
      via: "vitest.config alias resolve.alias for @/lib/turnstile"
      pattern: "lib/turnstile"
    - from: "tests/bookings-api.test.ts"
      to: "lib/email-sender (mocked)"
      via: "vitest.config alias resolve.alias for @/lib/email-sender"
      pattern: "lib/email-sender"
---

<objective>
Build the integration test suite for `POST /api/bookings`, exercising the route end-to-end against the live Supabase project (Phase 1+ pattern) with mocked Turnstile + email-sender so tests are deterministic and don't burn external API quota.

Purpose: Hard-gate proof for BOOK-05 (race-safe 409), BOOK-07 (Turnstile gate), and EMAIL-01..04 (email-sender invoked correctly without actual sends). Closes Phase 5 verification by demonstrating the wiring is correct end-to-end.

Output: One test file, two mock modules, one vitest config alias addition. After this plan, `npm test` runs the full suite (Phases 1-4 + Plan 05-08) and all pass.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-public-booking-flow/05-CONTEXT.md
@.planning/phases/05-public-booking-flow/05-RESEARCH.md
@.planning/phases/05-public-booking-flow/05-05-SUMMARY.md

# The route under test
@app/api/bookings/route.ts

# Existing test patterns to mirror — especially /api/slots route handler test
@tests/slots-api.test.ts
@tests/race-guard.test.ts
@tests/setup.ts
@tests/helpers/supabase.ts

# Existing vitest config (we add aliases here)
@vitest.config.ts

# Schema reference for valid input shape
@lib/bookings/schema.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Vitest mocks for Turnstile + email-sender + config aliases</name>
  <files>tests/__mocks__/turnstile.ts, tests/__mocks__/email-sender.ts, vitest.config.ts</files>
  <action>
**`tests/__mocks__/turnstile.ts`:**

```typescript
// Vitest mock for @/lib/turnstile.
// Controlled by __setTurnstileResult() so tests can flip pass/fail per case.

let __result = true;

export function __setTurnstileResult(v: boolean) {
  __result = v;
}

export async function verifyTurnstile(_token: string, _ip?: string): Promise<boolean> {
  return __result;
}
```

**`tests/__mocks__/email-sender.ts`:**

```typescript
// Vitest mock for @/lib/email-sender.
// sendEmail() is a no-op spy. Tests can read __mockSendCalls to assert behavior.

import type { EmailInput, EmailResult } from "@/lib/email-sender/types";

export const __mockSendCalls: EmailInput[] = [];

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  __mockSendCalls.push(input);
  return { success: true, messageId: "mock-" + Math.random().toString(36).slice(2) } as EmailResult;
}

export function __resetMockSendCalls() {
  __mockSendCalls.length = 0;
}
```

(If the actual `EmailResult` type from `lib/email-sender/types.ts` requires different fields, adjust the return value to satisfy it. The shape should mirror the vendored type.)

**`vitest.config.ts` patch:**

Add aliases to `resolve.alias` (the file already has the `server-only` alias from Plan 04-06, per STATE.md). Append:

```typescript
import path from "node:path";

// inside resolve.alias:
"@/lib/turnstile": path.resolve(__dirname, "tests/__mocks__/turnstile.ts"),
"@/lib/email-sender": path.resolve(__dirname, "tests/__mocks__/email-sender.ts"),
```

CRITICAL — match Plan 04-06's STATE.md lock: use `path.resolve(__dirname, ...)` not `new URL(import.meta.url).pathname` (the latter encodes spaces as `%20` on Windows and breaks resolution).

Important: aliasing `@/lib/email-sender` (a directory) requires that the route handler imports it as `@/lib/email-sender` (not `@/lib/email-sender/index`) so the alias matches. Confirm Plan 05-03/05-05 use the directory-level import. If they import deeper paths, the alias key may need to be `@/lib/email-sender/index` or `@/lib/email-sender/index.ts` to match.

DO NOT:
- Do NOT add `vi.mock(...)` calls inside the test file. Vitest aliases at config level are simpler and avoid hoisting headaches.
- Do NOT mock the Supabase client. Tests need real DB writes (race-safe insert path is the whole point) — match Phase 1+ pattern of using `adminClient()` against the live test project for setup/teardown.
- Do NOT mock `lib/bookings/schema.ts` — schema validation is part of the contract under test.
- Do NOT introduce new test environments (jsdom etc) — the route handler runs in node env, matches Phase 4 Plan 04-06 lock.
  </action>
  <verify>
```bash
ls "tests/__mocks__/turnstile.ts" "tests/__mocks__/email-sender.ts"

grep -q "verifyTurnstile" "tests/__mocks__/turnstile.ts" && echo "turnstile mock ok"
grep -q "__setTurnstileResult" "tests/__mocks__/turnstile.ts" && echo "controllable mock ok"
grep -q "sendEmail" "tests/__mocks__/email-sender.ts" && echo "email mock ok"
grep -q "__mockSendCalls" "tests/__mocks__/email-sender.ts" && echo "spy capture ok"

# Vitest config aliases
grep -q "tests/__mocks__/turnstile.ts" vitest.config.ts && echo "turnstile alias ok"
grep -q "tests/__mocks__/email-sender.ts" vitest.config.ts && echo "email-sender alias ok"

# Build still works (mocks are .ts so they compile via vitest's transformer; no Next.js build impact)
npm run build
npm run lint
```
  </verify>
  <done>
Two mock files exist. `vitest.config.ts` has aliases for `@/lib/turnstile` and `@/lib/email-sender` mapped to the mocks via `path.resolve(__dirname, ...)`. Build + lint clean. Existing tests still pass — alias only takes effect inside vitest.

Commit: `test(05-08): add Turnstile + email-sender vitest mocks`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: tests/bookings-api.test.ts integration suite</name>
  <files>tests/bookings-api.test.ts</files>
  <action>
```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { adminClient } from "@/tests/helpers/supabase";

import { POST } from "@/app/api/bookings/route";
import { __setTurnstileResult } from "@/lib/turnstile"; // resolved to mock
import { __mockSendCalls, __resetMockSendCalls } from "@/lib/email-sender"; // resolved to mock

/**
 * Integration tests for POST /api/bookings (Phase 5 Plan 05-08).
 *
 * - Real Supabase calls against the live test project (Phase 1+ pattern).
 * - Turnstile + email-sender mocked via vitest.config.ts aliases.
 * - Setup creates a temp event_type on nsi; teardown deletes test event_type
 *   AND any bookings inserted during the run.
 */

let NSI_ACCOUNT_ID = "";
const TEST_SLUG = "phase5-bookings-test";
let testEventTypeId = "";
const insertedBookingIds: string[] = [];

function makeRequest(body: unknown): Request {
  return new Request("https://example.com/api/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}, startMinuteOffset = 0): Record<string, unknown> {
  // Pick a deterministic future time well outside min_notice_hours + max_advance_days.
  // 21 days out at 14:00 UTC. Each test that needs a unique slot offsets minutes.
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 21);
  base.setUTCHours(14, startMinuteOffset, 0, 0);
  const start = base.toISOString();
  const end = new Date(base.getTime() + 30 * 60 * 1000).toISOString();
  return {
    eventTypeId: testEventTypeId,
    startAt: start,
    endAt: end,
    bookerName: "Test Booker",
    bookerEmail: "test@example.com",
    bookerPhone: "555-123-4567",
    bookerTimezone: "America/Chicago",
    answers: {},
    turnstileToken: "any-string-mock-ignores",
    ...overrides,
  };
}

beforeAll(async () => {
  const admin = adminClient();

  const { data: acct, error: acctErr } = await admin
    .from("accounts")
    .select("id")
    .eq("slug", "nsi")
    .single();
  if (acctErr || !acct) throw new Error("nsi account missing — run migrations + seed");
  NSI_ACCOUNT_ID = acct.id;

  const { data: et, error: etErr } = await admin
    .from("event_types")
    .insert({
      account_id: NSI_ACCOUNT_ID,
      slug: TEST_SLUG,
      name: "Phase 5 Bookings Test",
      duration_minutes: 30,
      is_active: true,
    })
    .select("id")
    .single();
  if (etErr || !et) throw etErr ?? new Error("event_type insert failed");
  testEventTypeId = et.id;
});

afterAll(async () => {
  const admin = adminClient();
  if (insertedBookingIds.length) {
    await admin.from("bookings").delete().in("id", insertedBookingIds);
  }
  if (testEventTypeId) {
    await admin.from("event_types").delete().eq("id", testEventTypeId);
  }
});

beforeEach(() => {
  __setTurnstileResult(true);
  __resetMockSendCalls();
});

describe("POST /api/bookings — input validation", () => {
  it("400 on bad JSON body", async () => {
    const req = new Request("https://example.com/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-valid-json",
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("400 on Zod validation fail (missing bookerEmail)", async () => {
    const { bookerEmail: _, ...rest } = validBody();
    const res = await POST(makeRequest(rest) as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
    expect(body.fieldErrors?.bookerEmail).toBeTruthy();
  });

  it("400 on phone shorter than 7 digits", async () => {
    const res = await POST(
      makeRequest(validBody({ bookerPhone: "12345" })) as unknown as Parameters<typeof POST>[0],
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bookings — Turnstile gate", () => {
  it("403 when Turnstile mock returns false", async () => {
    __setTurnstileResult(false);
    const res = await POST(makeRequest(validBody({}, 1)) as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("TURNSTILE");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /api/bookings — event type resolution", () => {
  it("404 when event_type_id is unknown", async () => {
    const res = await POST(
      makeRequest(
        validBody({ eventTypeId: "00000000-0000-0000-0000-000000000000" }, 2),
      ) as unknown as Parameters<typeof POST>[0],
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/bookings — happy path", () => {
  it("201 returns bookingId + redirectTo + fires both emails fire-and-forget", async () => {
    const res = await POST(makeRequest(validBody({}, 3)) as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.bookingId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.redirectTo).toMatch(/^\/nsi\/phase5-bookings-test\/confirmed\/[0-9a-f-]+$/);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    // Track for cleanup.
    insertedBookingIds.push(body.bookingId);

    // No raw tokens in response body.
    expect(JSON.stringify(body)).not.toMatch(/cancel.*token/i);
    expect(JSON.stringify(body)).not.toMatch(/reschedule.*token/i);

    // Allow microtask + setImmediate for fire-and-forget emails to dispatch.
    await new Promise((r) => setTimeout(r, 50));
    // Booker confirmation + owner notification → 2 calls, OR 1 if owner_email is null on nsi.
    expect(__mockSendCalls.length).toBeGreaterThanOrEqual(1);

    // Verify booking row was actually inserted.
    const admin = adminClient();
    const { data: row } = await admin
      .from("bookings")
      .select("id, status, cancel_token_hash, reschedule_token_hash, booker_email")
      .eq("id", body.bookingId)
      .single();
    expect(row).toBeTruthy();
    expect(row?.status).toBe("confirmed");
    expect(row?.cancel_token_hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    expect(row?.reschedule_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.booker_email).toBe("test@example.com");
  });
});

describe("POST /api/bookings — race-safe 409", () => {
  it("second insert with same {event_type_id, start_at} returns 409 SLOT_TAKEN", async () => {
    const body = validBody({}, 4);

    const first = await POST(makeRequest(body) as unknown as Parameters<typeof POST>[0]);
    expect(first.status).toBe(201);
    const firstData = await first.json();
    insertedBookingIds.push(firstData.bookingId);

    // Second submission of identical payload (different booker doesn't matter — the
    // partial unique index keys on (event_type_id, start_at) WHERE status='confirmed').
    const second = await POST(
      makeRequest({ ...body, bookerEmail: "other@example.com" }) as unknown as Parameters<typeof POST>[0],
    );
    expect(second.status).toBe(409);
    const secondData = await second.json();
    expect(secondData.code).toBe("SLOT_TAKEN");
    expect(secondData.error).toMatch(/just booked/i);
    expect(second.headers.get("Cache-Control")).toBe("no-store");
  });
});
```

Key rules:
- Each `validBody()` call increments `startMinuteOffset` so consecutive happy-path/race tests don't collide unintentionally. Tests that need to TRIGGER the unique-index collision pass the same offset twice within the same `it()` block.
- `beforeEach` resets the Turnstile mock to `true` and clears the email spy.
- `afterAll` cleans up all inserted bookings + the test event_type. The tracking array `insertedBookingIds` is appended to inside each test that produces a 201.
- The redirectTo regex assumes account.slug is `nsi` and event_type slug is the test slug `phase5-bookings-test`. Adjust if Plan 05-05 chose a different format.
- The race-safe test's second POST is a TRUE end-to-end check: the partial unique index `bookings_no_double_book` is the gate; the route handler converts Postgres 23505 into a 409 with `code: "SLOT_TAKEN"`.

DO NOT:
- Do NOT mock Supabase. Real DB writes are required to exercise the partial unique index.
- Do NOT spin up a Next dev server — direct route-handler import is the locked Phase 4 pattern.
- Do NOT assert exact email body content in this plan — that's a unit-test concern. Assert call count + at least the `to` field match the booker email.
- Do NOT skip cleanup. Test failures must not leave orphan bookings in the test project (would skew Phase 5 verification + Phase 6 testing).
- Do NOT use `validBody({})` without the offset arg in the race-safe test or any test that 201s — collisions across describe blocks would cause false 409s. Always increment offset.
- Do NOT assert exact value of `__mockSendCalls.length === 2`. If `accounts.owner_email` is null at test time (despite Plan 05-01 seeding it), the owner notification is skipped silently — that's expected behavior. `>=1` covers the spectrum.
  </action>
  <verify>
```bash
ls "tests/bookings-api.test.ts"

# Test environment
head -2 "tests/bookings-api.test.ts" | grep -q "@vitest-environment node" && echo "node env ok"

# Coverage
grep -q "400 on bad JSON" "tests/bookings-api.test.ts" && echo "bad JSON case"
grep -q "400 on Zod validation fail" "tests/bookings-api.test.ts" && echo "validation case"
grep -q "403 when Turnstile mock returns false" "tests/bookings-api.test.ts" && echo "turnstile case"
grep -q "404 when event_type_id is unknown" "tests/bookings-api.test.ts" && echo "404 case"
grep -q "201 returns bookingId" "tests/bookings-api.test.ts" && echo "happy path"
grep -q "race-safe 409" "tests/bookings-api.test.ts" && echo "race case"
grep -q "SLOT_TAKEN" "tests/bookings-api.test.ts" && echo "race code asserted"

# Cleanup
grep -q "afterAll" "tests/bookings-api.test.ts" && grep -q "insertedBookingIds" "tests/bookings-api.test.ts" && echo "cleanup ok"

# Mocks resolved (vitest config aliases set in Task 1)
grep -q "__setTurnstileResult" "tests/bookings-api.test.ts" && echo "turnstile mock controlled"
grep -q "__mockSendCalls" "tests/bookings-api.test.ts" && echo "email spy used"

# Run JUST this test file
npm test -- tests/bookings-api.test.ts

# Run full suite (Phase 1-4 + Plan 05-08): all green
npm test
```
  </verify>
  <done>
`tests/bookings-api.test.ts` exists with `@vitest-environment node` directive. Tests cover: 400 bad JSON, 400 Zod fail, 400 short phone, 403 Turnstile fail, 404 unknown event_type, 201 happy path with bookingId + redirectTo + DB row insertion + emails fired (mocked) + no raw tokens in response, 409 SLOT_TAKEN race-safe via partial unique index. `afterAll` cleans up all inserted bookings + the test event_type. `npm test` exits 0; the previous baseline (45 tests passing) plus new bookings cases all green. No regression on Phase 1-4 suites.

Commit: `test(05-08): add /api/bookings integration test (race-safe 409 + Turnstile + emails)`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
ls "tests/bookings-api.test.ts" "tests/__mocks__/turnstile.ts" "tests/__mocks__/email-sender.ts"
grep -q "tests/__mocks__/turnstile.ts" vitest.config.ts
grep -q "tests/__mocks__/email-sender.ts" vitest.config.ts

npm run build
npm run lint
npm test
```
</verification>

<success_criteria>
- [ ] `tests/__mocks__/turnstile.ts` exports `verifyTurnstile` (mock) + `__setTurnstileResult`
- [ ] `tests/__mocks__/email-sender.ts` exports `sendEmail` (mock) + `__mockSendCalls` spy + `__resetMockSendCalls`
- [ ] `vitest.config.ts` aliases `@/lib/turnstile` and `@/lib/email-sender` via `path.resolve(__dirname, ...)`
- [ ] `tests/bookings-api.test.ts` covers: 400 bad JSON, 400 Zod fail, 400 short phone, 403 Turnstile fail, 404 unknown event_type, 201 happy path (bookingId + redirectTo + DB row + emails fired + no raw tokens), 409 SLOT_TAKEN
- [ ] Race-safe test: first POST 201, second POST identical payload 409 + code SLOT_TAKEN — proves partial unique index wired through route
- [ ] Cleanup: all inserted bookings + the test event_type deleted in afterAll
- [ ] `npm test -- tests/bookings-api.test.ts` exits 0
- [ ] Full `npm test` exits 0 (no regression on Phase 1-4 suites)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/05-public-booking-flow/05-08-SUMMARY.md` documenting:
- Final test count (per describe block)
- Final passing tests baseline (Phase 1-4 + Plan 05-08)
- Mock pattern used (vitest.config.ts aliases, NOT vi.mock)
- The race-safe test approach — first POST + second POST identical payload
- Confirmation: no raw tokens in 201 response body
- Confirmation: emails fire-and-forget (test waits 50ms for microtask)
- Any deviation from RESEARCH §"Code Examples" patterns
</output>
