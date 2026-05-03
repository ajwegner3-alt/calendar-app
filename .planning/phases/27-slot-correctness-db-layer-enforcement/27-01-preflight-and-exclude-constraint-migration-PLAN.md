---
phase: 27-slot-correctness-db-layer-enforcement
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql
  - supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql
  - supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql
autonomous: false  # has checkpoint:human-verify gate after pre-flight diagnostic
must_haves:
  truths:
    - "Pre-flight diagnostic SQL has been executed against production and returned zero overlapping confirmed-booking rows (or Andrew has manually resolved non-zero rows before proceeding)."
    - "btree_gist extension exists in production schema."
    - "bookings table has a generated column `during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED`."
    - "EXCLUDE constraint `bookings_no_account_cross_event_overlap` exists on bookings with operators (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = 'confirmed')."
    - "A reverse-SQL rollback file exists in the migrations directory and is paste-runnable."
    - "Production row count of bookings is documented in PLAN execution output and the chosen migration path (single-step vs NOT VALID + VALIDATE) is justified by the count vs the 10k threshold."
  artifacts:
    - path: "supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql"
      provides: "Read-only diagnostic that returns zero rows IFF no cross-event overlapping confirmed bookings exist on any account."
      contains: "WHERE b1.status = 'confirmed' AND b2.status = 'confirmed'"
    - path: "supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql"
      provides: "Forward migration: btree_gist extension, during generated column, EXCLUDE constraint."
      contains: "EXCLUDE USING gist"
    - path: "supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql"
      provides: "Reverse SQL: DROP CONSTRAINT, DROP COLUMN, leave btree_gist extension in place (low-cost, may be reused)."
      contains: "DROP CONSTRAINT"
  key_links:
    - from: "Pre-flight diagnostic (Task 1)"
      to: "Migration apply decision (Task 3)"
      via: "Hard gate — non-zero rows = HALT and surface to Andrew, do NOT auto-cancel"
      pattern: "checkpoint:human-verify between Task 1 and Task 3"
    - from: "Production bookings row count"
      to: "Migration form choice"
      via: "<10k → single-step ADD CONSTRAINT; ≥10k → ADD CONSTRAINT NOT VALID + separate VALIDATE CONSTRAINT"
      pattern: "Documented in plan execution output before Task 3 runs"
---

<objective>
Establish the database-layer cross-event overlap invariant with maximum migration safety.

Purpose: Phase 27 success depends entirely on this constraint existing in production. SLOT-01..05 all collapse if the EXCLUDE constraint is missing or wrong. The pre-flight diagnostic is a HARD GATE (V14-CP-06) — `VALIDATE CONSTRAINT` will abort if any cross-event confirmed-booking overlaps already exist, leaving the migration in an unrecoverable partial-state. The diagnostic must run, return zero rows (or have its non-zero rows manually resolved by Andrew), BEFORE any DDL is applied.

Output:
- 1 read-only diagnostic SQL file (Task 1)
- 1 forward migration SQL file (Task 3)
- 1 reverse-SQL rollback file (Task 3)
- A documented row-count + chosen migration path (single-step vs NOT VALID two-step)
- A live production migration applied via `echo | npx supabase db query --linked -f <file>` (V14-MP-LOCKED)
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/27-slot-correctness-db-layer-enforcement/27-CONTEXT.md
@.planning/research/PITFALLS.md

# Existing partial-unique index that handles same-event-type capacity (DO NOT modify)
@supabase/migrations/20260428130002_phase11_slot_index_and_concurrent_index.sql

