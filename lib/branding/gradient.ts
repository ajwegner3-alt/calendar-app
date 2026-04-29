import type { BackgroundShade } from "./types";

/**
 * CSS-ready inline-style fragments for one of the 3 blur circles in the
 * Cruip-pattern gradient backdrop.
 * Positional classes are owned by the consumer (GradientBackdrop).
 */
export interface GradientCircle {
  backgroundImage: string; // e.g. "linear-gradient(to top right, #0A2540, transparent)"
  opacity: number;         // 0–1
  blurPx: number;          // px value for filter: blur(...)
}

/**
 * Resolved gradient plan for a given color + shade combination.
 * shade='none' produces a flat tint; 'subtle' and 'bold' produce 3 blur circles each.
 */
export interface GradientPlan {
  shade: BackgroundShade;
  /** When shade='none': a color-mix() tint string (4% color over white). Otherwise null. */
  flatTint: string | null;
  /** Empty when shade='none'. Three entries for subtle/bold. */
  circles: GradientCircle[];
}

/**
 * Pure function: derive a GradientPlan from a hex color + shade token.
 *
 * Shared source-of-truth for all consumers (GradientBackdrop, NSIGradientBackdrop,
 * mini-preview-card, future email preview). No React, no DOM.
 *
 * @param color - Hex color string (e.g. '#0A2540'). null falls back to gray-50 (#F8FAFC).
 * @param shade - 'none' | 'subtle' | 'bold'
 */
export function shadeToGradient(
  color: string | null,
  shade: BackgroundShade,
): GradientPlan {
  const baseColor = color ?? "#F8FAFC"; // gray-50 fallback

  if (shade === "none") {
    return {
      shade,
      flatTint: `color-mix(in oklch, ${baseColor} 4%, white)`,
      circles: [],
    };
  }

  const opacity = shade === "subtle" ? 0.25 : 0.5;
  const blurPx = shade === "subtle" ? 200 : 160;

  return {
    shade,
    flatTint: null,
    circles: [
      {
        backgroundImage: `linear-gradient(to top right, ${baseColor}, transparent)`,
        opacity,
        blurPx,
      },
      {
        backgroundImage: `linear-gradient(to top right, ${baseColor}, #0F172A)`,
        opacity,
        blurPx,
      },
      {
        backgroundImage: `linear-gradient(to top right, ${baseColor}, #0F172A)`,
        opacity,
        blurPx,
      },
    ],
  };
}
