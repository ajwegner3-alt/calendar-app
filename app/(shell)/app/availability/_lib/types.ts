/**
 * Shared types for the availability feature (Phase 4).
 *
 * - AccountSettingsRow / AvailabilityRuleRow / DateOverrideRow: DB row shapes
 * - DayOfWeek: 0 (Sun) – 6 (Sat) literal union, matches Postgres convention
 * - TimeWindow: a single {start_minute, end_minute} window inside a day
 * - DateOverrideInput: client-facing discriminated union for the override form
 *   (one of "block" or "custom_hours"); the server action splits the union
 *   into the right DB row shape
 * - AvailabilityState: the loader's return value (used by Plan 04-04 + 04-05
 *   page-level Server Components)
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeWindow {
  /** Minutes since local midnight, 0-1439 inclusive */
  start_minute: number;
  /** Minutes since local midnight, 1-1440 inclusive; must be > start_minute */
  end_minute: number;
}

export interface AccountSettingsRow {
  buffer_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  daily_cap: number | null;
  timezone: string;
}

export interface AvailabilityRuleRow {
  id: string;
  account_id: string;
  day_of_week: DayOfWeek;
  start_minute: number;
  end_minute: number;
  created_at: string;
}

export interface DateOverrideRow {
  id: string;
  account_id: string;
  override_date: string; // YYYY-MM-DD
  is_closed: boolean;
  start_minute: number | null;
  end_minute: number | null;
  note: string | null;
  created_at: string;
}

/**
 * Form-side discriminated union for upsertDateOverrideAction.
 *
 * "block" = single is_closed=true row for the date.
 * "custom_hours" = one or more rows with start_minute/end_minute, no is_closed=true.
 */
export type DateOverrideInput =
  | {
      type: "block";
      override_date: string; // YYYY-MM-DD
      note?: string;
    }
  | {
      type: "custom_hours";
      override_date: string;
      windows: TimeWindow[];
      note?: string;
    };

export interface AvailabilityState {
  account: AccountSettingsRow;
  /** All weekly rules for the owner's account; UI groups by day_of_week */
  rules: AvailabilityRuleRow[];
  /** All date overrides for the account (no time-range filter — Plan 04-05's
   *  calendar shows ~3 months at a time and can scroll forward; loading all
   *  is fine for v1 single-tenant scale) */
  overrides: DateOverrideRow[];
}
