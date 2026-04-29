---
phase: 11-booking-capacity-and-double-booking-fix
plan: 05
subsystem: api
tags: [slots, capacity, pitfall-4, status-filter, remaining-capacity, computeSlots, typescript]

# Dependency graph
requires:
  - phase: 11-02
    provides: max_bookings_per_slot + show_remaining_capacity columns on event_types (live on prod)
  - phase: 11-03
    provides: bookings_capacity_slot_idx (WHERE status='confirmed') — semantic alignment with Pitfall 4 fix
  - phase: 11-04
    provides: bookings route capacity-aware retry loop (CAP-07 error codes)
provides:
  - "/api/slots filters bookings to status='confirmed' only (Pitfall 4 closed)"
  - "computeSlots() excludes slots when confirmed_count >= max_bookings_per_slot (CAP-04)"
  - "remaining_capacity field on slot response when show_remaining_capacity=true (CAP-08 backend)"
  - "SlotInput type extended with maxBookingsPerSlot + showRemainingCapacity"
  - "Slot output type extended with optional remaining_capacity"
affects:
  - 11-06 (cancel/reschedule routes may benefit from same confirmed-only filter alignment)
  - 11-07 (event-type form + UI consuming capacity columns)
  - Phase 12 (booker UI reads remaining_capacity when show_remaining_capacity=true)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall 4 fix: .eq('status','confirmed') pattern for all capacity-consuming queries"
    - "slotConfirmedCount() helper: epoch-ms comparison for exact-slot counting"
    - "CAP-04 check after buffer-conflict in computeSlots inner loop"
    - "CAP-08 conditional field: showRemainingCapacity guard on output slot object"

key-files:
  created: []
  modified:
    - lib/slots.types.ts
    - lib/slots.ts
    - app/api/slots/route.ts
    - tests/slot-generation.test.ts

key-decisions:
  - "Pitfall 4 closed: .eq('status','confirmed') in /api/slots bookings query — rescheduled bookings no longer over-block freed slots; semantic alignment with bookings_capacity_slot_idx (WHERE status='confirmed')"
  - "capacity check placed AFTER buffer-conflict check in inner loop — both must pass independently"
  - "slotConfirmedCount uses epoch-ms comparison (Date.getTime()) for exact UTC instant matching"
  - "remaining_capacity omitted when showRemainingCapacity=false (default) — zero API surface change for v1.0 callers"
  - "cancel-reschedule-api.test.ts required NO semantic updates — tests only /api/cancel + /api/reschedule, not /api/slots"
  - "slot-generation.test.ts default input() helper updated with maxBookingsPerSlot:1 — all 15 existing tests pass unchanged (v1.0 behavior preserved)"

patterns-established:
  - "Confirmed-only filter: use .eq('status','confirmed') for any query that counts capacity-consuming bookings"
  - "Capacity-aware slot exclusion: confirmedCount >= maxBookingsPerSlot → skip slot (after buffer check)"

# Metrics
duration: 18min
completed: 2026-04-29
---

# Phase 11 Plan 05: Slots-API-Capacity-Aware Summary

**`/api/slots` is now capacity-aware: filters bookings to `status='confirmed'` (Pitfall 4 closed), excludes over-booked slots via `slotConfirmedCount >= maxBookingsPerSlot`, and optionally returns `remaining_capacity` per slot when the owner opts in**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-29T20:44:00Z
- **Completed:** 2026-04-29T20:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Closed Pitfall 4: `bookings` query in `/api/slots` now uses `.eq("status", "confirmed")` instead of `.neq("status", "cancelled")` — rescheduled bookings no longer hold their old slot hostage; once rescheduled, the original slot is available to new bookers immediately
- CAP-04 live: `computeSlots()` inner loop now calls `slotConfirmedCount()` after the buffer-conflict check and skips slots where `confirmedCount >= maxBookingsPerSlot`
- CAP-08 backend live: `remaining_capacity = maxBookingsPerSlot - confirmedCount` is conditionally added to each output slot when `show_remaining_capacity=true`; field is absent (not `null`) when false — zero breaking change for v1.0 API consumers
- 148 tests passing + 24 skipped — baseline maintained

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend slot types + capacity-aware computeSlots** - `1a377eb` (feat)
2. **Task 2: /api/slots reads capacity + fixes Pitfall 4 status filter** - `311ae3c` (feat)

