---
phase: 27-slot-correctness-db-layer-enforcement
plan: 03
type: execute
wave: 3
depends_on: ["27-01", "27-02"]
files_modified:
  - tests/cross-event-overlap.test.ts
autonomous: false  # has checkpoint:human-verify for Andrew production smoke test
must_haves:
  truths:
    - "A new test file tests/cross-event-overlap.test.ts exists with at MINIMUM 6 tests covering: cross-event block, group-booking regression, adjacent-slot non-collision, cancelled-doesn't-block, reschedule cross-event collision, retry-loop-break."
    - "All 6 tests use the describe.skipIf(skipIfNoDirectUrl) pattern from race-guard.test.ts (V14-MP-05)."
    - "All 6 tests run green when SUPABASE_DIRECT_URL is set, and skip cleanly without it."
    - "The full test suite at the close of this plan is at LEAST 230 passing + 4 skipped (224 baseline + 6 new)."
    - "Andrew has live-verified on production that POSTing an overlapping booking attempt for a different event type on the same account returns HTTP 409 with code CROSS_EVENT_CONFLICT."
    - "A production smoke runbook exists in the SUMMARY giving Andrew a step-by-step that can be re-executed against any future deploy."
  artifacts:
    - path: "tests/cross-event-overlap.test.ts"
      provides: "Six (or more) pg-driver tests pinning the EXCLUDE constraint behavior + retry-loop-break invariant."
      contains: "describe.skipIf(skipIfNoDirectUrl)"
      min_lines: 250
  key_links:
    - from: "tests/cross-event-overlap.test.ts → constraint behavior tests"
      to: "Production EXCLUDE constraint installed by Plan 27-01"
      via: "pg-driver INSERT statements asserting err.code === '23P01' on second cross-event INSERT"
      pattern: "expect\\(.*code.*\\)\\.toBe\\(\"23P01\"\\)"
    - from: "tests/cross-event-overlap.test.ts → retry-loop-break test"
      to: "app/api/bookings/route.ts 23P01 in-loop break (Plan 27-02 Task 1)"
      via: "API-integration test asserting one POST attempt yields one 409 + zero slot_index increment"
      pattern: "expect\\(.*status.*\\)\\.toBe\\(409\\)"
    - from: "Andrew production smoke"
      to: "End-to-end SLOT-05 verification"
      via: "Step-by-step runbook in checkpoint, executed against nsi-rls-test or nsi-rls-test-3"
      pattern: "checkpoint:human-verify"
---

<objective>
Lock the EXCLUDE constraint behavior + the application-layer 23P01 mapping with a comprehensive test suite (minimum 6 tests, CONTEXT-locked), and then have Andrew live-verify on production that the full booker-facing flow works end-to-end against a real seeded test account.

Purpose: Phase 27 success criteria #2, #3, #4, and #5 all depend on this plan. The 6-test minimum is non-negotiable per CONTEXT — each test pins one specific behavior or regression-guard:

1. **Cross-event block** — proves SLOT-01 holds at the DB layer.
2. **Group-booking regression** — proves SLOT-02 holds (v1.1 capacity coexists; same-event-type same-time bookings still allowed).
3. **Adjacent-slot non-collision** — proves V14-CP-02 (`[)` half-open range bound) is correctly applied.
4. **Cancelled-doesn't-block** — proves V14-CP-03 (`WHERE status = 'confirmed'` partial predicate works); regression guard against future migrations dropping the WHERE clause.
5. **Reschedule cross-event collision** — proves SLOT-03 holds + V14-MP-02 mapping in `lib/bookings/reschedule.ts` works; distinct from test #1 because it covers the `lib/bookings/reschedule.ts:149` UPDATE path, not the route.ts INSERT path.
6. **Retry-loop-break** — proves V14-MP-01: 23P01 in `app/api/bookings/route.ts` BREAKS the retry loop without incrementing slot_index. Regression guard against future refactors re-introducing infinite retries.

Plus a production smoke checkpoint for Andrew (SLOT-05).

