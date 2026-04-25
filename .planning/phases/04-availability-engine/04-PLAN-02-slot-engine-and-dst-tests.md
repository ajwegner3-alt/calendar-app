---
phase: 04-availability-engine
plan: 02
type: execute
wave: 2
depends_on: ["04-01"]
files_modified:
  - lib/slots.ts
  - lib/slots.types.ts
  - tests/slot-generation.test.ts
autonomous: true

must_haves:
  truths:
    - "lib/slots.ts exports a pure computeSlots(input) function with NO Supabase imports — accepts pre-fetched rules/overrides/bookings/account/eventType arrays and returns Array<{start_at, end_at}> UTC ISO strings (AVAIL-08 core)"
    - "Slot generation uses TZDate from @date-fns/tz + addMinutes/addDays/getDay from date-fns; NO raw new Date() arithmetic, NO fixed-millisecond offsets, NO formatInTimeZone (which doesn't exist in v4)"
    - "Slot iteration step size equals the event-type duration_minutes (CONTEXT-locked: 30-min event = 30-min steps)"
    - "Algorithm applies in order: (a) load weekly rules for the local-date day-of-week; (b) override always wins (is_closed = blocked, custom hours = replace; mixing handled by checking is_closed first); (c) min-notice filter (slot.start >= now + min_notice_hours); (d) max-advance filter (slot.start <= now + max_advance_days); (e) daily cap check (count confirmed bookings per local-date in account TZ; cap reached = skip whole day); (f) buffer-overlap exclusion against existing bookings"
    - "Daily-cap counting EXCLUDES cancelled bookings (mirrors Phase 3 .neq('status','cancelled') pattern locked in CONTEXT)"
    - "tests/slot-generation.test.ts contains AVAIL-09 DST cases for March 8 2026 (spring forward) and Nov 1 2026 (fall back) in America/Chicago — every case asserts both expected slot count AND expected start_at[i] UTC ISO strings (no missing or duplicate slots at the transition boundary)"
    - "All tests pass via `npm test -- tests/slot-generation.test.ts`"
  artifacts:
    - path: "lib/slots.types.ts"
      provides: "Type contracts for the slot engine: SlotInput, Slot, AccountSettings, AvailabilityRuleRow, DateOverrideRow, BookingRow"
      exports: ["SlotInput", "Slot", "AccountSettings", "AvailabilityRuleRow", "DateOverrideRow", "BookingRow"]
      min_lines: 40
    - path: "lib/slots.ts"
      provides: "Pure computeSlots(input: SlotInput): Slot[] — DST-safe via TZDate + addMinutes; no Supabase imports"
      exports: ["computeSlots"]
      contains: "TZDate"
      min_lines: 100
    - path: "tests/slot-generation.test.ts"
      provides: "Vitest unit tests covering: spring-forward March 8 2026, fall-back Nov 1 2026, normal-day baseline, buffer overlap, daily cap, min-notice filter, max-advance filter, override-blocks-day, override-replaces-rules, override-on-closed-weekday"
      contains: "2026-03-08"
      min_lines: 200
  key_links:
    - from: "lib/slots.ts"
      to: "@date-fns/tz TZDate class"
      via: "import { TZDate } from '@date-fns/tz'"
      pattern: "TZDate"
    - from: "lib/slots.ts"
      to: "date-fns addMinutes/addDays/getDay/isBefore/isAfter"
      via: "import { addMinutes, addDays, getDay, isBefore, isAfter } from 'date-fns'"
      pattern: "addMinutes|addDays|getDay"
    - from: "tests/slot-generation.test.ts"
      to: "lib/slots.ts (computeSlots)"
      via: "import { computeSlots } from '@/lib/slots'"
      pattern: "computeSlots"
    - from: "Plan 04-06 /api/slots route"
      to: "lib/slots.ts (computeSlots)"
      via: "import { computeSlots } from '@/lib/slots' — route fetches data from Supabase, passes to computeSlots"
      pattern: "computeSlots"
---

<objective>
Build the SLOT GENERATION ENGINE — a pure, DB-free, DST-safe function that takes pre-fetched availability data and produces the UTC slot list. This is the most-likely-to-have-bugs module in the entire project (per ROADMAP "biggest bug-hotspot"). Tested in complete isolation via Vitest unit tests covering both 2026 US DST transitions before any UI or API wiring touches it.

Purpose: Centralize all slot-generation logic in ONE pure function so it can be unit-tested against the AVAIL-09 hard-gate (DST correctness) without DB or HTTP overhead. The route handler in Plan 04-06 will be a thin shell that fetches data and calls this function — the algorithmic complexity lives entirely here.

Output: Two source files (`lib/slots.types.ts` for shared types, `lib/slots.ts` for the pure function) and one test file (`tests/slot-generation.test.ts`) covering AVAIL-09 + the algorithmic rules from CONTEXT.md. No DB calls, no HTTP, no UI.

Plan-level scoping: This plan does NOT touch Supabase, server actions, route handlers, or UI. The contract for `SlotInput` (declared in `lib/slots.types.ts`) is the stable boundary — Plans 04-03 (actions) and 04-06 (route) consume it; nobody mutates it.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-availability-engine/04-CONTEXT.md
@.planning/phases/04-availability-engine/04-RESEARCH.md
@.planning/phases/04-availability-engine/04-01-SUMMARY.md

