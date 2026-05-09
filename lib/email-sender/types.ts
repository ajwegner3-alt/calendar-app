// Vendored from @nsi/email-sender sibling project (2026-04-25).
// Copied verbatim from ../email-sender/src/types.ts.

/**
 * Attachment for an email — either raw content or a file path.
 *
 * @public — KEEP per Phase 40 audit (40-KNIP-DECISIONS.md): used internally at line 29 by
 * `EmailOptions.attachments`. Knip false-positive on transitive type-graph references.
 */
export interface EmailAttachment {
  /** File name shown to the recipient, e.g. "Guide.pdf" */
  filename: string;
  /** Raw content as Buffer, string, or base64-encoded string */
  content: Buffer | string;
  /** Optional MIME type, e.g. "application/pdf". Auto-detected if omitted. */
  contentType?: string;
}

/** Options for sending a single email. */
export interface EmailOptions {
  /** Recipient email address (or array for multiple recipients) */
  to: string | string[];
  /** Subject line */
  subject: string;
  /** HTML body */
  html: string;
  /** Plain text fallback (auto-stripped from HTML if omitted) */
  text?: string;
  /** Override the default "from" address */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
  /** File attachments */
  attachments?: EmailAttachment[];
  /** CC recipients */
  cc?: string | string[];
  /** BCC recipients */
  bcc?: string | string[];
}

/** Result of an email send attempt. Never throws — check `success`. */
export interface EmailResult {
  success: boolean;
  /** Provider message ID on success */
  messageId?: string;
  /** Error message on failure */
  error?: string;
}

/**
 * Supported email providers.
 *
 * @public — KEEP per Phase 40 audit (40-KNIP-DECISIONS.md): composed into `EmailClientConfig`
 * (line 56 below) and `EmailClient` (line 74 below). Knip false-positive on type-graph nodes.
 */
export type EmailProvider = "gmail" | "resend";

/**
 * Configuration for creating an email client.
 *
 * @public — KEEP per Phase 40 audit (40-KNIP-DECISIONS.md): provider factory parameter shape
 * consumed by `account-sender.ts` via inference. Conservative bias on type-only references.
 */
export interface EmailClientConfig {
  /** Which provider to use */
  provider: EmailProvider;
  /** Default "from" address — required for sends unless overridden per-email */
  defaultFrom?: string;

  // --- Gmail-specific ---
  /** Gmail address (required if provider = "gmail") */
  user?: string;
  /** Gmail App Password (required if provider = "gmail") */
  appPassword?: string;
  /** Display name for the sender, e.g. "North Star Integrations" */
  fromName?: string;
}

/** An email client instance. */
export interface EmailClient {
  /** Send an email. Returns a result object — never throws. */
  send(options: EmailOptions): Promise<EmailResult>;
  /** The provider this client uses. */
  provider: EmailProvider;
}
