/**
 * Vitest mock for @/lib/email-sender.
 *
 * Wired via vitest.config.ts resolve.alias so any module that imports from
 * @/lib/email-sender (including send-booking-confirmation.ts and
 * send-owner-notification.ts) gets this no-op spy instead of the real
 * Gmail nodemailer singleton.
 *
 * __mockSendCalls: array of all EmailOptions passed to sendEmail() during a test.
 * __resetMockSendCalls(): clears the array — call in beforeEach.
 *
 * The mock satisfies the EmailResult contract (success: true, messageId).
 * It does NOT call nodemailer or any network endpoint.
 *
 * Phase 4 STATE.md lock: path.resolve(__dirname, ...) used in vitest.config.ts
 * alias (NOT new URL().pathname — encodes spaces as %20 on Windows).
 */

import type { EmailOptions, EmailResult } from "@/lib/email-sender/types";

export const __mockSendCalls: EmailOptions[] = [];

export async function sendEmail(input: EmailOptions): Promise<EmailResult> {
  __mockSendCalls.push(input);
  return {
    success: true,
    messageId: "mock-" + Math.random().toString(36).slice(2),
  };
}

export function __resetMockSendCalls(): void {
  __mockSendCalls.length = 0;
}

// Re-export stubs for any module that imports other named exports from
// @/lib/email-sender (e.g. escapeHtml, stripHtml, createEmailClient).
// These are no-ops — only sendEmail is exercised by the bookings route.
export function escapeHtml(s: string): string {
  return s;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

export function createEmailClient(_config: unknown): unknown {
  return { send: sendEmail, provider: "mock" };
}
