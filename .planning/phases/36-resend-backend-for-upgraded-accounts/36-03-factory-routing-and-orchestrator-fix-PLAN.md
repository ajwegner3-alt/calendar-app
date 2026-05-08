---
phase: 36-resend-backend-for-upgraded-accounts
plan: 03
type: execute
wave: 3
depends_on: ["36-01", "36-02"]
files_modified:
  - lib/email-sender/account-sender.ts
  - lib/email-sender/quota-guard.ts
  - lib/email/send-booking-emails.ts
  - tests/account-sender.test.ts
  - FUTURE_DIRECTIONS.md
autonomous: true

must_haves:
  truths:
    - "getSenderForAccount(accountId) reads accounts.email_provider; when 'resend' it returns a Resend-backed EmailClient (provider:'resend'), otherwise it returns the existing Gmail-OAuth EmailClient (provider:'gmail')"
    - "When accounts.email_provider='resend' AND accounts.resend_status='suspended', getSenderForAccount returns a refused sender with error 'resend_send_refused: account_suspended' WITHOUT consulting account_oauth_credentials"
    - "Resend wins over a present account_oauth_credentials row — flipping email_provider to 'resend' immediately routes through Resend even if the account has Gmail OAuth connected (CONTEXT decision)"
    - "checkAndConsumeQuota skips the 200/day cap check for accounts with email_provider='resend' but still inserts an email_send_log row with provider='resend'"
    - "checkAndConsumeQuota for Gmail accounts continues to insert with provider='gmail' (or relies on the column DEFAULT)"
    - "lib/email/send-booking-emails.ts dual-prefix check fires confirmation_email_sent=false for BOTH oauth_send_refused AND resend_send_refused error returns"
    - "Soft 5000/day Resend abuse threshold emits a console.warn when crossed but never blocks a send"
    - "FUTURE_DIRECTIONS.md captures PREREQ-03 (Resend account + NSI domain DNS), Vercel RESEND_API_KEY env var, and live integration test as deferred items with clear activation steps"
  artifacts:
    - path: "lib/email-sender/account-sender.ts"
      provides: "Provider-routing factory + isRefusedSend helper + Resend abuse-threshold warning"
      exports: ["getSenderForAccount", "REFUSED_SEND_ERROR_PREFIX", "RESEND_REFUSED_SEND_ERROR_PREFIX", "isRefusedSend"]
    - path: "lib/email-sender/quota-guard.ts"
      provides: "checkAndConsumeQuota now skips the cap for Resend accounts but still logs with the correct provider tag"
      contains: "email_provider"
    - path: "lib/email/send-booking-emails.ts"
      provides: "Dual-prefix refusal check via isRefusedSend (OQ-2 fix)"
      contains: "isRefusedSend"
    - path: "FUTURE_DIRECTIONS.md"
      provides: "PREREQ-03 deferred-activation checklist for Andrew"
      contains: "PREREQ-03"
  key_links:
    - from: "lib/email-sender/account-sender.ts"
      to: "accounts.email_provider, accounts.resend_status, accounts.name"
      via: "supabase admin select extended to include the three new columns"
      pattern: "email_provider, resend_status, name"
    - from: "lib/email-sender/account-sender.ts"
      to: "lib/email-sender/providers/resend.ts:createResendClient"
      via: "branch on email_provider==='resend'"
      pattern: "createResendClient"
    - from: "lib/email-sender/quota-guard.ts"
      to: "accounts.email_provider"
      via: "internal SELECT inside checkAndConsumeQuota — bypass cap when 'resend'"
      pattern: "email_provider"
    - from: "lib/email/send-booking-emails.ts"
      to: "isRefusedSend helper"
      via: "replace startsWith(REFUSED_SEND_ERROR_PREFIX) with isRefusedSend(...)"
      pattern: "isRefusedSend"
---

<objective>
Wire it all together. This plan is the framework's load-bearing wave: the factory branches on `accounts.email_provider`, the quota guard recognizes Resend accounts and bypasses the 200/day cap, the booking orchestrator fires `confirmation_email_sent=false` on either provider's refusal, and FUTURE_DIRECTIONS.md captures the remaining manual steps Andrew will perform when the first customer needs Resend.

