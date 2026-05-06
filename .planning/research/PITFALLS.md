# Domain Pitfalls — v1.7

**Domain:** Multi-tenant calendar/booking app — OAuth signup, per-account Gmail OAuth send, magic-link login, Resend upgrade backend, BOOKER polish, dead-code audit
**Researched:** 2026-05-06
**Confidence:** HIGH (derived from live codebase inspection + v1.0-v1.6 incident record)

---

## Critical Pitfalls

### V17-CP-01: Partial OAuth Grant — gmail.send Denied, Profile Accepted

**What goes wrong:**
Google allows users to uncheck individual scopes on the OAuth consent screen. A user can grant `openid email profile` but deny `gmail.send`. The result is a valid Supabase auth session with an `auth.users` row and a stub `accounts` row provisioned by the trigger (v1.1 SECURITY DEFINER pattern), but no Gmail OAuth tokens stored. If the code proceeds to mark the account as "Gmail connected," every email send for that account will fail silently or throw an unhandled error. The owner will see a working dashboard but zero transactional emails reach their bookers.

**Why it happens:**
Google's consent screen lets users pick scopes individually. Most OAuth implementations check for the presence of an access token, not for the presence of all requested scopes in the granted token. A partially-granted token looks valid to most auth libraries.

**How to avoid:**
After the OAuth callback completes, inspect the granted scopes explicitly before writing any `gmail_refresh_token` to the `accounts` table. Use Google's token info endpoint or the `scope` field in the token response to verify `https://mail.google.com/` is present. If the scope is absent, mark the account's `email_provider` as `null` (not `gmail_oauth`), redirect to a "Connect Gmail to send emails" setup page, and surface a non-dismissable owner-facing banner. Never treat a partial-grant as a connected state. Gate: `gmail_refresh_token IS NOT NULL AND gmail_scope_verified = true` before any per-account email send.

**Warning signs:**
- Supabase logs show `auth.users` row created but `accounts.gmail_refresh_token` is null after OAuth flow
- `email_send_log` shows zero rows for an account that completed OAuth signup
- Owner reports "my clients never received confirmation emails"
- Application log: `[EMAIL_QUOTA_EXCEEDED]` NOT firing but emails still not arriving (quota is not the issue — credentials are missing)

**Phase to address:** OAuth signup phase (first phase implementing the combined-scope consent flow). The scope verification check must be written at the same time as the callback handler, not added later.

---

### V17-CP-02: Refresh Token Not Re-stored on Rotation

**What goes wrong:**
Google rotates refresh tokens when a new access token is granted (specifically: if the user re-grants consent, if the refresh token has been idle for 6 months, or if the account exceeds token limits). The old refresh token becomes invalid. If the code fetches a new access token using the current refresh token and does not persist the new refresh token returned in the response, the NEXT token refresh will fail. The account can send one more batch of emails (on the cached access token) then goes silent permanently — with no error surfaced until a booking event triggers a send and the refresh throws a 401.

**Why it happens:**
Google's token refresh response includes a `refresh_token` field only sometimes (when rotation fires). Code that only reads `access_token` from the refresh response will silently discard the new refresh token. This is a common omission.

**How to avoid:**
In the Gmail OAuth provider implementation (`lib/email-sender/providers/gmail-oauth.ts` when written): after every successful `https://oauth2.googleapis.com/token` call, check whether the response body includes a `refresh_token` field. If present, immediately overwrite `accounts.gmail_refresh_token` with the new value. Use the Supabase admin client (service role) for this write — it runs inside the send path which is already server-side. Log the rotation event (without logging the token value) for audit. Pattern: `if (tokenResponse.refresh_token) { await admin.from("accounts").update({ gmail_refresh_token: encrypt(tokenResponse.refresh_token) }).eq("id", accountId); }`

**Warning signs:**
- Intermittent `401 invalid_grant` errors on Gmail API calls, separated by ~6 months
- Owner signs out and back in (re-grants consent) and emails start working again temporarily
- Token rotation events absent from logs (means the re-store step is missing)

**Phase to address:** Per-account Gmail OAuth send phase — the re-store logic must be in the initial provider implementation, not a follow-up patch.

---

### V17-CP-03: Bootstrap Problem — Cap-Hit Account Cannot Self-Email Andrew

**What goes wrong:**
The "Request upgrade" feature is designed to fire when an account hits the 200/day email cap. But at that moment, the account's own Gmail OAuth sender is exactly what is throttled. If the "Request upgrade" email is implemented by calling the per-account Gmail sender, the upgrade request will be silently dropped (QuotaExceededError) at the exact moment it is most needed. The cap-hit state breaks the escape hatch.

**Why it happens:**
The natural implementation is "send an email from the account's sender." The path of least resistance is to reuse the existing send infrastructure. But the quota guard in `lib/email-sender/quota-guard.ts` is keyed on the account's `email_send_log` day count, which is exactly what triggered the cap. Reusing that path means the upgrade request goes through `checkAndConsumeQuota()` → throws `QuotaExceededError` → upgrade request never arrives.

**How to avoid:**
The "Request upgrade" notification to Andrew MUST be routed through the NSI-owned Resend account, bypassing the per-account Gmail sender and bypassing the per-account quota guard entirely. This is a separate code path with a separate email client. The implementation should be a dedicated server action: `requestUpgradeAction()` that calls an NSI Resend client (not the per-account Gmail OAuth client), has its own send infrastructure, and is explicitly excluded from the per-account `email_send_log` count. Treat it as infrastructure-tier, not product-tier. Never let it go through `checkAndConsumeQuota()` for the requester's account.

