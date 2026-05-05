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

/**
 * Single per-date override row from date_overrides.
 *
 * Phase 32 semantic flip: rows with `is_closed=true` block the entire day
 * (no slots). Rows with `is_closed=false` define an UNAVAILABLE window that
 * is subtracted from the weekly-hours base for that day (MINUS semantics).
 * Pre-Phase-32 these rows meant "custom available hours" (replaced weekly
 * rules entirely). The legacy interpretation was wiped from production by
 * migration 20260505120000_phase32_wipe_legacy_custom_hours.sql; new writes
 * from the Phase 32 UI always carry the unavailable-window meaning.
 */
export interface DateOverrideRow {
  /** YYYY-MM-DD local calendar date (Postgres date type → ISO string in JS) */
  override_date: string;
  /** true = block this whole day; false = start_minute/end_minute is an unavailable window */
  is_closed: boolean;
  /** Null when is_closed=true; otherwise the unavailable window start (Phase 32 MINUS semantics) */
  start_minute: number | null;
  /** Null when is_closed=true; otherwise the unavailable window end (Phase 32 MINUS semantics) */
  end_minute: number | null;
}

/** Existing confirmed booking row used for buffer-overlap and daily-cap checks. */
export interface BookingRow {
  /** UTC ISO string (timestamptz from Supabase) */
  start_at: string;
  /** UTC ISO string */
  end_at: string;
  /**
   * Phase 28 LD-04: per-event-type post-event buffer for THIS booking's event type.
   * Populated from `event_types.buffer_after_minutes` via a join in the route handler.
   * Used asymmetrically: an existing booking's post-buffer pushes the candidate
   * slot's allowed start backward (the existing booking needs space after it).
   */
  buffer_after_minutes: number;
}

/** Input for computeSlots. The route handler (Plan 04-06) populates this. */
export interface SlotInput {
  /** Local YYYY-MM-DD start of range (inclusive), interpreted in account TZ */
  rangeStart: string;
  /** Local YYYY-MM-DD end of range (inclusive), interpreted in account TZ */
  rangeEnd: string;
  /** Event type duration in minutes (becomes the slot step size) */
  durationMinutes: number;
  /**
   * Phase 28 LD-04: candidate event type's post-event buffer in minutes.
   * Populated from `event_types.buffer_after_minutes` for the event type whose
   * slots are being computed. Used asymmetrically: extends the candidate slot's
   * allowed end forward (the candidate slot needs space after itself).
   */
  slotBufferAfterMinutes: number;
  account: AccountSettings;
  rules: AvailabilityRuleRow[];
  overrides: DateOverrideRow[];
  /**
   * Confirmed bookings in/near the range. As of Plan 11-05 (Pitfall 4 fix),
   * the route handler filters to status='confirmed' only (NOT .neq('cancelled')).
   * Rescheduled bookings are excluded so they no longer over-block freed slots.
   */
  bookings: BookingRow[];
  /** Current UTC instant. Inject as parameter so unit tests can pin "now". */
  now: Date;
  /**
   * CAP-04 (Plan 11-05): maximum number of confirmed bookings allowed per slot.
   * Slots are excluded once confirmed_count >= maxBookingsPerSlot.
   * Default: 1 (v1.0 single-capacity behavior preserved).
   */
  maxBookingsPerSlot: number;
  /**
   * CAP-08 backend (Plan 11-05): when true, each output slot includes a
   * remaining_capacity field (maxBookingsPerSlot - confirmedCount).
   * When false (default), the field is omitted from slot objects.
   */
  showRemainingCapacity?: boolean;
}

/** Single output slot. Both endpoints in UTC ISO. */
export interface Slot {
  start_at: string;
  end_at: string;
  /**
   * CAP-08 (Plan 11-05): only present when showRemainingCapacity=true.
   * Value = maxBookingsPerSlot - confirmedCount (always >= 1; 0-capacity
   * slots are excluded before this field is set).
   */
  remaining_capacity?: number;
}
