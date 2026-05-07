---
phase: 35-per-account-gmail-oauth-send
plan: 02
type: execute
wave: 2
depends_on: ["35-00"]
files_modified:
  - lib/oauth/google.ts
  - lib/email-sender/providers/gmail-oauth.ts
  - tests/oauth-google-access-token.test.ts
  - tests/email-sender-gmail-oauth.test.ts
autonomous: true

must_haves:
  truths:
    - "fetchGoogleAccessToken(refreshToken) returns { accessToken } on success"
    - "fetchGoogleAccessToken returns { error: 'invalid_grant' } when Google rejects the refresh token"
    - "fetchGoogleAccessToken returns { error: '...' } on missing env vars or network failure (never throws)"
    - "createGmailOAuthClient(user, accessToken) returns an EmailClient whose .send() composes a Gmail OAuth2 SMTP message"
    - "createGmailOAuthClient enforces from = user (cannot send as a different address)"
  artifacts:
    - path: "lib/oauth/google.ts"
      provides: "fetchGoogleAccessToken added to existing helpers (fetchGoogleGrantedScopes, revokeGoogleRefreshToken stay)"
      exports: ["fetchGoogleAccessToken", "TokenResult"]
    - path: "lib/email-sender/providers/gmail-oauth.ts"
      provides: "createGmailOAuthClient nodemailer factory"
      exports: ["createGmailOAuthClient"]
      min_lines: 35
  key_links:
    - from: "lib/oauth/google.ts:fetchGoogleAccessToken"
      to: "https://oauth2.googleapis.com/token"
      via: "fetch POST with refresh_token + client_id + client_secret"
      pattern: "oauth2\\.googleapis\\.com/token"
    - from: "lib/email-sender/providers/gmail-oauth.ts"
      to: "nodemailer.createTransport with type: 'OAuth2'"
      via: "auth.user + auth.accessToken (no clientId/clientSecret in transport — token already fetched)"
      pattern: "type:\\s*\"OAuth2\""
---

<objective>
Build the two foundational pieces the sender factory needs: a Google token exchange helper and a Gmail OAuth nodemailer client. Neither one knows about accounts — they're pure utilities consumed by Plan 03's factory.

Purpose: Per RESEARCH §Pattern 2 + §Pattern 3, a clean factory needs (a) a function that turns a stored refresh token into a fresh 1-hour access token and (b) a function that turns an access token into a working `EmailClient`. Splitting them keeps each unit testable without DB or network coupling at the factory level.

