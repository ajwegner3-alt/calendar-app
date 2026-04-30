import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickTextColor } from "@/lib/branding/contrast";
import type { Branding, BackgroundShade, ChromeTintIntensity } from "@/lib/branding/types";

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
 * @param row - Partial accounts row with logo_url, brand_primary, and Phase 12 columns.
 * @returns Resolved Branding with fallback defaults.
 */
export function brandingFromRow(row: {
  logo_url: string | null;
  brand_primary: string | null;
  background_color?: string | null;
  background_shade?: string | null;
  chrome_tint_intensity?: string | null;
  sidebar_color?: string | null;
}): Branding {
  const primaryColor = row.brand_primary ?? DEFAULT_BRAND_PRIMARY;
  const validShades: BackgroundShade[] = ["none", "subtle", "bold"];
  const shade = row.background_shade as BackgroundShade;
  const backgroundShade: BackgroundShade = validShades.includes(shade)
    ? shade
    : "subtle";

  const validIntensities: ChromeTintIntensity[] = ["none", "subtle", "full"];
  const rawIntensity = row.chrome_tint_intensity as ChromeTintIntensity;
  const chromeTintIntensity: ChromeTintIntensity = validIntensities.includes(rawIntensity)
    ? rawIntensity
    : "subtle";

  return {
    logoUrl: row.logo_url ?? null,
    primaryColor,
    textColor: pickTextColor(primaryColor),
    backgroundColor: row.background_color ?? null,
    backgroundShade,
    chromeTintIntensity,
    sidebarColor: row.sidebar_color ?? null,
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
      .select("logo_url, brand_primary, background_color, background_shade, chrome_tint_intensity, sidebar_color")
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
