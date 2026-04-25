# Requirements: Calendar App (NSI Booking Tool)

**Defined:** 2026-04-18
**Core Value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

## v1 Requirements

Requirements for initial release. Each maps to exactly one roadmap phase.

### Foundation

- [ ] **FOUND-01**: Next.js 15 App Router + TypeScript project scaffolded and deployed to Vercel
- [ ] **FOUND-02**: Supabase project `calendar` connected via `@supabase/ssr` with env vars set in Vercel (service-role key gated in a single `server-only` module)
- [ ] **FOUND-03**: Database schema migrated — `accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events` — all timestamps `timestamptz`, IANA TZ strings on `accounts` and `bookings`, `account_id` denormalized on every child table
- [ ] **FOUND-04**: Race-safe booking guaranteed by a partial unique index `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` at the DB layer
- [ ] **FOUND-05**: RLS policies enabled on every table, scoped by `account_id`; anonymous role has no direct table access
- [ ] **FOUND-06**: Andrew's account seeded manually in the DB with IANA TZ `America/Chicago`

### Authentication

- [x] **AUTH-01**: Owner can log in to the dashboard with email and password via Supabase Auth
- [x] **AUTH-02**: Owner can log out from the dashboard
- [x] **AUTH-03**: Owner session persists across browser refresh
- [x] **AUTH-04**: All `/app/*` routes redirect to the login page when the owner is not authenticated

### Event Types

- [ ] **EVENT-01**: Owner can create an event type with a name, URL slug, duration (minutes), and description
- [ ] **EVENT-02**: Owner can edit any existing event type
- [ ] **EVENT-03**: Owner can delete an event type (soft-delete preserves historical bookings)
- [ ] **EVENT-04**: Owner can toggle an event type active/inactive (inactive types are hidden from booking pages)
- [ ] **EVENT-05**: Owner can define custom questions per event type (label, type, required flag) that appear on the booker form
- [ ] **EVENT-06**: Event type URL slug is unique per account and validated

### Availability

- [ ] **AVAIL-01**: Owner can set weekly recurring availability (per weekday: open/closed + start/end times, multiple windows per day allowed)
- [ ] **AVAIL-02**: Owner can add per-date overrides (block a specific day, or replace rules for that day)
- [ ] **AVAIL-03**: Owner can set buffer time (minutes) applied before and after each booking
- [ ] **AVAIL-04**: Owner can set minimum notice (hours before a slot becomes bookable)
- [ ] **AVAIL-05**: Owner can set maximum advance window (days into the future that slots are shown)
- [ ] **AVAIL-06**: Owner can set a daily cap on bookings per day
- [ ] **AVAIL-07**: Availability rules apply account-wide to all event types (per-event-type schedules deferred to v2)
- [ ] **AVAIL-08**: Slot computation API (`/api/slots`) returns UTC slot list given an event type and date range, correctly subtracting existing bookings, applying buffers, and honoring min-notice/max-advance/daily-cap
- [ ] **AVAIL-09**: Slot computation is verified correct across US DST transitions (March 8 2026, Nov 1 2026) via automated tests

### Public Booking

- [ ] **BOOK-01**: Visitor can access a public booking page at `/[account]/[event-slug]` without authentication
- [ ] **BOOK-02**: Booking page auto-detects the booker's browser time zone and displays all slots in booker local time
- [ ] **BOOK-03**: Booking page shows a calendar view; booker picks a date, then a time slot
- [ ] **BOOK-04**: Booking form collects name (required), email (required), and phone (required), plus any custom questions defined on the event type
- [ ] **BOOK-05**: Submitting the form creates a booking via `/api/bookings`; API returns a 409 with a clean error UI if the slot was taken between picker load and submit
- [ ] **BOOK-06**: Booker is shown a confirmation screen with booking details after a successful booking
- [ ] **BOOK-07**: Booking form is protected by Cloudflare Turnstile to prevent spam bookings

### Email

