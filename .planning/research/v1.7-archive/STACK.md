# Stack Research — v1.7 Auth Expansion + Per-Account Email

**Domain:** Multi-tenant Calendly-style booking app (Next.js 16 / Supabase / Vercel)
**Researched:** 2026-05-06
**Confidence:** HIGH for package selections; MEDIUM for Google OAuth verification timeline; HIGH for architecture patterns

---

## Executive Summary

v1.7 needs four stack additions on top of the existing codebase:

1. **`googleapis` npm package** — for Gmail OAuth2 send (nodemailer already installed; googleapis provides the OAuth2 client that issues access tokens from stored refresh tokens)
2. **`resend` npm package** — for the NSI-owned Resend backend (upgraded accounts)
3. **`knip` devDependency** — for the dead-code audit phase
4. **`account_gmail_credentials` Postgres table** — for storing encrypted per-account Gmail OAuth tokens (no npm package; pure schema addition)

Everything else — Next.js, Supabase Auth, nodemailer, quota-guard, email-sender — stays as-is. The email-sender abstraction (`EmailClient` interface + `createEmailClient` factory) is already forward-compatible; v1.7 adds two new provider variants (`gmail-oauth` and `resend`) without touching callers.

---

## 1. Google OAuth Signup with Combined `gmail.send` Scope

### How Supabase + Google OAuth Works

Supabase's Google provider does **not** store the `provider_refresh_token` in any table. The token is available only in the session object immediately after `exchangeCodeForSession()` in the PKCE callback. **You must extract and persist it yourself** in the `/auth/confirm` route handler (the one this app already uses at `app/auth/confirm/route.ts`).

### Scope Configuration

Pass additional scopes in `signInWithOAuth` via the `options.scopes` field (space-separated, NOT `queryParams.scope` — that syntax is wrong and silently drops the extra scopes):

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${origin}/auth/confirm?next=/onboarding`,
    scopes: "openid email profile https://www.googleapis.com/auth/gmail.send",
    queryParams: {
      access_type: "offline",   // required to receive a refresh_token
      prompt: "consent",         // forces consent screen even for returning users
    },
  },
});
```

`access_type: "offline"` + `prompt: "consent"` are both required. Without `prompt: "consent"`, Google does not return a refresh token for returning users (they already granted access; Google skips the screen and returns no refresh token). Without `access_type: "offline"`, no refresh token is issued at all.

### One Consent Screen, Not Two

Users see **one consent screen** that lists all requested scopes together. The screen shows `openid + email + profile + gmail.send` in a single flow. There is no second prompt.

### The 100-User Cap Warning

`gmail.send` is a **sensitive scope**. Until the Google Cloud project completes OAuth App Verification, the app is capped at **100 total users who can grant permission** (cap is lifetime, not resettable). During that cap period, users see an "unverified app" warning screen before the consent screen.

**Implication for v1.7:** Andrew's NSI account plus a handful of test accounts is well under 100. The cap is not a blocker for initial rollout. Google verification (3-5 business days, requires a demo video) should be started during or shortly after v1.7 ships.

### Token Extraction in the Callback

The `/auth/confirm` route already exchanges the code for a session. Add token persistence there:

```typescript
const { data, error } = await supabase.auth.exchangeCodeForSession(code);
const refreshToken = data?.session?.provider_refresh_token;
const providerEmail = data?.session?.user?.email;
// INSERT into account_gmail_credentials
```

**Important:** `provider_refresh_token` is only present on the initial OAuth grant. Subsequent logins where the user has already granted access do NOT include a refresh token (Google only issues it once). The `prompt: "consent"` param in the `signInWithOAuth` call forces re-consent and a fresh refresh token — critical if the token has been revoked.

---

## 2. Magic-Link Login

### Implementation

```typescript
await supabase.auth.signInWithOtp({
  email: parsed.data.email,
  options: {
    shouldCreateUser: false,           // login only — no new account creation
    emailRedirectTo: `${origin}/auth/confirm?next=/app`,
  },
});
```

