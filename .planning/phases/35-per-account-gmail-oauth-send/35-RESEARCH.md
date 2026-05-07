# Phase 35: Per-Account Gmail OAuth Send - Research

**Researched:** 2026-05-06
**Domain:** Nodemailer OAuth2 transport, per-account sender factory, quota isolation, invalid_grant handling, CP-03 strangler-fig cutover
**Confidence:** HIGH (all findings from direct codebase inspection; nodemailer OAuth2 config from official docs; patterns from Phase 28/31/34 verified artifacts)

---

## Summary

Phase 35 replaces the centralized SMTP singleton (`lib/email-sender/index.ts:sendEmail`) with a per-account sender factory (`getSenderForAccount(accountId)`). All seven transactional email paths call the factory instead of the singleton. The factory reads each account's encrypted refresh token from `account_oauth_credentials`, exchanges it for an access token via Google's token endpoint, and creates a nodemailer OAuth2 transporter for that account.

The existing codebase is well-prepared: Phase 34 already ships `account_oauth_credentials` with encrypted refresh tokens, `lib/oauth/encrypt.ts` for decryption, and a `needs_reconnect` status field for revocation signaling. Phase 31 already ships per-path `checkAndConsumeQuota()` calls on all 7 paths. The quota-guard table (`email_send_log`) needs an `account_id` column added so counts filter per-account rather than globally.

**Primary recommendation:** Build `lib/email-sender/gmail-oauth.ts` as a new nodemailer transporter variant. Build `lib/email-sender/account-sender.ts` as the factory that decrypts the stored token, calls the OAuth2 transporter, and handles `invalid_grant` by flagging `needs_reconnect` in the DB and returning a no-op sender. All 7 send paths receive `accountId` (already available in every call site) and call `getSenderForAccount(accountId)` instead of `sendEmail(...)`. Retire the SMTP singleton in a separate post-verification deploy.

---

## Standard Stack

### Core (no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nodemailer` | `^8.0.6` (already installed) | Creates OAuth2 SMTP transporter | Official; built-in OAuth2 support via `auth: { type: "OAuth2", refreshToken, clientId, clientSecret }` |
| `node:crypto` | built-in | Decrypt refresh tokens from `account_oauth_credentials` | Already used in `lib/oauth/encrypt.ts` |
| `@supabase/supabase-js` | already installed | Admin client for reading credentials + writing `needs_reconnect` status | Already used everywhere |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | already installed | Prevent accidental client import of factory | Mark `lib/email-sender/account-sender.ts` with it |

### What Nodemailer OAuth2 Transport Requires

Nodemailer's built-in `type: "OAuth2"` auth handles token refresh automatically but requires `clientId` and `clientSecret` in addition to `refreshToken`. These are the same Google OAuth app credentials already stored in Supabase as the Google provider configuration.

**CRITICAL FINDING:** The Google OAuth `clientId` and `clientSecret` are stored in Supabase's Google provider config (set via Supabase Dashboard → Authentication → Providers → Google), NOT in `.env.local`. They must be added as Vercel env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) for the nodemailer factory to exchange refresh tokens. Phase 34 CONTEXT references `PREREQ-04` for Vercel env vars — this is exactly what that prerequisite covers.

**Alternatively** (simpler, no extra env vars): Do a manual HTTP token exchange on each send rather than using nodemailer's built-in OAuth2 refresh. POST to `https://oauth2.googleapis.com/token` with `{client_id, client_secret, refresh_token, grant_type: "refresh_token"}` to get a short-lived `access_token`, then pass that access token directly to the nodemailer transporter. This approach is already half-implemented in `lib/oauth/google.ts` (the file has `fetchGoogleGrantedScopes` and `revokeGoogleRefreshToken` using fetch). A `fetchGoogleAccessToken(refreshToken)` function is the natural extension.

**Recommended approach:** Manual HTTP token exchange (no clientId/clientSecret needed in nodemailer auth). Instead of `type: "OAuth2"` with refresh, use a fresh `xoauth2` access token per-send:

```typescript
// Option A: nodemailer with pre-fetched access token (no clientId/clientSecret needed)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: gmailAddress,
    accessToken: freshAccessToken,   // fetched manually, valid 1h
  },
});
```

This avoids adding new env vars and keeps the credential surface minimal.

