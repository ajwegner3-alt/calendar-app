# Phase 36: Resend Backend for Upgraded Accounts - Research

**Researched:** 2026-05-07
**Domain:** Resend HTTP API / email provider routing / Supabase schema migration
**Confidence:** HIGH (codebase read directly; Resend API verified via official docs + GitHub issues)

---

## Summary

Phase 36 wires a new `createResendClient` provider alongside the existing `createGmailOAuthClient`, then teaches `getSenderForAccount` to branch on `accounts.email_provider`. The codebase was read in full — every Phase 35 contract, the existing schema state, and all seven transactional callers were verified. The Resend HTTP API surface was confirmed against official docs and the resend-node GitHub issue tracker.

The primary architecture move is: upgrade `getSenderForAccount` to read `accounts.email_provider` and `accounts.resend_status` in its existing DB query, then route to either the existing Gmail path or the new Resend path. The Resend provider is a peer of `gmail-oauth.ts` — same `EmailClient` interface, same refuse-send error shape, same no-throw policy, lazy `RESEND_API_KEY` env read.

All seven transactional callers already go through `getSenderForAccount`. The `checkAndConsumeQuota` call in each leaf sender must be bypassed (or skipped) for Resend accounts per CONTEXT decision. The `email_send_log` table needs a `provider TEXT NOT NULL DEFAULT 'gmail'` column added with a one-shot UPDATE backfill (table is development-volume only).

**Primary recommendation:** Build `lib/email-sender/providers/resend.ts` as a sibling to `gmail-oauth.ts`, returning an `EmailClient` using raw `fetch` to `https://api.resend.com/emails`. Update `getSenderForAccount` to SELECT `email_provider, resend_status` and branch. Add migration for `accounts.email_provider`, `accounts.resend_status`, and `email_send_log.provider`. No npm package needed.

---

## Section 1: Phase 35 Sibling Patterns

### File paths (read directly from disk)

| File | Role |
|------|------|
| `lib/email-sender/providers/gmail-oauth.ts` | Gmail REST API provider — the exact sibling template |
| `lib/email-sender/account-sender.ts` | `getSenderForAccount` factory — the file Phase 36 modifies |
| `lib/email-sender/quota-guard.ts` | `checkAndConsumeQuota`, `getDailySendCount`, `getRemainingDailyQuota` |
| `lib/email-sender/types.ts` | `EmailClient`, `EmailOptions`, `EmailResult`, `EmailAttachment` |
| `lib/email-sender/utils.ts` | `stripHtml`, `escapeHtml` (comment says "Required by providers/resend.ts") |
| `lib/email-sender/index.ts` | Re-exports types only; no active send path |
| `tests/__mocks__/account-sender.ts` | Vitest alias mock for `getSenderForAccount` |
| `tests/account-sender.test.ts` | 9-case unit test for the factory — mirror this for Resend factory |

### `EmailClient` interface (from `lib/email-sender/types.ts`)

```typescript
export interface EmailClient {
  send(options: EmailOptions): Promise<EmailResult>;
  provider: EmailProvider;  // currently: type EmailProvider = "gmail"
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;       // factory owns From — callers generally don't set this
  replyTo?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}
```

**Note:** `EmailProvider` is currently `"gmail"` only. Phase 36 must extend the union to `"gmail" | "resend"`. This is a one-line change in `types.ts`.

### `REFUSED_SEND_ERROR_PREFIX` pattern (from `account-sender.ts`)

```typescript
export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";

function refusedSender(reason: string): EmailClient {
  return {
    provider: "gmail",
    async send(_: EmailOptions): Promise<EmailResult> {
      return { success: false, error: `${REFUSED_SEND_ERROR_PREFIX}: ${reason}` };
    },
  };
}
```

Phase 36 must export `RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused"` from `providers/resend.ts` (or a shared constants module). The existing callers branch on `REFUSED_SEND_ERROR_PREFIX` — they will NOT need to change because the Resend path uses a separate prefix. The `send-booking-emails.ts` orchestrator branches on `REFUSED_SEND_ERROR_PREFIX` to set `confirmation_email_sent=false` — this logic must also handle the Resend prefix.

**IMPORTANT:** The mock in `tests/__mocks__/account-sender.ts` currently exports `REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused"`. After Phase 36, the mock needs to also export `RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused"` (or the planner must decide how mock handles this).

