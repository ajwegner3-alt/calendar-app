import { z } from "zod";

/**
 * Custom-question discriminated union.
 *
 * Zod v4: z.discriminatedUnion uses O(1) discriminator lookup.
 * Each branch shares: id (uuid), label (1-200 chars), required (default false).
 * Single-select adds an options array (1-20 strings, each 1-100 chars).
 */
const baseQuestion = z.object({
  id: z.string().uuid({ message: "Internal error: missing question id." }),
  label: z
    .string()
    .min(1, "Question label is required.")
    .max(200, "Question label must be 200 characters or fewer."),
  required: z.coerce.boolean().default(false),
});

const shortTextQuestion = baseQuestion.extend({ type: z.literal("short-text") });
const longTextQuestion = baseQuestion.extend({ type: z.literal("long-text") });
const yesNoQuestion = baseQuestion.extend({ type: z.literal("yes-no") });

const singleSelectQuestion = baseQuestion.extend({
  type: z.literal("single-select"),
  options: z
    .array(z.string().min(1, "Option label cannot be empty.").max(100))
    .min(1, "Add at least one option.")
    .max(20, "A single-select question can have at most 20 options."),
});

export const customQuestionSchema = z.discriminatedUnion("type", [
  shortTextQuestion,
  longTextQuestion,
  yesNoQuestion,
  singleSelectQuestion,
]);

/**
 * Event-type schema for create + edit.
 *
 * - name: 1-100 chars
 * - slug: 1-100 chars, must match /^[a-z0-9-]+$/ (matches slugify output)
 * - duration_minutes: 1-480 (8 hours max — matches CONTEXT v1 scope)
 * - description: optional, up to 500 chars; empty string normalized to undefined
 * - is_active: defaults to true on create
 * - custom_questions: array (default empty); each entry validated by customQuestionSchema
 */
export const eventTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  slug: z
    .string()
    .min(1, "URL slug is required.")
    .max(100, "URL slug must be 100 characters or fewer.")
    .regex(
      /^[a-z0-9-]+$/,
      "URL slug may only contain lowercase letters, numbers, and hyphens.",
    ),
  duration_minutes: z.coerce
    .number()
    .int("Duration must be a whole number.")
    .min(1, "Duration must be at least 1 minute.")
    .max(480, "Duration cannot exceed 480 minutes (8 hours)."),
  // Phase 28 LD-01: per-event-type post-event buffer (replaces accounts.buffer_minutes).
  // .catch(0) → empty input or NaN coerces to 0 silently (CONTEXT: forgiving, no
  // "required" error). Owner-facing label is "Buffer after event (minutes)".
  buffer_after_minutes: z.coerce
    .number()
    .int()
    .min(0, "Buffer cannot be negative.")
    .max(360, "Buffer cannot exceed 360 minutes (6 hours).")
    .catch(0),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  is_active: z.coerce.boolean().default(true),
  custom_questions: z.array(customQuestionSchema).default([]),
  // Phase 8 Plan 08-05: per-event-type location/address. Optional, up to 500
  // chars (matches description ceiling). Empty string normalizes to undefined
  // so the action layer can write NULL to the DB (cleaner queries downstream;
  // the reminder cron join in 08-04 selects this column).
  location: z
    .string()
    .max(500, "Location must be 500 characters or fewer.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Phase 11 Plan 11-07: CAP-03 capacity input + CAP-08 show-remaining toggle.
  // z.coerce mirrors existing pattern (HTML form values arrive as strings).
  // DB has no upper bound (CHECK >= 1 only); Zod enforces the 50-cap ceiling.
  max_bookings_per_slot: z.coerce
    .number()
    .int("Capacity must be a whole number.")
    .min(1, "Capacity must be at least 1.")
    .max(50, "Capacity cannot exceed 50.")
    .default(1),
  show_remaining_capacity: z.coerce.boolean().default(false),
  // CAP-09: bypass flag — travels with the re-submission when the modal confirms
  // a capacity decrease over existing confirmed bookings. Never stored to DB.
  confirmCapacityDecrease: z.coerce.boolean().optional().default(false),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;
