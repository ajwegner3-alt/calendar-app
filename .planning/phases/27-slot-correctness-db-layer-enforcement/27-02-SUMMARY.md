---
phase: 27-slot-correctness-db-layer-enforcement
plan: 02
subsystem: api-layer
tags: [postgres-error-mapping, http-409, exclusion-violation, 23P01, race-loser-ux, observability]

# Dependency graph
requires:
  - phase: 27-01
    provides: "Live EXCLUDE constraint bookings_no_account_cross_event_overlap raises Postgres 23P01 on cross-event-type overlap. Generated tstzrange `during` column with half-open '[)' bound."
provides:
  - "POST /api/bookings 23P01 → HTTP 409 { code: 'CROSS_EVENT_CONFLICT' } with generic copy"
  - "lib/bookings/reschedule.ts 23P01 → reason 'slot_taken' (reuses upstream 409 SLOT_TAKEN response unchanged)"
  - "Booker UI 409 handler recognizes CROSS_EVENT_CONFLICT with same race-loser UX as SLOT_TAKEN (no event-type leak)"
  - "Observability: distinct console.error log lines for both 23P01 paths with structural identifiers only (no PII)"
affects:
  - "27-03 (application precheck and ROLLBACK on 23P01) — relies on this plan's 23P01 handler being in place before adding precheck logic"
  - "27-04 (slot correctness verification) — will exercise the 23P01 → 409 path end-to-end"
  - "27-05 (manual QA) — booker UX for cross-event collision is now testable"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Postgres SQLSTATE 23P01 (exclusion_violation) → application 409 with distinct response code (CROSS_EVENT_CONFLICT) — pattern parallels existing 23505 → SLOT_TAKEN/SLOT_CAPACITY_REACHED mapping"
    - "Capacity retry loop break-before-23505-check ordering: 23P01 must short-circuit BEFORE the !=23505 generic-error guard so it doesn't fall through to 500 INTERNAL"
    - "Reuse-existing-reason mapping for cross-error-code consolidation (23P01 → reason 'slot_taken' in reschedule lib) — avoids new code path, new copy, and new test surface for behavior that the booker can't distinguish from a same-event-type race"
    - "PII-free observability log lines: structural identifiers only (account_id, event_type_id, booking_id, code) — never booker_email/name/phone/ip"

key-files:
  created: []
  modified:
    - "app/api/bookings/route.ts (+30 lines: in-loop 23P01 break + log + post-loop 23P01 → 409 CROSS_EVENT_CONFLICT + JSDoc update)"
    - "lib/bookings/reschedule.ts (+14 lines: 23P01 → 'slot_taken' reason + log)"
    - "app/[account]/[event-slug]/_components/booking-form.tsx (+5 lines: CROSS_EVENT_CONFLICT 409 branch with generic message)"

key-decisions:
  - "23P01 in-loop branch placed BEFORE the `code !== 23505` check — placing it after would cause the code-not-23505 guard to break out before the 23P01 detector ran, losing the distinct error path"
  - "23P01 post-loop branch placed BEFORE the existing 23505 branch — both check insertError?.code; ordering ensures the 23P01 path returns its distinct CROSS_EVENT_CONFLICT body instead of falling through to capacity-coded responses"
  - "lib/bookings/reschedule.ts maps 23P01 to existing 'slot_taken' reason rather than introducing a new one — CONTEXT-locked: booker UI should treat both identically (generic 'pick a different time'), and adding a new reason would require parallel changes in reschedule/route.ts and tests for no observable behavior difference"
  - "app/api/reschedule/route.ts deliberately UNTOUCHED — already maps result.reason==='slot_taken' → 409 SLOT_TAKEN; reused as-is for the 23P01-derived path"
  - "CROSS_EVENT_CONFLICT message string locked: 'That time is no longer available. Please choose a different time.' — uses the booking-form's existing defensive-fallback wording for max consistency across SLOT_TAKEN, SLOT_CAPACITY_REACHED, and CROSS_EVENT_CONFLICT"

patterns-established:
  - "Three-layer 23P01 mapping (DB error code → API response code → booker copy) keeps each layer independently testable; future error codes can plug in via the same shape"
  - "Use defensive-fallback wording as the canonical 'unknown race' copy, then promote it to a named branch when a new error code lands. Avoids drift between named and fallback messages."

