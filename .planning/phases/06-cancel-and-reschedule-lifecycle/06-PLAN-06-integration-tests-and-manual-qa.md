---
phase: 06-cancel-and-reschedule-lifecycle
plan: 06
type: execute
wave: 5
depends_on: ["06-04", "06-05"]
files_modified:
  - tests/cancel-reschedule-api.test.ts
  - tests/helpers/booking-fixtures.ts
autonomous: false
user_setup: []

must_haves:
  truths:
    - "(LOCKED — Andrew CLAUDE.md) All testing is done LIVE — tests run against the real Supabase test project (NOT mocked DB). Mirrors the Phase 5 Plan 05-08 pattern of real Supabase + mocked Turnstile + mocked email-sender via vitest.config.ts aliases."
    - "tests/cancel-reschedule-api.test.ts is a `@vitest-environment node` integration test that imports POST handlers DIRECTLY from app/api/cancel/route.ts and app/api/reschedule/route.ts (Phase 5 Plan 05-08 lock — no spinning up Next dev server)"
    - "Tests also import the OWNER Server Action `cancelBookingAsOwner` from app/(shell)/app/bookings/[id]/_lib/actions.ts directly (verifies the OWNER cancel path uses the same shared cancelBooking() function — single-source-of-truth proof)"
    - "Tests use the EXISTING vitest.config.ts aliases (Plan 05-08): @/lib/turnstile and @/lib/email-sender already resolve to the shared mocks at tests/__mocks__/turnstile.ts + tests/__mocks__/email-sender.ts. Plan 06-06 adds NO new vitest aliases."
    - "tests/helpers/booking-fixtures.ts is a NEW shared helper that exports `createConfirmedBooking({ accountId, eventTypeId, minutesAhead, bookerEmail? })` returning `{ bookingId, rawCancelToken, rawRescheduleToken, cancelHash, rescheduleHash, startAt, endAt }`. Tokens are generated via the same generateBookingTokens() the production code uses, then INSERTed via adminClient() — bypassing /api/bookings to avoid Turnstile dance + to control timing/reuse."
    - "Setup uses TEST_ACCOUNT_SLUG ('nsi-test') from existing tests/helpers/supabase.ts (NEVER touches the real 'nsi' production account — Andrew CLAUDE.md isolation rule). Phase 5 baseline already provisions this account."
    - "All 10 required test scenarios are covered, grouped into describe blocks: cancel-happy / reschedule-happy / token-invalidation / reschedule-conflicts / rate-limit / owner-cancel / ics-shape / email-prefetch-defense"
    - "Cancel happy path test (#1) parses the .ics buffer attached to the booker email and asserts: METHOD:CANCEL line present, UID matches the original booking.id (UID==booking.id is the Plan 06-02 lock), SEQUENCE:1 line present, STATUS:CANCELLED line present"
    - "Reschedule happy path test (#2) makes the API call then verifies the DB row directly: status STAYS 'confirmed' (NOT 'rescheduled' — Plan 06-03 lock), start_at + end_at swapped, BOTH cancel_token_hash AND reschedule_token_hash differ from pre-reschedule values (token rotation per RESEARCH §Pattern 3). Also asserts both reschedule emails fired with .ics carrying same UID + SEQUENCE:1 + METHOD:REQUEST."
    - "Token invalidation status-flip test (#3) calls the cancel POST with a valid token, then re-issues GET /cancel/[token] with the SAME raw token (resolved through the page resolver, NOT the API). Expects the token to no longer match any row (dead-hash invalidation per Plan 06-03 RESEARCH Pitfall 4). Test asserts via the underlying resolveCancelToken() returning state:'not_active' (cleaner than HTTP scraping), then ALSO asserts a second POST /api/cancel with the original token returns 410 NOT_ACTIVE."
    - "Token invalidation appointment-passed test (#4) inserts a booking with start_at < now() (via the helper's negative `minutesAhead`) and confirms POST /api/cancel returns 410 NOT_ACTIVE. The lookup query in app/api/cancel/route.ts has the start_at > now() guard (Plan 06-04 lock); even though status is still 'confirmed', the route returns 410."
    - "Reschedule slot-conflict test (#5) creates TWO confirmed bookings (different times), then attempts to reschedule both to the SAME target slot. The first reschedule succeeds (200); the second hits the bookings_no_double_book partial unique index → Postgres 23505 → 409 SLOT_TAKEN. Asserts the loser's DB row was NOT mutated (start_at + token hashes unchanged)."
    - "Reschedule CAS-guard test (#6) reschedules a booking ONCE successfully (which rotates reschedule_token_hash), then submits the OLD raw reschedule token a second time. Expected: route's lookup returns no row (dead hash), responds 410 NOT_ACTIVE — NOT 23505. Proves the double-CAS guard from Plan 06-03 is wired through the route."
    - "Rate-limit test (#7) loops 11 POSTs to /api/cancel from the same simulated IP (set via x-forwarded-for header on the Request) within the 5-min window. The 11th expects 429 + Retry-After header + code:'RATE_LIMITED'. Test ALSO verifies the same on /api/reschedule. Tests reset the rate_limit_events table between cancel + reschedule sub-tests so they don't bleed into each other."
    - "Owner cancel test (#8) inserts a confirmed booking, calls cancelBookingAsOwner(bookingId, 'Schedule conflict came up') directly, asserts: result.ok===true, DB row updated with status='cancelled' + cancelled_by='owner' + dead-hash invalidation, booker email sent (mocked spy captured) with apologetic copy AND reason callout AND re-book link. Then second sub-test: owner cancel WITHOUT a reason (undefined) — asserts booker email body OMITS the reason row entirely (Plan 06-02 EMAIL-07 lock + Plan 06-05 reason normalization)."
    - "ICS shape test (#9) is a focused unit-style assertion: build a METHOD:CANCEL .ics via the shared cancelBooking() path, parse the buffer string, assert presence of METHOD:CANCEL, UID:<known-uuid>, SEQUENCE:1, STATUS:CANCELLED. Uses simple string match (NOT a full ical parser dependency — Phase 5 Plan 05-08 lock prefers regex assertions over adding parser deps for tests)."
    - "Email-prefetch defense test (#10) creates a confirmed booking, snapshots the row state, calls the GET handler exported from app/cancel/[token]/page.tsx (the Server Component page IS importable in tests; it's a default export async function), reads back the booking row and asserts every column is unchanged. Proves the GET path is read-only (RESEARCH Pitfall 1 wired correctly through resolveCancelToken)."
    - "(LOCKED — Andrew CLAUDE.md) Final task is `<task type=\"manual\">` covering 8 manual QA steps that ONLY a human + real email + real calendar clients can execute. Phase 6 IS NOT COMPLETE until Andrew signs off this manual phase (CLAUDE.md: 'The project is not considered complete until this final phase has been reviewed and signed off by Andrew')."
    - "Manual QA covers: real booking → real cancel email click → /cancel page details → POST cancel → both inboxes get emails → .ics removes calendar event in Apple Mail + Gmail web + Outlook web → reschedule path identical → owner cancel from dashboard → stale link friendly page"
    - "Test cleanup (afterAll): deletes ALL inserted bookings + ALL inserted rate_limit_events rows tagged with the test IPs (`cancel:test-ip-*`, `reschedule:test-ip-*`). Does NOT delete the seeded nsi-test event_type or account (those are reused across test runs)."
  artifacts:
    - path: "tests/cancel-reschedule-api.test.ts"
      provides: "Vitest integration test suite for Phase 6 cancel + reschedule (10 scenarios) + owner Server Action coverage"
      contains: "@vitest-environment node\\|describe\\|cancelBooking\\|rescheduleBooking\\|cancelBookingAsOwner"
      min_lines: 480
    - path: "tests/helpers/booking-fixtures.ts"
      provides: "Reusable test fixture: insert a confirmed booking with known raw tokens via adminClient()"
      contains: "createConfirmedBooking\\|generateBookingTokens"
      exports: ["createConfirmedBooking", "BookingFixture"]
      min_lines: 70
  key_links:
    - from: "tests/cancel-reschedule-api.test.ts"
      to: "app/api/cancel/route.ts (POST)"
      via: "import { POST as cancelPOST } from '@/app/api/cancel/route'"
      pattern: "@/app/api/cancel/route"
    - from: "tests/cancel-reschedule-api.test.ts"
      to: "app/api/reschedule/route.ts (POST)"
      via: "import { POST as reschedulePOST } from '@/app/api/reschedule/route'"
      pattern: "@/app/api/reschedule/route"
    - from: "tests/cancel-reschedule-api.test.ts"
      to: "app/(shell)/app/bookings/[id]/_lib/actions.ts (Server Action)"
      via: "import { cancelBookingAsOwner } from '@/app/(shell)/app/bookings/[id]/_lib/actions'"
      pattern: "cancelBookingAsOwner"
    - from: "tests/cancel-reschedule-api.test.ts"
      to: "app/cancel/[token]/_lib/resolve-cancel-token.ts (page resolver)"
      via: "import { resolveCancelToken } from '@/app/cancel/[token]/_lib/resolve-cancel-token'"
      pattern: "resolveCancelToken"
    - from: "tests/helpers/booking-fixtures.ts"
      to: "lib/bookings/tokens.ts (Plan 05-05 helper)"
      via: "generateBookingTokens() — same helper production code uses"
      pattern: "generateBookingTokens"
    - from: "tests/cancel-reschedule-api.test.ts"
      to: "tests/__mocks__/email-sender.ts (existing Plan 05-08 mock)"
      via: "import { __mockSendCalls, __resetMockSendCalls } from '@/lib/email-sender' (resolved by vitest.config alias)"
      pattern: "__mockSendCalls"