### Lazy env-var read pattern (from `gmail-oauth.ts` commentary and `account-sender.ts`)

`RESEND_API_KEY` must be read inside the function body, not at module top level. This is required for Vitest test isolation (env-var can be set/unset per test). Pattern from the Gmail provider:

```typescript
// WRONG — module-top-level read (breaks test isolation)
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// RIGHT — lazy read inside factory function
export function createResendClient(config: ResendConfig): EmailClient {
  return {
    provider: "resend",
    async send(options: EmailOptions): Promise<EmailResult> {
      const apiKey = process.env.RESEND_API_KEY;  // read here
      if (!apiKey) { return { success: false, error: "resend_send_refused: missing RESEND_API_KEY" }; }
      // ...
    }
  };
}
```

### Factory `getSenderForAccount` current DB query

```typescript
const { data: account, error: accountErr } = await admin
  .from("accounts")
  .select("owner_user_id, owner_email")
  .eq("id", accountId)
  .maybeSingle();
```

Phase 36 must extend the `select` to also fetch `email_provider, resend_status, name`. The `name` field is needed to build the Resend `from` display name (`"Acme Plumbing <bookings@nsintegrations.com>"`).

---

## Section 2: Current Schema State

### What Phase 35 DID add (confirmed by reading migrations)

- `account_oauth_credentials` table (migration `20260506120000_phase34_account_oauth_credentials.sql`)
- `email_send_log.account_id` column (migration `20260506140000_phase35_email_send_log_account_id.sql`)

### What Phase 35 did NOT add (Phase 36 must add these)

Searching all migration files for `email_provider` or `resend_status` returned zero results. **Neither column exists.** CONTEXT.md is correct: Phase 36 adds them.

### `accounts` table current columns (reconstructed from migrations)

```
id                uuid PK
slug              text UNIQUE NOT NULL
name              text NOT NULL
owner_user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL
timezone          text NOT NULL
logo_url          text
brand_primary     text
brand_accent      text
owner_email       text
created_at        timestamptz NOT NULL DEFAULT now()
```

Plus branding columns from Phase 12 (logo/colors), and Phase 10/28 additions. The exact current set visible in the codebase. Notably: no `email_provider`, no `resend_status`.

### `email_send_log` table current columns

```
id         bigserial PK
sent_at    timestamptz NOT NULL DEFAULT now()
category   text NOT NULL CHECK (...)  -- 11 values from Phase 10 + Phase 31 expansion
account_id uuid REFERENCES accounts(id) ON DELETE SET NULL  -- added Phase 35
```

No `provider` column. Phase 36 must add it.

### Migration Phase 36 must create

One migration file covering:

```sql
-- 1. accounts: email_provider and resend_status
ALTER TABLE accounts
  ADD COLUMN email_provider TEXT NOT NULL DEFAULT 'gmail'
    CHECK (email_provider IN ('gmail', 'resend')),
  ADD COLUMN resend_status TEXT NOT NULL DEFAULT 'active'
    CHECK (resend_status IN ('active', 'suspended'));

-- 2. email_send_log: provider column with backfill
ALTER TABLE email_send_log
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'gmail';

UPDATE email_send_log SET provider = 'gmail' WHERE provider IS NULL;
-- Note: DEFAULT 'gmail' means ALTER TABLE already fills existing rows;
-- the UPDATE is a no-op but documents intent explicitly.
```

### RLS implications for `accounts` new columns

The accounts table has two RLS policies (from `20260419120001_rls_policies.sql`):
- `"owners read own account"` — SELECT for authenticated where `owner_user_id = auth.uid()`
- `"owners update own account"` — UPDATE for authenticated where `owner_user_id = auth.uid()`

Adding columns does NOT require new policies. The existing SELECT policy already allows the owner to read all columns on their account row. The existing UPDATE policy allows the owner to update all columns. Since `email_provider` is flipped manually by Andrew in the Supabase dashboard (service-role context, bypasses RLS), and the factory reads it via `createAdminClient()` (service-role, bypasses RLS), no new RLS work is needed.

### `email_send_log` backfill safety

