---
phase: 06-cancel-and-reschedule-lifecycle
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260427120000_rate_limit_events.sql
autonomous: true

must_haves:
  truths:
    - "Table rate_limit_events exists in remote calendar Supabase project (RESEARCH §Schema Delta — only schema change in Phase 6)"
    - "Table has columns: id bigserial PK, key text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()"
    - "Composite index rate_limit_events_key_occurred_idx ON (key, occurred_at) exists — required for sliding-window count query (WHERE key=? AND occurred_at >= ?)"
    - "Migration file is idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS) — safe to re-run"
    - "Migration applied to remote DB via `supabase db query --linked -f <migration>` (Phase 5 lock; supabase link confirmed working in Plan 05-01)"
    - "RLS NOT enabled on rate_limit_events — table is service-role only, anon/authed clients never touch it (admin client only, same pattern as the existing bookings INSERT path)"
    - "NO new columns added to bookings — Phase 1 schema already has cancel_token_hash, reschedule_token_hash (NOT NULL), cancelled_at, cancelled_by, plus indexes bookings_cancel_token_idx + bookings_reschedule_token_idx (RESEARCH §Schema Delta)"
    - "NO new columns added to booking_events — Phase 1 schema already has actor (booking_actor enum: booker|owner|system) + metadata jsonb (RESEARCH §Schema Delta)"
  artifacts:
    - path: "supabase/migrations/20260427120000_rate_limit_events.sql"
      provides: "Postgres table for sliding-window rate limit storage; key+occurred_at index for fast windowed counts"
      contains: "create table if not exists rate_limit_events"
      min_lines: 12
  key_links:
    - from: "supabase/migrations/20260427120000_rate_limit_events.sql"
      to: "remote Supabase calendar project"
      via: "supabase db query --linked -f <file>"
      pattern: "rate_limit_events"
    - from: "rate_limit_events table"
      to: "future lib/rate-limit.ts (Plan 06-02)"
      via: "createAdminClient().from('rate_limit_events').select(...).insert(...)"
      pattern: "rate_limit_events"
---

<objective>
Add the single new database table required for Phase 6: `rate_limit_events` for Postgres-backed sliding-window rate limiting on `/cancel/*` and `/reschedule/*` token routes.

Purpose: LIFE-04 (rate-limit cancel endpoint) needs a persistent counter store. RESEARCH §Rate-Limit Storage Backend Decision rejects in-memory (per-Lambda-instance state breaks under any load) and Upstash (no existing Redis dependency, adds external service for low-traffic personal app); Postgres is the recommended backend (one extra DB round-trip per token-route hit, free-tier-friendly, no new accounts).

Output: One SQL migration file pushed to the remote `calendar` Supabase project. Zero code changes. Zero new columns on `bookings` (Phase 1 already provisioned `cancel_token_hash`, `reschedule_token_hash`, `cancelled_at`, `cancelled_by`).
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-CONTEXT.md
@.planning/phases/06-cancel-and-reschedule-lifecycle/06-RESEARCH.md

# Reference: existing schema confirms what already exists for Phase 6
@supabase/migrations/20260419120000_initial_schema.sql

# Reference: prior Phase 5 migration as format exemplar (idempotent ADD COLUMN + UPDATE seed)
@supabase/migrations/20260426120000_account_owner_email.sql

# Reference: prior Phase 4 settings migration (idempotent ALTER TABLE pattern)
@supabase/migrations/20260425120000_account_availability_settings.sql
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create rate_limit_events migration file</name>
  <files>supabase/migrations/20260427120000_rate_limit_events.sql</files>
  <action>
Write the migration SQL exactly as specified in RESEARCH §Schema Delta (verbatim) plus a header comment block:

