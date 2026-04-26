import "server-only";
import { hashToken } from "@/lib/bookings/tokens";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolvedRescheduleToken {
  state: "active" | "not_active";
  /** SHA-256 hex hash of the URL token — caller passes this as `oldRescheduleHash` to rescheduleBooking() */
  tokenHash?: string;
  booking?: {
    id: string;
    account_id: string;
    event_type_id: string;
    start_at: string;
    end_at: string;
    booker_timezone: string;
  };
  account?: {
    name: string;
    slug: string;
    timezone: string;
    owner_email: string | null;
  };
  eventType?: {
    id: string;
    name: string;
    slug: string;
    duration_minutes: number;
  };
}

/** Resolve a raw reschedule token from the URL into a booking + event_type + account snapshot.
 *  Validity (CONTEXT lock): status === 'confirmed' AND start_at > now() → 'active'. Else 'not_active'.
 *  Returns the URL-token hash so the caller can pass it as the CAS guard to rescheduleBooking(). */
export async function resolveRescheduleToken(rawToken: string): Promise<ResolvedRescheduleToken> {
  if (!rawToken || rawToken.length < 8) {
    return { state: "not_active" };
  }

  const hash = await hashToken(rawToken);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, account_id, event_type_id, start_at, end_at, booker_timezone, status,
       event_types!inner(id, name, slug, duration_minutes),
       accounts!inner(name, slug, timezone, owner_email)`,
    )
    .eq("reschedule_token_hash", hash)
    .maybeSingle();

  if (error || !data) return { state: "not_active" };

  if (data.status !== "confirmed" || new Date(data.start_at) <= new Date()) {
    return { state: "not_active" };
  }

  const eventType = Array.isArray(data.event_types) ? data.event_types[0] : data.event_types;
  const account = Array.isArray(data.accounts) ? data.accounts[0] : data.accounts;

  return {
    state: "active",
    tokenHash: hash,
    booking: {
      id: data.id,
      account_id: data.account_id,
      event_type_id: data.event_type_id,
      start_at: data.start_at,
      end_at: data.end_at,
      booker_timezone: data.booker_timezone,
    },
    account: {
      name: account.name,
      slug: account.slug,
      timezone: account.timezone,
      owner_email: account.owner_email ?? null,
    },
    eventType: {
      id: eventType.id,
      name: eventType.name,
      slug: eventType.slug,
      duration_minutes: eventType.duration_minutes,
    },
  };
}
