import { adminClient } from "./supabase";
import { generateBookingTokens } from "@/lib/bookings/tokens";

export interface BookingFixture {
  bookingId: string;
  rawCancelToken: string;
  rawRescheduleToken: string;
  cancelHash: string;
  rescheduleHash: string;
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC
  bookerEmail: string;
}

export interface CreateConfirmedBookingArgs {
  accountId: string;
  eventTypeId: string;
  /** Minutes from now until start_at. Use negative numbers to insert a
   *  past-appointment booking for the "appointment passed" test. */
  minutesAhead: number;
  /** Slot duration; defaults to 30 minutes (matches the seeded test event_type) */
  durationMinutes?: number;
  /** Override the booker email — useful when the same test inserts multiple
   *  bookings and wants distinguishable emails in the spy. */
  bookerEmail?: string;
  /** Override the booker name (default "Test Booker") */
  bookerName?: string;
  /** Override answers (default {}) */
  answers?: Record<string, string>;
}

/**
 * Insert a confirmed booking via adminClient() with KNOWN raw tokens.
 *
 * We deliberately bypass POST /api/bookings here because:
 *  - The integration tests need to control start_at precisely (including past
 *    times for the "appointment passed" invalidation test).
 *  - Tests need to know the raw cancel + reschedule tokens upfront — the
 *    production /api/bookings path only stores hashes and emails the raw values
 *    out (which we'd have to scrape the email mock for, adding indirection).
 *  - Skipping the Turnstile dance keeps fixtures fast and deterministic.
 *
 * Returns the inserted bookingId, BOTH raw tokens, BOTH hashes, and the times.
 * Caller is responsible for cleanup — push bookingId into the suite's
 * `insertedBookingIds` array so afterAll() can delete it.
 *
 * Uses TEST_ACCOUNT_SLUG ('nsi-test') from existing helpers/supabase.ts —
 * NEVER touches the production 'nsi' account (Andrew CLAUDE.md isolation rule).
 * The caller passes accountId + eventTypeId obtained from getOrCreateTestAccount()
 * + getOrCreateTestEventType() in the suite's beforeAll.
 */
export async function createConfirmedBooking(
  args: CreateConfirmedBookingArgs,
): Promise<BookingFixture> {
  const admin = adminClient();
  const tokens = await generateBookingTokens();

  const startMs = Date.now() + args.minutesAhead * 60 * 1000;
  const startAt = new Date(startMs).toISOString();
  const endAt = new Date(
    startMs + (args.durationMinutes ?? 30) * 60 * 1000,
  ).toISOString();

  const bookerEmail =
    args.bookerEmail ??
    `test+${Math.random().toString(36).slice(2, 8)}@example.com`;

  const { data, error } = await admin
    .from("bookings")
    .insert({
      account_id: args.accountId,
      event_type_id: args.eventTypeId,
      start_at: startAt,
      end_at: endAt,
      booker_name: args.bookerName ?? "Test Booker",
      booker_email: bookerEmail,
      booker_phone: "555-000-0000",
      booker_timezone: "America/Chicago",
      answers: args.answers ?? {},
      cancel_token_hash: tokens.hashCancel,
      reschedule_token_hash: tokens.hashReschedule,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `createConfirmedBooking insert failed: ${error?.message ?? "no data"}`,
    );
  }

  return {
    bookingId: data.id,
    rawCancelToken: tokens.rawCancel,
    rawRescheduleToken: tokens.rawReschedule,
    cancelHash: tokens.hashCancel,
    rescheduleHash: tokens.hashReschedule,
    startAt,
    endAt,
    bookerEmail,
  };
}