The `email_send_log` table is a development-only analytics table. This is a calendar app in early development (Phase 36 out of ~40 planned phases). Row count is negligible (dozens to low hundreds at most). A one-shot `DEFAULT 'gmail'` on the `ALTER TABLE` implicitly backfills existing rows via PostgreSQL's `DEFAULT` constant-value fast path (no rewrite needed for constant defaults on unlogged/small tables). No concurrent-write concern: the column default handles any rows inserted during migration.

---

## Section 3: Resend HTTP API Surface

**Confidence:** HIGH — verified via official Resend docs (WebFetch) and resend-node GitHub issue tracker.

### Endpoint

```
POST https://api.resend.com/emails
Content-Type: application/json
Authorization: Bearer {RESEND_API_KEY}
```

### Request body (JSON)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `from` | string | YES | `"Display Name <email@domain>"` format supported |
| `to` | string \| string[] | YES | Up to 50 recipients |
| `subject` | string | YES | — |
| `html` | string | NO | At least one of html/text required |
| `text` | string | NO | Auto-generated from html if omitted |
| `reply_to` | string \| string[] | NO | For owner Reply-To threading |
| `cc` | string \| string[] | NO | — |
| `bcc` | string \| string[] | NO | — |
| `attachments` | array | NO | See below |
| `headers` | object | NO | Custom headers |
| `tags` | array | NO | `[{name, value}]` — analytics metadata |

**Note:** Resend uses `reply_to` (snake_case), not `replyTo` (camelCase). The `EmailOptions` type uses `replyTo`. The Resend provider must map `options.replyTo → body.reply_to`.

### Attachments object

| Field | Type | Notes |
|-------|------|-------|
| `filename` | string | Required — shown to recipient |
| `content` | Buffer \| string | Base64 string or raw Buffer |
| `path` | string | Alternative to `content` (hosted URL) |
| `content_type` | string | MIME type; derived from filename if omitted |
| `content_id` | string | For CID inline embedding |

**No `disposition` field documented.** Attachments are sent as regular (downloadable) attachments by default.

### Success response

```json
{ "id": "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }
```
HTTP 200. The `id` field maps to `EmailResult.messageId`.

### Error response body (confirmed via resend-node GitHub issue #286)

```json
{
  "name": "validation_error",
  "statusCode": 422,
  "message": "Invalid `to` field. The email address needs to follow the `email@example.com` or `Name <email@example.com>` format."
}
```

All error responses include `name` (string error type), `statusCode` (number), and `message` (string description).

### Known error names

| HTTP | `name` | Trigger |
|------|--------|---------|
| 400 | `validation_error`, `invalid_idempotency_key` | Bad request body |
| 401 | `missing_api_key` | No Authorization header |
| 403 | `invalid_api_key`, `validation_error` | Bad key or domain not verified |
| 422 | `invalid_from_address`, `invalid_attachment`, `missing_required_field`, `invalid_parameter` | Semantic validation |
| 429 | `rate_limit_exceeded`, `daily_quota_exceeded`, `monthly_quota_exceeded` | Rate/quota |
| 500 | `application_error`, `internal_server_error` | Resend infra |

### Rate limits (confirmed via official Resend docs)

- Default: **5 requests per second per team** (not per API key)
- On 429: response body has `name: "rate_limit_exceeded"` or quota variant
- Resend free tier: 3,000 emails/month, 100/day
- Resend paid: much higher limits

**CONTEXT decision:** Soft ceiling at 5,000 sends/day per Resend account with `console.warn` (no block). No hard limit enforcement needed in Phase 36 code.

### Provider implementation sketch