```sql
-- 20260427120000_rate_limit_events.sql
--
-- Phase 6 (Cancel + Reschedule Lifecycle) — adds Postgres-backed sliding-window
-- rate limit storage for the public token routes (/cancel/*, /reschedule/*).
--
-- Why Postgres instead of Upstash Redis or in-memory (RESEARCH §Rate-Limit Storage Backend Decision):
--   - In-memory: per-Lambda-instance state, fails under any meaningful load.
--   - Upstash: requires new account + env vars + external service for very low
--     traffic on a single-owner scheduling app.
--   - Postgres: zero new dependencies, consistent across all Vercel instances,
--     adds ~1 DB round-trip per token-route hit (acceptable on these low-frequency
--     endpoints), uses the same admin client pattern already established.
--
-- Cleanup: rows accumulate slowly (10 req / IP / 5 min hard cap → ~120 rows/hour
-- absolute worst case per attacker). Phase 8 hardening can add a pg_cron sweep
-- (DELETE FROM rate_limit_events WHERE occurred_at < now() - interval '1 day').
--
-- RLS: intentionally NOT enabled. The only callers are server-only modules using
-- createAdminClient() (service-role bypasses RLS). anon/authed clients never read
-- or write this table directly.

create table if not exists rate_limit_events (
  id          bigserial primary key,
  key         text        not null,            -- e.g. 'cancel:203.0.113.1' or 'reschedule:203.0.113.1'
  occurred_at timestamptz not null default now()
);

-- Composite index supports the sliding-window count query:
--   SELECT count(*) FROM rate_limit_events WHERE key = ? AND occurred_at >= ?
create index if not exists rate_limit_events_key_occurred_idx
  on rate_limit_events(key, occurred_at);
```

DO NOT:
- Do NOT add an `expires_at` column. The window length lives in application code (`lib/rate-limit.ts` in Plan 06-02), not in the schema, so the same table can serve windows of any length without migration.
- Do NOT enable RLS. Service-role-only by convention. Adding RLS would require a policy carve-out and add zero security value (admin client bypasses RLS regardless).
- Do NOT add a UNIQUE constraint on `(key, occurred_at)`. Two simultaneous requests at the same millisecond from the same IP must both be recorded as separate counter events.
- Do NOT add an `ip` column distinct from `key`. The key is `<route>:<ip>` so a single column covers both dimensions and the index works without composite logic.
- Do NOT add ON CONFLICT DO NOTHING — there is no UNIQUE constraint to conflict on. Plain `INSERT` is correct.
- Do NOT add columns to the `bookings` table. RESEARCH §Schema Delta confirms Phase 1 already provisioned `cancel_token_hash`, `reschedule_token_hash`, `cancelled_at`, `cancelled_by`, and the lookup indexes `bookings_cancel_token_idx` + `bookings_reschedule_token_idx`. Adding more columns here is wasted work.
- Do NOT touch the `booking_events` table. Phase 1 enums `booking_event_kind = (created, cancelled, rescheduled, reminder_sent)` and `booking_actor = (booker, owner, system)` already cover Phase 6 audit needs. The `metadata jsonb` column carries `{ reason, ip, old_start_at, new_start_at }` without schema change.
  </action>
  <verify>
```bash
ls "supabase/migrations/20260427120000_rate_limit_events.sql"

grep -q "create table if not exists rate_limit_events" "supabase/migrations/20260427120000_rate_limit_events.sql" && echo "table create ok"
grep -q "create index if not exists rate_limit_events_key_occurred_idx" "supabase/migrations/20260427120000_rate_limit_events.sql" && echo "index create ok"
grep -q "key.*text.*not null" "supabase/migrations/20260427120000_rate_limit_events.sql" && echo "key col ok"
grep -q "occurred_at.*timestamptz" "supabase/migrations/20260427120000_rate_limit_events.sql" && echo "occurred_at col ok"

# Confirm idempotency markers
grep -c "if not exists" "supabase/migrations/20260427120000_rate_limit_events.sql" | awk '$1 == 2 { print "idempotent (2x IF NOT EXISTS)" }'
```
  </verify>
  <done>
Migration file exists at `supabase/migrations/20260427120000_rate_limit_events.sql` with the `rate_limit_events` table + composite index + idempotent `IF NOT EXISTS` guards. Header comment cites RESEARCH §Rate-Limit Storage Backend Decision rationale.

Commit: `feat(06-01): add rate_limit_events migration for sliding-window rate limit storage`. Push.
  </done>
</task>

<task type="auto">
  <name>Task 2: Apply migration to remote Supabase calendar project</name>
  <files></files>
  <action>
