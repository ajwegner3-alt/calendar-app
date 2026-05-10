# v1.7 Research Summary — Auth Expansion + Per-Account Email + Polish + Dead Code

**Project:** NSI Booking Tool (calendar-app)
**Milestone:** v1.7 (builds on production v1.6)
**Researched:** 2026-05-06
**Confidence:** HIGH (architecture and pitfalls verified against live codebase; stack verified against official docs)

---

## Executive Summary

v1.7 is a security-and-infrastructure milestone that retires the centralized Gmail SMTP singleton serving every account since v1.0 and replaces it with per-account Gmail OAuth send. This is the single riskiest change in scope: it touches all seven send-side modules, requires a new database table, a new encryption utility, a new sender factory, and a mandatory strangler-fig cutover protocol — all while keeping production email flowing for Andrew's `nsi` account (the only live production account). Every other v1.7 feature area (Google OAuth signup, magic-link login, Resend upgrade backend, BOOKER UI polish, dead-code audit) either feeds into this migration or is fully independent of it.

The research is unambiguous on three foundational points. First, `googleapis` as an npm package is not needed — nodemailer's built-in OAuth2 transport handles Google token refresh internally. The only new production dependency is `resend`; `knip` is a devDependency for the audit phase. Second, Gmail refresh tokens are long-lived credentials granting access to a real Gmail inbox and must be encrypted at rest using AES-256-GCM with a Vercel env var key before any token is written to Supabase — never plaintext, in any environment. Third, the quota guard (`checkAndConsumeQuota` + `email_send_log`) must receive an `account_id` column and per-account scoping before any per-account send code is deployed — not as a follow-up, but as the first task in the per-account send phase.

Two external prerequisites gate v1.7 and have non-trivial lead times: Google Cloud Console OAuth app setup with `gmail.send` sensitive scope verification (3—5 business days) and Resend domain DNS verification (5—60 minutes for propagation, requiring manual Namecheap DNS entry). Both must be started before their respective phases begin. The 100-user cap on unverified Google OAuth apps is not a production blocker for a single-account tool, but verification should be initiated during or immediately after v1.7 ships.

---

## Key Findings

### Recommended Stack

The existing stack (Next.js, Supabase, nodemailer, Vercel) requires only two package additions. `resend` (production dependency) handles the NSI-owned Resend backend for upgraded accounts. `knip` (devDependency) handles dead-code auditing. Nothing else changes. nodemailer already supports OAuth2 natively via `auth: { type: "OAuth2" }` with no additional packages. `tw-animate-css` is already in `package.json` and covers the BOOKER-06 slide-in animation.

**Core technologies (new or extended in v1.7):**
- `resend ^x.x.x` (production dep) — NSI-owned Resend backend; verify exact version at install time (npm shows 6.x as of 2026-05)
- `knip` (devDependency) — dead-code audit with Next.js App Router plugin; report-only by default
- nodemailer OAuth2 transport (already installed `^8.0.6`) — per-account Gmail send; no new package needed
- AES-256-GCM via Node.js `crypto` (stdlib) — refresh token encryption; `GMAIL_TOKEN_ENCRYPTION_KEY` env var
- `tw-animate-css` (already in package.json) — BOOKER-06 slide-in animation

**Schema additions (4 migrations):**

| Migration | Table / Change | Purpose |
|-----------|----------------|---------|
| `_v17_account_oauth_credentials.sql` | New table `account_oauth_credentials` | Per-account encrypted refresh tokens (with `provider` column for v1.8 extensibility) |
| `_v17_accounts_email_provider.sql` | `accounts.email_provider` text column | Route gmail vs resend per account |
| `_v17_email_send_log_account_id.sql` | `account_id` column + index on `email_send_log` | Per-account quota isolation |
| `_v17_email_send_log_magic_link.sql` | Extend `email_send_log.category` CHECK | Add "magic-link" category |

All migrations applied via the locked pattern: `echo | npx supabase db query --linked -f supabase/migrations/<file>.sql`

**Table naming note:** STACK.md uses `account_gmail_credentials`; ARCHITECTURE.md uses `account_oauth_credentials` with a `provider` column. Use `account_oauth_credentials` — avoids a rename when Google Calendar sync lands in v1.8.

