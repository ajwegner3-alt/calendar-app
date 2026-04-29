---
phase: 11-booking-capacity-and-double-booking-fix
plan: 08
subsystem: ui
tags: [react, nextjs, typescript, capacity, booking, 409, race-condition, slots]

# Dependency graph
requires:
  - phase: 11-booking-capacity-and-double-booking-fix
    plan: 04
    provides: "POST /api/bookings returns 409 with code=SLOT_TAKEN|SLOT_CAPACITY_REACHED"
  - phase: 11-booking-capacity-and-double-booking-fix
    plan: 05
    provides: "GET /api/slots returns remaining_capacity per slot when show_remaining_capacity=true"
  - phase: 11-booking-capacity-and-double-booking-fix
    plan: 07
    provides: "Owner can enable show_remaining_capacity toggle + set max_bookings_per_slot"
provides:
  - "CAP-08 booker UI: 'X spots left' badge on slot buttons (optional, API-driven)"
  - "CAP-07 booker UI: 409 error message branched on body.code (SLOT_CAPACITY_REACHED vs SLOT_TAKEN)"
  - "RaceLoserBanner accepts optional message prop (v1.0 default preserved)"
  - "BookingShell wires raceLoserMessage state from BookingForm to RaceLoserBanner"
affects:
  - phase-12: Cruip UI overhaul will restyle booking page including slot buttons and banner
  - phase-13: Manual QA will verify capacity badge + 409 message branching visually

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "optional message? prop on banner component for backward-compatible message injection"
    - "typeof guard for optional number fields before rendering conditional UI"
    - "async response body read on non-2xx before calling parent callback"

key-files:
  created: []
  modified:
    - app/[account]/[event-slug]/_components/slot-picker.tsx
    - app/[account]/[event-slug]/_components/booking-form.tsx
    - app/[account]/[event-slug]/_components/booking-shell.tsx
    - app/[account]/[event-slug]/_components/race-loser-banner.tsx

key-decisions:
  - "Slot.remaining_capacity placed on existing Slot interface in slot-picker.tsx (type is not in types.ts — it lives co-located with SlotPicker)"
  - "RaceLoserBanner updated with optional message? prop (backward-compatible — existing hardcoded fallback preserved)"
  - "onRaceLoss signature updated to accept optional message string; BookingShell holds raceLoserMessage state"
  - "Capacity badge style stays text-xs text-muted-foreground; Phase 12 owns restyle"
  - "typeof remaining_capacity === 'number' guard (not just truthiness) — 0 would be falsy but still a valid number to display"

patterns-established:
  - "CAP-08 pattern: API optionally returns remaining_capacity; UI renders badge only when present (no owner flag needed on frontend)"
  - "CAP-07 pattern: read body.code on 409 before calling parent; defensive fallback to body.error ?? generic string"

# Metrics
duration: 12min
completed: 2026-04-29
---

# Phase 11 Plan 08: Booker UI Capacity Summary

**Conditional 'X spots left' badge on slot buttons + 409 message branched on SLOT_CAPACITY_REACHED vs SLOT_TAKEN, completing the full capacity feature stack**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-29T02:10:00Z
- **Completed:** 2026-04-29T02:22:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- CAP-08 booker UI: `remaining_capacity?: number` added to `Slot` interface; slot buttons render "X spots left" / "1 spot left" badge conditionally (only when API returns the field — i.e., owner enabled the toggle)
- CAP-07 booker UI: `booking-form.tsx` 409 path reads `body409.code`; `SLOT_CAPACITY_REACHED` → "That time is fully booked. Please choose a different time."; `SLOT_TAKEN` → "That time was just taken by another booker. Please choose a different time."; defensive fallback for unknown codes
- Supporting infrastructure: `RaceLoserBanner` accepts `message?` prop (fallback to v1.0 copy); `BookingShell` holds `raceLoserMessage` state; resets on new slot selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend booker slot type + render remaining_capacity badge** - `bd90a7a` (feat)
2. **Task 2: Branch booker 409 message on response.code** - `94fb5fd` (feat)

