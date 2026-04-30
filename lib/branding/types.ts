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
  // Phase 12 additions
  /** Per-account hex tint for gradient backdrops. null = use gray-50 fallback at consumer. */
  backgroundColor: string | null;
  /** Gradient intensity. Never null (DB DEFAULT 'subtle'). */
  backgroundShade: BackgroundShade;
  // Phase 12.5 additions
  /** Chrome tint intensity. Never null (DB DEFAULT 'subtle'). Kept for backward compat — Wave 2 consumers use resolveChromeColors instead. */
  chromeTintIntensity: ChromeTintIntensity;
  // Phase 12.6 additions
  /** Per-account sidebar fill color. Null = shadcn --sidebar default. */
  sidebarColor: string | null;
}