### Expected Features

**Must-have / table stakes (ship with v1.7):**
- Google OAuth signup button on `/app/signup` — combined `openid email profile gmail.send` consent in one screen
- Magic-link login option on existing `/app/login` card — no separate route
- Gmail OAuth tokens stored encrypted on first OAuth callback; partial-grant handled gracefully
- Per-account Gmail OAuth send replacing centralized SMTP singleton for all 7 send-side modules
- `invalid_grant` detection — `revoked_at` on credential + in-app reconnect banner
- "Connect Gmail" step in onboarding wizard (skippable) + settings page for existing accounts
- Cap-hit "Request upgrade" inline button routing via NSI Resend, bypassing per-account quota guard
- NSI Resend backend for accounts with `email_provider = 'resend'` flag
- BOOKER-06: animated form column slide-in (200—250ms, ease-out, tw-animate-css only)
- BOOKER-07: shape-only skeleton in empty form column when `selectedSlot === null`
- Dead-code audit (knip report, Andrew sign-off per item, atomic surgical removals)

**Should-have / add after v1.7 validation:**
- `gmail_last_sent_at` timestamp in settings (add after per-account send confirmed stable in production)
- Connection status badge (Connected / Needs reconnect / Never connected) on settings page

**Defer to v1.8+:** Google Calendar read/write sync, per-account custom Resend domain, SAML/SSO

**Anti-features (do not build):**
- Block account creation if `gmail.send` is denied — partial-grant must be handled gracefully per Google policy
- Re-prompt `gmail.send` on every login — Google OAuth policy violation
- Separate `/app/login/magic-link` route — unnecessary UX fragmentation
- `googleapis` npm package — nodemailer handles OAuth2 without it
- `pgsodium` for token encryption — AES-256-GCM with env var key is sufficient for v1.7 scale

### Architecture Approach

The architecture is additive. The existing `EmailClient` interface and `createEmailClient` factory serve as the stable abstraction point. v1.7 introduces `getSenderForAccount(accountId)` at `lib/email-sender/get-sender-for-account.ts` — a factory that reads the account's `email_provider` column and credential record, then returns an appropriately configured `EmailClient`. All seven send-side modules replace their `sendEmail(...)` singleton call with `(await getSenderForAccount(account.id)).send(...)`. The quota guard, log writes, and existing `EmailOptions` shape are unchanged below this layer.

**Major new components:**

| File | Type | Responsibility |
|------|------|----------------|
| `app/auth/oauth-callback/route.ts` | Route handler | OAuth PKCE code exchange + encrypted refresh token capture |
| `app/(auth)/app/signup/_components/google-oauth-button.tsx` | Client component | Triggers `signInWithOAuth` with combined scopes |
| `lib/crypto.ts` | Server utility | `encryptToken` / `decryptToken` (AES-256-GCM) |
| `lib/email-sender/providers/gmail-oauth.ts` | Server lib | nodemailer XOAUTH2 transport |
| `lib/email-sender/providers/resend.ts` | Server lib | Resend HTTP API client |
| `lib/email-sender/get-sender-for-account.ts` | Server lib | Per-account sender factory |
| `app/(shell)/app/settings/upgrade/page.tsx` + `actions.ts` | Page + action | Upgrade request page; sends via NSI Resend, bypasses quota guard |
| `app/[account]/[event-slug]/_components/skeleton-form-column.tsx` | Client component | BOOKER-07 shape-only skeleton |

**Key routing distinction:** The existing `/auth/confirm` uses `verifyOtp()` for email OTP flows. OAuth signup uses `exchangeCodeForSession()` — a different Supabase flow. These must not share a handler. `/auth/oauth-callback` is already public via the proxy middleware `pathname.startsWith("/app")` gate — no `publicAuthPaths` change required.

### Critical Pitfalls (top 5)

1. **V17-CP-01 Partial OAuth grant** — Google granular consent (live Jan 2026) lets users deny `gmail.send`. Verify granted scopes in the OAuth callback before writing any credential; create the account regardless; surface the connect prompt in onboarding. Never treat a partial grant as a connected state.

