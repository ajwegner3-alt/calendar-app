import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const magicLinkSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

// Phase 40 Plan 05 (2026-05-09): MagicLinkInput type deleted — zero consumers;
// Phase 38 forms use magicLinkSchema directly via zodResolver(magicLinkSchema).
