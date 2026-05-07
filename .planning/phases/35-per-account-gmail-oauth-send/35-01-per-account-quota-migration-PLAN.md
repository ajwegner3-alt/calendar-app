---
phase: 35-per-account-gmail-oauth-send
plan: 01
type: execute
wave: 2
depends_on: ["35-00"]
files_modified:
  - supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql
  - lib/email-sender/quota-guard.ts
  - tests/quota-guard.test.ts
autonomous: true

must_haves:
  truths:
    - "email_send_log rows carry an account_id (nullable for legacy rows, populated for all new rows)"
    - "getDailySendCount(accountId) returns count filtered to that account"
    - "checkAndConsumeQuota(category, accountId) writes account_id on the inserted row"
    - "getRemainingDailyQuota(accountId) returns per-account remaining, not global"
    - "Two accounts at 200/day each can both still send for a third account (quota is per-account, not global)"
  artifacts:
    - path: "supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql"
      provides: "ALTER TABLE adds account_id uuid column + index on (account_id, sent_at DESC)"
      contains: "ALTER TABLE email_send_log"
    - path: "lib/email-sender/quota-guard.ts"
      provides: "Per-account quota helpers"
      exports: ["getDailySendCount", "checkAndConsumeQuota", "getRemainingDailyQuota"]
  key_links:
    - from: "lib/email-sender/quota-guard.ts"
      to: "email_send_log table"
      via: "select with .eq('account_id', accountId) and insert with { category, account_id }"
      pattern: "\\.eq\\(\"account_id\""
---

<objective>
Add `account_id` to `email_send_log` and update quota-guard so daily count is filtered per-account. This unblocks the per-account 200/day cap (EMAIL-27, EMAIL-28).

Purpose: Today the 200/day Gmail cap is global — one runaway account can starve all others. Phase 35's per-account OAuth send only matters if quota is also per-account. This plan retrofits the quota table and helpers so each account has independent quota state.

