import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickTextColor } from "@/lib/branding/contrast";
import type { Branding } from "@/lib/branding/types";

/**
 * Default primary brand color — NSI navy (matches Phase 2 lock:
 * Tailwind v4 @theme --color-primary).
 * Phase 7 branding editor (Plan 07-04) allows owners to override this per account.
 */
export const DEFAULT_BRAND_PRIMARY = "#0A2540";

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

/**
 * Fetch branding for an account by ID from the database.
 *
 * Use this when the caller has only an accountId (e.g., email senders,
 * embed page) and does NOT already have the accounts row in memory.
 * For callers that already have the row, prefer brandingFromRow() to
 * avoid the extra round-trip.
 *
 * Fails open: if the row is missing or the query errors, returns all-defaults
 * Branding (logoUrl null, primaryColor DEFAULT, textColor white).
 * Caller decides whether to surface the error — this helper never throws.
 *
 * Phase 18 (BRAND-20): SELECT shrunk to logo_url, brand_primary only.
 * Phase 20: deprecated column references removed from brandingFromRow signature.
 *
 * @param accountId - UUID of the account.
 * @returns Resolved Branding object, always valid.
 */
export async function getBrandingForAccount(
  accountId: string,
): Promise<Branding> {
  try {
    const supabase = createAdminClient();
    const { data: row } = await supabase
      .from("accounts")
      .select("logo_url, brand_primary")
      .eq("id", accountId)
      .maybeSingle();

    if (!row) {
      return brandingFromRow({ logo_url: null, brand_primary: null });
    }

    return brandingFromRow(row);
  } catch {
    // Supabase client construction or network error — return safe defaults.
    return brandingFromRow({ logo_url: null, brand_primary: null });
  }
}