**Plan metadata:** pending (docs commit below)

## Files Created/Modified

- `lib/slots.types.ts` — added `maxBookingsPerSlot: number` + `showRemainingCapacity?: boolean` to `SlotInput`; added `remaining_capacity?: number` to `Slot` output type
- `lib/slots.ts` — added `slotConfirmedCount()` helper (epoch-ms exact match count); added CAP-04 capacity exclusion check + CAP-08 conditional `remaining_capacity` output in `computeSlots()` inner loop
- `app/api/slots/route.ts` — extended event_types SELECT to include `max_bookings_per_slot, show_remaining_capacity`; changed bookings filter from `.neq("status","cancelled")` to `.eq("status","confirmed")` (Pitfall 4 fix); passes `maxBookingsPerSlot` and `showRemainingCapacity` into `computeSlots()`
- `tests/slot-generation.test.ts` — added `maxBookingsPerSlot: 1` to default `input()` helper (required because field is now required on `SlotInput`); all 15 tests unchanged and passing

## Decisions Made

- **Pitfall 4 semantic alignment confirmed:** `bookings_capacity_slot_idx` (Plan 11-03) uses `WHERE status='confirmed'` — the `.eq("status","confirmed")` filter in `/api/slots` is semantically aligned. Both the DB uniqueness guard and the slot-generation engine now agree on what "counts" against a slot.
- **`cancel-reschedule-api.test.ts` semantic check:** No updates needed. The Pitfall 4 fix changes `/api/slots` behavior only. The cancel/reschedule routes (`/api/cancel`, `/api/reschedule`) are unaffected — they mutate booking status, not query slot availability. None of the 10 cancel/reschedule test scenarios assert anything about slot re-availability after reschedule (that would be an end-to-end integration through `/api/slots`, not tested in this file). The rescheduled-slot-is-re-bookable semantic is now correctly implemented at the engine level and will be verifiable via the live booking flow in Phase 13 QA.
- **`remaining_capacity` is omitted (not null) when disabled:** Keeps the API surface clean for v1.0 callers that don't expect the field. JSON omission is better than `null` for optional enrichment fields.

## Deviations from Plan

None — plan executed exactly as written.

## Cancel-Reschedule Test Semantic Notes

Per plan instructions, inspected `cancel-reschedule-api.test.ts` for any assertions that would break with the Pitfall 4 change:

- Tests exercise `/api/cancel` and `/api/reschedule` routes exclusively
- No test in the file calls `/api/slots` or asserts that a rescheduled slot is blocked/unblocked in the availability API
- The reschedule happy path test (Scenario 2 `[#2]`) asserts `row.status === 'confirmed'` (not 'rescheduled') after reschedule — this is unchanged behavior; the reschedule route updates the row's `start_at`/`end_at` with `status` staying `confirmed`
- **Conclusion: zero semantic updates required.** The new contract (rescheduled slots ARE re-bookable immediately) is correct and consistent with how `rescheduleBooking()` already works — it overwrites the booking row in-place rather than creating an old-status row.

## Issues Encountered

None — typecheck clean (except pre-existing mock alias errors in test files, which are v1.2 tech debt per STATE.md).

## Next Phase Readiness

- **Plan 11-06 (cancel/reschedule capacity-aware routes):** Can proceed. The confirmed-only booking filter pattern is now established. Plan 11-06 should apply the same `.eq("status","confirmed")` to any booking lookups in cancel/reschedule routes if they check slot availability.
- **Plan 11-07 (event-type form + capacity UI):** Can proceed. `max_bookings_per_slot` and `show_remaining_capacity` are readable from event_types; `remaining_capacity` is now in the API response when enabled.
- **Phase 12 booker UI:** `remaining_capacity` field is present in `/api/slots` response when `show_remaining_capacity=true`. The booker UI can read `slot.remaining_capacity` and render it.

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-29*