- [ ] **EMAIL-01**: All transactional emails are sent via the shared `@nsi/email-sender` tool using the Resend provider
- [ ] **EMAIL-02**: On booking creation, the booker receives a confirmation email with booking details, cancel link, and reschedule link
- [ ] **EMAIL-03**: On booking creation, the booker's confirmation email includes a valid `.ics` calendar invite attachment (`METHOD:REQUEST`, stable UID) that imports correctly in Gmail, Outlook, and Apple Calendar
- [ ] **EMAIL-04**: On booking creation, the owner receives a notification email with booking details and the booker's answers to custom questions
- [ ] **EMAIL-05**: Booker receives a reminder email approximately 24 hours before the appointment
- [ ] **EMAIL-06**: On cancellation, the booker receives a cancellation confirmation email and the owner receives a cancellation notification email
- [ ] **EMAIL-07**: On reschedule, both booker and owner receive reschedule notification emails with updated details and a fresh `.ics`
- [ ] **EMAIL-08**: Sending domain has verified SPF, DKIM, and DMARC records; `mail-tester.com` score is 9/10 or better before launch

### Lifecycle (Cancel + Reschedule)

- [ ] **LIFE-01**: Booker can cancel a booking via a tokenized link in their confirmation email without logging in
- [ ] **LIFE-02**: Booker can reschedule a booking via a tokenized link in their confirmation email, picking a new slot from the same event type
- [ ] **LIFE-03**: Cancel/reschedule tokens are stored as SHA-256 hashes in the DB (raw tokens only in email); tokens expire on status change and after the appointment passes
- [ ] **LIFE-04**: Cancel endpoint is rate-limited to prevent token enumeration
- [ ] **LIFE-05**: Owner can cancel any booking from the dashboard bookings list

### Branding

- [ ] **BRAND-01**: Owner can upload a logo image (stored in Supabase Storage) in dashboard settings
- [ ] **BRAND-02**: Owner can set a primary brand color (hex) in dashboard settings
- [ ] **BRAND-03**: Booking page and widget render with the account's logo and primary color
- [ ] **BRAND-04**: Emails sent for an account render with that account's branding (logo + primary color)

### Embed & Hosted Page

- [ ] **EMBED-01**: A chromeless embed route exists at `/embed/[account]/[event-slug]` that hosts only the booking picker + form (no site chrome)
- [ ] **EMBED-02**: A static `widget.js` loader is served from the app and, when included on a third-party site, finds elements with `[data-nsi-calendar]` attributes and injects an iframe pointing to the embed route
- [ ] **EMBED-03**: The iframe auto-resizes to content height via a namespaced `postMessage` protocol (`nsi-booking:height`) with a `ResizeObserver` on the embed root
- [ ] **EMBED-04**: `Content-Security-Policy: frame-ancestors *` is set on `/embed/*` only; `X-Frame-Options` is removed on that route; default CSP elsewhere remains `self`
- [ ] **EMBED-05**: Dashboard provides a copy-paste embed snippet for each active event type (script tag + div with `data-nsi-calendar` attributes)
- [ ] **EMBED-06**: Dashboard provides a raw `<iframe>` fallback snippet for host sites that block external scripts
- [ ] **EMBED-07**: Widget is verified working on a live NSI Squarespace or WordPress page with no JS errors
- [ ] **EMBED-08**: Each account has a public hosted booking page at `/[account]` that lists all active event types with links to individual event booking pages

### Dashboard

- [x] **DASH-01**: Owner dashboard has navigation between event types, availability, branding, and bookings
- [ ] **DASH-02**: Bookings list shows all upcoming and past bookings with booker name, email, phone, event type, start time, status, and answers to custom questions
- [ ] **DASH-03**: Bookings list is filterable by status (confirmed/cancelled) and date range
- [ ] **DASH-04**: Owner can view full details of a single booking

### Infrastructure

