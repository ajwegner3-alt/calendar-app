// WCAG relative luminance + text-color picker.
// Formula source: https://www.w3.org/WAI/GL/wiki/Relative_luminance
//
// Threshold: 0.04045 (IEC standard — NOT the older 0.03928 listed in some W3C pages;
// difference is negligible for 8-bit values but we use the more precise value).

/**
 * Linearize a single 8-bit sRGB channel value (0-255).
 * Converts from gamma-encoded sRGB to linear light.
 */
function linearize(channel8bit: number): number {
  const s = channel8bit / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Compute the WCAG relative luminance of a hex color.
 *
 * @param hex - 7-character #RRGGBB string. Validated upstream by Zod (Plan 07-04).
 *   Defensive: returns luminance of DEFAULT_BRAND_PRIMARY (#0A2540) if parsing fails.
 * @returns Relative luminance in [0, 1]; 0 = black, 1 = white.
 */
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Guard against NaN from malformed input — fall back to #0A2540 (dark navy)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    // #0A2540: r=10, g=37, b=64
    return (
      0.2126 * linearize(10) + 0.7152 * linearize(37) + 0.0722 * linearize(64)
    );
  }

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Pick the text color (white or black) that achieves the highest contrast ratio
 * against the given background hex color, per WCAG 2.1 contrast formula.
 *
 * @param bgHex - Background color as #RRGGBB. Handles malformed input gracefully
 *   (returns a valid option without throwing).
 * @returns "#ffffff" for dark backgrounds; "#000000" for light backgrounds.
 */
export function pickTextColor(bgHex: string): "#ffffff" | "#000000" {
  const L = relativeLuminance(bgHex);
  // Contrast ratio formula: (lighter + 0.05) / (darker + 0.05)
  // White (L=1.0) on background: (1.05) / (L + 0.05)
  // Black (L=0.0) on background: (L + 0.05) / (0.05)
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? "#ffffff" : "#000000";
}