# Existing schema this plan reads contracts from (we are NOT calling Supabase, but the row shapes match these tables)
@supabase/migrations/20260419120000_initial_schema.sql

# Existing test setup
@vitest.config.ts
@tests/setup.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship slot-engine types + pure computeSlots function</name>
  <files>lib/slots.types.ts, lib/slots.ts</files>
  <action>
Create the type contracts and the pure slot-generation function. RESEARCH §2 has the canonical algorithm and §6 has the recommended implementation skeleton; RESEARCH "Code Examples" has a near-final implementation. Use it as your starting point but adapt the type names/shape to match `lib/slots.types.ts` below.

**File 1 — `lib/slots.types.ts`:**

```typescript
/**
 * Pure types for the slot generation engine (Phase 4 Plan 04-02).
 *
 * Kept in a SEPARATE file from lib/slots.ts so:
 *   - Plan 04-03 (server actions) and Plan 04-06 (route handler) can import
 *     just the types without pulling in date-fns or @date-fns/tz transitively.
 *   - The pure function in lib/slots.ts is self-contained logic only.
 */

/** Account-wide availability settings. Read from the accounts table. */
export interface AccountSettings {
  /** IANA tz string. e.g. "America/Chicago" */
  timezone: string;
  /** AVAIL-03: pre/post buffer minutes around every booking (default 0) */
  buffer_minutes: number;
  /** AVAIL-04: hours before NOW that a slot becomes bookable (default 24) */
  min_notice_hours: number;
  /** AVAIL-05: days into future slots are shown (default 14) */
  max_advance_days: number;
  /** AVAIL-06: max confirmed bookings/day; null = no cap */
  daily_cap: number | null;
}

/** Single weekly availability rule row from availability_rules. */
export interface AvailabilityRuleRow {
  /** 0=Sun .. 6=Sat (Postgres convention, matches Date.prototype.getDay) */
  day_of_week: number;
  /** Minutes since local midnight (0-1439) */
  start_minute: number;
  /** Minutes since local midnight (1-1440); end > start enforced at DB CHECK */
  end_minute: number;
}

/** Single per-date override row from date_overrides. */
export interface DateOverrideRow {
  /** YYYY-MM-DD local calendar date (Postgres date type → ISO string in JS) */
  override_date: string;
  /** true = block this whole day; false = use the start_minute/end_minute window */
  is_closed: boolean;
  /** Null when is_closed=true; otherwise the custom-hours window start */
  start_minute: number | null;
  /** Null when is_closed=true; otherwise the custom-hours window end */
  end_minute: number | null;
}

/** Existing confirmed booking row used for buffer-overlap and daily-cap checks. */
export interface BookingRow {
  /** UTC ISO string (timestamptz from Supabase) */
  start_at: string;
  /** UTC ISO string */
  end_at: string;
}

/** Input for computeSlots. The route handler (Plan 04-06) populates this. */
export interface SlotInput {
  /** Local YYYY-MM-DD start of range (inclusive), interpreted in account TZ */
  rangeStart: string;
  /** Local YYYY-MM-DD end of range (inclusive), interpreted in account TZ */
  rangeEnd: string;
  /** Event type duration in minutes (becomes the slot step size) */
  durationMinutes: number;
  account: AccountSettings;
  rules: AvailabilityRuleRow[];
  overrides: DateOverrideRow[];
  /** Confirmed bookings in/near the range (caller must filter status != 'cancelled') */
  bookings: BookingRow[];
  /** Current UTC instant. Inject as parameter so unit tests can pin "now". */
  now: Date;
}

/** Single output slot. Both endpoints in UTC ISO. */
export interface Slot {
  start_at: string;
  end_at: string;
}
```

**File 2 — `lib/slots.ts`:**

