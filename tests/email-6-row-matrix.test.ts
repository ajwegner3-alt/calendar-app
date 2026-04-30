// @vitest-environment node
/**
 * Plan 12-06 Task 3 — EMAIL-12: 6-row HTML snapshot matrix.
 *
 * Verifies that all 6 transactional email senders:
 *   1. Include a table with bgcolor= attribute (branded header band)
 *   2. Include "Powered by" text in footer
 *   3. Per-sender: correct plain-text alt presence
 *
 * This gives EMAIL-12 closure at the code level. Live inbox inspection
 * (Gmail web pass) is documented in the SUMMARY and deferred to Phase 13 QA.
 * Live cross-client testing (Outlook desktop, Apple Mail iOS, Yahoo) is
 * deferred to v1.2 per CONTEXT.md lock.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { sendBookingConfirmation } from "@/lib/email/send-booking-confirmation";
import { sendOwnerNotification } from "@/lib/email/send-owner-notification";
import { sendCancelEmails } from "@/lib/email/send-cancel-emails";
import { sendRescheduleEmails } from "@/lib/email/send-reschedule-emails";
import { sendReminderBooker } from "@/lib/email/send-reminder-booker";
import { __mockSendCalls, __resetMockSendCalls } from "@/lib/email-sender";

// ─── Shared fixture data ────────────────────────────────────────────────────

const FUTURE_START = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_END   = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

const booking = {
  id:              "00000000-0000-4000-8000-000000000099",
  start_at:        FUTURE_START,
  end_at:          FUTURE_END,
  booker_name:     "Alex Booker",
  booker_email:    "alex@example.com",
  booker_phone:    null,
  booker_timezone: "America/Chicago",
  answers:         {} as Record<string, string>,
};

const eventType = {
  name:             "Plumbing Estimate",
  description:      null,
  duration_minutes: 30,
  slug:             "plumbing-estimate",
  location:         null,
};

/** Account with branded sidebar_color — ensures header band uses non-default color (EMAIL-14 priority chain) */
const account = {
  id:           "ba8e712d-28b7-4071-b3d4-361fb6fb7a60",
  name:         "Acme Plumbing",
  slug:         "acme",
  timezone:     "America/Chicago",
  owner_email:  "owner@acme.example.com",
  logo_url:     null,
  brand_primary: "#0A2540",
  background_color: "#1A3A5C", // kept for backward compat (no longer drives header band in Phase 12.6)
  sidebar_color: "#1A3A5C",    // Phase 12.6: primary email header band source (sidebarColor → brand_primary → DEFAULT)
};

const APP_URL = "https://book.acme.example.com";

// ─── Helper ────────────────────────────────────────────────────────────────

/** Assert a rendered HTML contains branded header band and NSI footer. */
function assertBrandedEmail(html: string, opts: { expectPlainText?: boolean; callIndex?: number } = {}) {
  // Header band: table with bgcolor attribute (Outlook-safe pattern)
  expect(html).toMatch(/bgcolor="#[0-9A-Fa-f]{6}"/i);
  // Footer: "Powered by" text
  expect(html).toContain("Powered by");
}

// ─── Tests ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetMockSendCalls();
});

