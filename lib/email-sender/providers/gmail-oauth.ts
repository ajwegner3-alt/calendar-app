import "server-only";
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

const GMAIL_SEND_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/**
 * Create an EmailClient backed by the Gmail REST API.
 *
 * IMPORTANT: this provider uses Gmail's REST API (gmail.users.messages.send)
 * which is what the `gmail.send` OAuth scope authorizes. Earlier iterations
 * of this file used nodemailer SMTP with OAuth2, which silently dropped
 * messages because SMTP relay requires the much broader `https://mail.google.com/`
 * scope — `gmail.send` is REST-API-only.
 *
 * Per Phase 35 deviation: From MUST equal the authenticated Gmail address.
 * Gmail's REST API rejects sends where From header doesn't match the
 * authenticated user. The factory owns From — callers cannot override.
 */
export function createGmailOAuthClient(config: GmailOAuthConfig): EmailClient {
  const fromName = config.fromName ?? config.user;
  const enforcedFrom = `${fromName} <${config.user}>`;

  return {
    provider: "gmail",
    async send(options: EmailOptions): Promise<EmailResult> {
      try {
        const rfc822 = buildRfc822Message({
          from: enforcedFrom,
          to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
          cc: options.cc
            ? Array.isArray(options.cc)
              ? options.cc.join(", ")
              : options.cc
            : undefined,
          bcc: options.bcc
            ? Array.isArray(options.bcc)
              ? options.bcc.join(", ")
              : options.bcc
            : undefined,
          replyTo: options.replyTo,
          subject: options.subject,
          html: options.html,
          text: options.text || stripHtml(options.html),
          attachments: options.attachments,
        });

        const raw = base64UrlEncode(rfc822);

        const res = await fetch(GMAIL_SEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          return {
            success: false,
            error: `gmail_api_${res.status}: ${errBody.slice(0, 500)}`,
          };
        }

        const json = (await res.json()) as { id?: string };
        return { success: true, messageId: json.id };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown Gmail OAuth error";
        return { success: false, error: msg };
      }
    },
  };
}

interface Rfc822Parts {
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * Build a minimal RFC-822 message with multipart/alternative (text + html)
 * and optional attachments wrapped in multipart/mixed.
 */
function buildRfc822Message(parts: Rfc822Parts): string {
  const boundary = `nsi_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const altBoundary = `${boundary}_alt`;

  const headers: string[] = [
    `From: ${parts.from}`,
    `To: ${parts.to}`,
  ];
  if (parts.cc) headers.push(`Cc: ${parts.cc}`);
  if (parts.bcc) headers.push(`Bcc: ${parts.bcc}`);
  if (parts.replyTo) headers.push(`Reply-To: ${parts.replyTo}`);
  headers.push(`Subject: ${encodeHeader(parts.subject)}`);
  headers.push(`MIME-Version: 1.0`);

  const hasAttachments = (parts.attachments?.length ?? 0) > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  } else {
    headers.push(
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    );
  }

  const altSection = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    quotedPrintable(parts.text),
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    quotedPrintable(parts.html),
    `--${altBoundary}--`,
  ].join("\r\n");

  if (!hasAttachments) {
    return [...headers, ``, altSection].join("\r\n");
  }

  const mixedParts: string[] = [
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    altSection,
  ];

  for (const att of parts.attachments ?? []) {
    const contentType = att.contentType ?? "application/octet-stream";
    const buf =
      typeof att.content === "string"
        ? Buffer.from(att.content)
        : att.content;
    mixedParts.push(
      `--${boundary}`,
      `Content-Type: ${contentType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      buf.toString("base64").replace(/(.{76})/g, "$1\r\n"),
    );
  }
  mixedParts.push(`--${boundary}--`);

  return [...headers, ``, mixedParts.join("\r\n")].join("\r\n");
}

/** RFC 2047 encoded-word for non-ASCII subject lines. */
function encodeHeader(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Quoted-printable encoding for body content (RFC 2045). */
function quotedPrintable(input: string): string {
  return input
    .replace(/[\x00-\x08\x0B-\x1F\x7F-\xFF=]/g, (c) => {
      const code = c.charCodeAt(0);
      return `=${code.toString(16).toUpperCase().padStart(2, "0")}`;
    })
    .replace(/(.{75})/g, "$1=\r\n");
}

/** Base64url encoding (RFC 4648 §5) for the Gmail API `raw` field. */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