# Apply path reference — supabase db push --linked is broken; use db query --linked -f
# (This is documented in STATE.md "Migration apply path locked".)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author pre-flight diagnostic SQL + capture production row count</name>
  <files>supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql</files>
  <action>
    Create a NEW read-only SQL file that does two things in a single execution:

    (A) Returns the count of rows in the `bookings` table (informational; needed to choose migration form in Task 3). Use `SELECT COUNT(*) AS bookings_total FROM bookings;`.

    (B) Returns every pair of confirmed-status overlapping bookings on the same account but different event types. Schema:

    ```sql
    -- Pre-flight diagnostic for Phase 27 EXCLUDE constraint.
    -- This file is READ-ONLY — no writes, no DDL.
    -- Run with: echo | npx supabase db query --linked -f <this file>
    --
    -- Expected outcome: zero rows in the second query.
    -- If non-zero rows: HALT. Surface rows to Andrew for manual review/resolution.
    -- Do NOT auto-cancel bookings programmatically (V14-CP-06).

    -- (A) Informational: total row count for migration-form decision.
    SELECT COUNT(*) AS bookings_total FROM bookings;

    -- (B) Hard gate: cross-event confirmed-booking overlaps.
    SELECT
      b1.id           AS booking_a_id,
      b1.event_type_id AS event_type_a,
      b1.start_at     AS a_start,
      b1.end_at       AS a_end,
      b2.id           AS booking_b_id,
      b2.event_type_id AS event_type_b,
      b2.start_at     AS b_start,
      b2.end_at       AS b_end,
      b1.account_id
    FROM bookings b1
    JOIN bookings b2
      ON b1.account_id = b2.account_id
     AND b1.event_type_id <> b2.event_type_id
     AND b1.id < b2.id    -- avoid duplicate (a,b) and (b,a) reporting
     AND tstzrange(b1.start_at, b1.end_at, '[)') &&
         tstzrange(b2.start_at, b2.end_at, '[)')
    WHERE b1.status = 'confirmed'
      AND b2.status = 'confirmed'
    ORDER BY b1.account_id, b1.start_at;
    ```

    WHY this exact form:
    - `b1.id < b2.id` prevents reporting (a,b) and (b,a) twice.
    - `tstzrange(..., '[)')` matches the EXCLUDE constraint's range bound exactly (V14-CP-02).
    - Both `status = 'confirmed'` filters mirror the partial WHERE on the constraint (V14-CP-03) so the diagnostic catches exactly the rows that would later abort `VALIDATE CONSTRAINT`.

    Then EXECUTE the file against production:

    ```bash
    echo | npx supabase db query --linked -f supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql
    ```

    Capture both outputs (row count + diagnostic rows) into the plan execution log. Document the row count explicitly — it gates Task 3's migration form choice.
  </action>
  <verify>
    - File exists at the specified path and contains both SELECT statements.
    - `echo | npx supabase db query --linked -f supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql` runs without error and returns two result sets.
    - The bookings_total count is captured in the execution log.
    - The cross-event overlap result set is captured in the execution log (whether 0 rows or N rows).
  </verify>
  <done>
    Diagnostic file is committed, has been executed against production, and both result sets (row count + overlap rows) are visible in the execution output. The next task can branch on whether overlap rows are zero or non-zero.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: Pre-flight gate — confirm zero overlap rows OR resolve non-zero rows manually</name>
  <what-built>
    Task 1 ran the pre-flight diagnostic against production. Two result sets were produced:
    1. `bookings_total` — current row count (drives migration-form choice in Task 3).
    2. Cross-event overlap rows — pairs of confirmed bookings that would abort the EXCLUDE constraint if it existed today.
  </what-built>
  <how-to-verify>
    Andrew, please review the diagnostic output captured in the execution log above:

    1. **Confirm `bookings_total` count is recorded.** Note it for Task 3's migration-form choice. (<10k → single-step ADD CONSTRAINT; ≥10k → NOT VALID + VALIDATE CONSTRAINT two-step.)

    2. **Inspect the cross-event overlap result set:**
       - **If zero rows returned:** Type `proceed` to advance to Task 3 (migration apply).
       - **If one or more rows returned:** STOP. Each row is a real cross-event collision in production data. Options for resolution (you choose):
         - (a) Manually cancel one of the conflicting bookings via the dashboard (sets `status='cancelled'`, removes it from the constraint's WHERE clause).
         - (b) Manually reschedule one of the bookings to a non-conflicting time.
         - (c) Investigate the data (these are real customer impacts) before doing anything.

         Once resolved, re-run the diagnostic file (`echo | npx supabase db query --linked -f supabase/migrations/20260503120000_phase27_preflight_diagnostic.sql`) and confirm the second result set is empty. THEN type `proceed`.

       - **If you want to abort the phase entirely:** Type `abort` and we'll roll back to the prior commit.

    DO NOT have Claude run any auto-cancel SQL. The decision of which booking to cancel/reschedule/leave is a customer-impact call that belongs to you.
  </how-to-verify>
  <resume-signal>Type `proceed` (zero overlaps confirmed or manually resolved) or `abort` (halt phase).</resume-signal>
</task>

<task type="auto">
  <name>Task 2: Author forward migration + rollback SQL based on row-count decision</name>
  <files>
    supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql
    supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql
  </files>
  <action>
    Read the `bookings_total` value captured by Task 1's execution log. Choose migration form based on threshold:

    - **If `bookings_total < 10000`:** Use the SINGLE-STEP `ADD CONSTRAINT` form (immediate validation, ACCESS EXCLUSIVE lock for short duration on small table — acceptable).
    - **If `bookings_total >= 10000`:** Use the TWO-STEP form (`ADD CONSTRAINT ... NOT VALID` + separate `VALIDATE CONSTRAINT`). NOT VALID skips backfill validation (fast, brief lock); VALIDATE CONSTRAINT does the full table scan with a SHARE UPDATE EXCLUSIVE lock that does not block reads/writes.

    Document the chosen path in a SQL comment at the top of the migration.

    **Forward migration file** (`20260503120001_phase27_cross_event_exclude_constraint.sql`):

    ```sql
    -- Phase 27: Account-scoped cross-event-type overlap EXCLUDE constraint.
    --
    -- Pre-flight diagnostic (file 20260503120000_phase27_preflight_diagnostic.sql)
    -- MUST have returned zero overlap rows before this migration runs (V14-CP-06).
    --
    -- bookings_total at migration time: <FILL IN ACTUAL COUNT FROM TASK 1>
    -- Chosen path: <single-step | NOT VALID + VALIDATE> based on <10k threshold.
    --
    -- Apply with: echo | npx supabase db query --linked -f <this file>
    -- Rollback:  see *_ROLLBACK.sql in the same directory.
    --
    -- DDL operations (in this exact order — see V14-CP-01..04):
    --   1. CREATE EXTENSION IF NOT EXISTS btree_gist;        -- V14-CP-01: required for UUID equality in gist
    --   2. ADD COLUMN during tstzrange GENERATED ...;        -- V14-CP-02: half-open '[)' for adjacent-slot safety
    --   3. ADD CONSTRAINT ... EXCLUDE USING gist ... WHERE;  -- V14-CP-03 + V14-CP-04: WHERE confirmed; <> on event_type_id

    BEGIN;

    -- Step 1: Required extension for UUID equality in gist index (V14-CP-01).
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    -- Step 2: Generated column expressing the booking interval as a tstzrange.
    -- Half-open [) makes 9:00–9:30 and 9:30–10:00 NON-overlapping (V14-CP-02).
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS during tstzrange
        GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED;

    -- Step 3: EXCLUDE constraint.
    -- (account_id =) AND (event_type_id <>) AND (during &&) WHERE confirmed.
    --   - account_id WITH =       : same account
    --   - event_type_id WITH <>   : DIFFERENT event types only — preserves group-booking capacity (V14-CP-04)
    --   - during WITH &&          : intervals overlap
    --   - WHERE status='confirmed': cancelled rows do NOT block (V14-CP-03)

    -- IF SINGLE-STEP (bookings_total < 10000):
    ALTER TABLE bookings
      ADD CONSTRAINT bookings_no_account_cross_event_overlap
      EXCLUDE USING gist (
        account_id     WITH =,
        event_type_id  WITH <>,
        during         WITH &&
      ) WHERE (status = 'confirmed');

    -- IF TWO-STEP (bookings_total >= 10000), USE THIS BLOCK INSTEAD OF THE ABOVE:
    -- ALTER TABLE bookings
    --   ADD CONSTRAINT bookings_no_account_cross_event_overlap
    --   EXCLUDE USING gist (
    --     account_id     WITH =,
    --     event_type_id  WITH <>,
    --     during         WITH &&
    --   ) WHERE (status = 'confirmed') NOT VALID;
    --
    -- COMMIT;
    -- BEGIN;  -- VALIDATE in a separate transaction so the brief NOT VALID lock releases
    --
    -- ALTER TABLE bookings
    --   VALIDATE CONSTRAINT bookings_no_account_cross_event_overlap;

    COMMIT;
    ```

    KEEP only the chosen branch in the actual file (delete the other branch's commented lines so the file is unambiguous).

    **Rollback file** (`20260503120001_phase27_cross_event_exclude_constraint_ROLLBACK.sql`):

    ```sql
    -- Phase 27 rollback: drop EXCLUDE constraint + generated column.
    --
    -- Apply with: echo | npx supabase db query --linked -f <this file>
    --
    -- We do NOT drop the btree_gist extension — it is harmless to leave installed
    -- and may be reused by future constraints. If you absolutely need to remove it:
    --   DROP EXTENSION IF EXISTS btree_gist;
    -- (This will fail if any other index depends on it.)

    BEGIN;

    ALTER TABLE bookings
      DROP CONSTRAINT IF EXISTS bookings_no_account_cross_event_overlap;

    ALTER TABLE bookings
      DROP COLUMN IF EXISTS during;

    COMMIT;
    ```

    DO NOT execute either file yet. Task 3 applies the forward migration.
  </action>
  <verify>
    - Both files exist at the specified paths.
    - The forward migration file references the actual `bookings_total` from Task 1 and documents the chosen migration form.
    - The forward migration file contains exactly one of: single-step `ADD CONSTRAINT ... EXCLUDE ...` (no NOT VALID), OR `ADD CONSTRAINT ... NOT VALID;` followed by `VALIDATE CONSTRAINT` in a separate BEGIN/COMMIT block.
    - The rollback file contains `DROP CONSTRAINT IF EXISTS bookings_no_account_cross_event_overlap;` and `DROP COLUMN IF EXISTS during;`.
    - Both files end with `COMMIT;`.
  </verify>
  <done>
    Forward migration + rollback SQL files are written, ready to apply, and the row-count-driven path choice is documented in the migration's header comment.
  </done>
</task>

<task type="auto">
  <name>Task 3: Apply forward migration to production + verify constraint exists</name>
  <files>(no new files — applies the migration written in Task 2)</files>
  <action>
    Apply the forward migration to production via the locked apply path:

    ```bash
    echo | npx supabase db query --linked -f supabase/migrations/20260503120001_phase27_cross_event_exclude_constraint.sql
    ```

    Capture full stdout/stderr in the execution log. The output should show:
    - `CREATE EXTENSION` (or no-op message if btree_gist already exists)
    - `ALTER TABLE` for the ADD COLUMN
    - `ALTER TABLE` for the ADD CONSTRAINT
    - `COMMIT`

    Then verify the constraint exists by querying `pg_constraint`:

    ```bash
    echo "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bookings_no_account_cross_event_overlap';" | npx supabase db query --linked
    ```

    Expected output: one row showing the constraint name and full definition including `EXCLUDE USING gist`, `account_id WITH =`, `event_type_id WITH <>`, `during WITH &&`, and `WHERE (status = 'confirmed')`.

    Also verify the generated column exists:

    ```bash
    echo "SELECT column_name, data_type, generation_expression FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'during';" | npx supabase db query --linked
    ```

    Expected: one row, `data_type` = `tstzrange`, `generation_expression` contains `tstzrange(start_at, end_at, '[)')` (or equivalent normalized form).

    **If apply fails:** capture the error, run the rollback file, surface the error to Andrew. Do NOT proceed to Plan 27-02 until the constraint is verified present.
  </action>
  <verify>
    - Migration apply command exits with status 0.
    - `pg_constraint` query returns exactly one row for `bookings_no_account_cross_event_overlap`.
    - `information_schema.columns` query confirms `during` column exists with `tstzrange` type.
    - The full `pg_get_constraintdef` output is captured in the execution log so the SUMMARY can quote it verbatim for the goal-backward verifier.
  </verify>
  <done>
    Constraint `bookings_no_account_cross_event_overlap` exists in production with the correct definition, generated column `during` exists, and Plan 27-02 may proceed to wire up application-layer error mapping.
  </done>
</task>

</tasks>

<verification>
- Pre-flight diagnostic file exists, has been executed against production, and overlap result set was zero rows (or non-zero rows were manually resolved by Andrew before proceeding).
- Forward migration file exists with row-count-justified migration form (single-step vs NOT VALID two-step).
- Rollback SQL file exists in the migrations directory.
- `pg_constraint` query confirms `bookings_no_account_cross_event_overlap` is present in production with operators `(account_id =, event_type_id <>, during &&)` and partial WHERE `status = 'confirmed'`.
- Generated column `during` exists on `bookings` with `tstzrange` type and `[)` bound expression.
- Test suite still has 224 passing + 4 skipped at the close of this plan (no app code changed; constraint should be invisible to existing tests because none of them exercise cross-event overlap).
</verification>

<success_criteria>
The database now enforces the contractor-can't-be-in-two-places-at-once invariant at the constraint level. Any INSERT (or UPDATE in place) that would create a cross-event overlap on the same `account_id` while both rows are `status='confirmed'` will raise Postgres error code `23P01` (exclusion_violation). Plan 27-02 will catch and map this error code to the user-facing 409 response.
</success_criteria>

<output>
After completion, create `.planning/phases/27-slot-correctness-db-layer-enforcement/27-01-SUMMARY.md` documenting:
- Production `bookings_total` row count at migration time
- Chosen migration form (single-step vs NOT VALID two-step) and justification
- Pre-flight diagnostic outcome (zero rows confirmed, or detail of manually resolved rows)
- Full `pg_get_constraintdef` output for `bookings_no_account_cross_event_overlap`
- Confirmation that `during` generated column exists
- Path to forward migration + rollback files
- Any unexpected output from the apply command
</output>