Output: Migration applied to local Supabase, `quota-guard.ts` exports updated signatures, existing tests updated to pass an `accountId`.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/35-per-account-gmail-oauth-send/35-RESEARCH.md
@lib/email-sender/quota-guard.ts
@supabase/migrations/20260504130000_phase31_email_send_log_categories.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add account_id column + index migration</name>
  <files>supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql</files>
  <action>
    Create the migration file with this exact content:

    ```sql
    -- Phase 35 (EMAIL-27): per-account quota isolation.
    -- Adds account_id to email_send_log so getDailySendCount can filter per account.
    -- Nullable + ON DELETE SET NULL: legacy rows from Phases 5-34 (pre-Phase 35) have no account_id.
    -- New rows written by Phase 35 quota-guard will populate it.

    ALTER TABLE email_send_log
      ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

    -- Index for the per-account daily count query: WHERE account_id = $1 AND sent_at >= today
    CREATE INDEX IF NOT EXISTS email_send_log_account_sent_at_idx
      ON email_send_log (account_id, sent_at DESC);

    COMMENT ON COLUMN email_send_log.account_id IS
      'Account whose 200/day quota this send counts against. Nullable for legacy rows pre-Phase 35 and for signup-side sends (welcome email) that pre-date account creation.';
    ```

    Then apply the migration locally:
    ```bash
    supabase migration up
    ```

    Verify the column exists:
    ```bash
    supabase db diff --schema public | grep account_id || echo "applied"
    ```
  </action>
  <verify>
    Run `supabase db dump --schema public --data-only=false 2>/dev/null | grep -A2 "email_send_log" | head -20` and confirm `account_id uuid` appears in the column list. Also confirm `email_send_log_account_sent_at_idx` index exists by running `supabase db dump --schema public 2>/dev/null | grep email_send_log_account_sent_at_idx`.
  </verify>
  <done>
    `supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql` exists; migration applied locally; `email_send_log.account_id` column and `email_send_log_account_sent_at_idx` index present in local DB.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quota-guard signatures to take accountId</name>
  <files>lib/email-sender/quota-guard.ts</files>
  <action>
    Modify `lib/email-sender/quota-guard.ts`:

    1. **`getDailySendCount(accountId: string): Promise<number>`** — add the `.eq("account_id", accountId)` filter to the select:
       ```typescript
       const { count, error } = await admin
         .from("email_send_log")
         .select("*", { count: "exact", head: true })
         .eq("account_id", accountId)
         .gte("sent_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString());
       ```

    2. **`checkAndConsumeQuota(category: EmailCategory, accountId: string): Promise<void>`** — pass `accountId` through to `getDailySendCount` and include `account_id` in the insert:
       ```typescript
       const count = await getDailySendCount(accountId);
       // ... cap check unchanged ...
       const { error } = await admin.from("email_send_log").insert({ category, account_id: accountId });
       ```
       Update the warn-threshold log message to include the account: `[GMAIL_SMTP_QUOTA_APPROACHING] account=${accountId} ${count}/${SIGNUP_DAILY_EMAIL_CAP} ...`. Also change the warn de-dup key from `today` to `${today}:${accountId}` so accounts get independent warn logs.

    3. **`getRemainingDailyQuota(accountId: string): Promise<number>`** — pass `accountId` through:
       ```typescript
       const count = await getDailySendCount(accountId);
       return Math.max(0, SIGNUP_DAILY_EMAIL_CAP - count);
       ```

    4. **Tag the deprecation note**: at the top of the file, replace the v1.2/Resend migration comment with a note that as of Phase 35, the cap is per-account; signup-side paths (welcome email) currently pass the new account's id post-creation.

    Do NOT change the `EmailCategory` union, `QuotaExceededError`, `SIGNUP_DAILY_EMAIL_CAP`, or `logQuotaRefusal` signatures — those are stable.
  </action>
  <verify>
    Run `npx tsc --noEmit` from the project root — must compile clean (no callers updated yet in this plan; expect type errors at every callsite — that is correct, those get fixed in Plan 04. Confirm only that `lib/email-sender/quota-guard.ts` itself has no type errors by running `npx tsc --noEmit lib/email-sender/quota-guard.ts` if possible, or grep the tsc output for non-quota-guard errors).

    Then update `tests/quota-guard.test.ts`: every existing call to `checkAndConsumeQuota("category")`, `getDailySendCount()`, `getRemainingDailyQuota()` must pass an `accountId` (use a constant test UUID like `"00000000-0000-0000-0000-000000000001"`). Run `npx vitest run tests/quota-guard.test.ts` — must be green.
  </verify>
  <done>
    `lib/email-sender/quota-guard.ts` exports `getDailySendCount(accountId)`, `checkAndConsumeQuota(category, accountId)`, `getRemainingDailyQuota(accountId)`; the file itself type-checks; `tests/quota-guard.test.ts` passes with the new signatures. Callsite type errors elsewhere are expected and resolved in Plan 04.
  </done>
</task>

</tasks>

<verification>
- Migration applied: `email_send_log` has `account_id uuid` column + index.
- `quota-guard.ts` filters and inserts by `account_id`.
- `tests/quota-guard.test.ts` green with new signatures.
- Repo-wide `npx tsc --noEmit` will fail at the 7 caller sites — that is expected and is fixed in Plan 04.
</verification>

<success_criteria>
- Migration exists at `supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql` and applied locally.
- `lib/email-sender/quota-guard.ts` three exported helpers all take `accountId` as their first or second arg respectively, and use it both in select and insert.
- `tests/quota-guard.test.ts` passes.
- Documentation comment at top of file mentions "per-account as of Phase 35".
</success_criteria>

<output>
After completion, create `.planning/phases/35-per-account-gmail-oauth-send/35-01-SUMMARY.md` recording: migration filename, exact updated signatures, test file changes, and a note that 7 callers will be updated in Plan 04.
</output>
