/**
 * Resolved branding for an account.
 * Shared across all surfaces: booking page, embed, confirmation, cancel,
 * reschedule screens, and transactional emails.
 */

/** Phase 12: gradient intensity for background blur-circle decoration. */
export type BackgroundShade = "none" | "subtle" | "bold";

/** Phase 12.5: per-account chrome tinting intensity. */
export type ChromeTintIntensity = "none" | "subtle" | "full";

export interface Branding {
  /** Logo URL from Supabase Storage (public bucket). Null if not uploaded. */
  logoUrl: string | null;
  /** Resolved primary color — always a valid #RRGGBB string (falls back to DEFAULT_BRAND_PRIMARY). */
  primaryColor: string;
  /** WCAG-computed text color for use on top of primaryColor backgrounds. */
  textColor: "#ffffff" | "#000000";

  // Phase 18: deprecated — kept as optional shims so lib/branding/chrome-tint.ts
  // and tests/branding-chrome-tint.test.ts type-check until Phase 20 deletes them.
  // Phase 20 (CLEAN-07..09) will remove these fields entirely.

  /** @deprecated Phase 18 — Phase 20 removes. */
  backgroundColor?: string | null;
  /** @deprecated Phase 18 — Phase 20 removes. */
  backgroundShade?: BackgroundShade;
  /** @deprecated Phase 18 — Phase 20 removes. */
  chromeTintIntensity?: ChromeTintIntensity;
  /** @deprecated Phase 18 — Phase 20 removes. */
  sidebarColor?: string | null;
}
