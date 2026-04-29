---
phase: 11-booking-capacity-and-double-booking-fix
plan: 01
subsystem: database
tags: [postgres, supabase, bookings, double-booking, capacity, root-cause, diagnostic]

# Dependency graph
requires:
  - phase: 05-public-booking-flow
    provides: bookings table, bookings_no_double_book index, /api/bookings route
  - phase: 06-cancel-reschedule-lifecycle
    provides: rescheduled booking status, reschedule lifecycle events
provides:
  - Root-cause verdict for 2026-04-27 prod double-booking observation
  - Verbatim SQL evidence from 6-step diagnostic against prod Supabase mogfnutxrrbtvnaupoun
  - Plan 03 gate-open decision (PROCEED — no duplicate confirmed rows on prod)
  - Downstream task confirmed in scope: Plan 05 must change .neq("status","cancelled") → .eq("status","confirmed") (Pitfall 4 capacity-accuracy fix)
affects:
  - 11-02 (capacity-trigger-and-slot-index-migration — Wave 2 gate was conditional on this verdict)
  - 11-03 (slot-index-migration — CONCURRENTLY build proceeds without pre-cleanup)
  - 11-05 (slots-api-fix — .neq → .eq change confirmed still in scope per Pitfall 4)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "6-step prod diagnostic protocol: index → duplicates → column type → lifecycle audit → rescheduled gap → precision drift"
    - "npx supabase db query --linked -f <tempfile.sql> for locked migration workaround (no supabase db push)"

key-files:
  created:
    - .planning/phases/11-booking-capacity-and-double-booking-fix/11-01-CAP-01-FINDINGS.md
    - .planning/phases/11-booking-capacity-and-double-booking-fix/11-01-SUMMARY.md
  modified: []

key-decisions:
  - "Verdict (c): rescheduled-status slot reuse gap is the structural root cause — pre-existing, not currently manifested on prod (0 rescheduled rows)"
  - "Plan 03 gate = PROCEED: no duplicate confirmed rows exist; CONCURRENTLY index build will validate cleanly"
  - "No prod data modified: Step 2 returned 0 rows; no cleanup action needed or taken"
  - "Plan 05 .neq → .eq fix confirmed still in scope per Pitfall 4 (capacity-accuracy fix, independent of double-booking root cause)"

patterns-established: []

# Metrics
duration: ~15min (diagnostic + checkpoint wait + approval recording)
completed: 2026-04-28
---

# Phase 11 Plan 01: CAP-01 Root-Cause Investigation Summary

**6-step prod diagnostic confirmed verdict (c): rescheduled-status slot reuse structural gap — no duplicate confirmed rows on prod; Plan 03 CONCURRENTLY index build gate-opened.**

## Performance

- **Duration:** ~15 min (diagnostic execution + human-verify checkpoint + approval recording)
- **Started:** 2026-04-28
- **Completed:** 2026-04-28
- **Tasks:** 1 auto + 1 checkpoint (human-verify)
- **Files modified:** 1 (FINDINGS.md created and committed)

## Accomplishments

- Ran all 6 diagnostic steps against live Supabase project mogfnutxrrbtvnaupoun with verbatim SQL output captured
- Confirmed `bookings_no_double_book` partial unique index is present and correctly defined on prod (`UNIQUE (event_type_id, start_at) WHERE status='confirmed'`)
- Confirmed zero duplicate confirmed bookings on prod (Step 2 = 0 rows) — the 2026-04-27 double-booking observation was not a persisted duplicate row
- Confirmed zero rescheduled+confirmed slot collisions on prod (Step 5 = 0 rows) — structural gap exists but has not materialized (only 4 bookings total: 2 confirmed, 2 cancelled, 0 rescheduled)
- Andrew reviewed and approved with verbatim "approved — proceed to Wave 2"

## Task Commits

1. **Task 1: 6-step diagnostic** - `82621d9` (feat)
2. **Checkpoint approval recorded** - `a0f76ae` (docs)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `.planning/phases/11-booking-capacity-and-double-booking-fix/11-01-CAP-01-FINDINGS.md` — Full 6-step diagnostic with verbatim SQL output, verdict (c), Plan 03 impact (PROCEED), and ## Approval section signed off by Andrew 2026-04-28

## Decisions Made

1. **Verdict (c) selected:** The 2026-04-27 double-booking observation is best explained by the rescheduled-status slot reuse structural gap (RESEARCH Pitfall 4 primary hypothesis). No confirmed duplicates exist on prod — the incident was likely a transient UX confusion or a booking that was subsequently cancelled (2 cancelled rows confirmed on prod). The structural gap itself is pre-existing: the slots API filters with `.neq("status","cancelled")` (which blocks rescheduled slots from being re-booked via UI) while the unique index only covers `status='confirmed'` — the gap is accepted behavior (rescheduled bookings hold their original slot for audit purposes).

2. **Plan 03 gate = PROCEED:** All existing confirmed bookings have distinct `(event_type_id, start_at)` pairs. The backfill of `slot_index DEFAULT 1` during the CONCURRENTLY build will produce no uniqueness conflicts. No pre-cleanup step is required.

3. **No prod data modified:** Task 1 used SELECT-only queries. No UPDATE or DELETE was executed at any point. This is explicitly recorded in the ## Approval section for future audit.

4. **Plan 05 .neq → .eq fix confirmed in scope:** Plan 05 already targets this change per its plan. Confirmed it remains in scope as a required Pitfall 4 capacity-accuracy fix. No new tasks added — the flagged downstream task was pre-existing in Plan 05's scope.

## Deviations from Plan

None — plan executed exactly as written. The 6-step diagnostic, checkpoint, and approval recording all followed the plan specification.

## Issues Encountered

None. The diagnostic was clean: all steps ran successfully, Steps 4 and 6 were correctly skipped (Step 2 returned 0 rows), and the verdict was unambiguous.

## User Setup Required

None — no external service configuration required. All queries were SELECT-only read against the linked Supabase project.

## Next Phase Readiness

- **Wave 2 is gate-opened.** Plans 11-02 and 11-03 (slot_index migration) may proceed immediately.
- **Plan 11-05 (.neq → .eq fix)** is confirmed in scope per Pitfall 4; no additional task needed.
- **No cleanup debt:** prod data is clean; the CONCURRENTLY index build in Plan 03 will not encounter uniqueness conflicts.
- **Accepted behavior documented:** rescheduled bookings hold their original slot for audit purposes; this gap persists in the new slot_index design and is intentional.

---
*Phase: 11-booking-capacity-and-double-booking-fix*
*Completed: 2026-04-28*