```typescript
// lib/email-sender/providers/resend.ts
import "server-only";
import type { EmailClient, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface ResendConfig {
  /** Display name: e.g. "Acme Plumbing". Combined with NSI from address. */
  fromName: string;
  /** NSI verified domain address: e.g. "bookings@nsintegrations.com" */
  fromAddress: string;
  /** Account owner email — used as Reply-To so customers reply to the business. */
  replyToAddress: string;
}

export function createResendClient(config: ResendConfig): EmailClient {
  const from = `${config.fromName} <${config.fromAddress}>`;

  return {
    provider: "resend",
    async send(options: EmailOptions): Promise<EmailResult> {
      const apiKey = process.env.RESEND_API_KEY;   // lazy read — test isolation
      if (!apiKey) {
        return { success: false, error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: missing RESEND_API_KEY` };
      }

      const body: Record<string, unknown> = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text ?? stripHtml(options.html),
        reply_to: options.replyTo ?? config.replyToAddress,  // note snake_case
      };

      if (options.cc)  body.cc  = options.cc;
      if (options.bcc) body.bcc = options.bcc;

      if (options.attachments?.length) {
        body.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content)
            ? att.content.toString("base64")
            : att.content,
          content_type: att.contentType,  // note snake_case
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
          const errBody = await res.json().catch(() => ({})) as { name?: string; message?: string; statusCode?: number };
          const detail = errBody.message ?? errBody.name ?? "unknown";
          return { success: false, error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${res.status} ${detail}` };
        }

        const json = await res.json() as { id?: string };
        return { success: true, messageId: json.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown fetch error";
        return { success: false, error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${msg}` };
      }
    },
  };
}
```

---

## Section 4: .ics Inline Rendering Recommendation

**Confidence:** MEDIUM — confirmed via resend-node GitHub issue #198 and Gmail community docs; not confirmed by authoritative Resend docs.

### What "inline" means for Gmail

Gmail renders a "Yes / Maybe / No" RSVP card inline in the email body when ALL of these conditions are met:

1. The email has an `invite.ics` (or similar) attachment with `Content-Type: text/calendar; method=REQUEST`
2. The `.ics` file includes `METHOD:REQUEST` in the calendar body
3. The sender's domain is recognized (Google Workspace, or verified third-party domain)
4. The recipient's email is listed as an ATTENDEE in the `.ics`

### Resend attachment field mapping

The existing Gmail OAuth path sets `contentType: "text/calendar; method=REQUEST"` on the `EmailAttachment` object. The Resend provider must map this to `content_type: "text/calendar; method=REQUEST"` in the Resend attachment body (snake_case, not camelCase).

From the resend-node GitHub issue #198: Gmail recognizes the ICS when sent via Resend with `content_type: 'text/calendar; method=REQUEST'`. Outlook does NOT recognize it without this field (which is why Outlook fails). Setting `content_type` correctly is sufficient for Gmail RSVP card rendering.

### Recommendation

Use `content_type: "text/calendar; method=REQUEST"` on the Resend attachment body. This mirrors exactly what the Gmail OAuth path does, and the GitHub issue confirms Gmail handles it correctly.

**Fallback:** If the RSVP card does not render (a live test concern, deferred to PREREQ-03 activation), downgrade to the existing behavior: attachment is still downloadable, user can manually add to calendar. No code change needed for the fallback — the `.ics` file itself is still valid.

**Verification note:** Full inline RSVP testing requires a live Resend API key with verified NSI domain (PREREQ-03). This phase ships the code; verification is deferred.

---

## Section 5: Caller Inventory (7 Transactional + Welcome/Signup)

**Confidence:** HIGH — all files read directly.

All transactional callers already route through `getSenderForAccount`. No caller bypasses the factory directly. No changes to caller files are needed in Phase 36 — the provider switch is transparent.

### The 7 transactional senders

| File | Function | Emails sent | `checkAndConsumeQuota` category |
|------|----------|-------------|--------------------------------|
| `lib/email/send-booking-confirmation.ts` | `sendBookingConfirmation` | Booker confirmation + `.ics` | `booking-confirmation` |
| `lib/email/send-owner-notification.ts` | `sendOwnerNotification` | Owner new-booking alert | `owner-notification` |
| `lib/email/send-cancel-emails.ts` | `sendCancelEmails` → `sendBookerCancelEmail` + `sendOwnerCancelEmail` | Cancel to booker + owner | `cancel-booker`, `cancel-owner` |
| `lib/email/send-reschedule-emails.ts` | `sendRescheduleEmails` → `sendBookerRescheduleEmail` + `sendOwnerRescheduleEmail` | Reschedule to booker + owner | `reschedule-booker`, `reschedule-owner` |
| `lib/email/send-reminder-booker.ts` | `sendReminderBooker` | Reminder to booker | `reminder` |

The orchestrator is `lib/email/send-booking-emails.ts` (`sendBookingEmails`), which calls the two booking-side senders and handles `confirmation_email_sent` flagging. It also branches on `REFUSED_SEND_ERROR_PREFIX` — Phase 36 must ensure Resend refusals also trigger the `confirmation_email_sent=false` flag. The simplest approach: update `send-booking-emails.ts` to also check `RESEND_REFUSED_SEND_ERROR_PREFIX`, OR make both prefixes share a common check helper.

### Welcome email (`lib/onboarding/welcome-email.ts`)

`sendWelcomeEmail` calls `getSenderForAccount(account.id)`. CONTEXT decision: welcome email continues on Gmail path during Phase 36. **The factory handles this automatically** — welcome email is called with `account.id`, and if that account has `email_provider = 'gmail'` (which all accounts will at Phase 36 launch), Gmail path is used. No special handling needed.

The file comment says: "Phase 36 will swap the provider to Resend; the accountId threading is already in place, so that migration only needs to change getSenderForAccount." This confirms the factory-level routing is the right abstraction.

### Signup-verify / password-reset / email-change

These go through Supabase Auth's own email system (not `getSenderForAccount`). They are completely separate from this phase and require no changes.

### Quota guard interaction (CONTEXT decision: Resend accounts skip the 200/day cap)

Each leaf sender calls `checkAndConsumeQuota(category, accountId)` BEFORE calling `getSenderForAccount`. For Resend accounts, this quota check is irrelevant (the 200/day cap is a Gmail concern). CONTEXT says "short-circuit the `checkAndConsumeQuota` call" for Resend accounts.

**Implementation options:**

1. **Factory signals skip** — `getSenderForAccount` returns an `EmailClient` with a `.skipQuota: true` flag; callers check before calling `checkAndConsumeQuota`. This requires touching all 7 callers.

2. **Quota guard detects provider** — `checkAndConsumeQuota` reads `email_provider` for the account and skips the cap. This centralizes the change but adds a DB read in the quota guard.

3. **Routing in `getSenderForAccount` wrapper** — `getSenderForAccount` itself does the quota log insert but skips the cap check when provider is `resend`. The leaf senders don't need to change.

**Recommended:** Option 2 modified — add `checkAndConsumeQuota` short-circuit via an `accountId`-lookup OR pass `provider` as a parameter. The cleanest approach for Phase 36 framework-only is to check `email_provider` inside `checkAndConsumeQuota` so none of the 7 leaf callers need touching. But this adds a DB read to every quota check. Alternative: add an optional `provider?: string` param to `checkAndConsumeQuota` that callers pass through (factory populates it before returning the client). Planner should decide. Most conservative: the factory adds the log entry directly for Resend accounts and returns a client, bypassing the guard entirely — the guard only runs when `email_provider = 'gmail'`.

**The simplest implementation that touches the fewest files:** Modify `getSenderForAccount` to also log the send to `email_send_log` (with `provider='resend'`) for Resend accounts and return a Resend client. The leaf callers still call `checkAndConsumeQuota` but the quota guard's `getDailySendCount` will not find the Resend log rows (because they're already inserted before the guard runs... actually this is wrong). **Planner must decide the quota bypass pattern** — this is the single biggest architectural question.

---

## Section 6: Test Mocking Pattern from Phase 35

**Confidence:** HIGH — tests read directly.

### Vitest alias mock setup (from `vitest.config.ts`)

```typescript
// vitest.config.ts — two aliases relevant to Phase 36
{
  find: /^@\/lib\/email-sender$/,
  replacement: path.resolve(__dirname, "tests/__mocks__/email-sender.ts"),
},
{
  find: /^@\/lib\/email-sender\/account-sender$/,
  replacement: path.resolve(__dirname, "tests/__mocks__/account-sender.ts"),
},
```

Phase 36 unit tests for the Resend provider itself (`tests/resend-provider.test.ts`) should NOT use these aliases — they test the provider directly and mock `globalThis.fetch` instead.

### How `account-sender.test.ts` mocks its dependencies

The pattern: `vi.mock("@/lib/supabase/admin", ...)` with a chainable Supabase mock factory. `vi.mock("@/lib/oauth/google", ...)` with `vi.fn()`. All mocks registered at module top; actual import at bottom of mock block.

**For the Resend provider unit tests**, the pattern is simpler:

```typescript
// tests/resend-provider.test.ts pattern
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock globalThis.fetch for HTTP isolation
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set env var inside test (lazy read pattern requires this)
beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  mockFetch.mockReset();
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
});

