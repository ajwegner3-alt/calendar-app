// @vitest-environment node
import { describe, it, expect } from "vitest";

import { computeSlots, subtractWindows } from "@/lib/slots";
import type {
  SlotInput,
  AccountSettings,
  AvailabilityRuleRow,
  DateOverrideRow,
} from "@/lib/slots.types";

/**
 * Phase 32 Plan 32-01 — Inverse date-override semantics.
 *
 * Two layers of coverage:
 *   1. subtractWindows() pure-function unit tests (interval-subtraction algebra)
 *   2. computeSlots() / windowsForDate() integration tests for the new MINUS
 *      branch, including edge cases where the unavailable window fully covers
 *      the weekly base (day becomes closed) and where the weekly base is empty.
 *
 * Style mirrors tests/slot-generation.test.ts (vitest, describe/it/expect, the
 * same baseAccount + rule() + input() helpers and pinned `now`).
 */

const TZ = "America/Chicago";

const baseAccount: AccountSettings = {
  timezone: TZ,
  min_notice_hours: 0,
  max_advance_days: 9999,
  daily_cap: null,
};

function rule(
  day_of_week: number,
  startMinute = 540,
  endMinute = 1020,
): AvailabilityRuleRow {
  return { day_of_week, start_minute: startMinute, end_minute: endMinute };
}

function input(partial: Partial<SlotInput>): SlotInput {
  return {
    rangeStart: "2026-06-15",
    rangeEnd: "2026-06-15",
    durationMinutes: 30,
    slotBufferAfterMinutes: 0,
    account: baseAccount,
    rules: [],
    overrides: [],
    bookings: [],
    now: new Date("2025-01-01T00:00:00Z"),
    maxBookingsPerSlot: 1,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// subtractWindows() — pure-function coverage
// ---------------------------------------------------------------------------

describe("subtractWindows", () => {
  it("returns base unchanged when no blocked windows", () => {
    expect(
      subtractWindows([{ start_minute: 540, end_minute: 1020 }], []),
    ).toEqual([{ start_minute: 540, end_minute: 1020 }]);
  });

  it("returns empty when blocked fully covers base", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 480, end_minute: 1080 }],
      ),
    ).toEqual([]);
  });

  it("splits base into two fragments when blocked is in the middle", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }], // 9:00–17:00
        [{ start_minute: 720, end_minute: 780 }], // 12:00–13:00 lunch
      ),
    ).toEqual([
      { start_minute: 540, end_minute: 720 },
      { start_minute: 780, end_minute: 1020 },
    ]);
  });

  it("trims left edge when blocked overlaps base start", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 480, end_minute: 660 }],
      ),
    ).toEqual([{ start_minute: 660, end_minute: 1020 }]);
  });

  it("trims right edge when blocked overlaps base end", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 960, end_minute: 1080 }],
      ),
    ).toEqual([{ start_minute: 540, end_minute: 960 }]);
  });

  it("ignores blocked windows that don't overlap any base window (no-op)", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 1100, end_minute: 1200 }], // outside weekly hours
      ),
    ).toEqual([{ start_minute: 540, end_minute: 1020 }]);
  });

  it("subtracts multiple non-overlapping blocked windows", () => {
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }], // 9:00–17:00
        [
          { start_minute: 600, end_minute: 660 }, // 10:00–11:00
          { start_minute: 840, end_minute: 900 }, // 14:00–15:00
        ],
      ),
    ).toEqual([
      { start_minute: 540, end_minute: 600 },
      { start_minute: 660, end_minute: 840 },
      { start_minute: 900, end_minute: 1020 },
    ]);
  });

  it("handles multiple base windows correctly", () => {
    expect(
      subtractWindows(
        [
          { start_minute: 540, end_minute: 720 }, // morning
          { start_minute: 780, end_minute: 1020 }, // afternoon
        ],
        [{ start_minute: 600, end_minute: 660 }],
      ),
    ).toEqual([
      { start_minute: 540, end_minute: 600 },
      { start_minute: 660, end_minute: 720 },
      { start_minute: 780, end_minute: 1020 },
    ]);
  });

  it("returns empty when base itself is empty", () => {
    expect(
      subtractWindows([], [{ start_minute: 540, end_minute: 600 }]),
    ).toEqual([]);
  });

  it("does not mutate the input arrays", () => {
    const base = [{ start_minute: 540, end_minute: 1020 }];
    const blocked = [{ start_minute: 720, end_minute: 780 }];
    const baseSnapshot = JSON.stringify(base);
    const blockedSnapshot = JSON.stringify(blocked);
    subtractWindows(base, blocked);
    expect(JSON.stringify(base)).toBe(baseSnapshot);
    expect(JSON.stringify(blocked)).toBe(blockedSnapshot);
  });

  it("keeps base when blocked window touches but doesn't overlap (boundary equality)", () => {
    // Blocked end == base start → no overlap (intervals are [start, end))
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 480, end_minute: 540 }], // ends at 9:00 exactly
      ),
    ).toEqual([{ start_minute: 540, end_minute: 1020 }]);
    // Blocked start == base end → no overlap
    expect(
      subtractWindows(
        [{ start_minute: 540, end_minute: 1020 }],
        [{ start_minute: 1020, end_minute: 1080 }], // starts at 17:00 exactly
      ),
    ).toEqual([{ start_minute: 540, end_minute: 1020 }]);
  });
});

