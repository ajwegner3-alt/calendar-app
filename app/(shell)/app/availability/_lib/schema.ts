import { z } from "zod";

import type { DayOfWeek, TimeWindow } from "./types";

/**
 * Single time-window inside a day. Minutes since local midnight.
 *
 * 0 <= start < end <= 1440 — matches the DB CHECK constraint on
 * availability_rules (`end_minute > start_minute`) plus the smallint
 * range bound. Custom error messages are user-facing.
 */
export const timeWindowSchema = z
  .object({
    start_minute: z.coerce
      .number()
      .int("Start time must be a whole minute.")
      .min(0, "Start time cannot be before 12:00 AM.")
      .max(1439, "Start time cannot be after 11:59 PM."),
    end_minute: z.coerce
      .number()
      .int("End time must be a whole minute.")
      .min(1, "End time must be after start time.")
      .max(1440, "End time cannot be after 12:00 AM (next day)."),
  })
  .refine((w) => w.end_minute > w.start_minute, {
    message: "End time must be after start time.",
    path: ["end_minute"],
  });

/**
 * Detect overlapping windows in a sorted-by-start array.
 *
 * Returns null if no overlap; otherwise the indices of the first overlapping
 * pair (used to build a human-readable error). Touching boundaries
 * (a.end == b.start) are NOT overlaps — adjacent windows are valid.
 */
export function findOverlap(sorted: TimeWindow[]): { i: number; j: number } | null {
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].end_minute > sorted[i + 1].start_minute) {
      return { i, j: i + 1 };
    }
  }
  return null;
}

function minutesToHHMM(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Schema for "save all windows for one weekday" (saveWeeklyRulesAction).
 *
 * - day_of_week: 0–6 (Sun–Sat)
 * - windows: array of {start_minute, end_minute}, possibly empty
 *   (empty = "Closed" toggle for that weekday → action will DELETE all rules
 *   for the day_of_week)
 *
 * Refines for overlap (RESEARCH §6: validate on save, not on blur).
 */
export const weeklyRulesSchema = z
  .object({
    day_of_week: z.coerce
      .number()
      .int()
      .min(0, "day_of_week must be 0-6.")
      .max(6, "day_of_week must be 0-6.") as z.ZodType<DayOfWeek>,
    windows: z.array(timeWindowSchema).max(20, "Too many time windows for one day."),
  })
  .superRefine((data, ctx) => {
    const sorted = [...data.windows].sort(
      (a, b) => a.start_minute - b.start_minute,
    );
    const overlap = findOverlap(sorted);
    if (overlap) {
      const a = sorted[overlap.i];
      const b = sorted[overlap.j];
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windows"],
        message: `Time windows overlap: ${minutesToHHMM(a.start_minute)}–${minutesToHHMM(a.end_minute)} and ${minutesToHHMM(b.start_minute)}–${minutesToHHMM(b.end_minute)}.`,
      });
    }
  });

/**
 * Schema for upsertDateOverrideAction. Matches DateOverrideInput shape from
 * types.ts. Discriminator is "type" — "block" or "unavailable".
 *
 * Phase 32: variant renamed from "custom_hours" → "unavailable" to reflect
 * inverse semantics (windows now describe BLOCKED times, not AVAILABLE
 * times). DB row shape is unchanged: is_closed=false rows with
 * start_minute/end_minute.
 */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const dateOverrideSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("block"),
    override_date: z
      .string()
      .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
    note: z.string().max(200, "Note must be 200 characters or fewer.").optional(),
  }),
  z
    .object({
      type: z.literal("unavailable"),
      override_date: z
        .string()
        .regex(dateRegex, "Date must be in YYYY-MM-DD format."),
      windows: z
        .array(timeWindowSchema)
        .min(1, "Add at least one unavailable window or choose Block instead.")
        .max(20, "Too many unavailable windows for one day."),
      note: z.string().max(200, "Note must be 200 characters or fewer.").optional(),
    })
    .superRefine((data, ctx) => {
      const sorted = [...data.windows].sort(
        (a, b) => a.start_minute - b.start_minute,
      );
      const overlap = findOverlap(sorted);
      if (overlap) {
        const a = sorted[overlap.i];
        const b = sorted[overlap.j];
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windows"],
          message: `Time windows overlap: ${minutesToHHMM(a.start_minute)}–${minutesToHHMM(a.end_minute)} and ${minutesToHHMM(b.start_minute)}–${minutesToHHMM(b.end_minute)}.`,
        });
      }
    }),
]);

/**
 * Schema for saveAccountSettingsAction. Bounds match the migration CHECK
 * constraints (Plan 04-01).
 */
export const accountSettingsSchema = z.object({
  min_notice_hours: z.coerce
    .number()
    .int("Minimum notice must be a whole number of hours.")
    .min(0, "Minimum notice cannot be negative.")
    .max(8760, "Minimum notice cannot exceed 8760 hours (1 year)."),
  max_advance_days: z.coerce
    .number()
    .int("Max advance must be a whole number of days.")
    .min(1, "Max advance must be at least 1 day.")
    .max(365, "Max advance cannot exceed 365 days."),
  daily_cap: z
    .union([
      z.coerce
        .number()
        .int("Daily cap must be a whole number.")
        .min(1, "Daily cap must be at least 1, or empty for no cap."),
      z.literal(null),
      z
        .literal("")
        .transform(() => null)
        .or(z.undefined().transform(() => null)),
    ])
    .nullable(),
});

export type WeeklyRulesInput = z.infer<typeof weeklyRulesSchema>;
export type DateOverrideFormInput = z.infer<typeof dateOverrideSchema>;
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
