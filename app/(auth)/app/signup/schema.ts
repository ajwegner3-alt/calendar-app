import { z } from "zod";

/**
 * Signup form schema (AUTH-05).
 * Fields: email + password ONLY — per CONTEXT.md lock.
 * Display name, slug, timezone, and first event type are wizard fields (Plan 10-06).
 */
export const signupSchema = z.object({
  email: z.string().email("Enter a valid email address.").max(254, "Email is too long."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
});

export type SignupInput = z.infer<typeof signupSchema>;