Output: `lib/oauth/google.ts` extended with `fetchGoogleAccessToken`. New `lib/email-sender/providers/gmail-oauth.ts` exporting `createGmailOAuthClient`. Both with focused unit tests.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@lib/oauth/google.ts
@lib/email-sender/providers/gmail.ts
@lib/email-sender/types.ts
@lib/email-sender/utils.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fetchGoogleAccessToken to lib/oauth/google.ts</name>
  <files>lib/oauth/google.ts, tests/oauth-google-access-token.test.ts</files>
  <action>
    Append to `lib/oauth/google.ts` (do not modify existing exports `fetchGoogleGrantedScopes`, `revokeGoogleRefreshToken`, `hasGmailSendScope`):

    ```typescript
    export interface TokenResult {
      accessToken?: string;
      /** "invalid_grant" indicates the refresh token is revoked. Other strings are network/config failures. */
      error?: string;
    }

    /**
     * Exchange a Google refresh token for a short-lived (1h) access token.
     * Never throws — returns { error } on any failure path so callers can branch
     * cleanly (the sender factory uses "invalid_grant" to flag needs_reconnect).
     *
     * Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Phase 35 PREREQ).
     * Read lazily inside the function so test setup can mutate process.env
     * (matches lib/oauth/encrypt.ts pattern from Phase 34, Plan 02).
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
        const data = (await res.json()) as { access_token?: string; error?: string };
        if (data.access_token) return { accessToken: data.access_token };
        return { error: data.error ?? "token_exchange_failed" };
      } catch (err) {
        console.error("[google] fetchGoogleAccessToken network error:", err);
        return { error: "network_error" };
      }
    }
    ```

    Then create `tests/oauth-google-access-token.test.ts` with vitest mocking `global.fetch`:
    - Test 1: Missing GOOGLE_CLIENT_ID returns `{ error: "GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set" }` (don't set env, call function).
    - Test 2: Successful exchange returns `{ accessToken: "ya29.test" }` (mock fetch to resolve to `{ access_token: "ya29.test" }` JSON).
    - Test 3: `invalid_grant` from Google returns `{ error: "invalid_grant" }` (mock fetch to resolve to `{ error: "invalid_grant" }`).
    - Test 4: Network error returns `{ error: "network_error" }` (mock fetch to reject).

    Use `beforeEach` to set/unset `process.env.GOOGLE_CLIENT_ID` and `process.env.GOOGLE_CLIENT_SECRET`. Do NOT hit the real Google endpoint.
  </action>
  <verify>
    `npx vitest run tests/oauth-google-access-token.test.ts` — all 4 tests pass. `npx tsc --noEmit lib/oauth/google.ts` — no type errors in the file itself (existing callers of older exports unchanged).
  </verify>
  <done>
    `fetchGoogleAccessToken` and `TokenResult` exported from `lib/oauth/google.ts`; 4 tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create gmail-oauth nodemailer provider + tests</name>
  <files>lib/email-sender/providers/gmail-oauth.ts, tests/email-sender-gmail-oauth.test.ts</files>
  <action>
    Create `lib/email-sender/providers/gmail-oauth.ts` with the structure from RESEARCH §Pattern 3, but use the explicit-host form per RESEARCH §Pitfall 5:

    ```typescript
    import "server-only";
    import nodemailer from "nodemailer";
    import type { EmailClient, EmailOptions, EmailResult } from "../types";
    import { stripHtml } from "../utils";

    export interface GmailOAuthConfig {
      /** Authenticated Gmail address (account.owner_email). MUST equal the From header. */
      user: string;
      /** Fresh 1h access token from fetchGoogleAccessToken. */
      accessToken: string;
      /** Display name shown in From header. Defaults to user. */
      fromName?: string;
    }

    /**
     * Create an EmailClient backed by Gmail OAuth2 SMTP.
     *
     * Per RESEARCH §Pattern 3 + §Pitfall 5: explicit host/port/secure form
     * is required for some nodemailer versions when type: "OAuth2" is used.
     *
     * Per RESEARCH §Pitfall 6: From MUST equal the authenticated Gmail address.
     * The factory owns From — callers cannot override (any options.from is ignored).
     */
    export function createGmailOAuthClient(config: GmailOAuthConfig): EmailClient {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          user: config.user,
          accessToken: config.accessToken,
        },
      });
      const fromName = config.fromName ?? config.user;
      const enforcedFrom = `${fromName} <${config.user}>`;

      return {
        provider: "gmail",
        async send(options: EmailOptions): Promise<EmailResult> {
          try {
            const info = await transporter.sendMail({
              from: enforcedFrom, // Always the authenticated address; ignore options.from
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

    Create `tests/email-sender-gmail-oauth.test.ts` with vitest. Mock `nodemailer.createTransport` to return an object whose `.sendMail` is a vi.fn:
    - Test 1: `createGmailOAuthClient` returns an object with `provider: "gmail"` and a `send` function.
    - Test 2: `client.send({ to, subject, html })` calls `transporter.sendMail` with `from = "user@example.com <user@example.com>"` even when no fromName is provided.
    - Test 3: `client.send({ to, subject, html })` with `fromName: "NSI"` config produces `from = "NSI <user@example.com>"`.
    - Test 4: `client.send({ to, subject, html, from: "spoof@evil.com" })` is IGNORED — `transporter.sendMail` still receives the enforced from. (Verifies §Pitfall 6.)
    - Test 5: When `transporter.sendMail` rejects, `send` returns `{ success: false, error: "<message>" }` — does not throw.
    - Test 6: Array `to` is joined with `", "`.

    Add a vitest `resolve.alias` entry if the existing `vitest.config.ts` uses an exact-match regex pattern for `@/lib/email-sender` (LD-14: prefix-bleed guard). Inspect `vitest.config.ts` first; if it has `find: /^@\/lib\/email-sender$/`, add a parallel `find: /^@\/lib\/email-sender\/providers\/gmail-oauth$/` alias if needed for the test to import. If the existing alias is broader, no change needed.
  </action>
  <verify>
    `npx vitest run tests/email-sender-gmail-oauth.test.ts` — all 6 tests pass. Inspect output of one test to confirm the mocked `sendMail` was called with the enforced `from` value.

    `npx tsc --noEmit lib/email-sender/providers/gmail-oauth.ts` — clean.
  </verify>
  <done>
    `lib/email-sender/providers/gmail-oauth.ts` exports `createGmailOAuthClient` and `GmailOAuthConfig`; 6 tests green; vitest alias updated if required.
  </done>
</task>

</tasks>

<verification>
- `lib/oauth/google.ts` exports `fetchGoogleAccessToken` (in addition to existing helpers).
- `lib/email-sender/providers/gmail-oauth.ts` exists and exports `createGmailOAuthClient`.
- 4 + 6 = 10 new test cases all green.
- No regressions: `npx vitest run tests/oauth-google.test.ts` (existing Phase 34 tests) still green.
</verification>

<success_criteria>
- `fetchGoogleAccessToken` handles success, invalid_grant, missing env, and network error paths.
- `createGmailOAuthClient` returns an `EmailClient` whose From header cannot be spoofed by callers.
- Both files type-check standalone; their tests pass.
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-02-SUMMARY.md` recording: file paths, exported symbols, test counts, any vitest config edit, and a forward note that Plan 03 will compose these two into `getSenderForAccount`.
</output>
