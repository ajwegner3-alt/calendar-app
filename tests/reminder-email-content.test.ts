// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

import { sendReminderBooker, type SendReminderBookerArgs } from "@/lib/email/send-reminder-booker";

/**
 * Plan 08-04 Task 1 Step C — content-quality automated guard for EMAIL-08.
 *
 * Catches obvious content regressions in CI so the manual mail-tester run
 * (Plan 08-08 manual checkpoint) only needs to evaluate fundamentals like
 * SPF/DKIM, not "did we accidentally ship broken hrefs?".
 *
 * Phase 35 update: migrated from __mockSendCalls singleton to vi.mock of
 * @/lib/email-sender/account-sender so getSenderForAccount returns a stub
 * EmailClient whose .send() is a vi.fn() spy.
 *
 * Assertions per RESEARCH §Warning 9:
 *   - Every href is either https://... or starts with /  (no undefined / empty)
 *   - text alternative is non-empty (Gmail spam-score guard)
 *   - When account.logo_url is set, the rendered HTML contains an <img> with
 *     that exact URL (logo wired correctly)
 *   - Subject does NOT contain three or more consecutive uppercase words
 *     (no spammy "REMINDER: BOOK YOUR ..." style)
 *   - All toggle blocks correctly omit content when their flag is false
 */

// ---------------------------------------------------------------------------
// Mock @/lib/email-sender/account-sender BEFORE importing the senders.
// ---------------------------------------------------------------------------
const mockSendFn = vi.fn().mockResolvedValue({ success: true, messageId: "mock-test" });

