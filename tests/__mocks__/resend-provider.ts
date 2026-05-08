/**
 * Vitest mock for @/lib/email-sender/providers/resend.
 *
 * Used by integration tests that exercise the Resend routing path through
 * getSenderForAccount without going through the real Resend HTTP provider
 * (which is exhaustively unit-tested in tests/resend-provider.test.ts).
 *
 * Stub returns an EmailClient that pushes sends to the shared __mockSendCalls
 * array, matching the pattern of tests/__mocks__/account-sender.ts.
 */
import type { EmailOptions, EmailResult, EmailClient } from "@/lib/email-sender/types";
import { __mockSendCalls } from "@/lib/email-sender";

export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";

export interface ResendConfig {
  fromName: string;
  fromAddress: string;
  replyToAddress: string;
}

export function createResendClient(_config: ResendConfig): EmailClient {
  return {
    provider: "resend",
    async send(opts: EmailOptions): Promise<EmailResult> {
      __mockSendCalls.push(opts);
      return {
        success: true,
        messageId: "mock-resend-" + Math.random().toString(36).slice(2),
      };
    },
  };
}
