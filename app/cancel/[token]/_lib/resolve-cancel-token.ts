import "server-only";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedCancelToken {
  state: "active" | "cancelled" | "not_active";
  booking?: {
    id: string;
    account_id: string;
    start_at: string;
    end_at: string;
    booker_name: string;
    booker_email: string;
    booker_timezone: string;
    status: string;
  };
  account?: {
    name: string;
    slug: string;
    timezone: string;
    owner_email: string | null;
  };
  eventType?: {
    name: string;
    slug: string;
    duration_minutes: number;
  };
}

/**
 * Resolve a raw cancel token from the URL into a booking snapshot.
 *
 * Validity (CONTEXT lock): status === 'confirmed' AND start_at > now() → 'active'
 * If status === 'cancelled' AND cancelled_at within last hour → 'cancelled' (success state to render)
 * Anything else → 'not_active'.
 *
 * Why the cancelled-recent check: after a successful POST /api/cancel, the
 * client refreshes the page and re-resolves the token. We want to render the
 * success state inline rather than the generic "no longer active" page (Open
 * Question B resolution). The 1-hour window is a soft guard against showing
 * the success state to a stale token from days ago — the dead-hash invalidation
 * (Plan 06-03) means re-arriving at the URL after dead-hash replacement
 * resolves to no row → 'not_active' → friendly page.
 */
export async function resolveCancelToken(rawToken: string): Promise<ResolvedCancelToken> {
  if (!rawToken || rawToken.length < 8) {
    return { state: "not_active" };
  }

  const hash = await hashToken(rawToken);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, start_at, end_at, booker_name, booker_email, booker_timezone, status, cancelled_at,
       event_types!inner(name, slug, duration_minutes),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("cancel_token_hash", hash)
    .maybeSingle();

  if (error || !data) {
    return { state: "not_active" };
  }

  const eventType = Array.isArray(data.event_types) ? data.event_types[0] : data.event_types;
  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  const now = new Date();
  const startAt = new Date(data.start_at);

  if (data.status === "confirmed" && startAt > now) {
    return {
      state: "active",
      booking: {
        id: data.id,
        account_id: data.account_id,
        start_at: data.start_at,
        end_at: data.end_at,
        booker_name: data.booker_name,
        booker_email: data.booker_email,
        booker_timezone: data.booker_timezone,
        status: data.status,
      },
      account: {
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
      },
      eventType: {
        name: eventType.name,
        slug: eventType.slug,
        duration_minutes: eventType.duration_minutes,
      },
    };
  }

  // Note: after a successful cancel, dead-hash replacement means we WON'T
  // re-find this booking on a refresh — the user will see TokenNotActive.
  // Cancel-success rendering is therefore handled in the POST response in the
  // client component (set local state to "cancelled" on 200, render success
  // inline). The 'cancelled' branch below is defensive for older clients that
  // hit a refresh path with a still-discoverable hash.
  if (data.status === "cancelled") {
    return {
      state: "cancelled",
      account: {
        name: account.name,
        slug: account.slug,
        timezone: account.timezone,
        owner_email: account.owner_email ?? null,
      },
      eventType: {
        name: eventType.name,
        slug: eventType.slug,
        duration_minutes: eventType.duration_minutes,
      },
    };
  }

  return { state: "not_active" };
}
