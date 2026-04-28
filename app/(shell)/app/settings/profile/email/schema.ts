import { z } from "zod";

export const emailChangeSchema = z.object({
  new_email: z.string().email("Enter a valid email address.").max(254, "Email too long."),
});
