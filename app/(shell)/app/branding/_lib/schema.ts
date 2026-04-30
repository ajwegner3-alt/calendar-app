import { z } from "zod";
import type { ChromeTintIntensity } from "@/lib/branding/types";

export const primaryColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB format (e.g. #0A2540)");

// File validation runs BOTH client-side (UX) and server-side (truth).
// Server limit also enforced by Supabase bucket policy (PNG only, 2 MB).
//
// RESEARCH override: CONTEXT.md said "PNG or SVG"; RESEARCH.md §SVG-rationale
// narrows to PNG-only in v1 due to XSS surface (SVG can embed scripts).
// SVG support is a deferred future enhancement.
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// PNG magic number: every PNG file starts with these 4 bytes.
// Used for server-side magic-byte validation in uploadLogoAction
// (file.type is browser-reported MIME and is spoofable; magic-byte check
//  is the actual proof the upload is a PNG).
export const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const;

/**
 * RESEARCH override: CONTEXT.md said "PNG or SVG"; RESEARCH.md §SVG-rationale
 * narrows to PNG-only in v1 due to XSS surface (SVG can embed scripts).
 * SVG support is a deferred future enhancement.
 */
export const logoFileSchema = {
  maxBytes: MAX_LOGO_BYTES,
  allowedMime: "image/png" as const,
  magicBytes: PNG_MAGIC,
};

// Phase 12: background gradient tokens
export const backgroundColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB format (e.g. #0A2540)")
  .nullable()
  .optional();

export const backgroundShadeSchema = z
  .enum(["none", "subtle", "bold"])
  .default("subtle");

// Phase 12.5: chrome tinting intensity (kept for backward compat — DB column still exists)
export const chromeTintIntensitySchema = z
  .enum(["none", "subtle", "full"])
  .default("subtle") satisfies z.ZodType<ChromeTintIntensity>;

// Phase 12.6: direct sidebar color (nullable hex — null = use CSS default)
export const sidebarColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB format (e.g. #0A2540)")
  .nullable()
  .optional();

export const brandingBackgroundSchema = z.object({
  background_color: backgroundColorSchema,
  background_shade: backgroundShadeSchema,
  sidebar_color: sidebarColorSchema,
});