---

<objective>
Build the Phase 6 verification gate: a vitest integration suite that exercises all 10 required cancel + reschedule + owner-cancel + rate-limit + .ics shape scenarios end-to-end against the live Supabase test project, plus a final manual QA task that gates phase completion per Andrew's CLAUDE.md "Phase X: Manual QA & Verification" rule.

Purpose: Hard-gate proof that LIFE-01..05 + EMAIL-06..07 + RESEARCH §Patterns 1-7 are correctly wired through every layer (shared functions → routes → owner Server Action → emails → .ics method/sequence/UID). Confirms the SAME `cancelBooking()` shared function powers BOTH the booker token route AND the owner Server Action (single-source-of-truth proof). Closes Phase 6 verification.

Output: 2 files (one test suite, one shared fixture helper). Existing vitest.config.ts aliases for Turnstile + email-sender are reused — no config changes. After this plan, `npm test` runs the full Phase 1-5 suite + Plan 06-06 and all green; THEN Andrew runs the manual QA checklist; THEN Phase 6 is complete.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-CONTEXT.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-RESEARCH.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-02-SUMMARY.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-03-SUMMARY.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-04-SUMMARY.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-05-SUMMARY.md

# THE pattern this plan mirrors — read this first
@.planning/phases/05-public-booking-flow/05-PLAN-08-bookings-api-integration-tests.md
@tests/bookings-api.test.ts

# Existing test infrastructure we reuse
@tests/setup.ts
@tests/helpers/supabase.ts
@tests/__mocks__/turnstile.ts
@tests/__mocks__/email-sender.ts
@vitest.config.ts

# Routes + Server Action under test
@app/api/cancel/route.ts
@app/api/reschedule/route.ts
@app/(shell)/app/bookings/[id]/_lib/actions.ts

# Shared functions called by the routes
@lib/bookings/cancel.ts
@lib/bookings/reschedule.ts
@lib/bookings/tokens.ts
@lib/rate-limit.ts

# Token resolvers used in invalidation + email-prefetch tests
@app/cancel/[token]/_lib/resolve-cancel-token.ts
@app/reschedule/[token]/_lib/resolve-reschedule-token.ts

# Email senders (mocked, but we assert call shape)
@lib/email/send-cancel-emails.ts
@lib/email/send-reschedule-emails.ts
@lib/email/build-ics.ts

# Schema reference
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260427120000_rate_limit_events.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: tests/helpers/booking-fixtures.ts — shared confirmed-booking factory</name>
  <files>tests/helpers/booking-fixtures.ts</files>
  <action>
Create a fixture helper that the integration suite uses to insert confirmed bookings with KNOWN raw tokens. We bypass POST /api/bookings (Phase 5 path) deliberately because:
- We need to control timing precisely (negative `minutesAhead` for the appointment-passed test)
- We need to know the raw tokens BEFORE the test runs (production code only ever exposes the hash to non-email paths)
- We need to skip the Turnstile dance for setup-only fixtures

