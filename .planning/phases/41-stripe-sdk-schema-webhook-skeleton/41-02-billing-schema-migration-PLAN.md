---
phase: 41-stripe-sdk-schema-webhook-skeleton
plan: 02
type: execute
wave: 2
depends_on: []
files_modified:
  - supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql
  - supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql
autonomous: true

must_haves:
  truths:
    - "accounts table has 7 new billing columns: stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, current_period_end, plan_interval, trial_warning_sent_at"
    - "stripe_webhook_events table exists with stripe_event_id text PRIMARY KEY for idempotency"
    - "All existing v1.7 accounts have subscription_status = 'trialing' and trial_ends_at ≈ NOW() + 14 days (anchored to migration apply time, NOT created_at)"
    - "New signups via provision_account_for_new_user trigger automatically receive subscription_status = 'trialing' and trial_ends_at = NOW() + 14 days, with all original Phase 10 columns (owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step) preserved"
    - "A reverse-migration SQL file is co-shipped that drops all 7 columns + the dedupe table + restores the original Phase 10 trigger function — NOT applied, only documented"
    - "Migration was validated on a Supabase preview branch first, then applied to production"
  artifacts:
    - path: "supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql"
      provides: "Forward migration: 7 new columns + dedupe table + trigger update + grandfather backfill in single transaction"
      contains: "ALTER TABLE public.accounts"
      contains_also:
        - "CREATE TABLE public.stripe_webhook_events"
        - "CREATE OR REPLACE FUNCTION public.provision_account_for_new_user"
        - "trial_ends_at = NOW() + INTERVAL '14 days'"
        - "trial_warning_sent_at"
    - path: "supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql"
      provides: "Reverse migration (co-shipped, not applied)"
      contains: "DROP TABLE IF EXISTS public.stripe_webhook_events"
      contains_also:
        - "DROP COLUMN IF EXISTS trial_warning_sent_at"
        - "DROP COLUMN IF EXISTS stripe_customer_id"
  key_links:
    - from: "provision_account_for_new_user trigger function"
      to: "accounts.subscription_status + accounts.trial_ends_at"
      via: "INSERT statement default values"
      pattern: "subscription_status,?\\s*\\n?\\s*trial_ends_at"
    - from: "Backfill UPDATE statement"
      to: "Existing v1.7 accounts grandfather"
      via: "WHERE stripe_customer_id IS NULL"
      pattern: "WHERE stripe_customer_id IS NULL"
    - from: "stripe_webhook_events table"
      to: "Idempotency PRIMARY KEY constraint"
      via: "stripe_event_id TEXT PRIMARY KEY"
      pattern: "stripe_event_id\\s+TEXT\\s+PRIMARY KEY"
---

<objective>
Ship the single-transaction Supabase migration that establishes the billing schema foundation: add 7 columns to `accounts`, create the `stripe_webhook_events` idempotency table, update the `provision_account_for_new_user` trigger to default new signups to `trialing`, and backfill all existing v1.7 accounts with a 14-day trial anchored to migration apply time (LD-09 grandfather pattern).

Purpose: This is the only DB-touching plan in Phase 41. It creates the persistent state that the webhook handler (Plan 41-03), the Phase 42 checkout flow, the Phase 43 paywall middleware, and the Phase 44 customer portal all read from / write to. Getting the column shapes right here prevents migration churn for the rest of the v1.8 milestone.