2. **V17-CP-05 Flag-day SMTP cutover** — Removing `GMAIL_APP_PASSWORD` in the same deploy that enables per-account OAuth breaks in-flight requests. Use strangler-fig: add `email_provider` column, route by it, verify production, remove SMTP in a separate deploy.

3. **V17-CP-06 Unencrypted refresh tokens** — Gmail refresh tokens grant permanent `gmail.send` access to a real inbox. Column must be `refresh_token_encrypted text`; encrypt with AES-256-GCM before any write. Never plaintext in any environment.

4. **V17-CP-03 Bootstrap problem** — At 200/day cap, `checkAndConsumeQuota` throws. The "Request upgrade" notification must route through NSI Resend directly, bypassing the per-account quota guard entirely.

5. **V17-CP-09 Quota guard counts wrong account** — Current `getDailySendCount()` has no `account_id` filter. Adding `account_id` to `email_send_log` and scoping the count query must be the first task in Phase 2.

---

## Locked Decisions

**LD-01 — nodemailer + no `googleapis` package**
Use nodemailer's built-in `auth: { type: "OAuth2" }` transport for per-account Gmail send. `googleapis` npm package is not needed — nodemailer calls Google's token endpoint internally. nodemailer is already installed (`^8.0.6`).

**LD-02 — `resend` + `knip` only; no other npm additions**
The only new npm packages for v1.7 are `resend` (production dependency) and `knip` (devDependency). `googleapis`, `framer-motion`, `bull`, `pgsodium`, and all other packages are explicitly excluded.

**LD-03 — `account_oauth_credentials` table with encrypted refresh tokens**
Refresh tokens stored in a new `account_oauth_credentials` table (not on `accounts` row). Columns: `id, account_id, provider, gmail_address, refresh_token_encrypted, access_token, access_token_expires_at, revoked_at, created_at, updated_at`. UNIQUE on `(account_id, provider)`. AES-256-GCM encryption via `lib/crypto.ts`; `GMAIL_TOKEN_ENCRYPTION_KEY` env var. Column named `refresh_token_encrypted` — self-documenting. Never plaintext.

**LD-04 — `account_id` on `email_send_log` + quota guard scoping BEFORE per-account send**
The `email_send_log` migration adding `account_id uuid references accounts(id) on delete set null` and index is the first task in Phase 2. `checkAndConsumeQuota(category, accountId?)` and `getDailySendCount(accountId?)` updated for per-account scoping before any send-path code is written. Legacy rows with `account_id = null` grandfathered as global.

**LD-05 — Bootstrap problem: upgrade notification via NSI Resend, bypasses quota guard**
`requestUpgradeAction()` imports `createResendClient` directly with `RESEND_API_KEY` and does NOT call `checkAndConsumeQuota` for the requester's account. Test gate: seed `email_send_log` to 200 rows; click "Request upgrade"; verify email arrives via Resend before phase ships.

**LD-06 — Strangler-fig cutover: centralized SMTP to per-account Gmail**
Step 1: add `accounts.email_provider` column (default `'gmail_smtp'`); senders branch on it. Step 2: Andrew connects NSI account Gmail OAuth on preview branch. Step 3: flip `nsi.email_provider = 'gmail_oauth'`; smoke-test production. Step 4: remove `gmail_smtp` path and `GMAIL_APP_PASSWORD` in a separate deploy. No flag-day swap. The `_defaultClient` singleton remains valid through Steps 1—3.