```typescript
import "server-only-disabled-for-tests"; // see note below
// Note on the "server-only" guard: lib/bookings/tokens.ts has `import 'server-only'`
// at line 1, which throws if loaded outside a Next server context. Vitest in node-env
// doesn't simulate Next's server-only sentinel, so the import works fine — the
// runtime check only fires inside Next bundles. Do NOT add the comment above as a
// real import; it's a documentation hint only. Remove the line entirely if it
// causes a missing-module error.

import { adminClient } from "./supabase";
import { generateBookingTokens } from "@/lib/bookings/tokens";

export interface BookingFixture {
  bookingId: string;
  rawCancelToken: string;
  rawRescheduleToken: string;
  cancelHash: string;
  rescheduleHash: string;
  startAt: string;       // ISO UTC
  endAt: string;         // ISO UTC
  bookerEmail: string;
}

export interface CreateConfirmedBookingArgs {
  accountId: string;
  eventTypeId: string;
  /** Minutes from now until start_at. Use negative numbers to insert a
   *  past-appointment booking for the "appointment passed" test. */
  minutesAhead: number;
  /** Slot duration; defaults to 30 minutes (matches the seeded test event_type) */
  durationMinutes?: number;
  /** Override the booker email — useful when the same test inserts multiple
   *  bookings and wants distinguishable emails in the spy. */
  bookerEmail?: string;
  /** Override the booker name (default "Test Booker") */
  bookerName?: string;
  /** Override answers (default {}) */
  answers?: Record<string, string>;
}

/**
 * Insert a confirmed booking via adminClient() with KNOWN raw tokens.
 *
 * We deliberately bypass POST /api/bookings here because:
 *  - The integration tests need to control start_at precisely (including past
 *    times for the "appointment passed" invalidation test).
 *  - Tests need to know the raw cancel + reschedule tokens upfront — the
 *    production /api/bookings path only stores hashes and emails the raw values
 *    out (which we'd have to scrape the email mock for, adding indirection).
 *  - Skipping the Turnstile dance keeps fixtures fast and deterministic.
 *
 * Returns the inserted bookingId, BOTH raw tokens, BOTH hashes, and the times.
 * Caller is responsible for cleanup — push bookingId into the suite's
 * `insertedBookingIds` array so afterAll() can delete it.
 */
export async function createConfirmedBooking(
  args: CreateConfirmedBookingArgs,
): Promise<BookingFixture> {
  const admin = adminClient();
  const tokens = await generateBookingTokens();

  const startMs = Date.now() + args.minutesAhead * 60 * 1000;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(startMs + (args.durationMinutes ?? 30) * 60 * 1000).toISOString();

  const bookerEmail = args.bookerEmail ?? `test+${Math.random().toString(36).slice(2, 8)}@example.com`;

  const { data, error } = await admin
    .from("bookings")
    .insert({
      account_id: args.accountId,
      event_type_id: args.eventTypeId,
      start_at: startAt,
      end_at: endAt,
      booker_name: args.bookerName ?? "Test Booker",
      booker_email: bookerEmail,
      booker_phone: "555-000-0000",
      booker_timezone: "America/Chicago",
      answers: args.answers ?? {},
      cancel_token_hash: tokens.hashCancel,
      reschedule_token_hash: tokens.hashReschedule,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createConfirmedBooking insert failed: ${error?.message ?? "no data"}`);
  }

  return {
    bookingId: data.id,
    rawCancelToken: tokens.rawCancel,
    rawRescheduleToken: tokens.rawReschedule,
    cancelHash: tokens.hashCancel,
    rescheduleHash: tokens.hashReschedule,
    startAt,
    endAt,
    bookerEmail,
  };
}
```

DO NOT (this task):
- Do NOT add the literal `import "server-only-disabled-for-tests"` line — it's a documentation comment only. The actual file should NOT have that line. The real concern: `lib/bookings/tokens.ts` starts with `import "server-only"` which under vitest+node should be a no-op (vitest doesn't bundle for client). If a missing-module error appears, add `vi.mock('server-only', () => ({}))` at the top of the test file (Plan 04-06 STATE.md lock pattern).
- Do NOT call POST /api/bookings to create fixtures — the Turnstile + email round-trip slows tests and obscures token values.
- Do NOT delete bookings inside this helper. Caller-managed cleanup keeps the contract simple and predictable (suite controls when teardown runs).
- Do NOT seed an event_type or account in this helper — those are provisioned by `getOrCreateTestAccount` + `getOrCreateTestEventType` in tests/helpers/supabase.ts (existing baseline). The fixture takes pre-existing IDs.
- Do NOT randomize `minutesAhead` — the caller controls timing exactly (e.g. -60 for past, 60*24*7 for next-week).
  </action>
  <verify>
```bash
ls "tests/helpers/booking-fixtures.ts"

grep -q "export async function createConfirmedBooking" "tests/helpers/booking-fixtures.ts" && echo "factory exported"
grep -q "generateBookingTokens" "tests/helpers/booking-fixtures.ts" && echo "uses production token helper"
grep -q "adminClient()" "tests/helpers/booking-fixtures.ts" && echo "uses adminClient"
grep -q "rawCancelToken" "tests/helpers/booking-fixtures.ts" && echo "exposes raw cancel token"
grep -q "rawRescheduleToken" "tests/helpers/booking-fixtures.ts" && echo "exposes raw reschedule token"

# Negative: must not call /api/bookings
grep -qE "/api/bookings|verifyTurnstile" "tests/helpers/booking-fixtures.ts" && echo "WARNING: helper calls API or Turnstile - REMOVE" || echo "no API/Turnstile calls ok"

npm run build
npm run lint
```
  </verify>
  <done>
`tests/helpers/booking-fixtures.ts` exists; exports `createConfirmedBooking({ accountId, eventTypeId, minutesAhead, ... })` returning a `BookingFixture` with `{ bookingId, rawCancelToken, rawRescheduleToken, cancelHash, rescheduleHash, startAt, endAt, bookerEmail }`. Uses `adminClient()` + `generateBookingTokens()` from production code. Build + lint pass.

Commit: `test(06-06): add createConfirmedBooking shared fixture for cancel/reschedule integration tests`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: tests/cancel-reschedule-api.test.ts — 10-scenario integration suite</name>
  <files>tests/cancel-reschedule-api.test.ts</files>
  <action>
Build the integration test suite. Mirror Plan 05-08's `bookings-api.test.ts` structure exactly: `@vitest-environment node` directive, real Supabase via adminClient, mocked Turnstile + email-sender via existing vitest config aliases, comprehensive cleanup in afterAll.

Suite organizes the 10 required scenarios into named describe blocks:

```typescript
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { adminClient, getOrCreateTestAccount, getOrCreateTestEventType } from "@/tests/helpers/supabase";
import { createConfirmedBooking, type BookingFixture } from "@/tests/helpers/booking-fixtures";

