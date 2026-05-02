# Requirements: Calendar App v1.3 — Bug Fixes + Polish

**Defined:** 2026-05-02
**Core Value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Milestone shape:** Surgical bug-fix and polish milestone surfaced from Andrew's post-v1.2 live use of the production app. No new architecture, no new packages, no new domain capabilities. All requirements target existing surfaces. REQ-IDs continue from v1.1+v1.2 category prefixes where applicable; new prefixes for net-new categories.

## v1.3 Requirements

8 requirements across 3 categories. Each maps to roadmap phases.

### Auth

- [ ] **AUTH-18**: Clicking the "Sign up" link from `/login` navigates to `/signup` (currently the click does nothing — anchor href / Next.js Link routing bug)
- [ ] **AUTH-19**: Sign-in page (`/login`) layout has the informational pane on the LEFT and the email/password form on the RIGHT (current layout is reversed; flip the Cruip split-panel direction)
- [ ] **AUTH-20**: Authenticated owner sessions persist for 30 days via Supabase sliding refresh window (currently re-prompts to log in too frequently; configure `expiry_seconds` and refresh-token rotation accordingly)

### Public Booking

- [ ] **PUB-13**: On mobile viewports (< 768px) the slot picker calendar widget renders horizontally centered within the public booking card on `/[account]/[event-slug]` (currently off-center)
- [ ] **PUB-14**: On desktop viewports the timezone hint ("Times shown in America/Chicago") and the "Pick a date to see available times:" instruction do not visually overlap the calendar widget on `/[account]/[event-slug]` (current layout collision; fix container width / spacing / z-order)
- [ ] **PUB-15**: The public account index page (`/[account]`) lists every public event type for that account as a selectable card (logo / event name / duration / "Book this" CTA → routes to `/[account]/[event-slug]`); replaces the current bare landing-page state where bookers must already know the event slug

### Owner UI

- [ ] **OWNER-12**: The Owner Home tab monthly calendar (the day-grid on `/app/home` with the day-detail Sheet drawer) does NOT render orange (`#F97316` accent) on day buttons in any state (default / hover / today / selected / has-bookings); replace with grey or NSI blue
- [ ] **OWNER-13**: The event-type edit page (`/app/event-types/[id]`) renders a copyable booking-link field at the top of the form showing the public per-event URL (`https://<host>/<account-slug>/<event-slug>`) with a copy-to-clipboard button

## Future Requirements (deferred to v1.4)

All five v1.2 carry-over clusters punted at v1.3 scoping. Tracked in `FUTURE_DIRECTIONS.md` §8 as canonical enumeration.

### Marathon QA

- **QA-09**: Signup E2E (production)
- **QA-10**: Multi-tenant UI walkthrough (3 accounts)
- **QA-11**: Capacity=3 race E2E
- **QA-12**: 3-account branded smoke
- **QA-13**: EmbedCodeDialog at 320 / 768 / 1024 viewports
- **QA-14..34**: ~21 per-phase manual checks accumulated through v1.1 + v1.2

### Infrastructure

- **INFRA-01**: Resend migration (replaces Gmail SMTP; ~$10/mo for 5k emails; closes EMAIL-08)
- **INFRA-02**: Vercel Pro upgrade + flip cron from `0 13 * * *` daily → `0 * * * *` hourly
- **INFRA-03**: Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo)

### Auth additions

- **AUTH-21**: OAuth signup (Google / GitHub) — `/auth/confirm` already supports the verifyOtp pattern
- **AUTH-22**: Magic-link / passwordless login
- **AUTH-23**: Hard-delete cron purge (v1.1 ships soft-delete only)
- **AUTH-24**: Soft-delete grace period (account restore on re-login within N days)
- **AUTH-25**: Slug 301 redirect for old slugs after change
- **AUTH-26**: Onboarding analytics event log
- **AUTH-27**: Constant-time delay on signup + forgot-password forms (P-A1 timing-oracle hardening)

### Brand asset

- **BRAND-22**: Final NSI mark image swap (`public/nsi-mark.png` placeholder, 105 bytes solid-navy)
- **BRAND-23**: Add NSI mark image to "Powered by NSI" footer on web + emails (currently text-only per v1.2 EMAIL-19 + PUB-04)

### Carry-over tech debt

- **DEBT-01**: `react-hooks/incompatible-library` warning on `event-type-form.tsx:99` — refactor to `useWatch`
- **DEBT-02**: ~22 pre-existing `tsc --noEmit` test-mock alias errors in `tests/`
- **DEBT-03**: `generateMetadata` double-load on public booking page — wrap in `cache()`
- **DEBT-04**: Supabase service-role key rotation (legacy JWT → `sb_secret_*`)
- **DEBT-05**: `rate_limit_events` test DB cleanup gap (60-90s cooldown between vitest runs)
- **DEBT-06**: `/app/unlinked` UX hole for soft-deleted accounts on re-login
- **DEBT-07**: 2 comment-only files with inert references to dropped columns; `AccountSummary` cosmetic field cleanup

## Out of Scope

Explicit boundaries — documented to prevent scope creep INTO v1.3 (the carryover above is deferred but tracked; the items below are anti-features and not on any roadmap).

| Feature | Reason |
|---------|--------|
| Stripe / billing / monetization | Distribution-first posture; revenue layer reserved for a separate milestone after multi-user proves out |
| Google Calendar / iCal / Outlook two-way sync | Andrew explicitly wants Supabase as sole source of truth — no external calendar OAuth |
| Custom subdomains (`book.clientsite.com`) | Path-based URLs (`app.com/[account]/[event-slug]`) sufficient; DNS work indefinitely deferred |
| Custom CSS white-label | Logo + brand color suffices; arbitrary CSS adds support burden |
| Configurable reminder timing | Hardcoded 24h before appointment |
| Per-event-type availability schedules | Account-wide availability applied to all event types |
| Multiple reminders (24h + 1h) | Single 24h reminder |
| SMS notifications | Email only |
| Mobile app | Web-only (widget + hosted page) |
| Round-robin / team scheduling | Anti-feature — targets enterprises, not solo trade contractors |
| Workflow builder | Anti-feature — n8n exists for this |
| Video conferencing integration | Trade bookings are in-person |
| Recurring bookings | Trade bookings are one-off jobs |
| Waitlists / Group bookings | Demand not justified in this vertical |
| Two-way SMS chat | Pushes into messaging-platform territory |
| Temporal (JS proposal) | v1 uses `date-fns v4 + @date-fns/tz`; revisit when Temporal ships natively |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-18 | Phase 22 | Pending |
| AUTH-19 | Phase 22 | Pending |
| AUTH-20 | Phase 22 | Pending |
| PUB-13 | Phase 23 | Pending |
| PUB-14 | Phase 23 | Pending |
| PUB-15 | Phase 23 | Pending |
| OWNER-12 | Phase 24 | Pending |
| OWNER-13 | Phase 24 | Pending |

**Coverage:**
- v1.3 requirements: 8 total
- Mapped to phases: 8 / Unmapped: 0 ✓

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 after v1.3 roadmap created — all 8 requirements mapped to Phases 22-24*
