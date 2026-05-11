-- Rollback for 20260511120000_phase44_cancel_at_period_end.sql
-- WARNING: drops the cancel_at_period_end column and all data in it.
-- Only run if Phase 44 is being reverted before Plan 44-04 (webhook write) or 44-05 (billing UI) ship.

BEGIN;

ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS cancel_at_period_end;

COMMIT;