```typescript
/**
 * Pure slot-generation engine (Phase 4 Plan 04-02).
 *
 * Given pre-fetched availability data, produce a UTC slot list with all rules
 * applied. NO Supabase, NO Next.js, NO HTTP — just date math.
 *
 * DST safety: uses TZDate from @date-fns/tz. addMinutes/addDays on a TZDate are
 * wall-clock-correct in the named timezone. Never use raw new Date() arithmetic
 * or fixed-millisecond offsets here — RESEARCH Pitfall 2.
 *
 * Algorithm order (CONTEXT-locked + RESEARCH §2):
 *   1. Iterate local calendar dates in [rangeStart, rangeEnd]
 *   2. For each date, check overrides FIRST (override always wins, CONTEXT)
 *   3. If overrides[date] has any is_closed=true row → skip the whole day
 *   4. Else if overrides[date] has custom-hours rows → use those windows
 *   5. Else use weekly rules for getDay(date) in account TZ
 *   6. Daily cap: count non-cancelled bookings on this local-date; if >= cap, skip
 *   7. For each window, generate slots at duration-minute steps
 *   8. Apply min-notice filter (slot.start >= now + min_notice_hours)
 *   9. Apply max-advance filter (slot.start <= now + max_advance_days)
 *   10. Apply buffer-overlap exclusion (no slot may overlap any existing booking
 *       extended by buffer_minutes on either side)
 *
 * @date-fns/tz v4 API note: TZDate inherits from Date; addMinutes/addDays
 * preserve the TZDate type and its bound timezone (RESEARCH §1 Open Q1).
 */

import { TZDate } from "@date-fns/tz";
import { addMinutes, addDays, getDay, isBefore, isAfter } from "date-fns";

import type {
  Slot,
  SlotInput,
  AvailabilityRuleRow,
  DateOverrideRow,
} from "./slots.types";

/**
 * Format a Date or TZDate as the local YYYY-MM-DD string in its bound timezone.
 *
 * For TZDate instances, getFullYear/getMonth/getDate return the wall-clock parts
 * in the bound timezone (this is the entire point of TZDate).
 */
function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generate slots inside a single window on a single local date.
 * Slot end is computed in the account TZ via addMinutes — DST-safe.
 */
function* generateWindowSlots(
  localDate: string,        // "2026-03-08"
  startMinute: number,      // local minutes since midnight
  endMinute: number,
  durationMinutes: number,
  timeZone: string,
): Generator<Slot> {
  const [year, month, day] = localDate.split("-").map(Number);
  // Construct local midnight in the account TZ (NOT new Date()).
  const midnight = new TZDate(year, month - 1, day, 0, 0, 0, timeZone);
  const windowStart = addMinutes(midnight, startMinute);
  const windowEnd = addMinutes(midnight, endMinute);

  let cursor = windowStart;
  while (true) {
    const slotEnd = addMinutes(cursor, durationMinutes);
    // Slot must fit entirely within the window (use isAfter, not >).
    if (isAfter(slotEnd, windowEnd)) break;
    yield {
      start_at: cursor.toISOString(),
      end_at: slotEnd.toISOString(),
    };
    // Step size = duration. CONTEXT-locked: 30-min event → 30-min steps.
    cursor = slotEnd;
  }
}

/**
 * Determine the windows to apply for a single local date.
 * Override always wins (CONTEXT-locked).
 *
 * Returns null if the date is fully blocked (no slots).
 */
function windowsForDate(
  localDate: string,
  dayOfWeek: number,
  rules: AvailabilityRuleRow[],
  overrides: DateOverrideRow[],
): Array<{ start_minute: number; end_minute: number }> | null {
  const dayOverrides = overrides.filter((o) => o.override_date === localDate);

  // is_closed wins over everything else for that date.
  if (dayOverrides.some((o) => o.is_closed)) return null;

  const customHours = dayOverrides.filter(
    (o) => !o.is_closed && o.start_minute !== null && o.end_minute !== null,
  );

  if (customHours.length > 0) {
    // Override-replace: use the override windows; ignore weekly rules entirely
    // (CONTEXT: "override always wins, even on closed weekdays").
    return customHours.map((o) => ({
      start_minute: o.start_minute as number,
      end_minute: o.end_minute as number,
    }));
  }

  // No override → fall back to weekly rules for this day-of-week.
  // No rules for this dow → closed weekday → no slots.
  const dayRules = rules.filter((r) => r.day_of_week === dayOfWeek);
  if (dayRules.length === 0) return null;

  return dayRules.map((r) => ({
    start_minute: r.start_minute,
    end_minute: r.end_minute,
  }));
}

/**
 * Count confirmed bookings on a given local date in the account TZ.
 *
 * IMPORTANT: caller must filter bookings to status != 'cancelled' before passing
 * them in. The slot engine does NOT see status — it just counts the array.
 * (Phase 3 lock: cancelled bookings free up slots.)
 */
function countBookingsOnLocalDate(
  bookings: SlotInput["bookings"],
  localDate: string,
  timeZone: string,
): number {
  return bookings.filter((b) => {
    const local = new TZDate(b.start_at, timeZone);
    return localDateString(local) === localDate;
  }).length;
}

/**
 * Buffer-overlap check: would this slot collide with any existing booking once
 * buffer_minutes is added on each side?
 *
 * Two intervals [a1, a2) and [b1, b2) overlap iff a1 < b2 AND b1 < a2.
 * We extend the SLOT by buffer minutes on both sides; existing bookings stay as
 * stored (their buffer was applied when they were originally booked).
 */
function slotConflictsWithBookings(
  slotStartUtc: Date,
  slotEndUtc: Date,
  bufferMinutes: number,
  bookings: SlotInput["bookings"],
): boolean {
  const bufferedStart = addMinutes(slotStartUtc, -bufferMinutes);
  const bufferedEnd = addMinutes(slotEndUtc, bufferMinutes);
  for (const b of bookings) {
    const bStart = new Date(b.start_at);
    const bEnd = new Date(b.end_at);
    if (isBefore(bufferedStart, bEnd) && isBefore(bStart, bufferedEnd)) {
      return true;
    }
  }
  return false;
}

/**
 * Pure slot-generation entry point. Plan 04-06's route handler is the only
 * production caller; tests call it directly with hand-crafted inputs.
 */
export function computeSlots(input: SlotInput): Slot[] {
  const { account, durationMinutes, rules, overrides, bookings, now } = input;
  const TZ = account.timezone;
  const earliest = addMinutes(now, account.min_notice_hours * 60);
  const latest = addDays(now, account.max_advance_days);

  const results: Slot[] = [];

  // Iterate local calendar dates in account TZ.
  const [sy, sm, sd] = input.rangeStart.split("-").map(Number);
  const [ey, em, ed] = input.rangeEnd.split("-").map(Number);
  const startDate = new TZDate(sy, sm - 1, sd, 0, 0, 0, TZ);
  const endDate = new TZDate(ey, em - 1, ed, 0, 0, 0, TZ);

  let cursor = startDate;
  while (!isAfter(cursor, endDate)) {
    const localDate = localDateString(cursor);
    // getDay on a TZDate returns the day-of-week IN the bound timezone (0=Sun).
    const dow = cursor.getDay();

    const windows = windowsForDate(localDate, dow, rules, overrides);

    if (windows !== null) {
      // Daily-cap check (CONTEXT: count confirmed only; bookings array already
      // excludes cancelled per the route handler contract).
      const cap = account.daily_cap;
      const exceedsCap =
        cap !== null && countBookingsOnLocalDate(bookings, localDate, TZ) >= cap;

      if (!exceedsCap) {
        for (const w of windows) {
          for (const slot of generateWindowSlots(
            localDate,
            w.start_minute,
            w.end_minute,
            durationMinutes,
            TZ,
          )) {
            const slotStartUtc = new Date(slot.start_at);
            const slotEndUtc = new Date(slot.end_at);

            // Min-notice filter.
            if (isBefore(slotStartUtc, earliest)) continue;
            // Max-advance filter (slot starts on or before "now + max_advance_days").
            if (isAfter(slotStartUtc, latest)) continue;
            // Buffer overlap.
            if (
              slotConflictsWithBookings(
                slotStartUtc,
                slotEndUtc,
                account.buffer_minutes,
                bookings,
              )
            ) continue;

            results.push(slot);
          }
        }
      }
    }

    // Advance cursor by one local calendar day. Use new TZDate with day+1
    // explicitly (not addDays) — RESEARCH Open Q1 flagged addDays(TZDate)
    // behavior across DST as MEDIUM-confidence; explicit construction is
    // bullet-proof.
    const nextY = cursor.getFullYear();
    const nextM = cursor.getMonth();
    const nextD = cursor.getDate() + 1;
    cursor = new TZDate(nextY, nextM, nextD, 0, 0, 0, TZ);
  }

  // Sort ascending by start_at (defensive — multiple windows on the same day
  // may have generated slots in window-order rather than time-order).
  results.sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0));

  return results;
}
```

