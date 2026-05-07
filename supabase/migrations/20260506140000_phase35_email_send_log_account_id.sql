-- Phase 35 (EMAIL-27): per-account quota isolation.
-- Adds account_id to email_send_log so getDailySendCount can filter per account.
-- Nullable + ON DELETE SET NULL: legacy rows from Phases 5-34 (pre-Phase 35) have no account_id.
-- New rows written by Phase 35 quota-guard will populate it.

ALTER TABLE email_send_log
  ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- Index for the per-account daily count query: WHERE account_id = $1 AND sent_at >= today
CREATE INDEX IF NOT EXISTS email_send_log_account_sent_at_idx
  ON email_send_log (account_id, sent_at DESC);

COMMENT ON COLUMN email_send_log.account_id IS
  'Account whose 200/day quota this send counts against. Nullable for legacy rows pre-Phase 35 and for signup-side sends (welcome email) that pre-date account creation.';