**LD-07 — Magic-link reuses `/app/login` card; `signInWithOtp` with `shouldCreateUser: false`; 10—15 min TTL**
Magic-link added as secondary action on existing `/app/login` — no new route. Implementation: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: "..." } })`. UI response identical for known and unknown emails (enumeration safety).

**LD-08 — BOOKER-06 + BOOKER-07 share one phase; V15-MP-05 Turnstile lifecycle lock preserved**
Both implemented in one phase. V15-MP-05 LOCK: `BookingForm` mounts only when `selectedSlot !== null`. Animation on the wrapper `div`, not `BookingForm` itself. Skeleton renders only when `selectedSlot === null`.

**LD-09 — Dead-code audit runs LAST; knip with explicit ignore list**
Final phase of v1.7, after all features land. `knip` in report-only mode. Explicit ignore list: `slot-picker.tsx` (Plan 30-01 Rule 4), test mock helpers, `__mocks__/`. Andrew reviews and signs off per removal. Never a big-bang deletion PR.

**LD-10 — Migration apply path remains `echo | npx supabase db query --linked -f`**
All Supabase migrations use the locked apply pattern. One migration file per logical change.

**LD-11 — `/auth/oauth-callback` is the OAuth-specific callback (separate from `/auth/confirm`)**
New `app/auth/oauth-callback/route.ts` handles OAuth PKCE code exchange and refresh token capture. Existing `/auth/confirm` remains for OTP/magic-link flows. Different Supabase flows; must not share a handler. `/auth/oauth-callback` already public via proxy middleware — no `publicAuthPaths` change needed.

**LD-12 — `signInWithOAuth` uses `options.scopes` (not `queryParams.scope`) + required params**
```typescript
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: `${origin}/auth/oauth-callback?next=/onboarding`,
    scopes: "openid email profile https://www.googleapis.com/auth/gmail.send",
    queryParams: { access_type: "offline", prompt: "consent" },
  },
});
```
`queryParams.scope` silently drops extra scopes (wrong). `options.scopes` is correct (GitHub #30924). Both `access_type: "offline"` and `prompt: "consent"` are required.

**LD-13 — Existing-account Gmail connect uses `supabase.auth.linkIdentity()`, not `signInWithOAuth()`**
Andrew's `nsi` account and existing email/password accounts use `supabase.auth.linkIdentity({ provider: "google", options: { scopes: "gmail.send" } })` on the settings page. `signInWithOAuth` would create a duplicate user. Must be built and tested with Andrew's account on preview before production cutover.

**LD-14 — Vitest alias stays exact-match; new provider sub-paths get their own alias entries**
Phase 32 `vitest.config.ts` exact-match regex (`find: /^@\/lib\/email-sender$/`) is not broadened. New sub-paths (`@/lib/email-sender/providers/gmail-oauth`, `@/lib/email-sender/providers/resend`) each get their own exact-match alias entry pointing to a stub mock. First coding task in Phase 2.

---

## Manual Prerequisites

### PREREQ-01 — Google Cloud Console setup
**Andrew action required — blocks Phase 1 (OAuth Signup)**

1. console.cloud.google.com — create project or reuse existing NSI project
2. APIs & Services > Library > enable "Gmail API"
3. APIs & Services > OAuth consent screen > configure: app name, support email, authorized domains (Vercel domain + custom domain)
4. Add scope: `https://www.googleapis.com/auth/gmail.send` (sensitive)
5. Add test users: Andrew's Gmail + QA accounts (up to 100 pre-verification)
6. Credentials > Create OAuth 2.0 Client ID > Web application > add authorized redirect URIs:
   - `https://[supabase-project-ref].supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback`
7. Copy Client ID and Client Secret — add to Vercel env vars as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
8. **Start OAuth App Verification immediately** — submit app name, privacy policy URL, demo video. Timeline: 3—5 business days. 100-user cap is not a blocker for NSI single-account testing but verification must be in-flight before any non-NSI accounts are onboarded.

### PREREQ-02 — Supabase Google provider configuration
**Andrew action required — blocks Phase 1 (OAuth Signup)**

1. Supabase dashboard > Authentication > Providers > Google > toggle ON
2. Paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from PREREQ-01
3. Confirm Supabase redirect URL matches what was entered in Google Cloud Console

### PREREQ-03 — Resend account + domain DNS verification
**Andrew action required — blocks Phase 3 (Resend Backend)**