import { createResendClient, RESEND_REFUSED_SEND_ERROR_PREFIX } from "../lib/email-sender/providers/resend";
```

### Key test cases to mirror from `account-sender.test.ts`

The 9-case structure in `account-sender.test.ts`:
1. Happy path — returns EmailClient with correct provider
2. Missing API key — refused
3. Resend HTTP 422 error — refused with prefix
4. Resend HTTP 429 rate limit — refused with prefix
5. Resend HTTP 500 — refused with prefix
6. `fetch` throws (network error) — refused with prefix
7. `account_suspended` status — refused without calling fetch
8. `RESEND_REFUSED_SEND_ERROR_PREFIX` exported constant value check
9. Attachment content_type mapping (snake_case)

### Integration tests (the 7 leaf sender tests)

Integration tests (`tests/send-booking-emails.test.ts`, `tests/send-cancel-emails.test.ts`, etc.) already mock `@/lib/email-sender/account-sender` via the Vitest alias. These tests do NOT need to change — they test the leaf senders in isolation from the factory. The mock stub returns a successful `EmailClient` regardless of provider.

The `tests/__mocks__/account-sender.ts` mock may need updating to export `RESEND_REFUSED_SEND_ERROR_PREFIX` if any test branches on it. The `send-booking-emails.ts` orchestrator checks `REFUSED_SEND_ERROR_PREFIX` — if it also needs to check `RESEND_REFUSED_SEND_ERROR_PREFIX`, the mock must export it too.

---

## Section 7: Abuse Ceiling Helper Design

**Confidence:** HIGH (design is Claude's discretion per CONTEXT)

### Does a threshold-only sibling already exist?

No. `quota-guard.ts` exports `getDailySendCount`, `checkAndConsumeQuota`, `getRemainingDailyQuota`, and `logQuotaRefusal`. None of these are threshold-only warn helpers.

### Proposed helper

Add to `lib/email-sender/quota-guard.ts`:

```typescript
/** Resend soft abuse ceiling — 5,000 sends/day per account.
 * Emits console.warn when crossed; does NOT block.
 * Called pre-send for Resend accounts only.
 */
