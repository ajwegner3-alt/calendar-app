import { z } from "zod";

export const displayNameSchema = z.object({
  display_name: z.string().min(2).max(80),
});

export const slugSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/, {
    message: "Slug must be 3-40 characters: lowercase letters, numbers, and hyphens only.",
  }),
});

export const passwordSchema = z.object({
  current_password: z.string().min(1, "Current password is required."),
  new_password: z.string().min(8, "New password must be at least 8 characters.").max(72),
});
