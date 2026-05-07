import "server-only";
import nodemailer from "nodemailer";
import type { EmailClient, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

export interface GmailOAuthConfig {
  /** Authenticated Gmail address (account.owner_email). MUST equal the From header. */
  user: string;
  /** Fresh 1h access token from fetchGoogleAccessToken. */
  accessToken: string;
  /** Display name shown in From header. Defaults to user. */
  fromName?: string;
}

/**
 * Create an EmailClient backed by Gmail OAuth2 SMTP.
 *
 * Per RESEARCH §Pattern 3 + §Pitfall 5: explicit host/port/secure form
 * is required for some nodemailer versions when type: "OAuth2" is used.
 *
 * Per RESEARCH §Pitfall 6: From MUST equal the authenticated Gmail address.
 * The factory owns From — callers cannot override (any options.from is ignored).
 */
export function createGmailOAuthClient(config: GmailOAuthConfig): EmailClient {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      type: "OAuth2",
      user: config.user,
      accessToken: config.accessToken,
    },
  });
  const fromName = config.fromName ?? config.user;
  const enforcedFrom = `${fromName} <${config.user}>`;

  return {
    provider: "gmail",
    async send(options: EmailOptions): Promise<EmailResult> {
      try {
        const info = await transporter.sendMail({
          from: enforcedFrom, // Always the authenticated address; ignore options.from
          to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || stripHtml(options.html),
          replyTo: options.replyTo,
          attachments: options.attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })),
        });
        return { success: true, messageId: info.messageId };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown Gmail OAuth error";
        return { success: false, error: msg };
      }
    },
  };
}