# Metrics
duration: ~10min
completed: 2026-05-03
---

# Phase 27 Plan 02: Error Mapping & Client 409 Handler Summary

**Postgres 23P01 (exclusion_violation) from the new EXCLUDE constraint is now translated end-to-end: API returns HTTP 409 with code `CROSS_EVENT_CONFLICT`, reschedule reuses the existing 409 SLOT_TAKEN response, and the booker UI mirrors the SLOT_TAKEN race-loser UX with generic copy that does not leak event-type semantics.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-05-03
- **Tasks:** 3 (all `auto`, no checkpoints)
- **Files modified:** 3 (route.ts, reschedule.ts, booking-form.tsx)
- **Files inspected, intentionally untouched:** 1 (`app/api/reschedule/route.ts`)

## Accomplishments

- **POST /api/bookings now returns 409 CROSS_EVENT_CONFLICT on 23P01** instead of falling through to the 500 INTERNAL branch (V14-MP-01 satisfied).
- **Retry loop breaks immediately on 23P01** — `slot_index` is NOT incremented (would have looped infinitely; cross-event collision is independent of slot_index, see V14-MP-01).
- **`/api/reschedule` returns 409 SLOT_TAKEN on 23P01** via the lib's new `'slot_taken'` mapping — no changes to the route handler, no copy drift, no new test surface (V14-MP-02).
- **Booker UX is now graceful for cross-event collisions** — same banner + auto-refresh-and-retry as SLOT_TAKEN, generic message, no contractor-other-appointment leak.
- **Observability hooks in place** — both 23P01 paths log distinct, greppable signal strings (`[/api/bookings] 23P01 cross-event overlap` and `[reschedule] 23P01 cross-event overlap`) with structural identifiers only.
- **Build clean** — `npm run build` passes with no TypeScript errors after each task. Pre-existing test-file TS errors (unrelated to this plan) remain unchanged; they will be addressed in a future test-infrastructure pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 23P01 → CROSS_EVENT_CONFLICT branch in bookings POST** — `e9b792b` (feat)
2. **Task 2: Map 23P01 to slot_taken in reschedule lib** — `0664419` (feat)
3. **Task 3: Handle CROSS_EVENT_CONFLICT in booker 409 handler** — `a5e419c` (feat)

**Plan metadata commit:** (this commit, after SUMMARY write)

## Diffs (verbatim)

### `app/api/bookings/route.ts`

**1. JSDoc Response shapes block (around lines 47-54), new line added between SLOT_CAPACITY_REACHED and 429 RATE_LIMITED:**

```diff
  *   409 → { error: string; code: "SLOT_TAKEN" }            ← capacity=1 race-loser (CAP-07)
  *   409 → { error: string; code: "SLOT_CAPACITY_REACHED" } ← capacity>1 fully booked (CAP-07)
+ *   409 → { error: string; code: "CROSS_EVENT_CONFLICT" } ← cross-event-type overlap (V14-MP-01)
  *   429 → { error: string; code: "RATE_LIMITED" } ← rate-limit path (Retry-After header)
```

**2. In-loop 23P01 branch (added BETWEEN `insertError = result.error;` and the existing `if (result.error.code !== "23505")` check):**

```diff
     insertError = result.error;

+    // V14-MP-01 (Phase 27): 23P01 is the EXCLUDE constraint
+    // bookings_no_account_cross_event_overlap firing — the booker is trying to
+    // claim a slot already held by a DIFFERENT event type on the same account.
+    // This is NOT a same-event-type capacity race, so retrying with another
+    // slot_index would be infinite (the cross-event collision is independent
+    // of slot_index). BREAK immediately. Loop must NOT increment slot_index.
+    if (result.error.code === "23P01") {
+      // Observability: distinct log signal so we can monitor cross-event
+      // collisions in prod. No PII — only structural identifiers.
+      console.error("[/api/bookings] 23P01 cross-event overlap", {
+        code: "CROSS_EVENT_CONFLICT",
+        account_id: account.id,
+        event_type_id: eventType.id,
+      });
+      break;
+    }
+
     if (result.error.code !== "23505") {
       // Non-capacity error: do not retry. Propagate immediately.
       break;
     }
```

**3. Post-loop 23P01 branch (added at the top of `if (!booking) { ... }`, BEFORE the existing 23505 branch):**

