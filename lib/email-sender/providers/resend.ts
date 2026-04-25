// Vendored from @nsi/email-sender sibling project (2026-04-25).
// Copied verbatim from ../email-sender/src/providers/resend.ts.
// Import path adjusted: ../utils → ../utils (same relative depth, still resolves).

import { Resend } from "resend";
import type { EmailClient, EmailClientConfig, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

export function createResendClient(config: EmailClientConfig): EmailClient {
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw new Error(
      "[email-sender] Resend provider requires `apiKey`. " +
        "Set it in config or via RESEND_API_KEY env var."
    );
  }

  const resend = new Resend(apiKey);
  const defaultFrom = config.defaultFrom || "onboarding@resend.dev";

  return {
    provider: "resend",

    async send(options: EmailOptions): Promise<EmailResult> {
      try {
        const { data, error } = await resend.emails.send({
          from: options.from || defaultFrom,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text || stripHtml(options.html),
          replyTo: options.replyTo,
          cc: options.cc
            ? Array.isArray(options.cc)
              ? options.cc
              : [options.cc]
            : undefined,
          bcc: options.bcc
            ? Array.isArray(options.bcc)
              ? options.bcc
              : [options.bcc]
            : undefined,
          attachments: options.attachments?.map((a) => ({
            filename: a.filename,
            content: typeof a.content === "string"
              ? Buffer.from(a.content, "base64")
              : a.content,
            contentType: a.contentType,
          })),
        });

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, messageId: data?.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown Resend error";
        return { success: false, error: msg };
      }
    },
  };
}
