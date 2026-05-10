-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation_ROLLBACK.sql
--
-- Reverse of phase41_stripe_billing_foundation.sql.
-- DO NOT APPLY unless reverting Phase 41. Co-shipped per CONTEXT migration policy.

BEGIN;

-- 1. Restore the original (Phase 10) trigger function.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step
  ) VALUES (
    NEW.id, NEW.email, NULL, NULL, 'UTC', FALSE, 1
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- 2. Drop dedupe table.
DROP TABLE IF EXISTS public.stripe_webhook_events;

-- 3. Drop billing columns. (DROP COLUMN auto-removes any CHECK / UNIQUE constraints.)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS trial_warning_sent_at,
  DROP COLUMN IF EXISTS plan_interval,
  DROP COLUMN IF EXISTS current_period_end,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;

COMMIT;
