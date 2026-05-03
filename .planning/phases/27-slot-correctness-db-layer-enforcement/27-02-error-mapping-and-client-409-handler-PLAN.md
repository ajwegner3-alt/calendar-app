---
phase: 27-slot-correctness-db-layer-enforcement
plan: 02
type: execute
wave: 2
depends_on: ["27-01"]
files_modified:
  - app/api/bookings/route.ts
  - lib/bookings/reschedule.ts
  - app/api/reschedule/route.ts
  - app/[account]/[event-slug]/_components/booking-form.tsx
autonomous: true
must_haves:
  truths:
    - "POST /api/bookings on a 23P01 returns HTTP 409 with body code 'CROSS_EVENT_CONFLICT' and a generic error message that does NOT mention event types or other appointments."
    - "On 23P01 in app/api/bookings/route.ts, the retry loop BREAKS immediately and slot_index is NOT incremented (V14-MP-01)."
    - "lib/bookings/reschedule.ts maps 23P01 to reason 'slot_taken' (V14-MP-02), so /api/reschedule returns its existing 409 SLOT_TAKEN body unchanged."
    - "The booking-form 409 handler treats CROSS_EVENT_CONFLICT exactly like SLOT_TAKEN — same banner, same auto-refresh-and-retry, same generic message (no event-type leak)."
    - "Every 23P01 occurrence is logged via console.error with at minimum: { code, account_id, event_type_id }. No PII (no booker_email, booker_name, booker_phone) appears in the log line."
  artifacts:
    - path: "app/api/bookings/route.ts"
      provides: "23P01 handler placed BEFORE the 23505 branch in the insert loop, breaks the loop, returns 409 CROSS_EVENT_CONFLICT, logs occurrence."
      contains: "code === \"23P01\""
    - path: "lib/bookings/reschedule.ts"
      provides: "23P01 → 'slot_taken' reason mapping placed beside the existing 23505 mapping at line ~149."
      contains: "code === \"23P01\""
    - path: "app/api/reschedule/route.ts"
      provides: "Unchanged behavior — already maps reason 'slot_taken' to 409 SLOT_TAKEN. We only verify it still works for the 23P01-derived path."
      contains: "result.reason === \"slot_taken\""
    - path: "app/[account]/[event-slug]/_components/booking-form.tsx"
      provides: "409 branch handles CROSS_EVENT_CONFLICT code with the same generic message as SLOT_TAKEN (no event-type leak)."
      contains: "CROSS_EVENT_CONFLICT"
  key_links:
    - from: "Postgres 23P01 (raised by EXCLUDE constraint from Plan 27-01)"
      to: "HTTP 409 CROSS_EVENT_CONFLICT response body"
      via: "app/api/bookings/route.ts new branch BEFORE the 23505 branch"
      pattern: "if \\(result\\.error\\.code === \"23P01\"\\)"
    - from: "Postgres 23P01 in reschedule UPDATE"
      to: "rescheduleBooking() returning { ok: false, reason: 'slot_taken' }"
      via: "lib/bookings/reschedule.ts new branch beside the existing 23505 branch at ~line 149"
      pattern: "updateError\\.code === \"23P01\""
    - from: "API 409 with code CROSS_EVENT_CONFLICT"
      to: "Booker UI showing the same race-loser message as SLOT_TAKEN"
      via: "booking-form.tsx new conditional in the existing res.status === 409 block"
      pattern: "body409\\?\\.code === \"CROSS_EVENT_CONFLICT\""
---

<objective>
Wire the 23P01 (exclusion_violation) Postgres error from the new EXCLUDE constraint into the application layer so bookers see a graceful 409 race-loser experience, identical to the existing SLOT_TAKEN flow, and so cross-event collisions never leak through as 500s.

