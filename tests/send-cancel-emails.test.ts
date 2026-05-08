// @vitest-environment node
/**
 * Plan 35-04 Task 2 — send-cancel-emails.ts unit tests.
 *
 * Tests that the cancel email orchestrator:
 *   - Fires both booker + owner legs on happy path
 *   - Handles oauth_send_refused as a soft failure (no re-throw)
 *   - Suppresses owner leg when sendOwner=false
 *
 * Mocks:
 *   - @/lib/email-sender/account-sender: getSenderForAccount returns stub EmailClient
 *   - @/lib/supabase/admin: quota-guard stub (no real DB)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

const mockSendCalls: Array<{ to: string; subject: string }> = [];
let mockSendResult: { success: boolean; error?: string } = { success: true };

function resetState() {
  mockSendCalls.length = 0;
  mockSendResult = { success: true };
}

// ---------------------------------------------------------------------------
// Mock @/lib/email-sender/account-sender BEFORE importing senders.
// ---------------------------------------------------------------------------
vi.mock("@/lib/email-sender/account-sender", () => ({
  REFUSED_SEND_ERROR_PREFIX: "oauth_send_refused",
  getSenderForAccount: vi.fn().mockImplementation(async (_accountId: string) => ({
    provider: "gmail",
    send: async (opts: { to: string; subject: string }) => {
      mockSendCalls.push({ to: opts.to, subject: opts.subject });
      return { ...mockSendResult };
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin — quota-guard calls it.
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
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
    }),
  }),
}));

import { sendCancelEmails, type SendCancelEmailsArgs } from "@/lib/email/send-cancel-emails";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FUTURE_START = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_END   = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
const TEST_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

function makeArgs(overrides: Partial<SendCancelEmailsArgs> = {}): SendCancelEmailsArgs {
  return {
    booking: {
      id:              "booking-uuid-cancel-001",
      start_at:        FUTURE_START,
      end_at:          FUTURE_END,
      booker_name:     "Cancel Booker",
      booker_email:    "cancel-booker@example.com",
      booker_phone:    null,
      booker_timezone: "America/Chicago",
      answers:         {},
    },
    eventType: {
      name:             "Cancel Event",
      description:      null,
      duration_minutes: 30,
      slug:             "cancel-event",
    },
    account: {
      id:           TEST_ACCOUNT_ID,
      name:         "Cancel Biz",
      slug:         "cancel-biz",
      timezone:     "America/Chicago",
      owner_email:  "owner@cancel.example.com",
      logo_url:     null,
      brand_primary: "#0A2540",
    },
    actor: "booker",
    appUrl: "https://book.example.com",
    accountId: TEST_ACCOUNT_ID,
    ...overrides,
  };
}

beforeEach(() => {
  resetState();
});

describe("sendCancelEmails — orchestrator", () => {
  it("[#1] happy path: fires both booker + owner emails", async () => {
    await sendCancelEmails(makeArgs());

    expect(mockSendCalls).toHaveLength(2);

    const toAddresses = mockSendCalls.map((c) => c.to);
    expect(toAddresses).toContain("cancel-booker@example.com");
    expect(toAddresses).toContain("owner@cancel.example.com");
  });

  it("[#2] when sender returns oauth_send_refused, does NOT re-throw (cancel already committed)", async () => {
    mockSendResult = { success: false, error: "oauth_send_refused: no credential" };

    // Must resolve without throwing — the cancel is already committed
    await expect(sendCancelEmails(makeArgs())).resolves.toBeUndefined();
  });

  it("[#3] sendOwner=false: only the booker leg fires", async () => {
    await sendCancelEmails(makeArgs({ sendOwner: false }));

    expect(mockSendCalls).toHaveLength(1);
    expect(mockSendCalls[0]!.to).toBe("cancel-booker@example.com");
  });

  it("[#4] actor=owner: booker email subject is 'Appointment cancelled' (apology tone)", async () => {
    await sendCancelEmails(makeArgs({ actor: "owner" }));

    const bookerCall = mockSendCalls.find(
      (c) => c.to === "cancel-booker@example.com",
    );
    expect(bookerCall).toBeDefined();
    expect(bookerCall!.subject).toContain("Booking cancelled");
  });
});
