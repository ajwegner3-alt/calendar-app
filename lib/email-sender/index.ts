import "server-only";

// Phase 35 Plan 06 (2026-05-08): SMTP singleton and App Password provider retired.
// The env-var singleton (_defaultClient / getDefaultClient / sendEmail) and
// providers/gmail.ts (nodemailer SMTP with GMAIL_APP_PASSWORD) are gone.
//
// Active send path: lib/email-sender/account-sender.ts → getSenderForAccount()
// All 8 leaf senders (booking confirmation, owner notification, cancel booker,
// cancel owner, reschedule booker, reschedule owner, reminders, welcome) now
// go through getSenderForAccount, which uses the Gmail REST API with per-account
// OAuth credentials stored encrypted in account_oauth_credentials.
//
// This file now provides only:
//   1. Type re-exports (EmailOptions, EmailResult, etc.)
//   2. Utility re-exports (escapeHtml, stripHtml)
//
// See also: tests/__mocks__/email-sender.ts — the Vitest alias mock used by
// integration tests still exports __mockSendCalls / __resetMockSendCalls /
// sendEmail stubs for backwards-compatible test assertions.

// Types
export type {
  EmailOptions,
  EmailResult,
  EmailAttachment,
  EmailClient,
  EmailClientConfig,
  EmailProvider,
} from "./types";

// Utilities
export { escapeHtml, stripHtml } from "./utils";
