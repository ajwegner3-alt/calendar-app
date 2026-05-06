"use server";

import { createClient } from "@/lib/supabase/server";
import { getBookingsForPushback, type PushbackBooking } from "./queries";
import { getEndOfDayMinute } from "@/lib/slots";
import {
  computeCascadePreview,
  countMoved,
  type CascadeRow,
} from "@/lib/bookings/pushback";
import { getRemainingDailyQuota } from "@/lib/email-sender/quota-guard";
import { TZDate } from "@date-fns/tz";

// ─── getBookingsForPushbackAction ────────────────────────────────────────────
// Plan 33-01: thin server action wrapper exposing getBookingsForPushback to the
// client dialog. Validates that the caller owns the accountId (ownership check
// on accounts.owner_user_id) before executing the query.

export interface GetBookingsForPushbackResult {
  ok: boolean;
  bookings: PushbackBooking[];
  error?: string;
}

export async function getBookingsForPushbackAction(input: {
  accountId: string;
  date: string; // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
}): Promise<GetBookingsForPushbackResult> {
  const supabase = await createClient();

  // Auth: confirm caller is authenticated.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, bookings: [], error: "Unauthorized" };
  }

  // Ownership: confirm caller owns the supplied accountId (defense-in-depth —
  // RLS also enforces this, but explicit check matches Phase 32 pattern and
  // clarifies the intent).
  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", input.accountId)
    .single();

  if (account?.owner_user_id !== user.id) {
    return { ok: false, bookings: [], error: "Unauthorized" };
  }

  try {
    const bookings = await getBookingsForPushback(supabase, {
      accountId: input.accountId,
      dateIsoYmd: input.date,
      accountTimezone: input.accountTimezone,
    });
    return { ok: true, bookings };
  } catch (e) {
    return {
      ok: false,
      bookings: [],
      error: e instanceof Error ? e.message : "Failed to load bookings",
    };
  }
}

// ─── previewPushbackAction ────────────────────────────────────────────────────
// Plan 33-02: cascade preview with quota pre-flight (EMAIL-22).
//
// Returns the full per-row CascadeRow[] with state badges + old_start_at /
// new_start_at + booker first name + duration, plus remainingQuota and a
// quotaError boolean.
//
// Quota math: movedCount = MOVE + PAST_EOD count (= emails to send on commit).
// With skipOwnerEmail=true on commit, each moved booking sends 1 email (booker
// only), so movedCount === emailsNeeded. Do NOT multiply by 2 (CONTEXT.md lock).

export interface PreviewPushbackInput {
  accountId: string;
  date: string; // YYYY-MM-DD in accountTimezone
  accountTimezone: string;
  anchorId: string;
  delayMinutes: number; // already converted from min/hr in the dialog
  reason?: string;
}

export type PreviewPushbackResult =
  | {
      ok: true;
      rows: CascadeRow[];
      movedCount: number; // MOVE + PAST_EOD count (= emails to send)
      remainingQuota: number;
      quotaError: boolean; // true when movedCount > remainingQuota
    }
  | { ok: false; error: string };

export async function previewPushbackAction(
  input: PreviewPushbackInput,
): Promise<PreviewPushbackResult> {
  const supabase = await createClient();

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Ownership
  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", input.accountId)
    .single();
  if (account?.owner_user_id !== user.id) return { ok: false, error: "Unauthorized" };

  // Validate delay
  if (!Number.isInteger(input.delayMinutes) || input.delayMinutes <= 0) {
    return { ok: false, error: "Delay must be a positive integer" };
  }

  // Fetch bookings for the date
  const bookings = await getBookingsForPushback(supabase, {
    accountId: input.accountId,
    dateIsoYmd: input.date,
    accountTimezone: input.accountTimezone,
  });
  if (bookings.length === 0) {
    return { ok: false, error: "No bookings on this date" };
  }

  // Fetch availability rules + date overrides for endOfDayMinute computation.
  // Both fetched in parallel to minimise round-trips.
  const [{ data: rules }, { data: overrides }] = await Promise.all([
    supabase.from("availability_rules").select("*").eq("account_id", input.accountId),
    supabase
      .from("date_overrides")
      .select("*")
      .eq("account_id", input.accountId)
      .eq("override_date", input.date),
  ]);

  // Day-of-week for the chosen date in accountTimezone.
  // TZDate constructed from a local ISO string returns wall-clock day — DST-safe.
  const localMidnight = new TZDate(`${input.date}T00:00:00`, input.accountTimezone);
  const dow = localMidnight.getDay();

  const endOfDayMinutes = getEndOfDayMinute(
    input.date,
    dow,
    rules ?? [],
    overrides ?? [],
  );

  const rows = computeCascadePreview({
    bookings,
    anchorId: input.anchorId,
    delayMs: input.delayMinutes * 60_000,
    endOfDayMinutes,
    accountTimezone: input.accountTimezone,
  });

  const movedCount = countMoved(rows);
  const remainingQuota = await getRemainingDailyQuota();

  return {
    ok: true,
    rows,
    movedCount,
    remainingQuota,
    quotaError: movedCount > remainingQuota,
  };
}
