---
phase: 46-andrew-ship-sign-off
plan: "46-01"
status: complete
completed: 2026-05-12
---

# Plan 46-01 SUMMARY — schema_migrations dormant-entry repair

## Outcome

**1 migration registered (Phase 41); 2 dormant entries SKIPPED per signature-absent rule (Phase 36, Phase 37).**

The CONTEXT.md locked decision rule — "only register entries whose columns are present in production" — produced a finer-grained result than the plan's expected dormant set. Phase 36 and Phase 37 migration files exist on disk and have no row in `schema_migrations`, but their signature columns are also absent from production — meaning the migration SQL was never run against the live DB (consistent with Phase 36/37's "framework shipped, live activation gated on PREREQ-03" status in STATE.md and ROADMAP.md). Registering them via `migration repair` would misrepresent production state by claiming the SQL was applied when it was not.

Phase 41 is the only Phase-36/37/41 file whose signature columns are present in production but whose row in `schema_migrations` was absent — i.e. the only genuinely "dormant" entry in scope. It was registered via `supabase migration repair --linked --status applied`.

No raw `INSERT INTO supabase_migrations.schema_migrations` SQL was run. No `supabase db push --linked` was run. The three pre-existing orphan rows (20251223162516, 20260419144234, 20260419144302) are untouched.

## Pre-Repair Dry-Run

### Migration files on disk (version prefixes)

```
20260419120000  initial_schema
20260419120001  rls_policies
20260424120000  event_types_soft_delete
20260425120000  account_availability_settings
20260426120000  account_owner_email
20260427120000  rate_limit_events
20260427120001  phase8_schema_additions
20260428120001  phase10_onboarding_columns
20260428120002  phase10_accounts_rls_and_trigger
20260428120003  phase10_email_send_log
20260428120004  phase10_slug_is_taken_fn
20260428120005  phase10_sync_account_email
20260428130001  phase11_capacity_columns
20260428130002  phase11_slot_index_and_concurrent_index
20260428130003  phase11_drop_old_double_book_index
20260429120000  phase12_branding_columns
20260429180000  phase12_5_chrome_tint_intensity
20260429200000  phase12_6_sidebar_color
20260502034300  v12_drop_deprecated_branding_columns
20260503120000  phase27_preflight_diagnostic
20260503120001  phase27_cross_event_exclude_constraint
20260503221744  v15_backfill_buffer_after_minutes
20260504004202  v15_drop_accounts_buffer_minutes
20260504130000  phase31_email_send_log_categories
20260504130001  phase31_bookings_confirmation_email_sent
20260505120000  phase32_wipe_legacy_custom_hours
20260506120000  phase34_account_oauth_credentials
20260506140000  phase35_email_send_log_account_id
20260507120000  phase36_resend_provider          ← in-scope per plan
20260508120000  phase37_last_upgrade_request_at  ← in-scope per plan
20260510120000  phase41_stripe_billing_foundation ← in-scope per plan
20260510130000  phase42_5_plan_tier
20260511120000  phase44_cancel_at_period_end
```

(`*_ROLLBACK.sql` companion files are not registered — they are rollback scripts, not forward migrations.)

### `supabase_migrations.schema_migrations` SELECT output (pre-repair)

```
version          | name
-----------------+------------------------------------
20251223162516   | (empty)                            ← pre-Phase-9 orphan
20260419144234   | initial_schema                     ← pre-Phase-9 orphan
20260419144302   | rls_policies                       ← pre-Phase-9 orphan
20260507235101   | phase34_account_oauth_credentials  ← registered, version doesn't match disk timestamp
20260507235106   | phase35_email_send_log_account_id  ← registered, version doesn't match disk timestamp
20260508010333   | phase35_temp_oauth_debug           ← in DB only (file not on disk)
20260511221203   | phase42_5_plan_tier                ← registered (Phase 43 UAT MCP apply)
20260511234934   | phase44_cancel_at_period_end       ← registered (Phase 44 MCP apply)
```