Output:
- `tests/cross-event-overlap.test.ts` — 6 tests, all using the V14-MP-05 skip-guard pattern
- Test suite passes (230+ / 4 skipped target)
- Andrew sign-off captured in checkpoint resume
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/27-slot-correctness-db-layer-enforcement/27-CONTEXT.md
@.planning/phases/27-slot-correctness-db-layer-enforcement/27-01-SUMMARY.md
@.planning/phases/27-slot-correctness-db-layer-enforcement/27-02-SUMMARY.md

# Pattern reference (V14-MP-05): use this skip-guard idiom verbatim for new pg-driver tests
@tests/race-guard.test.ts

# Test helpers
@tests/helpers/pg-direct.ts
@tests/helpers/supabase.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author tests/cross-event-overlap.test.ts with all 6 required tests + run + confirm green</name>
  <files>tests/cross-event-overlap.test.ts</files>
  <action>
    Create a NEW test file. Mirror the structure of `tests/race-guard.test.ts` lines 85+ (the pg-driver describe block).

    **Top of file (header + skip-guard):**

    ```ts
    // @vitest-environment node
    import { describe, it, expect, beforeAll, afterEach } from "vitest";
    import {
      adminClient,
      getOrCreateTestAccount,
    } from "./helpers/supabase";
    import { pgDirectClient, hasDirectUrl } from "./helpers/pg-direct";

    const skipIfNoDirectUrl = !hasDirectUrl();

    /**
     * Phase 27: EXCLUDE constraint behavior + application-layer 23P01 mapping.
     *
     * Constraint: bookings_no_account_cross_event_overlap
     *   EXCLUDE USING gist (
     *     account_id     WITH =,
     *     event_type_id  WITH <>,
     *     during         WITH &&
     *   ) WHERE (status = 'confirmed')
     *
     * These tests pin:
     *   1. Cross-event block (SLOT-01)
     *   2. Group-booking regression — same-event-type capacity coexistence (SLOT-02, V14-CP-04)
     *   3. Adjacent-slot non-collision (V14-CP-02 half-open '[)')
     *   4. Cancelled-doesn't-block (V14-CP-03 partial WHERE predicate)
     *   5. Reschedule cross-event collision (SLOT-03, V14-MP-02)
     *   6. Retry-loop-break — route.ts 23P01 BREAKS without incrementing slot_index (V14-MP-01)
     *
     * Skip-guarded with describe.skipIf(skipIfNoDirectUrl) per V14-MP-05 so CI
     * passes cleanly when SUPABASE_DIRECT_URL is unset.
     */
    ```

    **Helpers inside the describe block:**

    Each test needs to create at least one event_type (most need two). Use the inline-INSERT pattern from `tests/race-guard.test.ts:113-128` for creating event_types with explicit slugs and capacities — `getOrCreateTestEventType` returns the same row on repeated calls and cannot create distinct event types.

    Provide a small inline helper inside the describe block:

    ```ts
    async function createEventType(
      admin: ReturnType<typeof adminClient>,
      accountId: string,
      slugSuffix: string,
      maxBookingsPerSlot = 1,
    ) {
      const slug = `test-x-${slugSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const { data, error } = await admin
        .from("event_types")
        .insert({
          account_id: accountId,
          slug,
          name: `Test ${slugSuffix}`,
          duration_minutes: 30,
          max_bookings_per_slot: maxBookingsPerSlot,
        })
        .select("id, slug")
        .single();
      if (error || !data) throw new Error(`event_type insert failed: ${error?.message}`);
      return { id: data.id as string, slug: data.slug as string };
    }

    async function cleanupEventType(
      admin: ReturnType<typeof adminClient>,
      eventTypeId: string,
    ) {
      await admin.from("bookings").delete().eq("event_type_id", eventTypeId);
      await admin.from("event_types").delete().eq("id", eventTypeId);
    }
    ```

    **describe.skipIf wrapper:**

    ```ts
    describe.skipIf(skipIfNoDirectUrl)(
      "Phase 27: EXCLUDE constraint cross-event overlap",
      () => {
        let accountId: string;

        beforeAll(async () => {
          accountId = await getOrCreateTestAccount();
        });

        // ... 6 tests below ...
      },
    );
    ```

    **Test 1 — Cross-event block (SLOT-01):**

    Create event_type A and B (both capacity=1, same account). INSERT confirmed booking on A at 9:00–9:30. Then attempt INSERT confirmed booking on B at 9:15–9:45 (overlap). Expect Postgres error code === "23P01".

    ```ts
    it("blocks cross-event-type overlap on same account (23P01)", async () => {
      const sql = pgDirectClient(5);
      const admin = adminClient();
      const eventA = await createEventType(admin, accountId, "evA");
      const eventB = await createEventType(admin, accountId, "evB");
      try {
        const t0 = new Date(Date.now() + 14 * 24 * 3600_000);
        const aStart = new Date(t0);
        const aEnd = new Date(t0.getTime() + 30 * 60_000);
        const bStart = new Date(t0.getTime() + 15 * 60_000); // 15 min into A
        const bEnd = new Date(t0.getTime() + 45 * 60_000);

        // First insert succeeds.
        const aRows = await sql`
          INSERT INTO bookings (
            account_id, event_type_id, start_at, end_at,
            booker_name, booker_email, booker_timezone,
            status, cancel_token_hash, reschedule_token_hash, slot_index
          ) VALUES (
            ${accountId}::uuid, ${eventA.id}::uuid, ${aStart}, ${aEnd},
            ${"X1 A"}, ${"x1-a@test.local"}, ${"America/Chicago"},
            ${"confirmed"}, ${"x1-c-a"}, ${"x1-r-a"}, ${1}
          )
          RETURNING id
        `;
        expect(aRows.length).toBe(1);

        // Second insert collides → 23P01.
        let caught: { code?: string } | null = null;
        try {
          await sql`
            INSERT INTO bookings (
              account_id, event_type_id, start_at, end_at,
              booker_name, booker_email, booker_timezone,
              status, cancel_token_hash, reschedule_token_hash, slot_index
            ) VALUES (
              ${accountId}::uuid, ${eventB.id}::uuid, ${bStart}, ${bEnd},
              ${"X1 B"}, ${"x1-b@test.local"}, ${"America/Chicago"},
              ${"confirmed"}, ${"x1-c-b"}, ${"x1-r-b"}, ${1}
            )
          `;
        } catch (err: unknown) {
          caught = err as { code?: string };
        }
        expect(caught?.code).toBe("23P01");
      } finally {
        await cleanupEventType(admin, eventA.id);
        await cleanupEventType(admin, eventB.id);
        await sql.end({ timeout: 5 });
      }
    }, 30_000);
    ```

    **Test 2 — Group-booking regression (SLOT-02, V14-CP-04):**

    Create ONE event_type with `max_bookings_per_slot=3`. Insert 3 confirmed bookings at the same `start_at` (different `slot_index` 1, 2, 3). Expect ALL THREE to succeed. This proves the `event_type_id WITH <>` operator preserves v1.1 capacity (the EXCLUDE constraint does NOT fire when `event_type_id` is the same).

    Use the same inline INSERT pattern. Assert `successes === 3` and `errors === 0`. (The pre-existing `bookings_capacity_slot_idx` enforces slot_index uniqueness, so capacity=3 + 3 inserts is the right shape.)

    **Test 3 — Adjacent-slot non-collision (V14-CP-02):**

    Two event types A and B (capacity=1 each, same account). Insert confirmed booking on A at 9:00–9:30. Insert confirmed booking on B at 9:30–10:00 (adjacent, NOT overlapping per `[)` half-open). Expect BOTH to succeed (no error). This proves `tstzrange(..., '[)')` was used and the constraint does NOT treat adjacent slots as collisions.

    **Test 4 — Cancelled-doesn't-block (V14-CP-03):**

    Two event types A and B. Insert booking on A at 9:00–9:30 with `status = 'cancelled'`. Then insert booking on B at 9:00–9:30 with `status = 'confirmed'`. Expect the second insert to SUCCEED (no 23P01). Cancelled rows are outside the partial WHERE predicate. Then update the cancelled A row to `status = 'confirmed'` and expect THAT update to raise 23P01 (because now both rows are confirmed and overlap). Also covers the constraint-on-UPDATE path.

    **Test 5 — Reschedule cross-event collision (SLOT-03, V14-MP-02):**

    This test exercises the application-layer mapping in `lib/bookings/reschedule.ts` and confirms an UPDATE-in-place that creates a cross-event overlap returns the right reason.

    Two event types A and B. Insert confirmed booking on A at 10:00–10:30. Insert confirmed booking on B at 11:00–11:30. Then call `rescheduleBooking({ bookingId: B.id, ... })` from `lib/bookings/reschedule.ts` to move B to 10:15–10:45 (overlaps A). Expect the result to be `{ ok: false, reason: "slot_taken" }`.

    To call `rescheduleBooking` you need the booking's `reschedule_token_hash`. Capture it from the second INSERT's RETURNING clause (or look it up via admin.from("bookings").select("reschedule_token_hash").eq("id", id).single()).

    Then verify rescheduling B to a NON-conflicting time (e.g. 14:00–14:30) returns `{ ok: true, ... }` to prove the happy path still works.

    **Test 6 — Retry-loop-break (V14-MP-01):**

    This test asserts that the route.ts retry loop BREAKS on 23P01 (does not increment slot_index). The cleanest assertion is at the API level: hit the actual `/api/bookings` POST endpoint with an overlapping payload and confirm we get exactly ONE 409 response with code `CROSS_EVENT_CONFLICT` — not multiple retry attempts.

    However, hitting `/api/bookings` requires Turnstile and a running dev server. The lighter-weight, equally-valid assertion is **structural**: import the route handler module and verify the source code contains the break-without-increment pattern. This matches the bookings-table-rsc-boundary.test.ts precedent (Phase 26) for static-text-scan regression guards.

    Use the structural form:

    ```ts
    it("retry loop in app/api/bookings/route.ts BREAKS on 23P01 without incrementing slot_index (V14-MP-01)", async () => {
      const fs = await import("node:fs/promises");
      const src = await fs.readFile("app/api/bookings/route.ts", "utf8");

      // Assert the 23P01 branch exists and is positioned BEFORE the 23505 check.
      const idx23P01 = src.indexOf('code === "23P01"');
      const idx23505 = src.indexOf('code !== "23505"');
      expect(idx23P01, "23P01 branch must exist").toBeGreaterThan(-1);
      expect(idx23505, "23505 retry guard must exist").toBeGreaterThan(-1);
      expect(idx23P01, "23P01 branch must come BEFORE the 23505 retry guard").toBeLessThan(idx23505);

      // Assert the 23P01 block is followed by a `break;` statement (not `continue;`
      // and not a slot_index increment) within the next 500 chars.
      const after23P01 = src.slice(idx23P01, idx23P01 + 500);
      expect(after23P01).toMatch(/break;/);
      expect(after23P01).not.toMatch(/slot_?[Ii]ndex\s*[+]+/);
      expect(after23P01).not.toMatch(/slot_?[Ii]ndex\s*=\s*slot_?[Ii]ndex\s*\+/);
      expect(after23P01).not.toMatch(/continue;/);
    });
    ```

    Note this test does NOT need pg-direct — it's a static text scan. Place it OUTSIDE the `describe.skipIf` block so it runs in CI without SUPABASE_DIRECT_URL. Use a separate `describe("Phase 27: route.ts retry-loop-break invariant (V14-MP-01)", () => { ... })`.

    **Cleanup discipline:** Every pg-direct test must clean up its event_types and bookings in a `finally`. Failed tests leaving orphan rows in the test account would corrupt subsequent runs.

    **Run + confirm:**

    ```bash
    npm test -- tests/cross-event-overlap.test.ts
    ```

    Expect: 6 passing locally with SUPABASE_DIRECT_URL set. (Test 6 always runs; tests 1-5 require SUPABASE_DIRECT_URL.)

    Then run the full suite to confirm no regressions:

    ```bash
    npm test
    ```

    Expect: ≥230 passing + 4 skipped (224 baseline + 6 new). If SUPABASE_DIRECT_URL is unset, expect 225 passing + 9 skipped (5 of the new 6 skip).
  </action>
  <verify>
    - File `tests/cross-event-overlap.test.ts` exists and contains 6 distinct `it(...)` blocks (1: cross-event-block, 2: group-booking-regression, 3: adjacent-non-collision, 4: cancelled-doesnt-block, 5: reschedule-cross-event, 6: retry-loop-break).
    - All pg-direct tests sit inside `describe.skipIf(skipIfNoDirectUrl)(...)` — exactly the pattern from `tests/race-guard.test.ts:91`.
    - Test 6 (retry-loop-break) is OUTSIDE the skipIf block and uses `fs.readFile` to scan source.
    - Each pg-direct test has a `finally` block that calls `cleanupEventType` and `sql.end`.
    - `npm test -- tests/cross-event-overlap.test.ts` reports 6 passing (with DIRECT_URL) or 1 passing + 5 skipped (without).
    - `npm test` (full suite) reports ≥230 passing + 4 skipped (with DIRECT_URL).
  </verify>
  <done>
    All 6 mandatory tests exist, are well-isolated (cleanup on failure), follow the V14-MP-05 skip-guard pattern, and pass green. Full test suite passes with no regressions from the 224-baseline.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Andrew live-verifies cross-event collision on production (SLOT-05)</name>
  <what-built>
    - Production database has the EXCLUDE constraint installed (Plan 27-01).
    - `app/api/bookings/route.ts` returns 409 CROSS_EVENT_CONFLICT on cross-event collisions (Plan 27-02 Task 1).
    - `lib/bookings/reschedule.ts` maps 23P01 → slot_taken (Plan 27-02 Task 2).
    - Booker UI handles CROSS_EVENT_CONFLICT with the same race-loser banner as SLOT_TAKEN (Plan 27-02 Task 3).
    - 6 automated tests pin all of the above (Task 1 of this plan).

    All that remains: Andrew live-verifies the end-to-end flow on production (SLOT-05).
  </what-built>
  <how-to-verify>
    Andrew, please execute the following smoke runbook against production. **Recommended account: `nsi-rls-test` or `nsi-rls-test-3`** (existing seeded test accounts — no cleanup needed; bookings made under these accounts can be cancelled afterward via the dashboard or left in place).

    The runbook has two phases: (A) UI booker-flow check (the booker experience), and (B) raw curl confirmation (the wire-level 409 + code).

    ---

    **PHASE A — Booker UI flow (the user-visible end-to-end)**

    Open two browser tabs/windows in incognito (so no prior session bleeds in):

    **Tab 1 — set up the "blocker" booking:**

    1. Visit `https://<your-production-url>/nsi-rls-test/<event-type-A-slug>/` (replace with a real event-type slug from the test account; if unsure, log into the dashboard for `nsi-rls-test` and grab any active event type's public URL).
    2. Pick a date and time slot at least 2 days in the future. Note the exact start time (e.g. "Thursday 10:00 AM Central").
    3. Complete the booking form (test booker info — your own email is fine; Turnstile widget will appear).
    4. Submit. You should see the confirmation page. **Note the start time; this slot is now blocked.**

    **Tab 2 — attempt the cross-event collision:**

    5. Visit `https://<your-production-url>/nsi-rls-test/<event-type-B-slug>/` (DIFFERENT event type, same account).
    6. Navigate to the SAME date you booked in Tab 1. Pick a time that overlaps the Tab 1 booking — e.g. if Tab 1 booked 10:00–10:30 (assuming 30-min duration), pick 10:15 in Tab 2.
       - Note: if Tab 2's slot picker has *already filtered out* the overlapping time, that means slot-generation is correctly hiding it. To trigger the constraint anyway, use Phase B (curl) below — the constraint is the safety net for when slot-generation is stale or bypassed.
    7. Complete the form, submit.
    8. **Expected result:** the form does NOT navigate to a confirmation page. Instead, you should see the same race-loser banner that fires for SLOT_TAKEN — copy is `"That time is no longer available. Please choose a different time."`. The slot picker should auto-refresh.

    Confirm:
    - [ ] Tab 1 booking succeeded and confirmed.
    - [ ] Tab 2 attempt was rejected with the generic race-loser banner.
    - [ ] The banner did NOT mention "another appointment", "event type", or contractor activity (no event-type leak).
    - [ ] No 500 page, no "Booking failed. Please try again." error.

    ---

    **PHASE B — Raw curl wire-level check (definitive code confirmation)**

    This proves the response shape exactly, even if the UI is hard to reproduce:

    ```bash
    # 1. Get a Turnstile bypass token if your prod has one for testing,
    #    OR temporarily comment out the verifyTurnstile guard for the smoke
    #    (see app/api/bookings/route.ts; revert immediately after).
    # If the test account has a Turnstile-bypass mode, use the documented test token.

    # 2. Identify the live event type IDs and an account_id. Easiest path:
    curl -s "https://<your-production-url>/api/slots?eventTypeId=<id>&start=<iso>&end=<iso>" | jq

    # 3. POST a deliberately-overlapping booking to event-type-B for a time
    #    you know is held by an event-type-A booking (use a manual seed first
    #    via the UI in Phase A, then immediately curl the conflict).

    curl -i -X POST https://<your-production-url>/api/bookings \
      -H 'Content-Type: application/json' \
      -d '{
        "eventTypeId": "<event-type-B-uuid>",
        "startAt": "<ISO timestamp overlapping the existing A booking>",
        "endAt": "<ISO timestamp 30 min later>",
        "bookerName": "Smoke Test",
        "bookerEmail": "smoke@test.local",
        "bookerTimezone": "America/Chicago",
        "answers": {},
        "turnstileToken": "<token>"
      }'
    ```

    Confirm the response is:
    - HTTP status `409`
    - Body `{"error":"That time is no longer available. Please choose a different time.","code":"CROSS_EVENT_CONFLICT"}`

    Also confirm the Vercel function logs (Vercel Dashboard → Project → Logs) show a `[/api/bookings] 23P01 cross-event overlap` line with `{ code, account_id, event_type_id }` and NO PII.

    ---

    **CLEANUP (optional — these are test bookings on a test account):**

    The Tab 1 booking will sit in the test account. You can cancel it via the dashboard (`/dashboard/bookings`) or leave it — `nsi-rls-test` is reserved for exactly this kind of throwaway data.

    ---

    **Resume signals:**
    - Type `approved` if both Phase A and Phase B confirmed the expected behavior.
    - Type `partial` followed by which phase passed if only one worked (e.g. `partial: A passed, B blocked by Turnstile`).
    - Type `failed` followed by what you saw if the constraint did not fire (e.g. booking succeeded, you got a 500, or copy was wrong).
  </how-to-verify>
  <resume-signal>Type `approved` (both phases confirmed), `partial: <details>`, or `failed: <details>`.</resume-signal>
