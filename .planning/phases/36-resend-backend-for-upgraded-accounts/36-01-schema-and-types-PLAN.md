---
phase: 36-resend-backend-for-upgraded-accounts
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260507120000_phase36_resend_provider.sql
  - lib/email-sender/types.ts
autonomous: true

must_haves:
  truths:
    - "accounts.email_provider column exists with TEXT NOT NULL DEFAULT 'gmail' and CHECK (email_provider IN ('gmail','resend'))"
    - "accounts.resend_status column exists with TEXT NOT NULL DEFAULT 'active' and CHECK (resend_status IN ('active','suspended'))"
    - "email_send_log.provider column exists with TEXT NOT NULL DEFAULT 'gmail' and existing rows backfilled to 'gmail'"
    - "EmailProvider TypeScript union accepts 'gmail' | 'resend' so future EmailClient instances can declare provider:'resend' without compile errors"
  artifacts:
    - path: "supabase/migrations/20260507120000_phase36_resend_provider.sql"
      provides: "Migration adding accounts.email_provider, accounts.resend_status, email_send_log.provider"
      min_lines: 15
    - path: "lib/email-sender/types.ts"
      provides: "EmailProvider union extended to 'gmail' | 'resend'"
      contains: "\"gmail\" | \"resend\""
  key_links:
    - from: "supabase/migrations/20260507120000_phase36_resend_provider.sql"
      to: "accounts table"
      via: "ALTER TABLE accounts ADD COLUMN email_provider, resend_status"
      pattern: "ALTER TABLE accounts"
    - from: "supabase/migrations/20260507120000_phase36_resend_provider.sql"
      to: "email_send_log table"
      via: "ALTER TABLE email_send_log ADD COLUMN provider TEXT NOT NULL DEFAULT 'gmail'"
      pattern: "ALTER TABLE email_send_log"
---

<objective>
Lay the schema + type foundation for Phase 36's Resend routing. Adds `accounts.email_provider`, `accounts.resend_status`, and `email_send_log.provider` columns; extends the TypeScript `EmailProvider` union so the new Resend provider (Plan 02) and the routed factory (Plan 03) can compile cleanly.

Purpose: Resolve OQ-3 (RESEARCH §9). Until `EmailProvider` accepts `"resend"`, neither the new provider's `provider: "resend"` field nor the factory's branch can type-check. Schema must land first because the factory in Plan 03 reads `accounts.email_provider` and `accounts.resend_status` in its DB query.