Purpose: After this plan ships, Phase 36 is complete and ready for activation by `UPDATE accounts SET email_provider = 'resend' WHERE id = ...`. Resolves CONTEXT decisions on coexistence (Resend wins), suspension semantics, quota bypass, abuse warning, and OQ-2 dual-prefix orchestrator fix. Resolves OQ-1 by centralizing the bypass inside `checkAndConsumeQuota` so none of the 7 leaf callers need touching.

Output: Modified factory, modified quota guard, modified booking orchestrator, expanded factory tests covering Resend branches, FUTURE_DIRECTIONS.md update.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-CONTEXT.md
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-RESEARCH.md
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-01-SUMMARY.md
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-02-SUMMARY.md
@lib/email-sender/account-sender.ts
@lib/email-sender/quota-guard.ts
@lib/email-sender/providers/resend.ts
@lib/email-sender/providers/gmail-oauth.ts
@lib/email/send-booking-emails.ts
@tests/account-sender.test.ts
@FUTURE_DIRECTIONS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update getSenderForAccount to route on email_provider + isRefusedSend helper + abuse-threshold warning</name>
  <files>lib/email-sender/account-sender.ts</files>
  <action>
    Modify `lib/email-sender/account-sender.ts`. Three changes in this file:

    **Change A — re-export `RESEND_REFUSED_SEND_ERROR_PREFIX` and add `isRefusedSend` helper.**

    At the top of the file, add the import and re-export:

    ```typescript
    import {
      createResendClient,
      RESEND_REFUSED_SEND_ERROR_PREFIX,
    } from "./providers/resend";

    // Re-export so callers can `import { RESEND_REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender"`
    // — single import location for both refusal prefixes.
    export { RESEND_REFUSED_SEND_ERROR_PREFIX };

    /**
     * Phase 36 OQ-2 fix: shared helper for callers that need to detect a refused
     * send regardless of which provider produced it. Returns true if the error
     * string starts with either the OAuth or Resend refusal prefix.
     *
     * Used by lib/email/send-booking-emails.ts to set confirmation_email_sent=false
     * on either provider's refusal (was previously OAuth-prefix-only — Resend
     * refusals slipped through and the booking row stayed flagged "sent").
     */
    export function isRefusedSend(error?: string): boolean {
      if (!error) return false;
      return (
        error.startsWith(REFUSED_SEND_ERROR_PREFIX + ":") ||
        error.startsWith(RESEND_REFUSED_SEND_ERROR_PREFIX + ":")
      );
    }
    ```

    **Change B — extend `refusedSender` to accept an optional provider parameter.**

    Update the helper so refused senders for Resend accounts report `provider: "resend"` (RESEARCH §Pitfall 6 — keeps `.provider` honest for callers reading it after a refusal):

    ```typescript
    function refusedSender(reason: string, opts?: { provider?: "gmail" | "resend"; prefix?: string }): EmailClient {
      const provider = opts?.provider ?? "gmail";
      const prefix = opts?.prefix ?? REFUSED_SEND_ERROR_PREFIX;
      return {
        provider,
        async send(_: EmailOptions): Promise<EmailResult> {
          return { success: false, error: `${prefix}: ${reason}` };
        },
      };
    }
    ```

    All existing call sites passing only `(reason)` continue to work (default `provider: "gmail"`, default prefix is OAuth).

    **Change C — add Resend routing branch + abuse-threshold warning.**

    Extend the accounts SELECT to include `email_provider, resend_status, name`:

    ```typescript
    const { data: account, error: accountErr } = await admin
      .from("accounts")
      .select("owner_user_id, owner_email, email_provider, resend_status, name")
      .eq("id", accountId)
      .maybeSingle();
    ```

    After the existing `if (!account.owner_email) { ... return refusedSender("missing owner_email"); }` block (around line 60), insert the Resend branch BEFORE the existing `account_oauth_credentials` lookup:

    ```typescript
    // ----- Phase 36: Resend routing -----
    // CONTEXT decision: Resend wins. If email_provider='resend', we use Resend
    // even when an account_oauth_credentials row exists (so Andrew can flip
    // back to 'gmail' later without forcing a re-OAuth — Gmail credential is
    // left untouched on flip).
    if (account.email_provider === "resend") {
      // Suspension takes precedence over RESEND_API_KEY checks etc — once Andrew
      // marks an account suspended we want a clear, fast refusal log entry.
      if (account.resend_status === "suspended") {
        console.error("[account-sender] resend account suspended", { accountId });
        return refusedSender("account_suspended", {
          provider: "resend",
          prefix: RESEND_REFUSED_SEND_ERROR_PREFIX,
        });
      }

      // Soft abuse threshold (CONTEXT decision: warn-log only, no block).
      // Fire-and-forget so the send path is not blocked by an advisory check.
      void warnIfResendAbuseThresholdCrossed(accountId);

      const fromName = account.name ?? "Bookings";
      return createResendClient({
        fromName,
        fromAddress: "bookings@nsintegrations.com",
        replyToAddress: account.owner_email,
      });
    }
    // ----- end Resend routing -----
    ```

    Then add the abuse-threshold helper function in the same file (above `getSenderForAccount`):

    ```typescript
    /**
     * Phase 36 soft abuse ceiling — 5000 sends/day per Resend account.
     * Emits console.warn with structured fields when crossed; does NOT block
     * the send (CONTEXT decision: warn-log only, hard cap deferred until abuse
     * is observed). Counts ALL email_send_log rows for the account, not just
     * Resend rows — the threshold is total per-account-day volume.
     */
    const RESEND_ABUSE_WARN_THRESHOLD = 5000;
    async function warnIfResendAbuseThresholdCrossed(accountId: string): Promise<void> {
      try {
        const { getDailySendCount } = await import("./quota-guard");
        const count = await getDailySendCount(accountId);
        if (count >= RESEND_ABUSE_WARN_THRESHOLD) {
          console.warn("[RESEND_ABUSE_THRESHOLD_CROSSED]", {
            account_id: accountId,
            count,
            threshold: RESEND_ABUSE_WARN_THRESHOLD,
          });
        }
      } catch (err) {
        // Advisory only — never let this break a send.
        console.error("[account-sender] abuse-threshold check failed (non-fatal)", err);
      }
    }
    ```

    The existing Gmail OAuth branch (account_oauth_credentials lookup → decrypt → fetchGoogleAccessToken → createGmailOAuthClient) is reached only when `account.email_provider !== "resend"` — which includes the literal `"gmail"` value and any future-proof unknown values defaulting to Gmail behavior.

    Do NOT remove or alter any existing Gmail OAuth code paths — they must continue to work exactly as today.
  </action>
  <verify>
    - `grep -n "createResendClient" lib/email-sender/account-sender.ts` shows the import and the branch.
    - `grep -n "isRefusedSend\|RESEND_REFUSED_SEND_ERROR_PREFIX" lib/email-sender/account-sender.ts` shows both new exports.
    - `grep -n "warnIfResendAbuseThresholdCrossed" lib/email-sender/account-sender.ts` shows the helper is defined and called in the Resend branch.
    - `npx tsc --noEmit` clean.
  </verify>
  <done>
    Factory routes on `email_provider`; suspension produces a Resend-prefixed refusal; abuse warning is fire-and-forget; helper + re-export in place; no behavior change for Gmail accounts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Quota guard — bypass cap for Resend accounts; tag log row with provider</name>
  <files>lib/email-sender/quota-guard.ts</files>
  <action>
    Modify `lib/email-sender/quota-guard.ts`. The CONTEXT decision (and OQ-1 chosen approach): keep the centralization in `checkAndConsumeQuota` so none of the 7 leaf callers need to change.

    **Change A — internal lookup of `accounts.email_provider`:**

    Inside `checkAndConsumeQuota(category, accountId)`, before the existing `getDailySendCount` call, fetch the account's email_provider so we can decide whether to enforce the 200/day cap and which provider tag to log:

    ```typescript
    export async function checkAndConsumeQuota(
      category: EmailCategory,
      accountId: string,
    ): Promise<void> {
      const admin = createAdminClient();

      // Phase 36: read email_provider so we know whether to enforce the
      // 200/day Gmail cap. Resend accounts bypass the cap entirely (CONTEXT
      // decision — they have NSI's verified domain and a separate volume model).
      // The signup-side nil-UUID sentinel ('00000000-...') won't match any row
      // here; the maybeSingle() returns null and we fall through to the Gmail
      // path (cap enforced) — which is exactly what we want for system-level
      // sends like welcome and signup-verify.
      const { data: acct } = await admin
        .from("accounts")
        .select("email_provider")
        .eq("id", accountId)
        .maybeSingle();

      const provider: "gmail" | "resend" = acct?.email_provider === "resend" ? "resend" : "gmail";

      if (provider === "gmail") {
        const count = await getDailySendCount(accountId);
        if (count >= SIGNUP_DAILY_EMAIL_CAP) {
          throw new QuotaExceededError(count, SIGNUP_DAILY_EMAIL_CAP);
        }
        if (count >= SIGNUP_DAILY_EMAIL_CAP * WARN_THRESHOLD_PCT) {
          const today = new Date().toISOString().slice(0, 10);
          const warnKey = `${today}:${accountId}`;
          if (!warnedDays.has(warnKey)) {
            warnedDays.add(warnKey);
            console.error(
              `[GMAIL_SMTP_QUOTA_APPROACHING] account=${accountId} ${count}/${SIGNUP_DAILY_EMAIL_CAP} sent today. Consider Resend migration.`,
            );
          }
        }
      }
      // For provider==='resend', no cap check — abuse threshold is enforced
      // by warnIfResendAbuseThresholdCrossed() inside getSenderForAccount.

      // Log the send with the correct provider tag.
      const { error } = await admin
        .from("email_send_log")
        .insert({ category, account_id: accountId, provider });
      if (error) {
        console.error("[quota-guard] insert failed; send proceeds anyway", error);
      }
    }
    ```

    Notes:
    - The new `provider` field on the insert mirrors the column added in Plan 01. Existing inserts that omit the field would also work (DEFAULT 'gmail'), but explicitly tagging Resend rows is cleaner and matches the `email_send_log.provider` analytics intent.
    - The double `createAdminClient()` call (one new, one existing at the bottom) is fine but can be deduped — refactor to a single `const admin = createAdminClient()` at the top of the function and reuse it for the insert.
    - `getDailySendCount` is unchanged — it still counts ALL rows for the account regardless of provider, which is what the abuse-threshold helper in Task 1 also wants.
    - `getRemainingDailyQuota` is unchanged — its consumers (Phase 32 auto-cancel, Phase 33 pushback) only run for Gmail accounts in practice; if a future Resend account triggers them, they'll see the count but the leaf sender will not refuse. Acceptable for framework-only.

    **Change B — do NOT touch `getDailySendCount`, `getRemainingDailyQuota`, or `logQuotaRefusal`.** Their signatures are stable Phase 35 contracts; rewriting them to be provider-aware adds risk without benefit at framework-only scope.
  </action>
  <verify>
    - `grep -n "email_provider" lib/email-sender/quota-guard.ts` shows the new SELECT.
    - `grep -n "provider: \"resend\"\|provider: \"gmail\"\|provider:" lib/email-sender/quota-guard.ts` shows the insert tag mapping.
    - `npx vitest run tests/quota-guard*.test.ts tests/account-sender.test.ts` — existing quota guard tests still pass (chainable supabase mocks may need a `.maybeSingle()` extension on the new accounts SELECT; if any quota-guard test fails because of the unmocked `accounts` lookup, update its supabase mock factory to handle the second `.from("accounts").select("email_provider")` chain returning `data:null` so the function falls through to Gmail path).
    - `npx tsc --noEmit` clean.
  </verify>
  <done>
    `checkAndConsumeQuota` skips the 200/day cap when `email_provider='resend'`; logs every send with the correct provider tag; existing test suite green (with mock updates if needed).
  </done>
</task>

<task type="auto">
  <name>Task 3: send-booking-emails.ts — switch to isRefusedSend (OQ-2 fix) + extend factory tests</name>
  <files>lib/email/send-booking-emails.ts, tests/account-sender.test.ts</files>
  <action>
    **Sub-task A — orchestrator dual-prefix fix (OQ-2):**

    Open `lib/email/send-booking-emails.ts`. The current import line:

    ```typescript
    import { REFUSED_SEND_ERROR_PREFIX } from "@/lib/email-sender/account-sender";
    ```

    Replace with:

    ```typescript
    import { isRefusedSend } from "@/lib/email-sender/account-sender";
    ```

    Find the existing block (around lines 87-98):

    ```typescript
    if (
      !confirmationFlagged &&
      confResult.status === "fulfilled" &&
      !confResult.value.success &&
      confResult.value.error?.startsWith(REFUSED_SEND_ERROR_PREFIX)
    ) {
    ```

    Replace the `startsWith(REFUSED_SEND_ERROR_PREFIX)` line with:

    ```typescript
      isRefusedSend(confResult.value.error)
    ```

    So the block becomes:

    ```typescript
    if (
      !confirmationFlagged &&
      confResult.status === "fulfilled" &&
      !confResult.value.success &&
      isRefusedSend(confResult.value.error)
    ) {
      confirmationFlagged = true;
      console.error("[booking-emails] confirmation send refused — flagging booking", {
        booking_id: bookingId,
        error: confResult.value.error,
      });
    }
    ```

    Update the inline comment near this block (was "Phase 35 OAuth refusal..."): change to "Phase 35 OAuth refusal OR Phase 36 Resend refusal (see isRefusedSend) — same save-and-flag semantics: booking succeeds, confirmation_email_sent=false."

    Why: per RESEARCH §OQ-2 and §Pitfall 5, the previous startsWith check missed `resend_send_refused:` errors, leaving `confirmation_email_sent=true` on Resend failures. The shared helper covers both prefixes in one place; future provider refusals only need to update `isRefusedSend` to be detected.

    **Sub-task B — extend tests/account-sender.test.ts to cover the new Resend branches.**

    Append these test cases to `tests/account-sender.test.ts` (at the bottom of the existing `describe("getSenderForAccount", ...)` block, OR in a sibling `describe("Phase 36 Resend routing", ...)` block — whichever is cleaner given the existing file's mock setup):

    1. **[#10] email_provider='resend' happy path** — set `_accountResult.data` to include `email_provider: "resend"`, `resend_status: "active"`, `name: "Acme Plumbing"`. Assert: returned sender has `provider: "resend"`. Assert: `fetchGoogleAccessToken` was NOT called (no Gmail flow).
    2. **[#11] email_provider='resend' AND resend_status='suspended'** — assert: refused with error matching `/^resend_send_refused: account_suspended/`. `fetchGoogleAccessToken` not called. `account_oauth_credentials` not queried.
    3. **[#12] email_provider='resend' wins over present account_oauth_credentials row** — set both an active credential AND email_provider='resend'. Assert: returned sender has `provider: "resend"`. Credential is left in DB unchanged.
    4. **[#13] isRefusedSend helper covers both prefixes** — call `isRefusedSend("oauth_send_refused: ...")` → true, `isRefusedSend("resend_send_refused: ...")` → true, `isRefusedSend("some_other_error: ...")` → false, `isRefusedSend(undefined)` → false.
    5. **[#14] RESEND_REFUSED_SEND_ERROR_PREFIX exported from account-sender re-export** — `import { RESEND_REFUSED_SEND_ERROR_PREFIX } from "../lib/email-sender/account-sender"` and assert it equals `"resend_send_refused"`.

    The chainable Supabase mock factory in the existing file currently only handles `accounts` and `account_oauth_credentials` table lookups via `_accountResult` and `_credResult` closures. Extend the closures to include the three new account columns (`email_provider`, `resend_status`, `name`); the existing `selectChain` helper already returns whatever `_accountResult` carries, so the only change is updating `setAccountResult(...)` calls in the new tests to pass the extended shape.

    Do NOT mock `RESEND_API_KEY` here; the unit test in 36-02 (`tests/resend-provider.test.ts`) covers that. The factory test asserts only that the returned client has `provider: "resend"` — the actual Resend HTTP call is the unit test's concern.

    **Sub-task C — tests/__mocks__/account-sender.ts already has `isRefusedSend` exported (Plan 02 Task 3).** Verify the export is there and matches the real implementation; if not, fix it. This ensures any test importing the helper through the alias gets the same semantics as the real module.
  </action>
  <verify>
    - `grep -n "isRefusedSend" lib/email/send-booking-emails.ts` shows the new import and call site.
    - `grep -n "REFUSED_SEND_ERROR_PREFIX" lib/email/send-booking-emails.ts` returns nothing (the old constant import is fully replaced; if it's still needed elsewhere in the file, leave it as `import { REFUSED_SEND_ERROR_PREFIX, isRefusedSend } from ...` — check first).
    - `npx vitest run tests/account-sender.test.ts` — original 9 tests + new 5 tests all pass (14 total).
    - `npx vitest run tests/send-booking-emails*.test.ts tests/bookings-api.test.ts` — orchestrator integration tests still pass (the `isRefusedSend` helper exported from the alias mock keeps them green).
    - `npx tsc --noEmit` clean.
  </verify>
  <done>
    `send-booking-emails.ts` uses `isRefusedSend` to flag both OAuth and Resend refusals; factory tests cover all 5 new Resend branches; full vitest suite green.
  </done>
</task>

<task type="auto">
  <name>Task 4: FUTURE_DIRECTIONS.md — capture deferred PREREQ-03, Vercel env var, live integration test</name>
  <files>FUTURE_DIRECTIONS.md</files>
  <action>
    Open `FUTURE_DIRECTIONS.md`. Find the section that maps to "Future Improvements" or "Assumptions & Constraints" (per the user's project-completion-report convention in CLAUDE.md). If the file does not yet have a Phase 36 entry, add a new H2 section:

    ```markdown
    ## Phase 36: Resend Backend — Activation Steps (Deferred from Phase 36)

    Phase 36 shipped the **framework only** on 2026-05-08. The provider, factory routing, quota bypass, abuse warning, and dual-prefix orchestrator fix are all in place and unit-tested. To activate Resend for a real customer, the following steps are required:

    ### PREREQ-03 — Resend account + NSI domain DNS

    1. Create a Resend account (free tier sufficient for verification; Pro tier ~$20/month for production volume).
    2. In Resend dashboard → Domains → Add `nsintegrations.com`.
    3. Resend will provide DNS records — add them in Namecheap DNS:
       - **SPF**: TXT record (Resend value)
       - **DKIM**: 3 CNAME records (Resend values)
       - **DMARC** (recommended): TXT record `v=DMARC1; p=none; rua=mailto:...`
    4. Wait for Resend dashboard to show "Verified" for SPF + DKIM (typically minutes; can take up to 24h).
    5. From Resend dashboard → API Keys → Create API Key (production scope).

    ### Vercel env var

    1. Vercel → Project → Settings → Environment Variables.
    2. Add `RESEND_API_KEY` for both **Preview** and **Production** with the value from step 5 above.
    3. Redeploy (or trigger a new deploy for the change to take effect).

    ### First-customer live integration test

    Before flipping a real customer to Resend, validate the path end-to-end:

    1. Pick a test account in Supabase (e.g. `nsi-test`).
    2. Run in Supabase SQL editor:
       ```sql
       UPDATE accounts SET email_provider = 'resend' WHERE slug = 'nsi-test';
       ```
    3. Make a test booking against `https://booking.nsintegrations.com/nsi-test/...`.
    4. Verify in Resend dashboard → Logs that the send appears with HTTP 200.
    5. Verify the booker inbox: email arrives with display name "Acme Plumbing" (or whatever the test account's `name` is) and `bookings@nsintegrations.com` in the envelope.
    6. Verify Gmail renders the `.ics` attachment as an inline RSVP card (Yes/Maybe/No buttons). If it does NOT, the `content_type: "text/calendar; method=REQUEST"` field is the lever — see RESEARCH §4 for the downgrade path.
    7. Reply to the email — confirm the reply goes to the account owner's address (via `Reply-To`), not to NSI.
    8. After confirming success, decide whether to keep the test account on Resend or flip back:
       ```sql
       UPDATE accounts SET email_provider = 'gmail' WHERE slug = 'nsi-test';
       ```

    ### Customer activation flow

    Once the live integration test passes, real customer activation is a one-line SQL update:

    ```sql
    UPDATE accounts SET email_provider = 'resend' WHERE id = '...';
    ```

    No code change, no redeploy. The factory routes immediately on the next send.

    ### Suspension lever

    To suspend a Resend account (abuse, unpaid customer) without forcing them back to Gmail:

    ```sql
    UPDATE accounts SET resend_status = 'suspended' WHERE id = '...';
    ```

    All sends from that account refuse with `resend_send_refused: account_suspended` until you flip back to `'active'`.
    ```

    If FUTURE_DIRECTIONS.md does not exist at the project root yet, create it with the above section as the file's body, prefixed with a brief H1 introducing it as the project's accumulated deferred-work log.

    Notes:
    - Do NOT include code that would only run after activation (no env var check at module load, no startup logging that requires `RESEND_API_KEY`). The framework must compile and run cleanly without `RESEND_API_KEY` set.
    - This task is documentation only; it changes no code.
  </action>
  <verify>
    - `grep -n "PREREQ-03\|RESEND_API_KEY" FUTURE_DIRECTIONS.md` shows both references.
    - `grep -n "UPDATE accounts SET email_provider" FUTURE_DIRECTIONS.md` shows the activation snippet.
    - File renders cleanly in markdown preview (no syntax errors).
  </verify>
  <done>
    FUTURE_DIRECTIONS.md captures PREREQ-03 DNS setup, Vercel `RESEND_API_KEY` env var add, the first-customer live integration test recipe, and the customer-activation/suspension SQL snippets.
  </done>
</task>

</tasks>

<verification>
- `getSenderForAccount` branches on `accounts.email_provider`: 'resend' → `createResendClient`, otherwise → existing Gmail-OAuth flow.
- `accounts.resend_status='suspended'` → refused sender with `resend_send_refused: account_suspended`, no further DB lookups.
- `checkAndConsumeQuota` skips the 200/day cap for Resend accounts; logs with `provider='resend'` (or `'gmail'`).
- `lib/email/send-booking-emails.ts` uses `isRefusedSend` so Resend refusals fire `confirmation_email_sent=false`.
- Soft 5000/day Resend abuse threshold emits `console.warn` only.
- Factory tests cover all 5 new Resend branches (suspension, happy, Resend-wins-over-credential, isRefusedSend helper, RESEND constant export).
- FUTURE_DIRECTIONS.md captures PREREQ-03 + Vercel env var + live integration test as deferred items.
- `npx tsc --noEmit` and `npx vitest run` both clean.
</verification>

<success_criteria>
- Provider routing live in the factory (Resend wins over OAuth credential per CONTEXT).
- Quota bypass + per-row provider tagging in `checkAndConsumeQuota` (OQ-1 resolved via centralization, zero leaf-caller changes).
- OQ-2 dual-prefix orchestrator fix in place via `isRefusedSend` shared helper.
- Soft abuse warn-log fires when Resend account crosses 5000/day.
- FUTURE_DIRECTIONS.md updated.
- Full test suite (existing + new) green.
- Phase 36 ships framework-only — no live Resend API call has been made; PREREQ-03 stays deferred.
</success_criteria>

<output>
After completion, create `.planning/phases/36-resend-backend-for-upgraded-accounts/36-03-SUMMARY.md` recording:
- The factory routing branch and where it sits relative to the OAuth path.
- The OQ-1 quota bypass approach actually taken (centralized in `checkAndConsumeQuota` via internal `accounts.email_provider` SELECT — no leaf-caller changes).
- The OQ-2 dual-prefix fix and the shared `isRefusedSend` helper.
- The soft 5000/day abuse warn-log helper.
- The list of FUTURE_DIRECTIONS.md activation steps for Andrew when the first customer needs Resend.
- A forward note that Phase 37 (Upgrade Flow) consumes `createResendClient` directly to send the upgrade-request email to Andrew, bypassing the per-account quota guard entirely (LD-05 bootstrap-safe path).
</output>
</content>
</invoke>