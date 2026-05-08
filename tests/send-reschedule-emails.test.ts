// @vitest-environment node
/**
 * Plan 35-04 Task 2 — send-reschedule-emails.ts unit tests.
 *
 * Tests that the reschedule email orchestrator:
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

import { sendRescheduleEmails, type SendRescheduleEmailsArgs } from "@/lib/email/send-reschedule-emails";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const OLD_START  = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
const OLD_END    = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
const NEW_START  = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const NEW_END    = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
const TEST_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

function makeArgs(overrides: Partial<SendRescheduleEmailsArgs> = {}): SendRescheduleEmailsArgs {
  return {
    booking: {
      id:              "booking-uuid-reschedule-001",
      start_at:        NEW_START,
      end_at:          NEW_END,
      booker_name:     "Reschedule Booker",
      booker_email:    "reschedule-booker@example.com",
      booker_timezone: "America/Chicago",
    },
    eventType: {
      name:             "Reschedule Event",
      description:      null,
      duration_minutes: 30,
    },
    account: {
      id:           TEST_ACCOUNT_ID,
      name:         "Reschedule Biz",
      slug:         "reschedule-biz",
      timezone:     "America/Chicago",
      owner_email:  "owner@reschedule.example.com",
      logo_url:     null,
      brand_primary: "#0A2540",
    },
    oldStartAt:         OLD_START,
    oldEndAt:           OLD_END,
    rawCancelToken:     "raw-cancel-token-resched",
    rawRescheduleToken: "raw-reschedule-token-resched",
    appUrl: "https://book.example.com",
    accountId: TEST_ACCOUNT_ID,
    ...overrides,
  };
}

beforeEach(() => {
  resetState();
});

describe("sendRescheduleEmails — orchestrator", () => {
  it("[#1] happy path: fires both booker + owner emails", async () => {
    await sendRescheduleEmails(makeArgs());

    expect(mockSendCalls).toHaveLength(2);

    const toAddresses = mockSendCalls.map((c) => c.to);
    expect(toAddresses).toContain("reschedule-booker@example.com");
    expect(toAddresses).toContain("owner@reschedule.example.com");
  });

  it("[#2] when sender returns oauth_send_refused, does NOT re-throw (reschedule already committed)", async () => {
    mockSendResult = { success: false, error: "oauth_send_refused: no credential" };

    // Must resolve without throwing — the reschedule is already committed
    await expect(sendRescheduleEmails(makeArgs())).resolves.toBeUndefined();
  });

  it("[#3] sendOwner=false: only the booker leg fires", async () => {
    await sendRescheduleEmails(makeArgs({ sendOwner: false }));

    expect(mockSendCalls).toHaveLength(1);
    expect(mockSendCalls[0]!.to).toBe("reschedule-booker@example.com");
  });

  it("[#4] booker email subject contains 'rescheduled'", async () => {
    await sendRescheduleEmails(makeArgs({ sendOwner: false }));

    expect(mockSendCalls[0]!.subject).toContain("rescheduled");
  });
});
