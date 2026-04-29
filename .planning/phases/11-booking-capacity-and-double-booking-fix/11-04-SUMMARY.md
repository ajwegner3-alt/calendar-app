---
phase: 11-booking-capacity-and-double-booking-fix
plan: "04"
subsystem: api
tags: [bookings, capacity, race-safety, postgres, supabase, slot_index, 23505, CAP-07]

# Dependency graph
requires:
  - phase: 11-02
    provides: max_bookings_per_slot column on event_types table
  - phase: 11-03
    provides: bookings.slot_index column + bookings_capacity_slot_idx UNIQUE index (event_type_id, start_at, slot_index) WHERE status='confirmed'

provides:
  - Capacity-aware INSERT retry loop in POST /api/bookings (slot_index=1..N on Postgres 23505)
  - CAP-07 error-code distinguishing: SLOT_TAKEN (capacity=1) vs SLOT_CAPACITY_REACHED (capacity>1)
  - max_bookings_per_slot read from resolved event_type in bookings route handler

affects: [11-05, 11-06, 11-07, Phase 12 booker UI error handling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "slot_index retry loop: for slotIndex=1..maxBookingsPerSlot, retry on 23505, fail fast on other errors"
    - "CAP-07 error distinguishing: capacity===1 → SLOT_TAKEN, capacity>1 → SLOT_CAPACITY_REACHED"

key-files:
  created: []
  modified:
    - app/api/bookings/route.ts

key-decisions:
  - "CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED distinguishing live — booker UI can switch on code field uniformly"
  - "Preserve original error copy for capacity=1 path: 'That time was just booked. Pick a new time below.'"
  - "Non-23505 INSERT errors fail fast (no retry) — only 23505 triggers slot_index increment"
  - "maxBookingsPerSlot uses ?? 1 defensive fallback despite DB NOT NULL DEFAULT 1 — guards against TS type lag"
  - "No test assertion updates needed — existing bookings-api.test.ts already asserts code: SLOT_TAKEN on 409"

patterns-established:
  - "Slot retry: read max_bookings_per_slot from event_types SELECT; iterate slot_index 1..N; break on success or non-23505 error"

# Metrics
duration: 3min
completed: "2026-04-29"
---

# Phase 11 Plan 04: Bookings API Capacity Retry Summary

**POST /api/bookings slot_index=1..N retry loop with CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED distinguishing wired to bookings_capacity_slot_idx Postgres unique index**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-29T01:44:26Z
- **Completed:** 2026-04-29T01:47:27Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `max_bookings_per_slot` to the `event_types` SELECT in the bookings route handler
- Replaced single INSERT with slot_index retry loop (1..N) catching Postgres 23505 per-iteration
- CAP-07 error codes live: `SLOT_TAKEN` (capacity=1) and `SLOT_CAPACITY_REACHED` (capacity>1) on exhaustion
- Full test suite passes: 148 passing + 24 skipped (Phase 10 baseline maintained exactly)

## Route.ts Diff Summary

**Lines changed:** 89 insertions, 38 deletions (net +51 lines)

**Change 1 — event_types SELECT extended:**
```
.select("id, account_id, slug, name, description, duration_minutes, custom_questions, max_bookings_per_slot")
```
Plus: `const maxBookingsPerSlot = eventType.max_bookings_per_slot ?? 1;`

**Change 2 — Single INSERT replaced with retry loop:**
- `BookingRow` local type declared (explicit, no `any`)
- `let booking: BookingRow | null = null;` + `let insertError: {...} | null = null;`
- `for (let slotIndex = 1; slotIndex <= maxBookingsPerSlot; slotIndex++)` loop
- On `result.error.code === "23505"`: continue to next slotIndex
- On any other error: break immediately (fail fast)
- After loop: if `insertError?.code === "23505"` → 409 with CAP-07 code
- After loop: if other error → 500 INTERNAL with console.error

**Change 3 — CAP-07 409 response:**
```typescript
const code = maxBookingsPerSlot === 1 ? "SLOT_TAKEN" : "SLOT_CAPACITY_REACHED";
const message = maxBookingsPerSlot === 1
  ? "That time was just booked. Pick a new time below."
  : "That time is fully booked. Please choose a different time.";
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend event-type resolution SELECT and add slot_index retry loop** - `95f8bf0` (feat)
2. **Task 2: Run regression test suite** - No separate commit needed (no test changes required)

**Plan metadata:** (see below)

## Test Pass Count

- **Focused suite** (`bookings-api.test.ts race-guard.test.ts bookings-rate-limit.test.ts`): 13 / 13 passed
- **Full suite** (`npm run test`): 148 passing + 24 skipped

## Test Assertion Updates

**None required.** The existing `bookings-api.test.ts` already asserted `secondData.code === "SLOT_TAKEN"` on the 409 response (from Phase 5's original implementation which already included the `code` field). The retry loop is a backward-compatible behavioral change — capacity=1 still returns SLOT_TAKEN after one failed slot_index=1 attempt, identical to the v1.0 path. The `race-guard.test.ts` tests at the supabase-js/DB layer directly and does not inspect HTTP response bodies.

## Files Created/Modified

- `app/api/bookings/route.ts` — Slot_index retry loop + CAP-07 error distinguishing + max_bookings_per_slot read from event_types

## Decisions Made

- **CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED distinguishing live** — The `code` field on 409 responses now always distinguishes capacity=1 (SLOT_TAKEN) from capacity>1 (SLOT_CAPACITY_REACHED). Plans 05–07 and the booker UI (Phase 12) can switch on this field uniformly.
- **Preserve original copy for capacity=1** — "That time was just booked. Pick a new time below." (CONTEXT decision #5) preserved exactly. Only the capacity>1 path gets new copy.
- **Non-23505 fail fast** — only 23505 triggers slot_index increment. Any other error (network, DB constraint other than unique, etc.) breaks the loop immediately and returns 500.
- **No test assertion updates** — pre-existing `code: "SLOT_TAKEN"` assertion in bookings-api.test.ts was already compatible with the new implementation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript had no errors in route.ts. All pre-existing tsc mock-alias errors are unchanged v1.2 tech debt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 11-05 (availability-query fix)** can now proceed — `.neq("status","cancelled")` → `.eq("status","confirmed")` fix needed in slots route.
- **Plan 11-06 (pg-driver race test / CAP-06)** can now proceed — slot_index retry loop is the application-layer mechanism that CAP-06 will stress-test at the Postgres layer directly.
- **Plan 11-07 (event-type form capacity UI)** can read/write `max_bookings_per_slot` and `show_remaining_capacity` — both columns live (Plan 11-02).
- The booker UI error handler (Phase 12) can switch on `code: "SLOT_TAKEN"` vs `code: "SLOT_CAPACITY_REACHED"` uniformly.

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-29*