**Warning signs:**
- `requestUpgradeAction` imports `checkAndConsumeQuota` or calls `sendEmail` from the default client
- Test: mock the quota guard to return `count >= 200` and verify the upgrade email still sends
- Manual test: hit the cap artificially (seed `email_send_log` with 200 rows) and click "Request upgrade"

**Phase to address:** "Request upgrade" + Resend backend phase. The bootstrap constraint must be documented in the phase plan as a hard requirement before any code is written.

---

### V17-CP-04: Token Refresh Race on Concurrent Email Batch

**What goes wrong:**
The Phase 33 pushback cascade sends up to N emails in a `Promise.allSettled` batch from a single server action invocation. In v1.6, all emails go through one centralized Gmail SMTP account, so there is no refresh token. In v1.7, each account has its own Gmail OAuth refresh token. If the access token expires mid-batch, multiple parallel send attempts will simultaneously try to refresh it. Each refresh call will independently call `https://oauth2.googleapis.com/token`. Google may return different access tokens for each call, and may also rotate the refresh token at that moment. The second refresh wins the `UPDATE accounts SET gmail_refresh_token` write; the first's new refresh token is silently discarded. Result: a narrowed but real window where the refresh token is corrupted.

**Why it happens:**
Access tokens expire in 1 hour. A long-running batch (e.g., pushback cascade with 10 bookings, each requiring Gmail API calls) can span the expiry window. `Promise.allSettled` issues all calls without serialization.

**How to avoid:**
Implement token refresh as a singleton per invocation: before issuing the batch, eagerly refresh the access token once (if it expires within the next 5 minutes) and store the result. All sends in the batch share the pre-fetched access token. Only one refresh call fires per invocation. This is simpler than a per-call refresh with mutex and sufficient for v1.7 batch volumes. Implementation: `async function getOrRefreshAccessToken(accountId, currentRefreshToken): Promise<string>` called once at the top of any batch send function, result stored in a local variable, all `gmail.send()` calls in the batch use that variable.

**Warning signs:**
- Intermittent `invalid_grant` errors on only some rows in a multi-row pushback summary
- Two `UPDATE accounts SET gmail_refresh_token` DB writes within the same second for the same account
- A refresh token that works when tested in isolation but fails in the next batch run

**Phase to address:** Per-account Gmail OAuth send phase — the batch-send function must use the pre-fetch pattern from the start.

---

### V17-CP-05: Centralized-to-Per-Account Gmail Cutover — Flag-Day Breaks In-Flight Requests

**What goes wrong:**
v1.6 and all prior versions use a single `GMAIL_USER` + `GMAIL_APP_PASSWORD` (centralized Gmail SMTP) as the email sender, instantiated once as `_defaultClient` in `lib/email-sender/index.ts`. v1.7 migrates to per-account Gmail OAuth. A flag-day cutover (one deploy that removes the old path and enables the new path simultaneously) creates a gap: any Vercel serverless function instance that began executing before the deploy completes (e.g., a pushback cascade mid-flight, or the cron reminder batch) is still holding a reference to the old SMTP client. The new code path requires per-account OAuth tokens that may not yet be stored for all accounts. Andrew's `nsi` account is the only production account; if his OAuth connection is not established before the cutover, ALL production email sends fail.

**Why it happens:**
Vercel does rolling deploys. Old function instances continue serving requests for up to ~30s after a deploy. The v1.5 CP-03 two-step deploy protocol exists for schema drops; the same discipline is needed for email infrastructure swaps.

**How to avoid:**
Use a strangler-fig / feature-flag pattern modeled on CP-03. Step 1: add the per-account Gmail OAuth client alongside the existing SMTP client. Add an `email_provider` column to `accounts` (`'gmail_smtp' | 'gmail_oauth' | 'resend'`, default `'gmail_smtp'`). All send paths read this column and route accordingly. Step 2: Andrew connects his NSI account's Gmail OAuth (testing on a preview branch). Step 3: flip `nsi.email_provider = 'gmail_oauth'`. Step 4: after verifying production emails flow correctly, set the default to `'gmail_oauth'` for new accounts. Step 5: only after all accounts are migrated, remove the `gmail_smtp` path. Never remove the old path in the same deploy that introduces the new one. The `_defaultClient` singleton in `index.ts` must remain valid throughout.

**Warning signs:**
- Deploy plan that removes `GMAIL_APP_PASSWORD` in the same commit that adds `gmail_refresh_token` reads
- `getDefaultClient()` call sites not updated to accept a per-account override
- No `email_provider` discriminator column in the migration

**Phase to address:** Per-account Gmail OAuth send phase. The phase plan must explicitly enumerate both deploy steps and require Andrew to manually connect NSI OAuth before Step 3.

---

### V17-CP-06: Refresh Token Stored Unencrypted in Supabase

**What goes wrong:**
Gmail OAuth refresh tokens are long-lived credentials that grant `gmail.send` access to someone's Gmail account. Storing them as plain text in `accounts.gmail_refresh_token` means that any service-role key exposure, any Supabase RLS misconfiguration, or any SQL injection path gives an attacker the ability to send email as every account's Gmail address. This is a higher-privilege credential than a booking token or a session cookie — it does not expire on its own and grants access to the owner's real Gmail account.

**Why it happens:**
The convenience path (store as text, read as text) matches every other column in the `accounts` table. The schema doesn't enforce encryption. Developers default to plaintext unless explicitly required to do otherwise.

