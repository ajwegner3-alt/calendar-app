import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";
import type { AccountListingData, EventTypeCardData } from "./types";

/**
 * Loads account + all active, non-soft-deleted event types for the public /[account] index.
 *
 * - Service-role admin client (route is unauthenticated; RLS would silently return 0 rows)
 * - Returns null if slug is reserved or account row missing
 * - Returns empty eventTypes array if account exists but has no active events
 *   (caller renders empty state, NOT notFound — CONTEXT lock: never 404 on real account)
 */
export async function loadAccountListing(
  accountSlug: string,
): Promise<AccountListingData | null> {
  if (RESERVED_SLUGS.has(accountSlug)) return null;

  const supabase = createAdminClient();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
    .eq("slug", accountSlug)
    .maybeSingle();

  if (accountError || !account) return null;

  const { data: events, error: eventsError } = await supabase
    .from("event_types")
    .select("id, slug, name, description, duration_minutes")
    .eq("account_id", account.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (eventsError) {
    // Don't 404 on transient DB errors — fail soft, render empty state.
    console.error("[loadAccountListing] events query failed:", eventsError);
  }

  const eventTypes: EventTypeCardData[] = (events ?? []).map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    duration_minutes: e.duration_minutes,
  }));

  return { account, eventTypes };
}