**Installation:**
```bash
# No new packages required
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── email-sender/
│   ├── index.ts                  # EXISTING singleton — retired in deploy step 3
│   ├── types.ts                  # EXISTING — unchanged
│   ├── quota-guard.ts            # MODIFY — add accountId param to getDailySendCount + checkAndConsumeQuota
│   ├── providers/
│   │   ├── gmail.ts              # EXISTING SMTP provider — retired with singleton
│   │   └── gmail-oauth.ts        # NEW — createGmailOAuthClient(gmailAddress, accessToken)
│   └── account-sender.ts         # NEW — getSenderForAccount(accountId): Promise<EmailClient>
├── oauth/
│   ├── encrypt.ts                # EXISTING — decryptToken() used by factory
│   └── google.ts                 # MODIFY — add fetchGoogleAccessToken(refreshToken)
└── email/
    ├── send-booking-emails.ts    # MODIFY — pass accountId, use getSenderForAccount
    ├── send-booking-confirmation.ts  # MODIFY — accept EmailClient param instead of calling sendEmail
    ├── send-owner-notification.ts    # MODIFY — same
    ├── send-cancel-emails.ts         # MODIFY — same
    ├── send-reschedule-emails.ts     # MODIFY — same
    └── send-reminder-booker.ts       # MODIFY — same

supabase/migrations/
└── 20260506XXXXXX_phase35_email_send_log_account_id.sql  # NEW
```

### Pattern 1: Sender Factory (`getSenderForAccount`)

**What:** Async factory that resolves the account's Gmail OAuth credential, fetches a fresh access token, and returns an `EmailClient` instance. On missing or revoked credentials returns a no-op `RefusedEmailClient`.

**When to use:** Every email send path, replacing direct `sendEmail()` calls.

**Design decision (Claude's discretion):** Object with `.send()` method (matches existing `EmailClient` interface). No caching — each call fetches a fresh access token (access tokens expire in 1h; Vercel serverless functions don't share memory between invocations anyway, making LRU caching pointless).

```typescript
// Source: codebase inspection + nodemailer official docs
// lib/email-sender/account-sender.ts

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/encrypt";
import { fetchGoogleAccessToken } from "@/lib/oauth/google";
import { createGmailOAuthClient } from "./providers/gmail-oauth";
import type { EmailClient, EmailOptions, EmailResult } from "./types";

/** Returned when credentials are missing or revoked. send() is a no-op. */
const REFUSED_SENDER: EmailClient = {
  provider: "gmail",
  async send(_: EmailOptions): Promise<EmailResult> {
    return { success: false, error: "oauth_send_refused: no valid credential" };
  },
};

/**
 * Resolve the Gmail OAuth sender for an account.
 *
 * Flow:
 *  1. Fetch credential row by account_id (via accounts.owner_user_id join).
 *  2. Decrypt refresh_token_encrypted.
 *  3. Exchange refresh token for fresh access token (POST /token).
 *  4. On invalid_grant: UPDATE status='needs_reconnect'; return REFUSED_SENDER.
 *  5. Return EmailClient backed by the fresh access token.
 *
 * Never throws. Returns REFUSED_SENDER on any failure path.
 */
export async function getSenderForAccount(accountId: string): Promise<EmailClient> {
  const admin = createAdminClient();

  // Join through accounts to get owner_user_id, then lookup credential.
  const { data: account } = await admin
    .from("accounts")
    .select("owner_user_id, owner_email")
    .eq("id", accountId)
    .maybeSingle();

  if (!account?.owner_user_id) {
    console.error("[account-sender] no account row for", accountId);
    return REFUSED_SENDER;
  }

  const { data: cred } = await admin
    .from("account_oauth_credentials")
    .select("refresh_token_encrypted, status, granted_scopes")
    .eq("user_id", account.owner_user_id)
    .eq("provider", "google")
    .maybeSingle();

  if (!cred?.refresh_token_encrypted) {
    console.error("[account-sender] no credential for account", accountId);
    return REFUSED_SENDER;
  }
  if (cred.status === "needs_reconnect") {
    console.error("[account-sender] credential needs_reconnect for account", accountId);
    return REFUSED_SENDER;
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(cred.refresh_token_encrypted);
  } catch (err) {
    console.error("[account-sender] decrypt failed for account", accountId, err);
    return REFUSED_SENDER;
  }

  const tokenResult = await fetchGoogleAccessToken(refreshToken);
  if (tokenResult.error === "invalid_grant") {
    // Mark revoked — sender factory is the authoritative place to flag this.
    await admin
      .from("account_oauth_credentials")
      .update({ status: "needs_reconnect" })
      .eq("user_id", account.owner_user_id)
      .eq("provider", "google");
    console.error("[EMAIL_OAUTH_REVOKED]", { account_id: accountId });
    return REFUSED_SENDER;
  }
  if (!tokenResult.accessToken) {
    console.error("[account-sender] token exchange failed for account", accountId, tokenResult.error);
    return REFUSED_SENDER;
  }

  const gmailAddress = account.owner_email ?? "";
  return createGmailOAuthClient({ user: gmailAddress, accessToken: tokenResult.accessToken });
}
```