const RESEND_ABUSE_WARN_THRESHOLD = 5000;

export async function warnIfResendAbuseThresholdCrossed(accountId: string): Promise<void> {
  const count = await getDailySendCount(accountId);
  if (count >= RESEND_ABUSE_WARN_THRESHOLD) {
    console.warn("[RESEND_ABUSE_THRESHOLD_CROSSED]", {
      account_id: accountId,
      count,
      threshold: RESEND_ABUSE_WARN_THRESHOLD,
    });
  }
}
```

**Where to call it:** Inside `getSenderForAccount` after confirming `email_provider = 'resend'`, before constructing the Resend client. Fire-and-forget (`void warnIfResendAbuseThresholdCrossed(accountId)`) — do not await (avoid blocking the send path on an advisory check).

**Note:** `getDailySendCount` queries `email_send_log WHERE account_id = $1 AND sent_at >= today`. For Resend accounts, the `email_send_log` rows will have `provider = 'resend'` but the count query does not filter by provider — it counts ALL sends for the account. This is correct: the 5,000 ceiling is total sends per account per day regardless of provider.

---

## Section 8: Accounts RLS and email_send_log Backfill Notes

### accounts RLS — no new policies needed

Existing policies:
- `"owners read own account"` — SELECT on accounts WHERE `owner_user_id = auth.uid()`
- `"owners update own account"` — UPDATE on accounts WHERE `owner_user_id = auth.uid()`

Adding `email_provider` and `resend_status` columns is schema-only. The columns are readable by authenticated account owners via the existing SELECT policy. Updates are writable by authenticated account owners via the existing UPDATE policy (but Andrew flips via service-role dashboard, which bypasses RLS entirely). No new policies needed.

`getSenderForAccount` reads via `createAdminClient()` (service-role) — bypasses RLS unconditionally.

### email_send_log provider column backfill

The `email_send_log` table has no RLS policies (service-role only). Row count in this development project is negligible (dozens). The `ALTER TABLE ... ADD COLUMN ... DEFAULT 'gmail'` will use PostgreSQL's fast-path constant-default, setting `provider = 'gmail'` on all existing rows instantly via the catalog (no row rewrite). The subsequent `UPDATE email_send_log SET provider = 'gmail' WHERE provider IS NULL` is a no-op (included for documentation clarity). No concurrent write concern — any inserts during migration get the `DEFAULT 'gmail'` automatically.

### `email_send_log.provider` insert path

The `checkAndConsumeQuota` function currently inserts:
```typescript
await admin.from("email_send_log").insert({ category, account_id: accountId });
```

With the new `provider` column (DEFAULT `'gmail'`), this existing insert continues to work unchanged — the column gets its default. For Resend accounts, the log insert needs `provider: 'resend'`. If Resend accounts bypass `checkAndConsumeQuota` entirely (as CONTEXT implies), the factory must insert directly with `provider: 'resend'`. If Resend accounts call a modified `checkAndConsumeQuota` that accepts a `provider` param, pass `'resend'`. The planner must decide this in conjunction with the quota bypass pattern (Section 5).

---

## Section 9: Open Questions for the Planner

### OQ-1: Quota guard bypass pattern (HIGHEST PRIORITY)

CONTEXT says Resend accounts skip `checkAndConsumeQuota`. The 7 leaf callers all call it. Options:

- **A:** Modify `checkAndConsumeQuota` signature to accept `provider?: string`; skip cap check (but still log) when `provider = 'resend'`. Leaf callers pass provider from factory result.
- **B:** `getSenderForAccount` returns metadata alongside the client (e.g., `{ client, provider }`) so callers can conditionally skip. Requires touching all 7 leaf callers.
- **C:** `getSenderForAccount` does the log insert itself for Resend accounts and wraps the EmailClient in a way that the quota guard knows to skip. Complex.
- **D:** Add `provider` query to each leaf sender before calling `checkAndConsumeQuota`. Defeats the factory abstraction.

**Recommended A** — least disruption, no leaf-caller changes needed, centralizes provider-aware logic in `quota-guard.ts`. The factory returns `{ client, provider: 'resend' }` (or adds `.provider` to the EmailClient which it already has), and `checkAndConsumeQuota` is extended to accept an optional `provider` override that bypasses the cap.

Actually simpler: since `EmailClient.provider` is already exposed, the leaf senders could read `sender.provider` after `getSenderForAccount` and conditionally call `checkAndConsumeQuota`. This requires leaf-caller changes but is explicit. **Planner must choose.**

### OQ-2: `confirmation_email_sent` flag and Resend refusals

`send-booking-emails.ts` sets `confirmation_email_sent = false` when `confResult.value.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)`. If a Resend send refuses (`resend_send_refused:`), this check misses it. The planner must decide: update the startsWith check to cover both prefixes, OR add a shared helper `isRefusedSend(error?: string)` that checks both prefixes.

### OQ-3: `types.ts` EmailProvider union extension

Currently `type EmailProvider = "gmail"`. Phase 36 must add `"resend"`. The `refusedSender` in `account-sender.ts` returns `provider: "gmail"` — should it return the actual provider? Low priority but worth consistency check.

### OQ-4: Migration timestamp

The migration filename must be higher than `20260506140000` (the last Phase 35 migration). Use `20260507120000_phase36_resend_provider.sql` or similar.

---

## Standard Stack

No new npm packages. Phase 36 uses:

| Tool | Version | Purpose |
|------|---------|---------|
| `fetch` (global) | Node.js built-in | HTTP calls to Resend API — no package needed |
| Supabase admin client | existing | Read `accounts.email_provider` |
| Vitest `vi.stubGlobal` | existing | Mock `fetch` in unit tests |

**Do not install the `resend` npm package.** Raw fetch keeps the dep tree minimal and matches the lazy-env pattern.

---

## Architecture Patterns

### Recommended project structure addition

```
lib/email-sender/
├── providers/
│   ├── gmail-oauth.ts          # existing — sibling template
│   └── resend.ts               # NEW — Phase 36
├── account-sender.ts           # MODIFIED — add email_provider routing
├── quota-guard.ts              # MODIFIED — provider-aware bypass
├── types.ts                    # MODIFIED — extend EmailProvider union
├── utils.ts                    # unchanged
└── index.ts                    # unchanged

