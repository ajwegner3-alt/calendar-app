---
phase: 32-inverse-date-overrides
plan: 01
subsystem: availability-engine
tags: [slots, date-overrides, interval-subtraction, supabase-migration, vitest]

# Dependency graph
requires:
  - phase: 04-availability-engine
    provides: "computeSlots() / windowsForDate() / DateOverrideRow shape"
  - phase: 28-buffer-after-rebrand
    provides: "asymmetric per-event-type buffer-after-minutes (preserved invariant)"
provides:
  - "subtractWindows() exported pure helper for interval subtraction"
  - "windowsForDate() rewritten with Phase 32 MINUS semantics (is_closed=false rows now subtract from weekly base)"
  - "Production wipe of 3 legacy custom-hours rows so dataset is homogeneous under new semantics"
  - "17-test coverage for subtractWindows + windowsForDate MINUS branch"
affects:
  - "32-02 (override editor UI) — new UI must write rows with unavailable-window meaning"
  - "32-03 (auto-cancel batch) — affected-bookings query depends on MINUS semantics being correct"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interval subtraction algorithm (O(B*N)) hand-rolled in lib/slots.ts (no library dependency)"
    - "Wipe-and-flip migration pattern for low-row-count semantic flips (≤5 rows): pure DML DELETE + COMMENT ON COLUMN updates, no schema column changes (CP-03 not triggered)"

key-files:
  created:
    - "supabase/migrations/20260505120000_phase32_wipe_legacy_custom_hours.sql"
    - "tests/slots-inverse-overrides.test.ts"
  modified:
    - "lib/slots.ts (subtractWindows export + windowsForDate MINUS rewrite + algorithm-order header comment)"
    - "lib/slots.types.ts (DateOverrideRow JSDoc updated to Phase 32 semantics)"
    - "tests/slot-generation.test.ts (2 existing override tests refactored to assert MINUS semantics)"

key-decisions:
  - "Wipe (Option B from 32-RESEARCH.md) over add semantics_v2 column (Option A) — production diagnostic confirmed only 3 legacy rows so a clean break is simpler than a dual-read window"
  - "Refactor 2 existing tests in tests/slot-generation.test.ts that encoded the pre-Phase-32 PLUS semantics, in the same commit as the slot engine change, so the existing slot suite stays green"
  - "Defensive immutability in subtractWindows: clone base entries before iteration so callers cannot have their inputs mutated"

patterns-established:
  - "Phase 32 MINUS semantics: is_closed=true → null (full block); is_closed=false rows → subtract from weekly-rules base; if MINUS yields empty, return null"
  - "Closed-weekday no-op rule: an unavailable window on a day with no weekly rules cannot open the day under MINUS (nothing to subtract from); diverges from pre-Phase-32 behavior where overrides could open closed weekdays"

# Metrics
duration: ~17min
completed: 2026-05-05
---

# Phase 32 Plan 01: Slot Engine MINUS Semantics + Legacy Wipe Summary

**Slot engine flipped to MINUS semantics: `date_overrides.is_closed=false` rows now subtract from weekly-rules base via new exported `subtractWindows()` helper, with 3 legacy custom-hours rows wiped from production in the same migration.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-05-05T22:55:00Z (approx)
- **Completed:** 2026-05-05T23:12:22Z
- **Tasks:** 3
- **Files modified:** 3 (lib/slots.ts, lib/slots.types.ts, tests/slot-generation.test.ts)
- **Files created:** 2 (migration + new test file)

## Accomplishments

- Migration `20260505120000_phase32_wipe_legacy_custom_hours.sql` applied to linked Supabase project — 3 legacy `is_closed=false` rows deleted, 0 rows remaining in `date_overrides`, column comments updated to Phase 32 unavailable-window semantics
- `subtractWindows(base, blocked)` exported from `lib/slots.ts` with full JSDoc and 11 unit tests covering all overlap cases (no-op, full cover, middle split, left/right edge trim, empty base, immutability, boundary equality)
- `windowsForDate()` rewritten: `is_closed=true` branch unchanged; new `is_closed=false` branch starts from weekly-rules base, calls `subtractWindows()`, and returns `null` if the result is empty (full-cover or empty-base case)
- 6 windowsForDate integration tests cover: no overrides, is_closed=true block, MINUS branch with one window, full-cover → null, closed-weekday no-op (a key behavior change vs pre-Phase-32), and multiple unavailable windows on a single date
- Existing slot test suite (`tests/slot-generation.test.ts` + `tests/slots-api.test.ts`) remains 100% green — 31 existing tests + 17 new = **48 slot tests pass**, no regressions
- Buffer-after-minutes flow downstream of `windowsForDate()` is structurally untouched; EXCLUDE GIST + capacity index untouched (no DDL)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wipe-and-flip migration for legacy custom_hours rows** — `7ac5def` (feat)
2. **Task 2: Slot engine MINUS semantics + subtractWindows helper** — `8c673e6` (feat)
3. **Task 3: Unit tests for subtractWindows + MINUS semantics** — `dc12ada` (test)

**Plan metadata:** appended at session close (`docs(32-01): complete slot-engine-minus-semantics plan`)

## Files Created/Modified

**Created:**
- `supabase/migrations/20260505120000_phase32_wipe_legacy_custom_hours.sql` — DELETE legacy rows + 3 COMMENT ON COLUMN updates
- `tests/slots-inverse-overrides.test.ts` — 11 subtractWindows + 6 windowsForDate integration tests

