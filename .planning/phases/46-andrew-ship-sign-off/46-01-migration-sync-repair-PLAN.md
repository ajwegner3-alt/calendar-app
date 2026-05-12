---
phase: 46-andrew-ship-sign-off
plan: "46-01"
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "`supabase_migrations.schema_migrations` contains `version` rows for every dormant Phase 36/37/41 migration file whose signature column(s)/table(s) are confirmed present in production"
    - "Any migration whose signature column(s)/table(s) are ABSENT in production is SKIPPED (not registered) and documented in `## Skipped Migrations (signature absent)` of 46-01-SUMMARY.md"
    - "No existing `schema_migrations` row is modified, duplicated, or deleted (additive-only repair)"
    - "The three pre-existing orphan rows (20251223162516, 20260419144234, 20260419144302) remain untouched"
    - "Post-repair SELECT shows every `supabase/migrations/*.sql` filename's version prefix that passed the signature check is present in `schema_migrations`, with the exception of any newer file the planner did not target"
  artifacts:
    - path: ".planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md"
      provides: "Audit log of pre-repair SELECT output, the exact `supabase migration repair` invocations run, and post-repair SELECT output"
      contains: "version"
  key_links:
    - from: "supabase/migrations/20260507120000_phase36_resend_provider.sql"
      to: "supabase_migrations.schema_migrations row with version=20260507120000"
      via: "`supabase migration repair 20260507120000 --linked --status applied`"
      pattern: "20260507120000"
    - from: "supabase/migrations/20260508120000_phase37_last_upgrade_request_at.sql"
      to: "supabase_migrations.schema_migrations row with version=20260508120000"
      via: "`supabase migration repair 20260508120000 --linked --status applied`"
      pattern: "20260508120000"
    - from: "supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql"
      to: "supabase_migrations.schema_migrations row with version=20260510120000"
      via: "`supabase migration repair 20260510120000 --linked --status applied`"
      pattern: "20260510120000"
---

<objective>
Register the dormant `schema_migrations` entries for migration files that were applied to production via Supabase MCP `apply_migration` rather than `supabase db push`. Phases 36, 37, and 41 are confirmed dormant from RESEARCH.md §3. Additional dormant entries (e.g., Phase 42.5, Phase 44) are surfaced by a SELECT-first dry-run and repaired if absent. This closes tech debt before v1.8 archival/tag and makes future migration tooling reliable.

Purpose: Prevent any future `supabase db push --linked` (or migration list reconciliation) from re-running already-applied SQL and erroring on "column already exists." Required pre-tag hygiene per CONTEXT.md.

Output: A cleaned `schema_migrations` table on the live Supabase project, plus a `46-01-SUMMARY.md` audit log documenting the dry-run, the repair invocations, and the post-repair state.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/46-andrew-ship-sign-off/46-CONTEXT.md
@.planning/phases/46-andrew-ship-sign-off/46-RESEARCH.md

