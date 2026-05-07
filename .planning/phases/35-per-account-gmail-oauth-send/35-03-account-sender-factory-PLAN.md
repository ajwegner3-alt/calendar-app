---
phase: 35-per-account-gmail-oauth-send
plan: 03
type: execute
wave: 3
depends_on: ["35-02"]
files_modified:
  - lib/email-sender/account-sender.ts
  - tests/account-sender.test.ts
autonomous: true

must_haves:
  truths:
    - "getSenderForAccount(accountId) returns an EmailClient backed by that account's Gmail OAuth credential"
    - "On missing or needs_reconnect credential, returns a REFUSED_SENDER whose .send() resolves { success: false, error: starts-with 'oauth_send_refused' }"
    - "On invalid_grant from Google, the factory updates account_oauth_credentials.status = 'needs_reconnect' AND returns REFUSED_SENDER"
    - "Factory never throws — every error path returns a sender (real or refused)"
    - "Factory uses account.owner_email as the authenticated Gmail address"
  artifacts:
    - path: "lib/email-sender/account-sender.ts"
      provides: "Per-account Gmail OAuth sender factory"
      exports: ["getSenderForAccount", "REFUSED_SEND_ERROR_PREFIX"]
      min_lines: 80
  key_links:
    - from: "lib/email-sender/account-sender.ts"
      to: "account_oauth_credentials table"
      via: "supabase admin client select(refresh_token_encrypted, status)"
      pattern: "from\\(\"account_oauth_credentials\"\\)"
    - from: "lib/email-sender/account-sender.ts"
      to: "lib/oauth/encrypt.ts:decryptToken"
      via: "decrypt refresh_token_encrypted before exchange"
      pattern: "decryptToken"
    - from: "lib/email-sender/account-sender.ts"
      to: "lib/oauth/google.ts:fetchGoogleAccessToken"
      via: "exchange decrypted refresh token for access token"
      pattern: "fetchGoogleAccessToken"
    - from: "lib/email-sender/account-sender.ts"
      to: "lib/email-sender/providers/gmail-oauth.ts:createGmailOAuthClient"
      via: "construct EmailClient with user + accessToken"
      pattern: "createGmailOAuthClient"
    - from: "invalid_grant branch"
      to: "account_oauth_credentials.status update"
      via: "admin.from('account_oauth_credentials').update({ status: 'needs_reconnect' })"
      pattern: "needs_reconnect"
---

<objective>
Build `getSenderForAccount(accountId)` — the central factory that all 7 transactional email paths will call in Plan 04. Composes Plan 02's two utilities (`fetchGoogleAccessToken` + `createGmailOAuthClient`) with a Supabase credential lookup and `invalid_grant` revocation handling.

Purpose: This is the single chokepoint that enforces (a) per-account credential isolation, (b) automatic `needs_reconnect` flagging on revocation (AUTH-30), and (c) graceful refusal-rather-than-throw failure mode (CONTEXT decision: booking succeeds, email skipped). Centralizing here means callers in Plan 04 just check `result.success` — they never need to know about OAuth.