`shouldCreateUser: false` is the canonical "login-only magic link" pattern. If the email does not exist in `auth.users`, Supabase does NOT send an email, but the API returns no error — it silently succeeds. This is intentional enumeration-safety behavior (same pattern as this app's existing password signup: always redirect, never distinguish).

### Rate Limiting

Supabase applies its own built-in rate limit: one OTP request per email per 60 seconds (configurable in the Auth settings in the Supabase dashboard). The app's existing `rate_limit_events` Postgres table + `checkAuthRateLimit` can add an additional IP-level guard keyed as `auth:magic-link:${ip}` — no new infrastructure needed.

### No New npm Package Required

`signInWithOtp` is part of `@supabase/supabase-js` already installed. The existing auth route structure (`app/(auth)/app/login/`) and `/auth/confirm` handler handle the token verification flow unchanged.

---

## 3. Per-Account Gmail OAuth Send

### Recommended Approach: Nodemailer with OAuth2 (not googleapis `gmail.users.messages.send`)

**Use nodemailer's built-in OAuth2 transport**, not the `googleapis` SDK's REST send. Reasons:

- nodemailer is already installed (`^8.0.6`)
- The existing `EmailClient` interface and `createGmailClient` factory are the callsite abstraction; adding a `gmail-oauth` provider variant is additive, not a rewrite
- nodemailer's OAuth2 transport handles access-token refresh automatically — it calls the Google token endpoint with the stored `refreshToken` and caches the resulting `accessToken` for the transporter's lifetime (one per Vercel Lambda invocation)
- `gmail.users.messages.send` requires manually encoding the full RFC 2822 MIME message as base64url, handling `.ics` attachments, `Content-Type: multipart/mixed`, etc. nodemailer already does all of this
- Both approaches need the same `googleapis` package for the OAuth2 client that fetches access tokens

**The `googleapis` package is still needed** because nodemailer's built-in OAuth2 needs `clientId`, `clientSecret`, and `refreshToken` — you provide those, and nodemailer handles calling `https://oauth2.googleapis.com/token` itself. You do NOT need to call `googleapis` for token refresh; nodemailer does it internally.

**Actually:** nodemailer's OAuth2 transport calls Google's token endpoint directly without needing the `googleapis` package at all. `googleapis` is only needed if you use the `google.auth.OAuth2` client explicitly. Since nodemailer handles refresh internally, you do NOT need to add `googleapis` to the dependency tree. This is simpler.

**Revised verdict: No new npm package needed for the Gmail OAuth send path.** nodemailer + stored refresh token is sufficient.

### New Provider Variant: `gmail-oauth`

Add `lib/email-sender/providers/gmail-oauth.ts` alongside the existing `gmail.ts`. It accepts `{ user, clientId, clientSecret, refreshToken }` and creates a nodemailer transporter with `auth: { type: "OAuth2", ... }`. The existing `EmailClientConfig` type needs two new optional fields:

```typescript
// Add to EmailClientConfig (types.ts):
clientId?: string;       // Google OAuth2 client ID
clientSecret?: string;   // Google OAuth2 client secret
refreshToken?: string;   // Per-account Gmail refresh token
```

Add `"gmail-oauth"` to the `EmailProvider` union and a case in `createEmailClient`.

### Refresh Token Expiry and Revocation

Nodemailer's OAuth2 transport auto-refreshes the access token each time it's needed (access tokens expire in 1 hour). However, the **refresh token itself** can be revoked (user revokes app in Google account settings, or the project's OAuth consent screen changes). When revocation happens:

- nodemailer throws with `EOAUTH2` code / "invalid_grant" message
- The caller should catch this, mark the account's credentials as `revoked_at = now()`, and surface an in-app reconnection prompt

Add a `revoked_at` column to `account_gmail_credentials` (see schema below). When a send fails with `invalid_grant`, set `revoked_at` and return a typed error so the owner UI can show a "Reconnect Gmail" banner.

### Token Storage Schema

New table in Supabase Postgres (applied via the locked `echo | npx supabase db query --linked -f` pattern):

```sql
-- Migration: v17_account_gmail_credentials.sql
CREATE TABLE account_gmail_credentials (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  gmail_address   text        NOT NULL,           -- the connected Gmail address
  refresh_token   text        NOT NULL,           -- encrypted (see below)
  access_token    text,                           -- cached; nullable; short-lived
  token_expiry    timestamptz,                    -- when access_token expires
  revoked_at      timestamptz,                    -- set on invalid_grant error
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)  -- one Gmail connection per account for v1.7
);

-- RLS: owner can read/update their own row; no anon access
ALTER TABLE account_gmail_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_own_gmail_creds"
  ON account_gmail_credentials FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid()));

CREATE POLICY "owner_update_own_gmail_creds"
  ON account_gmail_credentials FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid()));
```

**Encryption decision:** Store `refresh_token` using Supabase's `pgsodium` extension (already available in all Supabase projects) via `pgsodium.crypto_aead_det_encrypt`. This provides at-rest encryption with a key stored in Supabase's key vault — not visible in plaintext even to someone with a database dump. The admin client (service-role key) performs the encrypt/decrypt. The app never stores the raw refresh token in an env var or application memory beyond the callback request lifetime.

Alternative if `pgsodium` integration is complex: store the token encrypted with a 32-byte secret (`GMAIL_TOKEN_ENCRYPTION_KEY` env var) using Node.js `crypto.createCipheriv('aes-256-gcm')`. This is simpler to implement, less integrated. For v1.7 scale (single NSI account + a few test accounts), either approach is fine. **Recommendation: Use AES-256-GCM with an env var key for v1.7 (simpler, no pgsodium learning curve); upgrade to pgsodium if the tool goes multi-tenant at scale.**

---

## 4. Resend SDK

### Package

```
resend   ^4.x (latest stable as of 2026-05: verify exact version at install time)
```

The npm registry shows `6.x` as latest. The major version bump from 4→6 changed the API surface. **Verify the installed version's API against the official docs at install time** — do not trust training data here. The core `resend.emails.send()` shape has been stable, but constructor and TypeScript types have changed across major versions.

### API Surface (verified against resend.com/docs as of 2026-05)

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "NSI Booking <booking@northstarintegrations.com>",  // verified domain required
  to: "recipient@example.com",
  subject: "Your booking confirmation",
  html: "<p>...</p>",
  text: "...",               // auto-generated from html if omitted
  attachments: [
    {
      filename: "booking.ics",
      content: icsBuffer,    // Buffer or base64 string
      // content_type omitted — Resend derives from filename extension
    },
  ],
});
```

`.ics` files are not explicitly listed as supported in Resend's docs, but the attachment API accepts any `Buffer` with a `filename`. The MIME type is derived from the filename extension. Standard practice (SendGrid, Postmark, Nodemailer all support `.ics` this way) means it works — but verify in a Phase QA step by actually sending a test booking via the Resend path and confirming the `.ics` attaches and imports correctly.

### Pricing (as of 2026-05)

| Tier | Monthly emails | Cost | Daily limit |
|------|---------------|------|-------------|
| Free | 3,000/month | $0 | 100/day |
| Pro | 50,000/month | ~$20 | No daily limit |

For the "NSI-owned Resend backend for upgraded accounts" model in v1.7: Andrew pays ~$20/month for the Pro tier and bills upgraded customers above that. The 100/day free tier limit conflicts with the app's 200/day Gmail cap concept — use the Pro tier for any production use.

### Integration with Existing Email Sender

Add `lib/email-sender/providers/resend.ts` as a new provider. The existing `EmailClientConfig` needs:

```typescript
// Add to EmailClientConfig:
apiKey?: string;    // Resend API key (required if provider = "resend")
```

Add `"resend"` to `EmailProvider` union and a case in `createEmailClient`. The `EmailOptions` interface (with `attachments`) maps 1:1 to the Resend API shape — no adapter gymnastics.

### Routing Logic

The send path will route per account:

```
account has valid gmail_credentials AND not revoked → use gmail-oauth provider
account is flagged as "resend_upgraded" → use resend provider
account has no credentials OR revoked → refuse send (quota/credential error)
```

This routing lives in the booking-side email orchestrators, not in the email-sender library itself. The email-sender library stays dumb (pass config, get result). The orchestrators look up account credentials and call `createEmailClient({ provider: "gmail-oauth", refreshToken: ... })` or `createEmailClient({ provider: "resend", apiKey: ... })`.

---

## 5. Dead-Code Analysis: knip

### Recommendation: knip (devDependency, audit-only mode)

**Do not use ts-prune** — archived, recommends migrating to knip.
**Do not use ts-unused-exports** — not maintained, narrower scope.

knip is the canonical TypeScript dead-code tool as of 2026. It:
- Has a built-in Next.js plugin (auto-activates when `"next"` is in dependencies) that understands App Router conventions — it will not falsely flag `page.tsx`, `layout.tsx`, `route.ts` as "unused" just because they have no TypeScript imports
- Reports unused files, unused exports, unused dependencies, unused devDependencies — in one run
- Has a `--reporter json` output mode that produces a machine-readable list for the "audit then approve" workflow
- Does NOT auto-modify files unless `--fix` is explicitly passed — running `knip` alone is always read-only/report-only
- Vercel used knip to delete ~300k lines of code from their codebase

### The Audit-Then-Approve Workflow

```bash
# 1. Install (devDependency only — never ships to production)
npm install -D knip