1. Create account at resend.com
2. Domains > Add Domain > enter NSI sending domain (e.g., `mail.nsi.tools` or `northstarintegrations.com`)
3. Resend provides SPF, DKIM, DMARC DNS records
4. Namecheap > Advanced DNS > add records exactly as shown
5. Wait for DNS propagation (5—60 min); confirm Resend dashboard shows "Verified" for SPF and DKIM
6. Send a test email from Resend dashboard; check received headers for `dkim=pass`
7. API Keys > Create API Key > add to Vercel env vars as `RESEND_API_KEY`
8. Decide on `from` address: e.g., `noreply@mail.nsi.tools` — display name will be account business name (per V17-MP-13)
9. Confirm pricing tier: free tier (100/day) insufficient for production; Pro tier (~$20/month) required

**Hard gate: do not deploy any Resend send code until Resend dashboard shows "Verified."**

### PREREQ-04 — Vercel env vars for new credentials
**Andrew action required — blocks Phase 1, Phase 2, Phase 3**

Add to Vercel (all environments: Production + Preview) and to `.env.local` for local dev:
- `GOOGLE_CLIENT_ID` — from PREREQ-01
- `GOOGLE_CLIENT_SECRET` — from PREREQ-01
- `GMAIL_TOKEN_ENCRYPTION_KEY` — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — use the same key for preview and production
- `RESEND_API_KEY` — from PREREQ-03

A `.env.local.example` listing all four vars with comments (no values) is committed to the repo as part of Phase 1.

---

## Suggested Phase Structure

### Phase Ordering Rationale

The architecture researcher proposed a 7-phase A—G sequence. The features researcher noted BOOKER-06 + BOOKER-07 should share one phase (agreed — LD-08) and dead code should run last (agreed — LD-09). These refinements collapse the 7-phase sequence to 6 phases with no substantive ordering divergence between the two researchers.

Magic-link (Phase 5) is fully independent of all other phases and can run in parallel with Phase 3. It is sequenced here for team focus, not for technical dependency.

---

### Phase 1: Google OAuth Signup + Credential Capture

**Rationale:** Everything downstream requires OAuth tokens to exist in the database. The existing-account `linkIdentity` connect flow (LD-13) is included here because Andrew's `nsi` account must be connectable before any SMTP cutover.

**Deliverables:**
- `app/auth/oauth-callback/route.ts` — PKCE code exchange + encrypted refresh token write (LD-11)
- `app/(auth)/app/signup/_components/google-oauth-button.tsx` — `signInWithOAuth` with combined scopes (LD-12)
- `app/(shell)/app/settings/_components/connect-gmail-button.tsx` — `linkIdentity` for existing accounts (LD-13)
- `supabase/migrations/_v17_account_oauth_credentials.sql` (LD-03)
- `lib/crypto.ts` — `encryptToken` / `decryptToken` AES-256-GCM (LD-03)
- `.env.local.example` with all new env vars (PREREQ-04, V17-MP-12)
- Partial-grant scope verification before any credential write (V17-CP-01)
- Startup assertion for missing env vars in callback handler (V17-MP-12)

**Addresses LDs:** LD-03, LD-11, LD-12, LD-13
**Avoids:** V17-CP-01, V17-CP-06, V17-CP-08, V17-MP-01, V17-MP-12
**Gates on:** PREREQ-01, PREREQ-02, PREREQ-04
**Research flag:** No additional research phase needed.

---

### Phase 2: Per-Account Gmail OAuth Send

**Rationale:** The core of v1.7. Quota guard migration is task 1. Vitest alias additions are task 2. Strangler-fig cutover requires Andrew to connect `nsi` on preview as a gate condition before SMTP removal.

**Deliverables:**
- `supabase/migrations/_v17_email_send_log_account_id.sql` — first task (LD-04)
- `vitest.config.ts` alias entries for new provider sub-paths — second task (LD-14)
- `lib/email-sender/providers/gmail-oauth.ts` — nodemailer XOAUTH2 transport (LD-01)
- `lib/email-sender/get-sender-for-account.ts` — per-account sender factory (LD-06)
- `lib/email-sender/types.ts` — extend `EmailProvider` union with exhaustiveness check (V17-MP-09)
- `lib/email-sender/quota-guard.ts` — `account_id` + `provider` params
- All 7 `lib/email/send-*.ts` modules wired to factory (replace `sendEmail(...)` singleton)
- `supabase/migrations/_v17_accounts_email_provider.sql` — `email_provider` column
- `invalid_grant` detection: set `revoked_at`, surface reconnect state (V17-CP-07)
- Refresh token rotation re-store on every token response (V17-CP-02)
- Batch pre-fetch: single access token fetch per invocation before concurrent sends (V17-CP-04)
- Cron handler `invalid_grant` distinction: permanent vs transient (V17-MP-03)
- Strangler-fig Steps 1—4 per LD-06; Andrew manual gate before SMTP removal