Output: `lib/email-sender/account-sender.ts` exporting `getSenderForAccount`. Test suite covering all branches with mocked Supabase + token exchange.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@.planning/phases/35-per-account-gmail-oauth-send/35-02-SUMMARY.md
@lib/email-sender/providers/gmail-oauth.ts
@lib/oauth/google.ts
@lib/oauth/encrypt.ts
@lib/supabase/admin.ts
@supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement getSenderForAccount factory</name>
  <files>lib/email-sender/account-sender.ts</files>
  <action>
    Create `lib/email-sender/account-sender.ts` following RESEARCH §Pattern 1 exactly:

    ```typescript
    import "server-only";
    import { createAdminClient } from "@/lib/supabase/admin";
    import { decryptToken } from "@/lib/oauth/encrypt";
    import { fetchGoogleAccessToken } from "@/lib/oauth/google";
    import { createGmailOAuthClient } from "./providers/gmail-oauth";
    import type { EmailClient, EmailOptions, EmailResult } from "./types";

    /** Stable prefix callers can match on to distinguish OAuth refusal from other send errors. */
    export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";

    function refusedSender(reason: string): EmailClient {
      return {
        provider: "gmail",
        async send(_: EmailOptions): Promise<EmailResult> {
          return { success: false, error: `${REFUSED_SEND_ERROR_PREFIX}: ${reason}` };
        },
      };
    }

    /**
     * Per-account Gmail OAuth sender factory.
     *
     * Flow (RESEARCH §Pattern 1):
     *   1. Look up account → owner_user_id, owner_email.
     *   2. Look up account_oauth_credentials by user_id + provider='google'.
     *   3. Decrypt refresh_token_encrypted.
     *   4. Exchange refresh token for fresh access token.
     *   5. On invalid_grant: UPDATE status='needs_reconnect' and return refused sender (AUTH-30).
     *   6. Return EmailClient backed by createGmailOAuthClient.
     *
     * Never throws. Every failure path returns a sender (real or refused) so
     * callers can do `const result = await sender.send(...)` and only branch
     * on result.success — booking flows never raise on OAuth issues
     * (CONTEXT decision: booking succeeds, email skipped on revoked token).
     *
     * No caching — Vercel serverless functions don't share memory between
     * invocations and access tokens are short-lived (RESEARCH §Pattern 1
     * "Anti-pattern: Caching access tokens").
     */
    export async function getSenderForAccount(accountId: string): Promise<EmailClient> {
      const admin = createAdminClient();

      const { data: account, error: accountErr } = await admin
        .from("accounts")
        .select("owner_user_id, owner_email")
        .eq("id", accountId)
        .maybeSingle();

      if (accountErr) {
        console.error("[account-sender] account lookup failed", { accountId, accountErr });
        return refusedSender("account lookup failed");
      }
      if (!account?.owner_user_id) {
        console.error("[account-sender] no account row", { accountId });
        return refusedSender("no account row");
      }
      if (!account.owner_email) {
        console.error("[account-sender] account has no owner_email", { accountId });
        return refusedSender("missing owner_email");
      }

      const { data: cred, error: credErr } = await admin
        .from("account_oauth_credentials")
        .select("refresh_token_encrypted, status")
        .eq("user_id", account.owner_user_id)
        .eq("provider", "google")
        .maybeSingle();

      if (credErr) {
        console.error("[account-sender] credential lookup failed", { accountId, credErr });
        return refusedSender("credential lookup failed");
      }
      if (!cred?.refresh_token_encrypted) {
        console.error("[account-sender] no credential", { accountId });
        return refusedSender("no credential");
      }
      if (cred.status === "needs_reconnect") {
        console.error("[account-sender] credential needs_reconnect", { accountId });
        return refusedSender("needs_reconnect");
      }

      let refreshToken: string;
      try {
        refreshToken = decryptToken(cred.refresh_token_encrypted);
      } catch (err) {
        console.error("[account-sender] decrypt failed", { accountId, err });
        return refusedSender("decrypt failed");
      }

      const tokenResult = await fetchGoogleAccessToken(refreshToken);
      if (tokenResult.error === "invalid_grant") {
        // Authoritative revocation flag — set here once, surfaces in /app/settings/gmail
        // (gmail-status-panel.tsx renders the Reconnect button on this status).
        await admin
          .from("account_oauth_credentials")
          .update({ status: "needs_reconnect" })
          .eq("user_id", account.owner_user_id)
          .eq("provider", "google");
        console.error("[EMAIL_OAUTH_REVOKED]", { account_id: accountId });
        return refusedSender("invalid_grant — flagged needs_reconnect");
      }
      if (!tokenResult.accessToken) {
        console.error("[account-sender] token exchange failed", { accountId, error: tokenResult.error });
        return refusedSender(`token exchange failed: ${tokenResult.error}`);
      }

      return createGmailOAuthClient({
        user: account.owner_email,
        accessToken: tokenResult.accessToken,
      });
    }
    ```

    Notes:
    - Uses `account.owner_email` as the authenticated Gmail address (RESEARCH §Open Question 2 default — verified in preview).
    - Does NOT pass `fromName` — defaults to the email address itself; account-name display can be layered on later if needed.
    - Match-and-update on `(user_id, provider)` is safe: Phase 34's CHECK constraint prevents duplicate rows.
  </action>
  <verify>
    `npx tsc --noEmit lib/email-sender/account-sender.ts` clean.
    `grep -n "REFUSED_SEND_ERROR_PREFIX\|getSenderForAccount" lib/email-sender/account-sender.ts` shows both are exported.
  </verify>
  <done>
    File exists with `getSenderForAccount` and `REFUSED_SEND_ERROR_PREFIX` exports; type-checks clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Test factory branches with mocked Supabase + token exchange</name>
  <files>tests/account-sender.test.ts</files>
  <action>
    Create `tests/account-sender.test.ts` with vitest. Mock both `@/lib/supabase/admin` (createAdminClient) and `@/lib/oauth/google` (fetchGoogleAccessToken) and `@/lib/oauth/encrypt` (decryptToken). Use a chainable supabase mock factory like prior Phase 34 tests use (look at `tests/google-callback.test.ts` or similar for the pattern; if none exists, build a minimal `from().select().eq().eq().maybeSingle()` chain).

    Required test cases:
    1. **Happy path** — account + credential rows exist, decrypt succeeds, token exchange returns access_token. Assert: returns an EmailClient with `provider: "gmail"`. (Note: do not assert about createGmailOAuthClient internals here; that's tested in Plan 02.)
    2. **No account row** — `accounts` query returns `data: null`. Assert: `result.send({...})` resolves `{ success: false, error: matching /^oauth_send_refused: no account row/ }`.
    3. **Account missing owner_email** — Assert: refused with `missing owner_email`.
    4. **No credential row** — `account_oauth_credentials` query returns `data: null`. Assert: refused with `no credential`.
    5. **Credential status needs_reconnect** — query returns `{ refresh_token_encrypted: "x", status: "needs_reconnect" }`. Assert: refused with `needs_reconnect`. Importantly, assert `fetchGoogleAccessToken` was NOT called.
    6. **Decrypt throws** — mock `decryptToken` to throw. Assert: refused with `decrypt failed`. `fetchGoogleAccessToken` not called.
    7. **invalid_grant from Google** — `fetchGoogleAccessToken` returns `{ error: "invalid_grant" }`. Assert: refused with `invalid_grant — flagged needs_reconnect`. **AND** assert the supabase mock saw an `update({ status: "needs_reconnect" })` call against `account_oauth_credentials`.
    8. **Other token exchange failure** — `fetchGoogleAccessToken` returns `{ error: "network_error" }`. Assert: refused with `token exchange failed: network_error`. Importantly, no UPDATE to needs_reconnect (that's reserved for invalid_grant only).
    9. **REFUSED_SEND_ERROR_PREFIX exported** — import the constant and assert it equals `"oauth_send_refused"` so callers can rely on it.

    The test must call the returned sender's `.send({ to, subject, html })` to actually exercise the refused-path error string (don't just assert the factory return — the contract is that .send() resolves a refused result).
  </action>
  <verify>
    `npx vitest run tests/account-sender.test.ts` — all 9 tests pass. Confirm no real network calls, no real DB calls (only mocks).
  </verify>
  <done>
    9 tests green covering all branches; the invalid_grant test asserts the side-effect (DB update to needs_reconnect).
  </done>
</task>

</tasks>

<verification>
- `getSenderForAccount` exists and never throws on any input.
- All 9 branches tested: happy, missing account, missing email, missing cred, needs_reconnect cred, decrypt fail, invalid_grant (with side-effect), other token failure, exported constant.
- `REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused"` is the stable contract Plan 04 callers will use.
</verification>

<success_criteria>
- `lib/email-sender/account-sender.ts` exports `getSenderForAccount(accountId): Promise<EmailClient>` and `REFUSED_SEND_ERROR_PREFIX`.
- Factory composes Plan 02's two utilities + decrypt + DB lookup correctly.
- Invalid_grant branch flips the DB status to `needs_reconnect` (verified in test).
- All test cases pass.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-03-SUMMARY.md` recording: factory contract, branches covered, the exported error prefix, and a forward note that Plan 04 will replace `sendEmail()` calls in 7 senders with `await getSenderForAccount(accountId).then(s => s.send(...))`.
</output>
