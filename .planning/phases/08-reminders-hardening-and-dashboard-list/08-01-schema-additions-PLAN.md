---
phase: 08-reminders-hardening-and-dashboard-list
plan: "08-01"
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260427120001_phase8_schema_additions.sql
autonomous: true

must_haves:
  truths:
    - "Database has accounts.reminder_include_custom_answers / reminder_include_location / reminder_include_lifecycle_links boolean columns, all defaulting true"
    - "Database has event_types.location text column (nullable)"
    - "Database has bookings.owner_note text column (nullable)"
    - "Existing rows pre-populated with default values (toggles=true, location/owner_note=NULL) — no NOT NULL violations on existing data"
    - "supabase db push --linked applies cleanly against the live remote DB"
  artifacts:
    - path: "supabase/migrations/20260427120001_phase8_schema_additions.sql"
      provides: "Phase 8 schema additions: account reminder toggles, event_type location, booking owner_note"
      contains: "ALTER TABLE accounts"
  key_links:
    - from: "supabase/migrations/20260427120001_phase8_schema_additions.sql"
      to: "live remote Supabase database"
      via: "npx supabase db push --linked"
      pattern: "ALTER TABLE.*ADD COLUMN.*IF NOT EXISTS"
---

<objective>
Add three Phase 8 schema columns so downstream plans can read/write per-account reminder content toggles, per-event-type location, and per-booking owner notes.

Purpose: Schema must land in Wave 1 because every other Wave 2 plan (reminder cron, settings UI, bookings detail extension) reads or writes these columns. Without this migration, those plans cannot compile against the live DB types or run integration tests.