Purpose: Phase 27 success criteria #1 (booker gets 409, not 500) and #3 (reschedule of cross-event collision returns 409, not 500) depend entirely on this plan. Without it, the constraint exists but every collision attempt hits the generic 500 INTERNAL branch in route.ts (V14-MP-01) and the generic 500 in reschedule.ts (V14-MP-02). The booker UX would be "Booking failed. Please try again." — which is wrong. The CONTEXT decision is to mirror existing SLOT_TAKEN UX exactly: same generic message, same auto-refresh-and-retry behavior, no event-type leak.

Output:
- New 23P01 branch in `app/api/bookings/route.ts` (BEFORE 23505, breaks retry loop, observability log)
- New 23P01 branch in `lib/bookings/reschedule.ts` (mapped to 'slot_taken', observability log)
- Updated 409 handler in `app/[account]/[event-slug]/_components/booking-form.tsx` (CROSS_EVENT_CONFLICT → same generic message as SLOT_TAKEN)
- `app/api/reschedule/route.ts` unchanged but verified — its existing `slot_taken` → 409 SLOT_TAKEN mapping is reused for the 23P01-derived path so reschedules stay generic.
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

# Files this plan modifies (read full files before editing):
@app/api/bookings/route.ts
@lib/bookings/reschedule.ts
@app/api/reschedule/route.ts
@app/[account]/[event-slug]/_components/booking-form.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add 23P01 branch to app/api/bookings/route.ts (before 23505, breaks retry loop, logs occurrence)</name>
  <files>app/api/bookings/route.ts</files>
  <action>
    Locate the booking insert retry loop. The relevant block is around lines 235-273 in the current file. The structure today is:

    ```ts
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
    // 23505 = ... try next slot_index ...
    ```

    Then below the loop:

    ```ts
    if (!booking) {
      if (insertError?.code === "23505") {
        // ... map to SLOT_TAKEN / SLOT_CAPACITY_REACHED
      }
      // Non-capacity error: 500 INTERNAL
    }
    ```

    **Add the 23P01 branch INSIDE the retry loop, BEFORE the `code !== "23505"` check, AND BEFORE the loop's "try next slot_index" path.** The exact placement:

    ```ts
    if (!result.error) {
      booking = result.data as BookingRow;
      insertError = null;
      break;
    }

    insertError = result.error;

    // V14-MP-01 (Phase 27): 23P01 is the EXCLUDE constraint
    // bookings_no_account_cross_event_overlap firing — the booker is trying to
    // claim a slot already held by a DIFFERENT event type on the same account.
    // This is NOT a same-event-type capacity race, so retrying with another
    // slot_index would be infinite (the cross-event collision is independent
    // of slot_index). BREAK immediately. Loop must NOT increment slot_index.
    if (result.error.code === "23P01") {
      // Observability: distinct log signal so we can monitor cross-event
      // collisions in prod. No PII — only structural identifiers.
      console.error("[/api/bookings] 23P01 cross-event overlap", {
        code: "CROSS_EVENT_CONFLICT",
        account_id: account.id,
        event_type_id: eventType.id,
      });
      break;
    }

    if (result.error.code !== "23505") {
      // Non-capacity error: do not retry. Propagate immediately.
      break;
    }
    ```

    Then in the post-loop `if (!booking)` block, ADD a new branch BEFORE the existing 23505 branch:

    ```ts
    if (!booking) {
      // V14-MP-01 (Phase 27): map 23P01 to 409 CROSS_EVENT_CONFLICT.
      // Generic wording — no event-type leak (booker has no concept of event types).
      if (insertError?.code === "23P01") {
        return NextResponse.json(
          {
            error: "That time is no longer available. Please choose a different time.",
            code: "CROSS_EVENT_CONFLICT",
          },
          { status: 409, headers: NO_STORE },
        );
      }

      if (insertError?.code === "23505") {
        // ... existing SLOT_TAKEN / SLOT_CAPACITY_REACHED branching unchanged
      }
      // ... existing 500 INTERNAL fallthrough unchanged
    }
    ```

    Use the EXACT message string `"That time is no longer available. Please choose a different time."` — this matches the booking-form's defensive fallback at line ~137 today, which keeps copy consistent across SLOT_TAKEN, SLOT_CAPACITY_REACHED, and CROSS_EVENT_CONFLICT (all "pick a different time" generic).

    **DO NOT MODIFY** the 23505 branches, the SLOT_CAPACITY_REACHED logic, the slot_index iteration, or any other handler logic. Surgical insert only.

    Update the JSDoc Response shapes block at the top of the file (around lines 47-54) to include the new code:

    ```
    *   409 → { error: string; code: "CROSS_EVENT_CONFLICT" } ← cross-event-type overlap (V14-MP-01)
    ```

    Add it as a new line BETWEEN the SLOT_CAPACITY_REACHED line and the 429 RATE_LIMITED line.
  </action>
  <verify>
    - Open `app/api/bookings/route.ts`. Confirm:
      - The retry loop now has an `if (result.error.code === "23P01")` branch positioned BEFORE the `if (result.error.code !== "23505")` check.
      - That branch calls `console.error` with `{ code, account_id, event_type_id }` and no PII fields.
      - That branch does `break` (does NOT continue / does NOT increment slot_index).
      - The post-loop `if (!booking)` block has a new `if (insertError?.code === "23P01")` branch BEFORE the existing `if (insertError?.code === "23505")` branch.
      - The new branch returns `NextResponse.json({ error: "...", code: "CROSS_EVENT_CONFLICT" }, { status: 409, headers: NO_STORE })`.
      - The JSDoc response shapes block lists the new 409 CROSS_EVENT_CONFLICT line.
    - Run `npm run build` (or the project's build command) and confirm no TypeScript errors. (Existing test suite need not be re-run yet — that's Plan 27-03.)
  </verify>
  <done>
    Cross-event INSERT collisions return HTTP 409 with code CROSS_EVENT_CONFLICT and generic copy. Retry loop breaks immediately on 23P01 (no slot_index increment). Each occurrence logs `[/api/bookings] 23P01 cross-event overlap` with structural identifiers and zero PII. Build passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add 23P01 branch to lib/bookings/reschedule.ts (mapped to 'slot_taken') + observability log</name>
  <files>lib/bookings/reschedule.ts</files>
  <action>
    Locate the existing error-handling block at line ~148 in `lib/bookings/reschedule.ts`. Current structure:

    ```ts
    if (updateError) {
      if (updateError.code === "23505") {
        // bookings_no_double_book fired — target slot is taken (RESEARCH Pitfall 5)
        return { ok: false, reason: "slot_taken" };
      }
      if (updateError.code === "PGRST116") {
        ...
      }
      console.error("[reschedule] update error:", updateError);
      return { ok: false, reason: "db_error", error: updateError.message };
    }
    ```

    **Add the 23P01 branch IMMEDIATELY AFTER the existing 23505 branch.** The new branch maps 23P01 to the same `'slot_taken'` reason so the upstream `/api/reschedule` route continues returning its existing 409 SLOT_TAKEN body unchanged (no new code path, no copy change, no event-type leak — this is the CONTEXT-locked decision).

    ```ts
    if (updateError) {
      if (updateError.code === "23505") {
        // bookings_no_double_book fired — target slot is taken (RESEARCH Pitfall 5)
        return { ok: false, reason: "slot_taken" };
      }
      // V14-MP-02 (Phase 27): 23P01 is the EXCLUDE constraint
      // bookings_no_account_cross_event_overlap firing on the in-place UPDATE.
      // The booker is trying to reschedule into a time held by a DIFFERENT
      // event type on the same account. Map to 'slot_taken' so the upstream
      // /api/reschedule handler returns its existing 409 SLOT_TAKEN response —
      // generic copy, no event-type leak (CONTEXT-locked).
      if (updateError.code === "23P01") {
        // Observability: distinct log signal for prod monitoring. No PII.
        console.error("[reschedule] 23P01 cross-event overlap", {
          code: "CROSS_EVENT_CONFLICT",
          booking_id: bookingId,
        });
        return { ok: false, reason: "slot_taken" };
      }
      if (updateError.code === "PGRST116") {
        ...
      }
      ...
    }
    ```

    NOTE on log fields: at this layer we have `bookingId` in scope but NOT `account_id` or `event_type_id` (the SELECT in the function only fetches `start_at, status, event_types(...), accounts(...)` for email composition). `bookingId` is sufficient for correlation — the row can be looked up post-hoc. Do NOT add a separate query just to enrich the log line.

    **DO NOT MODIFY** the existing 23505 branch, the PGRST116 branch, the db_error fallthrough, or anything else.
  </action>
  <verify>
    - Open `lib/bookings/reschedule.ts`. Confirm:
      - A new `if (updateError.code === "23P01")` block exists IMMEDIATELY AFTER the existing 23505 block and BEFORE the PGRST116 block.
      - The new block returns `{ ok: false, reason: "slot_taken" }` (NOT a new reason).
      - The new block calls `console.error("[reschedule] 23P01 cross-event overlap", { code, booking_id })` with no PII.
    - Read `app/api/reschedule/route.ts` lines 90-96 — verify `result.reason === "slot_taken"` already maps to a 409 with body `{ error: "...", code: "SLOT_TAKEN" }`. NO CHANGES needed there; we are deliberately reusing the existing mapping.
    - Run `npm run build`; confirm no TypeScript errors.
  </verify>
  <done>
    A reschedule UPDATE that triggers the EXCLUDE constraint returns 409 SLOT_TAKEN (not 500), via the existing `slot_taken` reason. Logs `[reschedule] 23P01 cross-event overlap` with `{ code, booking_id }` and zero PII. Build passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update booking-form.tsx 409 handler to recognize CROSS_EVENT_CONFLICT (mirrors SLOT_TAKEN UX, generic message, no event-type leak)</name>
  <files>app/[account]/[event-slug]/_components/booking-form.tsx</files>
  <action>
    Locate the 409 handler at lines ~122-143 in `app/[account]/[event-slug]/_components/booking-form.tsx`. Current shape:

    ```tsx
    if (res.status === 409) {
      const body409 = (await res.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      let raceMessage: string;
      if (body409?.code === "SLOT_CAPACITY_REACHED") {
        raceMessage = "That time is fully booked. Please choose a different time.";
      } else if (body409?.code === "SLOT_TAKEN") {
        raceMessage = "That time was just taken by another booker. Please choose a different time.";
      } else {
        raceMessage = body409?.error ?? "That time is no longer available. Please choose a different time.";
      }
      props.onRaceLoss(raceMessage);
      turnstileRef.current?.reset();
      return;
    }
    ```

    **Add a CROSS_EVENT_CONFLICT branch.** Per CONTEXT-locked decision: generic wording, no event-type leak, no contractor-other-appointment hint. Insert BETWEEN the SLOT_TAKEN branch and the defensive fallback:

    ```tsx
    if (res.status === 409) {
      const body409 = (await res.json().catch(() => null)) as {
        code?: string;
        error?: string;
      } | null;
      let raceMessage: string;
      if (body409?.code === "SLOT_CAPACITY_REACHED") {
        // CAP-07: slot had capacity>1 but all seats are now taken
        raceMessage = "That time is fully booked. Please choose a different time.";
      } else if (body409?.code === "SLOT_TAKEN") {
        // CAP-07: capacity=1 race (or any single-seat taken path)
        raceMessage = "That time was just taken by another booker. Please choose a different time.";
      } else if (body409?.code === "CROSS_EVENT_CONFLICT") {
        // V14-MP-01 (Phase 27): cross-event-type overlap (DB EXCLUDE constraint).
        // Generic wording — booker has no concept of event types and we do NOT
        // leak that the contractor has another appointment.
        raceMessage = "That time is no longer available. Please choose a different time.";
      } else {
        // Defensive fallback — unknown code or missing body
        raceMessage = body409?.error ?? "That time is no longer available. Please choose a different time.";
      }
      props.onRaceLoss(raceMessage);
      turnstileRef.current?.reset();
      return;
    }
    ```

    Note: `props.onRaceLoss(raceMessage)` already triggers parent behavior — clears `selectedSlot`, bumps `refetchKey` to refresh the slot picker. This is the existing slot_taken auto-refresh-and-retry behavior. Mirroring it for CROSS_EVENT_CONFLICT requires NO extra wiring — just the new branch.

    **DO NOT MODIFY** anything else in this file. No new state, no new prop, no UI surface change.
  </action>
  <verify>
    - Open `app/[account]/[event-slug]/_components/booking-form.tsx`. Confirm:
      - The 409 handler now has THREE explicit code branches (SLOT_CAPACITY_REACHED, SLOT_TAKEN, CROSS_EVENT_CONFLICT) plus the defensive fallback.
      - The CROSS_EVENT_CONFLICT message is `"That time is no longer available. Please choose a different time."` — generic, no event-type or contractor-appointment language.
      - No new state variables, no new props, no JSX changes — only the conditional was extended.
    - Run `npm run build`; confirm no TypeScript errors.
  </verify>
  <done>
    Booker who hits a CROSS_EVENT_CONFLICT 409 sees the same race-loser banner UX as SLOT_TAKEN: generic copy, slot picker auto-refreshes, form values preserved, Turnstile resets. No event-type leak in the message string.
  </done>