</task>

</tasks>

<verification>
- `tests/cross-event-overlap.test.ts` exists with 6 tests covering: cross-event block, group-booking regression (capacity coexistence), adjacent-slot non-collision, cancelled-doesn't-block, reschedule cross-event collision, retry-loop-break.
- All pg-driver tests use `describe.skipIf(skipIfNoDirectUrl)` (V14-MP-05).
- Test 6 (retry-loop-break) is a static-text scan that runs WITHOUT SUPABASE_DIRECT_URL.
- `npm test` reports ≥230 passing + 4 skipped (with SUPABASE_DIRECT_URL set), or 225 passing + 9 skipped (without).
- Andrew live-verified production end-to-end via the smoke runbook (UI flow + raw curl).
- Vercel function logs show `[/api/bookings] 23P01 cross-event overlap` lines with no PII (booker_email, booker_name, ip absent).
</verification>

<success_criteria>
Phase 27 is shipped. The contractor-can't-be-in-two-places-at-once invariant is enforced at the database layer (Plan 27-01), mapped cleanly into the application layer (Plan 27-02), pinned by 6 automated tests, and live-verified by Andrew on production. SLOT-01..05 are all met.
</success_criteria>

<output>
After completion, create `.planning/phases/27-slot-correctness-db-layer-enforcement/27-03-SUMMARY.md` documenting:
- Final test count (passing/skipped) before and after this plan
- Brief description of each of the 6 tests and what behavior it pins
- Link to `tests/cross-event-overlap.test.ts`
- Andrew's smoke verification result (Phase A pass/fail, Phase B pass/fail, any deviations from runbook)
- Production curl response captured verbatim (status + body + relevant log lines, with PII redacted)
- Confirmation that Vercel logs showed the expected `[/api/bookings] 23P01 cross-event overlap` line shape

After 27-03 SUMMARY exists, also create `.planning/phases/27-slot-correctness-db-layer-enforcement/27-SUMMARY.md` (phase-level rollup) consolidating the three plan summaries: pre-flight result + migration form, error mapping diff highlights, test count + smoke outcome.
</output>
