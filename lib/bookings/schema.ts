import { z } from "zod";

// Phone: format-loose per CONTEXT decision #3.
// Allow digits + spaces + dashes + parens + leading + and dots; min 7 digits after
// stripping non-digit chars to catch obviously-too-short numbers without rejecting
// international formats. libphonenumber-js deferred to v1 backlog.
const PHONE_FORMAT_REGEX = /^[\d\s\-+().]+$/;
const phoneSchema = z
  .string()
  .min(1, "Phone is required.")
  .refine((v) => PHONE_FORMAT_REGEX.test(v), {
    message:
      "Phone may only contain digits, spaces, dashes, parens, plus, and dots.",
  })
  .refine((v) => v.replace(/\D/g, "").length >= 7, {
    message: "Phone must contain at least 7 digits.",
  });

/**
 * Zod schema for POST /api/bookings request body.
 *
 * NOTE: This file MUST NOT import "server-only" — the schema is also used by
 * the booking form's RHF zodResolver on the client. Keep it isomorphic.
 */
export const bookingInputSchema = z.object({
  /** UUID of the event type being booked */
  eventTypeId: z.string().uuid(),
  /** ISO UTC datetime string with Z suffix, e.g. "2026-06-15T14:00:00.000Z" */
  startAt: z.string().datetime(),
  /** ISO UTC datetime string with Z suffix */
  endAt: z.string().datetime(),
  /** Booker display name, 1–200 chars */
  bookerName: z.string().min(1, "Name is required.").max(200),
  /** Booker email address */
  bookerEmail: z.string().email("Invalid email address.").max(254),
  /** Booker phone — format-loose: digits + spaces + dashes + parens + plus */
  bookerPhone: phoneSchema,
  /** Booker IANA timezone, e.g. "America/Chicago" — from Intl.DateTimeFormat */
  bookerTimezone: z.string().min(1, "Timezone is required.").max(64),
  /** Custom-question answers: key = question label/id, value = answer string */
  answers: z.record(z.string(), z.string()),
  /** Cloudflare Turnstile response token — verified server-side before DB write */
  turnstileToken: z.string().min(1, "Turnstile token is required."),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
