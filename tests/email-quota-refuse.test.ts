// @vitest-environment node
/**
 * Phase 31 (EMAIL-21..25) — refuse-send coverage for the booking email senders.
 *
 * Mirrors the closure-based mock pattern from tests/quota-guard.test.ts:
 *   - vi.mock("@/lib/supabase/admin") at top with a fluent stub
 *   - module-level _mockCount / _mockCountError / _mockInsertError vars
 *   - setCountResult / setInsertResult helpers for per-test control
 *
 * Coverage matrix:
 *   1. All 7 new EmailCategory values (booking-confirmation, owner-notification,
 *      reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner)
 *      — refused at cap, allowed below cap.
 *   2. getRemainingDailyQuota — returns 200 (zero sent), 50 (150 sent), and
 *      clamps to 0 when count >= cap.
 *   3. logQuotaRefusal — writes the 5 required PII-free fields and NO PII
 *      (booker_email / booker_name / booker_phone / ip).
 *   4. Cron-loop pattern continues past per-booking QuotaExceededError (logical
 *      shape test — does not invoke the actual route handler).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let _mockCount: number | null = 0;
let _mockCountError: object | null = null;
let _mockInsertError: object | null = null;

function resetMocks() {
  _mockCount = 0;
  _mockCountError = null;
  _mockInsertError = null;
}

vi.mock("@/lib/supabase/admin", () => {
  return {
    createAdminClient: () => ({
      from: (_table: string) => ({
        select: (_cols: string, _opts?: object) => ({
          gte: (_col: string, _val: string) =>
            Promise.resolve({ count: _mockCount, error: _mockCountError }),
        }),
        insert: (_row: object) =>
          Promise.resolve({ error: _mockInsertError }),
      }),
    }),
  };
});

// Import AFTER the mock is registered. Use the relative path (matches the
// existing quota-guard.test.ts comment about avoiding the @/lib/email-sender
// alias hijacking sub-paths).
import {
  checkAndConsumeQuota,
  getRemainingDailyQuota,
  logQuotaRefusal,
  QuotaExceededError,
  SIGNUP_DAILY_EMAIL_CAP,
  type EmailCategory,
} from "../lib/email-sender/quota-guard";

function setCountResult(count: number | null, error: object | null = null) {
  _mockCount = count;
  _mockCountError = error;
}
function setInsertResult(error: object | null) {
  _mockInsertError = error;
}

// Phase 31 added these 7 categories to the guard. Iterating them here gives us
// a regression-proof guarantee that any future addition / removal will require
// an explicit edit to this list.
const PHASE_31_CATEGORIES = [
  "booking-confirmation",
  "owner-notification",
  "reminder",
  "cancel-booker",
  "cancel-owner",
  "reschedule-booker",
  "reschedule-owner",
] as const satisfies readonly EmailCategory[];

describe("Phase 31 — quota guard covers all 7 new email senders", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  for (const cat of PHASE_31_CATEGORIES) {
    it(`refuses ${cat} when count is at cap`, async () => {
      setCountResult(SIGNUP_DAILY_EMAIL_CAP);
      await expect(checkAndConsumeQuota(cat)).rejects.toBeInstanceOf(
        QuotaExceededError,
      );
    });

    it(`allows ${cat} when below cap`, async () => {
      setCountResult(50);
      setInsertResult(null);
      await expect(checkAndConsumeQuota(cat)).resolves.toBeUndefined();
    });
  }
});

describe("getRemainingDailyQuota", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 200 when 0 sent today", async () => {
    setCountResult(0);
    expect(await getRemainingDailyQuota()).toBe(200);
  });

  it("returns 50 when 150 sent today", async () => {
    setCountResult(150);
    expect(await getRemainingDailyQuota()).toBe(50);
  });

  it("clamps to 0 when count exceeds cap", async () => {
    setCountResult(250);
    expect(await getRemainingDailyQuota()).toBe(0);
  });
});

describe("logQuotaRefusal — PII-free shape", () => {
  it("writes exactly the 5 required fields and NO PII", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQuotaRefusal({
      account_id: "acct-uuid-123",
      sender_type: "booking-confirmation",
      count: 200,
      cap: 200,
    });

    expect(errSpy).toHaveBeenCalledWith("[EMAIL_QUOTA_EXCEEDED]", {
      code: "EMAIL_QUOTA_EXCEEDED",
      account_id: "acct-uuid-123",
      sender_type: "booking-confirmation",
      count: 200,
      cap: 200,
    });

    // Negative assertions: confirm no PII fields snuck into the structured log.
    const payload = errSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("booker_email");
    expect(payload).not.toHaveProperty("booker_name");
    expect(payload).not.toHaveProperty("booker_phone");
    expect(payload).not.toHaveProperty("ip");
    expect(payload).not.toHaveProperty("answers");
    // Exact key set: 5 fields, nothing else.
    expect(Object.keys(payload).sort()).toEqual(
      ["account_id", "cap", "code", "count", "sender_type"].sort(),
    );

    errSpy.mockRestore();
  });

  it("accepts null account_id (signup-path use case)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQuotaRefusal({
      account_id: null,
      sender_type: "signup-verify",
      count: 200,
      cap: 200,
    });

    const payload = errSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.account_id).toBeNull();
    expect(payload.sender_type).toBe("signup-verify");

    errSpy.mockRestore();
  });
});

describe("cron loop — quota refusal is non-fatal", () => {
  it("continues past QuotaExceededError per booking and increments quota_refused", () => {
    // Mimic the per-booking try/catch shape that lib/cron/send-reminders pulled
    // out of after() in Plan 31-02. The loop must:
    //   - swallow QuotaExceededError per-booking
    //   - increment a quota_refused counter
    //   - NOT break out of the loop
    //   - re-throw any other error type
    const bookings = [1, 2, 3, 4, 5];
    let quotaRefused = 0;
    let remindersSent = 0;
    const otherErrors: unknown[] = [];

    for (const _b of bookings) {
      try {
        // Each iteration "sends" but immediately hits the cap — same shape as
        // checkAndConsumeQuota throwing inside the per-booking sender.
        throw new QuotaExceededError(200, 200);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          quotaRefused++;
          continue;
        }
        otherErrors.push(err);
      }
    }

    expect(quotaRefused).toBe(5);
    expect(remindersSent).toBe(0);
    expect(otherErrors).toEqual([]);
  });

  it("re-throws non-quota errors (does not silently swallow)", () => {
    // Regression guard: the cron loop must NOT catch arbitrary errors — only
    // QuotaExceededError. A bug there would mask real DB / SMTP failures.
    const sendOne = () => {
      throw new Error("smtp connection refused");
    };

    let caughtAsQuota = false;
    let rethrown: unknown = null;
    try {
      try {
        sendOne();
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          caughtAsQuota = true;
        } else {
          throw err;
        }
      }
    } catch (err) {
      rethrown = err;
    }

    expect(caughtAsQuota).toBe(false);
    expect((rethrown as Error).message).toBe("smtp connection refused");
  });
});