Output: One additive migration file pushed to the live remote DB.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-CONTEXT.md
@.planning/phases/08-reminders-hardening-and-dashboard-list/08-RESEARCH.md
@supabase/migrations/20260419120000_initial_schema.sql
@supabase/migrations/20260427120000_rate_limit_events.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author additive Phase 8 schema migration</name>
  <files>supabase/migrations/20260427120001_phase8_schema_additions.sql</files>
  <action>
    Create a new migration file with timestamp `20260427120001` (one second after the rate_limit_events migration, ensuring it sorts after every existing Phase 1-7 migration).

    Migration content (idempotent ALTERs only — no data loss risk on re-apply):

    ```sql
    -- Phase 8: Reminder content toggles, event-type location, owner notes
    -- Additive only. All defaults backfill existing rows safely.

    -- 1) Per-account reminder content toggles (CONTEXT.md decision)
    ALTER TABLE accounts
      ADD COLUMN IF NOT EXISTS reminder_include_custom_answers boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS reminder_include_location       boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS reminder_include_lifecycle_links boolean NOT NULL DEFAULT true;

    COMMENT ON COLUMN accounts.reminder_include_custom_answers IS
      'When true, reminder emails echo back the booker''s custom-question answers. Default true (matches Phase 5/6 confirmation behavior).';
    COMMENT ON COLUMN accounts.reminder_include_location IS
      'When true, reminder emails include event_types.location text block. Default true.';
    COMMENT ON COLUMN accounts.reminder_include_lifecycle_links IS
      'When true, reminder emails include cancel + reschedule links. Default true.';

    -- 2) Event type location/address (CONTEXT.md decision; reminder email uses this)
    ALTER TABLE event_types
      ADD COLUMN IF NOT EXISTS location text;

    COMMENT ON COLUMN event_types.location IS
      'Free-text location/address for the event type. Surfaced in reminder email when accounts.reminder_include_location is true. NULL = not set.';

    -- 3) Booking owner notes (CONTEXT.md decision; private to owner, never shown to booker)
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS owner_note text;

    COMMENT ON COLUMN bookings.owner_note IS
      'Private owner-only note attached to a booking. Never sent to booker. Edited via /app/bookings/[id] autosave UI.';
    ```

    Critical constraints:
    - Use `ADD COLUMN IF NOT EXISTS` everywhere (idempotent re-runs).
    - The three account booleans are NOT NULL with DEFAULT true; existing rows backfill automatically without breaking RLS or Phase 5/6 behavior.
    - `event_types.location` and `bookings.owner_note` are nullable text (no default needed — existing rows get NULL).
    - Do NOT touch RLS policies. Existing Phase 1 RLS already covers these tables; new columns inherit row visibility.
    - Do NOT add indexes — none of these columns are queried as filters in v1 (location is rendered, owner_note is read only on detail page, toggles are joined to bookings via existing FK).
  </action>
  <verify>
    File exists: `ls supabase/migrations/20260427120001_phase8_schema_additions.sql`
    SQL is syntactically valid: open file and confirm three ALTER blocks present, all using IF NOT EXISTS, defaults are correct.
    No syntax errors visible (counts of `;`, balanced parens, valid Postgres types).
  </verify>
  <done>
    Migration file authored with three idempotent ALTER TABLE statements (accounts +3 booleans, event_types +1 text, bookings +1 text). Comments explain purpose of each column.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply migration to live remote DB and regenerate TypeScript types</name>
  <files>supabase/migrations/20260427120001_phase8_schema_additions.sql, lib/supabase/database.types.ts (or equivalent generated types file)</files>
  <action>
    1. Apply migration to live remote Supabase:
       ```bash
       npx supabase db push --linked
       ```
       Expect output: `Applying migration 20260427120001_phase8_schema_additions.sql... Finished`.

    2. If a generated TypeScript types file exists at `lib/supabase/database.types.ts` (or `types/supabase.ts`, or similar — check existing project structure), regenerate it:
       ```bash
       npx supabase gen types typescript --linked > lib/supabase/database.types.ts
       ```
       If NO generated types file exists in the repo (project may have used inline types per-call up to Phase 7), SKIP this step. Document in SUMMARY which path was taken.

    3. Verify columns are present in remote DB:
       ```bash
       npx supabase db query --linked "SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE (table_name = 'accounts' AND column_name LIKE 'reminder_include%') OR (table_name = 'event_types' AND column_name = 'location') OR (table_name = 'bookings' AND column_name = 'owner_note') ORDER BY table_name, column_name;"
       ```
       Expect 5 rows (3 boolean toggles, 1 location, 1 owner_note), all with appropriate types/defaults.

    4. Commit migration file (and regenerated types if applicable):
       ```bash
       git add supabase/migrations/20260427120001_phase8_schema_additions.sql
       # plus regenerated types file if updated
       git commit -m "feat(08-01): add phase 8 schema columns (reminder toggles + location + owner_note)"
       ```

    Why this matters: Wave 2 plans (reminder cron 08-04, settings UI 08-05, detail extension 08-07) need these columns to exist on the live DB before they can run integration tests against the linked project. Pushing in Wave 1 unblocks parallel Wave 2 execution.

    If the `db push` fails (network, auth, conflict): STOP and report. Do not invent migration ordering or skip — the migration must apply cleanly.
  </action>
  <verify>
    `npx supabase db query --linked "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='reminder_include_custom_answers';"` returns one row.
    Same query for `event_types.location` returns one row.
    Same query for `bookings.owner_note` returns one row.
    `git log -1 --oneline` shows the migration commit.
  </verify>
  <done>
    Migration applied to live Supabase remote DB. All five new columns visible via information_schema query. TypeScript types regenerated if a generated types file exists. Commit pushed.
  </done>
</task>

</tasks>

<verification>
1. `ls supabase/migrations/20260427120001*` shows the new migration file.
2. `npx supabase db query --linked "SELECT count(*) FROM information_schema.columns WHERE (table_name='accounts' AND column_name LIKE 'reminder_include%') OR (table_name='event_types' AND column_name='location') OR (table_name='bookings' AND column_name='owner_note');"` returns `5`.
3. `npx supabase db query --linked "SELECT reminder_include_custom_answers, reminder_include_location, reminder_include_lifecycle_links FROM accounts LIMIT 1;"` returns `t | t | t` for existing rows (defaults applied).
4. Existing Phase 1-7 vitest tests still pass: `npm test`.
</verification>

<success_criteria>
- Migration file exists and is sequenced after `20260427120000_rate_limit_events.sql`.
- Live remote DB has 5 new columns with correct types/defaults.
- Existing rows in `accounts` have all three toggles defaulted to `true`.
- No existing test breaks (`npm test` green).
- Commit pushed to main.
</success_criteria>

<output>
After completion, create `.planning/phases/08-reminders-hardening-and-dashboard-list/08-01-SUMMARY.md` documenting:
- Migration timestamp chosen and rationale
- Live DB verification query output
- Whether generated types file existed and was regenerated (or skipped)
- Any caveats discovered during `db push`
</output>