```diff
   if (!booking) {
+    // V14-MP-01 (Phase 27): map 23P01 to 409 CROSS_EVENT_CONFLICT.
+    // Generic wording — no event-type leak (booker has no concept of event types).
+    if (insertError?.code === "23P01") {
+      return NextResponse.json(
+        {
+          error: "That time is no longer available. Please choose a different time.",
+          code: "CROSS_EVENT_CONFLICT",
+        },
+        { status: 409, headers: NO_STORE },
+      );
+    }
+
     if (insertError?.code === "23505") {
```

### `lib/bookings/reschedule.ts`

**Added 23P01 branch IMMEDIATELY AFTER the existing 23505 branch and BEFORE the PGRST116 branch:**

```diff
   if (updateError) {
     if (updateError.code === "23505") {
       // bookings_no_double_book fired — target slot is taken (RESEARCH Pitfall 5)
       return { ok: false, reason: "slot_taken" };
     }
+    // V14-MP-02 (Phase 27): 23P01 is the EXCLUDE constraint
+    // bookings_no_account_cross_event_overlap firing on the in-place UPDATE.
+    // The booker is trying to reschedule into a time held by a DIFFERENT
+    // event type on the same account. Map to 'slot_taken' so the upstream
+    // /api/reschedule handler returns its existing 409 SLOT_TAKEN response —
+    // generic copy, no event-type leak (CONTEXT-locked).
+    if (updateError.code === "23P01") {
+      // Observability: distinct log signal for prod monitoring. No PII.
+      console.error("[reschedule] 23P01 cross-event overlap", {
+        code: "CROSS_EVENT_CONFLICT",
+        booking_id: bookingId,
+      });
+      return { ok: false, reason: "slot_taken" };
+    }
     if (updateError.code === "PGRST116") {
```

### `app/[account]/[event-slug]/_components/booking-form.tsx`

**Added CROSS_EVENT_CONFLICT branch in the existing `if (res.status === 409)` block, BETWEEN the SLOT_TAKEN branch and the defensive fallback:**

```diff
       let raceMessage: string;
       if (body409?.code === "SLOT_CAPACITY_REACHED") {
         // CAP-07: slot had capacity>1 but all seats are now taken
         raceMessage = "That time is fully booked. Please choose a different time.";
       } else if (body409?.code === "SLOT_TAKEN") {
         // CAP-07: capacity=1 race (or any single-seat taken path)
         raceMessage = "That time was just taken by another booker. Please choose a different time.";
+      } else if (body409?.code === "CROSS_EVENT_CONFLICT") {
+        // V14-MP-01 (Phase 27): cross-event-type overlap (DB EXCLUDE constraint).
+        // Generic wording — booker has no concept of event types and we do NOT
+        // leak that the contractor has another appointment.
+        raceMessage = "That time is no longer available. Please choose a different time.";
       } else {
         // Defensive fallback — unknown code or missing body
         raceMessage = body409?.error ?? "That time is no longer available. Please choose a different time.";
       }
```

### `app/api/reschedule/route.ts` — INSPECTED, INTENTIONALLY UNTOUCHED

Confirmed lines 90-96 (current file) already contain:

```ts
if (!result.ok) {
  if (result.reason === "slot_taken") {
    return NextResponse.json(
      { error: "That time was just booked. Pick a new time.", code: "SLOT_TAKEN" },
      { status: 409, headers: NO_STORE },
    );
  }
```

Since Task 2 maps 23P01 to `reason: "slot_taken"`, this existing branch produces the correct 409 SLOT_TAKEN body for the 23P01-derived path. Modifying this file would have introduced redundant code paths.

## 409 Message Strings — Side by Side

