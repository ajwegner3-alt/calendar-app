---
phase: 36-resend-backend-for-upgraded-accounts
plan: 02
type: execute
wave: 2
depends_on: ["36-01"]
files_modified:
  - lib/email-sender/providers/resend.ts
  - tests/resend-provider.test.ts
  - tests/__mocks__/account-sender.ts
  - vitest.config.ts
autonomous: true

must_haves:
  truths:
    - "createResendClient(config) returns an EmailClient with provider:'resend' that POSTs to https://api.resend.com/emails with Authorization: Bearer ${RESEND_API_KEY}"
    - "RESEND_API_KEY is read inside the send() function body (lazy read), not at module top level — required for Vitest test isolation"
    - "On any non-2xx Resend response, send() returns { success:false, error: starts-with 'resend_send_refused:' } — never throws"
    - "On fetch network error or thrown exception, send() returns { success:false, error: starts-with 'resend_send_refused:' } — never throws"
    - "options.replyTo maps to Resend body.reply_to (snake_case); attachments[].contentType maps to attachments[].content_type (snake_case)"
    - "RESEND_REFUSED_SEND_ERROR_PREFIX constant is exported with the literal value 'resend_send_refused'"
    - "tests/__mocks__/account-sender.ts exports RESEND_REFUSED_SEND_ERROR_PREFIX (matching the real constant) so tests that branch on it work in mocked environments"
  artifacts:
    - path: "lib/email-sender/providers/resend.ts"
      provides: "Resend HTTP provider — sibling of providers/gmail-oauth.ts"
      exports: ["createResendClient", "RESEND_REFUSED_SEND_ERROR_PREFIX"]
      min_lines: 60
    - path: "tests/resend-provider.test.ts"
      provides: "Unit tests with mocked globalThis.fetch covering all branches"
      min_lines: 120
    - path: "tests/__mocks__/account-sender.ts"
      provides: "Mock now also exports RESEND_REFUSED_SEND_ERROR_PREFIX"
      contains: "RESEND_REFUSED_SEND_ERROR_PREFIX"
  key_links:
    - from: "lib/email-sender/providers/resend.ts"
      to: "https://api.resend.com/emails"
      via: "fetch POST with Authorization: Bearer header"
      pattern: "api\\.resend\\.com/emails"
    - from: "lib/email-sender/providers/resend.ts"
      to: "process.env.RESEND_API_KEY"
      via: "lazy read inside send() function body"
      pattern: "process\\.env\\.RESEND_API_KEY"
    - from: "tests/resend-provider.test.ts"
      to: "createResendClient + RESEND_REFUSED_SEND_ERROR_PREFIX"
      via: "vi.stubGlobal('fetch', mockFetch); test all branches"
      pattern: "createResendClient"
---

<objective>
Build the Resend HTTP provider as a peer of `lib/email-sender/providers/gmail-oauth.ts`. Pure `fetch` to `https://api.resend.com/emails`, no `resend` npm package. Mirror the Gmail-OAuth file's shape exactly: `EmailClient` interface, lazy env-var read, never-throws contract, exported error-prefix constant.

Purpose: This is the leaf provider. Plan 03 will route `accounts.email_provider='resend'` through this factory. Phase ships framework-only — the provider is exercised by unit tests against a mocked `fetch`; no live Resend API call happens in this phase (PREREQ-03 deferred to FUTURE_DIRECTIONS.md). The mock-update tasks here keep the existing test suite green by shipping the new error-prefix constant through the alias mock.

