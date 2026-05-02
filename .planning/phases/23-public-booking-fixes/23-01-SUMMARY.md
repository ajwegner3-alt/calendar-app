---
phase: 23-public-booking-fixes
plan: 01
subsystem: ui
tags: [next.js, metadata, seo, app-router]

# Dependency graph
requires:
  - phase: 22-auth-fixes
    provides: Stable auth layer; no session changes needed for this surface
provides:
  - "app/[account]/page.tsx generateMetadata() returns locked title 'Book with [Account Name]'"
  - "PUB-15 browser title gap closed"
affects:
  - 23-02
  - 23-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js App Router generateMetadata() used for per-account dynamic titles"

key-files:
  created: []
  modified:
    - app/[account]/page.tsx

key-decisions:
  - "Only the title string changed — description field left as-is ('Pick a time to meet with ${name}' reads naturally and was not flagged in CONTEXT)"
  - "No other logic in the file touched; entire existing implementation (filter, sort, hero, empty state, card grid) already satisfied all other PUB-15 success criteria"

patterns-established: []

# Metrics
duration: 1min
completed: 2026-05-02
---

# Phase 23 Plan 01: Public Booking Fixes — PUB-15 Title Summary

**Single-string fix in generateMetadata: browser tab on /[account] now reads 'Book with [Account Name]' per CONTEXT lock**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-02T19:28:12Z
- **Completed:** 2026-05-02T19:29:55Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments

- Updated `generateMetadata` title in `app/[account]/page.tsx` from `${data.account.name} — Book a time` to `Book with ${data.account.name}`
- Verified the old string is completely absent from the file
- Build passes (Next.js 16.2.4, TypeScript clean)
- Test suite: 222 passing, 4 skipped — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Update generateMetadata title to locked CONTEXT string** - `9c90a1c` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/[account]/page.tsx` - `generateMetadata` title string updated; all other content unchanged

## Decisions Made

- Only the `title` field changed. The `description` field (`Pick a time to meet with ${data.account.name}.`) was not flagged in CONTEXT and reads naturally, so it was left alone.
- No other parts of the file were touched — the existing implementation (filter/sort in `loadAccountListing`, `ListingHero`, `EventTypeCard`, `AccountEmptyState`, grid layout) already satisfied all remaining PUB-15 success criteria per RESEARCH.md HIGH-confidence findings.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PUB-15 browser title is now correct. Ready for Phase 23 plans 02 and 03 (PUB-13 mobile calendar centering, PUB-14 desktop slot-picker layout collision).
- No blockers introduced.

---
*Phase: 23-public-booking-fixes*
*Completed: 2026-05-02*
