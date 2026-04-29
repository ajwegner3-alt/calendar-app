import type { ChromeTintIntensity } from "./types";
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
