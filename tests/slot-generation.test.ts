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

/** Default account settings: no buffer, no notice, no daily cap, big window.
 * max_advance_days=9999 ensures dates in 2026 are never filtered out when
 * now is pinned to 2025-01-01 (2026 test dates are ~365-530 days ahead). */
const baseAccount: AccountSettings = {
  timezone: TZ,
  buffer_minutes: 0,
  min_notice_hours: 0,
  max_advance_days: 9999,
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
    // 1:00 AM – 4:00 AM (spans the 2:00 AM → 3:00 AM gap). Normal day = 6 slots.
    // DST day: no 2:00, no 2:30 → 4 slots: 1:00, 1:30, 3:00, 3:30 (all local).
    //
    // Midnight CST = 06:00Z.
    // addMinutes(midnight, 60)  = 07:00Z = 1:00 CST
    // addMinutes(midnight, 90)  = 07:30Z = 1:30 CST
    // addMinutes(midnight, 120) = 08:00Z = 3:00 CDT (2:00 AM skipped by DST)
    // addMinutes(midnight, 150) = 08:30Z = 3:30 CDT
    // windowEnd = addMinutes(midnight, 240) = 09:00Z = 4:00 CDT
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
    // 3:00 CDT (after spring forward) = UTC-5 → 08:00 UTC
    // The "missing" 2:00 wall-clock is skipped — addMinutes jumps the gap.
    // NOTE: RESEARCH.md §5 Scenario B was previously written as "T09:00:00.000Z"
    // (a typo — that value would imply CST/UTC-6, but post-spring-forward is CDT/
    // UTC-5). Corrected to T08:00Z; this assertion is the source of truth.
    expect(result[2].start_at).toBe("2026-03-08T08:00:00.000Z");
    expect(result[3].start_at).toBe("2026-03-08T08:30:00.000Z");
  });

  it("scenario C: window only inside the missing hour produces zero slots", () => {
    // 2:00–3:00 AM doesn't exist on spring-forward day.
    // addMinutes(midnight, 120) = 08:00Z = 3:00 CDT (the wall-clock 2 AM was skipped).
    // So windowStart = 3:00 CDT and slotEnd = 3:30 CDT > windowEnd = 3:00 CDT → 0 slots.
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
    //
    // Midnight CDT = 05:00Z.
    // addMinutes(midnight, 60)  = 06:00Z = 1:00 CDT
    // addMinutes(06:00Z, 60)    = 07:00Z = 1:00 CST (fall-back happened)
    // addMinutes(07:00Z, 60)    = 08:00Z = 2:00 CST
    // windowEnd = addMinutes(midnight, 240) = 09:00Z = 4:00 CST
    // addMinutes(08:00Z, 60) = 09:00Z → isAfter(09:00Z, 09:00Z) = false → slot fits
    // Next: addMinutes(09:00Z, 60) = 10:00Z → isAfter(10:00Z, 09:00Z) = true → break
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
    // buffer = 15 min → each slot is EXTENDED by 15 min on both sides for
    // the overlap check (not the booking).
    //
    // Slot 9:30 CDT (14:30Z–15:00Z): buffered = 14:15Z–15:15Z
    //   Overlaps booking [15:00Z, 15:30Z]? isBefore(14:15Z, 15:30Z)=T AND isBefore(15:00Z, 15:15Z)=T → YES, removed
    // Slot 10:00 CDT (15:00Z–15:30Z): buffered = 14:45Z–15:45Z
    //   Overlaps booking [15:00Z, 15:30Z]? YES, removed
    // Slot 10:30 CDT (15:30Z–16:00Z): buffered = 15:15Z–16:15Z
    //   Overlaps booking [15:00Z, 15:30Z]? isBefore(15:15Z, 15:30Z)=T AND isBefore(15:00Z, 16:15Z)=T → YES, removed
    // Slot 9:00 CDT (14:00Z–14:30Z): buffered = 13:45Z–14:45Z
    //   Overlaps booking? isBefore(13:45Z, 15:30Z)=T AND isBefore(15:00Z, 14:45Z)=F → NO, kept ✓
    // Slot 11:00 CDT (16:00Z–16:30Z): buffered = 15:45Z–16:45Z
    //   Overlaps booking? isBefore(15:45Z, 15:30Z)=F → NO, kept ✓
    // 16 normal slots − 3 = 13 slots.
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
    expect(result).toHaveLength(13);
    // Confirm 9:30, 10:00, and 10:30 are NOT in the result.
    const starts = result.map((s) => s.start_at);
    expect(starts).not.toContain("2026-06-15T14:30:00.000Z");  // 9:30 CDT
    expect(starts).not.toContain("2026-06-15T15:00:00.000Z");  // 10:00 CDT
    expect(starts).not.toContain("2026-06-15T15:30:00.000Z");  // 10:30 CDT
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
    // 16 − 2 (buffer overlap with two bookings, buffer=0 so only exact-overlap)
    // With buffer=0: bufferedStart = slotStart, bufferedEnd = slotEnd.
    // Booking 1 at 10:00–10:30 CDT (15:00–15:30Z): only slot 10:00 is removed.
    // Booking 2 at 11:00–11:30 CDT (16:00–16:30Z): only slot 11:00 is removed.
    // 16 − 2 = 14
    expect(result).toHaveLength(14);
  });
});

describe("computeSlots — min-notice + max-advance filters", () => {
  it("excludes slots starting before now + min_notice_hours", () => {
    // "now" = 13:00 UTC on 2026-06-15. min_notice = 2h → earliest = 15:00 UTC = 10:00 CDT.
    // Slots before 15:00 UTC (9:00 CDT = 14:00Z and 9:30 CDT = 14:30Z) are excluded.
    // 10:00 CDT (15:00 UTC) onward kept. 16 − 2 = 14.
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-15",
      durationMinutes: 30,
      account: { ...baseAccount, min_notice_hours: 2 },
      rules: [rule(1)],
      now: new Date("2026-06-15T13:00:00.000Z"),
    }));
    expect(result).toHaveLength(14);
    expect(result[0].start_at).toBe("2026-06-15T15:00:00.000Z");
  });

  it("excludes dates beyond now + max_advance_days", () => {
    // "now" = 2026-06-15 12:00 UTC. max_advance = 1 day → latest = 2026-06-16 12:00 UTC.
    // Asking for a 5-day range; 6/16 slots at 9:00+ CDT = 14:00+ UTC > 12:00 UTC latest.
    // So 6/16 yields 0 slots. Total = 16 (just 6/15).
    const result = computeSlots(input({
      rangeStart: "2026-06-15",
      rangeEnd: "2026-06-19",
      durationMinutes: 30,
      account: { ...baseAccount, max_advance_days: 1 },
      // Mon-Fri all open 9-5
      rules: [rule(1), rule(2), rule(3), rule(4), rule(5)],
      now: new Date("2026-06-15T12:00:00.000Z"),
    }));
    // 6/15 = 16 slots (Mon), 6/16+ all beyond latest → 0 slots. Total = 16.
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
