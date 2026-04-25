---
phase: 03-event-types-crud
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260424120000_event_types_soft_delete.sql
autonomous: true

must_haves:
  truths:
    - "event_types table has a nullable deleted_at timestamptz column (EVENT-03 enabling)"
    - "The original unique(account_id, slug) constraint is dropped and replaced with a partial unique index event_types_account_id_slug_active that enforces uniqueness only WHERE deleted_at IS NULL (EVENT-06 + restore-after-archive UX)"
    - "An archived event type's slug can be reused by a new active event type (run-time confirmable via SQL)"
    - "Migration is applied to the live Supabase project AND the SQL file is committed under supabase/migrations/ for portability (matches Phase 1 convention)"
  artifacts:
    - path: "supabase/migrations/20260424120000_event_types_soft_delete.sql"
      provides: "Idempotent migration: ADD COLUMN deleted_at, DROP CONSTRAINT event_types_account_id_slug_key, CREATE UNIQUE INDEX event_types_account_id_slug_active partial WHERE deleted_at IS NULL"
      contains: "event_types_account_id_slug_active"
      min_lines: 15
  key_links:
    - from: "supabase/migrations/20260424120000_event_types_soft_delete.sql"
      to: "Supabase project (live)"
      via: "Supabase MCP apply_migration"
      pattern: "apply_migration"
    - from: "Phase 3 Server Actions (Plan 03)"
      to: "event_types.deleted_at column"
      via: "soft-delete + restore writes; .is('deleted_at', null) reads"
      pattern: "deleted_at"
---

<objective>
Apply the Phase 3 schema migration that adds soft-delete capability to `event_types` and replaces the unique-slug-per-account constraint with a partial index that only enforces uniqueness among non-deleted rows. This is the foundational change every other Plan 03 plan depends on.

Purpose: The Phase 1 schema lacks `deleted_at` and the existing `unique(account_id, slug)` constraint covers archived rows too — which would block restoring an archived event type whose slug has been reused. Both issues are resolved in a single migration.

Output: A committed `supabase/migrations/20260424120000_event_types_soft_delete.sql` file applied to the live `Calendar` Supabase project. After this plan, soft-delete writes (`update event_types set deleted_at = now()`) succeed, and slug uniqueness is enforced among ACTIVE rows only.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-event-types-crud/03-CONTEXT.md
@.planning/phases/03-event-types-crud/03-RESEARCH.md

# Existing schema (the constraint we're replacing lives here)
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260419120001_rls_policies.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author the migration SQL file</name>
  <files>supabase/migrations/20260424120000_event_types_soft_delete.sql</files>
  <action>
Create `supabase/migrations/20260424120000_event_types_soft_delete.sql` with the SQL below verbatim. This is the canonical shape from RESEARCH §"Required Migration (Phase 3 owns this)".

```sql
-- Phase 3: Event Types CRUD — soft-delete column + partial unique index
--
-- Adds deleted_at to event_types and replaces the table's unique(account_id, slug)
-- constraint with a partial unique index that only enforces uniqueness among
-- NON-DELETED rows. Without the partial index, archiving an event type would
-- permanently block its slug from being reused — which breaks both:
--   (a) creating a new event type with the same name as an archived one
--   (b) restoring an archived event type when a new one has taken its slug
--       (the restore action would fail with a unique-violation 23505)
--
-- Idempotent: safe to re-run.

alter table event_types
  add column if not exists deleted_at timestamptz;

-- Drop the table-level unique constraint (covers ALL rows including archived).
-- Postgres auto-named it event_types_account_id_slug_key when the original
-- `unique(account_id, slug)` clause was declared inline in the CREATE TABLE.
alter table event_types
  drop constraint if exists event_types_account_id_slug_key;

-- Replace with a partial unique index — only non-deleted rows participate.
-- This is the load-bearing change for the restore UX.
create unique index if not exists event_types_account_id_slug_active
  on event_types(account_id, slug)
  where deleted_at is null;
```

