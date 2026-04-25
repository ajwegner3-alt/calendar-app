# Phase 5: Public Booking Flow + Confirmation Email + .ics — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Hosted public booking page at `/[account]/[event-slug]` (no auth). A visitor picks a date and time, fills a form (name/email/phone + custom-question answers), and submits. Submission creates a booking row, sends a confirmation email with `.ics` attachment to the booker, and sends a notification email to the owner.

**In scope:**
- Public booking page UI (calendar + slot picker + form)
- `POST /api/bookings` Route Handler (Server Actions cannot return 409; locked in research)
- Cloudflare Turnstile guard
- Confirmation screen at `/[account]/[event-slug]/confirmed/[booking-id]`
- Booker confirmation email (HTML, with `.ics` `METHOD:REQUEST` attachment, stable UID)
- Owner notification email (HTML, with custom-question answers, reply-to = booker)
- DB migration: `owner_email` column on `accounts`; `cancel_token` + `reschedule_token` columns on `bookings`

**Out of scope (other phases):**
- Cancel/reschedule ROUTES that consume the tokens — Phase 6
- Per-account branding / embed widget — Phase 7
- Reminder emails / DKIM/SPF/DMARC — Phase 8
- Signup UI / multi-tenant onboarding — v2

</domain>

<decisions>
## Implementation Decisions

### Booking page layout & flow
- **Side-by-side desktop layout:** calendar on left, time-slot list on right after a date is picked. Cal.com / Calendly pattern.
- **Date markers:** small accent-color dot below dates that have any open slot. Same pattern Phase 4 overrides calendar already uses.
- **Timezone display:** subtle grey line above the slot list — `"Times shown in [Detected IANA TZ]"`. No TZ switcher in v1.
- **Empty state (zero slots in `max_advance_days` window):** friendly message + owner email link — `"No times available right now — email [owner_email] to book directly."` Page still renders event-type info; calendar shows but is empty.
- Mobile pattern: stack vertically (calendar, then slots, then form). Claude's discretion on exact breakpoint.

### Form behavior & race UX
- **Field order:** contact fields first (name, email, phone — all required), then event-type custom questions below.
- **Phone validation:** required, format-loose. Regex accepts digits + common separators, min 7 chars. No country picker, no auto-format.
- **Cloudflare Turnstile:** **Managed** mode (visible widget). Cloudflare auto-decides when to show a checkbox vs run silently based on risk. Better UX for trade-customer audience than Invisible — users get a clear "Verifying you are human" cue, fewer false-rejections from over-eager submission. Token requested + verified during submit.
- **409 race-loser UX:** inline red banner above form — `"That time was just booked. Pick a new time below."` Slot list auto-refetches; form field values preserved; visitor picks a new time and re-submits.

### Confirmation screen + email content
- **Post-submit flow:** redirect to dedicated URL `/[account]/[event-slug]/confirmed/[booking-id]`. Bookmarkable, refresh-safe.
- **Confirmation screen content:** event name, date/time in booker TZ, owner name, then `"Confirmation sent to [email] with calendar invite."` No on-screen .ics download or Add-to-Calendar deeplinks — `.ics` is in the email.
- **Booker confirmation email sections:** greeting, what was booked (event name, date/time in booker TZ, duration, location text), owner contact, **cancel link**, **reschedule link**, `.ics` attachment. HTML email.
- **Cancel/reschedule overlap with Phase 6:** Phase 5 generates `cancel_token` + `reschedule_token` columns + URLs in the email. Until Phase 6 ships, those URLs 404 — but tokens already exist so Phase 6 wires routes only. Email format never changes between phases.
- **Sender identity:** From-name = `"Andrew @ NSI"` (owner display + brand). Subject = `"Booking confirmed: [event] on [date]"`. Scannable in inbox previews.
- **Owner notification email:** Subject = `"New booking: [booker name] — [event] on [date]"`. Body: event/date/time, booker name + email + phone, full custom-question answers. **Reply-to set to booker email** so Andrew can hit Reply directly.