- [ ] **INFRA-01**: Vercel Cron hits `/api/cron/send-reminders` hourly; the handler selects bookings starting in the next 24h with `reminder_sent_at IS NULL`, claims each via a compare-and-set UPDATE, and sends exactly one reminder per booking
- [ ] **INFRA-02**: Cron endpoint is authenticated via a `CRON_SECRET` header to prevent public invocation
- [ ] **INFRA-03**: Bookings created inside the 24h window trigger an immediate reminder at creation time (no wait for the next cron tick)
- [ ] **INFRA-04**: Public booking endpoint (`/api/bookings`) is rate-limited per IP to prevent abuse
- [ ] **INFRA-05**: Automated RLS test matrix verifies data isolation across two tenant contexts + the anonymous role

### Manual QA & Verification

- [ ] **QA-01**: Live end-to-end booking tested on the NSI Squarespace or WordPress site with the embedded widget
- [ ] **QA-02**: Confirmation `.ics` attachment verified to import correctly in Gmail web, Gmail iOS, Apple Mail, and Outlook
- [ ] **QA-03**: `mail-tester.com` run against confirmation and reminder emails returns a score of 9/10 or better
- [ ] **QA-04**: Slot computation smoke-tested across a DST transition (create bookings spanning March 8 2026 and Nov 1 2026)
- [ ] **QA-05**: Mobile rendering verified at 320px, 768px, and 1024px widths on both the hosted page and embedded widget
- [ ] **QA-06**: Cross-tenant RLS manually probed (second seeded account cannot see first account's data)
- [ ] **QA-07**: `FUTURE_DIRECTIONS.md` written to the repo root covering known limitations, assumptions, future improvements, and technical debt (per CLAUDE.md)
- [ ] **QA-08**: Andrew signs off that the tool works end-to-end for his own NSI bookings

## v2 Requirements

Deferred to a future milestone. Tracked but not in the current roadmap.

### Client Onboarding

- **ONBOARD-01**: Owner signup flow (create account, pick subdomain slug, set TZ, verify email)
- **ONBOARD-02**: Andrew (platform admin) can provision new client accounts via an admin UI
- **ONBOARD-03**: Onboarding walkthrough for new owners (event type template, availability preset, embed snippet)

### Trade-Vertical Differentiators

- **TRADE-01**: ZIP-code service-area gating — owner defines service area by ZIP; booker enters ZIP; out-of-area bookers see a friendly "out of area" message
- **TRADE-02**: Photo upload in booking form (stored in Supabase Storage with a size/count cap)
- **TRADE-03**: Urgency tier selector on the booking form ("Emergency / This week / Can wait") stored on the booking

### Notifications

- **NOTIF-01**: SMS reminders (Twilio integration)
- **NOTIF-02**: Configurable reminder timing per event type (e.g., 48h + 2h)
- **NOTIF-03**: Resend bounce/complaint webhook handler

### Analytics & Admin

- **ADMIN-01**: Owner analytics dashboard (bookings over time, conversion on booking page views)
- **ADMIN-02**: Manual booking entry (owner adds a booking on behalf of a phone caller)
- **ADMIN-03**: Webhooks out on booking creation/cancellation for integration with external CRMs
- **ADMIN-04**: Per-event-type availability schedules (override account-wide rules)

### Branding (Advanced)

- **BRAND-V2-01**: Custom subdomain per account (`book.clientsite.com`) via CNAME
- **BRAND-V2-02**: Font selector in branding settings
- **BRAND-V2-03**: Custom thank-you page redirect after booking

### Address & Forms

- **FORM-V2-01**: Google Places address autocomplete on booking form
- **FORM-V2-02**: Conditional custom questions (show Q2 only if Q1 answered a certain way)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Google Calendar / Outlook / iCloud sync | Andrew explicitly chose Supabase as the sole availability source — avoids OAuth and sync failure modes |
| Stripe / paid bookings | Trade contractors don't charge for quote consultations; removes PCI scope from v1 |
| Custom CSS white-label | Support burden too high for the value; logo + color covers 95% of branding needs |
| Round-robin / team scheduling | Anti-feature — targets enterprises, not solo trade contractors |
| Workflow builder | Anti-feature — n8n exists for this; keeps the product focused |
| Video conferencing integration (Zoom/Meet/Teams) | Trade bookings are in-person; not relevant |
| Recurring bookings | Trade bookings are one-off jobs, not standing appointments |
| Waitlists | Complexity not justified by demand in this vertical |
| Group bookings (multiple attendees) | Not a trade-contractor use case |
| Mobile native app | Web-only — widget + hosted page covers all use cases |
| Two-way SMS chat | Pushes into messaging-platform territory; out of scope |
| Configurable reminder count (24h + 1h + etc.) | v1 ships a single 24h reminder; multi-reminder deferred |
| Temporal (JS proposal) | v1 uses `date-fns v4 + @date-fns/tz`; re-evaluate when Temporal ships natively in all runtimes |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| EVENT-01 | Phase 3 | Pending |
| EVENT-02 | Phase 3 | Pending |
| EVENT-03 | Phase 3 | Pending |
| EVENT-04 | Phase 3 | Pending |
| EVENT-05 | Phase 3 | Pending |
| EVENT-06 | Phase 3 | Pending |
| AVAIL-01 | Phase 4 | Pending |
| AVAIL-02 | Phase 4 | Pending |
| AVAIL-03 | Phase 4 | Pending |
| AVAIL-04 | Phase 4 | Pending |
| AVAIL-05 | Phase 4 | Pending |
| AVAIL-06 | Phase 4 | Pending |
| AVAIL-07 | Phase 4 | Pending |
| AVAIL-08 | Phase 4 | Pending |
| AVAIL-09 | Phase 4 | Pending |
| BOOK-01 | Phase 5 | Pending |
| BOOK-02 | Phase 5 | Pending |
| BOOK-03 | Phase 5 | Pending |
| BOOK-04 | Phase 5 | Pending |
| BOOK-05 | Phase 5 | Pending |
| BOOK-06 | Phase 5 | Pending |
| BOOK-07 | Phase 5 | Pending |
| EMAIL-01 | Phase 5 | Pending |
| EMAIL-02 | Phase 5 | Pending |
| EMAIL-03 | Phase 5 | Pending |
| EMAIL-04 | Phase 5 | Pending |
| EMAIL-05 | Phase 8 | Pending |
| EMAIL-06 | Phase 6 | Pending |
| EMAIL-07 | Phase 6 | Pending |
| EMAIL-08 | Phase 8 | Pending |
| LIFE-01 | Phase 6 | Pending |
| LIFE-02 | Phase 6 | Pending |
| LIFE-03 | Phase 6 | Pending |
| LIFE-04 | Phase 6 | Pending |
| LIFE-05 | Phase 6 | Pending |
| BRAND-01 | Phase 7 | Pending |
| BRAND-02 | Phase 7 | Pending |
| BRAND-03 | Phase 7 | Pending |
| BRAND-04 | Phase 7 | Pending |
| EMBED-01 | Phase 7 | Pending |
| EMBED-02 | Phase 7 | Pending |
| EMBED-03 | Phase 7 | Pending |
| EMBED-04 | Phase 7 | Pending |
| EMBED-05 | Phase 7 | Pending |
| EMBED-06 | Phase 7 | Pending |
| EMBED-07 | Phase 9 | Pending |
| EMBED-08 | Phase 7 | Pending |
| DASH-01 | Phase 2 | Complete |
| DASH-02 | Phase 8 | Pending |
| DASH-03 | Phase 8 | Pending |
| DASH-04 | Phase 8 | Pending |
| INFRA-01 | Phase 8 | Pending |
| INFRA-02 | Phase 8 | Pending |
| INFRA-03 | Phase 8 | Pending |
| INFRA-04 | Phase 8 | Pending |
| INFRA-05 | Phase 8 | Pending |
| QA-01 | Phase 9 | Pending |
| QA-02 | Phase 9 | Pending |
| QA-03 | Phase 9 | Pending |
| QA-04 | Phase 9 | Pending |
| QA-05 | Phase 9 | Pending |
| QA-06 | Phase 9 | Pending |
| QA-07 | Phase 9 | Pending |
| QA-08 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 73 total
- Mapped to phases: 73
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-18*
*Last updated: 2026-04-24 after Phase 2 completion — AUTH-01..04 + DASH-01 marked Complete*