Key rules:
- Migration filename uses Supabase's `YYYYMMDDHHMMSS_name.sql` convention. The timestamp `20260424120000` is the next slot after Phase 1's `20260419120001`. Use exactly this filename — do not regenerate the timestamp.
- All three statements use `if exists` / `if not exists` guards. The migration must be safely re-runnable in case Supabase MCP `apply_migration` records partial state.
- The constraint name `event_types_account_id_slug_key` is Postgres's default auto-name for an inline `unique(account_id, slug)` declaration. If `apply_migration` reports the constraint doesn't exist (e.g., Phase 1 named it something else), inspect the live schema via Supabase MCP `list_tables` or `execute_sql` (`SELECT conname FROM pg_constraint WHERE conrelid = 'event_types'::regclass`) and update the DROP statement accordingly. The `if exists` guard means a wrong name will silently succeed but leave the old constraint in place — verify the partial index is the ONLY active uniqueness check after apply.
- The new partial unique index is named `event_types_account_id_slug_active` (matches RESEARCH naming).
- Do NOT add RLS policy changes. Phase 1's existing `event_types` RLS policies (owner-scoped) already cover `deleted_at` reads and writes since `deleted_at` is just another column on rows the owner already owns.
- Do NOT add a CHECK constraint that requires `deleted_at IS NULL OR is_active = false`. CONTEXT.md does not require this coupling; an archived row can stay `is_active = true` in storage and the UI filters by `deleted_at IS NULL` to hide it.

DO NOT:
- Do not run `npx supabase db push` or any other CLI write — apply via Supabase MCP only (Phase 1/2 convention; STATE.md decision).
- Do not edit `20260419120000_initial_schema.sql` — that file is the historical record of Phase 1's schema; Phase 3 adds a NEW migration on top.
  </action>
  <verify>
```bash
# File exists at the right path with the right name
ls supabase/migrations/20260424120000_event_types_soft_delete.sql

# Contains the load-bearing pieces
grep -q "add column if not exists deleted_at timestamptz" supabase/migrations/20260424120000_event_types_soft_delete.sql && echo "deleted_at add ok"
grep -q "drop constraint if exists event_types_account_id_slug_key" supabase/migrations/20260424120000_event_types_soft_delete.sql && echo "drop constraint ok"
grep -q "create unique index if not exists event_types_account_id_slug_active" supabase/migrations/20260424120000_event_types_soft_delete.sql && echo "partial index ok"
grep -q "where deleted_at is null" supabase/migrations/20260424120000_event_types_soft_delete.sql && echo "partial predicate ok"
```
  </verify>
  <done>
File `supabase/migrations/20260424120000_event_types_soft_delete.sql` exists, contains the three idempotent statements (ADD COLUMN, DROP CONSTRAINT, CREATE UNIQUE INDEX with `WHERE deleted_at IS NULL`), and grep-verifies the four load-bearing fragments.

Commit: `feat(03-01): add event_types soft-delete migration`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply the migration via Supabase MCP and verify the partial index</name>
  <files>(no file changes — applies migration to live Supabase project)</files>
  <action>
Apply the migration to the live `Calendar` Supabase project (ref `mogfnutxrrbtvnaupoun`) using the Supabase MCP `apply_migration` tool. Pass:

- `name`: `event_types_soft_delete`
- `query`: the FULL contents of `supabase/migrations/20260424120000_event_types_soft_delete.sql`

If `apply_migration` is unavailable for any reason, fall back to the MCP `execute_sql` tool with the same SQL. Either path is acceptable — the SQL is idempotent and self-contained.

After apply, verify the live state with three follow-up MCP `execute_sql` queries:

1. **Confirm `deleted_at` column exists on `event_types`:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'event_types'
  AND column_name = 'deleted_at';
```
Expected: one row, `data_type = 'timestamp with time zone'`, `is_nullable = 'YES'`.

2. **Confirm the partial unique index exists with the correct predicate:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'event_types'
  AND indexname = 'event_types_account_id_slug_active';
```
Expected: one row, `indexdef` contains `WHERE (deleted_at IS NULL)`.

3. **Confirm the OLD table-level unique constraint is gone:**
```sql
SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.event_types'::regclass
  AND contype = 'u';
```
Expected: zero rows returned. (If `event_types_account_id_slug_key` still appears, the DROP didn't match the auto-name — inspect via the same query, edit the migration's DROP line to match the actual constraint name, re-apply, and re-verify.)

4. **Smoke-test slug reuse semantics** (the actual UX-critical behavior the partial index protects):
```sql
-- Insert a test event type, archive it, insert another with the same slug, then clean up.
-- Use the existing nsi account: ba8e712d-28b7-4071-b3d4-361fb6fb7a60
WITH ins1 AS (
  INSERT INTO event_types (account_id, slug, name, duration_minutes)
  VALUES ('ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'phase3-slug-test', 'Phase 3 Test', 15)
  RETURNING id
),
arc AS (
  UPDATE event_types
  SET deleted_at = now()
  WHERE slug = 'phase3-slug-test' AND account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  RETURNING id
),
ins2 AS (
  INSERT INTO event_types (account_id, slug, name, duration_minutes)
  VALUES ('ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'phase3-slug-test', 'Phase 3 Test 2', 15)
  RETURNING id
)
SELECT (SELECT count(*) FROM ins1) AS first_inserted,
       (SELECT count(*) FROM arc) AS archived,
       (SELECT count(*) FROM ins2) AS second_inserted_after_archive;
```
Expected: `first_inserted=1, archived=1, second_inserted_after_archive=1`. If `second_inserted_after_archive` raises a `23505 unique_violation`, the partial index didn't get created correctly — check the indexdef output from query #2.

