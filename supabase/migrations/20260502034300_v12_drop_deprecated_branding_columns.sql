-- Phase 21: Drop deprecated branding columns + their ENUM types.
-- Applied via: npx supabase db query --linked -f supabase/migrations/20260502034300_v12_drop_deprecated_branding_columns.sql
-- (CLI db push disabled — migration drift workaround LOCKED per STATE.md / PROJECT.md §200)
--
-- Pre-conditions verified before this file ran:
--   1. CP-01 grep-zero: zero runtime reads of any of the 4 column names in .ts/.tsx (excluding migrations) — Phase 20 commit 8ec82d5 + Phase 21 Task 1 Gate A
--   2. tsc --noEmit clean
--   3. >=30-min Vercel function drain since the last code deploy (CP-03)
--
-- Columns dropped:
--   accounts.sidebar_color           — Phase 12.6 (text, hex CHECK)
--   accounts.background_color        — Phase 12   (text, hex CHECK)
--   accounts.background_shade        — Phase 12   (background_shade ENUM)
--   accounts.chrome_tint_intensity   — Phase 12.5 (chrome_tint_intensity ENUM)
--
-- Types dropped (after their columns are gone):
--   background_shade           ENUM ('none','subtle','bold')
--   chrome_tint_intensity      ENUM ('none','subtle','full')

BEGIN;
  DO $$ BEGIN RAISE NOTICE 'Phase 21 DROP migration starting: 4 columns + 2 ENUM types'; END $$;

  ALTER TABLE accounts DROP COLUMN IF EXISTS sidebar_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_color;
  ALTER TABLE accounts DROP COLUMN IF EXISTS background_shade;
  ALTER TABLE accounts DROP COLUMN IF EXISTS chrome_tint_intensity;

  DROP TYPE IF EXISTS background_shade;
  DROP TYPE IF EXISTS chrome_tint_intensity;
COMMIT;
