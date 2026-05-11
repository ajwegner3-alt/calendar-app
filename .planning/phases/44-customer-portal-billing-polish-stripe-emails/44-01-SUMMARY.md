---
phase: 44-customer-portal-billing-polish-stripe-emails
plan: 01
subsystem: database
tags: [postgres, supabase, migration, stripe, billing, accounts]

# Dependency graph
requires:
  - phase: 41-stripe-sdk-schema-webhook-skeleton
    provides: accounts.stripe_customer_id, accounts.subscription_status, accounts.trial_ends_at — the broader Stripe billing column set on accounts that this column joins
  - phase: 42.5-multi-tier-stripe-schema
    provides: accounts.plan_tier — the column-on-accounts precedent for additive Phase-44 schema work
provides:
  - "accounts.cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE column on public.accounts"
  - "Forward + rollback migration SQL files at supabase/migrations/"
  - "COMMENT documenting webhook write path (Plan 44-04) and billing UI read path (Plan 44-05)"
affects:
  - 44-04-webhook-cancel-at-period-end-write
  - 44-05-billing-page-status-card
  - BILL-23 (cancel-at-period-end behavior)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent additive ALTER TABLE migrations using ADD COLUMN IF NOT EXISTS — safe to re-apply when schema_migrations registry is out of sync"
    - "DEFAULT FALSE for atomic backfill on Postgres 11+ — no separate UPDATE statement needed"

key-files:
  created:
    - supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql
    - supabase/migrations/20260511120000_phase44_cancel_at_period_end_ROLLBACK.sql
  modified: []

key-decisions:
  - "Column is BOOLEAN NOT NULL DEFAULT FALSE — false is the safe default for all existing accounts (no cancellation scheduled). NULL was rejected to keep webhook logic simple (no three-state truth)."
  - "Idempotent ADD COLUMN IF NOT EXISTS used because Phases 36/37/41 migration files are not registered in production schema_migrations — re-running these via supabase db push --linked could fail without idempotency."
  - "No UPDATE statement included. Postgres 11+ applies a constant DEFAULT atomically during ADD COLUMN, so all existing rows get FALSE without a separate backfill."
  - "Trigger function provision_account_for_new_user was NOT modified. DEFAULT FALSE means INSERT statements that omit cancel_at_period_end still succeed."
  - "Application path planned: Supabase MCP apply_migration first (matches Phase 41/42.5 precedent), Dashboard SQL editor as fallback."

patterns-established:
  - "Phase 44 schema convention: timestamp yyyymmdd + 120000 + phaseNN_<short_name>.sql, with matching _ROLLBACK.sql sibling"
  - "Documentation-as-data: COMMENT ON COLUMN captures who writes (webhook), who reads (billing page), and what truth the column mirrors (Stripe.Subscription.cancel_at_period_end)"

# Metrics
duration: ~5min
completed: 2026-05-11
---

# Phase 44 Plan 01: cancel_at_period_end Column Summary

**Adds the storage half of BILL-23 — a BOOLEAN NOT NULL DEFAULT FALSE column on accounts that mirrors Stripe.Subscription.cancel_at_period_end, set up so the Plan 44-04 webhook can write it and the Plan 44-05 billing page can read it for the amber cancel-scheduled Status Card variant.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-11T23:37Z
- **Completed:** 2026-05-11T23:42Z
- **Tasks:** 1/1
- **Files modified:** 2 (both created)

## Accomplishments

- Created forward migration `supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql` adding the column with proper transaction wrapping and a documentary COMMENT.
- Created matching rollback `supabase/migrations/20260511120000_phase44_cancel_at_period_end_ROLLBACK.sql`.
- All 7 plan-specified static grep checks pass (forward + rollback file existence; ADD COLUMN IF NOT EXISTS pattern; DROP COLUMN IF EXISTS pattern; exactly one BEGIN; and one COMMIT; zero UPDATE statements; zero trigger references).
- Storage target for Plan 44-04 webhook write is now in repo; Plan 44-05 billing page can SELECT cancel_at_period_end once migration is applied to production.

## Task Commits

1. **Task 1: Create cancel_at_period_end migration + rollback SQL files** — `894119b` (feat)

**Plan metadata commit:** appended below after STATE.md update.

## Files Created/Modified

- `supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql` (CREATED) — Forward migration. Inside `BEGIN; ... COMMIT;`, runs `ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;` and appends a `COMMENT ON COLUMN` documenting the webhook write source and the billing UI read consumer.
- `supabase/migrations/20260511120000_phase44_cancel_at_period_end_ROLLBACK.sql` (CREATED) — Reversal. Inside `BEGIN; ... COMMIT;`, runs `ALTER TABLE public.accounts DROP COLUMN IF EXISTS cancel_at_period_end;`. To be used only if Phase 44 is reverted before Plans 44-04/44-05 ship (after that, data loss is real).

## Verification Results

### Static checks (executor-run, all PASS)

| # | Check | Result |
|---|-------|--------|
| 1 | `ls -la supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql` | exists, 951 bytes |
| 2 | `ls -la supabase/migrations/20260511120000_phase44_cancel_at_period_end_ROLLBACK.sql` | exists, 330 bytes |
| 3 | `grep "ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE"` forward | match on line 10 |
| 4 | `grep "DROP COLUMN IF EXISTS cancel_at_period_end"` rollback | match on line 8 |
| 5 | `grep -c "^BEGIN;"` forward | 1 (expected 1) |
| 5b | `grep -c "^COMMIT;"` forward | 1 (expected 1) |
| 6 | `grep -c "^UPDATE "` forward | 0 (expected 0) |
| 7 | `grep -c "provision_account_for_new_user"` forward | 0 (expected 0) |