**Addresses LDs:** LD-01, LD-04, LD-06, LD-14
**Avoids:** V17-CP-02, V17-CP-04, V17-CP-05, V17-CP-07, V17-CP-09, V17-MP-03, V17-MP-09, V17-MP-11
**Manual gate:** Andrew connects `nsi` Gmail OAuth on preview; booking confirmation arrives in real inbox; SMTP path removal is a separate deploy.
**Research flag:** No additional research phase needed.

---

### Phase 3: Resend Backend for Upgraded Accounts

**Rationale:** Depends on `accounts.email_provider` column and factory from Phase 2. DNS verification (PREREQ-03) must be confirmed before any code ships to production.

**Deliverables:**
- `lib/email-sender/providers/resend.ts` — Resend HTTP API client (LD-02)
- `getSenderForAccount` updated to branch on `email_provider = 'resend'`
- `checkAndConsumeQuota` provider-awareness: skip cap for Resend; still log to `email_send_log` (V17-MP-10)
- From-address resolution: account business name as display name; NSI domain in envelope (V17-MP-13)
- Manual checkpoint: Resend dashboard shows "Verified" before code ships to production (V17-CP-11)

**Addresses LDs:** LD-02, LD-05 (partial)
**Avoids:** V17-CP-11, V17-MP-10, V17-MP-13
**Gates on:** PREREQ-03
**Research flag:** MEDIUM-confidence: verify `.ics` attachment renders as calendar invite via Resend in Phase 3 QA. If not, `content_type: 'text/calendar'` may be needed.

---

### Phase 4: Upgrade Flow + In-App Cap-Hit UI

**Rationale:** Depends on Phase 3 — `createResendClient` must exist before `requestUpgradeAction` can be correctly implemented per LD-05 / V17-CP-03.

**Deliverables:**
- `app/(shell)/app/settings/upgrade/page.tsx` + `actions.ts`
- `requestUpgradeAction` imports `createResendClient` directly; does NOT call `checkAndConsumeQuota` for requester's account (LD-05)
- "Request upgrade" inline link in quota-exceeded banners
- 24-hour debounce on upgrade request button
- Test gate: seed `email_send_log` to 200 rows; upgrade request delivers email to Andrew via Resend

**Addresses LDs:** LD-05
**Avoids:** V17-CP-03
**Research flag:** No additional research phase needed.

---

### Phase 5: Magic-Link Login

**Rationale:** Fully independent of all other v1.7 features. Can run in parallel with Phase 3 if capacity allows.

**Deliverables:**
- `app/(auth)/app/login/magic-link-form.tsx` + `magic-link-actions.ts`
- `supabase/migrations/_v17_email_send_log_magic_link.sql` — add "magic-link" to `category` CHECK
- `AUTH_RATE_LIMITS.magicLink` in `lib/auth/rate-limits.ts`: `{ max: 3, windowMs: 60 * 60 * 1000 }`
- `signInWithOtp` with `shouldCreateUser: false` (LD-07)
- Enumeration-safe response: identical body for known and unknown emails (V17-CP-10)

**Addresses LDs:** LD-07
**Avoids:** V17-CP-10, V17-MP-02
**Research flag:** No additional research phase needed. Cross-device PKCE must be tested in manual QA (V17-MP-02).

---

### Phase 6: BOOKER Polish (BOOKER-06 + BOOKER-07)

**Rationale:** Pure UI, zero backend dependencies. Placed before dead-code audit. Can be developed in parallel with Phase 5.

