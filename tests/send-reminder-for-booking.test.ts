// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan 12-04a Task 2 — sendReminderForBookingAction unit tests.
 *
 * Mocks:
 *   - @/lib/supabase/server         → structural mock (getClaims + from chain)
 *   - @/lib/bookings/tokens         → deterministic hashToken stub
 *   - @/lib/email/send-reminder-booker → spy to verify call args
 *   - next/cache                    → revalidatePath no-op (not called by this action)
 *
 * Coverage:
 *   (a) Unauthenticated → { error: "Not signed in." }
 *   (b) Cross-account booking (ownership fail) → { error: "Booking not found." }
 *   (c) Cancelled booking → { error: "Reminder is only available for confirmed bookings." }
 *   (d) Success path → { ok: true }, both hashes updated, sendReminderBooker called with raw tokens
 *   (e) sendReminderBooker throws → { error: "Reminder send failed. Please try again." }
 */

// --- Mocks (vi.hoisted to avoid TDZ errors with factory hoisting) ---------

const { mockGetClaims, mockFrom, mockSendReminderBooker, mockHashToken } =
  vi.hoisted(() => ({
    mockGetClaims: vi.fn(),
    mockFrom: vi.fn(),
    mockSendReminderBooker: vi.fn(),
    mockHashToken: vi.fn(async (raw: string) => `hashed:${raw}`),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockFrom,
  })),
}));

vi.mock("@/lib/bookings/tokens", () => ({
  hashToken: mockHashToken,
}));

vi.mock("@/lib/email/send-reminder-booker", () => ({
  sendReminderBooker: mockSendReminderBooker,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { sendReminderForBookingAction } from "@/app/(shell)/app/bookings/[id]/_lib/actions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BOOKING_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

/** Build a complete accounts row for mock returns */
function makeAccountRow() {
  return {
    id: ACCOUNT_ID,
    slug: "test-account",
    name: "Test Account",
    logo_url: null,
    brand_primary: "#0A2540",
    owner_email: "owner@example.com",
    reminder_include_custom_answers: true,
    reminder_include_location: true,
    reminder_include_lifecycle_links: true,
  };
}

/** Build a confirmed booking row for mock returns */
function makeBookingRow(overrides: Partial<{ status: string }> = {}) {
  return {
    id: BOOKING_ID,
    start_at: "2026-04-30T14:00:00Z",
    end_at: "2026-04-30T15:00:00Z",
    booker_name: "Alice",
    booker_email: "alice@example.com",
    booker_timezone: "America/Chicago",
    answers: {},
    status: overrides.status ?? "confirmed",
    event_types: {
      name: "Consultation",
      duration_minutes: 60,
      location: "Zoom",
      account_id: ACCOUNT_ID,
    },
  };
}

/** Build accounts query chain (terminates at .limit()) */
function makeAccountsChain(data: unknown[] | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data }),
  };
}

/** Build bookings query chain (terminates at .maybeSingle()) */
function makeBookingChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
}

/** Build update chain (terminates at .eq()) */
function makeUpdateChain(error: unknown = null) {
  const eqSpy = vi.fn().mockResolvedValue({ error });
  const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
  return { updateSpy, eqSpy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendReminderForBookingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: sendReminderBooker succeeds
    mockSendReminderBooker.mockResolvedValue(undefined);
  });

  it("(a) returns 'Not signed in.' when getClaims returns no claims", async () => {
    mockGetClaims.mockResolvedValue({ data: null });

    const result = await sendReminderForBookingAction(BOOKING_ID);

    expect(result).toEqual({ error: "Not signed in." });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSendReminderBooker).not.toHaveBeenCalled();
  });

  it("(b) returns 'Booking not found.' when booking is not in this account", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: USER_ID } } });

    const accountsChain = makeAccountsChain([makeAccountRow()]);
    // Booking query returns null (cross-account guard)
    const bookingChain = makeBookingChain(null);

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain);

    const result = await sendReminderForBookingAction(BOOKING_ID);

    expect(result).toEqual({ error: "Booking not found." });
    expect(mockSendReminderBooker).not.toHaveBeenCalled();
  });

  it("(c) returns error for non-confirmed bookings (cancelled)", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: USER_ID } } });

    const accountsChain = makeAccountsChain([makeAccountRow()]);
    const bookingChain = makeBookingChain(makeBookingRow({ status: "cancelled" }));

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain);

    const result = await sendReminderForBookingAction(BOOKING_ID);

    expect(result).toEqual({
      error: "Reminder is only available for confirmed bookings.",
    });
    expect(mockSendReminderBooker).not.toHaveBeenCalled();
  });

  it("(d) success: returns { ok: true }, updates both hashes, calls sendReminderBooker with raw tokens", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: USER_ID } } });

    const accountsChain = makeAccountsChain([makeAccountRow()]);
    const bookingChain = makeBookingChain(makeBookingRow());
    const { updateSpy, eqSpy } = makeUpdateChain(null);

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce({ update: updateSpy });

    const result = await sendReminderForBookingAction(BOOKING_ID);

    expect(result).toEqual({ ok: true });

    // Both hashes were stored
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateArg = updateSpy.mock.calls[0][0] as {
      cancel_token_hash: string;
      reschedule_token_hash: string;
    };
    expect(updateArg.cancel_token_hash).toMatch(/^hashed:/);
    expect(updateArg.reschedule_token_hash).toMatch(/^hashed:/);
    // The two hashes are different (each derived from a unique UUID)
    expect(updateArg.cancel_token_hash).not.toBe(
      updateArg.reschedule_token_hash,
    );

    // sendReminderBooker was called once with raw tokens (not hashes)
    expect(mockSendReminderBooker).toHaveBeenCalledTimes(1);
    const reminderArgs = mockSendReminderBooker.mock.calls[0][0] as {
      rawCancelToken: string;
      rawRescheduleToken: string;
      booking: { booker_email: string };
      account: { slug: string };
    };
    // rawCancelToken should be a UUID (not prefixed with "hashed:")
    expect(reminderArgs.rawCancelToken).not.toMatch(/^hashed:/);
    expect(reminderArgs.rawRescheduleToken).not.toMatch(/^hashed:/);
    expect(reminderArgs.rawCancelToken).not.toBe(reminderArgs.rawRescheduleToken);
    // Sanity: correct booking + account passed
    expect(reminderArgs.booking.booker_email).toBe("alice@example.com");
    expect(reminderArgs.account.slug).toBe("test-account");

    // Hash stored = hashToken(rawToken) = "hashed:<rawToken>"
    expect(updateArg.cancel_token_hash).toBe(
      `hashed:${reminderArgs.rawCancelToken}`,
    );
    expect(updateArg.reschedule_token_hash).toBe(
      `hashed:${reminderArgs.rawRescheduleToken}`,
    );
  });

  it("(e) returns 'Reminder send failed.' when sendReminderBooker throws", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: USER_ID } } });

    const accountsChain = makeAccountsChain([makeAccountRow()]);
    const bookingChain = makeBookingChain(makeBookingRow());
    const { updateSpy } = makeUpdateChain(null);

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce({ update: updateSpy });

    mockSendReminderBooker.mockRejectedValue(new Error("SMTP connection refused"));

    const result = await sendReminderForBookingAction(BOOKING_ID);

    expect(result).toEqual({ error: "Reminder send failed. Please try again." });
  });
});