Key rules:
- Pure function. NO Supabase, NO Next.js, NO `process.env` reads, NO file I/O.
- The "now" parameter is REQUIRED in `SlotInput` — DO NOT call `new Date()` inside `computeSlots`. Tests need to pin "now" to deterministic values.
- Use ONLY `TZDate` to construct dates in the account timezone. Never `new Date(year, month, day)` — that uses the Vercel server's TZ (UTC), not the account's (RESEARCH Pitfall 2).
- Use ONLY `addMinutes`/`addDays` from date-fns (NOT raw `+ minutes * 60_000`). RESEARCH Pitfall 1.
- Do NOT import or call `formatInTimeZone` — it does not exist in `@date-fns/tz` v4. Use `format(tzDate, "yyyy-MM-dd")` if you need to format (RESEARCH §1).
- The cursor advance uses explicit `new TZDate(y, m, d+1, 0, 0, 0, TZ)` rather than `addDays(cursor, 1)` per the conservative recommendation in RESEARCH Open Q1.
- Sort the result array ascending by `start_at`. Multiple windows per day generate in window-order, which may not be time-order if Andrew defined "12-1, 9-11" as two windows for the same day. Phase 5's UI expects sorted slots.
- Daily-cap counting is by the slot's local-date in the ACCOUNT TZ (not UTC date). Two midnight-CST bookings on Nov 1 2026 (one CDT, one CST — different UTC values) both count toward Nov 1's cap.

DO NOT:
- Do not embed any Supabase calls or fetch logic — that lives in Plan 04-06.
- Do not return a `cap_reached` flag — CONTEXT.md explicitly defers it. Cap-reached days return zero slots, indistinguishable from blocked days.
- Do not export helper functions (`generateWindowSlots`, `windowsForDate`, etc.) — keep the public surface to `computeSlots` only. Tests against the public surface are more refactor-safe.
- Do not add a `step_minutes` parameter — CONTEXT-locked: step = duration.
- Do not consult `event_types.buffer_before_minutes` etc.; AVAIL-07 says account-wide settings win in v1, and the route handler (Plan 04-06) only passes account settings into `SlotInput.account`.
  </action>
  <verify>
```bash
# Files exist
ls lib/slots.types.ts lib/slots.ts

# Type contracts exported
grep -q "export interface SlotInput" lib/slots.types.ts && echo "SlotInput ok"
grep -q "export interface Slot" lib/slots.types.ts && echo "Slot ok"
grep -q "export interface AccountSettings" lib/slots.types.ts && echo "AccountSettings ok"

# Pure function exported
grep -q "export function computeSlots" lib/slots.ts && echo "computeSlots ok"

# DST-safe library imports
grep -q 'from "@date-fns/tz"' lib/slots.ts && echo "TZDate import ok"
grep -q 'from "date-fns"' lib/slots.ts && echo "date-fns import ok"

# Anti-patterns absent
! grep -q 'formatInTimeZone' lib/slots.ts && echo "no formatInTimeZone (good)"
! grep -q "60_000\|60000" lib/slots.ts && echo "no fixed-ms arithmetic (good)"
! grep -q "@/lib/supabase" lib/slots.ts && echo "no Supabase import (good)"
! grep -q "next/" lib/slots.ts && echo "no next.js import (good)"

npm run build
```
  </verify>
  <done>