**Deliverables:**
- `app/[account]/[event-slug]/_components/skeleton-form-column.tsx` — BOOKER-07 shape-only skeleton (LD-08)
- `booking-shell.tsx` Col 3: animation wrapper + skeleton mount (LD-08)
- Animation: `tw-animate-css`, `transform`/`opacity` only (V17-MP-06)
- `prefers-reduced-motion` media query wrapping animation (V17-MP-07)
- V15-MP-05 LOCK verified: `BookingForm` not in DOM before `selectedSlot !== null` (V17-MP-04)
- Skeleton renders only when `selectedSlot === null` (V17-MP-05)

**Addresses LDs:** LD-08
**Avoids:** V17-MP-04, V17-MP-05, V17-MP-06, V17-MP-07
**Research flag:** No additional research phase needed.

---

### Phase 7: Dead-Code Audit

**Rationale:** Must be last — after all v1.7 features land.

**Deliverables:**
- `npm install -D knip`
- `knip.json` at project root with explicit ignore list: `slot-picker.tsx`, test mock helpers, `__mocks__/` (LD-09)
- `npx knip --reporter json > .planning/phases/[N]-dead-code-audit/knip-report.json`
- `npx knip --reporter markdown > .planning/phases/[N]-dead-code-audit/findings.md`
- Andrew reviews each item: REMOVE / KEEP / INVESTIGATE
- Atomic commits per logical removal group (LD-09)
- `next build` run after each removal batch (V17-MP-08)
- SQL migration files excluded from deletion candidates
- `npx knip` re-run after removals to confirm zero issues

**Addresses LDs:** LD-09
**Avoids:** V17-MP-08
**Research flag:** No additional research phase needed.

---

## Cross-Phase Notes

### Parallel Safety

Phases 3 and 5 have zero shared files and can be developed in parallel. Phase 4 depends on Phase 3 completing first. Phase 6 shares `booking-shell.tsx` with no other v1.7 phase and can run in parallel with Phases 3—5. Phase 7 is strictly sequential — must follow all other phases.

### Deploy Ordering

Phase 2 requires a two-step deployment per LD-06. Step 1 deploys with both SMTP and OAuth paths active. The SMTP path removal (Step 4) is a separate commit and deploy, made only after Andrew has verified per-account OAuth email working in production. This two-step protocol mirrors v1.5 CP-03 and must not be collapsed.

### Test Gates Before Phase Sign-Off

| Phase | Hard gate condition |
|-------|---------------------|
| Phase 1 | Deny `gmail.send` on consent screen; verify account shows "Gmail not connected" state, not an error |
| Phase 1 | Andrew's `nsi` account connects Gmail via `linkIdentity` on preview branch |
| Phase 2 | Two-account quota isolation: account A at cap does not affect account B's count |
| Phase 2 | `invalid_grant` mock: triggers `revoked_at` set + reconnect banner renders |
| Phase 2 | Andrew's `nsi` booking confirmation arrives in real inbox via Gmail OAuth on preview |
| Phase 3 | Resend dashboard shows "Verified" for SPF and DKIM before any code ships |
| Phase 3 | Test booking via Resend: `.ics` attachment confirmed in received email |
| Phase 4 | Seed `email_send_log` to 200 rows; "Request upgrade" delivers email to Andrew via Resend |
| Phase 5 | POST known email + POST unknown email return identical HTTP status and response body |
| Phase 6 | React DevTools: `BookingForm` absent from DOM before slot selected |
| Phase 6 | Chrome CLS = 0.0 after slot pick animation |
| Phase 6 | OS reduced-motion enabled: no animation fires |
| Phase 7 | `npx knip` reports zero issues in target categories after all removals |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack: no googleapis, resend + knip only | HIGH | Verified against official nodemailer docs and npm |
| Google OAuth scope syntax (`options.scopes`) | HIGH | GitHub discussion #30924 canonical fix confirmed |
| `provider_refresh_token` only in initial callback | HIGH | Supabase official docs + community discussions |
| Partial grant behavior (Google granular consent) | HIGH | Official Google Workspace updates blog |
| Architecture: file paths, call signatures, trigger behavior | HIGH | All verified against live codebase source files |
| Pitfalls: V17-CP-01..11, V17-MP-01..13 | HIGH | Derived from live codebase + v1.0—v1.6 incident record |
| Resend `.ics` attachment MIME handling | MEDIUM | API shape confirmed; `.ics` MIME not explicitly documented |
| Resend npm exact major version | MEDIUM | npm shows 6.x as of 2026-05; verify at install time |
| AES-256-GCM token encryption implementation | MEDIUM | Standard Node.js crypto practice; no codebase-specific verification |
| Google OAuth verification timeline | MEDIUM | Google docs states 3—5 business days; actual timelines vary |
| Magic-link cross-device PKCE behavior | MEDIUM | Test explicitly in QA; document same-browser requirement if confirmed |

