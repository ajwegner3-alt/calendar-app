import { z } from "zod";

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

// Phase 40 Plan 05 (2026-05-09): PNG_MAGIC and logoFileSchema deleted —
// uploadLogoAction in _lib/actions.ts inlines the magic-byte literals
// (head[0]===0x89 && head[1]===0x50 && head[2]===0x4e && head[3]===0x47)
// and imports MAX_LOGO_BYTES directly. The aggregator object had zero
// callers; PNG_MAGIC's only consumer was the dead aggregator.
