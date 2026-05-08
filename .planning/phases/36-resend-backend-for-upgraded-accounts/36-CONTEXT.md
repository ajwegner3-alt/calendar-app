# Phase 36: Resend Backend for Upgraded Accounts - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a Resend HTTP provider behind the existing `getSenderForAccount` factory so any account with `email_provider = 'resend'` routes all transactional sends through NSI's verified domain — bypassing the 200/day Gmail cap while still logging to `email_send_log`.

**Important scoping note from discussion:** This phase ships the **framework only**. Andrew is not actively migrating any customer to Resend right now and does not want to spend session time on live Resend testing, API key wiring, or DNS verification. PREREQ-03 (Resend account + NSI domain DNS) is **deferred to FUTURE_DIRECTIONS.md**. The deliverable is "code is in place and exercised by unit tests, ready to be activated when a customer needs it."

What this phase delivers:
- Resend HTTP provider implementation behind the sender factory
- `accounts.email_provider` column with default `'gmail'`
- Per-account Resend status field (for future suspension)
- Provider routing in `getSenderForAccount`
- Refuse-send fail-closed behavior on Resend errors
- New `email_send_log.provider` column
- Unit tests with mocked Resend HTTP client

What this phase does **not** deliver:
- Live Resend account creation / domain verification (deferred — PREREQ-03)
- Live integration testing against Resend API (deferred — no customer needs it yet)
- The cap-hit "Request upgrade" UI (Phase 37)
- Any admin UI for flipping `email_provider` (Andrew flips manually in Supabase)

</domain>

<decisions>
## Implementation Decisions

### From address & Reply-To

- **Sender mailbox:** `bookings@nsintegrations.com` on NSI's verified domain.
- **From display name:** Account business name only — e.g., `Acme Plumbing <bookings@nsintegrations.com>`. NSI is invisible in the From line. Note: Gmail's "via" annotation may still appear automatically because the envelope domain (`nsintegrations.com`) does not match the display-name's implied business — that's acceptable and expected.
- **Reply-To:** Account owner's email (read from the `accounts` row). Same UX as today's Gmail-OAuth path — when a customer hits Reply, the message goes to the business owner, not NSI.
- **Owner-replies contract:** Preserved automatically by the Reply-To decision above. (No additional logic needed.)

### Provider switching