Run the Phase 5–established CLI migration pattern against the live `calendar` Supabase project. The `supabase link` was confirmed working in Plan 05-01 (STATE.md: "supabase link confirmed working").

```bash
# From project root
npx supabase db query --linked -f supabase/migrations/20260427120000_rate_limit_events.sql
```

Expected output: empty result set (CREATE TABLE + CREATE INDEX return no rows). On success, the CLI exits 0.

If `supabase link` is not established for some reason, run first:
```bash
npx supabase link --project-ref mogfnutxrrbtvnaupoun
# (will prompt for DB password — Andrew has this in his password manager)
```

Then verify the table exists in the remote DB:
```bash
npx supabase db query --linked --execute "select table_name from information_schema.tables where table_schema='public' and table_name='rate_limit_events';"
# Expected output: 1 row → rate_limit_events
```

DO NOT:
- Do NOT use the Supabase MCP `apply_migration` tool — Claude Code CLI sessions don't have it in scope (STATE.md Phase 3-01 lock). The CLI fallback is the established pattern.
- Do NOT modify the migration file after applying — supabase migration tracking treats applied files as immutable. If a fix is needed, write a new migration with a later timestamp.
- Do NOT add a manual INSERT to seed test data. Plan 06-05 integration tests insert their own rows and clean up.
  </action>
  <verify>
```bash
# Confirm table exists on remote
npx supabase db query --linked --execute "select count(*) from rate_limit_events;" 2>&1 | grep -E "^\s*0\s*$" && echo "table exists, empty"

# Confirm index exists
npx supabase db query --linked --execute "select indexname from pg_indexes where tablename='rate_limit_events';" 2>&1 | grep -q "rate_limit_events_key_occurred_idx" && echo "index exists"
```
  </verify>
  <done>
`rate_limit_events` table is live on the remote `calendar` Supabase project, with the composite `(key, occurred_at)` index. Verified via `supabase db query --linked --execute`. The table is empty.

Commit not needed for this task (no new file changes — only remote DB application). Plan 06-02 will start using the table.
  </done>
</task>

</tasks>

<verification>
```bash
# Migration file present and well-formed
ls "supabase/migrations/20260427120000_rate_limit_events.sql"
grep -q "rate_limit_events" "supabase/migrations/20260427120000_rate_limit_events.sql"

# Remote applied
npx supabase db query --linked --execute "select count(*) from rate_limit_events;"
```
</verification>

<rollback>
Manual rollback (only if migration causes issues — unlikely since the table is additive and untouched by all existing code):
```sql
drop index if exists rate_limit_events_key_occurred_idx;
drop table if exists rate_limit_events;
```
Apply via `npx supabase db query --linked --execute "..."`. The migration file in `supabase/migrations/` would also need to be moved/deleted to prevent re-application on next push.
</rollback>

<success_criteria>
- [ ] `supabase/migrations/20260427120000_rate_limit_events.sql` exists, idempotent
- [ ] Table `rate_limit_events` exists on remote with `id bigserial PK`, `key text NOT NULL`, `occurred_at timestamptz NOT NULL DEFAULT now()`
- [ ] Composite index `rate_limit_events_key_occurred_idx ON (key, occurred_at)` exists on remote
- [ ] No changes made to `bookings` table (verified by reading the Phase 1 schema — all needed columns + indexes already present)
- [ ] No changes made to `booking_events` table (Phase 1 enums + metadata jsonb cover Phase 6 audit needs)
- [ ] Migration file committed to git
</success_criteria>

<output>
After completion, create `.planning/phases/06-cancel-and-reschedule-lifecycle/06-01-SUMMARY.md` documenting:
- The single new table `rate_limit_events` (schema, index, no RLS rationale)
- Confirmation that bookings table needs ZERO changes (Phase 1 already complete for this phase)
- Confirmation that booking_events table needs ZERO changes (enums + metadata jsonb sufficient)
- The CLI command used to apply (and that the link was already established)
- Forward locks for Plan 06-02: `lib/rate-limit.ts` will SELECT count + INSERT against this table via `createAdminClient()`
</output>