Output:
- `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` — applied to a Supabase preview branch FIRST for smoke validation, then applied to production via `mcp__claude_ai_Supabase__apply_migration`.
- `supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql` — co-shipped reverse migration. Documented in this plan's SUMMARY as the runbook. NOT applied.
- The `nsi` test account (Andrew's canary) confirmed via SELECT to have `subscription_status = 'trialing'` and `trial_ends_at` ≈ migration apply time + 14 days.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-CONTEXT.md
@.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-RESEARCH.md

# CRITICAL: the existing trigger function being replaced — diff against this
# before applying so no Phase 10 columns are accidentally dropped (V18-CP-08 trigger pitfall).
@supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql

# Migration style precedents to mirror
@supabase/migrations/20260507120000_phase36_resend_provider.sql
@supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql

# Co-shipped rollback file naming convention precedent
@supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author forward + rollback migration files</name>
  <files>
supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql,
supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql
  </files>
  <action>
**Step 1: Diff the existing trigger function before writing the new one.**

Open `supabase/migrations/20260428120002_phase10_accounts_rls_and_trigger.sql` and read the body of `provision_account_for_new_user()` (lines roughly 57–83). Note every column it INSERTs: `owner_user_id`, `owner_email`, `slug`, `name`, `timezone`, `onboarding_complete`, `onboarding_step`. The new version MUST preserve ALL of these and only ADD `subscription_status` and `trial_ends_at` to the INSERT — dropping any existing column will silently break all future signups (V18-CP pitfall #8 in RESEARCH.md).

**Step 2: Create the forward migration file.**

File path: `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql`

Write EXACTLY this body (verbatim from RESEARCH §Code Examples Example 4 — already validated against the existing schema):

```sql
-- Source: synthesizes milestone v1.8 ARCHITECTURE.md §1a-1c + CONTEXT 7-column scope
-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql
--
-- Phase 41: Stripe billing foundation.
-- Single transaction (Postgres DDL is transactional). All-or-nothing apply.
-- Rollback: see paired _ROLLBACK.sql file. Do not apply unless reverting.
--
-- Apply via: mcp__claude_ai_Supabase__apply_migration with
--   name='phase41_stripe_billing_foundation' and the file body below.
-- Validate first on a Supabase preview branch (mcp__claude_ai_Supabase__create_branch).

BEGIN;

-- 1. Add 7 billing columns to accounts.
ALTER TABLE public.accounts
  ADD COLUMN stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN subscription_status      TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing', 'active', 'past_due', 'canceled',
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )),
  ADD COLUMN trial_ends_at            TIMESTAMPTZ,
  ADD COLUMN current_period_end       TIMESTAMPTZ,
  ADD COLUMN plan_interval            TEXT
    CHECK (plan_interval IS NULL OR plan_interval IN ('monthly', 'annual', 'month', 'year')),
  ADD COLUMN trial_warning_sent_at    TIMESTAMPTZ;
-- NOTE: plan_interval CHECK accepts both ('month'/'year') from Stripe payload AND
-- ('monthly'/'annual') from CONTEXT vocabulary. Phase 42 normalizes — for now
-- accept both so neither path breaks.

COMMENT ON COLUMN public.accounts.stripe_customer_id IS
  'Stripe Customer ID (cus_*). Set by Phase 42 checkout route before redirect to hosted Checkout.';
COMMENT ON COLUMN public.accounts.subscription_status IS
  'Mirror of Stripe subscription.status. Source of truth for paywall middleware (Phase 43).';
COMMENT ON COLUMN public.accounts.trial_ends_at IS
  '14-day trial deadline. Set by trigger on signup; backfilled to NOW()+14d on v1.8 deploy.';
COMMENT ON COLUMN public.accounts.trial_warning_sent_at IS
  'Set by webhook on customer.subscription.trial_will_end. Phase 44 reads this to gate the trial-ending email.';

-- 2. Backfill: grandfather all existing accounts with trial starting at deploy.
-- LD-09 + V18-CP-06: anchor trial to NOW() (deploy time), NOT created_at.
-- WHERE stripe_customer_id IS NULL = "every existing account" since no one has one yet.
UPDATE public.accounts
SET
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trialing'
WHERE stripe_customer_id IS NULL;

-- 3. Idempotency table for webhook deduplication.
CREATE TABLE public.stripe_webhook_events (
  stripe_event_id TEXT        PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

-- RLS: service-role-only writes. No authenticated read policy needed.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- (RLS enabled with zero policies = no anon/authenticated access.)

COMMENT ON TABLE public.stripe_webhook_events IS
  'Stripe webhook idempotency log. Phase 41+: INSERT ... ON CONFLICT DO NOTHING on stripe_event_id; if 0 rows inserted, event already processed.';

-- 4. Update provision_account_for_new_user trigger to set trial defaults on signup.
-- Mirrors the original from 20260428120002_phase10_accounts_rls_and_trigger.sql,
-- adding trial_ends_at + subscription_status. All other columns preserved unchanged.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id,
    owner_email,
    slug,
    name,
    timezone,
    onboarding_complete,
    onboarding_step,
    subscription_status,
    trial_ends_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NULL,                         -- slug filled by wizard step 1
    NULL,                         -- name filled by wizard step 1
    'UTC',                        -- placeholder; wizard step 2 sets real timezone
    FALSE,
    1,
    'trialing',                   -- BILL-04: every new signup starts trialing
    NOW() + INTERVAL '14 days'    -- BILL-04: 14-day clock starts at signup
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- The trigger itself (provision_account_on_signup on auth.users) was created in
-- the Phase 10 migration and points at the function name — CREATE OR REPLACE
-- above re-binds without needing to drop+recreate the trigger.

COMMIT;
```

**Step 3: Create the rollback migration file.**

File path: `supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql`

Write EXACTLY this body (verbatim from RESEARCH §Code Examples Example 5):

```sql
-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql
--
-- Reverse of phase41_stripe_billing_foundation.sql.
-- DO NOT APPLY unless reverting Phase 41. Co-shipped per CONTEXT migration policy.

BEGIN;

-- 1. Restore the original (Phase 10) trigger function.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step
  ) VALUES (
    NEW.id, NEW.email, NULL, NULL, 'UTC', FALSE, 1
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- 2. Drop dedupe table.
DROP TABLE IF EXISTS public.stripe_webhook_events;

-- 3. Drop billing columns. (DROP COLUMN auto-removes any CHECK / UNIQUE constraints.)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS trial_warning_sent_at,
  DROP COLUMN IF EXISTS plan_interval,
  DROP COLUMN IF EXISTS current_period_end,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;

COMMIT;
```

**What to AVOID:**
- Do NOT split the forward migration into multiple SQL files — CONTEXT requires single transaction / single file (atomicity guarantee).
- Do NOT omit the `BEGIN;` / `COMMIT;` wrappers — even though Postgres auto-wraps DDL, explicit transaction boundaries make the apply-via-MCP semantics obvious.
- Do NOT change `WHERE stripe_customer_id IS NULL` to `WHERE TRUE` in the backfill — IS NULL is the correct semantic guard ("every account that hasn't been linked to Stripe yet"). After Phase 42 runs, accounts WILL have `stripe_customer_id` set, so this clause prevents accidental re-grandfathering during any future hot-fix re-apply.
- Do NOT add `IF NOT EXISTS` to `ADD COLUMN` statements. We want the migration to FAIL LOUDLY if Phase 41 is accidentally applied twice; idempotent migrations hide bugs.
- Do NOT create the rollback file with an empty body or as a `.SKIP` file. It must be valid runnable SQL even though it isn't applied.
  </action>
  <verify>
- File `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` exists.
- Forward file `grep -c "ADD COLUMN"` returns at least 7 (the 7 new columns) — actually returns 1 because they're under one ALTER TABLE; instead `grep -E "stripe_customer_id|stripe_subscription_id|subscription_status|trial_ends_at|current_period_end|plan_interval|trial_warning_sent_at" supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql | wc -l` returns AT LEAST 7 distinct hits across the file.
- Forward file `grep -F "CREATE TABLE public.stripe_webhook_events" supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` returns 1 match.
- Forward file `grep -F "CREATE OR REPLACE FUNCTION public.provision_account_for_new_user" supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` returns 1 match.
- Forward file `grep -F "WHERE stripe_customer_id IS NULL" supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` returns 1 match.
- Diff trigger preservation check: every column from the Phase 10 trigger INSERT (`owner_user_id`, `owner_email`, `slug`, `name`, `timezone`, `onboarding_complete`, `onboarding_step`) appears in the new trigger INSERT — `for col in owner_user_id owner_email slug name timezone onboarding_complete onboarding_step; do grep -c "$col" supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql; done` returns at least 1 for each.
- Rollback file exists with `_ROLLBACK.sql` suffix and contains `DROP TABLE IF EXISTS public.stripe_webhook_events`.
- Rollback file restores the original 7-column INSERT (no `subscription_status`, no `trial_ends_at` in rollback's trigger function).
  </verify>
  <done>
- Both SQL files exist on disk at the documented paths.
- Forward file is a single transaction containing all 4 operations (columns, table, trigger update, backfill).
- Rollback file inverts every operation in reverse order and restores the original trigger.
- Trigger column-preservation diff verified — no Phase 10 columns dropped from the INSERT.
  </done>
</task>

<task type="auto">
  <name>Task 2: Validate on Supabase preview branch, then apply to production</name>
  <files>(no files modified — this task uses MCP Supabase tools to operate on the live database)</files>
  <action>
**Step 1: Create a Supabase preview branch.**

Use the MCP tool `mcp__claude_ai_Supabase__create_branch`. Branch name suggestion: `phase41-stripe-billing-validation`. Capture the branch ID returned.

If branch creation fails due to billing limits or insufficient plan tier, STOP and surface a clear error. Do NOT skip the preview-branch step and apply directly to production — this is CONTEXT-locked policy.

**Step 2: Apply the forward migration to the preview branch.**

Use `mcp__claude_ai_Supabase__apply_migration` with:
- The branch from Step 1.
- `name`: `phase41_stripe_billing_foundation`
- `query`: full body of `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql`.

If the apply errors, fix the SQL in the file FIRST (do NOT mutate just the in-flight query — keep the file as the source of truth), then re-apply on the same branch.

**Step 3: Smoke-validate the preview branch.**

Run these SELECTs via `mcp__claude_ai_Supabase__execute_sql` against the preview branch and confirm expected results:

a) Schema check: 7 new columns present.
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounts'
  AND column_name IN (
    'stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
    'trial_ends_at', 'current_period_end', 'plan_interval', 'trial_warning_sent_at'
  )
ORDER BY column_name;
```
EXPECT: 7 rows. `subscription_status` has `is_nullable = NO` and `column_default LIKE '%trialing%'`.

b) Dedupe table check.
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'stripe_webhook_events'
ORDER BY ordinal_position;
```
EXPECT: 4 rows: `stripe_event_id`, `event_type`, `received_at`, `processed_at`.

c) Backfill check.
```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE subscription_status = 'trialing') AS trialing_count,
  COUNT(*) FILTER (WHERE trial_ends_at IS NOT NULL) AS with_trial_end,
  MIN(trial_ends_at) AS earliest_trial_end,
  MAX(trial_ends_at) AS latest_trial_end
FROM public.accounts
WHERE stripe_customer_id IS NULL;
```
EXPECT: `total = trialing_count = with_trial_end`; `earliest_trial_end` and `latest_trial_end` both ≈ NOW() + 14 days (within seconds of each other since the backfill ran in a single statement).

d) Trigger smoke test — insert a fake auth.users row to confirm new signups default correctly.
```sql
-- Use a synthetic UUID + email; rollback after to keep the preview branch clean.
BEGIN;
INSERT INTO auth.users (id, email, instance_id)
  VALUES (gen_random_uuid(), 'phase41-smoke@example.test', '00000000-0000-0000-0000-000000000000');
SELECT subscription_status, trial_ends_at, owner_email, onboarding_complete, onboarding_step, timezone
FROM public.accounts
WHERE owner_email = 'phase41-smoke@example.test';
ROLLBACK;
```
EXPECT: One row with `subscription_status = 'trialing'`, `trial_ends_at` ≈ NOW()+14d, `onboarding_complete = false`, `onboarding_step = 1`, `timezone = 'UTC'`. (If `auth.users` insert fails due to permissions on the preview branch, run an equivalent INSERT against the public.accounts table directly to verify the new column defaults — note the deviation in the SUMMARY.)

