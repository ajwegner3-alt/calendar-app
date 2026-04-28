/**
 * Single source of truth for slugs that cannot be claimed as account slugs.
 * Consolidated in Phase 10 (Plan 10-01) — was previously duplicated across
 * `app/[account]/_lib/load-account-listing.ts` and
 * `app/[account]/[event-slug]/_lib/load-event-type.ts`.
 *
 * Adds Phase 10 entries for new top-level routes: signup, onboarding, login,
 * forgot-password, settings (settings is already implicitly covered via
 * /app/settings, but adding the bare path closes a future-proofing edge).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // v1.0 entries (from FUTURE_DIRECTIONS.md §2)
  "app",
  "api",
  "_next",
  "auth",
  "embed",
  // v1.1 Phase 10 additions
  "signup",
  "onboarding",
  "login",
  "forgot-password",
  "settings",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
