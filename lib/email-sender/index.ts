import "server-only";

// Vendored from @nsi/email-sender sibling project (2026-04-25).
// Gmail provider and template exports removed — Phase 5 uses Resend only.
// To update: re-copy from ../email-sender/src/index.ts and re-apply this diff.

// Types
export type {
  EmailOptions,
  EmailResult,
  EmailAttachment,
  EmailClient,
  EmailClientConfig,
  EmailProvider,
} from "./types";

// Providers — Resend only (gmail import removed; Phase 5 scope)
import { createResendClient } from "./providers/resend";
import type { EmailClient, EmailClientConfig, EmailOptions, EmailResult, EmailProvider } from "./types";

// Utilities
export { escapeHtml, stripHtml } from "./utils";

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create an email client with explicit configuration.
 *
 * ```ts
 * const client = createEmailClient({
 *   provider: 'resend',
 *   apiKey: 're_xxx',
 *   defaultFrom: 'Name <email@domain.com>',
 * });
 * ```
 */
export function createEmailClient(config: EmailClientConfig): EmailClient {
  switch (config.provider) {
    case "resend":
      return createResendClient(config);
    default:
      throw new Error(
        `[email-sender] Unknown provider: "${config.provider}". Only "resend" is supported in this vendored copy.`
      );
  }
}

// ---------------------------------------------------------------------------
// Quick send — auto-detects provider from env vars
// ---------------------------------------------------------------------------

let _defaultClient: EmailClient | null = null;

function getDefaultClient(): EmailClient {
  if (_defaultClient) return _defaultClient;

  const provider = (process.env.EMAIL_PROVIDER || "resend") as EmailProvider;

  if (provider === "resend") {
    _defaultClient = createEmailClient({
      provider: "resend",
      apiKey: process.env.RESEND_API_KEY,
      defaultFrom: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    });
  } else {
    throw new Error(
      `[email-sender] EMAIL_PROVIDER="${provider}" is not supported in this vendored copy. Use "resend".`
    );
  }

  return _defaultClient;
}

/**
 * Quick-send an email using the default provider (auto-detected from env vars).
 *
 * ```ts
 * const result = await sendEmail({
 *   to: 'customer@example.com',
 *   subject: 'Hello',
 *   html: '<h1>Hi there</h1>',
 * });
 * ```
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const client = getDefaultClient();
    return client.send(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