**Step 4: If ALL preview validations pass, apply to production.**

Use `mcp__claude_ai_Supabase__apply_migration` against the PRODUCTION project (not the branch) with the same `name` and `query`.

If any preview validation fails, STOP. Surface the failure with the actual SELECT output, fix the SQL, re-apply on the preview branch, re-validate. Do NOT proceed to production until preview is green.

**Step 5: Production smoke validation.**

Re-run validation queries (a) through (c) from Step 3 against PRODUCTION. Additionally:

e) Andrew's `nsi` test account canary check:
```sql
SELECT slug, subscription_status, trial_ends_at, stripe_customer_id, created_at
FROM public.accounts
WHERE slug = 'nsi';
```
EXPECT: `subscription_status = 'trialing'`, `trial_ends_at` ≈ NOW() + 14 days, `stripe_customer_id IS NULL`. Capture the actual `trial_ends_at` value for the SUMMARY (this is the V18-CP-06 grandfather-anchor proof point).

**Step 6: Delete the preview branch (cleanup).**

Use `mcp__claude_ai_Supabase__delete_branch` to remove the validation branch. Capture the deletion confirmation in the SUMMARY.

**What to AVOID:**
- Do NOT apply the rollback file. It is documentation only; only apply if a real revert is requested by Andrew (which would be a separate plan).
- Do NOT skip the preview branch step "because the SQL looks fine" — `.upsert(ignoreDuplicates: true)` semantics (Plan 41-03) and the trigger update both have edge cases that only surface against real data (RESEARCH §Open Questions tertiary confidence note).
- Do NOT run the trigger smoke test against production — only against the preview branch. The synthetic user would create a real `accounts` row in production.
- Do NOT change the migration name string between preview-branch apply and production apply. Both must be `phase41_stripe_billing_foundation` for the apply log to align.
  </action>
  <verify>
