-- Phase 44: Customer Portal + Billing Settings Polish + Stripe-Triggered Emails
-- Adds cancel_at_period_end column to accounts. Mirror of Stripe subscription.cancel_at_period_end.
-- Written by webhook on customer.subscription.{created,updated,deleted} (Plan 44-04).
-- True = owner scheduled cancellation via Customer Portal; access continues until current_period_end.
-- Phase 44-05 reads this column to render the amber cancel-scheduled Status Card variant.

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.accounts.cancel_at_period_end IS
  'Mirror of Stripe subscription.cancel_at_period_end. Written by webhook on customer.subscription.{created,updated,deleted}. True = owner scheduled cancellation via Customer Portal; access continues until current_period_end. Phase 44-05 reads this for the amber cancel-scheduled Status Card variant.';

COMMIT;