`lib/slots.types.ts` exports `SlotInput`, `Slot`, `AccountSettings`, `AvailabilityRuleRow`, `DateOverrideRow`, `BookingRow`. `lib/slots.ts` exports a pure `computeSlots(input: SlotInput): Slot[]` that uses `TZDate` + `addMinutes` + `addDays` + `getDay`. No Supabase, no Next.js, no `formatInTimeZone`. `npm run build` exits 0.

Commit: `feat(04-02): add slot generation engine (pure, DST-safe)`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Ship DST + algorithmic unit tests for computeSlots</name>
  <files>tests/slot-generation.test.ts</files>
  <action>
Create `tests/slot-generation.test.ts` covering AVAIL-09 (DST hard gate) plus the algorithmic rules from CONTEXT.md. RESEARCH §5 provides the canonical test scenarios with expected slot counts AND expected `start_at[i]` UTC ISO strings.

```typescript
// @vitest-environment node
import { describe, it, expect } from "vitest";

import { computeSlots } from "@/lib/slots";
import type {
  SlotInput,
  AccountSettings,
  AvailabilityRuleRow,
  DateOverrideRow,
  BookingRow,
} from "@/lib/slots.types";

/**
 * Phase 4 AVAIL-09 hard-gate tests.
 *
 * The slot engine must produce correct results across both 2026 US DST
 * transitions in America/Chicago:
 *   - 2026-03-08 (spring forward): 2:00 AM → 3:00 AM, UTC-6 → UTC-5
 *   - 2026-11-01 (fall back):      2:00 AM → 1:00 AM, UTC-5 → UTC-6
 *
 * Plus: normal-day baseline, buffer-overlap exclusion, daily-cap, min-notice,
 * max-advance, and override semantics.
 */

const TZ = "America/Chicago";

/** Default account settings: no buffer, no notice, no daily cap, big window. */
const baseAccount: AccountSettings = {
  timezone: TZ,
  buffer_minutes: 0,
  min_notice_hours: 0,
  max_advance_days: 365,
  daily_cap: null,
};

/** Standard 9:00–17:00 weekly rule for the day-of-week in question. */
function rule(day_of_week: number, startMinute = 540, endMinute = 1020): AvailabilityRuleRow {
  return { day_of_week, start_minute: startMinute, end_minute: endMinute };
}

function input(partial: Partial<SlotInput>): SlotInput {
  return {
    rangeStart: "2026-06-15",
    rangeEnd: "2026-06-15",
    durationMinutes: 30,
    account: baseAccount,
    rules: [],
    overrides: [],
    bookings: [],
    // Pin "now" far in the past so min-notice/max-advance never reject anything
    // unless the test explicitly overrides these fields.
    now: new Date("2025-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("computeSlots — normal day baseline", () => {
  it("generates 16 slots for 9:00-17:00 with 30-min duration on a non-DST day", () => {
    // 2026-06-15 is a Monday in mid-summer; CDT (UTC-5)
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      rules: [rule(1)],  // Monday
    }));
    expect(result).toHaveLength(16);
    // First slot: 9:00 CDT = UTC-5 → 14:00 UTC
    expect(result[0].start_at).toBe("2026-06-15T14:00:00.000Z");
    expect(result[0].end_at).toBe("2026-06-15T14:30:00.000Z");
    // Last slot starts at 16:30 CDT = 21:30 UTC
    expect(result[15].start_at).toBe("2026-06-15T21:30:00.000Z");
    expect(result[15].end_at).toBe("2026-06-15T22:00:00.000Z");
  });
});

describe("computeSlots — AVAIL-09 spring forward (March 8, 2026)", () => {
  // 2026-03-08 is a Sunday. CST → CDT at 2:00 AM (offset -6 → -5).

  it("scenario A: window entirely after the gap produces normal slot count", () => {
    // 9:00–11:00 AM CDT (well after 2 AM transition). 4 slots.
    const result = computeSlots(input({
      rangeStart: "2026-03-08",
      rangeEnd: "2026-03-08",
      durationMinutes: 30,
      rules: [rule(0, 540, 660)],  // Sunday, 9:00–11:00
    }));
    expect(result).toHaveLength(4);
    // 9:00 CDT = UTC-5 → 14:00 UTC
    expect(result[0].start_at).toBe("2026-03-08T14:00:00.000Z");
    expect(result[1].start_at).toBe("2026-03-08T14:30:00.000Z");
    expect(result[2].start_at).toBe("2026-03-08T15:00:00.000Z");
    expect(result[3].start_at).toBe("2026-03-08T15:30:00.000Z");
  });

  it("scenario B: window spanning the missing hour produces 4 slots (not 6)", () => {
    // 1:00–4:00 AM (spans the 2:00→3:00 gap). Normal day = 6 slots.
    // DST day: no 2:00, no 2:30 → 4 slots: 1:00, 1:30, 3:00, 3:30 (all local).
    const result = computeSlots(input({
      rangeStart: "2026-03-08",
      rangeEnd: "2026-03-08",
      durationMinutes: 30,
      rules: [rule(0, 60, 240)],  // Sunday, 1:00–4:00
    }));
    expect(result).toHaveLength(4);
    // 1:00 CST = UTC-6 → 07:00 UTC
    expect(result[0].start_at).toBe("2026-03-08T07:00:00.000Z");
    // 1:30 CST → 07:30 UTC
    expect(result[1].start_at).toBe("2026-03-08T07:30:00.000Z");
    // 3:00 CDT (after spring forward) = UTC-5 → 08:00 UTC (the "missing"
    // 2:00 wall-clock is skipped — addMinutes jumps the gap).
    expect(result[2].start_at).toBe("2026-03-08T08:00:00.000Z");
    expect(result[3].start_at).toBe("2026-03-08T08:30:00.000Z");
  });

  it("scenario C: window only inside the missing hour produces zero slots", () => {
    // 2:00–3:00 AM doesn't exist on spring-forward day.
    const result = computeSlots(input({
      rangeStart: "2026-03-08",
      rangeEnd: "2026-03-08",
      durationMinutes: 30,
      rules: [rule(0, 120, 180)],  // 2:00–3:00 — gap
    }));
    expect(result).toHaveLength(0);
  });
});

describe("computeSlots — AVAIL-09 fall back (November 1, 2026)", () => {
  // 2026-11-01 is a Sunday. CDT → CST at 2:00 AM (offset -5 → -6).
  // The 1:00–2:00 AM hour exists TWICE (different UTC instants).

  it("scenario A: window spanning the repeated hour produces 4 slots (not 3)", () => {
    // 1:00–4:00 AM at 60-min duration. Normal day = 3 slots.
    // Fall-back day = 4 slots: 1:00 CDT, 1:00 CST, 2:00 CST, 3:00 CST.
    const result = computeSlots(input({
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-01",
      durationMinutes: 60,
      rules: [rule(0, 60, 240)],  // Sunday, 1:00–4:00
    }));
    expect(result).toHaveLength(4);
    // 1:00 CDT = UTC-5 → 06:00 UTC
    expect(result[0].start_at).toBe("2026-11-01T06:00:00.000Z");
    // 1:00 CST (after fall back) = UTC-6 → 07:00 UTC
    expect(result[1].start_at).toBe("2026-11-01T07:00:00.000Z");
    // 2:00 CST → 08:00 UTC
    expect(result[2].start_at).toBe("2026-11-01T08:00:00.000Z");
    // 3:00 CST → 09:00 UTC
    expect(result[3].start_at).toBe("2026-11-01T09:00:00.000Z");
  });

  it("scenario B: 9:00-17:00 produces 16 slots (post-transition CST baseline)", () => {
    // After 2 AM, account is in CST (UTC-6). 9:00 CST → 15:00 UTC.
    const result = computeSlots(input({
      rangeStart: "2026-11-01",
      rangeEnd: "2026-11-01",
      durationMinutes: 30,
      rules: [rule(0)],  // Sunday, 9:00–17:00
    }));
    expect(result).toHaveLength(16);
    // 9:00 CST = UTC-6 → 15:00 UTC
    expect(result[0].start_at).toBe("2026-11-01T15:00:00.000Z");
  });
});

describe("computeSlots — buffer overlap excludes conflicting slots", () => {
  it("removes slots that overlap an existing booking (with buffer)", () => {
    // 9:00-17:00 Monday, 30-min slots. Existing booking 10:00-10:30 CDT.
    // buffer = 15 min → blocked range 9:45–10:45 CDT.
    // Slots 9:30 (9:30-10:00) and 10:00 (10:00-10:30) overlap → removed.
    // 16 normal slots − 2 = 14 slots.
    const existingBooking: BookingRow = {
      start_at: "2026-06-15T15:00:00.000Z",  // 10:00 CDT
      end_at: "2026-06-15T15:30:00.000Z",    // 10:30 CDT
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      account: { ...baseAccount, buffer_minutes: 15 },
      rules: [rule(1)],
      bookings: [existingBooking],
    }));
    expect(result).toHaveLength(14);
    // Confirm 9:30 and 10:00 are NOT in the result.
    const starts = result.map((s) => s.start_at);
    expect(starts).not.toContain("2026-06-15T14:30:00.000Z");  // 9:30 CDT
    expect(starts).not.toContain("2026-06-15T15:00:00.000Z");  // 10:00 CDT
    // Confirm 9:00 (boundary safe) and 11:00 (post-buffer) ARE in the result.
    expect(starts).toContain("2026-06-15T14:00:00.000Z");      // 9:00 CDT
    expect(starts).toContain("2026-06-15T16:00:00.000Z");      // 11:00 CDT
  });
});

describe("computeSlots — daily cap excludes cancelled bookings (CONTEXT lock)", () => {
  it("returns zero slots when daily_cap=2 and 2 confirmed bookings exist", () => {
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      account: { ...baseAccount, daily_cap: 2 },
      rules: [rule(1)],
      // Caller (route handler) already filtered .neq("status", "cancelled")
      // before passing bookings in — so these are all confirmed.
      bookings: [
        { start_at: "2026-06-15T15:00:00.000Z", end_at: "2026-06-15T15:30:00.000Z" },
        { start_at: "2026-06-15T16:00:00.000Z", end_at: "2026-06-15T16:30:00.000Z" },
      ],
    }));
    expect(result).toHaveLength(0);
  });

  it("returns slots when bookings count is below the cap", () => {
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      account: { ...baseAccount, daily_cap: 5 },
      rules: [rule(1)],
      bookings: [
        // Two confirmed bookings → buffer-overlap removes 2 slots; cap of 5
        // is not yet reached.
        { start_at: "2026-06-15T15:00:00.000Z", end_at: "2026-06-15T15:30:00.000Z" },
        { start_at: "2026-06-15T16:00:00.000Z", end_at: "2026-06-15T16:30:00.000Z" },
      ],
    }));
    // 16 − 2 (buffer overlap with two bookings) = 14
    expect(result).toHaveLength(14);
  });
});

describe("computeSlots — min-notice + max-advance filters", () => {
  it("excludes slots starting before now + min_notice_hours", () => {
    // "now" is 8:00 AM CDT on 2026-06-15 (= 13:00 UTC). min_notice = 1h
    // → earliest = 14:00 UTC (= 9:00 AM CDT). The 9:00 slot starts AT
    // the boundary; isBefore(slotStart, earliest) is FALSE so 9:00 is kept.
    // The 9:30 slot is well after — kept. Force min_notice = 90 minutes
    // so the 9:00 slot (which is exactly at 60-min notice) IS excluded.
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      account: { ...baseAccount, min_notice_hours: 2 },
      rules: [rule(1)],
      now: new Date("2026-06-15T13:00:00.000Z"),
    }));
    // earliest = 13:00 + 2h = 15:00 UTC = 10:00 CDT.
    // Slots from 9:00 CDT (14:00 UTC) and 9:30 CDT (14:30 UTC) are excluded.
    // 10:00 CDT (15:00 UTC) onward kept. 16 − 2 = 14.
    expect(result).toHaveLength(14);
    expect(result[0].start_at).toBe("2026-06-15T15:00:00.000Z");
  });

  it("excludes dates beyond now + max_advance_days", () => {
    // "now" = 2026-06-15 12:00 UTC. max_advance = 1 day. Asking for a 5-day
    // range; only days 2026-06-15 and 2026-06-16 should produce slots.
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-19",
      durationMinutes: 30,
      account: { ...baseAccount, max_advance_days: 1 },
      // Mon-Fri all open 9-5
      rules: [rule(1), rule(2), rule(3), rule(4), rule(5)],
      now: new Date("2026-06-15T12:00:00.000Z"),
    }));
    // 6/15 = 16 slots (Mon), 6/16 = ? slots (Tue) but most before
    // the latest cap of now+1d = 2026-06-16 12:00 UTC (= 7:00 CDT).
    // 9:00 CDT on 6/16 = 14:00 UTC > 12:00 UTC latest → excluded.
    // So 6/16 yields 0 slots. Total = 16.
    expect(result).toHaveLength(16);
    // All slots are on 2026-06-15.
    const dates = new Set(result.map((s) => s.start_at.slice(0, 10)));
    expect(Array.from(dates)).toEqual(["2026-06-15"]);
  });
});

describe("computeSlots — date overrides (CONTEXT-locked semantics)", () => {
  it("override is_closed=true blocks the day entirely (overrides weekly rules)", () => {
    const override: DateOverrideRow = {
      override_date: "2026-06-15",
      is_closed: true,
      start_minute: null,
      end_minute: null,
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      rules: [rule(1)],  // Monday 9-5 normally → 16 slots
      overrides: [override],
    }));
    expect(result).toHaveLength(0);
  });

  it("override custom hours OPENS a normally-closed weekday (override always wins)", () => {
    // Sunday is closed (no rules for day_of_week=0); override opens 10-12.
    const override: DateOverrideRow = {
      override_date: "2026-06-21",  // Sunday
      is_closed: false,
      start_minute: 600,  // 10:00
      end_minute: 720,    // 12:00
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-21",
      rangeEnd: "2026-06-21",
      durationMinutes: 30,
      rules: [],  // No weekly rules for any day → normally always closed
      overrides: [override],
    }));
    expect(result).toHaveLength(4);
    // 10:00 CDT = 15:00 UTC
    expect(result[0].start_at).toBe("2026-06-21T15:00:00.000Z");
  });

  it("override custom hours REPLACES weekly rules for that date", () => {
    // Monday rule says 9-5 (16 slots). Override says 13-15 (4 slots).
    const override: DateOverrideRow = {
      override_date: "2026-06-15",
      is_closed: false,
      start_minute: 780,  // 13:00
      end_minute: 900,    // 15:00
    };
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      rules: [rule(1)],
      overrides: [override],
    }));
    expect(result).toHaveLength(4);
    // 13:00 CDT = 18:00 UTC
    expect(result[0].start_at).toBe("2026-06-15T18:00:00.000Z");
  });

  it("mixed is_closed + custom-hours rows on same date → is_closed wins", () => {
    // Defensive: should never happen if the action enforces mutual exclusion,
    // but the engine must be robust (CONTEXT pitfall #5 in RESEARCH).
    const overrides: DateOverrideRow[] = [
      { override_date: "2026-06-15", is_closed: true, start_minute: null, end_minute: null },
      { override_date: "2026-06-15", is_closed: false, start_minute: 600, end_minute: 720 },
    ];
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      rules: [rule(1)],
      overrides,
    }));
    expect(result).toHaveLength(0);
  });
});
```

