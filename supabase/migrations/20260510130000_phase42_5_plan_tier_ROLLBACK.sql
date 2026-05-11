-- Rollback for 20260510130000_phase42_5_plan_tier.sql
-- WARNING: drops the plan_tier column and all data in it.
-- Only run if migration is being reverted before Phase 42.6 ships.

BEGIN;

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS plan_tier;

COMMIT;