### Live application (PENDING — see Checkpoint below)

Post-application verification queries to run after migration is applied:

```sql
-- Confirm column shape
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name = 'cancel_at_period_end';
-- Expected: cancel_at_period_end | boolean | NO | false

-- Confirm DEFAULT FALSE backfill on all existing rows
SELECT cancel_at_period_end, COUNT(*) FROM accounts GROUP BY cancel_at_period_end;
-- Expected: false | N (where N = total accounts, currently 5 grandfathered + any new)
```

## Decisions Made

None new. Plan executed exactly as specified — column shape, name, default, nullability, and idempotency strategy all came directly from the plan (which inherited them from RESEARCH.md and the BILL-23 requirement).

## Deviations from Plan

None — plan executed exactly as written. Single ADD COLUMN, single COMMENT, matching rollback. No additional fixes or critical-functionality additions surfaced during execution.

## Authentication Gates

None — file creation only, no third-party CLI/API calls required.

## CHECKPOINT — Migration Application Required (Manual)

**Type:** human-action

**Reason:** The Supabase MCP tools (`mcp__claude_ai_Supabase__apply_migration` and `mcp__claude_ai_Supabase__execute_sql`) referenced in the plan are not available in this executor agent's tool set. The migration SQL is staged in the repo and ready to apply, but Andrew (or a future executor with MCP access) must apply it to production Supabase.

**What you need to do:**

**Option A — Supabase MCP (preferred, matches Phase 41 / 42.5 / Phase-43-UAT precedent):**

In a Claude session with the Supabase MCP server attached, call:

```
mcp__claude_ai_Supabase__apply_migration({
  name: "phase44_cancel_at_period_end",
  query: `ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.accounts.cancel_at_period_end IS
  'Mirror of Stripe subscription.cancel_at_period_end. Written by webhook on customer.subscription.{created,updated,deleted}. True = owner scheduled cancellation via Customer Portal; access continues until current_period_end. Phase 44-05 reads this for the amber cancel-scheduled Status Card variant.';`
})
```

(MCP wraps the call in its own transaction — outer `BEGIN; ... COMMIT;` are stripped from the body above.)

Then verify with:

```
mcp__claude_ai_Supabase__execute_sql({
  query: "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'cancel_at_period_end';"
})
```

Expected row: `cancel_at_period_end | boolean | NO | false`

And:

```
mcp__claude_ai_Supabase__execute_sql({
  query: "SELECT cancel_at_period_end, COUNT(*) FROM accounts GROUP BY cancel_at_period_end;"
})
```

Expected: `false | 5+` (and no `true` row yet — no webhook write has happened).

**Option B — Supabase Dashboard SQL editor (fallback):**

1. Open https://supabase.com/dashboard/project/<your-project>/sql/new
2. Paste the FULL forward migration file body (with outer `BEGIN;` and `COMMIT;`):

```sql
BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.accounts.cancel_at_period_end IS
  'Mirror of Stripe subscription.cancel_at_period_end. Written by webhook on customer.subscription.{created,updated,deleted}. True = owner scheduled cancellation via Customer Portal; access continues until current_period_end. Phase 44-05 reads this for the amber cancel-scheduled Status Card variant.';

COMMIT;
```

3. Click **Run**.
4. In the same editor, run the two verification queries above to confirm.

**Note on schema_migrations registry:** Option A (MCP `apply_migration`) registers the migration in `schema_migrations`. Option B (Dashboard SQL editor) does NOT — it perpetuates the existing tech debt where Phases 36/37/41 columns are in production but not registered. Prefer Option A.

## Notes for Downstream Plans

Once the migration is applied to production:

- **Plan 44-04 (webhook handler):** Can `UPDATE public.accounts SET cancel_at_period_end = $1 WHERE stripe_customer_id = $2` from `customer.subscription.{created,updated,deleted}` events. Source value is `Stripe.Subscription.cancel_at_period_end` (boolean, always present on the Subscription object — no null-guard needed).
- **Plan 44-05 (billing page):** Can include `cancel_at_period_end` in the `accounts` SELECT (alongside `subscription_status`, `plan_tier`, `current_period_end`, `trial_ends_at`) to drive the Status Card state machine. Specifically: when `subscription_status === 'active'` AND `cancel_at_period_end === true`, render the amber "cancel scheduled — access ends {current_period_end}" variant.
- **TypeScript types:** Supabase's generated `Database` type may need a regen (`npx supabase gen types typescript --linked > types/database.ts` or equivalent) after the migration is applied. Plans 44-04 and 44-05 can work around stale types via `Record<string, unknown>` casts on the update payload and via the broader Database type on `.select("cancel_at_period_end")`, which is how Phase 42.5-04 handled the `plan_tier` write before types caught up.

## Tech Debt Surfaced / Carried

- **Carried, not resolved here:** Production `schema_migrations` registry is out of sync (Phases 36/37/41 columns exist in DB but not in the registry; Phase 42.5 was registered via MCP during Phase 43 UAT). This plan's idempotent `ADD COLUMN IF NOT EXISTS` is the right shield against re-running risks, but a future cleanup plan should reconcile the registry by inserting the missing rows.
- **No new debt introduced.**