describe("EMAIL-12: 6-row visual smoke matrix (code-level HTML assertions)", () => {
  it("[Row 1] booker_confirmation: branded header + footer + plain-text alt", async () => {
    await sendBookingConfirmation({
      booking,
      eventType,
      account,
      rawCancelToken:     "raw-cancel-token-confirm",
      rawRescheduleToken: "raw-reschedule-token-confirm",
      appUrl: APP_URL,
    });

    // booker email is call[0]
    expect(__mockSendCalls).toHaveLength(1);
    const call = __mockSendCalls[0]!;
    const html = String(call.html ?? "");

    assertBrandedEmail(html);

    // Correct background color in header
    expect(html).toContain("background-color:#1A3A5C");

    // Body content unchanged (apostrophe is in static string so not HTML-escaped)
    expect(html).toContain("You're booked.");
    expect(html).toContain("Alex Booker");
    expect(html).toContain("Plumbing Estimate");

    // Plain-text alternative (EMAIL-10)
    expect(typeof call.text).toBe("string");
    expect((call.text ?? "").length).toBeGreaterThan(20);
    expect(call.text).not.toContain("<");
  });

  it("[Row 2] owner_notification: branded header + footer (no plain-text alt by design)", async () => {
    await sendOwnerNotification({
      booking,
      eventType,
      account,
    });

    expect(__mockSendCalls).toHaveLength(1);
    const call = __mockSendCalls[0]!;
    const html = String(call.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("New booking");
    expect(html).toContain("Alex Booker");

    // Owner email does NOT have plain-text alt per CONTEXT discretion
    // (no assertion — we don't require its absence either; just verifying it doesn't crash)
  });

  it("[Row 3] booker_cancel: branded header + footer + plain-text alt", async () => {
    await sendCancelEmails({
      booking: { ...booking, end_at: FUTURE_END },
      eventType,
      account,
      actor: "booker",
      appUrl: APP_URL,
    });

    // sendCancelEmails fires both booker + owner emails → 2 calls
    expect(__mockSendCalls).toHaveLength(2);

    // Find booker cancel (to: booker_email)
    const bookerCall = __mockSendCalls.find((c) => c.to === booking.booker_email);
    expect(bookerCall).toBeDefined();
    const html = String(bookerCall!.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("Appointment cancelled");

    // Plain-text alternative (EMAIL-10 extended)
    expect(typeof bookerCall!.text).toBe("string");
    expect((bookerCall!.text ?? "").length).toBeGreaterThan(20);
    expect(bookerCall!.text).not.toContain("<");
  });

  it("[Row 4] owner_cancel: branded header + footer (no plain-text alt by design)", async () => {
    await sendCancelEmails({
      booking: { ...booking, end_at: FUTURE_END },
      eventType,
      account,
      actor: "booker",
      appUrl: APP_URL,
    });

    expect(__mockSendCalls).toHaveLength(2);

    // Find owner cancel (to: owner_email)
    const ownerCall = __mockSendCalls.find((c) => c.to === account.owner_email);
    expect(ownerCall).toBeDefined();
    const html = String(ownerCall!.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("Booking cancelled");
  });

  it("[Row 5] booker_reschedule: branded header + footer + plain-text alt", async () => {
    const oldStart = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const oldEnd   = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

    await sendRescheduleEmails({
      booking,
      eventType,
      account,
      oldStartAt:         oldStart,
      oldEndAt:           oldEnd,
      rawCancelToken:     "raw-cancel-token-reschedule",
      rawRescheduleToken: "raw-reschedule-token-reschedule",
      appUrl: APP_URL,
    });

    expect(__mockSendCalls).toHaveLength(2);

    const bookerCall = __mockSendCalls.find((c) => c.to === booking.booker_email);
    expect(bookerCall).toBeDefined();
    const html = String(bookerCall!.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("rescheduled");

    // Plain-text alternative (EMAIL-10 extended)
    expect(typeof bookerCall!.text).toBe("string");
    expect((bookerCall!.text ?? "").length).toBeGreaterThan(20);
    expect(bookerCall!.text).not.toContain("<");
  });

  it("[Row 6] owner_reschedule: branded header + footer (no plain-text alt by design)", async () => {
    const oldStart = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const oldEnd   = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();

    await sendRescheduleEmails({
      booking,
      eventType,
      account,
      oldStartAt:         oldStart,
      oldEndAt:           oldEnd,
      rawCancelToken:     "raw-cancel-token-reschedule-owner",
      rawRescheduleToken: "raw-reschedule-token-reschedule-owner",
      appUrl: APP_URL,
    });

    expect(__mockSendCalls).toHaveLength(2);

    const ownerCall = __mockSendCalls.find((c) => c.to === account.owner_email);
    expect(ownerCall).toBeDefined();
    const html = String(ownerCall!.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("Booking rescheduled");
  });

  it("[Bonus] reminder_booker: branded header + footer + plain-text alt (already had it pre-12-06)", async () => {
    await sendReminderBooker({
      booking: {
        id:              booking.id,
        start_at:        FUTURE_START,
        end_at:          FUTURE_END,
        booker_name:     booking.booker_name,
        booker_email:    booking.booker_email,
        booker_timezone: booking.booker_timezone,
        answers:         null,
      },
      eventType: {
        name:             eventType.name,
        duration_minutes: eventType.duration_minutes,
        location:         null,
      },
      account: {
        slug:             account.slug,
        name:             account.name,
        logo_url:         account.logo_url,
        brand_primary:    account.brand_primary,
        background_color: account.background_color,
        sidebar_color:    account.sidebar_color,
        owner_email:      account.owner_email,
        reminder_include_custom_answers:  false,
        reminder_include_location:        false,
        reminder_include_lifecycle_links: false,
      },
      rawCancelToken:     "raw-cancel-token-reminder",
      rawRescheduleToken: "raw-reschedule-token-reminder",
      appUrl: APP_URL,
    });

    expect(__mockSendCalls).toHaveLength(1);
    const call = __mockSendCalls[0]!;
    const html = String(call.html ?? "");

    assertBrandedEmail(html);
    expect(html).toContain("background-color:#1A3A5C");
    expect(html).toContain("See you tomorrow");

    // Plain-text alternative
    expect(typeof call.text).toBe("string");
    expect((call.text ?? "").length).toBeGreaterThan(20);
  });
});
