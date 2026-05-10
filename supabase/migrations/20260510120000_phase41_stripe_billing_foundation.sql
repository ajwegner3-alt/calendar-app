-- Source: synthesizes milestone v1.8 ARCHITECTURE.md §1a-1c + CONTEXT 7-column scope
-- File: supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql
--
-- Phase 41: Stripe billing foundation.
-- Single transaction (Postgres DDL is transactional). All-or-nothing apply.
-- Rollback: see paired _ROLLBACK.sql file. Do not apply unless reverting.
--
-- Apply via: mcp__claude_ai_Supabase__apply_migration with
--   name='phase41_stripe_billing_foundation' and the file body below.
-- Validate first on a Supabase preview branch (mcp__claude_ai_Supabase__create_branch).

BEGIN;

-- 1. Add 7 billing columns to accounts.
ALTER TABLE public.accounts
  ADD COLUMN stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN subscription_status      TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN (
      'trialing', 'active', 'past_due', 'canceled',
      'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )),
  ADD COLUMN trial_ends_at            TIMESTAMPTZ,
  ADD COLUMN current_period_end       TIMESTAMPTZ,
  ADD COLUMN plan_interval            TEXT
    CHECK (plan_interval IS NULL OR plan_interval IN ('monthly', 'annual', 'month', 'year')),
  ADD COLUMN trial_warning_sent_at    TIMESTAMPTZ;
-- NOTE: plan_interval CHECK accepts both ('month'/'year') from Stripe payload AND
-- ('monthly'/'annual') from CONTEXT vocabulary. Phase 42 normalizes — for now
-- accept both so neither path breaks.

COMMENT ON COLUMN public.accounts.stripe_customer_id IS
  'Stripe Customer ID (cus_*). Set by Phase 42 checkout route before redirect to hosted Checkout.';
COMMENT ON COLUMN public.accounts.subscription_status IS
  'Mirror of Stripe subscription.status. Source of truth for paywall middleware (Phase 43).';
COMMENT ON COLUMN public.accounts.trial_ends_at IS
  '14-day trial deadline. Set by trigger on signup; backfilled to NOW()+14d on v1.8 deploy.';
COMMENT ON COLUMN public.accounts.trial_warning_sent_at IS
  'Set by webhook on customer.subscription.trial_will_end. Phase 44 reads this to gate the trial-ending email.';

-- 2. Backfill: grandfather all existing accounts with trial starting at deploy.
-- LD-09 + V18-CP-06: anchor trial to NOW() (deploy time), NOT created_at.
-- WHERE stripe_customer_id IS NULL = "every existing account" since no one has one yet.
UPDATE public.accounts
SET
  trial_ends_at = NOW() + INTERVAL '14 days',
  subscription_status = 'trialing'
WHERE stripe_customer_id IS NULL;

-- 3. Idempotency table for webhook deduplication.
CREATE TABLE public.stripe_webhook_events (
  stripe_event_id TEXT        PRIMARY KEY,
  event_type      TEXT        NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

-- RLS: service-role-only writes. No authenticated read policy needed.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- (RLS enabled with zero policies = no anon/authenticated access.)

COMMENT ON TABLE public.stripe_webhook_events IS
  'Stripe webhook idempotency log. Phase 41+: INSERT ... ON CONFLICT DO NOTHING on stripe_event_id; if 0 rows inserted, event already processed.';

-- 4. Update provision_account_for_new_user trigger to set trial defaults on signup.
-- Mirrors the original from 20260428120002_phase10_accounts_rls_and_trigger.sql,
-- adding trial_ends_at + subscription_status. All other columns preserved unchanged.
CREATE OR REPLACE FUNCTION public.provision_account_for_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.accounts (
    owner_user_id,
    owner_email,
    slug,
    name,
    timezone,
    onboarding_complete,
    onboarding_step,
    subscription_status,
    trial_ends_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NULL,                         -- slug filled by wizard step 1
    NULL,                         -- name filled by wizard step 1
    'UTC',                        -- placeholder; wizard step 2 sets real timezone
    FALSE,
    1,
    'trialing',                   -- BILL-04: every new signup starts trialing
    NOW() + INTERVAL '14 days'    -- BILL-04: 14-day clock starts at signup
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.provision_account_for_new_user() TO postgres;

-- The trigger itself (provision_account_on_signup on auth.users) was created in
-- the Phase 10 migration and points at the function name — CREATE OR REPLACE
-- above re-binds without needing to drop+recreate the trigger.

COMMIT;
