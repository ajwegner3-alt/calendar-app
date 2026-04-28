import { z } from "zod";

/**
 * Password policy (CONTEXT.md Claude's Discretion):
 *   - 8-character minimum
 *   - No character-class requirements
 *   - Supabase enforces additional basics on its end
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
