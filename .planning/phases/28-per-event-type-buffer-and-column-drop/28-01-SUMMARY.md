---
phase: 28-per-event-type-buffer-and-column-drop
plan: 01
subsystem: api
tags: [supabase, postgres, zod, react-hook-form, slot-engine, buffer]

# Dependency graph
requires:
  - phase: 27-slot-correctness-db-layer-enforcement
    provides: "Confirmed bookings filter + capacity index pattern; route-handler structure for /api/slots"
provides:
  - "event_types.buffer_after_minutes is now the single source of truth for post-event buffer"
  - "Slot engine reads buffer per-booking from BookingRow.buffer_after_minutes (asymmetric back-side)"
  - "Slot engine reads buffer per-candidate from SlotInput.slotBufferAfterMinutes (asymmetric forward-side)"
  - "AccountSettings type no longer carries buffer_minutes (V15-CP-04 type-drift gate enforced)"
  - "Owner-facing event-type editor exposes 'Buffer after event (minutes)' input"
  - "Event-types list table renders Buffer column for every row including 0"
  - "BUFFER-06 divergence test block proves asymmetric semantics"
  - "Production deploy is live; T0 captured for Plan 28-02 drain gate"
affects: [28-02-drop-column-and-availability-cleanup, 28-03-divergence-tests-and-smoke, 30-public-booker-3-column-desktop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Asymmetric per-booking + per-candidate buffer math (LD-04): bufferedStart = slotStart - existingBooking.buffer_after_minutes; bufferedEnd = slotEnd + slotBufferAfterMinutes"
    - "event_types!inner(buffer_after_minutes) join on bookings query carries per-booking buffer to slot engine"
    - "Zod .catch(0) for forgiving numeric inputs (empty string / NaN coerce silently)"
    - "Two-step deploy drain protocol (CP-03): Plan 28-01 deploy ≥ 30 min live before Plan 28-02 DROP migration"

key-files:
  created:
    - "supabase/migrations/20260503221744_v15_backfill_buffer_after_minutes.sql"
  modified:
    - "lib/slots.types.ts"
    - "lib/slots.ts"
    - "app/api/slots/route.ts"
    - "tests/slot-generation.test.ts"
    - "app/(shell)/app/event-types/_lib/schema.ts"
    - "app/(shell)/app/event-types/_lib/types.ts"
    - "app/(shell)/app/event-types/_lib/actions.ts"
    - "app/(shell)/app/event-types/_components/event-type-form.tsx"
    - "app/(shell)/app/event-types/_components/event-types-table.tsx"
    - "app/(shell)/app/event-types/page.tsx"
    - "app/(shell)/app/event-types/[id]/edit/page.tsx"

key-decisions:
  - "Kept BookingRow defensive cast as union of object | array shapes — Supabase generated types model the !inner join as either; the runtime is always object for many-to-one FK, but TypeScript narrowing requires both branches"
  - "Resume across two agent sessions did not require any rework — Task 1 commit (b6874c1) and partial Task 2 diffs (uncommitted) were verifiably consistent with the plan and adopted as-is in session 2"
  - "Used push UTC timestamp as T0 proxy — exact Vercel 'Ready' time pending Andrew's confirmation"

patterns-established:
  - "Type-drift gate pattern (V15-CP-04): fully removing a type field instead of marking it optional surfaces missed callsites at compile time"
  - "Asymmetric buffer divergence test pattern (BUFFER-06): three-case test proves which side of the buffer math determines blocking"
  - "Forgiving numeric Zod input via .catch(0) for owner-facing settings"

# Metrics
duration: 13min (session 2 only — session 1 produced Task 1 commit and partial Task 2 diffs)
completed: 2026-05-04
---

# Phase 28 Plan 01: Backfill, Rewire, and Form Summary

**Per-event-type post-event buffer is now wired end-to-end (DB → slot engine → owner UI) using asymmetric LD-04 math (`bufferedStart = slotStart − existing.buffer_after_minutes`, `bufferedEnd = slotEnd + slotBufferAfterMinutes`), with the legacy `accounts.buffer_minutes` no longer read anywhere in `lib/` or `app/api/`.**

## Performance

- **Duration:** Session 2 ≈ 13 min (resume after usage-limit reset). Session 1 produced Task 1 commit + Task 2 partial diffs prior to limit hit; total wall-clock spans both sessions.
- **Started (session 2):** 2026-05-04T00:23Z (approximate)
- **Completed:** 2026-05-04T00:30Z (approximate, post-push)
- **Push to main:** 2026-05-04T00:27:49Z UTC (T0 proxy — see Drain Timestamp section)
- **Tasks:** 3 of 3 complete
- **Files modified:** 11 (1 SQL migration created + 10 TypeScript/TSX files modified)

## Drain Timestamp T0 (REQUIRED for Plan 28-02)

**Push completed at:** `2026-05-04T00:27:49Z UTC`

This is the local push completion timestamp, used as a proxy for Vercel's deploy "Ready" time. The actual T0 should be the Vercel dashboard's reported deploy `Ready` timestamp for commit `4aba090`. Plan 28-02 may begin no earlier than T0 + 30 minutes.

**Andrew's action required:** Confirm the Vercel "Ready" timestamp for commit `4aba090` and update this section in the SUMMARY (or simply gate Plan 28-02 launch on T0 + 30 min using the actual Ready time, whichever is later).

**Conservative drain-window earliest-start (using push timestamp):** `2026-05-04T00:57:49Z UTC` (push + 30 min).

## Captured `accounts.buffer_minutes` Distribution (pre-flight Step 2 of Task 1)

| Account slug             | buffer_minutes |
|--------------------------|----------------|
| `nsi`                    | **15**         |
| `nsi-rls-test`           | 0              |
| `nsi-rls-test-3`         | 0              |
| `soft-delete-test-acct`  | 0              |

**Expected post-backfill `event_types.buffer_after_minutes` distribution:** `{0, 15}` (any nsi event type → 15; other accounts → 0).

**Verified post-backfill distribution:** `{0, 15}` — matches expected exactly.

## Migration Filename

`supabase/migrations/20260503221744_v15_backfill_buffer_after_minutes.sql`

Idempotent (`WHERE buffer_after_minutes = 0` guard); no `deleted_at` filter (RESEARCH "Backfill Scope Filter": apply to all rows so restored archives inherit correct buffer); applied via `echo | npx supabase db query --linked -f` (the only working path in this repo).

## Accomplishments

- **Backfill applied** (Task 1, commit `b6874c1`): production `event_types.buffer_after_minutes` now reflects each row's account-level `buffer_minutes` value.
- **Slot engine asymmetric rewire** (Task 2, commit `2900a90`): `slotConflictsWithBookings` now uses per-booking + per-candidate buffers asymmetrically per LD-04. Type contract: `AccountSettings` lost `buffer_minutes`; `BookingRow` gained `buffer_after_minutes`; `SlotInput` gained `slotBufferAfterMinutes`. The `/api/slots` route handler joins `event_types!inner(buffer_after_minutes)` on bookings.
- **Owner UI** (Task 3, commit `4aba090`): event-type editor shows "Buffer after event (minutes)" input directly after Duration; list table shows Buffer column for every row (including 0); INSERT/UPDATE actions persist the field; edit page hydrates from DB.
- **Tests green:** `tests/slot-generation.test.ts` rewritten for asymmetric API; new BUFFER-06 divergence describe block adds 3 tests proving existing booking's buffer determines blocking. Full vitest suite: 28 files / 228 passing / 9 skipped.
- **Production deploy live:** push to main succeeded; Vercel deploy underway. T0 captured for Plan 28-02 drain gate.

## Task Commits

1. **Task 1: Author + apply backfill migration with pre-flight gate** — `b6874c1` (feat) — produced in session 1.
2. **Task 2: Rewire slot engine + types + route handler for asymmetric per-booking buffer** — `2900a90` (feat) — produced in session 2 (Task 2 diffs were partially written in session 1; session 2 completed the test file changes and tsc/vitest gates, then committed).
3. **Task 3: Add buffer field to event-type form, schema, actions, list table, and deploy** — `4aba090` (feat) — produced in session 2.

**Plan metadata commit:** (will be created next, alongside STATE.md update)

## Files Created/Modified

### Created
- `supabase/migrations/20260503221744_v15_backfill_buffer_after_minutes.sql` — Idempotent UPDATE that copies `accounts.buffer_minutes` → `event_types.buffer_after_minutes` for rows with `buffer_after_minutes = 0`.

### Modified — slot engine + route handler
- `lib/slots.types.ts` — `AccountSettings` drops `buffer_minutes`; `BookingRow` adds `buffer_after_minutes: number`; `SlotInput` adds `slotBufferAfterMinutes: number`.
- `lib/slots.ts` — `slotConflictsWithBookings` rewritten with asymmetric per-booking math; comment block updated to describe new semantics; `computeSlots` reads `input.slotBufferAfterMinutes`.
- `app/api/slots/route.ts` — `event_types` SELECT adds `buffer_after_minutes`; `accounts` SELECT drops `buffer_minutes`; `bookings` query joins `event_types!inner(buffer_after_minutes)`; `BookingRow[]` mapping reads from join (defensive object|array shape handling for Supabase generated types); `computeSlots` call passes `slotBufferAfterMinutes`.

### Modified — owner UI (event-types feature)
- `app/(shell)/app/event-types/_lib/schema.ts` — Zod `buffer_after_minutes` field with `.catch(0)`.
- `app/(shell)/app/event-types/_lib/types.ts` — `EventTypeListItem` includes `buffer_after_minutes`.
- `app/(shell)/app/event-types/_lib/actions.ts` — INSERT and UPDATE payloads include `buffer_after_minutes`.
- `app/(shell)/app/event-types/_components/event-type-form.tsx` — DEFAULTS adds `buffer_after_minutes: 0`; new `<div>` block with `<Label>` + `<Input>` placed directly after the Duration block.
- `app/(shell)/app/event-types/_components/event-types-table.tsx` — Buffer header + cell rendered after Duration column.
- `app/(shell)/app/event-types/page.tsx` — list-page SELECT includes `buffer_after_minutes`.
- `app/(shell)/app/event-types/[id]/edit/page.tsx` — `defaultValues` hydrates `buffer_after_minutes` from DB (fallback 0).

### Modified — tests
- `tests/slot-generation.test.ts` — `baseAccount` drops `buffer_minutes`; `input()` helper plumbs `slotBufferAfterMinutes` (default 0); existing buffer-overlap test rewritten for asymmetric semantics; daily-cap inline bookings updated to include `buffer_after_minutes: 0`; new BUFFER-06 divergence describe block (3 tests).

## Decisions Made

- **Use push UTC timestamp as T0 proxy:** The execution agent cannot directly observe Vercel's "Ready" status. Push completed at `2026-05-04T00:27:49Z`; Andrew should confirm the actual Vercel Ready time and use the later of (push + 30 min) or (Ready + 30 min) as the Plan 28-02 launch gate.
- **Defensive object | array shape in BookingRow mapping:** Supabase generated types model `event_types!inner(...)` joins as either a single object or an array (depending on inferred relationship cardinality). The runtime shape for many-to-one FK is always a single object, but the TS narrowing requires handling both branches (`Array.isArray(et) ? et[0]?.buffer_after_minutes : et?.buffer_after_minutes`). Defaulting to 0 if missing is defensive — should never fire under `!inner`, but keeps the type pure.
- **No availability-panel changes in this plan:** The 6 availability files (`app/(shell)/app/availability/...`) still reference `buffer_minutes` — that is intentional (Plan 28-02 scope). The drain window is what decouples the field-rename from the column-drop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Stale doc-comment in `lib/slots.ts`**
- **Found during:** Task 2 verify (`grep buffer_minutes lib/`)
- **Issue:** Module-level JSDoc step 10 still described the symmetric account-wide buffer model after the symmetric → asymmetric rewire.
- **Fix:** Updated the doc comment to describe the asymmetric per-event-type semantics (Phase 28 LD-04).
- **Files modified:** `lib/slots.ts`
- **Verification:** Comment now accurately describes runtime behavior; no functional change.
- **Committed in:** `2900a90` (Task 2 commit).

**2. [Rule 1 — Bug / Pre-existing] Test fixture daily-cap bookings missing `buffer_after_minutes`**
- **Found during:** Task 2 (typecheck after fixture update)
- **Issue:** Two `BookingRow` literals inside the daily-cap test block lacked the new required `buffer_after_minutes` field — would have failed `tsc --noEmit` if not addressed alongside the type contract change.
- **Fix:** Added `buffer_after_minutes: 0` to both inline booking literals (semantically equivalent to v1.0 buffer=0 baseline, preserves existing test assertion of 14 slots).
- **Files modified:** `tests/slot-generation.test.ts`
- **Verification:** vitest passes; assertion of 14 slots still holds (buffer=0 collapses bufferedStart/End to slot start/end).
- **Committed in:** `2900a90` (Task 2 commit).

**Total deviations:** 2 auto-fixed (both Rule 1 — bug/correctness). No scope creep. No architectural changes.
**Impact on plan:** None — both fixes were necessary to land the rewire cleanly under TS strict mode, and both follow directly from the type contract change in Task 2 Step 1.

## Issues Encountered

- **Mid-plan usage-limit reset.** Session 1 produced Task 1 commit (`b6874c1`) and partial Task 2 diffs (uncommitted: `lib/slots.ts`, `lib/slots.types.ts`, `app/api/slots/route.ts`). Session 2 resumed from the orchestrator-supplied context, verified all session-1 work via `git diff` was correct per LD-04 asymmetric semantics, completed the test file (Task 2 Step 4) plus the missing route.ts BookingRow mapping (which was uncommitted but also had not yet read from the join), then committed Task 2 and proceeded through Task 3 normally. **No rework was required** — session-1 partial diffs were verifiably correct and adopted as-is.
- **Supabase TS type for `!inner` join modeled as object|array.** Caused TS2352 on the `BookingRow[]` mapping. Resolved with defensive narrowing (handles both shapes; runtime is always object for many-to-one FK).

## User Setup Required

None — no external service configuration required. Andrew's only manual step is observing the Vercel deploy "Ready" timestamp on the dashboard for commit `4aba090` and using that as the precise T0 for the Plan 28-02 drain gate (or accepting the push timestamp `2026-05-04T00:27:49Z` as a conservative proxy).

## Next Phase Readiness

**Plan 28-02 (DROP migration + availability cleanup) is GATED — do NOT begin until:**

1. **Drain window elapsed:** ≥ 30 minutes since T0 (push `2026-05-04T00:27:49Z` UTC → earliest start `2026-05-04T00:57:49Z` UTC, or later if Vercel Ready timestamp is after push timestamp).
2. **Production smoke check passed:** Andrew confirms the new Buffer field on the event-type editor saves successfully and slots from the public booker still render correctly post-deploy.
3. **No active production bookings created in stale browser tabs:** the drain window exists precisely to let in-flight code finish before the column drops.

**Available for Plan 28-02 to consume:**
- DB column `accounts.buffer_minutes` is no longer read by any code in `lib/` or `app/api/` — only the 6 `app/(shell)/app/availability/...` files still reference it. Plan 28-02 will scrub those and apply the DROP migration.
- All slot-engine tests are green; BUFFER-06 divergence is now a regression gate.

**Available for Plan 28-03 to consume:**
- BUFFER-06 divergence describe block is already present (3 tests). Plan 28-03 may extend with additional cases or accept this set as complete and move directly to smoke testing.

---
*Phase: 28-per-event-type-buffer-and-column-drop*
*Completed: 2026-05-04 (UTC)*
