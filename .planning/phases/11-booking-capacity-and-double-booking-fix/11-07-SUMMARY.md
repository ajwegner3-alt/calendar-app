---
phase: 11-booking-capacity-and-double-booking-fix
plan: 07
subsystem: ui
tags: [react-hook-form, zod, supabase, alert-dialog, switch, capacity, event-types]

# Dependency graph
requires:
  - phase: 11-02
    provides: max_bookings_per_slot + show_remaining_capacity columns live on event_types table
  - phase: 11-04
    provides: POST /api/bookings reads max_bookings_per_slot; bookings_capacity_slot_idx live
  - phase: 11-05
    provides: /api/slots returns remaining_capacity field; show_remaining_capacity opt-in
provides:
  - Zod schema fields: max_bookings_per_slot (coerce, int, 1-50, default 1), show_remaining_capacity (coerce bool, default false), confirmCapacityDecrease optional bypass flag
  - EventTypeRow type extended with max_bookings_per_slot + show_remaining_capacity
  - updateEventTypeAction: CAP-09 pre-check on capacity decrease; JS group-by of confirmed future bookings; structured warning return
  - createEventTypeAction + updateEventTypeAction: persist both capacity fields to DB
  - EventTypeForm: number input for max_bookings_per_slot + Controller+Switch for show_remaining_capacity + AlertDialog confirmation modal for CAP-09 warning