- **Switch trigger:** Manual DB flip by Andrew. When Andrew approves a future upgrade request (Phase 37), he runs an `UPDATE accounts SET email_provider = 'resend' WHERE id = ...` directly in the Supabase dashboard. No admin API or UI in this phase.
- **Column location:** Add `email_provider` to the existing `accounts` table — consistent with `account_color` and other per-account config columns. No new join table.
- **Schema (Claude's discretion):** Default to `TEXT NOT NULL DEFAULT 'gmail' CHECK (email_provider IN ('gmail', 'resend'))`. This gives explicit allow-list validation, future-proofs for a third provider, and is simpler to alter than a Postgres ENUM.
- **Coexistence (Claude's discretion):** Resend wins. If `email_provider = 'resend'`, the factory uses Resend even when an `account_oauth_credentials` row exists. The Gmail credential is left untouched on flip — lets Andrew downgrade an account back to `'gmail'` later without forcing a re-OAuth.

### Failure & fallback

- **Resend API error path:** Refuse-send fail-closed, mirroring Phase 35's `getSenderForAccount` OAuth pattern. Sender returns `{ success: false, error: 'resend_send_refused: ...' }`. Booking still succeeds; `confirmation_email_sent = false`. No silent failures, no exceptions thrown to callers.
- **Error prefix constant:** Export `RESEND_REFUSED_SEND_ERROR_PREFIX = 'resend_send_refused'` from the Resend provider (or a shared constants module) so callers can match it the same way they match `oauth_send_refused` today.
- **Per-send Gmail fallback:** **No.** Strict provider separation. `email_provider = 'resend'` means Resend only — never silently fall back to the account's Gmail OAuth on per-send failure. Predictable behavior; cleaner debug story; consistent logging.
- **Per-account Resend status field:** Add `accounts.resend_status` (or equivalent) with values `'active' | 'suspended'`, default `'active'`. Lets Andrew suspend a single Resend account in the future (e.g., abuser, unpaid customer) without flipping the provider back to Gmail. Sender refuses send when status is `'suspended'` with `resend_send_refused: account_suspended`.
- **Domain-down UX (Claude's discretion):** Treat NSI's verified-domain status as an operational concern, not a per-account concern. If the domain becomes unverified, all Resend accounts refuse-send and the failures show up in Vercel logs / `email_send_log` — Andrew handles it at the platform level. No per-account banner. (Reason: an account owner can't fix NSI's DNS, so a banner just creates noise.)

### Quota, logging & .ics handling

- **Cap behavior:** The 200/day Gmail cap is skipped for Resend accounts (`email_provider = 'resend'` short-circuits the `checkAndConsumeQuota` call). Confirmed by ROADMAP success criterion 3.
- **Abuse ceiling:** Soft ceiling at **5000 sends/day per Resend account** with a warn-log (no block). Lets Andrew spot runaway loops via logs without throttling legitimate high-volume usage. Implementation: a quota helper similar to `getDailySendCount` but threshold-only, called pre-send for Resend accounts; emits `console.warn` with account_id and count when crossed; does not refuse the send.
- **`email_send_log` schema change:** Add a `provider TEXT NOT NULL DEFAULT 'gmail'` column. Logged on every send; lets analytics distinguish Gmail vs Resend rows even after an account flips providers mid-day. Backfill existing rows with `'gmail'` (the only provider in production at migration time).
- **`email_send_log.resend_message_id`:** Not added in this phase. Keep schema minimal; add later if delivery debugging requires it.
- **`.ics` attachment fidelity (Claude's discretion):** Aim for inline-rendered calendar invite in Gmail (Yes/Maybe/No buttons) — same fidelity as today's Gmail-OAuth path. Use Resend's `attachments` array with `content_type: 'text/calendar; method=REQUEST'` and appropriate `Content-Disposition`. If during research/implementation Resend's attachment API can't reliably produce inline rendering across clients, downgrade gracefully to a downloadable `.ics` file. Document the actual fidelity achieved in the verification step.
- **Email parity (Claude's discretion):** Route all 7 transactional emails (booking-confirmation, owner-notification, reminder, cancel-booker, cancel-owner, reschedule-booker, reschedule-owner) through Resend when the account is on Resend. Welcome-email and signup-confirmation use the nil-UUID sentinel from Phase 35 — they are NSI → user, not per-account, so they should continue using whatever path `getSenderForAccount("00000000-...")` resolves to (which means they keep using Gmail unless explicitly given a Resend path; planner to confirm). Single code path = simplest mental model.

### Claude's Discretion

- `email_provider` column schema details (CHECK vs ENUM)
- Account/Resend coexistence (Resend wins)
- Domain-down UX (operational, not per-account)
- `.ics` attachment fidelity (aim high, downgrade gracefully)
- Email parity for the 7 transactional emails

</decisions>

<specifics>
## Specific Ideas

- **Andrew is not currently migrating any customer to Resend.** This phase exists to lock in the framework so that when a real upgrade request lands (post Phase 37), the code is already there. No urgency on live testing.
- **Defer to FUTURE_DIRECTIONS.md:**
  - Creating the Resend account and Pro tier ($20/month)
  - Verifying NSI domain DNS (SPF/DKIM/DMARC) in Namecheap
  - Adding `RESEND_API_KEY` to Vercel env vars
  - Live integration test (send a real email through Resend, confirm delivery + .ics rendering)
  - Resend dashboard alerting / log integration
- **Mirror Phase 35 patterns:** the Resend provider should feel like a sibling of `lib/email-sender/providers/gmail-oauth.ts` — same factory contract, same refuse-send error shape, same fail-closed posture. Same exported error-prefix constant pattern.
- **Lazy env-var read:** `RESEND_API_KEY` is read inside the function body, not at module top level — same pattern as Phase 34 `getKey()` and Phase 35 `fetchGoogleAccessToken`. Required for Vitest test isolation.
- **No live PREREQ-03 hand-off in this phase.** STATE.md and ROADMAP.md should be updated after the phase to note that Phase 36 ships framework-only and PREREQ-03 has been moved to FUTURE_DIRECTIONS.md as a "do when first customer needs it" item.

</specifics>

<deferred>
## Deferred Ideas

- **Admin UI / API for flipping `email_provider`** — Andrew uses manual DB updates in Supabase for now. Could become a small admin route or CLI script in a future phase if upgrade volume grows.
- **`email_send_log.resend_message_id` column** — useful for delivery debugging via Resend dashboard, but not needed until a customer is actually on Resend.
- **Per-account in-app banner for NSI-domain-down state** — only worth building if the domain ever actually breaks; for now, Vercel logs + Andrew's monitoring suffice.
- **Live Resend integration test in this phase** — moved to FUTURE_DIRECTIONS.md per Andrew's explicit decision to ship framework-only.
- **Hard abuse cap (refuse-send beyond 5000/day)** — keep the soft warn-log first; promote to hard cap only if abuse becomes real.

</deferred>

---

*Phase: 36-resend-backend-for-upgraded-accounts*
*Context gathered: 2026-05-08*
