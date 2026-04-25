---
phase: 04-availability-engine
plan: "02"
subsystem: api
tags: [date-fns, date-fns-tz, TZDate, DST, slot-generation, vitest, unit-tests, availability]

# Dependency graph
requires:
  - phase: 04-01
    provides: date-fns@4.1.0 + @date-fns/tz@1.4.1 installed; accounts table has buffer_minutes/min_notice_hours/max_advance_days/daily_cap columns

provides:
  - lib/slots.types.ts — SlotInput, Slot, AccountSettings, AvailabilityRuleRow, DateOverrideRow, BookingRow type contracts
  - lib/slots.ts — pure computeSlots(input: SlotInput): Slot[] function, DST-safe, no Supabase
  - tests/slot-generation.test.ts — 15 Vitest tests covering AVAIL-09 DST hard gate + all algorithmic rules

affects:
  - 04-03 (data layer / server actions — imports SlotInput, Slot from slots.types.ts)
  - 04-06 (route handler — calls computeSlots, wraps in { slots: [...] } response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct TZDate construction for wall-clock window endpoints (not addMinutes from midnight)"
    - "new Date(tzDate.getTime()).toISOString() for UTC Z-format output from TZDate"
    - "Pure function with injected now: Date parameter for deterministic unit testing"
    - "Explicit TZDate(y, m, d+1, 0, 0, 0, TZ) for cursor advance (not addDays) for bulletproof DST"

key-files:
  created:
    - lib/slots.types.ts
    - lib/slots.ts
    - tests/slot-generation.test.ts
  modified:
    - lib/slots.ts (bug fix in same plan iteration)

key-decisions:
  - "addMinutes(midnight, startMinute) is DST-UNSAFE for window endpoints: adds elapsed UTC ms, not wall-clock mins. On spring-forward day addMinutes(midnight_CST, 540) = 10:00 CDT not 9:00 CDT. Fix: direct TZDate(y,m,d,h,min,0,TZ) construction."
  - "TZDate.toISOString() returns offset format (T09:00:00-05:00), NOT UTC Z format — contrary to RESEARCH.md claim. Use new Date(tzDate.getTime()).toISOString() for UTC Z output."
  - "TZDate.getDay() (method call, not date-fns getDay function) returns TZ-aware day-of-week (confirmed by spring-forward Sunday tests passing with day_of_week=0)."
  - "addMinutes IS correct for cursor advancement inside the slot loop (elapsed-time stepping between slots is intended). Only the window START and END endpoints need direct TZDate construction."
  - "Buffer overlap logic extends the SLOT (not the booking) by buffer_minutes on each side. With buffer=15min, a 10:00-10:30 booking removes 3 slots: 9:30, 10:00, AND 10:30 (all overlap the buffered slot window)."
  - "computeSlots() is a pure function — no Supabase, no Next.js, no process.env. Caller (Plan 04-06 route handler) pre-fetches all data and passes arrays in."
  - "Step size = durationMinutes (CONTEXT-locked). No separate step_minutes parameter."
  - "Daily cap counting: caller MUST filter status != cancelled before passing bookings array. Engine counts the array as-is (trusts caller contract)."

patterns-established:
  - "SlotInput boundary contract: rangeStart/rangeEnd as YYYY-MM-DD local dates, now as UTC Date, pre-fetched arrays for rules/overrides/bookings. Plans 04-03 and 04-06 MUST respect this shape."
  - "Override-always-wins: is_closed row → null (skip day); custom-hours rows → use those windows (ignores weekly rules entirely); no override → weekly rules by dow."
  - "Window endpoints use new TZDate(y, m-1, d, h, min, 0, TZ) where h=Math.floor(minute/60), min=minute%60."

# Metrics
duration: 35min
completed: 2026-04-25
---

# Phase 4 Plan 02: Slot Engine and DST Tests Summary

**Pure computeSlots() function with 15 Vitest AVAIL-09 tests — DST-safe slot generation proved correct across March 8 2026 spring-forward and Nov 1 2026 fall-back in America/Chicago**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-25T12:40:00Z (approx)
- **Completed:** 2026-04-25T13:15:00Z (approx)
- **Tasks:** 2
- **Files created:** 3 (lib/slots.types.ts, lib/slots.ts, tests/slot-generation.test.ts)

## Accomplishments

- `lib/slots.types.ts`: 6 exported type contracts forming the stable boundary between Plans 04-02 (engine), 04-03 (data layer), and 04-06 (route handler)
- `lib/slots.ts`: Pure `computeSlots(input: SlotInput): Slot[]` with all 7 algorithmic rules applied in correct order; no Supabase, no Next.js imports
- `tests/slot-generation.test.ts`: 15 tests passing in Vitest node env — AVAIL-09 spring-forward (3 scenarios), fall-back (2 scenarios), normal baseline, buffer-overlap, daily cap (2 cases), min-notice, max-advance, override semantics (4 cases)
- Confirmed RESEARCH Open Q2: `TZDate.getDay()` returns TZ-aware day-of-week (spring-forward Sunday with day_of_week=0 passes)
- Discovered and fixed 2 critical `@date-fns/tz` v4 API deviations from RESEARCH.md claims (documented below)

## Task Commits

1. **Task 1: Ship slot-engine types + pure computeSlots function** — `2afe0e2` (feat)
2. **Task 2: Ship DST + algorithmic unit tests for computeSlots** — `c92ca59` (test + bug fixes in lib/slots.ts)

## Files Created/Modified

- `lib/slots.types.ts` — 6 exported interfaces: SlotInput, Slot, AccountSettings, AvailabilityRuleRow, DateOverrideRow, BookingRow
- `lib/slots.ts` — Pure computeSlots() + minuteToTZDate() helper + window/cap/buffer helpers; 175 lines
- `tests/slot-generation.test.ts` — 15 Vitest unit tests, @vitest-environment node, no DB

## Decisions Made

1. **Direct TZDate construction for window endpoints** — `new TZDate(y, m-1, d, h, min, 0, TZ)` instead of `addMinutes(midnight, minutesSinceMidnight)`. The latter adds elapsed UTC milliseconds (not wall-clock minutes), producing wrong epochs on DST-transition days. Discovered via failing tests.

2. **`new Date(tzDate.getTime()).toISOString()` for UTC output** — `TZDate.toISOString()` in @date-fns/tz v1.4.1 returns local offset format (`T09:00:00-05:00`), NOT UTC Z format. RESEARCH.md was incorrect on this point. `getTime()` returns the UTC epoch; native Date.toISOString() always produces Z format.

3. **Buffer-overlap removes 3 slots (not 2) for a 15-min buffer around a 30-min booking** — The buffered SLOT window extends 15 min before the slot start and 15 min after the slot end. A 10:00-10:30 CDT booking with 15-min buffer removes slots 9:30, 10:00, AND 10:30 (all three overlap the respective buffered ranges). The plan's test spec was incorrect at 14 slots; the engine is correct at 13.

4. **`addMinutes` is correct for cursor advancement** (between slot iterations) — Only the window start/end need direct TZDate construction. Once we have a concrete UTC epoch as the cursor, elapsed-time stepping via `addMinutes` correctly produces the next slot at the intended UTC instant.

5. **`baseAccount.max_advance_days: 9999` in test helper** — The `now` pin at 2025-01-01 and 2026 test dates require >530 days of advance. 365 was insufficient (tests returned 0 slots due to max-advance filter). Set to 9999 to prevent max-advance from interfering with tests that don't explicitly test it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `addMinutes(midnight, startMinute)` produces wrong UTC epoch on DST days**

- **Found during:** Task 2 (AVAIL-09 spring-forward tests failing)
- **Issue:** `addMinutes` adds elapsed UTC milliseconds, not wall-clock minutes. On spring-forward day: `addMinutes(midnight_CST_06:00Z, 540)` = 15:00Z = 10:00 CDT. Expected: 14:00Z = 9:00 CDT. The plan's provided code skeleton (RESEARCH §6) contained this bug.
- **Fix:** Introduced `minuteToTZDate(y, month, d, minutesSinceMidnight, tz)` helper that extracts `h = Math.floor(m/60), min = m%60` and constructs `new TZDate(y, month-1, d, h, min, 0, tz)` directly.
- **Files modified:** `lib/slots.ts`
- **Verification:** All 5 DST test cases pass with correct slot counts AND UTC ISO strings
- **Committed in:** c92ca59 (Task 2 commit)

**2. [Rule 1 - Bug] `TZDate.toISOString()` returns offset format, not UTC Z**

- **Found during:** Task 2 (min-notice test showing `T10:00:00.000-05:00` instead of `T15:00:00.000Z`)
- **Issue:** RESEARCH.md stated "Calling `.toISOString()` on any `TZDate` returns the UTC ISO string." Actual behavior: @date-fns/tz v1.4.1 `TZDate.toISOString()` returns the local time with offset notation.
- **Fix:** Changed `cursor.toISOString()` and `slotEnd.toISOString()` to `new Date(cursor.getTime()).toISOString()` and `new Date(slotEnd.getTime()).toISOString()`.
- **Files modified:** `lib/slots.ts`
- **Verification:** All slot `start_at`/`end_at` values are now proper UTC Z strings matching test expectations
- **Committed in:** c92ca59 (Task 2 commit)

**3. [Rule 1 - Bug] Test assertion: buffer-overlap removes 3 slots, not 2**

- **Found during:** Task 2 (buffer-overlap test failing: expected 14, got 13)
- **Issue:** Plan's test spec stated 2 slots removed (9:30, 10:00) and expected `toHaveLength(14)`. The buffer-overlap algorithm correctly removes 3 slots: the 10:30 slot's buffered range [15:15Z, 16:15Z] overlaps the booking [15:00Z, 15:30Z] via `isBefore(15:15Z, 15:30Z) && isBefore(15:00Z, 16:15Z)`. The engine is correct; the spec was wrong.
- **Fix:** Updated test assertion to `toHaveLength(13)`, added 10:30 CDT to the `not.toContain` assertions, updated comments with full overlap analysis.
- **Files modified:** `tests/slot-generation.test.ts`
- **Verification:** Test passes with correct slot count and confirmed slot exclusions
- **Committed in:** c92ca59 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in plan-provided code and test specs)
**Impact on plan:** All fixes required for correctness. RESEARCH Open Q1 concern about addDays was vindicated — the issue was actually addMinutes, not addDays. No scope creep.