**How to avoid:**
Encrypt refresh tokens at the application layer before writing to Supabase, using a server-side symmetric key (`GMAIL_REFRESH_TOKEN_ENCRYPTION_KEY` env var, 256-bit AES-GCM). Decrypt in the send path. Never store the plaintext token in Supabase. The encryption key must be a Vercel environment variable (not in the repo, not in `.env.local`). Use a dedicated `encryptToken(plain: string): string` / `decryptToken(cipher: string): string` utility in `lib/crypto.ts`. Column name: `gmail_refresh_token_encrypted` to make the encrypted nature self-documenting. Never log the plaintext token or the decrypted value.

**Warning signs:**
- `accounts.gmail_refresh_token` column type is `text` without a `_encrypted` suffix
- No `GMAIL_REFRESH_TOKEN_ENCRYPTION_KEY` in Vercel env vars
- Send path calls `account.gmail_refresh_token` directly without a decryption step

**Phase to address:** Per-account Gmail OAuth send phase — the migration that adds the column must define it as the encrypted form from day one.

---

### V17-CP-07: Token Revocation — Silent Email Failure After User Removes App

**What goes wrong:**
A Gmail account owner can visit `myaccount.google.com/permissions` and revoke the app's access at any time. After revocation, the stored refresh token is permanently invalid. The next email send that uses that token will receive a `401 invalid_grant` error. If the code treats this as a transient network error (logs and continues), all subsequent sends for that account silently fail. Booking confirmations, reminders, and cancellation emails stop arriving; the owner sees no error in-app.

**Why it happens:**
A `401 invalid_grant` error looks like a network blip to generic error handlers. The distinction between "token expired" (retryable with the stored refresh token) and "token revoked" (requires re-authorization) is not obvious without reading Google's error response body.

**How to avoid:**
Parse Google's error response: `{ "error": "invalid_grant", "error_description": "Token has been expired or revoked" }`. On this specific error, do NOT retry — set `accounts.gmail_refresh_token_encrypted = NULL` and `accounts.email_provider = 'disconnected'` via admin client. Surface a non-dismissable in-app banner on the owner dashboard: "Your Gmail connection was revoked. Reconnect to resume sending emails." The fail-closed behavior from Phase 31 (refuse-send when credentials invalid) already applies; the new requirement is the in-app surfacing and the state update. Without the state update, every subsequent email attempt burns a network round-trip and logs an error before failing.

**Warning signs:**
- `invalid_grant` errors repeating indefinitely in logs for the same account
- `email_send_log` showing successful quota consumption but no emails delivered
- No `disconnected` state in `email_provider` enum

**Phase to address:** Per-account Gmail OAuth send phase — the error handler for `invalid_grant` must be in the initial provider implementation.

---

### V17-CP-08: Scope Upgrade Flow for Existing Email/Password Accounts

