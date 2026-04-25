import "server-only";

// Vendored from @nsi/email-sender sibling project (2026-04-25).
// Phase 5 ships the Gmail provider only (nodemailer SMTP via App Password).
// Resend provider was removed — re-vendor from ../email-sender/src/providers/resend.ts
// if a non-Gmail backend is ever needed.
//
// v1: env-based singleton — Andrew's GMAIL_USER + GMAIL_APP_PASSWORD.
// v2 (multi-tenant onboarding): per-account credential lookup at send time.
//   Add a `gmail-oauth` provider variant that uses a refresh token stored on
//   accounts.gmail_refresh_token (column added in v2 migration).
//   The createEmailClient(config) factory already accepts per-call config, so
//   the abstraction is forward-compatible — only a new provider file +
//   schema columns needed for v2.

// Types
export type {
  EmailOptions,
  EmailResult,
  EmailAttachment,
  EmailClient,
  EmailClientConfig,
  EmailProvider,
} from "./types";

// Providers
import { createGmailClient } from "./providers/gmail";
import type { EmailClient, EmailClientConfig, EmailOptions, EmailResult } from "./types";

// Utilities
export { escapeHtml, stripHtml } from "./utils";

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createEmailClient(config: EmailClientConfig): EmailClient {
  switch (config.provider) {
    case "gmail":
      return createGmailClient(config);
    default:
      throw new Error(
        `[email-sender] Provider "${config.provider}" not vendored. Only "gmail" is shipped in this copy.`
      );
  }
}

// ---------------------------------------------------------------------------
// Quick send — auto-detects provider from env vars
// ---------------------------------------------------------------------------

let _defaultClient: EmailClient | null = null;

function getDefaultClient(): EmailClient {
  if (_defaultClient) return _defaultClient;

  _defaultClient = createEmailClient({
    provider: "gmail",
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
    fromName: process.env.GMAIL_FROM_NAME || "Andrew @ NSI",
  });

  return _defaultClient;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const client = getDefaultClient();
    return client.send(options);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}