Key rules:
- File starts with `// @vitest-environment node` (RESEARCH §4 — DB-free unit tests run in node, not jsdom).
- ALL DST tests assert BOTH `result.length` AND specific `result[i].start_at` UTC ISO strings — checking only counts is insufficient (a buggy algorithm could produce the right count with wrong instants).
- The "now" parameter pins to a deterministic past-date in tests where min_notice_hours/max_advance_days don't matter; tests that exercise those filters override "now" explicitly.
- The buffer-overlap test confirms that a slot AT the buffered boundary is kept (9:00 CDT = boundary; we want 9:00 included).
- The fall-back scenario A asserts BOTH 1:00 CDT (UTC 06:00) AND 1:00 CST (UTC 07:00) are present — this is the "two slots for the repeated hour" correctness test.
- The override mixed-rows test is a defensive case for RESEARCH Pitfall 5 (UI normally enforces mutual exclusion, but the engine must do the safe thing if Andrew creates one through SQL or future bulk-import).

DO NOT:
- Do not import Supabase or any DB client. Pure unit tests.
- Do not use `vi.mock(...)` or `jest.fn(...)`. The engine has no dependencies to mock.
- Do not split into multiple test files. One file, multiple `describe` blocks — easier to read end-to-end DST behavior.
- Do not skip the negative tests (zero-slot cases like the missing-hour-only window). Empty arrays are correct outputs and proving them is part of AVAIL-09.
  </action>
  <verify>
