// @vitest-environment node
/**
 * Plan 35-04 Task 2 — send-reminder-booker.ts unit tests.
 *
 * Tests that sendReminderBooker:
 *   - Sends successfully on happy path
 *   - When sender returns oauth_send_refused, re-throws (cron needs to count it)
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

import { sendReminderBooker, type SendReminderBookerArgs } from "@/lib/email/send-reminder-booker";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const FUTURE_START = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
const FUTURE_END   = new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString();
const TEST_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

function makeArgs(): SendReminderBookerArgs {
  return {
    booking: {
      id:              "booking-uuid-reminder-001",
      start_at:        FUTURE_START,
      end_at:          FUTURE_END,
      booker_name:     "Reminder Booker",
      booker_email:    "reminder-booker@example.com",
      booker_timezone: "America/Chicago",
      answers:         null,
    },
    eventType: {
      name:             "Reminder Event",
      duration_minutes: 30,
      location:         null,
    },
    account: {
      id:           TEST_ACCOUNT_ID,
      slug:         "reminder-biz",
      name:         "Reminder Biz",
      logo_url:     null,
      brand_primary: "#0A2540",
      owner_email:  "owner@reminder.example.com",
      reminder_include_custom_answers:  false,
      reminder_include_location:        false,
      reminder_include_lifecycle_links: false,
    },
    rawCancelToken:     "raw-cancel-token-reminder",
    rawRescheduleToken: "raw-reschedule-token-reminder",
    appUrl: "https://book.example.com",
    accountId: TEST_ACCOUNT_ID,
  };
}

beforeEach(() => {
  resetState();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sendReminderBooker", () => {
  it("[#1] happy path: sends to booker email, resolves without throwing", async () => {
    await expect(sendReminderBooker(makeArgs())).resolves.toBeUndefined();

    expect(mockSendCalls).toHaveLength(1);
    expect(mockSendCalls[0]!.to).toBe("reminder-booker@example.com");
    expect(mockSendCalls[0]!.subject).toMatch(/^Reminder: Reminder Event tomorrow at /);
  });

  it("[#2] when sender returns oauth_send_refused error, re-throws (cron counts it as refused)", async () => {
    mockSendResult = { success: false, error: "oauth_send_refused: no credential" };

    // sendReminderBooker re-throws on oauth refusal so the cron loop can count
    // quota_refused and continue. This is intentional (unlike cancel/reschedule).
    await expect(sendReminderBooker(makeArgs())).rejects.toThrow("oauth_send_refused");
  });

  it("[#3] when sender returns non-oauth failure, re-throws with the error message", async () => {
    mockSendResult = { success: false, error: "smtp connection refused" };

    await expect(sendReminderBooker(makeArgs())).rejects.toThrow("smtp connection refused");
  });
});