### Pattern 2: Google Token Exchange

**What:** HTTP POST to Google's token endpoint to exchange a refresh token for a short-lived access token.

**Extend `lib/oauth/google.ts`** — it already has `fetchGoogleGrantedScopes` and `revokeGoogleRefreshToken`. Add:

```typescript
// lib/oauth/google.ts (addition)

export interface TokenResult {
  accessToken?: string;
  error?: string; // "invalid_grant" is the key one to detect
}

/**
 * Exchange a Google refresh token for a fresh access token.
 * Returns { accessToken } on success, { error: "invalid_grant" } on revocation,
 * { error: "..." } on other failures.
 *
 * GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set as env vars.
 * These are the same credentials stored in Supabase's Google auth provider config.
 */
export async function fetchGoogleAccessToken(refreshToken: string): Promise<TokenResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { error: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set" };
  }
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const data = await res.json() as { access_token?: string; error?: string };
    if (data.access_token) return { accessToken: data.access_token };
    return { error: data.error ?? "token_exchange_failed" };
  } catch (err) {
    console.error("[google] fetchGoogleAccessToken network error:", err);
    return { error: "network_error" };
  }
}
```

### Pattern 3: Gmail OAuth Nodemailer Client

**New file `lib/email-sender/providers/gmail-oauth.ts`** — parallel to the existing `gmail.ts` (SMTP) provider:

```typescript
// lib/email-sender/providers/gmail-oauth.ts
import nodemailer from "nodemailer";
import type { EmailClient, EmailOptions, EmailResult } from "../types";
import { stripHtml } from "../utils";

export function createGmailOAuthClient(config: {
  user: string;
  accessToken: string;
  fromName?: string;
}): EmailClient {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: config.user,
      accessToken: config.accessToken,
    },
  });
  const fromName = config.fromName ?? config.user;
  const defaultFrom = `${fromName} <${config.user}>`;

  return {
    provider: "gmail",
    async send(options: EmailOptions): Promise<EmailResult> {
      try {
        const info = await transporter.sendMail({
          from: options.from || defaultFrom,
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
        const msg = err instanceof Error ? err.message : "Unknown Gmail OAuth error";
        return { success: false, error: msg };
      }
    },
  };
}
```

### Pattern 4: Per-Account Quota (EMAIL-27)

The existing `email_send_log` table has no `account_id` column. Phase 35 adds it and updates `getDailySendCount()` and `checkAndConsumeQuota()` to filter by account.

**Migration needed:**

```sql
-- supabase/migrations/20260506XXXXXX_phase35_email_send_log_account_id.sql
ALTER TABLE email_send_log ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX email_send_log_account_sent_at_idx ON email_send_log (account_id, sent_at DESC);
```

**Updated quota-guard signatures:**

```typescript
// lib/email-sender/quota-guard.ts (updated signatures)
export async function getDailySendCount(accountId: string): Promise<number>
export async function checkAndConsumeQuota(category: EmailCategory, accountId: string): Promise<void>
export async function getRemainingDailyQuota(accountId: string): Promise<number>
```

All 7 send paths already have `account.id` available — they pass it to `logQuotaRefusal` already.

### Pattern 5: Caller Migration (Cutover Sequencing)