affects: [Phase 12, Phase 13, future capacity-reporting work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CAP-09 over-cap guard: JS group-by of supabase SELECT results (no RPC); fail-closed on query error"
    - "AlertDialog confirmation modal pattern for destructive-but-not-irreversible actions"
    - "confirmCapacityDecrease bypass flag travels with form re-submission (not a separate action)"
    - "Fragment wrapper for form+modal sibling return in client component"

key-files:
  created: []
  modified:
    - app/(shell)/app/event-types/_lib/schema.ts
    - app/(shell)/app/event-types/_lib/types.ts
    - app/(shell)/app/event-types/_lib/actions.ts
    - app/(shell)/app/event-types/_components/event-type-form.tsx
    - app/(shell)/app/event-types/[id]/edit/page.tsx

key-decisions:
  - "In-JS group-by over RPC for over-cap detection: supabase-js lacks GROUP BY/HAVING; data volume is small (one owner's future bookings for one event type, typically <100 rows)"
  - "Fail-closed on overCapErr: if the bookings query errors, return formError rather than silently proceeding with the capacity decrease"
  - "confirmCapacityDecrease in same Zod schema as form fields: travels with re-submission, avoids a parallel confirm action"
  - "AlertDialog (not Dialog): destructive-ish action with explicit cancel/confirm; mirrors delete-confirm-dialog.tsx pattern"
  - "Fragment wrapper: AlertDialog must be sibling of <form>, not nested inside"

patterns-established:
  - "CAP-09 pre-check pattern: fetch current row cap, compare to new cap, fetch future confirmed bookings, group-by start_at in JS, count exceeding slots"

# Metrics
duration: 10min
completed: 2026-04-29
---

# Phase 11 Plan 07: Event-Type-Form Capacity Summary

**CAP-03 capacity input (1-50, default 1) + CAP-08 show-remaining toggle + CAP-09 SQL-truth confirmation modal live on the event-type form**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-29T02:05:02Z
- **Completed:** 2026-04-29T02:15:27Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Zod schema extended with `max_bookings_per_slot` (z.coerce, int, 1-50, default 1), `show_remaining_capacity` (z.coerce bool, default false), and `confirmCapacityDecrease` optional bypass flag
- `EventTypeRow` type extended; edit page SELECT + defaultValues now include both capacity columns
- CAP-09 pre-check in `updateEventTypeAction`: fires only on capacity decrease without confirm flag; queries confirmed future bookings; groups by `start_at` in JS; returns structured warning (`{ warning: "capacity_decrease_overflow", details: { newCap, currentCap, affectedSlots, maxAffected } }`) when any slot exceeds new cap; fails closed on DB error
- Both create and update actions now persist `max_bookings_per_slot` and `show_remaining_capacity` to the DB
- Form: number input for max bookings (min=1, max=50, valueAsNumber), Controller+Switch for show-remaining (mirrors `is_active` pattern), AlertDialog modal wired to `overcapWarning` state with confirm re-submitting `confirmCapacityDecrease: true`
- 148 tests passing + 26 skipped (baseline unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Zod schema + types with capacity fields** - `1ccce09` (feat)
2. **Task 2: CAP-09 over-cap pre-check in upsertEventType action** - `39509bf` (feat)
3. **Task 3: Capacity input + toggle + CAP-09 confirmation modal** - `a42ba65` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `app/(shell)/app/event-types/_lib/schema.ts` - Added max_bookings_per_slot (z.coerce, 1-50, default 1), show_remaining_capacity (z.coerce bool, default false), confirmCapacityDecrease optional bypass
- `app/(shell)/app/event-types/_lib/types.ts` - EventTypeRow: added max_bookings_per_slot (number) + show_remaining_capacity (boolean)
- `app/(shell)/app/event-types/_lib/actions.ts` - EventTypeState: warning + details fields; createEventTypeAction INSERT + updateEventTypeAction UPDATE include capacity fields; CAP-09 pre-check block in updateEventTypeAction
- `app/(shell)/app/event-types/_components/event-type-form.tsx` - DEFAULTS updated; AlertDialog imports; overcapWarning state; getValues added; onSubmit handles warning; handleOvercapConfirm; number input + Switch + AlertDialog modal in JSX; Fragment wrapper
- `app/(shell)/app/event-types/[id]/edit/page.tsx` - SELECT + defaultValues include max_bookings_per_slot + show_remaining_capacity

## Decisions Made

1. **In-JS group-by over RPC for over-cap detection.** `supabase-js` does not expose `GROUP BY / HAVING` natively. Data volume is small (one owner's future confirmed bookings for one event type — typically <100 rows). Grouping in a `Map<string, number>` by `start_at` is adequate and avoids creating a new `SECURITY INVOKER` RPC. If a future owner has large booking volumes this can be upgraded to an RPC without a schema migration.

2. **Fail-closed on DB query error.** If the `bookings` query for over-cap detection errors, the action returns `{ formError: "Could not verify capacity change. Please try again." }` rather than silently proceeding. This is the conservative choice — an owner should not accidentally over-cap slots.

3. **`confirmCapacityDecrease` in the same Zod schema.** The bypass flag travels with the form re-submission (not a separate Server Action). This keeps the confirmation path thin — the same `updateEventTypeAction` handles both the initial check and the confirmed save, gated on the flag.

4. **AlertDialog not Dialog.** The modal represents a destructive-ish action (not irreversible, but affecting existing bookings). `AlertDialog` is the established pattern in this codebase (see `delete-confirm-dialog.tsx`) for actions requiring explicit cancel/confirm.

5. **Fragment wrapper.** The `<AlertDialog>` must be a sibling of `<form>`, not nested inside it (HTML spec: dialogs are portal-rendered). This required wrapping the component return in `<>...</>`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Edit page SELECT missing new capacity columns**
- **Found during:** Task 1 (typecheck run)
- **Issue:** `tsc` flagged `app/(shell)/app/event-types/[id]/edit/page.tsx:42` — the `defaultValues` object passed to `EventTypeForm` was missing `max_bookings_per_slot`, `show_remaining_capacity`, `confirmCapacityDecrease` after the schema was extended. The SELECT query also did not include the new columns.
- **Fix:** Added `max_bookings_per_slot, show_remaining_capacity` to the Supabase SELECT string; added all three fields to `defaultValues` with safe fallbacks (`?? 1`, `?? false`, `false`).
- **Files modified:** `app/(shell)/app/event-types/[id]/edit/page.tsx`
- **Verification:** `npx tsc --noEmit` produced no non-test errors after fix.
- **Committed in:** `1ccce09` (Task 1 commit — logical part of schema/types task)

**2. [Rule 1 - Bug] DEFAULTS object missing new capacity fields**
- **Found during:** Task 1 (typecheck run)
- **Issue:** `tsc` flagged `event-type-form.tsx:29` — the `DEFAULTS` constant of type `EventTypeInput` was missing the three new schema fields.
- **Fix:** Added `max_bookings_per_slot: 1`, `show_remaining_capacity: false`, `confirmCapacityDecrease: false` to `DEFAULTS`.
- **Files modified:** `app/(shell)/app/event-types/_components/event-type-form.tsx`
- **Verification:** `npx tsc --noEmit` clean after fix.
- **Committed in:** `a42ba65` (Task 3 commit — form component task)

**3. [Rule 1 - Bug] Fragment wrapper needed for form + AlertDialog siblings**
- **Found during:** Task 3 (typecheck run after JSX additions)
- **Issue:** `tsc` errors TS1005 / TS1128 — React component was returning `<form>` and `<AlertDialog>` as adjacent JSX elements without a wrapper.
- **Fix:** Wrapped the return in `<>...</>` (React Fragment).
- **Files modified:** `app/(shell)/app/event-types/_components/event-type-form.tsx`
- **Verification:** `npx tsc --noEmit` clean; 148 tests pass.
- **Committed in:** `a42ba65` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug, TypeScript compile errors)
**Impact on plan:** All fixes necessary for TypeScript correctness. No scope creep. The edit page SELECT fix is strictly an enabling fix — new columns must be fetched for defaultValues to populate correctly in edit mode.

## Issues Encountered

None beyond the auto-fixed deviations above. The pre-existing `react-hooks/incompatible-library` warning on `event-type-form.tsx` (documented v1.2 tech debt) remains — the line number shifted from ~99 to ~124 due to new code above it. No new lint errors introduced.

## User Setup Required

None — no external service configuration required. Manual smoke test (visit `/app/event-types/{id}/edit`, verify number input + toggle appear, verify modal on capacity decrease) is deferred to Phase 13 QA scope per plan spec.

## Next Phase Readiness

- CAP-03 (capacity input), CAP-08 (owner toggle), and CAP-09 (SQL-truth confirmation modal) are code-complete.
- Phase 11 Wave 2 is now complete: Plans 11-02 through 11-07 all done.
- Phase 12 (Branded UI Overhaul) can proceed. Two architectural decisions needed during its plan-phase: email gradient strategy and Playwright suite scope.
- Phase 13 (Manual QA) will include: capacity UI smoke test (edit an event type, verify input + toggle visible, test over-cap modal with real confirmed future bookings).

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-29*
