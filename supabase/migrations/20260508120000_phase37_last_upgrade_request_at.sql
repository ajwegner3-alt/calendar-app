-- Phase 37: Upgrade Flow + In-App Cap-Hit UI
-- Adds nullable timestamptz column to track per-account 24h debounce on
-- /app/settings/upgrade requestUpgradeAction submissions.
--
-- Existing rows: NULL (no request ever made).
-- RLS: existing "owners update own account" policy in 20260419120001_rls_policies.sql
--      already covers all columns of the accounts table; no new policy needed.
-- Cleanup: when an account is later upgraded (accounts.email_provider = 'resend'),
--          this column is harmless and is left in place. The cap-hit banner that
--          surfaces /app/settings/upgrade gates on countUnsentConfirmations() > 0,
--          which is unreachable for Resend accounts (they bypass the 200/day cap),
--          so the column simply goes unused for those rows.

ALTER TABLE accounts
  ADD COLUMN last_upgrade_request_at timestamptz;
