import { z } from "zod";

export const step1Schema = z.object({
  // UI label is "Display Name" / "Business Name"; maps to accounts.name column.
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]{3,40}$/,
      "Use 3–40 lowercase letters, numbers, or hyphens",
    ),
});

export const step2Schema = z.object({
  timezone: z.string().min(3).max(64), // IANA TZ — server validates via Intl.DateTimeFormat
});

export const step3Schema = z.object({
  name: z.string().min(2).max(80),
  duration_minutes: z.number().int().min(5).max(480),
  // capacity defaults to 1 — Phase 11 will expose per-event-type capacity input;
  // Phase 10 doesn't surface this in the wizard.
});
