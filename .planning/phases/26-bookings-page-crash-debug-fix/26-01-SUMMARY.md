---
phase: 26-bookings-page-crash-debug-fix
plan: "01"
subsystem: debugging
tags: [nextjs, rsc, server-components, bookings, crash-diagnosis]

# Dependency graph
requires:
  - phase: 08-bookings
    provides: bookings-table.tsx with the introduced onClick bug (commit 52ea36d)
provides:
  - Root cause confirmed: RSC boundary violation at bookings-table.tsx:93
  - Fix shape locked: delete onClick prop
  - Deferred fragility sites documented for Phase 27 awareness
affects:
  - 26-02 (fix executes based on this diagnosis)
  - 27-slot-correctness (TZDate and normalization fragilities flagged)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grep-first diagnosis: search for onClick in RSC files before reading full component"

key-files:
  created:
    - .planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md
  modified: []

key-decisions:
  - "RSC boundary violation is root cause — not Candidates A-E (data-layer hypotheses)"
  - "Fix is 1-line deletion of onClick prop only — no other files need modification"
  - "Deferred fragilities (TZDate, normalization, unguarded throw) are NOT co-causes; do not fix in Plan 02 unless diagnosis changes"

patterns-established: []

# Metrics
duration: ~1 session
completed: 2026-05-03
---

# Phase 26 Plan 01: Diagnose Bookings Crash Summary

**RSC boundary violation at `bookings-table.tsx:93` confirmed: Server Component renders `<a onClick>` that Next.js cannot serialize, causing digest `2914592434` crash for all accounts with non-null `booker_phone`**

## Performance

- **Duration:** ~1 session (logs → grep → write → confirm)
- **Started:** 2026-05-03
- **Completed:** 2026-05-03
- **Tasks:** 3 (human-action log paste, auto diagnosis write, human-verify confirmation)
- **Files modified:** 1 (26-DIAGNOSIS.md)

## Accomplishments

- Identified root cause as RSC boundary violation — ruled out all five original data-layer candidates from RESEARCH.md
- Wrote `26-DIAGNOSIS.md` with full mechanism, reproduction steps, fix shape, regression timeline, and deferred findings
- Andrew confirmed diagnosis matches observed behavior; Plan 02 cleared to execute

## Task Commits

1. **Task 2: Write diagnosis** - `ed7eb22` (docs)
2. **Task 3: Andrew confirmation** - `8cbfca9` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/phases/26-bookings-page-crash-debug-fix/26-DIAGNOSIS.md` — full crash diagnosis; see this file for mechanism, fix shape, and deferred findings

## Decisions Made

- **Matched candidate: NEW** — RSC boundary violation. Not Candidates A through E from `26-RESEARCH.md`. The original RESEARCH ranking (data-layer hypotheses) is invalidated by the Vercel log evidence.
- **Fix shape locked:** Delete `onClick={(e) => e.stopPropagation()}` at `bookings-table.tsx:93`. No other files need modification.
- **Deferred fragilities not fixed in Plan 02** — unguarded `TZDate` at `bookings-table.tsx:37`, normalization undefined at `queries.ts:92-94`, and unguarded throw at `queries.ts:86` are real risks but not co-causes of the current crash. Strict-fix bias means they stay out of 26-02.

## Deviations from Plan

None — plan executed exactly as written. The diagnosis was a NEW candidate not in RESEARCH.md, but that is expected behavior for a diagnosis plan, not a deviation.

## Issues Encountered

**Original 5-candidate ranking invalidated.** RESEARCH.md ranked Candidates A–E (all data-layer). The actual bug is UI-tree (RSC boundary), not data-layer. The research was useful to rule out those paths quickly, but the root cause required fresh signal from Vercel logs.

**Bug present since initial commit.** `onClick` was introduced in `52ea36d feat(08-06): bookings table with status badges and row links` (2026-04-26). The page has never worked for accounts with non-null `booker_phone`. It was masked during early dev because seed data had null phones.

## User Setup Required

None — diagnosis only. No code changes, no environment changes.

## Next Phase Readiness

- **Plan 02 ready to execute.** Fix is fully specified: delete `onClick={(e) => e.stopPropagation()}` at `bookings-table.tsx:93`.
- **Secondary awareness for Plan 02:** Once the RSC crash is fixed, the unguarded `TZDate` at line 37 becomes a live crash risk for any booking with a bad/null timezone value. Plan 02 author should decide whether to add a defensive fallback or flag for Phase 27.
- **No blockers.** Andrew has confirmed the diagnosis. Fix is 1-line, low risk.

---
*Phase: 26-bookings-page-crash-debug-fix*
*Completed: 2026-05-03*