```bash
ls tests/slot-generation.test.ts

# Run JUST this test file (other tests may need DB; this one doesn't)
npm test -- tests/slot-generation.test.ts

# Confirm AVAIL-09 cases are present
grep -q "2026-03-08" tests/slot-generation.test.ts && echo "spring forward case present"
grep -q "2026-11-01" tests/slot-generation.test.ts && echo "fall back case present"
grep -q "America/Chicago" tests/slot-generation.test.ts && echo "tz pinned"

# Full suite still green
npm test
```
  </verify>
  <done>
`tests/slot-generation.test.ts` exists with `// @vitest-environment node` header, imports `computeSlots` and the types, covers: normal-day baseline (16 slots), spring-forward March 8 2026 in 3 scenarios (post-gap, spanning gap, in-gap), fall-back Nov 1 2026 in 2 scenarios (spanning repeated hour, post-transition), buffer overlap (14 slots after exclusion), daily cap (zero on cap-reached, slots when below cap), min-notice + max-advance filters, and override semantics (block, open-closed-weekday, replace-rules, mixed is_closed-wins).

`npm test -- tests/slot-generation.test.ts` exits 0 with all assertions passing. Full `npm test` still green.

Commit: `test(04-02): add DST and algorithmic unit tests for slot engine`. Push.
  </done>