### Resolved research open questions
- **`@nsi/email-sender` install method (REVISED 2026-04-25):** Vendor from sibling `../email-sender/` into `calendar-app/lib/email-sender/` as a local module. Phase 5 ships **Gmail provider only** (`providers/gmail.ts` — nodemailer SMTP via App Password). Resend provider was vendored then removed; re-vendor from sibling if ever needed. Tradeoff acknowledged: future package updates require manual re-copy.
- **Email provider choice — Gmail (App Password) over Resend:** v1 sends from Andrew's personal Gmail (`ajwegner3@gmail.com`) using a Google App Password. Pros: zero domain-verification setup, free, 500/day soft cap is plenty for single-tenant. Cons vs Resend: deliverability less polished; QA-03 (mail-tester 9/10) target is harder to hit from a personal address. Phase 8 hardening MAY swap to Resend with a verified domain if QA-03 fails — the `lib/email-sender` abstraction supports the swap by re-vendoring `providers/resend.ts` and toggling `EMAIL_PROVIDER` env var.
- **v2 forward-architecture: per-account Gmail OAuth** — When multi-tenant onboarding ships in v2, each account owner will OAuth into their own Gmail (scopes: `gmail.send` + optional `gmail.readonly` for inbox-side reply parsing). Schema additions in v2: `accounts.gmail_refresh_token TEXT NULL`, `accounts.gmail_oauth_email TEXT NULL`. Implementation: add `lib/email-sender/providers/gmail-oauth.ts` (Gmail API + OAuth refresh token, NOT SMTP+App Password). Replace env-based singleton in `index.ts` with per-account `createEmailClient({...})` lookup at send time. The current factory already accepts per-call config — no abstraction rewrite required, only a new provider file + per-call instantiation. Captured here so v1 implementation choices don't paint v2 into a corner.
- **Owner email source:** Add nullable `owner_email TEXT` column to `accounts` table via migration (DONE Plan 05-01). Andrew sets it once on his account row. `.ics ORGANIZER` field + owner notification email read from `accounts.owner_email`. **v1 Gmail constraint:** `accounts.owner_email` MUST equal `GMAIL_USER` env value because nodemailer's SMTP `from` is bound to the authenticated Gmail address. Both = `ajwegner3@gmail.com` for nsi; future v2 multi-tenant signup will populate `owner_email` AND `gmail_refresh_token` together. (Owner display-name reuses existing brand/account name field; no new column.)

### Claude's Discretion
- Mobile breakpoint and exact responsive behavior
- Exact button/heading typography (uses NSI brand tokens already in `@theme`)
- Loading skeleton design while slots fetch
- Form validation timing detail (on-blur vs on-submit) — pick the established pattern from Phase 3 forms
- Required-field marker style (asterisk, "Required" label, color) — pick the established Phase 3 form pattern
- Custom-question type rendering (text vs select vs radio) follows event-type `custom_questions[].type` already defined in Phase 3
- Exact `.ics` location field text (event_type description? account name? null?)
- Email logo/branding placeholder (Phase 7 swaps to per-account branding)
- Confirmation page favicon / OG meta

</decisions>

<specifics>
## Specific Ideas

- Layout reference: Cal.com / Calendly side-by-side calendar + slots flow.
- Date marker reference: same as Phase 4 overrides calendar (already shipped).
- "Trades audience" framing: format-loose phone, low-friction Turnstile (invisible), inline-banner errors over modals.
- Email subject line scannability matters — leads with action ("Booking confirmed", "New booking") not greeting.

</specifics>

<deferred>
## Deferred Ideas

- **Add-to-Google / Add-to-Outlook deeplink buttons** on confirmation screen — deferred. `.ics` in email is sufficient for v1.
- **Timezone switcher chip on booking page** — deferred. Subtle line above slots is sufficient for v1.
- **Show both booker + owner timezone on slot list** — deferred. Booker TZ only for v1.
- **libphonenumber-js + country picker for phone** — deferred. Format-loose for v1.
- **Visible Turnstile widget for higher trust** — deferred. Invisible mode for v1.
- **Reserved-slug list** (so `/app`, `/api`, `/embed` can never be valid event-type slugs) — captured here; planner can decide whether it's a Phase 5 task or backlog.

</deferred>

---

*Phase: 05-public-booking-flow*
*Context gathered: 2026-04-25*
