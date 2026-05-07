/**
 * Vitest mock for @/lib/email-sender/account-sender.
 *
 * Wired via vitest.config.ts resolve.alias so any module that imports from
 * @/lib/email-sender/account-sender (all 5 leaf senders after Phase 35 cutover)
 * gets this spy instead of the real OAuth factory.
 *
 * Design: the stub EmailClient's .send() pushes to the SAME __mockSendCalls
 * array exported by tests/__mocks__/email-sender.ts so existing integration
 * tests (cancel-reschedule-api, reminder-cron, bookings-api) that import
 * __mockSendCalls from @/lib/email-sender continue to work without changes.
 *
 * We import from "@/lib/email-sender" (the bare specifier) rather than the
 * direct file path so Vite resolves both imports to the same alias target
 * and therefore the same module instance — guaranteeing the __mockSendCalls
 * array is shared.
 *
 * REFUSED_SEND_ERROR_PREFIX: exported as the real constant value so senders
 * that branch on it work correctly in tests.
 *
 * Phase 35: replaces the old sendEmail() spy path for all leaf senders.
 * Phase 4 STATE.md lock: path.resolve(__dirname, ...) in vitest.config.ts
 * (NOT new URL().pathname — encodes spaces as %20 on Windows).
 */

import type { EmailOptions, EmailResult, EmailClient } from "@/lib/email-sender/types";

// Import __mockSendCalls from the bare "@/lib/email-sender" specifier — this
// resolves through the vitest.config.ts alias to tests/__mocks__/email-sender.ts,
// ensuring both this mock and the test files share the exact same module instance
// and therefore the same __mockSendCalls array reference.
import { __mockSendCalls } from "@/lib/email-sender";

export { __mockSendCalls };

export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";

/** Stub EmailClient that records sends to __mockSendCalls. */
function makeStubSender(): EmailClient {
  return {
    provider: "gmail",
    async send(opts: EmailOptions): Promise<EmailResult> {
      __mockSendCalls.push(opts);
      return {
        success: true,
        messageId: "mock-account-sender-" + Math.random().toString(36).slice(2),
      };
    },
  };
}

export async function getSenderForAccount(_accountId: string): Promise<EmailClient> {
  return makeStubSender();
}