import { POST as cancelPOST } from "@/app/api/cancel/route";
import { POST as reschedulePOST } from "@/app/api/reschedule/route";
import { cancelBookingAsOwner } from "@/app/(shell)/app/bookings/[id]/_lib/actions";
import { resolveCancelToken } from "@/app/cancel/[token]/_lib/resolve-cancel-token";
import { __mockSendCalls, __resetMockSendCalls } from "@/lib/email-sender"; // resolved to mock
import { __setTurnstileResult } from "@/lib/turnstile"; // resolved to mock

/**
 * Phase 6 integration tests — exercises:
 *   - POST /api/cancel + POST /api/reschedule (Plan 06-04 routes)
 *   - cancelBookingAsOwner Server Action (Plan 06-05)
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
 */

let TEST_ACCOUNT_ID = "";
let TEST_EVENT_TYPE_ID = "";
const insertedBookingIds: string[] = [];
const usedRateLimitKeys: string[] = [];

// Build a Request matching the route's expected shape. Pass an `ip` arg to
// distinguish callers for rate-limit testing (uses x-forwarded-for header).
function buildRequest(url: string, body: unknown, ip?: string): Request {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (ip) headers["x-forwarded-for"] = ip;
  return new Request(url, {
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
      buildRequest("https://example.com/api/cancel", {
        token: booking.rawCancelToken,
        reason: "Conflict came up",
      }, "10.6.6.1") as unknown as Parameters<typeof cancelPOST>[0],
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
      .select("status, cancelled_by, cancelled_at, cancel_token_hash, reschedule_token_hash")
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
    const bookerEmail = __mockSendCalls.find(
      (c) => Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const ics = bookerEmail!.attachments?.find((a) => a.filename?.endsWith(".ics"));
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
    const newStartMs = new Date(booking.startAt).getTime() + 24 * 60 * 60 * 1000;
    const newStartAt = new Date(newStartMs).toISOString();
    const newEndAt = new Date(newStartMs + 30 * 60 * 1000).toISOString();

    const res = await reschedulePOST(
      buildRequest("https://example.com/api/reschedule", {
        token: booking.rawRescheduleToken,
        startAt: newStartAt,
        endAt: newEndAt,
      }, "10.6.6.2") as unknown as Parameters<typeof reschedulePOST>[0],
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
    expect(row?.start_at).toBe(newStartAt);
    expect(row?.end_at).toBe(newEndAt);
    expect(row?.cancel_token_hash).not.toBe(booking.cancelHash);
    expect(row?.reschedule_token_hash).not.toBe(booking.rescheduleHash);

    // .ics: METHOD:REQUEST + same UID + SEQUENCE:1
    const bookerEmail = __mockSendCalls.find(
      (c) => Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const ics = bookerEmail!.attachments?.find((a) => a.filename?.endsWith(".ics"));
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
      buildRequest("https://example.com/api/cancel", { token: booking.rawCancelToken }, "10.6.6.3") as unknown as Parameters<typeof cancelPOST>[0],
    );
    expect(first.status).toBe(200);

    // Resolver should now return not_active for the SAME raw token (dead-hash invalidation)
    const resolved = await resolveCancelToken(booking.rawCancelToken);
    expect(resolved.state).toBe("not_active");

    // Second POST with the same token returns 410 NOT_ACTIVE
    const second = await cancelPOST(
      buildRequest("https://example.com/api/cancel", { token: booking.rawCancelToken }, "10.6.6.3") as unknown as Parameters<typeof cancelPOST>[0],
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
      buildRequest("https://example.com/api/cancel", { token: booking.rawCancelToken }, "10.6.6.4") as unknown as Parameters<typeof cancelPOST>[0],
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
      buildRequest("https://example.com/api/reschedule", {
        token: a.rawRescheduleToken,
        startAt: targetStart,
        endAt: targetEnd,
      }, "10.6.6.5a") as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(winner.status).toBe(200);

    // Second reschedule LOSES — same target slot now occupied by A
    const loser = await reschedulePOST(
      buildRequest("https://example.com/api/reschedule", {
        token: b.rawRescheduleToken,
        startAt: targetStart,
        endAt: targetEnd,
      }, "10.6.6.5b") as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(loser.status).toBe(409);
    const loserBody = await loser.json();
    expect(loserBody.code).toBe("SLOT_TAKEN");

    // Loser row UNCHANGED
    const admin = adminClient();
    const { data: bRow } = await admin
      .from("bookings")
      .select("start_at, reschedule_token_hash")
      .eq("id", b.bookingId)
      .single();
    expect(bRow?.start_at).toBe(b.startAt);
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
      buildRequest("https://example.com/api/reschedule", {
        token: booking.rawRescheduleToken,
        startAt: target1Start,
        endAt: target1End,
      }, "10.6.6.6") as unknown as Parameters<typeof reschedulePOST>[0],
    );
    expect(first.status).toBe(200);

    // Replay the OLD raw token toward a DIFFERENT (free) target slot
    const target2Ms = Date.now() + 4 * 24 * 60 * 60 * 1000;
    const second = await reschedulePOST(
      buildRequest("https://example.com/api/reschedule", {
        token: booking.rawRescheduleToken,
        startAt: new Date(target2Ms).toISOString(),
        endAt: new Date(target2Ms + 30 * 60 * 1000).toISOString(),
      }, "10.6.6.6") as unknown as Parameters<typeof reschedulePOST>[0],
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
        buildRequest("https://example.com/api/cancel", { token: "nonexistent-token-".padEnd(20, "x") }, ip) as unknown as Parameters<typeof cancelPOST>[0],
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
        buildRequest("https://example.com/api/reschedule", {
          token: "nonexistent-token-".padEnd(20, "x"),
          startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        }, ip) as unknown as Parameters<typeof reschedulePOST>[0],
      );
      lastStatus = res.status;
      lastRetryAfter = res.headers.get("Retry-After");
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
    expect(lastRetryAfter).toBeTruthy();
  });
});

// ─── Scenario 8: Owner cancel via Server Action ─────────────────────────────
describe("Owner cancel via Server Action", () => {
  it("[#8a] cancelBookingAsOwner with reason: succeeds, marks cancelled_by='owner', booker email contains apologetic copy + reason callout + re-book link", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
      bookerEmail: "owner-cancel-with-reason@example.com",
    });
    insertedBookingIds.push(booking.bookingId);

    const reason = "Schedule conflict came up — happy to reschedule when you're free.";
    const result = await cancelBookingAsOwner(booking.bookingId, reason);
    expect(result).toEqual({ ok: true });

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
    const bookerEmail = __mockSendCalls.find(
      (c) => Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const html = bookerEmail!.html ?? "";
    expect(html.toLowerCase()).toMatch(/apologi[sz]e|sorry|inconvenience/); // apologetic copy
    expect(html).toContain(reason); // reason callout (escaped)
    expect(html).toMatch(/book again|book another/i); // re-book CTA copy
    expect(html).toMatch(/href="[^"]*\/nsi-test\/[^"]*"/); // link to /[account-slug]/[event-slug]
  });

  it("[#8b] cancelBookingAsOwner without reason: booker email omits the reason row entirely", async () => {
    const booking = await createConfirmedBooking({
      accountId: TEST_ACCOUNT_ID,
      eventTypeId: TEST_EVENT_TYPE_ID,
      minutesAhead: 60 * 24 * 7,
      bookerEmail: "owner-cancel-no-reason@example.com",
    });
    insertedBookingIds.push(booking.bookingId);

    // Pass empty/whitespace — Plan 06-05 normalizes both to undefined
    const result = await cancelBookingAsOwner(booking.bookingId, "   ");
    expect(result).toEqual({ ok: true });

    await new Promise((r) => setTimeout(r, 100));

    const bookerEmail = __mockSendCalls.find(
      (c) => Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const html = bookerEmail!.html ?? "";
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
      buildRequest("https://example.com/api/cancel", { token: booking.rawCancelToken }, "10.6.6.9") as unknown as Parameters<typeof cancelPOST>[0],
    );
    await new Promise((r) => setTimeout(r, 100));

    const bookerEmail = __mockSendCalls.find(
      (c) => Array.isArray(c.to) ? c.to.includes(booking.bookerEmail) : c.to === booking.bookerEmail,
    );
    expect(bookerEmail).toBeTruthy();
    const ics = bookerEmail!.attachments?.find((a) => a.filename?.endsWith(".ics"));
    expect(ics).toBeTruthy();
    const icsText = ics!.content?.toString() ?? "";

    // RFC 5546 cancellation shape (RESEARCH §Pattern 6)
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
      .select("status, start_at, end_at, cancel_token_hash, reschedule_token_hash, cancelled_at, cancelled_by")
      .eq("id", booking.bookingId)
      .single();

    // Call the resolver — this is what GET /cancel/[token] page does on load.
    // If anything in the resolver path were to mutate the row (it must not),
    // the after-snapshot would diverge.
    const resolved = await resolveCancelToken(booking.rawCancelToken);
    expect(resolved.state).toBe("active");

    const { data: after } = await admin
      .from("bookings")
      .select("status, start_at, end_at, cancel_token_hash, reschedule_token_hash, cancelled_at, cancelled_by")
      .eq("id", booking.bookingId)
      .single();

    expect(after).toEqual(before);
  });
});
```

Key rules / non-obvious notes:
- The rate-limit tests use a non-existent token so the route handler short-circuits at the lookup stage AFTER the rate-limit increment. This is the cleanest way to spam the endpoint without inserting bookings.
- Each rate-limit test uses a distinct IP so cancel + reschedule sub-tests don't share a window.
- `usedRateLimitKeys` tracks the keys we polluted so afterAll can clean them up — leaving rows in `rate_limit_events` would skew future test runs that target the same IPs.
- The owner-cancel tests deliberately use distinct booker emails per test so the email-spy lookup is unambiguous within the same `it` block.
- The .ics assertions use multiline regex (`/^METHOD:CANCEL$/m`) because ical-generator output has CRLF line endings and we want to match the FULL line, not a substring.
- Test #10 calls `resolveCancelToken` (the lib function the page uses) rather than importing the page.tsx default export. Importing the page Server Component into vitest works in principle but pulls in `next/navigation` (notFound, etc.) which throws outside a Next request context. Calling the resolver directly proves the same property: the read path does not mutate.
- All assertion error messages reference scenario number (`[#1]`, `[#2]`...) for fast traceback to this plan.

DO NOT (this task):
- Do NOT add new vitest aliases — the existing `@/lib/turnstile` and `@/lib/email-sender` aliases from Plan 05-08 cover everything Phase 6 needs.
- Do NOT mock Supabase. Real DB is required to exercise the partial unique index (test #5), the dead-hash invalidation (#3), the rate-limit table (#7), and the read-only invariant (#10).
- Do NOT spin up a Next dev server — direct route-handler import is the locked Phase 4 + Phase 5 pattern.
- Do NOT skip cleanup. Both `bookings` AND `rate_limit_events` rows from this suite must be deleted in afterAll, otherwise the test project accumulates noise that will eventually skew future test runs.
- Do NOT increment `startMinuteOffset` like Plan 05-08 — Phase 6 fixtures use `createConfirmedBooking({ minutesAhead })` instead, and each test picks distinct minutesAhead so there are no collisions.
- Do NOT assert exact email body wording beyond the documented locks (apologetic phrase, reason callout, re-book link). Email copy can iterate without breaking these tests.
- Do NOT assert `__mockSendCalls.length === 2` — owner email is skipped silently when account.owner_email is null. `>= 1` is the safe bound.
- Do NOT call cancelBookingAsOwner from a test that hasn't supplied `TEST_OWNER_EMAIL` / `TEST_OWNER_PASSWORD`. Wait — actually we DON'T call signInAsNsiOwner in this suite; cancelBookingAsOwner uses the RLS-scoped server client (cookies + auth context). In the vitest node env there is NO cookie context. Implication: the action's RLS pre-check will fail because there is no authenticated session. Resolution: in Plan 06-05 the action's pre-check uses `await createClient()` from `lib/supabase/server` which calls `cookies()`. In vitest+node, `cookies()` from `next/headers` THROWS outside a request scope. Mitigation: this test specifically requires either (a) mocking next/headers cookies() to return a stub session OR (b) calling `cancelBooking` (the shared function) directly instead of the Server Action wrapper. RECOMMENDED RESOLUTION: at the top of the test file, add `vi.mock("next/headers", () => ({ cookies: () => ({ getAll: () => [], set: () => {} }) }))` — this lets cookies() return an empty bag, the server-client thinks it's an anon caller, and the pre-check returns null with a "Booking not found." error. THAT means the test cannot directly exercise the OWNER path through the Server Action under vitest+node. ALTERNATIVE: bypass the action wrapper and call cancelBooking() directly with `actor: 'owner'` — same end result because Plan 06-05 explicitly delegates everything email/audit-related to the shared function. **DO THIS:** Test #8a and #8b should call `cancelBooking({ bookingId, actor: 'owner', reason, appUrl: 'http://test', ip: null })` directly via `import { cancelBooking } from '@/lib/bookings/cancel'`, with a comment explaining why the Server Action wrapper isn't called: the RLS auth check requires a Next request context that vitest+node doesn't simulate. Coverage of the wrapper itself moves into Manual QA (test step: "Owner cancel from /app/bookings/[id]" — proves end-to-end including the auth gate). Update the test bodies + the imports accordingly: REMOVE `import { cancelBookingAsOwner }` and ADD `import { cancelBooking } from '@/lib/bookings/cancel'`. Test assertions stay otherwise identical — same DB updates, same email shape.
  </action>
  <verify>
```bash
ls "tests/cancel-reschedule-api.test.ts"

head -2 "tests/cancel-reschedule-api.test.ts" | grep -q "@vitest-environment node" && echo "node env ok"

# All 10 scenarios present
grep -q "\[#1\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 1 present"
grep -q "\[#2\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 2 present"
grep -q "\[#3\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 3 present"
grep -q "\[#4\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 4 present"
grep -q "\[#5\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 5 present"
grep -q "\[#6\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 6 present"
grep -q "\[#7-cancel\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 7 cancel present"
grep -q "\[#7-reschedule\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 7 reschedule present"
grep -q "\[#8a\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 8a present"
grep -q "\[#8b\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 8b present"
grep -q "\[#9\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 9 present"
grep -q "\[#10\]" "tests/cancel-reschedule-api.test.ts" && echo "scenario 10 present"

# Routes + shared functions wired
grep -q "from \"@/app/api/cancel/route\"" "tests/cancel-reschedule-api.test.ts" && echo "cancel route imported"
grep -q "from \"@/app/api/reschedule/route\"" "tests/cancel-reschedule-api.test.ts" && echo "reschedule route imported"
grep -q "from \"@/lib/bookings/cancel\"" "tests/cancel-reschedule-api.test.ts" && echo "shared cancelBooking imported (owner-path coverage)"
grep -q "from \"@/app/cancel/\[token\]/_lib/resolve-cancel-token\"" "tests/cancel-reschedule-api.test.ts" && echo "resolver imported"

# Mock spies
grep -q "__mockSendCalls" "tests/cancel-reschedule-api.test.ts" && echo "email spy used"
grep -q "__setTurnstileResult" "tests/cancel-reschedule-api.test.ts" && echo "turnstile mock controllable"

# Cleanup
grep -q "afterAll" "tests/cancel-reschedule-api.test.ts" && echo "afterAll present"
grep -q "rate_limit_events" "tests/cancel-reschedule-api.test.ts" && echo "rate-limit cleanup wired"

# Error code vocabulary (must match Plan 06-04)
grep -q "NOT_ACTIVE" "tests/cancel-reschedule-api.test.ts" && echo "NOT_ACTIVE checked"
grep -q "SLOT_TAKEN" "tests/cancel-reschedule-api.test.ts" && echo "SLOT_TAKEN checked"
grep -q "RATE_LIMITED\\|429" "tests/cancel-reschedule-api.test.ts" && echo "rate-limit checked"

# .ics shape (RFC 5546)
grep -q "METHOD:CANCEL" "tests/cancel-reschedule-api.test.ts" && echo "METHOD:CANCEL asserted"
grep -q "SEQUENCE:1" "tests/cancel-reschedule-api.test.ts" && echo "SEQUENCE:1 asserted"
grep -q "STATUS:CANCELLED" "tests/cancel-reschedule-api.test.ts" && echo "STATUS:CANCELLED asserted"

# Run JUST this test file
npm test -- tests/cancel-reschedule-api.test.ts

# Run full suite
npm test
```
  </verify>
  <done>
`tests/cancel-reschedule-api.test.ts` exists with `@vitest-environment node` directive. All 10 required scenarios present and tagged (`[#1]` through `[#10]` plus `[#7-cancel]`, `[#7-reschedule]`, `[#8a]`, `[#8b]`). Real Supabase test project, mocked Turnstile + email-sender via existing Plan 05-08 vitest aliases. afterAll cleans up bookings AND rate_limit_events. Owner-path coverage uses `cancelBooking()` directly (with explanatory comment); the Server Action wrapper coverage is documented as moving to Manual QA because vitest+node has no Next request context for the action's RLS pre-check. `npm test -- tests/cancel-reschedule-api.test.ts` exits 0; full `npm test` exits 0 (no Phase 1-5 regressions).

Commit: `test(06-06): add Phase 6 integration test suite (cancel + reschedule + owner cancel + rate limit + .ics shape)`. Push.
  </done>
</task>

<task type="manual">
  <name>Task 3: Manual QA & Verification — Andrew sign-off (gating)</name>
  <action>
**(LOCKED — Andrew CLAUDE.md "Phase X: Manual QA & Verification" rule)**

Phase 6 is NOT considered complete until ALL items below are checked off and Andrew posts the sign-off line. The integration tests in Task 2 prove the wiring is correct; this manual phase proves the END-TO-END user experience works against real email clients and real calendar apps — things vitest+node cannot simulate.

Prerequisites (Andrew confirms before starting):
- [ ] Latest main is deployed to Vercel (Plans 06-01 through 06-06 all pushed and green)
- [ ] `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` (or Gmail SMTP env vars per Phase 5 lock), `TURNSTILE_*` secrets all set in Vercel project env
- [ ] Andrew's real personal email account (the booker email) is accessible
- [ ] Andrew's owner email (the account.owner_email seeded for `nsi`) is accessible
- [ ] Andrew is signed in to the dashboard at /app/bookings (Phase 2 auth still works)

### Step 1 — Send a real test booking through Phase 5

1. Open the public booking URL for any of Andrew's real event types: `https://calendar-app-xi-smoky.vercel.app/nsi/[event-slug]`
2. Pick a slot at least 24 hours in the future
3. Fill the form with Andrew's real personal email as the booker
4. Submit; complete Turnstile if it challenges
5. Verify: redirected to `/nsi/[event-slug]/confirmed/[booking-id]` confirmation page
6. Verify: Resend (or Gmail SMTP) delivers BOTH the booker confirmation AND the owner notification within ~30 seconds

Sign off step 1: ☐ Bookings flow works end-to-end (`yes` / `no — describe issue`)

### Step 2 — Click cancel link in the booker email; confirm /cancel/[token] is read-only

1. Open the booker confirmation email Andrew received in step 1
2. Click the "Cancel booking" link
3. Verify: lands on `/cancel/[token]` page showing the booking details + "Cancel this booking?" header + reason textarea + "Yes, cancel this booking" + "Keep my booking" buttons
4. **CRITICAL — email-prefetch defense check:** open a fresh browser tab, paste the same `/cancel/[token]` URL, hit enter. Verify the page renders the same details (page is READ-ONLY — multiple GETs do not change anything). Then navigate to /app/bookings/[id] in the dashboard and verify the booking is STILL `confirmed` (status not flipped just from page loads).

Sign off step 2: ☐ /cancel page is read-only — verified by repeated page loads not flipping status (`yes` / `no — describe`)

### Step 3 — Confirm cancellation; verify both inboxes get cancellation emails with .ics

1. Back on the /cancel/[token] page from step 2, type a reason (e.g. "Testing Phase 6 cancellation")
2. Click "Yes, cancel this booking"
3. Verify: success state renders inline ("Your booking has been cancelled." + "Book again" CTA)
4. Verify: Andrew's booker email inbox receives a cancellation email within ~30 seconds
5. Verify: Andrew's owner email inbox ALSO receives a cancellation email within ~30 seconds
6. Verify: BOTH emails have a `.ics` attachment

Sign off step 3: ☐ Both cancellation emails received with .ics attachments (`yes` / `no — describe`)

### Step 4 — Verify .ics attachment auto-removes the calendar event in real clients

For EACH of these clients (use whichever you have access to — minimum 2 of 3):
1. **Apple Mail (Mac/iOS):** Open the original confirmation email's .ics — should add to Calendar. Then open the cancellation email's .ics — should AUTO-REMOVE the same event (no orphan, no manual delete required).
2. **Gmail web:** Same procedure — original .ics adds via "Add to calendar" button → cancellation .ics removes the event.
3. **Outlook web:** Same procedure.

Sign off step 4: ☐ Calendar event auto-removed in [list which clients verified] (`Apple Mail / Gmail web / Outlook web`)

### Step 5 — Reschedule flow end-to-end

1. Send another test booking through Phase 5 (same as step 1)
2. Open the booker email; click the "Reschedule" link
3. Verify: lands on `/reschedule/[token]` showing "Currently scheduled: [time]" reference line + the slot picker (same one Phase 5 uses)
4. Verify: slot picker is scoped to the SAME event_type — only that event's available slots show, not other event types' slots
5. Pick a NEW slot at least 24 hours out, ideally on a different day
6. Submit (complete Turnstile widget if it challenges)
7. Verify: success state renders ("Booking rescheduled" + email reminder copy)
8. Verify: BOTH inboxes receive a "rescheduled" email
9. Open the reschedule email's .ics in the SAME calendar client used in step 4
10. **CRITICAL:** verify the calendar event UPDATES IN PLACE at the new time — does NOT create a new event. The original event row should now show the new time, not a duplicate.

Sign off step 5: ☐ Reschedule flow works AND calendar event updates in place — no orphans (`yes` / `no — describe issue + which client`)

### Step 6 — Owner cancel from /app/bookings/[id]

1. Send a third test booking through Phase 5
2. Find the booking ID (from the confirmation page URL or the owner email)
3. Sign in to the dashboard, navigate to `https://calendar-app-xi-smoky.vercel.app/app/bookings/[that-id]`
4. Verify: detail page renders with event type name, scheduled time (in account TZ), booker name + email + phone, custom answers (if any), status badge ("confirmed")
5. Click "Cancel booking"
6. Verify: AlertDialog opens with the apologetic warning copy + reason textarea
7. Type a reason (e.g. "Owner had a conflict — Phase 6 testing")
8. Click "Yes, cancel booking"
9. Verify: dialog closes, toast appears ("Booking cancelled. Both parties have been notified."), page refreshes to show the cancelled-state banner ("This booking was cancelled on [date] by you")
10. Verify: Andrew's booker email inbox receives an APOLOGETIC cancellation email containing: (a) apologetic copy ("apologi[sz]e" / "sorry" / "inconvenience"), (b) the reason callout ("Owner had a conflict..."), (c) a "Book again" link pointing to `/[account-slug]/[event-slug]`, (d) METHOD:CANCEL .ics that removes the calendar event
11. **CRITICAL:** repeat steps 1-9 with NO reason in the textarea — verify the booker email body OMITS any "Reason:" row entirely (no empty cell, no "Reason: (none)")

Sign off step 6: ☐ Owner cancel from dashboard works AND apologetic email + reason handling correct (`yes` / `no — describe issue`)

### Step 7 — Stale-link friendly page

1. Take any of the cancellation links you've already used in steps 2-6 (one whose booking is now `cancelled`)
2. Open it in a fresh tab
3. Verify: lands on the friendly "This link is no longer active" page (NOT a 500, NOT a blank page, NOT the booking-detail page)
4. Verify: the page exposes the owner contact email as a `mailto:` link
5. Repeat with a stale RESCHEDULE link from step 5 — same friendly page

Sign off step 7: ☐ Stale links show friendly "no longer active" page with owner email contact (`yes` / `no — describe`)

### Step 8 — Rate-limit live verification (optional but recommended)

1. From a single browser, rapidly click "Cancel" on a known-stale token URL ~12 times in under a minute (the link doesn't have to be valid; the rate-limiter fires before token resolution)
2. Verify: by the 11th request, you see a 429 / "Too many requests" response with a Retry-After hint

Sign off step 8 (optional): ☐ Rate limit fires per CONTEXT lock (`yes` / `skipped` / `no — describe`)

### FINAL SIGN-OFF (Andrew)

By signing the line below, I confirm:
- All 7 mandatory steps above executed and passed
- Phase 6 lifecycle (cancel, reschedule, owner cancel, .ics auto-removal, rate-limit, friendly errors) works end-to-end against real email + real calendar clients
- I'm comfortable shipping this to real users

Signed (Andrew): `__________________________________` Date: `_______________`

If ANY step failed, do NOT sign. Instead:
1. File the failure as a Phase 6 gap in `.planning/phases/06-cancel-and-reschedule-lifecycle/06-UAT.md` (per GSD UAT pattern)
2. Run `/gsd:plan-phase 6 --gaps` to generate gap-closure plans
3. Re-execute → re-test → re-sign
  </action>
  <done>
Andrew has signed and dated the FINAL SIGN-OFF block above. Phase 6 is complete.

If ANY step required gap-closure: a `06-UAT.md` exists with diagnosed gaps, gap-closure plans were generated and executed, and the manual QA was re-run to passing. Sign-off line filled afterward.

NO commit for this task — Andrew updates this PLAN.md file in place with the sign-off, then commits with: `docs(06): manual QA sign-off — Phase 6 cancel/reschedule lifecycle complete`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
ls "tests/cancel-reschedule-api.test.ts"
ls "tests/helpers/booking-fixtures.ts"
npm run build
npm run lint
npm test
```

After Andrew's manual QA sign-off in Task 3:
```bash
# Phase 6 complete check (sign-off line filled)
grep -q "Signed (Andrew):" ".planning/phases/06-cancel-and-reschedule-lifecycle/06-PLAN-06-integration-tests-and-manual-qa.md"
# (Manual visual check that the line is actually filled in, not blank)
```
</verification>

<rollback>
Delete:
- `tests/cancel-reschedule-api.test.ts`
- `tests/helpers/booking-fixtures.ts`

The integration suite is purely additive — removing it does not affect any production code. The Phase 1-5 test suites and the Phase 6 production code (Plans 06-01 through 06-05) remain intact.

If the manual QA discovers issues, do NOT roll back; instead create a `06-UAT.md` gap log and run `/gsd:plan-phase 6 --gaps` per the GSD gap-closure workflow.
</rollback>

<success_criteria>
- [ ] `tests/helpers/booking-fixtures.ts` exports `createConfirmedBooking({ accountId, eventTypeId, minutesAhead, ... })` returning `{ bookingId, rawCancelToken, rawRescheduleToken, cancelHash, rescheduleHash, startAt, endAt, bookerEmail }`. Uses `adminClient()` + production `generateBookingTokens()`. Bypasses Turnstile + /api/bookings.
- [ ] `tests/cancel-reschedule-api.test.ts` has `@vitest-environment node` directive
- [ ] All 10 required scenarios present, tagged with `[#N]`:
  - [ ] [#1] Cancel happy path — POST 200 + DB cancelled + dead-hash invalidation + .ics METHOD:CANCEL+UID+SEQUENCE:1+STATUS:CANCELLED
  - [ ] [#2] Reschedule happy path — POST 200 + DB confirmed (NOT 'rescheduled') + slot swap + BOTH hashes rotated + .ics METHOD:REQUEST+SEQUENCE:1+same UID
  - [ ] [#3] Status-flip token invalidation — second POST with same raw cancel token returns 410 NOT_ACTIVE; resolveCancelToken returns state:'not_active'
  - [ ] [#4] Appointment-passed invalidation — past start_at + status='confirmed' → 410 NOT_ACTIVE
  - [ ] [#5] Reschedule slot conflict — first wins 200, second hits 23505 → 409 SLOT_TAKEN, loser DB row unchanged
  - [ ] [#6] CAS guard — old reschedule token after rotation returns 410 NOT_ACTIVE (NOT 23505)
  - [ ] [#7-cancel] 11 cancels from same IP → 429 + Retry-After
  - [ ] [#7-reschedule] 11 reschedules from same IP → 429 + Retry-After
  - [ ] [#8a] Owner cancel WITH reason — DB cancelled_by='owner', booker email contains apologetic + reason callout + re-book link
  - [ ] [#8b] Owner cancel WITHOUT reason — booker email omits the reason row entirely (Plan 06-02 EMAIL-07 lock)
  - [ ] [#9] METHOD:CANCEL .ics shape — METHOD:CANCEL, UID==booking.id, SEQUENCE:1, STATUS:CANCELLED, contentType method=CANCEL
  - [ ] [#10] Email-prefetch defense — resolveCancelToken (GET path equivalent) does NOT mutate row, before/after snapshot equal
- [ ] Test imports use existing Plan 05-08 vitest aliases for Turnstile + email-sender mocks; ZERO new aliases added
- [ ] Owner-path coverage in [#8a]+[#8b] calls `cancelBooking()` directly (NOT `cancelBookingAsOwner` Server Action) with documented reason: vitest+node has no Next request context for the Server Action's RLS pre-check. Server Action wrapper coverage is moved to Manual QA Step 6.
- [ ] afterAll deletes ALL inserted bookings AND ALL inserted rate_limit_events rows
- [ ] `npm test -- tests/cancel-reschedule-api.test.ts` exits 0
- [ ] Full `npm test` exits 0 (no Phase 1-5 regressions)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (Task 1 + Task 2 = 2 commits; Task 3 produces 1 commit when Andrew signs off)
- [ ] Manual QA Task 3 completed with Andrew's sign-off line filled in (Phase 6 IS NOT complete without this)
</success_criteria>

<output>
After Task 2 completes (test suite green), create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-06-SUMMARY.md` documenting:
- Final test count per describe block (and per scenario)
- Final passing tests baseline (Phase 1-5 + Plan 06-06)
- Mock pattern reused from Plan 05-08 — ZERO new vitest aliases
- The owner-path coverage compromise: tests call `cancelBooking()` directly because vitest+node lacks Next request context for the Server Action's RLS pre-check; the Server Action wrapper itself is exercised by Manual QA Step 6
- Confirmation: rate-limit cleanup wired (rate_limit_events rows tagged `cancel:test-ip-*` / `reschedule:test-ip-*` are deleted in afterAll)
- Confirmation: .ics shape assertions use multiline regex against ical-generator output (CRLF-tolerant, full-line match)
- Manual QA status: pending Andrew's sign-off (or, after sign-off: completed [date])
- Phase 6 completion gating: per Andrew's CLAUDE.md, Phase 6 is COMPLETE only after manual QA sign-off, regardless of automated test status
</output>
</content>
</invoke>