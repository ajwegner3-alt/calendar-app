// @vitest-environment node
/**
 * Phase 32 (AVAIL-06, EMAIL-23) — commitInverseOverrideAction tests.
 *
 * Mirrors the closure-based vi.mock pattern from tests/email-quota-refuse.test.ts
 * (Phase 31's clean test file) to avoid the broken __mockSendCalls helpers in
 * the older tests/bookings-*.test.ts files (pre-existing tech debt per
 * STATE.md; not touched here).
 *
 * Coverage:
 *   1. Quota refusal path — needed > remaining returns quotaError, no DB
 *      writes, no cancelBooking calls, no sends.
 *   2. Successful batch — quota OK, override rows written via delete + insert,
 *      cancelBooking called per affected booking with skipOwnerEmail=true and
 *      actor="owner", returns ok with cancelledCount.
 *   3. Race-discovery — re-query returns a booking ID NOT in the preview
 *      affectedBookingIds; that ID is still cancelled (race-safe union).
 *   4. Email failure surface — one cancel fulfills with ok:true and
 *      emailFailed:"send"; surfaces in emailFailures, does not block others.
 *   5. Full-day block path — isFullDayBlock=true writes is_closed=true row
 *      and uses getAllConfirmedBookingsOnDate (full-day window).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Closure-based supabase mock ──────────────────────────────────────────────
// Captures every from(...) call so we can assert no writes happened in the
// quota-refusal path.
type CapturedCall = {
  table: string;
  op: "delete" | "insert";
  payload?: unknown;
  filters: Array<{ col: string; val: unknown }>;
};

let _captured: CapturedCall[] = [];
let _mockAccountIds: string[] | null = ["acct-1"];
let _mockAccountTimezone = "America/Chicago";

function resetSupabaseMock() {
  _captured = [];
  _mockAccountIds = ["acct-1"];
  _mockAccountTimezone = "America/Chicago";
}

vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: async () => {
      const client = {
        rpc: (_name: string) =>
          Promise.resolve({ data: _mockAccountIds, error: null }),
        from: (table: string) => {
          // Fluent builder: tracks deletes / inserts AND services the
          // `accounts` single() lookup + the bookings select used by
          // getAffectedBookings.
          const call: CapturedCall = {
            table,
            op: "insert",
            filters: [],
          };

          const builder = {
            // SELECT branch — used by accounts (resolveOwnerContext) AND
            // by getAffectedBookings on `bookings`.
            select: (_cols: string) => {
              const eq = (col: string, val: unknown) => {
                call.filters.push({ col, val });
                return chain;
              };
              const single = () =>
                Promise.resolve({
                  data:
                    table === "accounts"
                      ? { timezone: _mockAccountTimezone }
                      : null,
                  error: null,
                });
              const gte = (_col: string, _val: unknown) => chain;
              const lt = (_col: string, _val: unknown) => chain;
              const lte = (_col: string, _val: unknown) => chain;
              const order = (_col: string, _opts?: object) => chain;
              const chain = {
                eq,
                gte,
                lt,
                lte,
                order,
                single,
                // bookings query terminator: the call awaits the chain
                // returned from .lt(); make `then` resolve the data array.
                then: (resolve: (v: { data: unknown; error: null }) => void) =>
                  resolve({
                    data:
                      table === "bookings"
                        ? _mockBookingsResponse
                        : [],
                    error: null,
                  }),
              };
              return chain;
            },

            // DELETE branch
            delete: () => {
              call.op = "delete";
              const chain = {
                eq: (col: string, val: unknown) => {
                  call.filters.push({ col, val });
                  // Two .eq() calls then await.
                  if (call.filters.length >= 2) {
                    _captured.push(call);
                  }
                  return chain;
                },
                then: (
                  resolve: (v: { error: null }) => void,
                ) => resolve({ error: null }),
              };
              return chain;
            },

            // INSERT branch
            insert: (payload: unknown) => {
              call.op = "insert";
              call.payload = payload;
              _captured.push(call);
              return Promise.resolve({ error: null });
            },
          };
          return builder;
        },
      };
      return client;
    },
  };
});

// ── Quota-guard mock ─────────────────────────────────────────────────────────
let _mockRemaining = 200;
function setRemaining(n: number) {
  _mockRemaining = n;
}
vi.mock("@/lib/email-sender/quota-guard", () => ({
  getRemainingDailyQuota: vi.fn(() => Promise.resolve(_mockRemaining)),
}));

// ── cancelBooking mock ───────────────────────────────────────────────────────
type CancelArg = {
  bookingId: string;
  actor: string;
  reason?: string;
  appUrl: string;
  ip: string | null;
  skipOwnerEmail?: boolean;
};
type CancelReturn =
  | { ok: true; emailFailed?: "quota" | "send" }
  | { ok: false; reason: "not_active" | "db_error"; error?: string };

let _cancelCalls: CancelArg[] = [];
let _cancelImpl: (args: CancelArg) => Promise<CancelReturn> = async () => ({
  ok: true,
});
function setCancelImpl(fn: (args: CancelArg) => Promise<CancelReturn>) {
  _cancelImpl = fn;
}
function resetCancel() {
  _cancelCalls = [];
  _cancelImpl = async () => ({ ok: true });
}

vi.mock("@/lib/bookings/cancel", () => ({
  cancelBooking: vi.fn(async (args: CancelArg) => {
    _cancelCalls.push(args);
    return _cancelImpl(args);
  }),
}));

// ── next/cache mock — revalidatePath is a no-op in tests ─────────────────────
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ── getAffectedBookings mock — controlled per test ───────────────────────────
// Mocking the queries module directly lets us bypass the bookings-table
// fluent-builder complexity for race-safety tests. The successful-batch
// test uses the bookings response captured above for additional confidence.
let _mockBookingsResponse: unknown[] = [];
let _mockAffectedReturn: Array<{
  id: string;
  start_at: string;
  end_at: string;
  booker_name: string;
  event_type_name: string;
}> = [];

vi.mock("@/app/(shell)/app/availability/_lib/queries", () => ({
  getAffectedBookings: vi.fn(async () => _mockAffectedReturn),
}));

// Import AFTER all mocks are registered. Use a relative path to avoid the
// @/lib/email-sender alias in vitest.config.ts (which maps to a mock that
// does not export quota-guard symbols — same pattern as tests/quota-guard
// and tests/email-quota-refuse).
import { commitInverseOverrideAction } from "../app/(shell)/app/availability/_lib/actions-batch-cancel";
import { cancelBooking } from "../lib/bookings/cancel";
import { getRemainingDailyQuota } from "../lib/email-sender/quota-guard";

describe("commitInverseOverrideAction — quota refusal", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns quotaError when needed > remaining and writes nothing, sends nothing", async () => {
    setRemaining(2);

    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
      ],
    });

    expect(result).toEqual({
      ok: false,
      quotaError: true,
      needed: 5,
      remaining: 2,
    });
    // No cancels.
    expect(cancelBooking).not.toHaveBeenCalled();
    expect(_cancelCalls.length).toBe(0);
    // No date_overrides writes (delete or insert) captured.
    const overrideOps = _captured.filter(
      (c) => c.table === "date_overrides",
    );
    expect(overrideOps).toEqual([]);
    // Quota check still ran exactly once.
    expect(getRemainingDailyQuota).toHaveBeenCalledTimes(1);
  });
});

describe("commitInverseOverrideAction — successful batch", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("writes override rows and calls cancelBooking with skipOwnerEmail=true per booking", async () => {
    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      reason: "Owner away for the morning",
    });

    expect(result).toEqual({
      ok: true,
      cancelledCount: 2,
      emailFailures: [],
    });
    // 2 cancelBooking calls, both with skipOwnerEmail=true and actor=owner.
    expect(cancelBooking).toHaveBeenCalledTimes(2);
    for (const call of _cancelCalls) {
      expect(call.skipOwnerEmail).toBe(true);
      expect(call.actor).toBe("owner");
      expect(call.reason).toBe("Owner away for the morning");
      expect(call.ip).toBeNull();
    }
    // date_overrides write happened: one delete + one insert.
    const overrideOps = _captured.filter(
      (c) => c.table === "date_overrides",
    );
    const ops = overrideOps.map((c) => c.op).sort();
    expect(ops).toEqual(["delete", "insert"]);
    // Inserted row has is_closed=false and matches the window.
    const insertOp = overrideOps.find((c) => c.op === "insert");
    expect(insertOp).toBeDefined();
    const insertedRows = Array.isArray(insertOp!.payload)
      ? (insertOp!.payload as Array<Record<string, unknown>>)
      : [insertOp!.payload as Record<string, unknown>];
    expect(insertedRows[0].is_closed).toBe(false);
    expect(insertedRows[0].start_minute).toBe(600);
    expect(insertedRows[0].end_minute).toBe(660);
  });

  it("falls back to default reason when none supplied", async () => {
    await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(_cancelCalls[0].reason).toBe(
      "Owner marked this time as unavailable",
    );
  });
});

describe("commitInverseOverrideAction — race-safe re-query", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("includes booking IDs discovered post-write in the cancel batch (union)", async () => {
    // Preview saw 1 booking; race-safe re-query discovers a second.
    _mockAffectedReturn = [
      {
        id: "11111111-1111-4111-8111-111111111111", // overlaps with preview
        start_at: "2026-06-01T15:00:00.000Z",
        end_at: "2026-06-01T15:30:00.000Z",
        booker_name: "Alice",
        event_type_name: "Consult",
      },
      {
        id: "99999999-9999-4999-8999-999999999999", // race-discovered
        start_at: "2026-06-01T15:30:00.000Z",
        end_at: "2026-06-01T16:00:00.000Z",
        booker_name: "Bob",
        event_type_name: "Consult",
      },
    ];

    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cancelledCount).toBe(2);
    }
    expect(cancelBooking).toHaveBeenCalledTimes(2);
    const ids = _cancelCalls.map((c) => c.bookingId).sort();
    expect(ids).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "99999999-9999-4999-8999-999999999999",
    ]);
  });
});

describe("commitInverseOverrideAction — email failure surface", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("surfaces email failures in emailFailures without blocking other cancels", async () => {
    setCancelImpl(async (args) => {
      if (args.bookingId === "22222222-2222-4222-8222-222222222222") {
        return { ok: true, emailFailed: "send" };
      }
      return { ok: true };
    });

    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // All three counted as cancelled (DB row flipped); the failure is
      // ONLY about the email leg, not the cancel itself.
      expect(result.cancelledCount).toBe(3);
      expect(result.emailFailures).toHaveLength(1);
      expect(result.emailFailures[0]).toEqual({
        bookingId: "22222222-2222-4222-8222-222222222222",
        error: "email-send",
      });
    }
  });

  it("surfaces rejected promises in emailFailures", async () => {
    setCancelImpl(async (args) => {
      if (args.bookingId === "22222222-2222-4222-8222-222222222222") {
        throw new Error("transient-db-glitch");
      }
      return { ok: true };
    });

    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 660 }],
      affectedBookingIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Only the successful cancel counts; the rejected one is in failures.
      expect(result.cancelledCount).toBe(1);
      expect(result.emailFailures).toHaveLength(1);
      expect(result.emailFailures[0].bookingId).toBe(
        "22222222-2222-4222-8222-222222222222",
      );
      expect(result.emailFailures[0].error).toContain("transient-db-glitch");
    }
  });
});

describe("commitInverseOverrideAction — full-day block path", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("writes is_closed=true row and cancels every confirmed booking on the date", async () => {
    _mockAffectedReturn = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        start_at: "2026-06-01T15:00:00.000Z",
        end_at: "2026-06-01T15:30:00.000Z",
        booker_name: "Alice",
        event_type_name: "Consult",
      },
    ];

    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: true,
      unavailableWindows: [],
      affectedBookingIds: ["11111111-1111-4111-8111-111111111111"],
    });

    expect(result.ok).toBe(true);
    // Override insert is a SINGLE row (not array) with is_closed=true.
    const insertOp = _captured.find(
      (c) => c.table === "date_overrides" && c.op === "insert",
    );
    expect(insertOp).toBeDefined();
    expect(insertOp!.payload).toMatchObject({
      is_closed: true,
      start_minute: null,
      end_minute: null,
    });
    expect(cancelBooking).toHaveBeenCalledTimes(1);
  });
});

describe("commitInverseOverrideAction — input validation", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetSupabaseMock();
    resetCancel();
    _mockAffectedReturn = [];
    setRemaining(200);
    vi.mocked(cancelBooking).mockClear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("rejects overlapping unavailable windows with a formError", async () => {
    const result = await commitInverseOverrideAction({
      override_date: "2026-06-01",
      isFullDayBlock: false,
      unavailableWindows: [
        { start_minute: 600, end_minute: 720 },
        { start_minute: 660, end_minute: 780 }, // overlaps
      ],
      affectedBookingIds: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok && "formError" in result) {
      expect(result.formError).toMatch(/overlap/i);
    } else {
      throw new Error("expected formError result");
    }
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it("rejects malformed override_date with a formError", async () => {
    const result = await commitInverseOverrideAction({
      override_date: "06/01/2026",
      isFullDayBlock: false,
      unavailableWindows: [{ start_minute: 600, end_minute: 720 }],
      affectedBookingIds: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok && "formError" in result) {
      expect(result.formError).toBeTruthy();
    } else {
      throw new Error("expected formError result");
    }
  });
});
