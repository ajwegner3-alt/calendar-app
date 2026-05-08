-- Phase 36: Resend backend for upgraded accounts
--
-- Adds two per-account columns and one per-send-log column so the
-- getSenderForAccount factory can route email_provider='resend' accounts
-- through Resend instead of Gmail OAuth, and so analytics on email_send_log
-- can distinguish Gmail vs Resend rows.
--
-- Backfill semantics: PostgreSQL's constant-default fast-path on ALTER TABLE
-- ADD COLUMN means existing rows take the DEFAULT 'gmail' value with no row
-- rewrite. The explicit UPDATE is documentation-only; it is a no-op given
-- the DEFAULT but makes the backfill intent obvious.
--
-- RLS: existing accounts policies (owners read/update own account) cover
-- the new columns; no new policies needed. email_send_log has no RLS.

-- 1. accounts.email_provider — provider routing flag (Andrew flips manually
--    in the Supabase dashboard when an upgrade request lands). DEFAULT 'gmail'
--    so every existing account stays on the Gmail-OAuth path until flipped.
ALTER TABLE accounts
  ADD COLUMN email_provider TEXT NOT NULL DEFAULT 'gmail'
    CHECK (email_provider IN ('gmail', 'resend'));

-- 2. accounts.resend_status — per-account suspension flag for Resend accounts.
--    'suspended' causes getSenderForAccount to return a refused sender with
--    error 'resend_send_refused: account_suspended'. Independent of the
--    provider flip so Andrew can suspend without forcing a downgrade.
ALTER TABLE accounts
  ADD COLUMN resend_status TEXT NOT NULL DEFAULT 'active'
    CHECK (resend_status IN ('active', 'suspended'));

-- 3. email_send_log.provider — per-send provider tag. Lets analytics tell
--    Gmail vs Resend rows apart even after an account flips providers
--    mid-day. DEFAULT 'gmail' implicitly backfills existing rows.
ALTER TABLE email_send_log
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'gmail';

-- Documentation-only backfill (the DEFAULT above already filled rows).
UPDATE email_send_log SET provider = 'gmail' WHERE provider IS NULL;
