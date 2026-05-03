---
phase: 25-surgical-polish
plan: 01
subsystem: auth
tags: [next.js, react, tsx, auth, ui-polish]

# Dependency graph
requires:
  - phase: 16-auth-ui
    provides: AuthHero component with BackgroundGlow and marketing copy
provides:
  - AuthHero component without the NSI pill div (AUTH-21 + AUTH-22 satisfied)
affects:
  - Any future auth page UI work referencing auth-hero.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct JSX deletion preferred over prop-gating when component has single caller"

key-files:
  created: []
  modified:
    - app/(auth)/_components/auth-hero.tsx

key-decisions:
  - "Deleted pill div directly (no prop) — AuthHero has no alternative consumers; direct deletion is cleaner than adding a conditional prop"

patterns-established:
  - "Per-instance className override pattern from v1.3 preserved; shared components/ui/calendar.tsx and globals.css untouched"

# Metrics
duration: 5min
completed: 2026-05-03
---

# Phase 25 Plan 01: Surgical Polish — Remove NSI Pill from Auth Hero Summary

**Deleted the "Powered by NSI" pill div from AuthHero, removing visual noise from /login and /signup while leaving the booking-page PoweredByNsi footer untouched**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-03T14:10:00Z
- **Completed:** 2026-05-03T14:13:55Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Removed the 4-line pill `<div>` (lines 27-30) from `auth-hero.tsx`; file reduced from 52 to 48 lines
- AUTH-21 and AUTH-22 satisfied — /login and /signup will no longer show the pill at lg: breakpoint
- `npm run build` passes clean with no TypeScript errors
- `app/_components/powered-by-nsi.tsx` booking-page footer completely untouched (v1.3 invariant preserved)

## Task Commits

1. **Task 1: Delete the "Powered by NSI" pill div from AuthHero** - `3092b26` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `app/(auth)/_components/auth-hero.tsx` - Removed pill div block; BackgroundGlow, headline, subtext, and all three bullet items intact

## Decisions Made

- Direct deletion (no prop) chosen because AuthHero has exactly one caller (auth split-panel layout) and CONTEXT.md + RESEARCH.md confirmed zero alternative consumers — a conditional prop would add complexity with no benefit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 25-01 complete. AUTH-21 and AUTH-22 closed.
- Ready for 25-02 (next plan in Phase 25 — Surgical Polish).
- No blockers.

---
*Phase: 25-surgical-polish*
*Completed: 2026-05-03*