// ---------------------------------------------------------------------------
// windowsForDate() integration via computeSlots — Phase 32 MINUS semantics
// ---------------------------------------------------------------------------

describe("computeSlots — Phase 32 windowsForDate MINUS branch", () => {
  it("no override rows on a date → returns weekly-base unchanged (16 slots, 9–17 in 30-min steps)", () => {
    const result = computeSlots(
      input({
        rangeStart: "2026-06-15",
        rangeEnd: "2026-06-15",
        durationMinutes: 30,
        rules: [rule(1)], // Monday 9–17
        overrides: [],
      }),
    );
    expect(result).toHaveLength(16);
  });

  it("is_closed=true row → returns null (full-day block, unchanged)", () => {
    const override: DateOverrideRow = {
      override_date: "2026-06-15",
      is_closed: true,
      start_minute: null,
      end_minute: null,
    };
    const result = computeSlots(
      input({
        rangeStart: "2026-06-15",
        rangeEnd: "2026-06-15",
        durationMinutes: 30,
        rules: [rule(1)],
        overrides: [override],
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("is_closed=false row with non-null window → weekly base MINUS unavailable window", () => {
    // Monday weekly 9–17 (16 slots). Subtract 12:00–13:00 (2 slots blocked) → 14 slots.
    const override: DateOverrideRow = {
      override_date: "2026-06-15",
      is_closed: false,
      start_minute: 720, // 12:00
      end_minute: 780, // 13:00
    };
    const result = computeSlots(
      input({
        rangeStart: "2026-06-15",
        rangeEnd: "2026-06-15",
        durationMinutes: 30,
        rules: [rule(1)],
        overrides: [override],
      }),
    );
    expect(result).toHaveLength(14);
    // 12:00 CDT = 17:00 UTC and 12:30 CDT = 17:30 UTC must be absent.
    expect(
      result.find((s) => s.start_at === "2026-06-15T17:00:00.000Z"),
    ).toBeUndefined();
    expect(
      result.find((s) => s.start_at === "2026-06-15T17:30:00.000Z"),
    ).toBeUndefined();
    // 11:30 CDT (16:30 UTC) and 13:00 CDT (18:00 UTC) must remain.
    expect(
      result.find((s) => s.start_at === "2026-06-15T16:30:00.000Z"),
    ).toBeDefined();
    expect(
      result.find((s) => s.start_at === "2026-06-15T18:00:00.000Z"),
    ).toBeDefined();
  });

  it("unavailable window fully covers weekly base → returns null (day closed)", () => {
    // Weekly 9–17, override 8–18 → MINUS yields [] → null → 0 slots.
    const override: DateOverrideRow = {
      override_date: "2026-06-15",
      is_closed: false,
      start_minute: 480, // 8:00
      end_minute: 1080, // 18:00
    };
    const result = computeSlots(
      input({
        rangeStart: "2026-06-15",
        rangeEnd: "2026-06-15",
        durationMinutes: 30,
        rules: [rule(1)],
        overrides: [override],
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("weekly base empty for the day-of-week → returns null even if unavailable rows exist (no-op subtraction on closed weekday)", () => {
    // 2026-06-21 is Sunday; no weekly rules anywhere → day is normally closed.
    // An unavailable window on a closed weekday cannot open the day under MINUS
    // semantics — there's nothing to subtract from.
    const override: DateOverrideRow = {
      override_date: "2026-06-21",
      is_closed: false,
      start_minute: 600,
      end_minute: 720,
    };
    const result = computeSlots(
      input({
        rangeStart: "2026-06-21",
        rangeEnd: "2026-06-21",
        durationMinutes: 30,
        rules: [], // no weekly rules at all
        overrides: [override],
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("multiple unavailable windows on a single date → all subtracted from weekly base", () => {
    // Weekly 9–17 (16 slots). Block 10–11 (2 slots) + 14–15 (2 slots) → 12 slots.
    const overrides: DateOverrideRow[] = [
      {
        override_date: "2026-06-15",
        is_closed: false,
        start_minute: 600, // 10:00
        end_minute: 660, // 11:00
      },
      {
        override_date: "2026-06-15",
        is_closed: false,
        start_minute: 840, // 14:00
        end_minute: 900, // 15:00
      },
    ];
    const result = computeSlots(
      input({
        rangeStart: "2026-06-15",
        rangeEnd: "2026-06-15",
        durationMinutes: 30,
        rules: [rule(1)],
        overrides,
      }),
    );
    expect(result).toHaveLength(12);
    // Slots inside both blocked windows must be absent.
    // 10:00 CDT = 15:00 UTC; 14:00 CDT = 19:00 UTC.
    expect(
      result.find((s) => s.start_at === "2026-06-15T15:00:00.000Z"),
    ).toBeUndefined();
    expect(
      result.find((s) => s.start_at === "2026-06-15T19:00:00.000Z"),
    ).toBeUndefined();
  });
});
