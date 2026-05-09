/**
 * Phase 33 Plan 02 — Pure cascade preview module.
 *
 * Zero Supabase, zero browser APIs, zero I/O. Takes arrays + scalars and
 * returns arrays. Deterministic + trivially testable.
 *
 * Cascade algorithm (CONTEXT.md lock):
 *   - Bookings strictly before the anchor are ABSORBED with new_start_at=null.
 *   - The anchor moves by exactly delayMs, then snapped UP to the anchor's own
 *     duration_minutes grid.
 *   - For each subsequent booking i:
 *       candidateStart = priorNewEnd + bookings[i-1].buffer_after_minutes * 60_000
 *       if candidateStart <= bookings[i].original_start → ABSORBED
 *         (priorNewEnd resets to this booking's original end; cascade cools off)
 *       else → snap candidateStart UP to bookings[i].duration_minutes grid
 *              classify MOVE or PAST_EOD
 *
 * PAST_EOD: local-time minutes-since-midnight of the new start >= endOfDayMinutes.
 *           1440 sentinel (no-rules days per CONTEXT.md OQ-5) disables check.
 *
 * Slot step: each booking uses its OWN duration_minutes as the grid step
 * (CONTEXT.md OQ-2 lock — not a shared account-wide step).
 *
 * Quota math: movedCount = MOVE + PAST_EOD count (= emails to send on commit
 * because skipOwnerEmail=true means 1 email per moved booking, not × 2).
 */

import { TZDate } from "@date-fns/tz";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CascadeStatus = "MOVE" | "ABSORBED" | "PAST_EOD";

export interface PushbackBookingInput {
  id: string;
  start_at: string; // UTC ISO
  end_at: string; // UTC ISO
  booker_name: string; // full name from bookings.booker_name
  duration_minutes: number; // event_type.duration_minutes — used as slot step
  buffer_after_minutes: number; // event_type.buffer_after_minutes
  event_type_id: string;
}

export interface CascadeRow {
  booking: PushbackBookingInput;
  status: CascadeStatus;
  old_start_at: string;
  new_start_at: string | null; // null when ABSORBED (no new time)
  new_end_at: string | null; // null when ABSORBED
}

export interface ComputeCascadeArgs {
  /** ALL confirmed bookings for the date, sorted by start_at ASC */
  bookings: PushbackBookingInput[];
  /** ID of the first booking that must move */
  anchorId: string;
  /** Delay in milliseconds */
  delayMs: number;
  /**
   * End-of-day minute (0..1440).
   * 1440 = "no constraint" sentinel (CONTEXT.md OQ-5):
   *   no-rules days never flag PAST_EOD so ad-hoc bookings on otherwise-closed
   *   days don't produce alarming amber badges.
   */
  endOfDayMinutes: number;
  /** IANA tz, e.g. "America/Chicago" */
  accountTimezone: string;
}

// ─── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Snap `rawMs` UP to the next multiple of `slotStepMinutes` grid boundary.
 *
 * If rawMs is already on a boundary, returns rawMs unchanged (Math.ceil is
 * correct here: an exactly-aligned value divides evenly, so ceil == floor).
 *
 * Example: raw = 14:05 UTC, step = 30min → snaps to 14:30 UTC.
 * Example: raw = 14:30 UTC, step = 30min → returns 14:30 UTC (no change).
 */
export function snapToNextSlotMs(rawMs: number, slotStepMinutes: number): number {
  const stepMs = slotStepMinutes * 60_000;
  return Math.ceil(rawMs / stepMs) * stepMs;
}

/**
 * Returns true if the new start time (in UTC ms) falls at or after
 * endOfDayMinutes in the local timezone.
 *
 * Uses TZDate to extract wall-clock hours/minutes in the given IANA zone —
 * DST-safe by construction (same pattern as lib/slots.ts).
 *
 * 1440 sentinel: immediately returns false — no PAST_EOD flags on no-rules days.
 *
 * Phase 40 Plan 05 (2026-05-09): export keyword removed — internal-only use
 * at line 183 by computeCascadePreview. Function stays as a file-private helper.
 */
