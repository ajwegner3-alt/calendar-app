"use server";

import { createClient } from "@/lib/supabase/server";
import { getBookingsForPushback, type PushbackBooking } from "./queries";

// ─── getBookingsForPushbackAction ────────────────────────────────────────────
// Plan 33-01: thin server action wrapper exposing getBookingsForPushback to the
// client dialog. Validates that the caller owns the accountId (ownership check
// on accounts.owner_user_id) before executing the query.
//
// Plans 33-02 / 33-03 / 33-04 will add previewPushbackAction,
// commitPushbackAction, and retryPushbackEmailAction to this same file.

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
