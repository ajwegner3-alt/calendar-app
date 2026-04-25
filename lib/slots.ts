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
import { addMinutes, addDays, isBefore, isAfter } from "date-fns";

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
    // cursor.getDay() on a TZDate returns the day-of-week IN the bound timezone
    // (0=Sun). This is wall-clock-correct even across DST transitions (RESEARCH
    // Open Q2 — verified by spring-forward Sunday tests passing with day_of_week=0).
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

    // Advance cursor by one local calendar day. Use explicit new TZDate with
    // day+1 rather than addDays(cursor, 1) — RESEARCH Open Q1 flagged addDays
    // behavior across DST as MEDIUM-confidence; explicit construction is
    // bullet-proof (correct midnight-to-midnight in the account TZ).
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
