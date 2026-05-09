import "server-only";
import { pickTextColor } from "@/lib/branding/contrast";
import type { Branding } from "@/lib/branding/types";

/**
 * Default primary brand color — NSI navy (matches Phase 2 lock:
 * Tailwind v4 @theme --color-primary).
 * Phase 7 branding editor (Plan 07-04) allows owners to override this per account.
 *
 * Phase 40 Plan 05 (2026-05-09): export keyword removed — internal-only use
 * at line 31 by brandingFromRow. Constant stays.
 */
const DEFAULT_BRAND_PRIMARY = "#0A2540";

/**
 * Derive a Branding object from an already-fetched accounts row.
 *
 * Use this when the caller already has the accounts row in memory
 * (e.g., booking page loader, /[account] index loader) to avoid a
 * redundant DB round-trip.
 *
 * Phase 20: @deprecated optional shim fields removed from Branding interface.
 * brandingFromRow now accepts only the two columns that are actually read
 * at runtime (logo_url, brand_primary).
 *
 * @param row - Partial accounts row with logo_url and brand_primary.
 * @returns Resolved Branding with fallback defaults.
 */
export function brandingFromRow(row: {
  logo_url: string | null;
  brand_primary: string | null;
}): Branding {
  const primaryColor = row.brand_primary ?? DEFAULT_BRAND_PRIMARY;
  return {
    logoUrl: row.logo_url ?? null,
    primaryColor,
    textColor: pickTextColor(primaryColor),
  };
}

// Phase 40 Plan 05 (2026-05-09): getBrandingForAccount deleted — zero callers
// in app/, lib/, or tests/. Booker flow uses brandingFromRow directly with
// already-fetched accounts rows (avoids the extra DB round-trip).