**Overall confidence:** HIGH — architecture research verified against live source files; all MEDIUM items are implementation details to verify at execution time or external timelines outside code control.

### Open Questions

1. **Which domain for Resend?** `northstarintegrations.com`, `mail.nsi.tools`, or another subdomain? Andrew decides in PREREQ-03. Affects all upgraded-account booking email `from` addresses.

2. **Resend pricing tier at launch?** Pro tier (~$20/month) required. Andrew confirms before Phase 3 ships.

3. **`account_oauth_credentials` vs `account_gmail_credentials` table name:** Recommendation in LD-03 is `account_oauth_credentials` with a `provider` column for v1.8 extensibility. Roadmapper confirm before Phase 1 plan is finalized.

4. **Magic-link TTL configuration:** Confirm Supabase Auth settings dashboard shows 10—15 minute TTL. Document setting location in Phase 5 plan.

5. **Resend `.ics` MIME:** If `.ics` attachments do not render as calendar invites in Phase 3 QA, a `content_type: 'text/calendar'` field may be needed in the Resend attachment payload.

6. **Google OAuth verification timing:** Start immediately after PREREQ-01 completes. Verification must be in-flight before any non-NSI accounts are onboarded.

---

## Sources

### Primary (HIGH confidence)
- Supabase Auth Google OAuth docs — https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase `signInWithOtp` magic link docs — https://supabase.com/docs/guides/auth/auth-email-passwordless
- GitHub discussion (correct scope syntax) — https://github.com/orgs/supabase/discussions/30924
- GitHub discussion (provider_refresh_token storage) — https://github.com/orgs/supabase/discussions/22653
- Nodemailer OAuth2 docs — https://nodemailer.com/smtp/oauth2
- Google sensitive scope verification — https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- Google unverified apps / 100-user cap — https://support.google.com/cloud/answer/7454865
- Google granular OAuth consent (Jan 2026) — https://workspaceupdates.googleblog.com/2025/11/granular-oauth-consent-in-webapps.html
- Knip documentation — https://knip.dev/ and https://knip.dev/reference/plugins/next
- Live codebase: `lib/email-sender/`, `lib/email-sender/quota-guard.ts`, `app/auth/confirm/route.ts`, `lib/supabase/proxy.ts`, `app/[account]/[event-slug]/_components/booking-shell.tsx`, `package.json`, `supabase/migrations/`, `vitest.config.ts`, `lib/auth/rate-limits.ts`

### Secondary (MEDIUM confidence)
- Resend Node.js SDK docs — https://resend.com/docs/send-with-nodejs
- Google invalid_grant causes — https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/
- Magic link UX best practices — https://www.baytechconsulting.com/blog/magic-links-ux-security-and-growth-impacts-for-saas-platforms-2025
- Motion/Framer Motion transition docs — https://motion.dev/docs/react-transitions
- Skeleton screens — Nielsen Norman Group — https://www.nngroup.com/articles/skeleton-screens/

### Internal references
- Phase 31: quota-guard fail-closed contracts, `email_send_log` schema, `category` CHECK pattern
- Phase 32: vitest resolve.alias exact-match rationale (`find: /^@\/lib\/email-sender$/`)
- Phase 33: strangler-fig / two-step deploy, pushback cascade patterns
- PROJECT.md Key Decisions: CP-03 two-step deploy protocol, V15-MP-05 Turnstile lock, LD-07 booker-neutrality, Plan 30-01 Rule 4 (`slot-picker.tsx`)

---

*Research synthesized: 2026-05-06*
*Ready for roadmap: yes*