Then **clean up** the test rows:
```sql
DELETE FROM event_types
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND slug = 'phase3-slug-test';
```

Document the verified results in the SUMMARY: column shape, index def, smoke test pass.

Key rules:
- Apply via Supabase MCP only (Phase 1/2 convention).
- The smoke test uses the seeded `nsi` account UUID `ba8e712d-28b7-4071-b3d4-361fb6fb7a60` — confirmed in STATE.md "Live Resources".
- The CTE smoke test runs all three writes in a single transaction so the cleanup is straightforward; if the second insert fails, the entire CTE rolls back and there's nothing to clean up.
- If verification query #3 returns `event_types_account_id_slug_key` still present, the DROP statement in Task 1 needs the correct constraint name — re-edit, commit a Task 1 fix, re-apply.

DO NOT:
- Do not commit a snapshot of the live schema — only the migration file is committed.
- Do not run the smoke test against any account other than `nsi` (`ba8e712d-28b7-4071-b3d4-361fb6fb7a60`).
- Do not skip the cleanup DELETE — leftover `phase3-slug-test` rows would clutter Andrew's real list view.
  </action>
  <verify>
The four MCP queries above ARE the verification — each must return the expected shape. After all four pass and the cleanup DELETE succeeds, the migration is verified.

In addition:
```bash
# Migration file is committed
git log --oneline -1 supabase/migrations/20260424120000_event_types_soft_delete.sql && echo "migration committed"
```
  </verify>
  <done>
Migration is applied to the live Supabase project. Verification queries confirm: (1) `deleted_at timestamptz NULL` column exists on `event_types`, (2) `event_types_account_id_slug_active` partial unique index exists with `WHERE (deleted_at IS NULL)` predicate, (3) no other unique constraint exists on `event_types`, (4) the slug-reuse smoke test passed (insert → archive → re-insert with same slug all succeeded), and (5) the test rows were cleaned up.

Commit: `chore(03-01): apply event_types soft-delete migration to live project`. Push.

Note: This commit may be empty (the migration file was already committed in Task 1). If so, just record the apply event in the SUMMARY without a separate commit.
  </done>
</task>

</tasks>

<verification>
```bash
# Migration file exists and is committed
ls supabase/migrations/20260424120000_event_types_soft_delete.sql
git log --oneline -1 supabase/migrations/20260424120000_event_types_soft_delete.sql

# Existing tests still green (no regression on RLS / race / auth tests from Phases 1+2)
npm test
```

The MCP-based verification queries from Task 2 are the source of truth that the migration was actually applied. The shell `ls` + `git log` only confirm the artifact's local state.
</verification>

<success_criteria>
- [ ] `supabase/migrations/20260424120000_event_types_soft_delete.sql` exists, idempotent (uses `if exists` / `if not exists` guards), and committed
- [ ] Migration applied to live Supabase project via MCP `apply_migration` (or `execute_sql` fallback)
- [ ] `event_types.deleted_at timestamptz NULL` column exists on the live table (verified via `information_schema.columns`)
- [ ] `event_types_account_id_slug_active` partial unique index exists with `WHERE (deleted_at IS NULL)` predicate (verified via `pg_indexes`)
- [ ] No other unique constraint on `event_types` (the original `event_types_account_id_slug_key` is gone — verified via `pg_constraint`)
- [ ] Slug-reuse smoke test passes: insert → archive → re-insert with same slug all succeed inside a single CTE transaction
- [ ] Test rows cleaned up from `event_types`
- [ ] Existing Vitest suite (race-guard, RLS lockout, authenticated-owner) still green
- [ ] Each task committed atomically (1–2 commits)
</success_criteria>

<output>
After completion, create `.planning/phases/03-event-types-crud/03-01-SUMMARY.md` documenting:
- Final migration filename + apply timestamp
- Confirmed `deleted_at` column shape (`timestamp with time zone`, NULLABLE)
- Confirmed partial index `indexdef` (full text from `pg_indexes`)
- Result of slug-reuse smoke test (all three counts)
- Whether the auto-named constraint `event_types_account_id_slug_key` was the actual name dropped, or whether the live schema had a different constraint name (and what action was taken)
- Any deviation from RESEARCH §"Required Migration"
</output>
</content>
</invoke>