**Plan metadata:** (committed after SUMMARY.md + STATE.md updates)

## Files Created/Modified

- `app/[account]/[event-slug]/_components/slot-picker.tsx` — Added `remaining_capacity?: number` to `Slot` interface; conditional badge in slot button JSX (text-xs text-muted-foreground; pluralized)
- `app/[account]/[event-slug]/_components/booking-form.tsx` — Updated `onRaceLoss` prop type to accept optional message; 409 handler reads body.code and selects message before calling `props.onRaceLoss(raceMessage)`
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — Added `raceLoserMessage` state + updated `handleRaceLoss` to accept/store message + resets on slot pick
- `app/[account]/[event-slug]/_components/race-loser-banner.tsx` — Added optional `message?` prop; renders `message ?? "That time was just booked..."` (v1.0 default preserved)

## Decisions Made

- **Slot type location:** `Slot` interface is in `slot-picker.tsx` (not `_lib/types.ts`). The plan said to look for it — it was co-located. Added field there, no new file needed.
- **RaceLoserBanner approach:** Rather than a toast, mirrored the existing banner pattern. Updated banner to accept `message?` prop to keep backward compatibility while enabling custom 409 copy.
- **Message propagation chain:** `booking-form.tsx` reads body → passes message to `onRaceLoss(msg)` → shell stores in `raceLoserMessage` state → banner renders. Cleanest pattern that preserves the existing component boundaries.
- **typeof guard:** Used `typeof s.remaining_capacity === "number"` (not just `s.remaining_capacity`) so that `0` would still render (defensive — Plan 05 already excludes 0-capacity slots from the API response, but the UI is safe either way).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated booking-shell.tsx and race-loser-banner.tsx to wire message**

- **Found during:** Task 2 (409 branching)
- **Issue:** Plan said to "mirror the existing pattern" for 409 error display. The existing pattern uses `RaceLoserBanner` with a hardcoded message. To branch the message, the banner and shell also needed updates.
- **Fix:** Added `message?` prop to `RaceLoserBanner`; added `raceLoserMessage` state to `BookingShell`; updated `onRaceLoss` callback signature. All changes backward-compatible (existing v1.0 copy is the fallback).
- **Files modified:** `race-loser-banner.tsx`, `booking-shell.tsx`
- **Verification:** tsc passes, 148 tests pass
- **Committed in:** `bd90a7a` (Task 1 commit — banner + shell scaffolded before Task 2 uses them)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical wiring for message propagation)
**Impact on plan:** Required to properly surface CAP-07 copy through the existing banner pattern. Zero scope creep — all changes are within the three originally listed files plus the banner.

## Issues Encountered

None. `tsc --noEmit` errors are all pre-existing test-mock alias errors (documented v1.2 tech debt in STATE.md); no runtime code errors. All 148 tests pass + 26 skipped unchanged from Phase 11 baseline.

## User Setup Required

None — no external service configuration required. Manual smoke test (visiting booking page with show_remaining_capacity=true event type) is Phase 13 scope.

## Next Phase Readiness

- Phase 11 is 100% complete (8/8 plans). All capacity feature legs shipped:
  - DB schema (Plans 02 + 03)
  - API: bookings POST retry + 409 codes (Plan 04)
  - API: slots remaining_capacity opt-in (Plan 05)
  - Race test (Plan 06)
  - Owner UI: capacity input + show toggle + decrease warning (Plan 07)
  - Booker UI: capacity badge + 409 branching (Plan 08) — THIS PLAN
- Phase 12 (Branded UI Overhaul) is next. Two architectural decisions needed at plan-phase:
  - Email gradient strategy (solid-only vs VML fallback)
  - Minimum-viable Playwright suite scope

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-29*