8 rows total.

### Orphans (do not touch)

Per RESEARCH.md §3 + FUTURE_DIRECTIONS.md §2:

- `20251223162516` (empty name)
- `20260419144234` (initial_schema)
- `20260419144302` (rls_policies)

All three remain in place post-repair. Verified by post-repair SELECT.

### In-scope dormant set (per CONTEXT.md — Phase 36/37/41 only)

Comparing the in-scope files against the SELECT output:

| Version       | File on disk?  | In `schema_migrations`? | Status               |
|---------------|----------------|--------------------------|----------------------|
| 20260507120000 | ✓ phase36_resend_provider          | ✗ absent | Candidate for signature check |
| 20260508120000 | ✓ phase37_last_upgrade_request_at  | ✗ absent | Candidate for signature check |
| 20260510120000 | ✓ phase41_stripe_billing_foundation | ✗ absent | Candidate for signature check |

Pre-Phase-36 files (Phase 10..35, etc.) and the post-Phase-41 files (42.5, 44) are out of scope per the plan's locked must_have:
> "every dormant Phase 36/37/41 migration file whose signature column(s)/table(s) are confirmed present in production"

The non-matching version timestamps for `phase34_*`, `phase35_email_send_log_account_id`, `phase42_5_plan_tier`, and `phase44_cancel_at_period_end` (DB version ≠ disk filename version) reflect MCP `apply_migration` generating a new timestamp at apply time. The migrations are correctly registered (signature columns/table all confirmed present in production by Phase 42.5, Phase 43, and Phase 44 prior verification work). They are NOT dormant; they are simply registered with re-stamped versions and are out of scope for this plan.

## Production-Column Signature Verification

### Phase 36 — `20260507120000_phase36_resend_provider.sql`

Migration adds three columns:
- `accounts.email_provider TEXT NOT NULL DEFAULT 'gmail' CHECK (IN ('gmail','resend'))`
- `accounts.resend_status TEXT NOT NULL DEFAULT 'active' CHECK (IN ('active','suspended'))`
- `email_send_log.provider TEXT NOT NULL DEFAULT 'gmail'`

Signature check via `information_schema.columns`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='email_send_log' AND column_name='provider';
-- result: 0 rows
```

Live `email_send_log` columns (full table): `id`, `sent_at`, `category`, `account_id`. **`provider` column ABSENT.**

Live `accounts` check for `email_provider` and `resend_status`: **ABSENT** (queried alongside Phase 37 check below).

**Decision: SKIP — Phase 36 migration was never applied to production.** Consistent with STATE.md "Phase 36: Framework completed; live activation requires PREREQ-03 (Resend domain DNS) per FUTURE_DIRECTIONS.md".

### Phase 37 — `20260508120000_phase37_last_upgrade_request_at.sql`

Migration adds one column:
- `accounts.last_upgrade_request_at TIMESTAMPTZ`

Signature check:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='accounts'
  AND column_name IN ('last_upgrade_request_at', 'email_provider', 'subscription_status', 'plan_tier', 'cancel_at_period_end', 'trial_warning_sent_at');
-- result: 4 rows — cancel_at_period_end, plan_tier, subscription_status, trial_warning_sent_at
-- last_upgrade_request_at and email_provider both ABSENT
```

**Decision: SKIP — Phase 37 migration was never applied to production.** Consistent with STATE.md "Phase 37: Framework completed; live Resend delivery requires PREREQ-03".

### Phase 41 — `20260510120000_phase41_stripe_billing_foundation.sql`