**What goes wrong:**
v1.7 adds Google OAuth as the signup method with combined `gmail.send` scope. But existing accounts (Andrew's `nsi` account, any v1.1 email/password signups) will need a separate "Connect Gmail" flow to obtain their OAuth tokens — they cannot use the new signup flow because they already have accounts. If no upgrade path is designed, these accounts are permanently stuck on SMTP or have no sender configured. Andrew's `nsi` account is the only real production account; if this path is not explicitly built, NSI has no email after the cutover (CP-05).

**Why it happens:**
OAuth "connect" flows are distinct from OAuth "signup" flows but share much of the same code. Teams build the signup path first and assume the connect path is identical, then discover that Supabase's `signInWithOAuth` creates a new user rather than linking to an existing session.

**How to avoid:**
Build a dedicated `/app/settings/email` page with a "Connect Gmail" button. The button calls `supabase.auth.linkIdentity({ provider: 'google', options: { scopes: 'gmail.send' } })` (NOT `signInWithOAuth`), which links the Google identity to the existing Supabase user without creating a new account. The callback handler extracts the OAuth tokens from the provider token payload and stores the encrypted refresh token on the existing `accounts` row. Test explicitly with Andrew's `nsi` account on a preview branch before any production change.

**Warning signs:**
- No `/app/settings/email` or equivalent route in the v1.7 plan
- Upgrade path uses `signInWithOAuth` (creates new user) instead of `linkIdentity` (links to existing)
- Andrew's account is not mentioned in the manual QA checklist for this phase

**Phase to address:** OAuth signup phase (or a dedicated sub-phase for existing-account Gmail connect). This cannot be deferred — Andrew's account must be connected before the cutover.

---

### V17-CP-09: quota-guard Counts Against Wrong Account After Sender Refactor

**What goes wrong:**
The current `checkAndConsumeQuota()` in `lib/email-sender/quota-guard.ts` inserts into `email_send_log` with only a `category` field — no `account_id`. `getDailySendCount()` counts ALL rows in the table for the current UTC day, regardless of account. This is correct for the current single-sender model (one centralized Gmail = one shared cap). After the migration to per-account senders, each account has its own 200/day cap. If the quota guard is not refactored to be per-account-aware, a flood of sends from account A will count against account B's quota, and the cap will behave as a global cap across all accounts rather than per-account cap.

**Why it happens:**
The existing implementation was designed for a single shared sender. When adding multi-tenant, developers may update the send path but overlook the quota counting logic, especially since `checkAndConsumeQuota` is a shared utility that multiple paths call.

**How to avoid:**
Before writing any per-account send code, refactor `email_send_log` to include an `account_id` column (nullable for signup-side sends that predate account creation). Update `checkAndConsumeQuota(category, accountId)` to accept `accountId` and filter `getDailySendCount` by `account_id`. Update `getRemainingDailyQuota(accountId)` similarly. Update all 7 call sites (grep `checkAndConsumeQuota` and `getRemainingDailyQuota` for all callers). The `email_send_log` migration must run before any per-account send code is deployed. Verify by running two accounts simultaneously and confirming each has its own count.

**Warning signs:**
- `email_send_log` schema lacks `account_id` column
- `getDailySendCount()` has no WHERE filter on account_id
- `checkAndConsumeQuota` signature does not accept accountId parameter

**Phase to address:** Per-account Gmail OAuth send phase, as the first task — the quota guard refactor is a prerequisite for per-account send, not a follow-up.

---

### V17-CP-10: Magic-Link Login Email Enumeration

**What goes wrong:**
If the magic-link request handler returns different responses for "email address exists" vs "email address does not exist," an attacker can enumerate which email addresses have accounts by watching the response. This violates GDPR-adjacent privacy norms and leaks account existence. The risk is lower for a booking tool than for a financial service, but for a multi-tenant product where owners are real businesses, leaking "this business uses this booking tool" is a credible concern.

**Why it happens:**
The naive implementation calls Supabase's magic link API and returns its response verbatim. Supabase's `signInWithOtp` does not throw for unknown emails by default (it just sends nothing), but the distinction may surface in error handling.

**How to avoid:**
The UI response must always be: "If an account exists with that email address, a login link has been sent." This is the same message regardless of whether Supabase found the email. Do not branch on the response type or error code in the user-facing layer. Log the actual result server-side (for ops visibility) but never expose it to the client. Test: verify that POST with a known email and POST with an unknown email return identical HTTP status and response body.

**Warning signs:**
- UI shows "Email not found" for unknown addresses
- Different HTTP status codes returned for known vs unknown emails
- Supabase error code surfaced in the client response body

**Phase to address:** Magic-link login phase — the response normalization must be in the initial handler, not added after.

---

### V17-CP-11: Resend DNS Not Verified Before "Request Upgrade" Feature Ships

**What goes wrong:**
NSI's Resend account requires domain verification (SPF/DKIM records for the sending domain, e.g., `nsi-booking.com` or `northstarintegrations.com`) before outbound email can be sent from a custom domain. If the "Request upgrade" feature ships before DNS is verified, all upgrade request emails will either be blocked by Resend or sent from a generic Resend-shared domain with poor deliverability. Andrew may not notice because the upgrade request is sent to his own inbox — but the first time a client sends one, it goes to spam.

**Why it happens:**
Resend DNS verification is a manual step in the Resend dashboard + DNS provider (Namecheap in Andrew's case). It is easy to defer as a "setup task" and easy to forget. DNS propagation takes 5-60 minutes; the dependency is invisible in code.

**How to avoid:**
Make DNS verification a hard prerequisite gate in the phase plan for "Request upgrade + Resend backend." The phase must have a manual checkpoint: "Verify SPF/DKIM in Resend dashboard shows 'Verified'" before any Resend send code is deployed to production. The checkpoint must include sending a test email to a throwaway address and confirming delivery + headers (check for `dkim=pass` in received headers). Do not deploy Resend send code until the domain is verified.

**Warning signs:**
- Resend dashboard shows domain status "Pending"
- Phase plan has no manual DNS verification checkpoint
- Code deployment and DNS setup in the same phase task

**Phase to address:** Resend backend phase — the DNS setup must be Task 1 and a manual checkpoint before any code task.

---

## Moderate Pitfalls

### V17-MP-01: Multi-Google-Account Confusion — Personal vs Workspace Gmail

**What goes wrong:**
An owner signs up with their personal `@gmail.com` address but their business uses a Google Workspace account (`name@businessdomain.com`). Booking emails will come from their personal Gmail. This is brand-inconsistent and may confuse bookers. In the reverse case, the owner signs in with their Workspace account but their business email is different — the From address on booking emails becomes their corporate IT-managed email, which may be actively monitored or have stricter policies.

**Prevention:** Surface the authenticated Gmail address ("You will send emails from: you@gmail.com") explicitly on the connect screen before the owner completes OAuth, and repeat it on the Settings page. Allow re-linking. Do not assume "the OAuth email" is "the desired sending address."

**Phase to address:** OAuth signup phase — the confirmation UI must show the From address before token storage.

---

### V17-MP-02: Cross-Device Magic-Link — Link Clicked in Different Browser

**What goes wrong:**
Supabase magic links are single-use and tied to the browser session that initiated the request in some configurations. A user who requests a magic link on their phone and opens it on their laptop (or in a different browser) may get an error or be redirected without a session. This is more common than expected because email clients open links in their own embedded browsers.

**Prevention:** Test cross-device and cross-browser explicitly in the manual QA phase. Supabase's PKCE flow for magic links requires the link to complete in the same browser session that initiated the request. If that constraint is too restrictive, use the `flowType: 'pkce'` setting explicitly and document the behavior ("Link must be opened in the same browser where you requested it"). Surface a clear error message, not a blank redirect, if the link is used in the wrong context.

**Phase to address:** Magic-link login phase — cross-device behavior must be in the manual QA checklist.

---

### V17-MP-03: Refresh Token Expiry Mid-Cron — Reminder Batch Silently Drops Emails

**What goes wrong:**
The cron reminder batch (`app/api/cron/send-reminders/route.ts`) currently iterates claimed bookings and calls `sendReminderBooker`. In v1.7, `sendReminderBooker` will need to fetch and potentially refresh a per-account OAuth token. If the token expires mid-batch and the refresh attempt fails (e.g., `invalid_grant` after revocation), the current error handler logs and continues — `remindersSent` increments for successful sends but subsequent sends for the same account fail silently. The per-account error must surface in the cron response body and trigger the revocation state update (see V17-CP-07).

**Prevention:** In the cron handler, distinguish `InvalidGrantError` (permanent, requires re-auth) from `TokenRefreshError` (transient, retry next tick) in the per-booking catch block. On `InvalidGrantError`, call the same revocation handler as V17-CP-07. Add `token_revoked` to the cron response counts alongside `reminders_sent` and `quota_refused`.

**Phase to address:** Per-account Gmail OAuth send phase — the cron handler must be updated in the same phase as the sender refactor.

---

### V17-MP-04: Animated Slide-In Delays BookingForm Mount Past Turnstile Token Window

**What goes wrong:**
V15-MP-05 established the invariant: `BookingForm` is NOT mounted until a slot is selected (placeholder `<div>` replaces it). Turnstile tokens are valid for ~2 minutes from widget mount. BOOKER-06 adds an animated slide-in when the form column appears. If the animation is CSS-transition-based and triggered by a state change, the `BookingForm` mounts immediately when `selectedSlot` becomes non-null — the animation plays on the already-mounted component. This is fine. The risk is an implementation that mounts `BookingForm` *before* the slot is selected (e.g., to pre-render the form off-screen for a smoother animation), which would start the Turnstile token clock early. By the time the booker finishes picking a date and time and focuses on the form (30-90 seconds), the token is still valid. But on slow connections or thoughtful bookers, a 2-minute window shrinks.

**Prevention:** Keep the V15-MP-05 lock: `BookingForm` mounts ONLY when `selectedSlot !== null`. The slide-in animation must be applied to the mounted form (CSS transform/opacity on mount), not to a pre-mounted hidden form. Use `data-state="entering"` + CSS `@keyframes` or a Framer Motion `AnimatePresence` around `{selectedSlot && <BookingForm ... />}`. Test that Turnstile `onSuccess` fires after the full animation completes and that submitting a form that appeared via animation succeeds.

**Warning signs:**
- `BookingForm` rendered in DOM before `selectedSlot` is non-null (check React DevTools)
- `useEffect` in `BookingForm` has no `selectedSlot` dependency gate
- Turnstile widget mounted outside the `selectedSlot &&` conditional

**Phase to address:** BOOKER-06/07 polish phase.

---

### V17-MP-05: Skeleton During Slot-Pick Ambiguity — Loading vs No-Input State

**What goes wrong:**
BOOKER-07 adds a skeleton loader for the form column. The current booking-shell.tsx has two meaningful empty states for the form column: (1) `selectedSlot === null` (waiting for user input — show a placeholder), and (2) `selectedSlot !== null` but `loading === true` (rare: slot selected but slots are re-fetching after a race-loser refresh). If the skeleton renders for both states, a first-time visitor sees a skeleton before they have even picked a date, which implies "loading is happening" when in fact the app is waiting for them to act. This is a UX falsehood and trains the user to wait rather than interact.

**Prevention:** Skeleton applies only to the form-column placeholder when `selectedSlot !== null AND loading`. The `selectedSlot === null` state must continue to show the "Pick a time on the left to continue" instructional text, never a skeleton. The distinction already exists in `booking-shell.tsx` line 255-268 — the conditional guards against this — but the BOOKER-07 implementation must not collapse the two states.

**Phase to address:** BOOKER-06/07 polish phase.

---

### V17-MP-06: BOOKER-06 Slide-In Breaks Zero-Layout-Shift Invariant

**What goes wrong:**
v1.5 established a zero-layout-shift invariant: the 3-column grid reserves 320px for the form column at all times (V15-MP-04 LOCK). An animated slide-in that uses width or height transitions (rather than transform/opacity) will cause layout shift during the transition, pushing the calendar and time columns sideways. This fails the invariant and produces a jarring visual.

**Prevention:** Animated transitions for the form column must use `transform: translateX()` and `opacity` only — not `width`, `height`, or `margin` changes. The 320px column is always present in the grid; the animation affects only the content inside the column, not the column itself. Verify with Chrome DevTools Layout Shift debugger (CLS = 0.0 after animation).

**Phase to address:** BOOKER-06/07 polish phase.

---

### V17-MP-07: prefers-reduced-motion Not Respected for BOOKER-06

**What goes wrong:**
CSS animations without a `prefers-reduced-motion: reduce` media query bypass the user's accessibility preference. Some users (vestibular disorders, motion sickness) have motion-reduction enabled at the OS level. Ignoring it is an accessibility failure and may cause discomfort.

**Prevention:** Wrap the BOOKER-06 animation in `@media (prefers-reduced-motion: no-preference) { ... }` so it only fires for users who have not requested reduced motion. The fallback (no animation) is already the current behavior — this is an additive change only. If using Framer Motion, set `transition={{ duration: 0 }}` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`.

**Phase to address:** BOOKER-06/07 polish phase — the media query must be in the initial animation implementation.

---

### V17-MP-08: Dead-Code Audit False Positives — Dynamic Imports and Middleware References

**What goes wrong:**
Static analysis tools report "unused" files that are actually referenced via `next/dynamic(() => import('./foo'))`, `import(process.env.SOME_MODULE)`, string-concatenated module paths, Next.js middleware (`middleware.ts` itself and any module it imports), or files referenced only by Vitest test setup (`tests/setup.ts` imports). Deleting any of these breaks production or CI silently.

**Prevention:**
1. Migration `.sql` files in `supabase/migrations/` must NEVER be deleted — they define the production schema history. Add an explicit rule to the audit: "SQL files are excluded from deletion candidates."
2. Files imported only by `tests/` are dead to production but critical for CI. Treat test-only files as a separate category: "keep unless the test itself is being deleted."
3. Run `next build` after each deletion batch (not just `tsc --noEmit`) — Next.js dead-code detection differs from TypeScript's.
4. Grep for dynamic import patterns: `next/dynamic`, `import(`, `require(` with string literals that contain the file path.
5. Per-item sign-off (already planned in v1.7 scope) is the correct gate. Never batch-delete without Andrew's explicit approval per file.

**Phase to address:** Dead-code audit phase — the audit rules must be written before any mapper runs.

---

### V17-MP-09: TypeScript Drift During Sender Refactor — `EmailProvider` Type Narrowing

**What goes wrong:**
`lib/email-sender/types.ts` currently defines `EmailProvider = "gmail"`. Adding `"gmail_oauth"` and `"resend"` to this union without updating all downstream `switch` exhaustiveness checks will cause TypeScript to pass `--noEmit` while runtime behavior falls into unhandled default branches. The existing `createEmailClient` factory has a `default: throw new Error(...)` branch — this is the runtime symptom. If a test mocks `provider: "gmail_oauth"` against the old type definition, `tsc` will report an error that looks like a test file issue, not a type system issue.

**Prevention:** When adding new `EmailProvider` variants, update: (1) the `EmailProvider` type in `types.ts`, (2) the `switch` in `createEmailClient`, (3) the `EmailClientConfig` interface for provider-specific fields, and (4) the vitest.config.ts mock (`tests/__mocks__/email-sender.ts`) to handle the new provider. Do this in one commit to avoid a window where the type and the switch are out of sync. Use TypeScript's exhaustiveness pattern (`const _exhaustive: never = config.provider;`) in the default branch to make missed cases a compile error, not a runtime throw.

**Warning signs:**
- `EmailProvider` type change and `createEmailClient` switch update in separate commits
- `bookings-api.test.ts` (the lone failing test at v1.6) starts failing for new reasons — fixture mismatch is one symptom of type drift

**Phase to address:** Per-account Gmail OAuth send phase — the type update is Task 1 before any provider implementation.

---

### V17-MP-10: Per-Account Quota Count After Upgrade — Downgrade Cap State Unknown

**What goes wrong:**
An upgraded account (`email_provider = 'resend'`) no longer routes sends through the per-account Gmail sender, so its `email_send_log` rows may stop being written (or be written with `account_id = null`). If the account later downgrades back to Gmail, what is its cap state for today? If the quota guard uses the day's existing `email_send_log` count, it may show 0 (if Resend sends were not logged) even though the account sent 150 emails via Resend today. The account could then send another 200 via Gmail in the same UTC day, burning significantly more than the 200/day Gmail cap is meant to protect.

**Prevention:** Continue writing rows to `email_send_log` for ALL send paths, including Resend sends for upgraded accounts. The log is an analytics and audit record, not just a cap enforcement mechanism. The `category` field already has the right shape; add `email_provider` as a column to `email_send_log` to distinguish the path. Cap enforcement for Gmail applies to `email_provider = 'gmail_oauth'` rows; Resend sends are not capped at 200/day but should still be logged.

**Phase to address:** Resend backend phase — `email_send_log` schema update must accompany the Resend sender implementation.

---

### V17-MP-11: Vitest Alias Regex Exact-Match — New Email Provider Sub-Path Breaks Mock

**What goes wrong:**
Phase 32 (Plan 32-03) locked the vitest `resolve.alias` to an exact-match regex: `find: /^@\/lib\/email-sender$/`. This correctly intercepts `import { sendEmail } from "@/lib/email-sender"` but passes through `import { checkAndConsumeQuota } from "@/lib/email-sender/quota-guard"`. When v1.7 adds a new sub-path (e.g., `@/lib/email-sender/providers/gmail-oauth`), that sub-path is NOT intercepted by the mock. Tests that import a module which in turn imports `@/lib/email-sender/providers/gmail-oauth` will attempt to resolve the real provider — which imports `server-only` and may import `google-auth-library`, both of which would fail in the Vitest environment.

**Prevention:** Before writing tests for the new OAuth provider, add a new alias entry in `vitest.config.ts` for `@/lib/email-sender/providers/gmail-oauth` (exact-match regex) mapping to a stub that returns a mock OAuth client. Follow the same pattern as the existing `email-sender` mock. Update `tests/__mocks__/` accordingly. Do NOT broaden the existing alias to a prefix match — the Phase 32 rationale for exact-match still applies.

**Phase to address:** Per-account Gmail OAuth send phase — test setup must be done before writing tests.

---

### V17-MP-12: Env Var Drift Between Dev / Preview / Production for New Credentials

**What goes wrong:**
v1.7 introduces at minimum: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `GMAIL_REFRESH_TOKEN_ENCRYPTION_KEY`. If these are only set in production Vercel but not in preview environments, preview deploys will silently fall back to SMTP or throw on the first OAuth callback. If they are set in preview but not in `.env.local`, local `next dev` will crash on import. If `GMAIL_REFRESH_TOKEN_ENCRYPTION_KEY` differs between preview and production, tokens stored via preview testing will be un-decryptable in production.

**Prevention:** Create a `.env.local.example` file (committed to repo, no actual values) enumerating all new env vars with comments. Add a startup check in the OAuth callback handler: `if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Error("[oauth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET")` that fails loudly at request time (not silently at send time). For `GMAIL_REFRESH_TOKEN_ENCRYPTION_KEY`, use the same key for both preview and production — or use separate keys with awareness that tokens are environment-specific. Document which env vars are per-environment vs shared in the phase plan.

**Phase to address:** OAuth signup phase — the env var enumeration should be the first task in the phase plan.

---

### V17-MP-13: LD-07 Booker-Neutrality Violated by Resend "From" Address

**What goes wrong:**
LD-07 (established v1.5 Phase 29-01) requires that booker-facing surfaces never reveal NSI branding or owner identity. The "Request upgrade" email goes FROM the owner TO Andrew — this is an owner-facing notification and LD-07 does not apply. But if any per-account Resend send (e.g., upgraded accounts' booking confirmations) uses `from: "North Star Integrations <nsi@northstarintegrations.com>"` instead of the owner's configured `from` name, bookers will see NSI branding instead of the business they booked with. This breaks the product's white-label promise.

**Prevention:** Per-account Resend sends must use the same `from` name resolution as the current Gmail SMTP path: `${account.name} Booking <nsi-send@northstarintegrations.com>` or equivalent that surfaces the account name, not NSI. The From address domain will be NSI's (since NSI owns the Resend account), but the From name must be the contractor's business name. Test: book an appointment with an upgraded account; verify the From name in the booker's inbox is the business name, not "North Star Integrations."

**Phase to address:** Resend backend phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store plain-text OAuth refresh tokens during development | Fast iteration | Security exposure in production | NEVER in production — must encrypt before any production deploy |
| Skip per-account quota isolation during initial OAuth send | Simpler launch | Global quota misleads owners; one account flood affects all | Acceptable for single-tenant (nsi-only) window; must fix before second account goes live |
| Use same encryption key across preview + production | No key management complexity | Cannot migrate tokens between environments | Acceptable if documented; not acceptable if preview tokens ever need to move to production |
| Reuse `sendEmail()` default client for "Request upgrade" | One line of code | Bootstrap problem (V17-CP-03) — breaks at cap | NEVER — always use NSI Resend for upgrade requests |
| Defer Resend DNS verification to "after we see if it works" | Faster start | First test email goes to spam; DNS takes time | NEVER — DNS must be pre-verified before any code ships |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google OAuth | Check only for `access_token` presence, not granted scopes | Read `token_response.scope`, verify `gmail.send` or `https://mail.google.com/` present |
| Google OAuth | Discard `refresh_token` on rotation (only reads `access_token`) | Always check for `refresh_token` in response; persist if present |
| Google OAuth | Call `signInWithOAuth` for existing-user Gmail connect | Use `supabase.auth.linkIdentity()` to link without creating duplicate user |
| Supabase magic-link | Expose different responses for known vs unknown emails | Always return identical "check your email" response regardless |
| Supabase magic-link | Assume PKCE flow works cross-device | Test explicitly; document single-browser requirement if PKCE is used |
| Resend | Send from custom domain before DNS verified | Run DNS verification as Phase Task 1 with manual checkpoint |
| Resend | Use `from: "NSI <nsi@nsi.com>"` for booker-facing sends | Use account name in From field; NSI domain in address only |
| Vercel env vars | Add new vars to production only | Add to all environments: production + preview + local example |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plaintext Gmail refresh token in Supabase `text` column | Service-role key exposure or RLS bypass grants gmail.send to attacker | AES-GCM encryption at application layer; column named `_encrypted` |
| Email enumeration on magic-link request | Attacker discovers which businesses use the tool | Identical response body for known + unknown emails |
| Upgrade request routed through per-account Gmail sender | Upgrade request fails silently at the moment it is needed | NSI Resend as dedicated upgrade-request infrastructure |
| OAuth callback does not verify granted scopes | Account appears connected but sends nothing | Scope verification before any `gmail_refresh_token` write |

---

## "Looks Done But Isn't" Checklist

- [ ] **OAuth signup:** Verified that `gmail.send` scope is in the granted token (not just `openid email profile`) before marking account connected
- [ ] **Per-account Gmail cutover:** Andrew's `nsi` account has OAuth tokens stored AND tested on preview before production cutover
- [ ] **Quota guard:** `email_send_log` has `account_id` column and all 7 `checkAndConsumeQuota` call sites pass `accountId`
- [ ] **Refresh token rotation:** `UPDATE accounts SET gmail_refresh_token_encrypted` called whenever Google returns a new `refresh_token` in the token response
- [ ] **Token revocation handling:** `invalid_grant` error triggers `email_provider = 'disconnected'` state + in-app banner (not just a log line)
- [ ] **Request upgrade bootstrap:** `requestUpgradeAction` uses NSI Resend client, NOT `checkAndConsumeQuota` for the requester's account
- [ ] **Resend DNS:** Domain shows "Verified" in Resend dashboard before any Resend send code reaches production
- [ ] **LD-07 on Resend:** Upgraded accounts' booker emails show business name in From field, not "North Star Integrations"
- [ ] **BOOKER-06 V15-MP-05 lock:** `BookingForm` mounts only when `selectedSlot !== null` (no pre-render for animation)
- [ ] **BOOKER-06 zero-layout-shift:** Animation uses `transform`/`opacity` only; grid column width unchanged during transition
- [ ] **BOOKER-07 skeleton state:** Skeleton does NOT render when `selectedSlot === null` (show instructional text instead)
- [ ] **Dead-code audit:** SQL migration files excluded from deletion candidates; test-only files in separate category
- [ ] **Vitest aliases:** New `@/lib/email-sender/providers/gmail-oauth` sub-path has its own exact-match alias in `vitest.config.ts`
- [ ] **Env vars:** All new vars enumerated in `.env.local.example`; startup check throws on missing critical vars

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| V17-CP-01 Partial OAuth grant | LOW | Set `email_provider = null`, show connect banner, user re-authorizes with full scopes |
| V17-CP-02 Refresh token not re-stored | MEDIUM | User must re-authorize OAuth; all stored tokens that may have been rotated become invalid; run re-auth flow for all affected accounts |
| V17-CP-03 Bootstrap problem | HIGH | Upgrade path is broken for all cap-hit accounts; requires hotfix deploy to route upgrade sends through Resend infrastructure |
| V17-CP-05 Flag-day cutover failure | HIGH | Rollback to previous deploy; all emails stop for however long the broken deploy was live; recovery = revert + re-plan strangler-fig |
| V17-CP-06 Unencrypted tokens | HIGH | Rotate all Gmail app permissions (owners visit Google account security page); generate new encryption key; re-auth all accounts; audit logs for any unauthorized access |
| V17-CP-07 Token revocation silent | MEDIUM | Identify affected accounts via `invalid_grant` log scan; set `email_provider = 'disconnected'`; contact owners to re-authorize |
| V17-CP-09 Wrong-account quota counting | MEDIUM | Backfill `email_send_log.account_id` from `booking_events` join; re-run quota counts per account |
| V17-MP-11 Vitest alias breakage | LOW | Add missing alias entry in `vitest.config.ts`; re-run tests |
| V17-MP-12 Env var drift | LOW | Add missing vars to Vercel environment settings; redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| V17-CP-01 Partial OAuth grant | OAuth signup | Test: deny `gmail.send` on consent screen; verify account shows "not connected" state |
| V17-CP-02 Refresh token rotation | Per-account Gmail OAuth send | Test: mock Google token response with new `refresh_token`; verify DB updated |
| V17-CP-03 Bootstrap problem | Request upgrade + Resend backend | Test: seed `email_send_log` to 200 rows; click upgrade button; verify email arrives via Resend |
| V17-CP-04 Token refresh race | Per-account Gmail OAuth send | Test: mock access token expiry; send 3-email batch; verify single refresh call in logs |
| V17-CP-05 Flag-day cutover | Per-account Gmail OAuth send | Manual checkpoint: Andrew connects NSI Gmail OAuth on preview; smoke-test booking confirmation before production cutover |
| V17-CP-06 Unencrypted tokens | Per-account Gmail OAuth send (migration task) | Verify: `accounts.gmail_refresh_token_encrypted` column type; no plaintext column exists |
| V17-CP-07 Token revocation | Per-account Gmail OAuth send | Test: mock `invalid_grant` response; verify `email_provider = 'disconnected'` + banner renders |
| V17-CP-08 Existing-account upgrade | OAuth signup (or dedicated settings sub-phase) | Manual: Andrew connects NSI account via `/app/settings/email` using `linkIdentity` |
| V17-CP-09 Quota wrong account | Per-account Gmail OAuth send (prerequisite task) | Test: two-account quota isolation test; account A at cap does not block account B |
| V17-CP-10 Magic-link enumeration | Magic-link login | Test: POST known email + POST unknown email; verify identical response body + status |
| V17-CP-11 Resend DNS not verified | Resend backend (Task 1) | Manual: Resend dashboard shows "Verified"; test email with dkim=pass in headers |
| V17-MP-01 Personal vs Workspace Gmail | OAuth signup | UI: display From address before token storage; manual QA checklist item |
| V17-MP-04 Turnstile token window | BOOKER-06/07 polish | Manual: inspect React DevTools — BookingForm absent from DOM before slot selected |
| V17-MP-06 Layout shift from animation | BOOKER-06/07 polish | Lighthouse CLS = 0.0 after slot pick animation |
| V17-MP-07 prefers-reduced-motion | BOOKER-06/07 polish | OS setting: enable reduced motion; verify no animation fires |
| V17-MP-08 Dead-code false positives | Dead-code audit | Rule: SQL files excluded; test-only files separate category; `next build` after each batch |
| V17-MP-09 TypeScript drift | Per-account Gmail OAuth send | Exhaustiveness check in `createEmailClient` default branch; `tsc --noEmit` clean |
| V17-MP-11 Vitest alias regex | Per-account Gmail OAuth send | New provider sub-path has alias entry; `npm test` passes for provider tests |
| V17-MP-12 Env var drift | OAuth signup (first task) | `.env.local.example` committed; startup check in callback handler |
| V17-MP-13 LD-07 Resend From address | Resend backend | Manual: book with upgraded account; verify booker inbox shows business name in From |

---

## Sources

- Live codebase inspection: `lib/email-sender/`, `lib/email-sender/quota-guard.ts`, `lib/email-sender/types.ts`, `app/api/cron/send-reminders/route.ts`, `app/[account]/[event-slug]/_components/booking-shell.tsx`, `vitest.config.ts`
- Phase 33 SUMMARY files (33-01 through 33-04): ABORT-on-diverge, skipOwnerEmail/actor patterns, booker_name column incident, refresh token and cascade patterns
- PROJECT.md Key Decisions section: CP-03 two-step deploy protocol, V15-MP-05 Turnstile lock, LD-07 booker-neutrality, Phase 31 quota-guard fail-closed contracts
- Phase 32 decision: vitest resolve.alias exact-match regex (`find: /^@\/lib\/email-sender$/`)
- Phase 33-02 incident: `booker_first_name` nonexistent column → "Plans must reference real DB columns — grep migrations before naming fields"

---

*Domain: Multi-tenant booking app — v1.7 Auth Expansion + Per-Account Email*
*Researched: 2026-05-06*