supabase/migrations/
└── 20260507120000_phase36_resend_provider.sql   # NEW

tests/
├── resend-provider.test.ts      # NEW — unit tests for createResendClient
└── __mocks__/
    └── account-sender.ts        # MODIFIED — export RESEND_REFUSED_SEND_ERROR_PREFIX
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client for Resend | Custom retry/timeout wrapper | `fetch` with direct error handling | Phase 35 pattern; Vercel timeout handles hung requests |
| Email address validation | Custom regex | Rely on Resend's 422 response | Resend validates and returns clear error messages |
| Base64 attachment encoding | Custom encoder | `Buffer.from(content).toString("base64")` | Already used in gmail-oauth.ts |

---

## Common Pitfalls

### Pitfall 1: camelCase vs snake_case in Resend body
**What goes wrong:** Sending `replyTo` instead of `reply_to`, or `contentType` instead of `content_type`. Resend silently ignores unknown fields; Reply-To is missing from the sent email.
**Prevention:** The provider must explicitly map `options.replyTo → body.reply_to` and `att.contentType → attachment.content_type`.

### Pitfall 2: Module-top-level RESEND_API_KEY read
**What goes wrong:** `const apiKey = process.env.RESEND_API_KEY` at module top level. In Vitest, the module is loaded once; `process.env.RESEND_API_KEY` is read before each test can set it.
**Prevention:** Read inside the `send()` function body (lazy read).