| Code | HTTP | Server message string | Booker UI message string |
|------|------|----------------------|--------------------------|
| `SLOT_CAPACITY_REACHED` | 409 | `"That time is fully booked. Please choose a different time."` | `"That time is fully booked. Please choose a different time."` |
| `SLOT_TAKEN` (POST /api/bookings) | 409 | `"That time was just booked. Pick a new time below."` | `"That time was just taken by another booker. Please choose a different time."` |
| `SLOT_TAKEN` (POST /api/reschedule) | 409 | `"That time was just booked. Pick a new time."` | (booker reschedule UI not in this plan's scope) |
| `CROSS_EVENT_CONFLICT` (POST /api/bookings) | 409 | `"That time is no longer available. Please choose a different time."` | `"That time is no longer available. Please choose a different time."` |
| (booker UI defensive fallback) | — | (not server-side) | `"That time is no longer available. Please choose a different time."` |

**Wording rationale:**
- All three codes converge on the same generic theme ("pick a different time") to keep the booker focused on action.
- CROSS_EVENT_CONFLICT intentionally matches the defensive-fallback wording exactly, locking the booker UI's wording for unknown 409 codes to a known string.
- SLOT_TAKEN keeps the "by another booker" hint because it IS a same-event-type race (the booker is competing for a public slot). CROSS_EVENT_CONFLICT does NOT mention "another booker" because the conflict is with the contractor's other event-type appointment — leaking that would be a privacy issue.

A future Plan 27-04 verification test can lock these strings against drift via direct equality assertions.

## Build Confirmation

`npm run build` — **passed** (Next.js 15 build, all routes including `/api/bookings`, `/api/reschedule`, and the `/[account]/[event-slug]` booker page compiled successfully). No new TypeScript errors introduced; pre-existing test-file TS errors (unrelated to this plan, in `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, etc.) remain unchanged and are out-of-scope for this plan.

`npx tsc --noEmit` filtered to non-test files: zero errors.

## Verification

| Criterion | Status |
|-----------|--------|
| POST /api/bookings on 23P01 returns 409 CROSS_EVENT_CONFLICT body + generic message | ✓ (route.ts post-loop branch) |
| Retry loop breaks immediately on 23P01; slot_index NOT incremented | ✓ (`break` is the only post-23P01 control flow inside the loop) |
| 23P01 in-loop branch positioned BEFORE the `!= 23505` guard | ✓ (verified in route.ts) |
| 23P01 post-loop branch positioned BEFORE the existing 23505 branch | ✓ (verified in route.ts) |
| lib/bookings/reschedule.ts maps 23P01 → 'slot_taken' reason | ✓ (immediately after 23505 branch, before PGRST116) |
| /api/reschedule continues mapping 'slot_taken' → 409 SLOT_TAKEN unchanged | ✓ (file inspected; not modified) |
| booking-form.tsx 409 handler has CROSS_EVENT_CONFLICT branch with generic copy | ✓ (3 named branches + fallback now) |
| All console.error log lines contain only structural identifiers (no booker_email/name/phone/ip) | ✓ (route.ts: `{ code, account_id, event_type_id }`; reschedule.ts: `{ code, booking_id }`) |
| `npm run build` passes | ✓ |

## Deviations from Plan

None — plan executed exactly as written.

All three tasks landed surgical edits at the documented insertion points. The pre-existing test-file TypeScript errors (`tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, etc.) predate this plan and are explicitly out of scope; they neither block the build (Next.js build excludes tests) nor relate to the files modified here. Plan 27-03 will add new tests for the 23P01 path; that plan can address or sidestep the pre-existing test-infra TS issues as appropriate.

## Issues Encountered

None. Each edit applied cleanly, each typecheck (filtered to runtime files) returned zero errors, and the full `npm run build` passed without warnings.

## Authentication Gates

None encountered.

## User Setup Required

None — no external service configuration needed.

## Next Phase Readiness

**Plan 27-03 (application precheck and ROLLBACK on 23P01) may proceed.** The error-mapping plumbing is now in place; Plan 27-03 can layer ROLLBACK / poisoned-transaction handling and any application-level pre-checks on top of these branches without rewiring the response shapes.

**Phase 27 success criteria status:**
- ✓ Success criterion #1: booker hitting a cross-event collision now sees a 409 + graceful UX, not a 500.
- ✓ Success criterion #3: reschedule into a cross-event collision returns 409, not 500.
- (Success criterion #2 is the upstream constraint, satisfied by Plan 27-01.)

**No blockers.** The constraint name `bookings_no_account_cross_event_overlap` referenced in Plan 27-01 is implicit here (any 23P01 raised by the bookings table is from this constraint, since it's the only EXCLUDE on the table); no string-matching against constraint name was required, keeping the application loosely coupled to the DB-side name.

**Test suite:** Existing test count unchanged (Plan 27-03 will add tests for the new 23P01 paths).

---
*Phase: 27-slot-correctness-db-layer-enforcement*
*Completed: 2026-05-03*
