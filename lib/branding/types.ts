/**
 * Resolved branding for an account.
 * Shared across all surfaces: booking page, embed, confirmation, cancel,
 * reschedule screens, and transactional emails.
 */
export interface Branding {
  /** Logo URL from Supabase Storage (public bucket). Null if not uploaded. */
  logoUrl: string | null;
  /** Resolved primary color — always a valid #RRGGBB string (falls back to DEFAULT_BRAND_PRIMARY). */
  primaryColor: string;
  /** WCAG-computed text color for use on top of primaryColor backgrounds. */
  textColor: "#ffffff" | "#000000";
}