### Pitfall 3: EmailProvider type not extended
**What goes wrong:** `provider: "resend"` on the EmailClient fails TypeScript compilation because `EmailProvider = "gmail"`.
**Prevention:** Extend `types.ts` first: `type EmailProvider = "gmail" | "resend"`.

### Pitfall 4: Quota guard still counting Resend sends against Gmail cap
**What goes wrong:** Resend account sends still hit `checkAndConsumeQuota` → after 200 sends, the Resend account gets falsely quota-blocked.
**Prevention:** Implement the quota bypass pattern (OQ-1) before wiring Resend accounts.

### Pitfall 5: `send-booking-emails.ts` not handling `RESEND_REFUSED_SEND_ERROR_PREFIX`
**What goes wrong:** A Resend API failure doesn't set `confirmation_email_sent = false` because the startsWith check only covers `oauth_send_refused`.
**Prevention:** Update the check to cover both prefixes (OQ-2).

### Pitfall 6: `refusedSender` returns `provider: "gmail"` in Resend path
**What goes wrong:** When the factory refuses (e.g., `resend_status = 'suspended'`), it returns a refusedSender with `provider: "gmail"`. Callers reading `.provider` get wrong information.
**Prevention:** Create a `resendRefusedSender` that returns `provider: "resend"`.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `lib/email-sender/providers/gmail-oauth.ts`, `lib/email-sender/account-sender.ts`, `lib/email-sender/types.ts`, `lib/email-sender/quota-guard.ts`, `lib/email-sender/utils.ts`, `lib/email-sender/index.ts`, `tests/account-sender.test.ts`, `tests/__mocks__/account-sender.ts`, `vitest.config.ts`, all `lib/email/**/*.ts`, `lib/onboarding/welcome-email.ts`
- Direct file reads: all `supabase/migrations/*.sql` files covering accounts, email_send_log, account_oauth_credentials
- Official Resend docs (WebFetch): `https://resend.com/docs/api-reference/emails/send-email` — request body, attachment fields, success response
- Official Resend docs (WebFetch): `https://resend.com/docs/api-reference/introduction` — rate limits (5 req/sec default)
- Official Resend docs (WebFetch): `https://resend.com/docs/api-reference/errors` — error type list

### Secondary (MEDIUM confidence)
- GitHub resend-node issue #286: Error response JSON shape `{ name, statusCode, message }`
- GitHub resend-node issue #198: ICS attachments work in Gmail via Resend with `content_type: 'text/calendar; method=REQUEST'`

---

## Metadata

**Confidence breakdown:**
- Sibling Phase 35 patterns: HIGH — all files read directly
- Current schema state: HIGH — all migration files verified; email_provider/resend_status absent confirmed
- Resend HTTP API: HIGH — official docs fetched; error shape confirmed via GitHub issue
- .ics inline rendering: MEDIUM — confirmed via community sources, not official Resend docs
- Caller inventory: HIGH — all 7 callers read directly
- Test mocking pattern: HIGH — vitest.config.ts and all mock files read directly
- Abuse ceiling helper: HIGH — design is Claude's discretion per CONTEXT; existing code read
- Quota bypass pattern: MEDIUM — multiple valid approaches; planner must choose

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable domain — Resend API rarely breaks; codebase findings expire with next migration)