Migration adds 6 columns to `accounts` (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`, `current_period_end`, `plan_interval`) plus a new `stripe_webhook_events` table, plus trigger updates, plus grandfather backfill.

Signature check:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='accounts'
  AND column_name IN ('subscription_status','trial_ends_at','stripe_customer_id','stripe_subscription_id');
-- result: 4 rows (all 4 columns present)

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name='stripe_webhook_events';
-- result: 1 row (table present)
```

**Decision: REPAIR — Phase 41 migration was genuinely applied (likely via MCP `apply_migration` without registration).**

## Skipped Migrations (signature absent)

| Version | Filename | Missing signature | Reason for skip |
|---------|----------|-------------------|-----------------|
| 20260507120000 | phase36_resend_provider | `email_send_log.provider`, `accounts.email_provider`, `accounts.resend_status` | Migration not applied to production; framework-only code pending PREREQ-03 DNS |
| 20260508120000 | phase37_last_upgrade_request_at | `accounts.last_upgrade_request_at` | Migration not applied to production; framework-only code pending PREREQ-03 DNS |

Registering either via `supabase migration repair --status applied` would falsely assert the SQL ran, which would break a future `supabase db push --linked` reconciliation. Both files remain on disk; they will be applied to production at PREREQ-03 activation time (deferred to v1.9+ per FUTURE_DIRECTIONS.md).

## Repair Invocations

```bash
npx supabase migration repair 20260510120000 --linked --status applied
```

CLI output:
```
Initialising login role...
Connecting to remote database...
Repaired migration history: [20260510120000] => applied
Finished supabase migration repair.
```

No additional repair commands run.

## Post-Repair State

`supabase_migrations.schema_migrations` SELECT output (post-repair):

```
version          | name
-----------------+------------------------------------
20251223162516   | (empty)                            ← orphan, unchanged
20260419144234   | initial_schema                     ← orphan, unchanged
20260419144302   | rls_policies                       ← orphan, unchanged
20260507235101   | phase34_account_oauth_credentials  ← unchanged
20260507235106   | phase35_email_send_log_account_id  ← unchanged
20260508010333   | phase35_temp_oauth_debug           ← unchanged
20260510120000   | phase41_stripe_billing_foundation  ← NEW (this plan)
20260511221203   | phase42_5_plan_tier                ← unchanged
20260511234934   | phase44_cancel_at_period_end       ← unchanged
```

9 rows total (8 → 9). Phase 41 is the only addition. All other rows byte-identical to pre-repair state.

## Anomalies

None. The single `migration repair` invocation succeeded on first try with the expected CLI output. No CLI warnings, no errors, no unexpected schema_migrations writes.

## Verification (success criteria)

1. ✓ Every in-scope Phase 36/37/41 file on disk with signature columns present in production has a corresponding row in `schema_migrations` (Phase 41 only).
2. ✓ The 3 pre-existing orphan rows are untouched (verified by post-repair SELECT — `version` and `name` byte-identical to pre-repair).
3. ✓ This SUMMARY captures pre-repair output + signature checks + repair invocations + post-repair output as a complete audit trail.
4. ✓ No fix-on-failure sub-plan was opened — the single repair command succeeded cleanly.
5. ✓ No raw INSERT SQL was used.
6. ✓ No `supabase db push --linked` was run.

## Tech Debt Carried Forward to FUTURE_DIRECTIONS.md (Plan 46-04)

- Phase 36 + Phase 37 migration files exist on disk but are unapplied to production. They will be applied when PREREQ-03 (Resend DNS activation) completes. Until then, do NOT register them in `schema_migrations` and do NOT run `supabase db push --linked` (would attempt to re-apply the already-live Phase 41 SQL plus would freshly apply Phase 36/37 prematurely).
- The 3 pre-existing orphan rows (20251223162516, 20260419144234, 20260419144302) remain unresolved. They block clean `supabase db push --linked` per FUTURE_DIRECTIONS.md §2; locked workaround is `supabase db query --linked -f` for any future direct DB pushes (or continue using MCP `apply_migration`).
- Version-stamp drift: 4 entries in `schema_migrations` have a `version` that doesn't match their on-disk filename timestamp (`phase34_*` → 20260507235101 vs 20260506120000; etc.). This is MCP-apply behavior, not a bug. Both rows can be safely left as-is; the migrations are correctly registered.

## Commits

(Single commit covering this audit-trail file plus PLAN.md staging.)
