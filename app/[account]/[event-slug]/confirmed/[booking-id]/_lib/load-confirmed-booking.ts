import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConfirmedBookingData {
  booking: {
    id: string;
    start_at: string;
    end_at: string;
    booker_email: string;
    booker_name: string;
    booker_timezone: string;
    status: "confirmed" | "cancelled" | "rescheduled" | string;
  };
  account: {
    name: string;
    timezone: string;
    logo_url: string | null;
    brand_primary: string | null;
  };
  eventType: {
    name: string;
    duration_minutes: number;
  };
}

/**
 * Loads a booking + its parent account + event_type, verifying the URL
 * (account-slug, event-slug) matches the booking's actual parents.
 *
 * Authorization model:
 *   - Lookup is keyed by booking.id (UUID v4 — 122 bits entropy, effectively
 *     unguessable). No magic-token URL param is needed for this surface.
 *   - Defense-in-depth: after fetching the row, the URL slugs are compared to
 *     the booking's actual account.slug and event_type.slug. A mismatch returns
 *     null → page calls notFound(). This prevents leaking a booking via any
 *     wrong-tenant URL (e.g. /other-tenant/.../confirmed/<valid-id>).
 *   - Status != 'confirmed' returns the row anyway; the page renders a friendly
 *     fallback so this URL never breaks for the booker (Phase 6 may flip status
 *     to 'cancelled' or 'rescheduled' — both are rendered gracefully).
 *
 * Service-role client used because RLS blocks all anon reads on bookings
 * (migration 20260419120001 line 61). Same rationale as /api/slots, /api/bookings,
 * and the /[account]/[event-slug] public page.
 *
 * Note on is_active/deleted_at: the plan specifies filtering event_types by
 * is_active + deleted_at IS NULL. Per CONTEXT decision #7 and plan constraint #4,
 * an archived event type's old confirmations should 404 on revisit — acceptable
 * v1 behavior (booking was made before archival; booker has all details in email).
 */
export async function loadConfirmedBooking(args: {
  accountSlug: string;
  eventSlug: string;
  bookingId: string;
}): Promise<ConfirmedBookingData | null> {
  // Fast-reject: if bookingId is not a valid UUID format, skip the DB round-trip
  if (!UUID_REGEX.test(args.bookingId)) return null;

  const supabase = createAdminClient();

  // 1. Fetch the booking row by primary key
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select(
      "id, account_id, event_type_id, start_at, end_at, booker_email, booker_name, booker_timezone, status",
    )
    .eq("id", args.bookingId)
    .maybeSingle();

  if (bookingErr || !booking) return null;

  // 2. Parallel fetch of account + event_type (both required for cross-tenant verification)
  const [accountRes, eventTypeRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("slug, name, timezone, logo_url, brand_primary")
      .eq("id", booking.account_id)
      .single(),
    supabase
      .from("event_types")
      .select("slug, name, duration_minutes, is_active, deleted_at")
      .eq("id", booking.event_type_id)
      .single(),
  ]);

  if (accountRes.error || !accountRes.data) return null;
  if (eventTypeRes.error || !eventTypeRes.data) return null;

  // 3. Defense-in-depth: URL slugs MUST match the booking's actual parents.
  //    Without this, any valid booking-id is reachable via /any-tenant/.../confirmed/ID.
  if (accountRes.data.slug !== args.accountSlug) return null;
  if (eventTypeRes.data.slug !== args.eventSlug) return null;

  // 4. Respect is_active / deleted_at on the event type (plan constraint #4).
  //    Archived event types' confirmations 404 on revisit — acceptable v1 behavior.
  const et = eventTypeRes.data;
  if (!et.is_active || et.deleted_at !== null) return null;

  return {
    booking: {
      id: booking.id,
      start_at: booking.start_at,
      end_at: booking.end_at,
      booker_email: booking.booker_email,
      booker_name: booking.booker_name,
      booker_timezone: booking.booker_timezone,
      status: booking.status,
    },
    account: {
      name: accountRes.data.name,
      timezone: accountRes.data.timezone,
      logo_url: accountRes.data.logo_url ?? null,
      brand_primary: accountRes.data.brand_primary ?? null,
    },
    eventType: {
      name: et.name,
      duration_minutes: et.duration_minutes,
    },
  };
}