# 2. Report mode — read-only, produces list to stdout
npx knip --reporter json > .planning/research/dead-code-report.json

# 3. Andrew reviews dead-code-report.json line by line
# 4. Per-item removal plan created (what to remove, what to keep/ignore)
# 5. Surgical removals executed one at a time with Andrew sign-off
```

**Configuration:** knip detects Next.js automatically. A minimal `knip.json` at the project root may be needed to mark certain files as entry points if the Next.js plugin doesn't catch everything (e.g., the vendored `lib/email-sender/` is imported as an alias — may need `entry: ["lib/email-sender/index.ts"]`).

---

## New npm Dependencies Summary

| Package | Type | Version | Purpose | Add? |
|---------|------|---------|---------|------|
| `resend` | dependency | latest `^x.x.x` | NSI Resend backend for upgraded accounts | YES |
| `knip` | devDependency | latest `^x.x.x` | Dead-code audit — report-only mode | YES |
| `googleapis` | — | — | NOT needed; nodemailer handles OAuth2 token refresh internally | NO |

**Nothing else is needed.** nodemailer is already installed (`^8.0.6`) and supports OAuth2 natively without additional packages.

### Install Commands

```bash
# Production dependency
npm install resend

# Dev dependency (never ships)
npm install -D knip
```

---

## Schema Additions Summary

| Migration | Table | Columns | Purpose |
|-----------|-------|---------|---------|
| `v17_account_gmail_credentials.sql` | `account_gmail_credentials` | `id, account_id, gmail_address, refresh_token, access_token, token_expiry, revoked_at, created_at, updated_at` | Per-account Gmail OAuth tokens |
| `v17_email_send_log_categories.sql` (CHECK extension) | `email_send_log` | extend `category` CHECK to add `"resend-upgrade"` | Track Resend-routed sends through quota guard |
| `v17_accounts_resend_flag.sql` | `accounts` | `resend_upgraded boolean NOT NULL DEFAULT false` | Flag which accounts route via Resend |

All applied via locked pattern: `echo | npx supabase db query --linked -f supabase/migrations/<file>.sql`

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `googleapis` npm package | nodemailer handles OAuth2 token refresh without it; adding it adds 2MB+ of dependencies for zero benefit | nodemailer's built-in OAuth2 transport |
| Second Supabase Auth provider (e.g., GitHub) | Scope creep; adds complexity with no v1.7 value | Google OAuth only |
| `@google-cloud/local-auth` | Desktop-only PKCE library, wrong runtime for Vercel serverless | nodemailer OAuth2 with stored refresh token |
| Email queue / worker (Bull, BullMQ) | Over-engineered for current scale; v1.6 quota-guard is sufficient | Existing `checkAndConsumeQuota` + fail-closed |
| Vault/secrets manager (Doppler, etc.) | Adds infra for a single env var; Vercel env vars are sufficient | `GMAIL_TOKEN_ENCRYPTION_KEY` env var + AES-256-GCM in app code |
| `pgsodium` for token encryption | Requires pgsodium API learning curve and key management; overkill for v1.7 scale | AES-256-GCM with a Vercel env var secret |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| nodemailer OAuth2 transport (no googleapis needed) | HIGH | Official nodemailer docs verified |
| Supabase `options.scopes` syntax (not `queryParams.scope`) | HIGH | GitHub discussion #30924 canonical fix confirmed |
| `provider_refresh_token` only in callback session | HIGH | Official Supabase docs + community discussions confirmed |
| 100-user cap for unverified sensitive scope | HIGH | Google official docs confirmed |
| `prompt: "consent"` required for refresh token | HIGH | Supabase docs + Google OAuth docs confirmed |
| knip read-only by default (no --fix = no writes) | HIGH | Documentation + tool behavior confirmed |
| Resend attachment API accepts `.ics` Buffer | MEDIUM | API shape confirmed; `.ics` MIME not explicitly documented — verify in QA |
| Resend npm package current major version | MEDIUM | npm shows 6.x as of search; verify exact version at install time |
| AES-256-GCM encryption approach for refresh tokens | MEDIUM | Standard Node.js crypto practice; no codebase-specific verification |
| Google OAuth verification timeline (3-5 business days) | MEDIUM | Google docs states this but timelines vary in practice |

---

## Sources

- Supabase Auth / Google OAuth docs — https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase `signInWithOtp` / magic link docs — https://supabase.com/docs/guides/auth/auth-email-passwordless
- GitHub discussion (correct scope syntax) — https://github.com/orgs/supabase/discussions/30924
- GitHub discussion (provider_refresh_token storage) — https://github.com/orgs/supabase/discussions/22653
- Nodemailer OAuth2 docs — https://nodemailer.com/smtp/oauth2
- Google sensitive scope verification — https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Google unverified apps / 100-user cap — https://support.google.com/cloud/answer/7454865
- Resend Node.js SDK docs — https://resend.com/docs/send-with-nodejs
- Knip documentation — https://knip.dev/ and https://knip.dev/reference/plugins/next
- Knip comparison page — https://knip.dev/explanations/comparison-and-migration

---

*Stack research for: v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code*
*Researched: 2026-05-06*
