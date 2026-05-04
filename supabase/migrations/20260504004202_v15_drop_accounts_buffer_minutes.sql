-- v1.5 Phase 28 Plan 28-02: DROP accounts.buffer_minutes (CP-03 two-step complete).
-- Applied via: echo | npx supabase db query --linked -f supabase/migrations/20260504004202_v15_drop_accounts_buffer_minutes.sql
-- (CLI db push disabled — migration drift workaround LOCKED per STATE.md / PROJECT.md.)
--
-- Pre-conditions verified before this file ran:
--   1. Plan 28-01 deployed and live; per-event-type buffer (event_types.buffer_after_minutes) is the sole
--      source of truth in the slot engine (lib/slots.ts) and route handler (app/api/slots/route.ts).
--   2. CP-03 mandatory drain gate WAIVED 2026-05-04 by Andrew (no active booking traffic; documented in
--      .planning/STATE.md "Drain gate (CP-03) — WAIVED" section).
--   3. Drain grep gate: `grep -rn "buffer_minutes" app/ lib/ --include="*.ts" --include="*.tsx"` returned
--      0 matches (Plan 28-02 Task 2 commit 653e620 removed the last 6 references plus 2 doc-comments).
--   4. tsc --noEmit clean for app/ + lib/ (test-only pre-existing errors are unrelated).
--
-- Column dropped:
--   accounts.buffer_minutes — legacy v1.0 account-wide post-event buffer; superseded by
--                             event_types.buffer_after_minutes per Phase 28 LD-01 / LD-04.
--
-- Pattern: matches Phase 21 v1.2 DROP precedent
-- (supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql) — single ALTER inside
-- BEGIN/COMMIT with `IF EXISTS` guard for idempotency.

BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 DROP migration: accounts.buffer_minutes'; END $$;
  ALTER TABLE accounts DROP COLUMN IF EXISTS buffer_minutes;
COMMIT;
