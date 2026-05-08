import "server-only";
import type { EmailClient, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

/** Stable prefix callers can match on to distinguish a Resend refusal from
 * other send errors (sibling of REFUSED_SEND_ERROR_PREFIX in account-sender.ts).
 * Used by send-booking-emails.ts dual-prefix check (Plan 03 OQ-2 fix). */
export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendConfig {
  /** Display name shown in From header — typically the account business name (accounts.name).
   *  Combined with `fromAddress` to produce e.g. "Acme Plumbing <bookings@nsintegrations.com>". */
  fromName: string;
  /** NSI verified-domain mailbox: "bookings@nsintegrations.com" (CONTEXT decision). */
  fromAddress: string;
  /** Reply-To address — the account owner's email, so customers reply to the
   *  business not NSI. Falls back to options.replyTo if the caller overrides. */
  replyToAddress: string;
}

/**
 * Create an EmailClient backed by Resend's HTTP API.
 *
 * Mirror of `createGmailOAuthClient` in providers/gmail-oauth.ts:
 *   - lazy env-var read (RESEND_API_KEY) inside send() body — required for Vitest isolation
 *   - never throws; every error path returns { success:false, error: prefix:reason }
 *   - factory owns From; callers can't override (parity with Gmail-OAuth contract)
 *
 * RESEND BODY FIELD NAMING (RESEARCH §Pitfall 1):
 *   - reply_to (snake_case), NOT replyTo
 *   - content_type (snake_case) on attachments, NOT contentType
 *   Resend silently ignores unknown fields, so a typo here means features
 *   silently disappear from the sent message.
 */
export function createResendClient(config: ResendConfig): EmailClient {
  const from = `${config.fromName} <${config.fromAddress}>`;

  return {
    provider: "resend",
    async send(options: EmailOptions): Promise<EmailResult> {
      // LAZY env var read — see Phase 35 STATE.md "fetchGoogleAccessToken
      // lazy env-var read" pattern. Module-top-level read breaks Vitest
      // because process.env mutations between tests don't propagate.
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: missing RESEND_API_KEY`,
        };
      }

      const body: Record<string, unknown> = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? stripHtml(options.html),
        // snake_case — Resend's wire format. options.replyTo wins when set.
        reply_to: options.replyTo ?? config.replyToAddress,
      };
      if (options.cc) body.cc = options.cc;
      if (options.bcc) body.bcc = options.bcc;

      if (options.attachments?.length) {
        body.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          // Resend accepts base64 string for `content`. Buffer → base64.
          content: Buffer.isBuffer(att.content)
            ? att.content.toString("base64")
            : att.content,
          // snake_case content_type. For .ics inline RSVP rendering in Gmail,
          // the caller passes contentType: "text/calendar; method=REQUEST"
          // (RESEARCH §4 — confirmed via resend-node GitHub issue #198).
          // If a future caller fidelity test reveals Outlook or another
          // client mis-renders, downgrade by stripping the method param at
          // the caller; no provider change needed.
          content_type: att.contentType,
        }));
      }

      try {
        const res = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            name?: string;
            message?: string;
            statusCode?: number;
          };
          const detail = errBody.message ?? errBody.name ?? "unknown";
          return {
            success: false,
            error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${res.status} ${detail}`,
          };
        }

        const json = (await res.json()) as { id?: string };
        return { success: true, messageId: json.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown fetch error";
        return {
          success: false,
          error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${msg}`,
        };
      }
    },
  };
}