vi.mock("@/lib/email-sender/account-sender", () => ({
  REFUSED_SEND_ERROR_PREFIX: "oauth_send_refused",
  getSenderForAccount: vi.fn().mockResolvedValue({
    provider: "gmail",
    send: (...args: unknown[]) => mockSendFn(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin — quota-guard calls it internally.
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

const baseArgs = (): SendReminderBookerArgs => ({
  booking: {
    id: "00000000-0000-4000-8000-000000000001",
    start_at: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 23.5 * 60 * 60 * 1000).toISOString(),
    booker_name: "Sam Booker",
    booker_email: "sam@example.com",
    booker_timezone: "America/Chicago",
    answers: { "What's the issue?": "Leaky kitchen faucet" } as Record<string, string>,
  },
  eventType: {
    name: "Plumbing Estimate",
    duration_minutes: 30,
    location: "1234 Main Street\nOmaha, NE 68102",
  },
  account: {
    /** Phase 35: id field required by quota-guard logQuotaRefusal. */
    id: "ba8e712d-28b7-4071-b3d4-361fb6fb7a60",
    slug: "acme-plumbing",
    name: "Acme Plumbing",
    logo_url: "https://example.com/logo.png",
    brand_primary: "#0A2540",
    owner_email: "owner@acme.example.com",
    reminder_include_custom_answers: true,
    reminder_include_location: true,
    reminder_include_lifecycle_links: true,
  },
  rawCancelToken: "raw-cancel-token-1234567890abcdef",
  rawRescheduleToken: "raw-reschedule-token-1234567890abcdef",
  appUrl: "https://book.acme.example.com",
  /** Phase 35: account UUID for per-account Gmail OAuth sender factory. */
  accountId: "ba8e712d-28b7-4071-b3d4-361fb6fb7a60",
});

beforeEach(() => {
  mockSendFn.mockClear();
});

/** Extract href values from anchor tags in an HTML string. */
function extractHrefs(html: string): string[] {
  const hrefs: string[] = [];
  const regex = /href="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
}

/** Heuristic: 3+ consecutive ALL-CAPS words (length ≥ 2 to skip e.g. "I", "A"). */
function hasSpammyAllCapsRun(s: string): boolean {
  return /\b[A-Z]{2,}\b(?:\s+\b[A-Z]{2,}\b){2,}/.test(s);
}

describe("sendReminderBooker — content-quality guards (EMAIL-08)", () => {
  it("[#1] all toggles ON: hrefs are well-formed, text alt non-empty, logo present, subject not spammy", async () => {
    await sendReminderBooker(baseArgs());

    expect(mockSendFn).toHaveBeenCalledTimes(1);
    const call = mockSendFn.mock.calls[0][0];

    // Subject template + non-spammy
    expect(call.subject).toMatch(/^Reminder: Plumbing Estimate tomorrow at /);
    expect(hasSpammyAllCapsRun(call.subject ?? "")).toBe(false);

    // Plain-text alternative present and non-trivial
    expect(typeof call.text).toBe("string");
    expect((call.text ?? "").length).toBeGreaterThan(40);

    // Every href is https:// or starts with / — never undefined / empty
    const html = String(call.html ?? "");
    const hrefs = extractHrefs(html);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^(https:\/\/|\/)/);
    }

    // Logo wired through
    expect(html).toContain('<img');
    expect(html).toContain('src="https://example.com/logo.png"');

    // Lifecycle links present (toggle on)
    expect(html).toContain("/cancel/raw-cancel-token-1234567890abcdef");
    expect(html).toContain("/reschedule/raw-reschedule-token-1234567890abcdef");

    // Location present (toggle on)
    expect(html).toContain("Location:");
    expect(html).toContain("1234 Main Street");

    // Custom answers present (toggle on)
    expect(html).toContain("What&#39;s the issue?");
    expect(html).toContain("Leaky kitchen faucet");
  });

  it("[#2] all toggles OFF: location, custom answers, lifecycle links omitted entirely", async () => {
    const args = baseArgs();
    args.account.reminder_include_location = false;
    args.account.reminder_include_custom_answers = false;
    args.account.reminder_include_lifecycle_links = false;

    await sendReminderBooker(args);

    const html = String(mockSendFn.mock.calls[0][0].html ?? "");

    // Location section omitted
    expect(html).not.toContain("Location:");
    expect(html).not.toContain("1234 Main Street");

    // Custom answers omitted
    expect(html).not.toContain("Your answers:");
    expect(html).not.toContain("Leaky kitchen faucet");

    // Lifecycle CTAs omitted (no Reschedule/Cancel buttons, no token URLs)
    expect(html).not.toContain("Reschedule");
    expect(html).not.toContain("/cancel/");
    expect(html).not.toContain("/reschedule/");

    // Core booking details still present (the reminder's reason for being)
    expect(html).toContain("When:");
    expect(html).toContain("Duration:");
    expect(html).toContain("30 minutes");
  });

  it("[#3] mixed toggles (only location off): answers + links present, location omitted", async () => {
    const args = baseArgs();
    args.account.reminder_include_location = false;
    // others stay true

    await sendReminderBooker(args);
    const html = String(mockSendFn.mock.calls[0][0].html ?? "");

    expect(html).not.toContain("Location:");
    expect(html).not.toContain("1234 Main Street");
    expect(html).toContain("Your answers:");
    expect(html).toContain("/cancel/raw-cancel-token-1234567890abcdef");
    expect(html).toContain("/reschedule/raw-reschedule-token-1234567890abcdef");
  });

  it("[#4] no logo_url: <img> tag is omitted entirely (no broken-image placeholder)", async () => {
    const args = baseArgs();
    args.account.logo_url = null;

    await sendReminderBooker(args);
    const html = String(mockSendFn.mock.calls[0][0].html ?? "");

    expect(html).not.toContain("<img");
  });

  it("[#5] empty answers object with toggle on: answers section omitted (no empty table)", async () => {
    const args = baseArgs();
    args.booking.answers = {};

    await sendReminderBooker(args);
    const html = String(mockSendFn.mock.calls[0][0].html ?? "");

    expect(html).not.toContain("Your answers:");
  });

  it("[#6] empty location string with toggle on: location section omitted (no empty Location: header)", async () => {
    const args = baseArgs();
    args.eventType.location = "   "; // whitespace only

    await sendReminderBooker(args);
    const html = String(mockSendFn.mock.calls[0][0].html ?? "");

    expect(html).not.toContain("Location:");
  });
});
