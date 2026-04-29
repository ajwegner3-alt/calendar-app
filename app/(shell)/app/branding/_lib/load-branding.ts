import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { BackgroundShade } from "@/lib/branding/types";

export interface BrandingState {
  accountId: string;
  accountSlug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  firstActiveEventSlug: string | null; // for preview iframe target; null = no events yet
  // Phase 12 additions
  backgroundColor: string | null;
  backgroundShade: BackgroundShade;
}

const VALID_SHADES: BackgroundShade[] = ["none", "subtle", "bold"];

/**
 * Loads branding state for the OWNER's account.
 *
 * Auth model: uses RLS-scoped server client (createClient from @supabase/ssr).
 * The owner is logged in; RLS scopes to their account_id automatically.
 * Returns null if owner is not linked to any account (Phase 2 unlinked state).
 */
export async function loadBrandingForOwner(): Promise<BrandingState | null> {
  const supabase = await createClient();

  // Owner -> accounts they own (current_owner_account_ids RPC from Phase 2)
  const { data: accountIds } = await supabase.rpc("current_owner_account_ids");
  const ids = Array.isArray(accountIds) ? accountIds : [];
  if (ids.length === 0) return null;

  const accountId = ids[0]; // v1 single-account-per-owner; multi later

  const { data: account } = await supabase
    .from("accounts")
    .select(
      "id, slug, logo_url, brand_primary, background_color, background_shade",
    )
    .eq("id", accountId)
    .maybeSingle();

  if (!account) return null;

  // First active, non-soft-deleted event for preview-iframe target
  const { data: firstEvent } = await supabase
    .from("event_types")
    .select("slug")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const shade = account.background_shade as BackgroundShade;
  const backgroundShade: BackgroundShade = VALID_SHADES.includes(shade)
    ? shade
    : "subtle";

  return {
    accountId: account.id,
    accountSlug: account.slug,
    logoUrl: account.logo_url,
    primaryColor: account.brand_primary,
    firstActiveEventSlug: firstEvent?.slug ?? null,
    backgroundColor: account.background_color ?? null,
    backgroundShade,
  };
}
