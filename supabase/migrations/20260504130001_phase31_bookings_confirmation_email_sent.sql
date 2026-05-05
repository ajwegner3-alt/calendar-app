-- Phase 31 (EMAIL-24): track booker-confirmation email refusals so the /app/bookings dashboard can surface unsent confirmations.
--
-- The booking flow returns 201 immediately and fires sendBookingEmails() inside after() — fire-and-forget. When the
-- Phase 31 quota guard refuses the booker confirmation (count >= 200), the booking row is already committed and the
-- HTTP response is already returned. Per 31-RESEARCH.md "Booking Creation Flow" and CONTEXT, the chosen posture is
-- save-and-flag: keep the booking, set this column to false, and let the dashboard alert the owner.
--
-- DEFAULT true is critical for the existing-row invariant: every existing booking is treated as "confirmation sent"
-- (which is true in practice — they all sent before the guard existed). Plan 31-02 will UPDATE this column to false
-- only on the narrow path where sendBookingEmails() catches QuotaExceededError from the booker confirmation send.
-- Owner-notification refusals do NOT touch this flag (the column is booker-confirmation-specific).
--
-- Partial index keeps the dashboard count query (SELECT count(*) WHERE confirmation_email_sent = false AND account_id = $1)
-- cheap — it will only index the rare unsent rows, not every booking in the table. Without it, the dashboard banner
-- query would scan all bookings on every page load.

ALTER TABLE bookings ADD COLUMN confirmation_email_sent boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS bookings_confirmation_email_unsent_idx
  ON bookings (account_id)
  WHERE confirmation_email_sent = false;
