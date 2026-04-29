// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan 12-04a Task 1 — loadMonthBookings unit tests.
 *
 * Uses structural mocks (vi.mock) to stub @/lib/supabase/server.
 * No real DB connections. Validates:
 *   1. Empty claims → [] without any DB call
 *   2. No accounts row → [] without bookings DB call
 *   3. Happy path → returns mapped MonthBooking array with correct shape
 *   4. Status filter is 'confirmed' only
 *   5. Month range uses startOfMonth..endOfMonth
 */

// --- Mock @/lib/supabase/server -----------------------------------------
// We need to set up the mock before importing the module under test.

const mockGetClaims = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockFrom,
  })),
}));

// We also need to stub `server-only` — handled globally by vitest.config.ts alias.

import { loadMonthBookings } from "@/app/(shell)/app/_lib/load-month-bookings";

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/** Build a fluent Supabase query chain that resolves to `finalResult`. */
function makeChain(finalResult: { data: unknown; error?: unknown }) {
  const chain: any = {};
  // Each method returns `chain` to allow further chaining.
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(async () => finalResult);
  // For the accounts SELECT (terminates at .limit()):
  chain.limitResolve = vi.fn(async () => finalResult);
  return chain;
}

describe("loadMonthBookings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when getClaims returns no claims (unauthenticated)", async () => {
    mockGetClaims.mockResolvedValue({ data: null });
    // mockFrom should never be called in this case
    mockFrom.mockReturnValue(makeChain({ data: null }));

    const result = await loadMonthBookings(new Date("2026-04-01"));

    expect(result).toEqual([]);
    // Confirm no DB query was made
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns [] when accounts query returns empty array", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    // accounts query chain
    const accountsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
    };
    mockFrom.mockReturnValue(accountsChain);

    const result = await loadMonthBookings(new Date("2026-04-01"));

    expect(result).toEqual([]);
    // Accounts was queried, but bookings should NOT be
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("accounts");
  });

  it("queries bookings with correct filters and returns mapped records", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    // Mock accounts query
    const accountsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: ACCOUNT_ID }],
      }),
    };

    const fakeBooking = {
      id: "booking-1",
      start_at: "2026-04-15T14:00:00Z",
      booker_name: "Alice",
      booker_email: "alice@example.com",
      status: "confirmed",
      reschedule_token_hash: "abc123",
      event_types: { name: "Consultation", account_id: ACCOUNT_ID },
    };

    // Mock bookings query chain
    const bookingsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [fakeBooking] }),
    };

    // First call = accounts, second call = bookings
    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingsChain);

    const month = new Date("2026-04-15T00:00:00Z");
    const result = await loadMonthBookings(month);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "booking-1",
      start_at: "2026-04-15T14:00:00Z",
      booker_name: "Alice",
      booker_email: "alice@example.com",
      status: "confirmed",
      reschedule_token_hash: "abc123",
      event_type: { name: "Consultation" },
    });
  });

  it("filters bookings by status=confirmed", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }] }),
    };

    const eqSpy = vi.fn().mockReturnThis();
    const bookingsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: eqSpy,
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    };

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingsChain);

    await loadMonthBookings(new Date("2026-04-01"));

    // One of the eq() calls must be status='confirmed'
    const eqCalls = eqSpy.mock.calls;
    expect(eqCalls).toEqual(
      expect.arrayContaining([["status", "confirmed"]]),
    );
  });

  it("uses startOfMonth..endOfMonth for the date range filter", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }] }),
    };

    const gteSpy = vi.fn().mockReturnThis();
    const lteSpy = vi.fn().mockReturnThis();
    const bookingsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: gteSpy,
      lte: lteSpy,
      order: vi.fn().mockResolvedValue({ data: [] }),
    };

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingsChain);

    const month = new Date("2026-04-15T00:00:00Z");
    await loadMonthBookings(month);

    // gte should be called with start_at, <april 1 ISO string>
    expect(gteSpy).toHaveBeenCalledTimes(1);
    const gteArgs = gteSpy.mock.calls[0];
    expect(gteArgs[0]).toBe("start_at");
    // April 1st 2026 start
    expect(gteArgs[1]).toMatch(/^2026-04-01/);

    expect(lteSpy).toHaveBeenCalledTimes(1);
    const lteArgs = lteSpy.mock.calls[0];
    expect(lteArgs[0]).toBe("start_at");
    // endOfMonth returns end of April; verify it's in April or May 1 00:00 UTC
    // (endOfMonth uses local time, which can spill to May 1 UTC when TZ offset > 0)
    const lteDate = new Date(lteArgs[1] as string);
    const gteDate = new Date(gteSpy.mock.calls[0][1] as string);
    // lte must be after gte
    expect(lteDate.getTime()).toBeGreaterThan(gteDate.getTime());
    // lte must be before May 2nd UTC (regardless of timezone offset)
    expect(lteDate.getTime()).toBeLessThan(new Date("2026-05-02T00:00:00Z").getTime());
  });

  it("returns empty array (not throws) when bookings query returns null data", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: ACCOUNT_ID }] }),
    };

    const bookingsChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null }),
    };

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingsChain);

    const result = await loadMonthBookings(new Date("2026-04-01"));
    expect(result).toEqual([]);
  });
});
