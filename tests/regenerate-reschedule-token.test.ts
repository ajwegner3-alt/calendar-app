// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Plan 12-04a Task 1 — regenerateRescheduleTokenAction unit tests.
 *
 * Mocks:
 *   - @/lib/supabase/server  → structural mock (getClaims + from chain)
 *   - @/lib/bookings/tokens  → deterministic hashToken stub
 *   - next/cache             → revalidatePath spy
 *
 * Coverage:
 *   (a) Unauthenticated → { ok: false, error: "unauthenticated" }
 *   (b) No account row → { ok: false, error: "no account" }
 *   (c) Cross-account booking (not found) → { ok: false, error: "not found" }
 *   (d) Happy path → { ok: true, rawToken }, new hash stored, revalidatePath called
 *   (e) DB update error → { ok: false, error: "db_error" }
 *   (f) Invalidation invariant: old hash ≠ new hash (rotation)
 */

// --- Mocks ----------------------------------------------------------------
// vi.mock factories are hoisted to the top of the file, so variables they
// reference must be declared with vi.hoisted() to avoid TDZ errors.

const { mockGetClaims, mockFrom, mockRevalidatePath } = vi.hoisted(() => ({
  mockGetClaims: vi.fn(),
  mockFrom: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockFrom,
  })),
}));

// Deterministic hash stub: returns "hashed:<input>" so we can verify the hash
// stored differs from a fake "old" hash in tests.
vi.mock("@/lib/bookings/tokens", () => ({
  hashToken: vi.fn(async (raw: string) => `hashed:${raw}`),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { regenerateRescheduleTokenAction } from "@/app/(shell)/app/_lib/regenerate-reschedule-token";

const ACCOUNT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BOOKING_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

/** Builds a mock accounts chain terminating with `.limit()` */
function makeAccountsChain(result: { data: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

/** Builds a mock bookings chain terminating with `.maybeSingle()` */
function makeBookingChain(result: { data: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

/** Builds a mock update chain terminating with `.eq()` */
function makeUpdateChain(result: { error: unknown }) {
  const eqSpy = vi.fn().mockResolvedValue(result);
  const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
  return { updateSpy, eqSpy };
}

describe("regenerateRescheduleTokenAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) returns unauthenticated when getClaims returns no claims", async () => {
    mockGetClaims.mockResolvedValue({ data: null });

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("(b) returns no account when accounts query is empty", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    mockFrom.mockReturnValue(makeAccountsChain({ data: [] }));

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result).toEqual({ ok: false, error: "no account" });
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("accounts");
  });

  it("(c) returns not found when booking doesn't belong to account", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain = makeAccountsChain({ data: [{ id: ACCOUNT_ID }] });
    const bookingChain = makeBookingChain({ data: null });

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain);

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result).toEqual({ ok: false, error: "not found" });
  });

  it("(d) happy path: returns { ok: true, rawToken }, stores new hash, revalidates", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain = makeAccountsChain({ data: [{ id: ACCOUNT_ID }] });
    const bookingChain = makeBookingChain({
      data: { id: BOOKING_ID, event_types: { account_id: ACCOUNT_ID } },
    });
    const { updateSpy, eqSpy } = makeUpdateChain({ error: null });

    const fromChainWithUpdate = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: BOOKING_ID, event_types: { account_id: ACCOUNT_ID } },
      }),
      update: updateSpy,
    };

    // First: accounts, Second: booking SELECT (for ownership check), Third: booking UPDATE
    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce({ update: updateSpy });

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result.ok).toBe(true);
    expect(result.rawToken).toBeDefined();
    expect(typeof result.rawToken).toBe("string");
    expect(result.error).toBeUndefined();

    // revalidatePath should have been called
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app");

    // The update should have been called with a hash
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updateArg = updateSpy.mock.calls[0][0] as {
      reschedule_token_hash: string;
    };
    expect(updateArg.reschedule_token_hash).toBeDefined();
    // Hash should be "hashed:<rawToken>" per our stub
    expect(updateArg.reschedule_token_hash).toMatch(/^hashed:/);
  });

  it("(e) returns db_error when update fails", async () => {
    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain = makeAccountsChain({ data: [{ id: ACCOUNT_ID }] });
    const bookingChain = makeBookingChain({
      data: { id: BOOKING_ID, event_types: { account_id: ACCOUNT_ID } },
    });
    const { updateSpy } = makeUpdateChain({
      error: { message: "unique constraint" },
    });

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce({ update: updateSpy });

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result).toEqual({ ok: false, error: "db_error" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("(f) invalidation invariant: new hash differs from a previously stored hash", async () => {
    // This test verifies that calling the action with a known "old" hash
    // produces a NEW hash (since rawToken is random → hash is random).
    // Our stub: hashToken(raw) = "hashed:<raw>", and raw = crypto.randomUUID()
    // which is always unique → new hash will differ from any pre-stored value.

    const OLD_HASH = "old-hash-from-confirmation-email";

    mockGetClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
    });

    const accountsChain = makeAccountsChain({ data: [{ id: ACCOUNT_ID }] });
    const bookingChain = makeBookingChain({
      data: {
        id: BOOKING_ID,
        reschedule_token_hash: OLD_HASH, // the "old" hash
        event_types: { account_id: ACCOUNT_ID },
      },
    });
    const { updateSpy } = makeUpdateChain({ error: null });

    mockFrom
      .mockReturnValueOnce(accountsChain)
      .mockReturnValueOnce(bookingChain)
      .mockReturnValueOnce({ update: updateSpy });

    const result = await regenerateRescheduleTokenAction(BOOKING_ID);

    expect(result.ok).toBe(true);
    const updateArg = updateSpy.mock.calls[0][0] as {
      reschedule_token_hash: string;
    };
    // New hash must differ from the old one (rotation)
    expect(updateArg.reschedule_token_hash).not.toBe(OLD_HASH);
    // And the new hash should be "hashed:<rawToken>" per our deterministic stub
    // (our stub: hashToken(raw) = "hashed:<raw>")
    const expectedHash = `hashed:${result.rawToken!}`;
    expect(updateArg.reschedule_token_hash).toBe(expectedHash);
  });
});
