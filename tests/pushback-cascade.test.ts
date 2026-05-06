/**
 * Phase 33 Plan 02 — Cascade preview unit tests.
 *
 * Covers 7 scenarios from PLAN.md must_haves.truths:
 *   (a) anchor-only one-booking move
 *   (b) two-booking cascade with no gap
 *   (c) gap absorbed — later booking in place
 *   (d) absorb-then-move — cascade cools, then revives on overlap
 *   (e) past-EOD flag
 *   (f) no-rules day (endOfDayMinutes=1440) never flags PAST_EOD
 *   (g) snap-up rounding for non-aligned candidate starts
 *
 * All times use UTC for simplicity. Timezone-sensitive scenarios (e, f) use
 * America/Chicago. UTC-5 (CDT offset during May 2026).
 */

import { describe, it, expect } from "vitest";
import {
  computeCascadePreview,
  snapToNextSlotMs,
  countMoved,
  type PushbackBookingInput,
} from "@/lib/bookings/pushback";

const TZ = "America/Chicago";

// ─── Test fixture builder ─────────────────────────────────────────────────────

function mkBooking(
  overrides: Partial<PushbackBookingInput> & {
    start_at: string;
    end_at: string;
    id: string;
  },
): PushbackBookingInput {
  return {
    booker_first_name: "Test",
    duration_minutes: 30,
    buffer_after_minutes: 0,
    event_type_id: "et-1",
    ...overrides,
  };
}

// ─── snapToNextSlotMs ─────────────────────────────────────────────────────────

describe("snapToNextSlotMs", () => {
  it("snaps up when not on a boundary", () => {
    // 09:05 UTC → snap to 09:30 (next 30-min boundary)
    const ms = Date.UTC(2026, 4, 7, 9, 5, 0);
    expect(snapToNextSlotMs(ms, 30)).toBe(Date.UTC(2026, 4, 7, 9, 30, 0));
  });

  it("returns the input when already on a boundary", () => {
    const ms = Date.UTC(2026, 4, 7, 9, 30, 0);
    expect(snapToNextSlotMs(ms, 30)).toBe(ms);
  });

  it("snaps up to 60-min boundary for 60-min slot step", () => {
    // 09:01 UTC, step=60 → snap to 10:00
    const ms = Date.UTC(2026, 4, 7, 9, 1, 0);
    expect(snapToNextSlotMs(ms, 60)).toBe(Date.UTC(2026, 4, 7, 10, 0, 0));
  });
});

// ─── computeCascadePreview ────────────────────────────────────────────────────