Output: One new provider file, one new test file (9 cases), one updated mock with the new constant export, and a vitest.config.ts alias entry so the provider sub-path mock pattern matches Phase 35's account-sender alias precedent (RESEARCH §Section 6 / STATE.md LD-14 — exact-regex aliases prevent prefix-bleed).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-CONTEXT.md
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-RESEARCH.md
@lib/email-sender/providers/gmail-oauth.ts
@lib/email-sender/types.ts
@lib/email-sender/utils.ts
@tests/__mocks__/account-sender.ts
@tests/__mocks__/email-sender.ts
@vitest.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement createResendClient provider</name>
  <files>lib/email-sender/providers/resend.ts</files>
  <action>
    Create `lib/email-sender/providers/resend.ts`. Mirror the structure of `lib/email-sender/providers/gmail-oauth.ts` exactly — same `"server-only"` import, same `EmailClient` return shape, same never-throws contract.

    ```typescript
    import "server-only";
    import type { EmailClient, EmailOptions, EmailResult } from "../types";
    import { stripHtml } from "../utils";

    /** Stable prefix callers can match on to distinguish a Resend refusal from
     * other send errors (sibling of REFUSED_SEND_ERROR_PREFIX in account-sender.ts).
     * Used by send-booking-emails.ts dual-prefix check (Plan 03 OQ-2 fix). */
    export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";

    const RESEND_ENDPOINT = "https://api.resend.com/emails";

    export interface ResendConfig {
      /** Display name shown in From header — typically the account business name (accounts.name).
       *  Combined with `fromAddress` to produce e.g. "Acme Plumbing <bookings@nsintegrations.com>". */
      fromName: string;
      /** NSI verified-domain mailbox: "bookings@nsintegrations.com" (CONTEXT decision). */
      fromAddress: string;
      /** Reply-To address — the account owner's email, so customers reply to the
       *  business not NSI. Falls back to options.replyTo if the caller overrides. */
      replyToAddress: string;
    }

    /**
     * Create an EmailClient backed by Resend's HTTP API.
     *
     * Mirror of `createGmailOAuthClient` in providers/gmail-oauth.ts:
     *   - lazy env-var read (RESEND_API_KEY) inside send() body — required for Vitest isolation
     *   - never throws; every error path returns { success:false, error: prefix:reason }
     *   - factory owns From; callers can't override (parity with Gmail-OAuth contract)
     *
     * RESEND BODY FIELD NAMING (RESEARCH §Pitfall 1):
     *   - reply_to (snake_case), NOT replyTo
     *   - content_type (snake_case) on attachments, NOT contentType
     *   Resend silently ignores unknown fields, so a typo here means features
     *   silently disappear from the sent message.
     */
    export function createResendClient(config: ResendConfig): EmailClient {
      const from = `${config.fromName} <${config.fromAddress}>`;

      return {
        provider: "resend",
        async send(options: EmailOptions): Promise<EmailResult> {
          // LAZY env var read — see Phase 35 STATE.md "fetchGoogleAccessToken
          // lazy env-var read" pattern. Module-top-level read breaks Vitest
          // because process.env mutations between tests don't propagate.
          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey) {
            return {
              success: false,
              error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: missing RESEND_API_KEY`,
            };
          }

          const body: Record<string, unknown> = {
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text ?? stripHtml(options.html),
            // snake_case — Resend's wire format. options.replyTo wins when set.
            reply_to: options.replyTo ?? config.replyToAddress,
          };
          if (options.cc) body.cc = options.cc;
          if (options.bcc) body.bcc = options.bcc;

          if (options.attachments?.length) {
            body.attachments = options.attachments.map((att) => ({
              filename: att.filename,
              // Resend accepts base64 string for `content`. Buffer → base64.
              content: Buffer.isBuffer(att.content)
                ? att.content.toString("base64")
                : att.content,
              // snake_case content_type. For .ics inline RSVP rendering in Gmail,
              // the caller passes contentType: "text/calendar; method=REQUEST"
              // (RESEARCH §4 — confirmed via resend-node GitHub issue #198).
              // If a future caller fidelity test reveals Outlook or another
              // client mis-renders, downgrade by stripping the method param at
              // the caller; no provider change needed.
              content_type: att.contentType,
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
              const errBody = (await res.json().catch(() => ({}))) as {
                name?: string;
                message?: string;
                statusCode?: number;
              };
              const detail = errBody.message ?? errBody.name ?? "unknown";
              return {
                success: false,
                error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${res.status} ${detail}`,
              };
            }

            const json = (await res.json()) as { id?: string };
            return { success: true, messageId: json.id };
          } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown fetch error";
            return {
              success: false,
              error: `${RESEND_REFUSED_SEND_ERROR_PREFIX}: ${msg}`,
            };
          }
        },
      };
    }
    ```

    Notes:
    - Do NOT install the `resend` npm package (RESEARCH §"Don't Hand-Roll"). Raw `fetch` is the documented Phase 36 pattern.
    - The `provider: "resend"` literal requires the `EmailProvider` union extension landed in Plan 01; this file will not type-check until Plan 01's types.ts edit is in place.
    - From line uses `${fromName} <${fromAddress}>` — Resend's docs confirm this Display-Name format is supported.
  </action>
  <verify>
    - File exists at `lib/email-sender/providers/resend.ts`.
    - `npx tsc --noEmit` passes (proves the EmailProvider union extension from Plan 01 covers `provider: "resend"`).
    - `grep -n "RESEND_REFUSED_SEND_ERROR_PREFIX\|createResendClient" lib/email-sender/providers/resend.ts` shows both are exported.
    - `grep -c "process.env.RESEND_API_KEY" lib/email-sender/providers/resend.ts` returns `1` (lazy read inside send()).
  </verify>
  <done>
    File exists; type-checks clean; both exports present; lazy env-var read confirmed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Unit tests for createResendClient with mocked fetch</name>
  <files>tests/resend-provider.test.ts</files>
  <action>
    Create `tests/resend-provider.test.ts` with vitest. Mock `globalThis.fetch` via `vi.stubGlobal`. Set `process.env.RESEND_API_KEY` in `beforeEach` and delete in `afterEach` to exercise the lazy-read path.

    ```typescript
    // @vitest-environment node
    /**
     * Plan 36-02 — resend.ts unit tests.
     *
     * Tests createResendClient(config).send(opts) — the Resend HTTP provider.
     * Mocks: globalThis.fetch (no real Resend API calls).
     */
    import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    import {
      createResendClient,
      RESEND_REFUSED_SEND_ERROR_PREFIX,
    } from "../lib/email-sender/providers/resend";

    const CONFIG = {
      fromName: "Acme Plumbing",
      fromAddress: "bookings@nsintegrations.com",
      replyToAddress: "owner@acmeplumbing.com",
    };

    const SEND_OPTS = {
      to: "booker@example.com",
      subject: "Your booking is confirmed",
      html: "<p>See you Tuesday at 10am.</p>",
    };

    const PREFIX_REGEX = new RegExp(`^${RESEND_REFUSED_SEND_ERROR_PREFIX}:`);

    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test_key_abc";
      mockFetch.mockReset();
    });

    afterEach(() => {
      delete process.env.RESEND_API_KEY;
    });

    describe("createResendClient", () => {
      it("[#1] happy path — returns success with messageId from Resend response", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }),
        });

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe("49a3999c-0ce1-4ea6-ab68-afcd6dc2e794");
        expect(sender.provider).toBe("resend");

        // Verify endpoint + headers
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe("https://api.resend.com/emails");
        expect((init as RequestInit).method).toBe("POST");
        expect((init as RequestInit).headers).toMatchObject({
          Authorization: "Bearer re_test_key_abc",
          "Content-Type": "application/json",
        });

        // Verify body shape (snake_case mapping — RESEARCH §Pitfall 1)
        const body = JSON.parse((init as RequestInit).body as string);
        expect(body.from).toBe("Acme Plumbing <bookings@nsintegrations.com>");
        expect(body.to).toBe("booker@example.com");
        expect(body.subject).toBe("Your booking is confirmed");
        expect(body.html).toBe("<p>See you Tuesday at 10am.</p>");
        // text auto-derived from html via stripHtml
        expect(typeof body.text).toBe("string");
        // reply_to falls back to config.replyToAddress when options.replyTo absent
        expect(body.reply_to).toBe("owner@acmeplumbing.com");
      });

      it("[#2] missing RESEND_API_KEY — refused with prefix", async () => {
        delete process.env.RESEND_API_KEY;

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(PREFIX_REGEX);
        expect(result.error).toContain("missing RESEND_API_KEY");
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("[#3] HTTP 422 validation_error — refused with prefix and Resend message", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: async () => ({
            name: "validation_error",
            statusCode: 422,
            message: "Invalid `to` field.",
          }),
        });

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(PREFIX_REGEX);
        expect(result.error).toContain("422");
        expect(result.error).toContain("Invalid `to` field.");
      });

      it("[#4] HTTP 429 rate_limit_exceeded — refused with prefix", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            name: "rate_limit_exceeded",
            statusCode: 429,
            message: "Too many requests.",
          }),
        });

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(PREFIX_REGEX);
        expect(result.error).toContain("429");
      });

      it("[#5] HTTP 500 server error — refused with prefix", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({
            name: "internal_server_error",
            statusCode: 500,
            message: "Resend infra issue.",
          }),
        });

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(PREFIX_REGEX);
        expect(result.error).toContain("500");
      });

      it("[#6] fetch throws (network error) — refused with prefix, never throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

        const sender = createResendClient(CONFIG);
        const result = await sender.send(SEND_OPTS);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(PREFIX_REGEX);
        expect(result.error).toContain("ECONNREFUSED");
      });

      it("[#7] options.replyTo overrides config.replyToAddress", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "msg-7" }),
        });

        const sender = createResendClient(CONFIG);
        await sender.send({ ...SEND_OPTS, replyTo: "custom-reply@example.com" });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
        expect(body.reply_to).toBe("custom-reply@example.com");
      });

      it("[#8] attachment contentType maps to snake_case content_type with base64 buffer", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "msg-8" }),
        });

        const icsBuffer = Buffer.from("BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nEND:VCALENDAR", "utf8");
        const sender = createResendClient(CONFIG);
        await sender.send({
          ...SEND_OPTS,
          attachments: [
            {
              filename: "invite.ics",
              content: icsBuffer,
              contentType: "text/calendar; method=REQUEST",
            },
          ],
        });

        const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
        expect(body.attachments).toHaveLength(1);
        expect(body.attachments[0].filename).toBe("invite.ics");
        expect(body.attachments[0].content_type).toBe("text/calendar; method=REQUEST");
        // Buffer → base64 string
        expect(body.attachments[0].content).toBe(icsBuffer.toString("base64"));
        // No camelCase contentType field leaked
        expect(body.attachments[0].contentType).toBeUndefined();
      });

      it("[#9] RESEND_REFUSED_SEND_ERROR_PREFIX exported equals 'resend_send_refused'", () => {
        expect(RESEND_REFUSED_SEND_ERROR_PREFIX).toBe("resend_send_refused");
      });
    });
    ```

    Notes:
    - Do NOT add a vitest.config.ts alias for `lib/email-sender/providers/resend` — these tests import the real module and only mock the global `fetch`. The alias system is only needed when integration tests (the leaf senders) want to bypass the real provider via `getSenderForAccount` — that already-existing alias for `account-sender` covers them.
  </action>
  <verify>
    - `npx vitest run tests/resend-provider.test.ts` — all 9 tests pass.
    - No real network calls made (verify mockFetch.mock.calls captures every fetch invocation).
  </verify>
  <done>
    9 tests green covering happy path, env-var miss, 422/429/500 HTTP errors, network-throw, replyTo override, attachment snake_case mapping, and exported constant value.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update account-sender mock to export RESEND_REFUSED_SEND_ERROR_PREFIX</name>
  <files>tests/__mocks__/account-sender.ts</files>
  <action>
    Open `tests/__mocks__/account-sender.ts`. Below the existing line:

    ```typescript
    export const REFUSED_SEND_ERROR_PREFIX = "oauth_send_refused";
    ```

    Add:

    ```typescript
    /** Phase 36: mirror the real constant exported from providers/resend.ts.
     *  Tests that branch on the prefix (e.g. send-booking-emails.test.ts) need
     *  this exported here too, since the alias mock replaces the real module. */
    export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";
    ```

    Also (keep the export ordering tidy), if a future test wants to assert the dual-prefix helper from Plan 03's `isRefusedSend`, add a stub helper here that mirrors the real semantics:

    ```typescript
    /** Phase 36: mirrors lib/email-sender/account-sender.ts isRefusedSend.
     *  Returns true if the error string matches either the OAuth or Resend prefix. */
    export function isRefusedSend(error?: string): boolean {
      if (!error) return false;
      return (
        error.startsWith(REFUSED_SEND_ERROR_PREFIX + ":") ||
        error.startsWith(RESEND_REFUSED_SEND_ERROR_PREFIX + ":")
      );
    }
    ```

    Why both exports: the orchestrator `lib/email/send-booking-emails.ts` will be updated in Plan 03 to use `isRefusedSend`. The integration tests for the orchestrator (`tests/send-booking-emails.test.ts` if it exists, or `tests/bookings-api.test.ts`) need either the constant OR the helper from the aliased module — exporting both costs nothing and unblocks any branching path.
  </action>
  <verify>
    - `grep -n "RESEND_REFUSED_SEND_ERROR_PREFIX\|isRefusedSend" tests/__mocks__/account-sender.ts` shows both new exports.
    - `npx vitest run` — full suite still passes (no behavior regression from the new exports being stub-mirrors of real behavior).
  </verify>
  <done>
    Mock exports `RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused"` and a matching `isRefusedSend` helper; existing test suite remains green.
  </done>
</task>

<task type="auto">
  <name>Task 4: Add Vitest alias entry for the new resend provider sub-path (LD-14 prefix-bleed prevention)</name>
  <files>vitest.config.ts</files>
  <action>
    Per STATE.md "Vitest `resolve.alias` array/regex exact-match" lock (LD-14): each `lib/email-sender/*` sub-path that needs a mock must get its own EXACT-REGEX alias entry, not a string-prefix alias (string prefixes caused real bugs where `@/lib/email-sender/quota-guard` was rewritten to `tests/__mocks__/email-sender.ts/quota-guard`).

    Open `vitest.config.ts`. Currently the relevant aliases are:
    1. `find: /^@\/lib\/email-sender$/` → `tests/__mocks__/email-sender.ts`
    2. `find: /^@\/lib\/email-sender\/account-sender$/` → `tests/__mocks__/account-sender.ts`

    For Phase 36, the Resend provider unit tests (Task 2 above) import the real module directly — no alias needed. However, the `lib/email-sender/providers/resend` sub-path COULD be aliased in a future phase if integration tests want to bypass it. To pre-empt prefix-bleed risk and document the boundary, add an EXACT-REGEX comment block (no replacement target needed today) OR a real alias entry pointed at a no-op stub.

    Decision: add the alias entry now, pointed at the SAME stub pattern as `account-sender.ts`, because Plan 03's `getSenderForAccount` factory will internally call `createResendClient` for `email_provider='resend'` accounts — integration tests that want to assert "Resend account routes through Resend" need a stub that won't actually hit the (mocked) `fetch`.

    Create `tests/__mocks__/resend-provider.ts` with the following stub:

    ```typescript
    /**
     * Vitest mock for @/lib/email-sender/providers/resend.
     *
     * Used by integration tests that exercise the Resend routing path through
     * getSenderForAccount without going through the real Resend HTTP provider
     * (which is exhaustively unit-tested in tests/resend-provider.test.ts).
     *
     * Stub returns an EmailClient that pushes sends to the shared __mockSendCalls
     * array, matching the pattern of tests/__mocks__/account-sender.ts.
     */
    import type { EmailOptions, EmailResult, EmailClient } from "@/lib/email-sender/types";
    import { __mockSendCalls } from "@/lib/email-sender";

    export const RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused";

    export interface ResendConfig {
      fromName: string;
      fromAddress: string;
      replyToAddress: string;
    }

    export function createResendClient(_config: ResendConfig): EmailClient {
      return {
        provider: "resend",
        async send(opts: EmailOptions): Promise<EmailResult> {
          __mockSendCalls.push(opts);
          return {
            success: true,
            messageId: "mock-resend-" + Math.random().toString(36).slice(2),
          };
        },
      };
    }
    ```

    Then add the alias to `vitest.config.ts` immediately after the existing `account-sender` alias entry:

    ```typescript
    // Resend provider mock — intercepts createResendClient() called by
    // getSenderForAccount when accounts.email_provider='resend'. Mirrors the
    // account-sender alias pattern; pinned to EXACT regex (not prefix) per
    // STATE.md LD-14. Pushes to the shared __mockSendCalls array so
    // integration tests can assert against sent options regardless of provider.
    {
      find: /^@\/lib\/email-sender\/providers\/resend$/,
      replacement: path.resolve(__dirname, "tests/__mocks__/resend-provider.ts"),
    },
    ```

    Note: this alias does NOT affect the unit tests in Task 2 — those import via the relative path `../lib/email-sender/providers/resend`, which Vite/Vitest resolve through the tsconfig path resolver, not the alias array. The alias only catches the `@/lib/email-sender/providers/resend` bare specifier used by the real `getSenderForAccount` (after Plan 03).
  </action>
  <verify>
    - `tests/__mocks__/resend-provider.ts` exists and imports `__mockSendCalls` from `@/lib/email-sender`.
    - `grep -A 3 "providers/resend" vitest.config.ts` shows the new alias entry.
    - `npx vitest run` — full suite still passes (the alias is dormant until Plan 03 wires `getSenderForAccount` to import `createResendClient`).
    - `npx vitest run tests/resend-provider.test.ts` — Task 2's unit tests still pass (they import via relative path, bypassing the alias).
  </verify>
  <done>
    New stub file + new alias entry land; vitest config still parses; existing + new tests all green.
  </done>
</task>

</tasks>

<verification>
- `lib/email-sender/providers/resend.ts` exists with `createResendClient` and `RESEND_REFUSED_SEND_ERROR_PREFIX` exports.
- 9 unit tests for the provider all green (no real network calls).
- `tests/__mocks__/account-sender.ts` exports `RESEND_REFUSED_SEND_ERROR_PREFIX` and `isRefusedSend` so Plan 03's orchestrator dual-prefix fix is testable through the alias.
- `tests/__mocks__/resend-provider.ts` + matching `vitest.config.ts` alias entry land for future integration-test use.
- `npx tsc --noEmit` clean across the project.
- `npx vitest run` — full suite green.
</verification>

<success_criteria>
- Resend HTTP provider implemented as a peer of `gmail-oauth.ts`, never throws, lazy env-var read.
- `provider: "resend"` literal compiles (depends on Plan 01 EmailProvider union extension).
- Snake-case body fields (`reply_to`, `content_type`) verified by tests.
- Exported `RESEND_REFUSED_SEND_ERROR_PREFIX = "resend_send_refused"`.
- Mock and alias updates in place for Plan 03's factory routing.
</success_criteria>

<output>
After completion, create `.planning/phases/36-resend-backend-for-upgraded-accounts/36-02-SUMMARY.md` recording: provider file location, the 9 test cases covered, the snake-case mapping decisions (`reply_to`, `content_type`), the .ics inline-RSVP attempt (`text/calendar; method=REQUEST`), the new mock + alias entries, and a forward note that Plan 03 will branch on `accounts.email_provider` to call `createResendClient` instead of `createGmailOAuthClient`.
</output>
</content>
</invoke>