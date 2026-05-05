-- Phase 31 (EMAIL-21): extend email_send_log.category CHECK to allow booking-side senders through the quota guard.
--
-- Pre-Phase-31 the table accepted only signup-side categories; booking, owner-notification, reminder, cancel, and reschedule
-- paths bypassed the guard entirely (the v1.1 carve-out documented in lib/email-sender/index.ts). Plan 31-02 will route
-- those paths through checkAndConsumeQuota(), and the TS EmailCategory union is being extended in lockstep — the DB
-- CHECK must accept the seven new per-function values before any caller is wired or the inserts will all fail with
-- a CHECK constraint violation (Pitfall 3 in 31-RESEARCH.md).
--
-- This is a CHECK swap only — no DDL on the data column itself, no rewrite, no backfill. CP-03 two-step DROP protocol
-- does not apply (that protocol covers column drops, not constraint swaps). No data migration is needed because
-- existing rows already use the legacy values which remain in the new union.

ALTER TABLE email_send_log DROP CONSTRAINT email_send_log_category_check;

ALTER TABLE email_send_log ADD CONSTRAINT email_send_log_category_check CHECK (category IN (
  -- Legacy signup-side values (unchanged from migration 20260428120003)
  'signup-verify',
  'signup-welcome',
  'password-reset',
  'email-change',
  'other',
  -- Phase 31 booking-side values (per-function taxonomy from 31-RESEARCH.md "EmailCategory Taxonomy")
  'booking-confirmation',
  'owner-notification',
  'reminder',
  'cancel-booker',
  'cancel-owner',
  'reschedule-booker',
  'reschedule-owner'
));