function isPastEod(
  startMs: number,
  accountTimezone: string,
  endOfDayMinutes: number,
): boolean {
  if (endOfDayMinutes >= 24 * 60) return false; // 1440 sentinel: no constraint
  const local = new TZDate(new Date(startMs), accountTimezone);
  const localMinutes = local.getHours() * 60 + local.getMinutes();
  return localMinutes >= endOfDayMinutes;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Pure cascade preview.
 *
 * Returns one CascadeRow per input booking, in the same order as `bookings`.
 * Throws if anchorId is not found in the bookings array.
 */
export function computeCascadePreview(args: ComputeCascadeArgs): CascadeRow[] {
  const { bookings, anchorId, delayMs, endOfDayMinutes, accountTimezone } = args;

  const anchorIdx = bookings.findIndex((b) => b.id === anchorId);
  if (anchorIdx < 0) {
    throw new Error(`Anchor booking "${anchorId}" not found in bookings list`);
  }

  const result: CascadeRow[] = [];

  // ── Before-anchor: untouched (ABSORBED with null new times) ──────────────────
  for (let i = 0; i < anchorIdx; i++) {
    const b = bookings[i];
    result.push({
      booking: b,
      status: "ABSORBED",
      old_start_at: b.start_at,
      new_start_at: null,
      new_end_at: null,
    });
  }

  // ── At/after-anchor: cascade ──────────────────────────────────────────────────
  // priorNewEndMs: tracks the running frontier of the last moved booking's new end.
  let priorNewEndMs = 0;

  for (let i = anchorIdx; i < bookings.length; i++) {
    const b = bookings[i];
    const origStartMs = new Date(b.start_at).getTime();
    const origEndMs = new Date(b.end_at).getTime();
    // Preserve original duration (does NOT use duration_minutes * 60_000 in case
    // start/end don't exactly match — use the actual recorded window).
    const durationMs = origEndMs - origStartMs;

    // ── Compute candidate start ───────────────────────────────────────────────
    let candidateStartMs: number;
    if (i === anchorIdx) {
      // Anchor: raw candidate = original start + delay
      candidateStartMs = origStartMs + delayMs;
    } else {
      // Subsequent: candidate = prior booking's new end + prior booking's buffer
      const priorBufferMs = bookings[i - 1].buffer_after_minutes * 60_000;
      candidateStartMs = priorNewEndMs + priorBufferMs;
    }

    // ── Gap absorption check (only for post-anchor bookings) ─────────────────
    if (i > anchorIdx && candidateStartMs <= origStartMs) {
      // The gap is wide enough to absorb the cascade push.
      // Reset the frontier to this booking's ORIGINAL end so subsequent
      // bookings don't get pushed further (cascade cools off).
      priorNewEndMs = origEndMs;
      result.push({
        booking: b,
        status: "ABSORBED",
        old_start_at: b.start_at,
        new_start_at: null,
        new_end_at: null,
      });
      continue;
    }

    // ── MOVE or PAST_EOD ──────────────────────────────────────────────────────
    // Snap candidate UP to this booking's own duration_minutes grid (OQ-2).
    const snappedStartMs = snapToNextSlotMs(candidateStartMs, b.duration_minutes);
    const newEndMs = snappedStartMs + durationMs;

    // Update frontier for the next booking in the loop.
    priorNewEndMs = newEndMs;

    const status: CascadeStatus = isPastEod(snappedStartMs, accountTimezone, endOfDayMinutes)
      ? "PAST_EOD"
      : "MOVE";

    result.push({
      booking: b,
      status,
      old_start_at: b.start_at,
      new_start_at: new Date(snappedStartMs).toISOString(),
      new_end_at: new Date(newEndMs).toISOString(),
    });
  }

  return result;
}

// ─── Count helpers ─────────────────────────────────────────────────────────────

/**
 * Count rows that require a reschedule email on commit.
 * = MOVE + PAST_EOD (ABSORBED rows keep their original time; no email needed).
 *
 * With skipOwnerEmail=true on commit, each moved booking sends exactly 1 email
 * (to the booker), so movedCount === emailsNeeded. Do NOT multiply by 2.
 */
export function countMoved(rows: CascadeRow[]): number {
  return rows.filter((r) => r.status === "MOVE" || r.status === "PAST_EOD").length;
}