</task>

</tasks>

<verification>
- POST /api/bookings on a 23P01 returns HTTP 409 with body `{ error: "That time is no longer available. Please choose a different time.", code: "CROSS_EVENT_CONFLICT" }` and a `console.error` log line with `{ code, account_id, event_type_id }`.
- The retry loop in `app/api/bookings/route.ts` does NOT increment `slot_index` after a 23P01 (verified by reading the code: `break` is the only post-23P01 control flow).
- `lib/bookings/reschedule.ts` returns `{ ok: false, reason: "slot_taken" }` on 23P01 and logs `[reschedule] 23P01 cross-event overlap`.
- `app/api/reschedule/route.ts` is unchanged and continues to map `reason: "slot_taken"` → 409 SLOT_TAKEN.
- `app/[account]/[event-slug]/_components/booking-form.tsx` has a CROSS_EVENT_CONFLICT branch in the 409 handler with generic copy.
- `npm run build` passes.
- No PII (booker_email, booker_name, booker_phone, ip) appears in any new console.error call — grep the diff to confirm.
- Test suite still has 224 passing + 4 skipped (no test-affecting changes; Plan 27-03 adds the new test file).
</verification>

<success_criteria>
A booker who attempts to book a time held by a different event type on the same account now sees a graceful "pick a different time" experience (Phase 27 success criteria #1). A reschedule into such a time returns 409 (Phase 27 success criteria #3) instead of 500. All 23P01 occurrences are logged for production monitoring. The booker UI does NOT leak that the contractor has another appointment or that event types exist (CONTEXT-locked decision).
</success_criteria>

<output>
After completion, create `.planning/phases/27-slot-correctness-db-layer-enforcement/27-02-SUMMARY.md` documenting:
- Exact diff of `app/api/bookings/route.ts` (the new 23P01 in-loop branch + the new post-loop 23P01 branch + the JSDoc update)
- Exact diff of `lib/bookings/reschedule.ts` (the new 23P01 branch)
- Exact diff of `app/[account]/[event-slug]/_components/booking-form.tsx` (the new 409 conditional)
- Confirmation that `app/api/reschedule/route.ts` was inspected and intentionally NOT modified
- Confirmation that `npm run build` passed
- The exact 409 message strings for SLOT_TAKEN, SLOT_CAPACITY_REACHED, and CROSS_EVENT_CONFLICT side-by-side, so a future test can lock the wording
</output>
