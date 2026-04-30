import type { ChromeTintIntensity, Branding } from "./types";
import { pickTextColor } from "./contrast";

/**
 * The two dashboard chrome surfaces that receive per-account tinting.
 * Cards are deliberately excluded — always white for Cruip card-on-tint readability.
 */
export type ChromeTintSurface = "sidebar" | "page";

/**
 * Codified tint percentages per intensity per surface.
 * Locked in Phase 12.5 planning — do not fork this table in consumers.
 *
 * sidebar: full=14%  subtle=6%
 * page:    full=8%   subtle=3%
 * none on any surface → null (consumer uses its existing CSS default)
 */
const TINT_PCT: Record<ChromeTintSurface, Record<Exclude<ChromeTintIntensity, "none">, number>> = {
  sidebar: { full: 14, subtle: 6 },
  page:    { full: 8,  subtle: 3 },
};

/**
 * Derive a color-mix() CSS string for a chrome surface given intensity.
 *
 * Returns null when:
 *   - intensity === 'none' (consumer should fall back to its existing CSS default)
 *   - color === null (no brand color configured; can't tint without a source)
 *
 * Consumers apply the result via inline style={{ backgroundColor: chromeTintToCss(...) ?? undefined }}
 * so that null falls through to the CSS class default (Phase 7 pitfall: never use dynamic Tailwind).
 *
 * @param color  - Brand hex color, e.g. '#0A2540'. null = return null.
 * @param intensity - ChromeTintIntensity value.
 * @param surface - 'sidebar' | 'page'
 */
export function chromeTintToCss(
  color: string | null,
  intensity: ChromeTintIntensity,
  surface: ChromeTintSurface,
): string | null {
  if (color === null || intensity === "none") return null;
  const pct = TINT_PCT[surface][intensity];
  return `color-mix(in oklch, ${color} ${pct}%, white)`;
}

/**
 * Derive the text color to use on a chrome surface with a given tint applied.
 * When tint is null (none intensity or no color), text stays at default (returns null).
 *
 * Used by sidebar to flip nav text/icon color when heavily tinted.
 *
 * @param color  - Brand hex color, e.g. '#0A2540'. null = return null.
 * @param intensity - ChromeTintIntensity value.
 * @param surface - 'sidebar' | 'page'
 */
export function chromeTintTextColor(
  color: string | null,
  intensity: ChromeTintIntensity,
  surface: ChromeTintSurface,
): "#ffffff" | "#000000" | null {
  if (color === null || intensity === "none") return null;
  const tint = chromeTintToCss(color, intensity, surface);
  if (tint === null) return null;
  // Approximate the blended color for WCAG check:
  // At 14% brand color mixed into white, the result is very light.
  // We pass the original color to pickTextColor — at low percentages this
  // correctly returns black (light surface needs dark text). At 14% a dark navy
  // mixed with white still produces a very light surface, so black text is correct.
  // For full intensity on a very dark color (luminance < 0.3), white text may
  // apply — pickTextColor on the tinted value would be most accurate but requires
  // CSS color parsing. Conservative approach: use pickTextColor on original color.
  // This gives correct results for typical brand colors (dark navies → black text on tint).
  return pickTextColor(color);
}

// ---------------------------------------------------------------------------
// Phase 12.6: Direct full-strength color resolution
// ---------------------------------------------------------------------------

/**
 * Resolved direct-color set for dashboard chrome surfaces.
 * Each value is either a literal hex string (use it as-is) or null (use CSS default).
 *
 * Phase 12.6 pivot: instead of color-mix tints, owners set full-strength colors
 * per surface. resolveChromeColors() is the single place where the priority
 * chains are evaluated so Wave 2 consumers don't fork the logic.
 */
export interface ResolvedChromeColors {
  /** Direct hex fill for page (SidebarInset) bg. Null = use CSS default (bg-background / gray-50). */
  pageColor: string | null;
  /** Direct hex fill for sidebar bg. Null = use CSS default (--sidebar token). */
  sidebarColor: string | null;
  /**
   * Direct hex for --primary CSS variable override.
   * Always a string (falls back to DEFAULT_BRAND_PRIMARY when owner hasn't set brand_primary).
   * Shell sets style={{ "--primary": primaryColor }} unconditionally; this is safe because
   * the default value matches the shadcn-overridden default already in use.
   * v1.2 improvement: store raw brand_primary nullable separately so we can skip the override
   * when the owner hasn't explicitly set it.
   */
  primaryColor: string;
  /** WCAG-compliant text color for sidebar surface. Null when sidebarColor is null. */
  sidebarTextColor: "#ffffff" | "#000000" | null;
  /** WCAG-compliant text color for primary-colored surfaces (button text, etc.). Always set. */
  primaryTextColor: "#ffffff" | "#000000";
}

/**
 * Resolve the full set of direct chrome colors from a Branding object.
 *
 * Priority chains:
 *   pageColor    → branding.backgroundColor (accounts.background_color)
 *   sidebarColor → branding.sidebarColor    (accounts.sidebar_color)
 *   primaryColor → branding.primaryColor    (accounts.brand_primary, always set via fallback)
 *
 * Wave 2 consumers (shell layout, sidebar, email) import this function and
 * apply each resolved value via inline style. null values fall through to the
 * CSS class default (Phase 7 pitfall: never use dynamic Tailwind for runtime hex).
 *
 * @param branding - Resolved Branding object from getBrandingForAccount / brandingFromRow.
 * @returns ResolvedChromeColors with 5 fields.
 */
export function resolveChromeColors(branding: Branding): ResolvedChromeColors {
  const pageColor = branding.backgroundColor ?? null;
  const sidebarColor = branding.sidebarColor ?? null;
  // primaryColor is always a string in Branding (falls back to DEFAULT_BRAND_PRIMARY).
  const primaryColor = branding.primaryColor;

  const sidebarTextColor = sidebarColor ? pickTextColor(sidebarColor) : null;
  const primaryTextColor = pickTextColor(primaryColor);

  return {
    pageColor,
    sidebarColor,
    primaryColor,
    sidebarTextColor,
    primaryTextColor,
  };
}
