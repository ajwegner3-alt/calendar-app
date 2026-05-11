-- Phase 42.5: Multi-Tier Stripe + Schema
-- Adds plan_tier column to accounts. Written by webhook on checkout.session.completed
-- by matching the purchased Price ID against the 4-SKU map in lib/stripe/prices.ts.
-- NULL = trialing (pre-first-checkout) or grandfathered v1.7 accounts.
-- Phase 42.6 reads this for widget feature gating.

BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN plan_tier TEXT
    CHECK (plan_tier IS NULL OR plan_tier IN ('basic', 'widget'));

COMMENT ON COLUMN public.accounts.plan_tier IS
  'Stripe subscription tier. Written by webhook on checkout.session.completed by matching the purchased Price ID against the 4-SKU map. NULL = trialing (before first checkout) or grandfathered v1.7 accounts. Phase 42.6 reads this for widget feature gating.';

COMMIT;