describe("computeCascadePreview", () => {
  // ── (a) single anchor move ───────────────────────────────────────────────────
  it("(a) single anchor: moves by delay and snaps up to slot boundary", () => {
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1],
      anchorId: "b1",
      delayMs: 15 * 60_000, // 15 min
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("MOVE");
    // 14:00 + 15min = 14:15 → snap UP to 14:30 (30-min boundary)
    expect(out[0].old_start_at).toBe("2026-05-07T14:00:00.000Z");
    expect(out[0].new_start_at).toBe("2026-05-07T14:30:00.000Z");
    expect(out[0].new_end_at).toBe("2026-05-07T15:00:00.000Z");
    expect(countMoved(out)).toBe(1);
  });

  // ── (b) two-booking back-to-back cascade with no gap ─────────────────────────
  it("(b) two-booking cascade with no gap: both MOVE", () => {
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });
    const b2 = mkBooking({
      id: "b2",
      start_at: "2026-05-07T14:30:00.000Z",
      end_at: "2026-05-07T15:00:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1, b2],
      anchorId: "b1",
      delayMs: 15 * 60_000, // 15 min
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(2);
    expect(out[0].status).toBe("MOVE");
    // anchor: 14:00 + 15min = 14:15 → snap to 14:30
    expect(out[0].new_start_at).toBe("2026-05-07T14:30:00.000Z");
    expect(out[0].new_end_at).toBe("2026-05-07T15:00:00.000Z");

    expect(out[1].status).toBe("MOVE");
    // priorNewEnd = 15:00 + buffer(0) = 15:00 → candidateStart = 15:00
    // origStart = 14:30 → candidateStart(15:00) > origStart(14:30) → MOVE
    // snap 15:00 to 30-min grid → 15:00 (already aligned)
    expect(out[1].new_start_at).toBe("2026-05-07T15:00:00.000Z");
    expect(out[1].new_end_at).toBe("2026-05-07T15:30:00.000Z");
    expect(countMoved(out)).toBe(2);
  });

  // ── (c) gap absorbed ─────────────────────────────────────────────────────────
  it("(c) gap absorbs small push: anchor MOVE, later booking ABSORBED", () => {
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });
    // 60-min gap before b2 at 15:30
    const b2 = mkBooking({
      id: "b2",
      start_at: "2026-05-07T15:30:00.000Z",
      end_at: "2026-05-07T16:00:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1, b2],
      anchorId: "b1",
      delayMs: 15 * 60_000, // 15 min
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(2);
    expect(out[0].status).toBe("MOVE");
    // anchor: 14:00 + 15min → snap to 14:30
    expect(out[0].new_start_at).toBe("2026-05-07T14:30:00.000Z");

    expect(out[1].status).toBe("ABSORBED");
    // candidateStart = 15:00 (priorNewEnd 15:00 + 0 buffer)
    // origStart = 15:30 → candidateStart(15:00) <= origStart(15:30) → ABSORBED
    expect(out[1].new_start_at).toBeNull();
    expect(out[1].new_end_at).toBeNull();
    expect(countMoved(out)).toBe(1);
  });

  // ── (d) absorb-then-move: cascade cools then revives ─────────────────────────
  it("(d) cascade cools at large gap but third booking gets hit: MOVE→ABSORBED→MOVE", () => {
    // b1 anchor at 14:00-14:30, delay 60 min
    //   → snapped to 15:00-15:30
    // b2 at 14:35-15:05: candidateStart = 15:30 (priorNewEnd 15:30 + 0 buffer)
    //   origStart = 14:35 UTC → candidateStart(15:30) > origStart(14:35) → MOVE
    //   snap 15:30 to 30-min grid → 15:30-16:00
    // b3 at 16:30-17:00: candidateStart = 16:00 (priorNewEnd 16:00 + 0 buffer)
    //   origStart = 16:30 → 16:00 <= 16:30 → ABSORBED, priorNewEnd resets to 17:00
    // b4 at 16:45-17:15: candidateStart = 17:00 (priorNewEnd after reset = 17:00)
    //   origStart = 16:45 → 17:00 > 16:45 → MOVE, snap to 17:00-17:30
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });
    const b2 = mkBooking({
      id: "b2",
      start_at: "2026-05-07T14:35:00.000Z",
      end_at: "2026-05-07T15:05:00.000Z",
    });
    const b3 = mkBooking({
      id: "b3",
      start_at: "2026-05-07T16:30:00.000Z",
      end_at: "2026-05-07T17:00:00.000Z",
    });
    const b4 = mkBooking({
      id: "b4",
      start_at: "2026-05-07T16:45:00.000Z",
      end_at: "2026-05-07T17:15:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1, b2, b3, b4],
      anchorId: "b1",
      delayMs: 60 * 60_000, // 60 min
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(4);
    expect(out[0].status).toBe("MOVE");
    // anchor: 14:00 + 60min = 15:00 → already aligned → 15:00-15:30
    expect(out[0].new_start_at).toBe("2026-05-07T15:00:00.000Z");

    expect(out[1].status).toBe("MOVE");
    // candidateStart = 15:30 + 0 = 15:30 → snap to 15:30 → 15:30-16:00
    expect(out[1].new_start_at).toBe("2026-05-07T15:30:00.000Z");
    expect(out[1].new_end_at).toBe("2026-05-07T16:00:00.000Z");

    expect(out[2].status).toBe("ABSORBED");
    // candidateStart = 16:00 + 0 = 16:00 ≤ origStart 16:30 → ABSORBED
    expect(out[2].new_start_at).toBeNull();

    expect(out[3].status).toBe("MOVE");
    // priorNewEnd reset to 17:00 by b3's absorption; candidateStart = 17:00 + 0 = 17:00
    // origStart = 16:45 → 17:00 > 16:45 → MOVE; snap 17:00 to 30-min grid → 17:00
    expect(out[3].new_start_at).toBe("2026-05-07T17:00:00.000Z");
    expect(countMoved(out)).toBe(3);
  });

  // ── (e) past-EOD flag ────────────────────────────────────────────────────────
  it("(e) new start past end-of-workday → PAST_EOD badge", () => {
    // b1 at 16:30 UTC = 11:30 CDT (America/Chicago, UTC-5 in May).
    // delay 60 min → 17:30 UTC = 12:30 CDT
    // endOfDayMinutes = 12*60 = 720 (noon CDT)
    // 12:30 CDT (750 min) >= 720 → PAST_EOD
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T16:30:00.000Z",
      end_at: "2026-05-07T17:00:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1],
      anchorId: "b1",
      delayMs: 60 * 60_000,
      endOfDayMinutes: 12 * 60, // noon CDT
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("PAST_EOD");
    // still has new times (commit not blocked; PUSH-07)
    expect(out[0].new_start_at).not.toBeNull();
    expect(countMoved(out)).toBe(1);
  });

  // ── (f) no-rules day never flags PAST_EOD ────────────────────────────────────
  it("(f) endOfDayMinutes=1440 never flags PAST_EOD even at 23:59 local", () => {
    // b1 at 23:30 UTC = 18:30 CDT; delay 60 min pushes to 00:30 UTC next day
    // Even past midnight local → never PAST_EOD with 1440 sentinel
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T23:30:00.000Z",
      end_at: "2026-05-08T00:00:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1],
      anchorId: "b1",
      delayMs: 30 * 60_000,
      endOfDayMinutes: 24 * 60, // 1440 sentinel
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("MOVE"); // never PAST_EOD on no-rules day
    expect(countMoved(out)).toBe(1);
  });

  // ── (g) snap-up rounding for non-aligned candidate starts ─────────────────────
  it("(g) 60-min booking with 5-min delay snaps to next 60-min boundary", () => {
    // Anchor has duration_minutes=60. Starts at 14:00 UTC.
    // delay 5 min → raw candidate = 14:05 UTC → snap to next 60-min boundary = 15:00 UTC
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T15:00:00.000Z",
      duration_minutes: 60,
    });

    const out = computeCascadePreview({
      bookings: [b1],
      anchorId: "b1",
      delayMs: 5 * 60_000,
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("MOVE");
    expect(out[0].new_start_at).toBe("2026-05-07T15:00:00.000Z");
    expect(out[0].new_end_at).toBe("2026-05-07T16:00:00.000Z");
  });

  // ── Pre-anchor bookings are ABSORBED with null new times ────────────────────
  it("bookings before the anchor are ABSORBED with null new times", () => {
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T13:00:00.000Z",
      end_at: "2026-05-07T13:30:00.000Z",
    });
    const b2 = mkBooking({
      id: "b2",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1, b2],
      anchorId: "b2", // b1 is before anchor
      delayMs: 30 * 60_000,
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out).toHaveLength(2);
    expect(out[0].status).toBe("ABSORBED");
    expect(out[0].new_start_at).toBeNull();
    expect(out[0].new_end_at).toBeNull();
    expect(out[1].status).toBe("MOVE");
  });

  // ── Buffer-after-minutes is respected in cascade frontier ──────────────────
  it("buffer_after_minutes is added to prior new end when computing candidateStart", () => {
    // b1 anchor: 14:00-14:30, delay 30min → 14:30 + snap → 15:00-15:30
    // b2: buffer_after_minutes=15 on b1 means: candidateStart = 15:30 + 15min = 15:45
    //   b2 origStart = 14:30 → 15:45 > 14:30 → MOVE; snap 15:45 to 30-min grid → 16:00
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
      buffer_after_minutes: 15,
    });
    const b2 = mkBooking({
      id: "b2",
      start_at: "2026-05-07T14:30:00.000Z",
      end_at: "2026-05-07T15:00:00.000Z",
    });

    const out = computeCascadePreview({
      bookings: [b1, b2],
      anchorId: "b1",
      delayMs: 30 * 60_000,
      endOfDayMinutes: 1440,
      accountTimezone: TZ,
    });

    expect(out[0].status).toBe("MOVE");
    // anchor: 14:00+30min=14:30 → snap to 30-min boundary → 14:30 (already aligned)
    expect(out[0].new_start_at).toBe("2026-05-07T14:30:00.000Z");
    expect(out[0].new_end_at).toBe("2026-05-07T15:00:00.000Z");

    expect(out[1].status).toBe("MOVE");
    // candidateStart = priorNewEnd(15:00) + buffer(15min) = 15:15
    // snap 15:15 to 30-min grid → 15:30
    expect(out[1].new_start_at).toBe("2026-05-07T15:30:00.000Z");
  });

  // ── Error if anchorId not found ─────────────────────────────────────────────
  it("throws if anchorId is not in bookings list", () => {
    const b1 = mkBooking({
      id: "b1",
      start_at: "2026-05-07T14:00:00.000Z",
      end_at: "2026-05-07T14:30:00.000Z",
    });

    expect(() =>
      computeCascadePreview({
        bookings: [b1],
        anchorId: "NONEXISTENT",
        delayMs: 15 * 60_000,
        endOfDayMinutes: 1440,
        accountTimezone: TZ,
      }),
    ).toThrow("not found");
  });
});

// ─── countMoved ───────────────────────────────────────────────────────────────

describe("countMoved", () => {
  it("counts MOVE + PAST_EOD, excludes ABSORBED", () => {
    const b = mkBooking({ id: "x", start_at: "2026-05-07T14:00:00.000Z", end_at: "2026-05-07T14:30:00.000Z" });
    const rows = [
      { booking: b, status: "MOVE" as const, old_start_at: b.start_at, new_start_at: "t", new_end_at: "t" },
      { booking: b, status: "ABSORBED" as const, old_start_at: b.start_at, new_start_at: null, new_end_at: null },
      { booking: b, status: "PAST_EOD" as const, old_start_at: b.start_at, new_start_at: "t", new_end_at: "t" },
    ];
    expect(countMoved(rows)).toBe(2);
  });
});