Production-side verification queries (run via `mcp__claude_ai_Supabase__execute_sql` against the production project):

1. Columns present:
```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema='public' AND table_name='accounts'
  AND column_name IN ('stripe_customer_id','stripe_subscription_id','subscription_status','trial_ends_at','current_period_end','plan_interval','trial_warning_sent_at');
```
EXPECT: 7.

2. Dedupe table present with PRIMARY KEY:
```sql
SELECT EXISTS (
  SELECT 1 FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'stripe_webhook_events' AND c.contype = 'p'
);
```
EXPECT: `t` (true).

3. All accounts grandfathered:
```sql
SELECT COUNT(*) AS not_trialing FROM public.accounts WHERE subscription_status != 'trialing';
```
EXPECT: 0 (every existing account ended up trialing).

4. `nsi` canary:
```sql
SELECT subscription_status, EXTRACT(EPOCH FROM (trial_ends_at - NOW()))/86400 AS days_until_trial_end
FROM public.accounts WHERE slug = 'nsi';
```
EXPECT: `subscription_status = 'trialing'`, `days_until_trial_end` between 13.99 and 14.01.

5. Trigger function definition includes new columns:
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'provision_account_for_new_user' AND pronamespace = 'public'::regnamespace;
```
EXPECT: function body string contains `subscription_status`, `trial_ends_at`, `'trialing'`, AND all original columns (`owner_user_id`, `owner_email`, `slug`, `name`, `timezone`, `onboarding_complete`, `onboarding_step`).
  </verify>
  <done>
- Preview branch created, migration applied, all 5 smoke validations passed, branch deleted.
- Production migration applied via `mcp__claude_ai_Supabase__apply_migration`.
- All 5 production verification queries return expected values.
- `nsi` test account confirmed to be `trialing` with `trial_ends_at` ≈ apply-time + 14 days.
- No Phase 10 trigger columns dropped (verified via `pg_get_functiondef`).
  </done>
</task>

</tasks>

<verification>

Phase-level checks for this plan:

1. Both SQL files exist on disk: `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` and `_ROLLBACK.sql`.
2. Forward migration applied to production with name `phase41_stripe_billing_foundation`.
3. Production verification queries (1)–(5) above all pass.
4. `nsi` account canary: `subscription_status = 'trialing'`, `trial_ends_at` ≈ NOW() + 14 days at apply moment.
5. Preview branch was created, used, and deleted (no orphan branch left running).
6. No production data corrupted (existing `accounts` columns unchanged; new columns added without default-driven rewrites of unrelated rows).

</verification>

<success_criteria>

This plan is complete when:

- [ ] Forward migration SQL file exists at the canonical path with all 4 operations in a single BEGIN/COMMIT.
- [ ] Rollback migration SQL file exists alongside, with reverse operations in reverse order.
- [ ] Migration validated on a Supabase preview branch (all 5 smoke queries passed there) BEFORE production apply.
- [ ] Migration applied to production via `mcp__claude_ai_Supabase__apply_migration`.
- [ ] Production schema confirmed: 7 new columns + `stripe_webhook_events` table + updated trigger function.
- [ ] All existing accounts have `subscription_status = 'trialing'` and `trial_ends_at` ≈ apply_time + 14 days.
- [ ] `nsi` canary account verified.
- [ ] Preview branch cleaned up.
- [ ] Both SQL files committed: `feat(41-02): add stripe billing schema foundation migration`.

</success_criteria>

<output>
After completion, create `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/41-02-SUMMARY.md` documenting:

1. Exact migration name applied (`phase41_stripe_billing_foundation`) and timestamp of production apply (capture from MCP response).
2. Preview branch ID used and confirmation of cleanup.
3. Actual `trial_ends_at` value observed for Andrew's `nsi` account post-migration (proof of V18-CP-06 grandfather-anchor).
4. Total existing accounts backfilled (count from validation query 3).
5. Confirmation that the trigger function definition retains ALL Phase 10 columns plus the new 2 (paste a one-line summary like `INSERT cols: owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step, subscription_status, trial_ends_at`).
6. Rollback runbook (one paragraph): "If revert is needed, apply `supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql` via `mcp__claude_ai_Supabase__apply_migration` with name `phase41_stripe_billing_foundation_ROLLBACK`. This DROPs all 7 columns, DROPs `stripe_webhook_events`, and restores the Phase 10 trigger. Any rows with non-NULL `stripe_customer_id` will lose that linkage — coordinate with Stripe Dashboard cleanup if reverting after Phase 42 ships."
7. Frontmatter must include:
   - `subsystem: billing`
   - `affects: [41-03, 42-01, 43-01, 44-01]`
   - `tech-stack.added: ["accounts.stripe_customer_id", "accounts.stripe_subscription_id", "accounts.subscription_status", "accounts.trial_ends_at", "accounts.current_period_end", "accounts.plan_interval", "accounts.trial_warning_sent_at", "table:stripe_webhook_events"]`
   - `key-files: ["supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql", "supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql"]`
</output>