Output: One forward migration + a one-line type union extension. Zero behavior change at runtime — every existing account defaults to `email_provider='gmail'` and every existing log row defaults to `provider='gmail'`.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-CONTEXT.md
@.planning/phases/36-resend-backend-for-upgraded-accounts/36-RESEARCH.md
@lib/email-sender/types.ts
@supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql
@supabase/migrations/20260506140000_phase35_email_send_log_account_id.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Phase 36 schema migration</name>
  <files>supabase/migrations/20260507120000_phase36_resend_provider.sql</files>
  <action>
    Create `supabase/migrations/20260507120000_phase36_resend_provider.sql` with the following exact contents (timestamp must be later than the last Phase 35 migration `20260506140000`):

    ```sql
    -- Phase 36: Resend backend for upgraded accounts
    --
    -- Adds two per-account columns and one per-send-log column so the
    -- getSenderForAccount factory can route email_provider='resend' accounts
    -- through Resend instead of Gmail OAuth, and so analytics on email_send_log
    -- can distinguish Gmail vs Resend rows.
    --
    -- Backfill semantics: PostgreSQL's constant-default fast-path on ALTER TABLE
    -- ADD COLUMN means existing rows take the DEFAULT 'gmail' value with no row
    -- rewrite. The explicit UPDATE is documentation-only; it is a no-op given
    -- the DEFAULT but makes the backfill intent obvious.
    --
    -- RLS: existing accounts policies (owners read/update own account) cover
    -- the new columns; no new policies needed. email_send_log has no RLS.

    -- 1. accounts.email_provider — provider routing flag (Andrew flips manually
    --    in the Supabase dashboard when an upgrade request lands). DEFAULT 'gmail'
    --    so every existing account stays on the Gmail-OAuth path until flipped.
    ALTER TABLE accounts
      ADD COLUMN email_provider TEXT NOT NULL DEFAULT 'gmail'
        CHECK (email_provider IN ('gmail', 'resend'));

    -- 2. accounts.resend_status — per-account suspension flag for Resend accounts.
    --    'suspended' causes getSenderForAccount to return a refused sender with
    --    error 'resend_send_refused: account_suspended'. Independent of the
    --    provider flip so Andrew can suspend without forcing a downgrade.
    ALTER TABLE accounts
      ADD COLUMN resend_status TEXT NOT NULL DEFAULT 'active'
        CHECK (resend_status IN ('active', 'suspended'));

    -- 3. email_send_log.provider — per-send provider tag. Lets analytics tell
    --    Gmail vs Resend rows apart even after an account flips providers
    --    mid-day. DEFAULT 'gmail' implicitly backfills existing rows.
    ALTER TABLE email_send_log
      ADD COLUMN provider TEXT NOT NULL DEFAULT 'gmail';

    -- Documentation-only backfill (the DEFAULT above already filled rows).
    UPDATE email_send_log SET provider = 'gmail' WHERE provider IS NULL;
    ```

    Notes:
    - Do NOT use Postgres ENUM — CHECK constraints with TEXT are easier to alter and were chosen in CONTEXT (Claude's discretion).
    - The migration is forward-only; no `_ROLLBACK.sql` partner is required (matches the Phase 35 `20260506140000_phase35_email_send_log_account_id.sql` precedent which also has none).
    - Apply via the standard `supabase db push` flow (or via `mcp__claude_ai_Supabase__apply_migration` if running against hosted Supabase per the Phase 35 deviation pattern). For Phase 36 framework-only, do NOT apply to hosted production until a customer needs Resend — local apply for tests is sufficient.
  </action>
  <verify>
    - File exists at the exact path with timestamp `20260507120000`.
    - `grep -c "ALTER TABLE accounts" supabase/migrations/20260507120000_phase36_resend_provider.sql` returns `2` (one per added column).
    - `grep -c "ALTER TABLE email_send_log" supabase/migrations/20260507120000_phase36_resend_provider.sql` returns `1`.
    - Run the migration locally: `supabase db reset` or `supabase migration up` succeeds without error; `psql -c "\d accounts" | grep -E "email_provider|resend_status"` shows both columns; `psql -c "\d email_send_log" | grep provider` shows the column.
  </verify>
  <done>
    Migration file exists, applies cleanly to a local Supabase instance, and the three new columns appear with their CHECK constraints and DEFAULT values intact.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend EmailProvider type union</name>
  <files>lib/email-sender/types.ts</files>
  <action>
    Open `lib/email-sender/types.ts`. Find the line:

    ```typescript
    /** Supported email providers. */
    export type EmailProvider = "gmail";
    ```

    Replace with:

    ```typescript
    /** Supported email providers. */
    export type EmailProvider = "gmail" | "resend";
    ```

    This is the only change in this file. Do NOT modify `EmailClientConfig` (the legacy gmail-singleton config interface that still references `user`/`appPassword` — those fields are dead since the Phase 35 SMTP retirement but removing them is out of scope for Phase 36).

    Why this matters (RESEARCH §Pitfall 3): the new Resend provider in Plan 02 will declare `provider: "resend"` on its returned `EmailClient`. Without this union extension, that line fails TypeScript compilation. This must land in Wave 1 so Plan 02 can compile.
  </action>
  <verify>
    - `grep -n "EmailProvider = " lib/email-sender/types.ts` returns the single line `export type EmailProvider = "gmail" | "resend";`.
    - `npx tsc --noEmit` passes with zero errors (no callsite was previously narrowing on the literal `"gmail"` exclusively — verify by grepping `provider === "gmail"` in lib/ and confirming any such checks still type-check as `"gmail" | "resend"` discriminations).
  </verify>
  <done>
    `EmailProvider` union accepts both `"gmail"` and `"resend"`; the project still type-checks clean.
  </done>
</task>

</tasks>

<verification>
- `accounts.email_provider`, `accounts.resend_status`, `email_send_log.provider` all exist after migration apply.
- All three columns default existing rows to `'gmail'` / `'active'` (no behavior change at runtime).
- `EmailProvider` TypeScript union accepts `"resend"`.
- `npx tsc --noEmit` passes.
- Existing test suite (`npx vitest run`) still passes — no behavior change yet.
</verification>

<success_criteria>
- Migration file at `supabase/migrations/20260507120000_phase36_resend_provider.sql` applies cleanly.
- `lib/email-sender/types.ts` `EmailProvider` union is `"gmail" | "resend"`.
- TypeScript compiles clean across the whole project.
- No existing tests break.
</success_criteria>

<output>
After completion, create `.planning/phases/36-resend-backend-for-upgraded-accounts/36-01-SUMMARY.md` recording: migration filename + timestamp, the three new columns + their defaults/CHECK constraints, the EmailProvider union extension, and a forward note that Plan 02 will use the union to declare `provider: "resend"` on the new Resend EmailClient.
</output>
</content>
</invoke>