## Open Questions Resolved

- **RESEARCH Open Q2 (getDay TZ-aware):** `TZDate.getDay()` (method call) returns TZ-aware day-of-week. Confirmed by spring-forward Sunday scenarios passing with `day_of_week=0`. This is the SAFE pattern — use `tzDate.getDay()`, not `getDay(tzDate)` from date-fns.
- **RESEARCH Open Q1 (addDays behavior):** Conservative `new TZDate(y, m, d+1, 0, 0, 0, TZ)` used for cursor advance. Not tested with addDays (risk avoided). The deeper finding: even `addMinutes` on window endpoints was DST-unsafe; explicit construction is the only safe pattern.

## API Contracts for Downstream Plans

### SlotInput (lib/slots.types.ts)
```typescript
interface SlotInput {
  rangeStart: string;       // YYYY-MM-DD local date
  rangeEnd: string;         // YYYY-MM-DD local date
  durationMinutes: number;  // step size = this value
  account: AccountSettings; // timezone, buffer_minutes, min_notice_hours, max_advance_days, daily_cap
  rules: AvailabilityRuleRow[];     // { day_of_week, start_minute, end_minute }
  overrides: DateOverrideRow[];     // { override_date, is_closed, start_minute, end_minute }
  bookings: BookingRow[];   // CALLER must filter status != 'cancelled' before passing
  now: Date;                // UTC; MUST be injected (not new Date() inside computeSlots)
}
```

### Slot (lib/slots.types.ts)
```typescript
interface Slot { start_at: string; end_at: string; }  // both UTC ISO Z strings
```

### computeSlots() contract
- Returns sorted ascending `Slot[]`
- Returns `[]` for days that are blocked, cap-reached, or have no matching rules
- No `cap_reached` flag (CONTEXT-deferred)
- Step size = `durationMinutes` (CONTEXT-locked, no separate step param)

## Issues Encountered

- `@date-fns/tz` v4 API deviations: RESEARCH.md contained two incorrect claims about `TZDate.toISOString()` and `addMinutes` DST safety. Both discovered immediately via failing AVAIL-09 tests and fixed inline.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `computeSlots()` is fully tested and ready for Plan 04-06 (route handler) to call
- `SlotInput` / `Slot` types are stable — Plan 04-03 (already complete per STATE.md) imports from slots.types.ts
- No blockers

---
*Phase: 04-availability-engine*
*Completed: 2026-04-25*