**Decision (Claude's discretion):** All 7 paths in one commit (no feature flag). Rationale: single-tenant nsi is the only active account during cutover; there is no multi-tenant traffic at risk. Matches CP-03 pattern from Phase 28 (clean cut, no strangler-fig needed for single-tenant).

**What each caller change looks like:**

Before (current):
```typescript
// lib/email/send-booking-confirmation.ts
import { sendEmail } from "@/lib/email-sender";
// ...
await checkAndConsumeQuota("booking-confirmation");
await sendEmail({ to: ..., subject: ..., html: ... });
```

After:
```typescript
// lib/email/send-booking-confirmation.ts
import { getSenderForAccount } from "@/lib/email-sender/account-sender";
// ...
const sender = await getSenderForAccount(accountId);
await checkAndConsumeQuota("booking-confirmation", accountId);
const result = await sender.send({ to: ..., subject: ..., html: ... });
if (!result.success) {
  // check for oauth_send_refused → treat like old QuotaExceededError for save-and-flag
}
```

**Interface changes for each of the 7 senders** — each needs `accountId` threaded in:

| File | Change needed |
|------|--------------|
| `lib/email/send-booking-confirmation.ts` | Accept `accountId` in args; use `getSenderForAccount` |
| `lib/email/send-owner-notification.ts` | Accept `accountId` in args; use `getSenderForAccount` |
| `lib/email/send-cancel-emails.ts` | Accept `accountId` in args; use `getSenderForAccount` per inner function |
| `lib/email/send-reschedule-emails.ts` | Accept `accountId` in args; use `getSenderForAccount` per inner function |
| `lib/email/send-reminder-booker.ts` | Accept `accountId` in args; use `getSenderForAccount` |
| `lib/email/send-booking-emails.ts` | Already has `account.id`; thread it into confirmation + owner notification calls |
| `lib/onboarding/welcome-email.ts` | Needs `accountId`; currently uses singleton directly |

Note: `lib/bookings/cancel.ts` and `lib/bookings/reschedule.ts` call the senders and already have `account_id` from their DB queries. The cron route (`app/api/cron/send-reminders/route.ts`) has `account_id` on each `ScanRow`. All callers have the ID available.

### Pattern 6: Revoked-Token Failure Mode (AUTH-30)

On `invalid_grant` during a booking-triggered send:

1. `getSenderForAccount()` sets `account_oauth_credentials.status = 'needs_reconnect'`.
2. Returns `REFUSED_SENDER` whose `.send()` returns `{ success: false, error: "oauth_send_refused: ..." }`.
3. The send-booking-emails orchestrator detects the refusal (same branch as QuotaExceededError) and sets `bookings.confirmation_email_sent = false`.
4. The existing `UnsentConfirmationsBanner` in `/app/bookings` renders for the owner (counts bookings where `confirmation_email_sent = false`).
5. The existing `gmail-status-panel.tsx` `needs_reconnect` state is already rendered at `/app/settings/gmail` — the "Reconnect Gmail" button CTA is already there.

**Banner placement decision (Claude's discretion):** No new site-wide banner needed. The two existing surfaces (bookings unsent-confirmations banner + settings/gmail needs_reconnect state) together cover the owner's awareness. The settings panel already shows "Reconnect needed — We lost access to your Gmail. Reconnect to keep sending emails." (verified in `gmail-status-panel.tsx:66-79`).

**What IS new for Phase 35:** A bookings-page indicator that a specific booking's email was refused due to OAuth revocation (not quota). The current `confirmation_email_sent = false` flag is used for quota; Phase 35 reuses the same flag for OAuth revocation. No schema change needed — the semantics broaden from "quota refused" to "email refused for any system reason."

### Anti-Patterns to Avoid

- **Caching access tokens in module-level variables:** Vercel serverless functions don't share memory between invocations, and cold-start caching creates stale-token bugs. Fetch fresh on every send.
- **Using nodemailer `type: "OAuth2"` with `clientId`/`clientSecret`/`refreshToken`:** This approach needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the app's env vars. The manual token exchange approach (Pattern 2) avoids this but still needs those vars. Either way, both vars must be added to Vercel.
- **Passing `from` to nodemailer with OAuth2:** With OAuth2, the authenticated Gmail address must be the `from` address. The `from` must equal `user` in the transporter config (same constraint as SMTP — noted with "DO NOT pass `from`" in all existing senders). With OAuth2 this is less strict technically but keep the same convention for consistency.
- **Counting quota globally after Phase 35:** The global `getDailySendCount()` (no account filter) becomes meaningless once each account has its own 200/day limit. All queries must filter by `account_id`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gmail OAuth2 SMTP transport | Custom SMTP adapter | `nodemailer` with `auth: { type: "OAuth2", user, accessToken }` | Already installed; handles SMTP session + MIME encoding |
| AES-256-GCM decrypt of refresh token | Custom crypto | `lib/oauth/encrypt.ts:decryptToken()` | Already exists and tested |
| Google token revocation detection | Parse error strings | Check for `error === "invalid_grant"` in JSON response from `https://oauth2.googleapis.com/token` | This is the canonical Google error string |
| Reconnect UI | New component | Extend existing `gmail-status-panel.tsx` `needs_reconnect` state | Already renders Reconnect button; just needs `status` to flip |

---

## Common Pitfalls

### Pitfall 1: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET Not in App Env

**What goes wrong:** `fetchGoogleAccessToken()` returns `{ error: "GOOGLE_CLIENT_ID not set" }`, every send is refused, the nsi account gets flagged `needs_reconnect` on first send attempt.

**Why it happens:** The Google OAuth app credentials live in Supabase's authentication config (set in Supabase Dashboard), not automatically in the Next.js app's process env. They must be added explicitly as Vercel env vars.

**How to avoid:** Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Vercel environment (Preview + Production) before the cutover deploy. These are the same client ID/secret as the ones used for Supabase's Google auth provider — find them at: GCP Console → APIs & Services → Credentials → your OAuth 2.0 client.

**Warning signs:** Every send returns `oauth_send_refused`; `[account-sender]` logs show token exchange failure (not `invalid_grant`).

### Pitfall 2: account_id Column Missing from email_send_log INSERT

**What goes wrong:** Migration hasn't run when the updated `checkAndConsumeQuota(category, accountId)` tries to insert `{ category, account_id }` — Postgres column-does-not-exist error. All sends fail at quota-check.

**How to avoid:** Run the `email_send_log` migration (add `account_id` column) BEFORE deploying the cutover commit that updates `checkAndConsumeQuota` signature.

**Warning signs:** Vercel function logs show `"null value in column account_id violates not-null constraint"` or column-not-found errors.

### Pitfall 3: Quota COUNT Without account_id Filter Returns Cross-Account Total

**What goes wrong:** If `getDailySendCount()` still runs `SELECT count(*) FROM email_send_log WHERE sent_at >= today` without `account_id` filter, then account A's sends count against account B's 200/day limit.

**How to avoid:** Update the WHERE clause to include `account_id = $1` at the same time the column is added. Don't leave the global count query in place even temporarily.

### Pitfall 4: nsi Account Credential Not Connected When Testing

**What goes wrong:** Andrew connects his Gmail via `/app/settings/gmail` but the `account_oauth_credentials` row has `user_id` = his auth user UUID, not `account_id`. The factory joins through `accounts.owner_user_id` to find the credential. If Andrew's Supabase user ID differs from what was seeded during onboarding, the join returns null and every send is refused.

**How to avoid:** After connecting, verify in Supabase Studio that `account_oauth_credentials` has a row with `user_id` matching `accounts.owner_user_id` for the nsi account. The settings page already reads by `user_id = auth.uid()` (verified in `settings/gmail/page.tsx:17`) — the same join direction the factory uses.

### Pitfall 5: Nodemailer OAuth2 `service: "gmail"` vs explicit host

**What goes wrong:** `nodemailer.createTransport({ service: "gmail", auth: { type: "OAuth2", ... } })` is documented to work, but some nodemailer versions require explicit host/port when using OAuth2 type.

**How to avoid:** Use `{ host: "smtp.gmail.com", port: 465, secure: true, auth: { type: "OAuth2", ... } }` as the fully explicit form to be safe (same as what the official nodemailer docs show for OAuth2).

### Pitfall 6: `from` Header Must Equal `user` for Gmail OAuth2

**What goes wrong:** If `options.from` is passed and it doesn't match the authenticated Gmail address (`user` in the transporter config), Gmail rejects with `550 5.7.0 Must issue a STARTTLS command first` or sends fail silently with wrong sender.

**How to avoid:** In `createGmailOAuthClient`, always derive `defaultFrom` from `config.user`. Remove the existing "DO NOT pass `from`" comments in all 7 senders and replace with "from MUST equal the authenticated Gmail address for this account." The sender factory owns `from` — callers must not override it.

### Pitfall 7: SMTP Singleton Still Imported After Cutover Commit

**What goes wrong:** A send path that wasn't updated still calls `sendEmail()` from `lib/email-sender/index.ts`, which uses `GMAIL_APP_PASSWORD`. After the SMTP removal commit in step 3, `getDefaultClient()` throws because `GMAIL_APP_PASSWORD` is undefined.

**How to avoid:** Before the SMTP removal commit, run: `grep -rn "from.*email-sender/index\|sendEmail" app/ lib/` and confirm zero direct `sendEmail()` imports remain (only the singleton file itself, which is about to be deleted).

---

## Code Examples

### Booking Route: How `account.id` Is Already Available

```typescript
// app/api/bookings/route.ts (existing, lines 170-181)
const { data: account, error: acctError } = await supabase
  .from("accounts")
  .select("id, slug, name, timezone, owner_email, logo_url, brand_primary")
  .eq("id", eventType.account_id)
  .single();
// account.id is available — pass to sendBookingEmails as accountId
```

### Cancel Route: `account_id` Already on Booking Row

```typescript
// lib/bookings/cancel.ts (existing, line 108)
// The pre-fetch query at line 106 returns account_id on the booking row.
// The join also returns accounts!inner(name, slug, timezone, owner_email, ...).
// Pass pre.account_id to sendCancelEmails as accountId.
```

### Cron Route: `account_id` on ScanRow

```typescript
// app/api/cron/send-reminders/route.ts (existing, ScanRow shape at line 70-93)
interface ScanRow {
  id: string;
  account_id: string;  // available — pass to sendReminderBooker
  // ...
}
```

### SMTP Removal Checklist (Step 3 Deploy)

Files to delete or gut in the SMTP removal commit:

| File | Action |
|------|--------|
| `lib/email-sender/index.ts` | Delete `_defaultClient`, `getDefaultClient()`, `sendEmail()` — keep `createEmailClient` factory and type exports |
| `lib/email-sender/providers/gmail.ts` | Delete (SMTP App Password provider) |
| `.env.example` lines 41-43 | Delete `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` |
| `.env.local` lines 40-42 | Delete same three vars |
| All senders' `// DO NOT pass \`from\`` comments referencing GMAIL_FROM_NAME | Update to new OAuth comment |

**Verify before removing:** `grep -rn "GMAIL_APP_PASSWORD\|GMAIL_FROM_NAME\|getDefaultClient\|sendEmail" lib/ app/` should return zero hits (only `.env.example` and `.env.local` comments).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `sendEmail()` SMTP singleton | Per-account `getSenderForAccount(accountId)` factory | Phase 35 | Quota isolation; per-account identity in From header |
| Global 200/day quota across all accounts | Per-account 200/day quota | Phase 35 | Account A exhaustion does not block account B |
| `GMAIL_APP_PASSWORD` env var | `account_oauth_credentials.refresh_token_encrypted` | Phase 35 (retire step) | No plaintext credential in env; credential rotation via settings UI |
| `email_send_log` no account filter | `email_send_log` filtered by `account_id` | Phase 35 (migration) | Accurate per-account quota counts |

**Deprecated/outdated after Phase 35 retire step:**
- `lib/email-sender/providers/gmail.ts` (SMTP App Password provider)
- `_defaultClient` singleton in `lib/email-sender/index.ts`
- `sendEmail()` function in `lib/email-sender/index.ts`
- `GMAIL_APP_PASSWORD`, `GMAIL_USER`, `GMAIL_FROM_NAME` env vars

---

## Phase 34 Prerequisite Status (Verify Before Starting)

| Item | Status from Phase 34 Verification | Notes |
|------|----------------------------------|-------|
| `account_oauth_credentials` table | EXISTS — migration `20260506120000_phase34_account_oauth_credentials.sql` applied | `user_id`, `refresh_token_encrypted`, `status`, `granted_scopes` columns confirmed |
| `status` field values | `'connected'` / `'needs_reconnect'` — CHECK constraint confirmed | Phase 35 writes `needs_reconnect` on `invalid_grant` |
| `lib/oauth/encrypt.ts:decryptToken` | EXISTS and tested (5/5 tests pass) | Called by factory |
| `/app/settings/gmail` `needs_reconnect` UI | EXISTS — `gmail-status-panel.tsx` renders Reconnect button | No new banner needed |
| Andrew's nsi credential | NOT YET connected — Phase 34 human verification was pending | Must connect via `/app/settings/gmail` as first Phase 35 verification step |
| `GMAIL_TOKEN_ENCRYPTION_KEY` in Vercel | Assumed set per PREREQ-04 — NOT in `.env.local` | Must be in Vercel env; needed to decrypt stored tokens |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel | Unknown — not in `.env.local`, not searched | Must be added to Vercel env before cutover deploy |

---

## Open Questions

1. **GOOGLE_CLIENT_ID source**
   - What we know: The Google OAuth app was created as part of Supabase's Google auth setup. The client ID appears in the OAuth consent screen URL during Google sign-in.
   - What's unclear: Whether these creds are accessible via Supabase Dashboard API or must be retrieved from GCP Console.
   - Recommendation: Go to GCP Console → APIs & Services → Credentials → the OAuth 2.0 client named for this project. Copy client ID and secret. Add as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to Vercel env (Preview + Production) before the cutover deploy.

2. **nsi account's Gmail address for From header**
   - What we know: `accounts.owner_email = 'ajwegner3@gmail.com'` (from migration `20260426120000_account_owner_email.sql` backfill). The factory reads `owner_email` from the accounts row.
   - What's unclear: Whether the connected Gmail credential (from Phase 34 OAuth flow) uses the same `ajwegner3@gmail.com` address. If Andrew used a different Google account during the consent flow, the token would be for a different address than `owner_email`.
   - Recommendation: After connecting, verify `account_oauth_credentials` row's associated identity email matches `accounts.owner_email`. The factory should use `owner_email` as the `user` in nodemailer config — it's the identity the account presents to bookers.

3. **Welcome email path (`lib/onboarding/welcome-email.ts`)**
   - What we know: `sendWelcomeEmail` calls `sendEmail()` directly (the singleton). It receives `account.owner_email` and `account.slug` but not `account.id`.
   - What's unclear: Whether this path is in the 7 transactional paths enumerated in the requirements (EMAIL-32 lists: booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner). Welcome email is not in that list.
   - Recommendation: Welcome email (sent at onboarding completion) is a signup-side path, not a booking-side path. Treat it as out of scope for Phase 35. Leave it on the singleton until Phase 36 (Resend). Add a note to the code that it bypasses the account-sender factory intentionally.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `lib/email-sender/index.ts`, `lib/email-sender/quota-guard.ts`, `lib/email-sender/providers/gmail.ts`, `lib/oauth/encrypt.ts`, `lib/oauth/google.ts`
- Direct codebase inspection: all 7 send-path files in `lib/email/`
- Direct codebase inspection: `app/api/bookings/route.ts`, `lib/bookings/cancel.ts`, `lib/bookings/reschedule.ts`, `app/api/cron/send-reminders/route.ts`
- Direct codebase inspection: `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql`
- Direct codebase inspection: `supabase/migrations/20260504130000_phase31_email_send_log_categories.sql`
- `.planning/phases/34-google-oauth-signup-and-credential-capture/34-VERIFICATION.md` — Phase 34 deliverable status
- `.planning/phases/28-per-event-type-buffer-and-column-drop/28-VERIFICATION.md` — CP-03 two-step deploy pattern
- [Nodemailer OAuth2 official docs](https://nodemailer.com/smtp/oauth2) — OAuth2 transporter config

### Secondary (MEDIUM confidence)

- `lib/email-sender/index.ts` comment (lines 8-14): "v2 (multi-tenant onboarding): per-account credential lookup" — the v1 code was written anticipating this exact Phase 35 change

### Tertiary (LOW confidence)

- None — all critical findings verified from codebase directly

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies; all from codebase inspection
- Architecture: HIGH — factory pattern directly documented in existing `index.ts` comments; all call sites verified
- Pitfalls: HIGH — env var gap and column-migration sequencing verified from codebase; nodemailer OAuth2 from official docs
- Quota isolation: HIGH — `email_send_log` schema inspected directly; migration change clear
- SMTP retirement scope: HIGH — all `GMAIL_APP_PASSWORD` references found and documented

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable — no fast-moving dependencies)
