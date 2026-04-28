import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
