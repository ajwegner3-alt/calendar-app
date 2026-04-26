import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingPageData, CustomQuestion } from "./types";

// Phase 7: added "embed" — /embed/[account]/[event-slug] is a new top-level route.
// Next.js 16 static segments take precedence over dynamic, but the guard is
// belt-and-suspenders per RESEARCH.md Pitfall 8. Must also be added to any future
// /[account]/page.tsx loader (Plan 07-08).
const RESERVED_SLUGS = new Set(["app", "api", "_next", "auth", "embed"]);

/**
 * Loads account + event_type for the public booking page.
 *
 * - Service-role client (RLS would silently return 0 rows for anon).
 *   Same rationale as /api/slots: route is public, no auth session.
 * - Returns null if account-slug is reserved, account row missing, or
 *   event_type missing/inactive/soft-deleted.
 */
export async function loadEventTypeForBookingPage(
  accountSlug: string,
  eventSlug: string,
): Promise<BookingPageData | null> {
  if (RESERVED_SLUGS.has(accountSlug)) return null;

  const supabase = createAdminClient();

  // 1. Account
  const { data: accountRow, error: accountError } = await supabase
    .from("accounts")
    .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
    .eq("slug", accountSlug)
    .maybeSingle();

  if (accountError || !accountRow) return null;

  // 2. Event type — active + not soft-deleted
  const { data: eventTypeRow, error: etError } = await supabase
    .from("event_types")
    .select("id, slug, name, description, duration_minutes, custom_questions")
    .eq("account_id", accountRow.id)
    .eq("slug", eventSlug)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (etError || !eventTypeRow) return null;

  // custom_questions is jsonb — coerce defensively
  const customQuestions: CustomQuestion[] = Array.isArray(
    eventTypeRow.custom_questions,
  )
    ? (eventTypeRow.custom_questions as CustomQuestion[])
    : [];

  return {
    account: {
      id: accountRow.id,
      slug: accountRow.slug,
      name: accountRow.name,
      timezone: accountRow.timezone,
      owner_email: accountRow.owner_email,
      // Phase 7 branding fields — additive; downstream callers may ignore
      logo_url: accountRow.logo_url ?? null,
      brand_primary: accountRow.brand_primary ?? null,
    },
    eventType: {
      id: eventTypeRow.id,
      slug: eventTypeRow.slug,
      name: eventTypeRow.name,
      description: eventTypeRow.description,
      duration_minutes: eventTypeRow.duration_minutes,
      custom_questions: customQuestions,
    },
  };
}