**Modified:**
- `lib/slots.ts` — Added exported `subtractWindows()`; rewrote `windowsForDate()` MINUS branch; updated algorithm-order header comment to step 4
- `lib/slots.types.ts` — Updated `DateOverrideRow` JSDoc to describe Phase 32 unavailable-window semantics
- `tests/slot-generation.test.ts` — Refactored 2 existing override tests (closed-weekday opener test + REPLACES-weekly-rules test) to assert MINUS semantics; renamed describe block + 1 test name to drop the now-stale "custom hours" terminology

## Decisions Made

- **Wipe over semantics_v2 column** — Production diagnostic confirmed exactly 3 legacy `is_closed=false` rows. Adding a column for a 3-row dataset is more invasive (CP-03 two-step protocol) than the wipe; wipe is the cleaner break. Plan 32-01 explicitly approved this path before execution.
- **Refactored 2 existing tests in the slot-engine commit (Task 2), not in a separate commit** — Those tests literally encoded the old PLUS semantics ("override custom hours OPENS a normally-closed weekday" and "override custom hours REPLACES weekly rules"). The semantic flip and the test rewrite are inseparable; bundling keeps the slot suite green within a single revertable commit and prevents a transient "broken main" state.
- **Defensive copy in `subtractWindows`** — Clone base entries (`base.map((w) => ({...w}))`) instead of `[...base]` so callers can't observe mutated entries. Verified by an "does not mutate input arrays" unit test.
- **Closed-weekday no-op behavior** — The plan's specification (`if baseWindows.length === 0 return null`) means an unavailable window on a day with no weekly rules cannot open the day. This is a deliberate behavior change vs pre-Phase-32 (where `is_closed=false` rows could open closed weekdays). Captured as an integration test ("weekly base empty for the day-of-week → returns null even if unavailable rows exist").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Refactored 2 existing slot-generation tests that asserted pre-Phase-32 PLUS semantics**
- **Found during:** Task 2 (slot engine rewrite)
- **Issue:** `tests/slot-generation.test.ts` had two tests that literally asserted the old "custom hours = available windows" behavior:
  - "override custom hours OPENS a normally-closed weekday (override always wins)" — would fail under Phase 32 (closed-weekday no-op)
  - "override custom hours REPLACES weekly rules for that date" — would fail under Phase 32 (rule says weekly minus override = 12 slots, not 4)
- These tests encode the exact behavior the phase intentionally flips. Leaving them unchanged would have left the existing slot suite red and made "no regressions" unverifiable.
- **Fix:** Rewrote both tests to assert the new MINUS semantics (closed-weekday no-op → 0 slots; weekly base 9–17 minus 13–15 → 12 slots). Updated the parent describe block name from "CONTEXT-locked semantics" to "Phase 32 MINUS semantics" and renamed the mixed-rows test from "custom-hours" to "unavailable-window."
- **Files modified:** tests/slot-generation.test.ts
- **Verification:** All 18 slot-generation tests pass after refactor; 13 slots-api tests still pass; 17 new tests in slots-inverse-overrides pass — 48 total slot tests green.
- **Committed in:** `8c673e6` (Task 2 commit, bundled with the engine change for atomicity)

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing test asserting old behavior, refactored alongside the intentional semantic flip)
**Impact on plan:** Necessary corollary of the semantic flip. No scope creep — the rewrite covers the exact same dates/rules/expectations, only the assertions update to match new semantics.

## Issues Encountered

- **Pre-existing TS errors in test-mock files** — `npx tsc --noEmit` surfaces 30+ errors across `tests/bookings-*.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-*.test.ts`, `tests/send-reminder-for-booking.test.ts`. All reference removed `__mockSendCalls` / `__setTurnstileResult` helpers. Verified NONE touch `lib/slots.ts`, `lib/slots.types.ts`, or `tests/slot-generation.test.ts` (the files modified by this plan). Pre-existing tech debt explicitly carried forward in STATE.md from Phase 31; **not introduced by this plan and not fixed by it**.
- **Pre-existing working-tree drift on `.planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md`** — Carried forward from Phase 31 (filed under "decide later"). Not staged or modified by this plan; left exactly as found.

## User Setup Required

None — Task 1's migration was applied to the linked Supabase project during execution. No environment variables, no dashboard configuration. Phase 32-02 (UI) and 32-03 (batch cancel) will consume these foundations without further setup.

## Next Phase Readiness

Foundation is ready for the rest of Phase 32:

- **Plan 32-02 (Override Editor UI)** can now safely treat new writes as unavailable-window rows (semantic by construction). The existing `override-modal.tsx` + `upsertDateOverrideAction` flow needs only label/copy changes and the new affected-bookings preview surface.
- **Plan 32-03 (Auto-cancel batch)** can rely on `subtractWindows()` and the MINUS branch in `windowsForDate()` to correctly identify which confirmed bookings fall inside an unavailable window once the owner saves it.

No blockers. Phase 31's `getRemainingDailyQuota()` is the canonical pre-flight gate for the EMAIL-23 quota check that ships in Plan 32-03; nothing about Plan 32-01 changes that contract.

---
*Phase: 32-inverse-date-overrides*
*Completed: 2026-05-05*