</task>

</tasks>

<verification>
```bash
# All three Phase 4-02 files present
ls lib/slots.types.ts lib/slots.ts tests/slot-generation.test.ts

# Build + lint clean
npm run build
npm run lint

# Slot-engine tests pass
npm test -- tests/slot-generation.test.ts

# Full Vitest suite still green
npm test
```

The slot-engine tests are the source of truth that the algorithm is correct. AVAIL-09 (the project's biggest bug-hotspot per ROADMAP) is gated here.
</verification>

<success_criteria>
- [ ] `lib/slots.types.ts` exports `SlotInput`, `Slot`, `AccountSettings`, `AvailabilityRuleRow`, `DateOverrideRow`, `BookingRow`
- [ ] `lib/slots.ts` exports a pure `computeSlots(input: SlotInput): Slot[]` — no Supabase, no Next.js, no `formatInTimeZone`, no fixed-millisecond arithmetic
- [ ] Engine uses `TZDate` for all date construction and `addMinutes`/`addDays`/`getDay` from `date-fns` for arithmetic
- [ ] Step size = `durationMinutes` (CONTEXT-locked); slot.end fits within window via `isAfter` check
- [ ] Override-always-wins semantics implemented: is_closed → null (skip day); custom-hours-rows → use those windows; otherwise weekly rules
- [ ] Daily cap counts confirmed bookings only (excludes cancelled — caller is responsible for filtering)
- [ ] Min-notice and max-advance filters applied in UTC against pinned `now`
- [ ] Buffer-overlap exclusion uses extended slot bounds (`addMinutes(slot.start, -buffer)` / `addMinutes(slot.end, +buffer)`)
- [ ] Result array sorted ascending by `start_at`
- [ ] `tests/slot-generation.test.ts` covers AVAIL-09 spring forward (3 scenarios) and fall back (2 scenarios) with both count AND specific UTC ISO assertions
- [ ] Tests cover normal day baseline, buffer-overlap, daily cap (cap-reached + below-cap), min-notice, max-advance, override-block, override-open-closed-day, override-replace-rules, mixed-is-closed-wins
- [ ] `npm test -- tests/slot-generation.test.ts` exits 0
- [ ] Full `npm test` still green (no regression)
- [ ] `npm run build` + `npm run lint` exit 0
- [ ] Each task committed atomically (2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/04-availability-engine/04-02-SUMMARY.md` documenting:
- Final shape of `SlotInput` and `Slot` (the boundary contract Plan 04-03 + 04-06 will consume)
- Confirmed @date-fns/tz `TZDate.getDay()` returns TZ-aware day-of-week (RESEARCH Open Q2 — verified by spring-forward Sunday tests passing with day_of_week=0)
- Confirmed addDays vs explicit-construct decision (used explicit `new TZDate(y, m, d+1, 0, 0, 0, TZ)` for cursor advance per RESEARCH Open Q1 conservative recommendation)
- Number of slot-generation tests passing (expected ≥15)
- Any deviation from RESEARCH §2 algorithm or §5 test scenarios
</output>