@FUTURE_DIRECTIONS.md
@supabase/migrations/
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dry-run SELECT against schema_migrations and identify dormant versions</name>
  <files>(read-only: supabase/migrations/*.sql, supabase_migrations.schema_migrations via MCP)</files>
  <action>
Step 1 — list every migration file on disk:

```bash
ls supabase/migrations/*.sql
```

Capture the timestamp prefix (the first 14 digits before the underscore) of each file. These are the `version` values that should exist in `supabase_migrations.schema_migrations`.

Step 2 — run the dry-run SELECT via Supabase MCP `execute_sql` against the production project:

```sql
SELECT version, name, created_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Step 3 — diff the two lists in your head:
- For each file's version on disk, check if that version appears in the SELECT output.
- A version that is ON DISK but ABSENT from the SELECT result is a "dormant" entry that needs repair.
- A version that is in the SELECT result but has NO corresponding file is an "orphan" (the 3 known orphans `20251223162516`, `20260419144234`, `20260419144302` per RESEARCH.md §3 + FUTURE_DIRECTIONS.md §2). DO NOT TOUCH ORPHANS.

Step 4 — Record the full dry-run output and the computed "to-repair" version list verbatim into `.planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md` under a `## Pre-Repair Dry-Run` heading. This is the audit trail.

Expected dormant versions per RESEARCH.md §3 (confirmation, not assumption):
- `20260507120000` (phase36_resend_provider)
- `20260508120000` (phase37_last_upgrade_request_at)
- `20260510120000` (phase41_stripe_billing_foundation)

If the SELECT shows additional dormant versions (e.g., Phase 42.5, 42.6, 43, 44 migrations), include them in the to-repair list. If the SELECT shows that some of the three above are ALREADY registered (unexpected), exclude them from the to-repair list.

If the SELECT shows ZERO dormant entries (everything already registered): record that finding in 46-01-SUMMARY.md and skip Task 2. The plan is complete.

Step 5 — **Production-column signature verification (CONTEXT.md decision: "only register entries whose columns are present in production").** For each version on the to-repair list, query `information_schema.columns` (and `information_schema.tables` where relevant) via Supabase MCP `execute_sql` to confirm the migration's signature column(s)/table(s) actually exist in production. This proves the migration was genuinely applied (just unrecorded) rather than skipped entirely.

Per-version signature checks:

- **`20260507120000` (phase36_resend_provider):** confirm `email_send_log.provider` column exists.
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='email_send_log' AND column_name='provider';
  ```

- **`20260508120000` (phase37_last_upgrade_request_at):** open `supabase/migrations/20260508120000_phase37_last_upgrade_request_at.sql` to read the exact added column name (it adds `accounts.last_upgrade_request_at` based on filename, but VERIFY by reading the migration file's `ALTER TABLE ... ADD COLUMN` statement). Then:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='accounts' AND column_name='<actual_column_from_migration>';
  ```

- **`20260510120000` (phase41_stripe_billing_foundation):** confirm key signature columns/tables exist:
  ```sql
  -- accounts billing columns
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='accounts'
    AND column_name IN ('subscription_status','trial_ends_at','stripe_customer_id','stripe_subscription_id');
  -- expect 4 rows
  
  -- stripe_webhook_events table
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name='stripe_webhook_events';
  -- expect 1 row
  ```

- **Any additional dormant version surfaced by Task 1 Step 3:** read its migration file to identify the signature column(s)/table(s) and run an equivalent `information_schema` check.

**Decision rule (LOCKED from CONTEXT.md):**
- Signature column(s)/table(s) PRESENT → migration was genuinely applied; KEEP on the to-repair list.
- Signature column(s)/table(s) ABSENT → migration was genuinely NOT applied; SKIP and record a `## Skipped Migrations (signature absent)` section in 46-01-SUMMARY.md naming each skipped version + the missing signature. Do NOT register via `supabase migration repair` — registering would misrepresent state.

Record the full signature-check output (per version) in 46-01-SUMMARY.md under a `## Production-Column Signature Verification` section before Task 2 runs.
  </action>
  <verify>
46-01-SUMMARY.md exists with:
- A `## Pre-Repair Dry-Run` section containing the raw SELECT output
- A "to-repair" version list (may be empty)
- An "orphans (do not touch)" list containing exactly the three pre-existing orphans (if they are still present)
- A `## Production-Column Signature Verification` section with per-version `information_schema` query output
- (If any version's signature was absent) A `## Skipped Migrations (signature absent)` section naming each skipped version and the missing column/table
  </verify>
  <done>
The to-repair list is finalized, sourced from real SELECT output, with no version touched unless (a) confirmed absent from `schema_migrations`, (b) confirmed present as a file on disk, AND (c) signature column(s)/table(s) confirmed present in production via `information_schema`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Run `supabase migration repair` for each confirmed dormant version, then verify</name>
  <files>(modifies remote DB only; no local files except 46-01-SUMMARY.md audit log)</files>
  <action>
For each version in the to-repair list from Task 1, run the canonical Supabase CLI command:

```bash
npx supabase migration repair {VERSION} --linked --status applied
```

For the three expected versions from RESEARCH.md §3:

```bash
npx supabase migration repair 20260507120000 --linked --status applied
npx supabase migration repair 20260508120000 --linked --status applied
npx supabase migration repair 20260510120000 --linked --status applied
```

If Task 1 surfaced additional dormant versions (e.g., Phase 42.5/42.6/43/44 entries), repair each one with the same pattern.

DO NOT:
- Run raw `INSERT INTO supabase_migrations.schema_migrations ...` SQL. Use `migration repair` exclusively (RESEARCH.md §3 + Pitfall 3).
- Run `supabase db push --linked` afterward. It is locked-broken per FUTURE_DIRECTIONS.md §2 and would attempt to re-apply already-live SQL (Pitfall 4).
- Touch the three pre-existing orphan rows.

After all repair commands complete, re-run the dry-run SELECT via Supabase MCP `execute_sql`:

```sql
SELECT version, name, created_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Append the post-repair output to 46-01-SUMMARY.md under `## Post-Repair State`. Confirm:
- Every version from the to-repair list now appears in the output.
- The three pre-existing orphans are unchanged.
- No other rows changed.

Record any unexpected output (e.g., `migration repair` returned a CLI error for a version) in a `## Anomalies` section. If any repair failed, do NOT proceed to Phase 46 archival/tag steps; flag the anomaly for resolution.
  </action>
  <verify>
Post-repair SELECT output in 46-01-SUMMARY.md shows every targeted dormant version is now present. The three pre-existing orphans are still present with unchanged `created_at` timestamps. Any repair error is logged under `## Anomalies`.
  </verify>
  <done>
The live `schema_migrations` table contains rows for every dormant Phase 36/37/41 (and any additional discovered dormant) migration file, with no destructive changes to pre-existing rows.
  </done>
</task>

</tasks>

<verification>
- The SELECT-first protocol was followed (no `migration repair` run until dormant set was confirmed).
- No raw INSERT SQL was used against `schema_migrations`.
- No `supabase db push --linked` was run.
- The three pre-existing orphan rows are untouched.
- 46-01-SUMMARY.md captures pre-repair output + repair invocations + post-repair output for audit.
</verification>

<success_criteria>
1. Every migration file on disk for Phases 36/37/41 (and any other phase whose migration was applied via MCP) has a corresponding row in `supabase_migrations.schema_migrations`.
2. The known pre-existing orphan rows are untouched.
3. 46-01-SUMMARY.md is a complete audit trail.
4. No new fix-on-failure sub-plans were opened (if a repair failed, the plan halts and the failure is logged for Andrew).
</success_criteria>

<output>
After completion, create `.planning/phases/46-andrew-ship-sign-off/46-01-SUMMARY.md` per the GSD summary template, embedding the dry-run output, the repair commands run, and the post-repair output as evidence.
</output>
