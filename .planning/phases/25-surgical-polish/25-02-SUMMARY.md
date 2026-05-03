---
phase: 25-surgical-polish
plan: 02
subsystem: ui
tags: [react-day-picker, tailwind, calendar, home-calendar, mobile-overflow, selected-state]

# Dependency graph
requires:
  - phase: 24-owner-ui-polish
    provides: Per-instance DayButton className override pattern (home-calendar.tsx)
provides:
  - NSI-blue selected-state on home calendar DayButton (bg-primary text-primary-foreground)
  - Mobile cell overflow fix via min-w spacing.8 fallback (was spacing.9)
  - Hover guard for selected date (no gray-100 override when cell selected)
affects: [any future phase touching home-calendar.tsx or DayButton styling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional class array entry: use `!isSelected && 'class'` pattern to suppress hover when selected"
    - "CSS var with Tailwind theme() fallback: min-w-[var(--cell-size,theme(spacing.8))] for configurable + safe sizing"

key-files:
  created: []
  modified:
    - app/(shell)/app/_components/home-calendar.tsx

key-decisions:
  - "Three coordinated edits shipped as one atomic plan to avoid merge conflict (lines 71-85 all overlapping)"
  - "Shared components/ui/calendar.tsx left untouched per v1.3 invariant"
  - "spacing.8 (32px) chosen as min-w fallback to prevent horizontal overflow at 390px viewport"

patterns-established:
  - "OWNER-14 pattern: hover guard via !isSelected && expression in className array"
  - "OWNER-15 pattern: reduce min-w CSS var fallback one spacing step (9->8) to absorb mobile constraint"

# Metrics
duration: 3min
completed: 2026-05-03
---

# Phase 25 Plan 02: Surgical Polish (OWNER-14 + OWNER-15) Summary

**NSI-blue selected state and 32px mobile cell-size fix applied to home-calendar DayButton in one atomic edit — shared calendar.tsx untouched**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-03T14:13:37Z
- **Completed:** 2026-05-03T14:16:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Selected date now renders with `bg-primary text-primary-foreground` (NSI blue) instead of hard-coded `bg-gray-700 text-white`
- Hover on selected date no longer overrides to gray-100 (guard added: `!isSelected && "hover:bg-gray-100 hover:text-gray-900"`)
- Mobile viewport overflow fixed: `min-w` CSS var fallback reduced from `theme(spacing.9)` (36px) to `theme(spacing.8)` (32px)
- All three edits delivered as one atomic commit (lines 71-85 were overlapping — parallel-plan-safe)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace DayButton className array with three coordinated polish edits** - `6a370e1` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `app/(shell)/app/_components/home-calendar.tsx` - Three className array edits: spacing.9->8, hover guard, bg-gray-700->bg-primary

## Decisions Made
- Shipped OWNER-14 (selected color) and OWNER-15 (mobile overflow) as one atomic plan — both edit lines 71-85, so a single coordinated replacement avoids any merge conflict risk
- Did not modify `components/ui/calendar.tsx` (v1.3 invariant: shared calendar untouched)
- Used `!isSelected &&` expression in the array (evaluates to `false` which `.filter(Boolean)` drops) — idiomatic pattern matching existing codebase style

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The CSS warning during build (`Unexpected token Delim('.')` in `--cell-radius` var) is pre-existing from prior phases, unrelated to this change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- OWNER-14 and OWNER-15 satisfied; Phase 25 surgical polish complete (25-01 also running in parallel for AUTH-21/AUTH-22)
- No blockers for Phase 26 (Bookings crash debug) or Phase 27 (slot correctness DB layer)

---
*Phase: 25-surgical-polish*
*Completed: 2026-05-03*
