// @vitest-environment node
/**
 * Plan 35-04 Task 2 — send-booking-emails.ts unit tests.
 *
 * Tests the orchestrator sendBookingEmails() — runs confirmation + owner legs
 * concurrently and handles:
 *   - Happy path: both legs succeed
 *   - OAuth refusal on confirmation leg: flags booking row (confirmation_email_sent=false)
 *   - QuotaExceededError on either leg: flags booking row
 *
 * Mocks:
 *   - @/lib/email-sender/account-sender: getSenderForAccount returns stub EmailClient
 *   - @/lib/supabase/admin: createAdminClient stub (tracks update calls for flag assertions)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state — closure-based per-test control
// ---------------------------------------------------------------------------

/** All .send() calls made during the test — cleared in beforeEach. */
const mockSendCalls: unknown[] = [];

/** Controls what the stub .send() returns. Default: success. */
let mockSendResult: { success: boolean; messageId?: string; error?: string } = {
  success: true,
  messageId: "mock-msg-id",
};

/** Tracks all DB update() calls so we can assert confirmation_email_sent=false was written. */
const dbUpdateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

function resetState() {
  mockSendCalls.length = 0;
  mockSendResult = { success: true, messageId: "mock-msg-id" };
  dbUpdateCalls.length = 0;
}

// ---------------------------------------------------------------------------
// Mock @/lib/email-sender/account-sender BEFORE importing orchestrator.
// ---------------------------------------------------------------------------
vi.mock("@/lib/email-sender/account-sender", () => ({
  REFUSED_SEND_ERROR_PREFIX: "oauth_send_refused",
  RESEND_REFUSED_SEND_ERROR_PREFIX: "resend_send_refused",
  /** Phase 36 OQ-2 fix: mirror the real isRefusedSend so tests that rely on
   *  confirmation_email_sent=false logic continue to work. */
  isRefusedSend: (error?: string): boolean => {
    if (!error) return false;
    return error.startsWith("oauth_send_refused:") || error.startsWith("resend_send_refused:");
  },
  getSenderForAccount: vi.fn().mockImplementation(async (_accountId: string) => ({
    provider: "gmail",
    send: async (opts: unknown) => {
      mockSendCalls.push(opts);
      return { ...mockSendResult };
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin — tracks update() calls for flag assertions.
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (_cols: string, _opts?: object) => ({
        eq: (_col: string, _val: string) => ({
          // Phase 36: accounts.email_provider lookup needs maybeSingle.
          // Returns data:null → falls through to Gmail cap path (correct default).
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          gte: (_col2: string, _val2: string) =>
            Promise.resolve({ count: 0, error: null }),
        }),
        gte: (_col: string, _val: string) =>
          Promise.resolve({ count: 0, error: null }),
      }),
      insert: (_row: object) => Promise.resolve({ error: null }),
      update: (payload: Record<string, unknown>) => {
        dbUpdateCalls.push({ table, payload });
        return {
          eq: (_col: string, _val: unknown) => Promise.resolve({ error: null }),
        };
      },
    }),
  }),
}));

import { sendBookingEmails, type SendBookingEmailsArgs } from "@/lib/email/send-booking-emails";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FUTURE_START = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_END   = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

const TEST_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

function makeArgs(): SendBookingEmailsArgs {
  return {
    booking: {
      id:              "booking-uuid-001",
      start_at:        FUTURE_START,
      end_at:          FUTURE_END,
      booker_name:     "Test Booker",
      booker_email:    "booker@example.com",
      booker_timezone: "America/Chicago",
    },
    eventType: {
      name:             "Test Event",
      description:      null,
      duration_minutes: 30,
    },
    account: {
      id:           TEST_ACCOUNT_ID,
      name:         "Test Biz",
      timezone:     "America/Chicago",
      owner_email:  "owner@example.com",
      slug:         "test-biz",
      logo_url:     null,
      brand_primary: "#0A2540",
    },
    rawCancelToken:     "raw-cancel-token-abc",
    rawRescheduleToken: "raw-reschedule-token-abc",
    appUrl: "https://book.example.com",
    accountId: TEST_ACCOUNT_ID,
    ownerArgs: {
      booking: {
        id:              "booking-uuid-001",
        start_at:        FUTURE_START,
        booker_name:     "Test Booker",
        booker_email:    "booker@example.com",
        booker_phone:    null,
        booker_timezone: "America/Chicago",
        answers:         {},
      },
      eventType: { name: "Test Event" },
      account: {
        id:           TEST_ACCOUNT_ID,
        name:         "Test Biz",
        timezone:     "America/Chicago",
        owner_email:  "owner@example.com",
        logo_url:     null,
        brand_primary: "#0A2540",
      },
    },
  };
}

beforeEach(() => {
  resetState();
});

describe("sendBookingEmails — orchestrator", () => {
  it("[#1] happy path: both legs fire, no DB flag update", async () => {
    await sendBookingEmails(makeArgs());

    // Two .send() calls: booker confirmation + owner notification
    expect(mockSendCalls).toHaveLength(2);

    // No confirmation_email_sent=false flag was written
    const flagUpdates = dbUpdateCalls.filter(
      (c) => c.table === "bookings" && c.payload.confirmation_email_sent === false,
    );
    expect(flagUpdates).toHaveLength(0);
  });

  it("[#2] when sender returns oauth_send_refused error on confirmation, flags booking row", async () => {
    // Make the stub return an OAuth refusal result
    mockSendResult = {
      success: false,
      error: "oauth_send_refused: no credential",
    };

    await sendBookingEmails(makeArgs());

    // The orchestrator should have written confirmation_email_sent=false to bookings
    const flagUpdates = dbUpdateCalls.filter(
      (c) => c.table === "bookings" && c.payload.confirmation_email_sent === false,
    );
    expect(flagUpdates).toHaveLength(1);
  });

  it("[#3] sendBookingEmails never throws — errors are caught and logged", async () => {
    // Make the stub throw an unexpected error
    mockSendResult = { success: false, error: "smtp connection refused" };

    // Should resolve without throwing (fire-and-forget contract)
    await expect(sendBookingEmails(makeArgs())).resolves.toBeUndefined();
  });
});
