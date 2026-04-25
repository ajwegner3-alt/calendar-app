# Roadmap: Calendar App (NSI Booking Tool)

**Created:** 2026-04-18
**Depth:** standard
**Mode:** yolo (parallelization enabled)
**Total phases:** 9
**v1 requirement coverage:** 73 / 73 mapped

## Overview

A multi-tenant Calendly-style booking tool for trade contractors. v1 ships Andrew's single NSI account end-to-end (schema is multi-tenant from day one; signup/onboarding UI is deferred to v2). Phases follow the dependency chain identified in research: foundation -> auth -> what-can-be-booked (event types) -> when-it's-bookable (availability engine) -> the booking transaction (public flow + email + .ics) -> lifecycle (cancel/reschedule) -> distribution (widget + branding) -> hardening + reminders + bookings dashboard list -> manual QA sign-off.

Critical pitfalls (double-booking race, timezone/DST, service-role misuse, RLS gaps) are front-loaded into Phase 1 so later phases never re-open foundational decisions.

## Parallelization Notes

- **Phases 1 -> 2 -> 3** are sequential (each blocks the next).
- **Phase 4 (Availability Engine)** can begin in parallel with Phase 3 once Phase 1 lands, because slot computation only needs `availability_rules`, `date_overrides`, `bookings`, and `accounts` tables. Recommended: run Phase 3 and Phase 4 in parallel.
- **Phase 5 (Public Booking Flow)** depends on both Phase 3 (event types exist) and Phase 4 (slot API exists). Cannot start until both finish.
- **Phases 6 (Lifecycle), 7 (Widget + Branding), 8 (Reminders + Hardening + Dashboard list)** can all proceed in parallel after Phase 5 lands. They touch different surfaces (token routes, embed routes, cron + dashboard list) and only converge at integration.
- **Phase 9 (Manual QA)** is sequentially last and gated by Andrew's sign-off.

## Phases

### Phase 1: Foundation

**Goal:** Multi-tenant Supabase + Next.js scaffold is live on Vercel with race-safe, timezone-correct, RLS-locked data layer.

**Dependencies:** None.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06

**Success criteria:**
1. Visiting the deployed Vercel URL returns a working Next.js 15 App Router page connected to the Supabase `calendar` project.
2. All 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`) exist with `timestamptz` columns and IANA TZ strings on `accounts` and `bookings`.
3. Two parallel `INSERT`s into `bookings` for the same `(event_type_id, start_at)` with `status='confirmed'` produce exactly one success and one constraint violation (DB-level race guard verified).
4. Anonymous Supabase client cannot read or write any table (RLS verified); service-role client is importable only from server modules (`server-only` gate).
5. Andrew's account row exists in `accounts` with `timezone = 'America/Chicago'`.

**Research flag:** None (standard Next 15 + `@supabase/ssr` scaffolding, STACK research sufficient). Verify pg_cron availability on Supabase Free tier opportunistically here.

**Plans:** 3 plans

Plans:
- [ ] 01-PLAN-01-scaffold-and-deploy.md — Next 16 scaffold, GitHub repo, first Vercel deploy before schema
- [ ] 01-PLAN-02-schema-migrations.md — Supabase CLI + migrations (6 tables, RLS, storage bucket, seed)
- [ ] 01-PLAN-03-tests-and-readme.md — Vitest harness + race-guard + RLS tests, README, final deploy

---

### Phase 2: Owner Auth + Dashboard Shell

**Goal:** Andrew can log in, stay logged in, and reach an authenticated dashboard with navigation.

**Dependencies:** Phase 1 (needs `accounts` + Supabase Auth wired).

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-01

**Success criteria:**
1. Andrew can log in at `/app/login` with his email + password and lands on the dashboard.
2. Hitting any `/app/*` route while logged out redirects to `/app/login`.
3. Andrew's session survives a browser refresh (cookies set via `@supabase/ssr`).
4. Logged-in dashboard shows nav links to Event Types, Availability, Branding, and Bookings (links can stub to empty pages this phase).
5. A logout control returns Andrew to `/app/login` and clears the session.

**Research flag:** None.

**Plans:** 4 plans

Plans:
- [ ] 02-PLAN-01-login-and-auth-actions.md — Install deps + shadcn + CSS vars + login page + Server Action + signout route (AUTH-01, AUTH-02)
- [ ] 02-PLAN-02-dashboard-shell.md — Shell layout with sidebar + welcome card + 4 nav stubs + unlinked page (DASH-01, AUTH-02)
- [ ] 02-PLAN-03-proxy-gate-and-rls-test.md — proxy.ts 3-line gate + signInAsNsiOwner helper + authenticated-owner RLS test (AUTH-04)
- [ ] 02-PLAN-04-auth-user-provisioning.md — Andrew creates auth user + disables email confirm + orchestrator MCP-links UUID + end-to-end smoke (AUTH-01..04, DASH-01 live-verified)

---

### Phase 3: Event Types CRUD

**Goal:** Andrew can define and manage the things people book (name, slug, duration, custom questions).

**Dependencies:** Phase 2 (dashboard shell + RLS-scoped client).

**Requirements:** EVENT-01, EVENT-02, EVENT-03, EVENT-04, EVENT-05, EVENT-06

**Success criteria:**
1. Andrew can create an event type with name, URL slug, duration, and description from the dashboard.
2. Andrew can edit, soft-delete, and toggle active/inactive any event type he owns.
3. Slug uniqueness is enforced per account; collisions surface a clean validation error in the form.
4. Andrew can add/edit/remove custom questions (label, type, required) per event type, persisted as jsonb.
5. Inactive event types do not appear on any future public listing or booking page.

**Research flag:** None. Can run in parallel with Phase 4 after Phase 2 lands.

---

### Phase 4: Availability Engine

**Goal:** Given an event type and date range, the system returns the correct list of bookable UTC slots, accounting for rules, overrides, buffers, notice windows, daily caps, existing bookings, and DST transitions.

**Dependencies:** Phase 1 (needs `availability_rules`, `date_overrides`, `bookings`, `accounts`).

**Requirements:** AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-04, AVAIL-05, AVAIL-06, AVAIL-07, AVAIL-08, AVAIL-09

**Success criteria:**
1. Andrew can define weekly recurring availability per weekday (open/closed, start/end, multiple windows per day) from the dashboard.
2. Andrew can add per-date overrides that block a day entirely or replace its rules.
3. `/api/slots` returns a UTC slot list that correctly subtracts existing bookings, applies pre/post buffers, honors min-notice and max-advance windows, and enforces the daily cap.
4. Slot computation across the March 8 2026 (spring-forward) and Nov 1 2026 (fall-back) US DST transitions matches expected slot counts in automated unit tests (no missing or duplicate slots at the transition boundary).
5. Andrew can set buffer minutes, min-notice hours, max-advance days, and daily cap from the dashboard, and changes immediately reflect in `/api/slots`.

**Research flag:** YES - needs `/gsd:research-phase` on `@date-fns/tz` v4 API and slot-generation algorithm before plan-phase. Biggest bug hotspot in the project. Can run in parallel with Phase 3.

---

### Phase 5: Public Booking Flow + Confirmation Email + .ics

**Goal:** A visitor can land on a hosted booking page, pick a slot, fill the form, and walk away with a confirmation email containing a working .ics invite. Andrew gets a notification email with the booker's answers.

**Dependencies:** Phase 3 (event types exist), Phase 4 (slot API exists).

**Requirements:** BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05, BOOK-06, BOOK-07, EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-04

**Success criteria:**
1. A visitor (no auth) can navigate to `/[account]/[event-slug]`, see slots in their browser-detected local timezone, pick a date and a time, and submit a booking with name/email/phone + custom-question answers.
2. Two simultaneous submissions for the same slot produce exactly one confirmed booking; the loser sees a clean 409 error UI prompting them to pick a new slot.
3. The booker receives a confirmation email (via `@nsi/email-sender` + Resend) within seconds, containing booking details, cancel link, reschedule link, and a `.ics` attachment with `METHOD:REQUEST` and a stable UID.
4. The `.ics` attachment, when manually opened, imports correctly into Gmail web with the right title, time, and timezone.
5. Andrew receives an owner notification email containing the booking details and the booker's answers to all custom questions.
6. The booking form is protected by Cloudflare Turnstile and rejects submissions that fail the challenge.

**Research flag:** YES - needs `/gsd:research-phase` on `.ics` `METHOD:REQUEST`/VTIMEZONE handling across mail clients and the current `@nsi/email-sender` attachment API shape before plan-phase.

---

### Phase 6: Cancel + Reschedule Lifecycle

**Goal:** A booker can cancel or reschedule via tokenized email links without logging in; both parties get notified; tokens are secure.

**Dependencies:** Phase 5 (bookings + email pipeline must exist).

**Requirements:** LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, EMAIL-06, EMAIL-07

**Success criteria:**
1. The cancel link in a confirmation email lands on `/cancel/[token]` and, when confirmed, marks the booking cancelled and sends both parties a cancellation email.
2. The reschedule link lands on `/reschedule/[token]`, lets the booker pick a new available slot from the same event type, and on confirmation moves the booking and sends both parties a reschedule email with a fresh `.ics`.
3. Tokens are stored as SHA-256 hashes in the DB; raw tokens appear only in emails; tokens are invalidated on status change and after the appointment passes.
4. The cancel endpoint is rate-limited per IP, returning a friendly throttling response on enumeration attempts.
5. Andrew can cancel any booking on his account from the dashboard bookings detail view (DASH bookings list itself lives in Phase 8; this is the cancel action plumbing).

**Research flag:** None. Can run in parallel with Phases 7 and 8.

---

### Phase 7: Embeddable Widget + Per-Account Branding

**Goal:** Andrew can drop a one-line snippet into the NSI Squarespace/WordPress site and visitors get a branded, auto-resizing booking widget. Branded emails too.

**Dependencies:** Phase 5 (booking flow must work in a non-embed context first).

**Requirements:** BRAND-01, BRAND-02, BRAND-03, BRAND-04, EMBED-01, EMBED-02, EMBED-03, EMBED-04, EMBED-05, EMBED-06, EMBED-08

**Success criteria:**
1. Andrew can upload a logo and pick a primary color in dashboard settings; the hosted booking page, embed page, and outgoing emails all render with that branding.
2. `/embed/[account]/[event-slug]` renders a chromeless picker + form (no site nav, no app chrome) and is the only route with `Content-Security-Policy: frame-ancestors *` and no `X-Frame-Options` header.
3. Including `<script src=".../widget.js">` and a `<div data-nsi-calendar="...">` on a third-party page injects a working iframe that auto-resizes to content height via the `nsi-booking:height` postMessage protocol.
4. The dashboard shows a copy-paste embed snippet (script + div) and a raw `<iframe>` fallback snippet for each active event type.
5. `/[account]` lists all of Andrew's active event types with links to the per-event booking pages.

**Research flag:** YES - needs `/gsd:research-phase` on Next 15 per-route CSP/header config and serving `widget.js` as a static asset on Vercel before plan-phase. Can run in parallel with Phases 6 and 8.

Note: `EMBED-07` (live verification on a real Squarespace/WordPress site) is intentionally deferred to Phase 9 because it requires manual UI work on Andrew's live sites.

---

### Phase 8: Reminders Cron + Hardening + Dashboard Bookings List

**Goal:** Reminders fire reliably 24h before appointments; production is hardened (rate limits, deliverability, RLS audit); Andrew has a real bookings dashboard.

**Dependencies:** Phase 5 (bookings exist), Phase 6 (status field is meaningful), Phase 7 (branding feeds into reminder email visuals).

**Requirements:** EMAIL-05, EMAIL-08, INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, DASH-02, DASH-03, DASH-04

**Success criteria:**
1. Vercel Cron hits `/api/cron/send-reminders` hourly, authenticated by `CRON_SECRET`; each booking starting in the next 24 hours with `reminder_sent_at IS NULL` is claimed via compare-and-set UPDATE and receives exactly one reminder email even if the cron is invoked twice in a row.
2. Bookings created inside the 24h window receive their reminder email immediately at creation (do not wait for the next cron tick).
3. The sending domain has verified SPF, DKIM, and DMARC DNS; sending the confirmation and reminder emails through `mail-tester.com` returns a score of 9/10 or better.
4. `/api/bookings` is rate-limited per IP and rejects abusive request patterns with a 429.
5. An automated RLS test matrix proves a second seeded tenant cannot read or write the first tenant's data via the anon client, the user-scoped client, or unscoped queries.
6. The dashboard bookings page lists upcoming and past bookings with name, email, phone, event type, start time, status, and custom-question answers; filterable by status and date range; clicking a row shows full detail.

**Research flag:** YES - needs `/gsd:research-phase` on current Vercel Cron hobby-tier interval limits and Resend domain-verification DNS format before plan-phase. Can run in parallel with Phases 6 and 7.

---

### Phase 9: Manual QA & Verification

**Goal:** Andrew personally verifies the tool works end-to-end on his real NSI sites, in real email clients, on real devices, and signs off that v1 is shippable.

**Dependencies:** All prior phases.

**Requirements:** EMBED-07, QA-01, QA-02, QA-03, QA-04, QA-05, QA-06, QA-07, QA-08

**Success criteria:**
1. The widget is embedded on a live NSI Squarespace or WordPress page; an end-to-end booking is completed there with no JS errors in the host page console.
2. The confirmation `.ics` opens correctly in Gmail web, Gmail iOS, Apple Mail, and Outlook (title, time, timezone, organizer all correct).
3. `mail-tester.com` returns 9/10 or higher for both confirmation and reminder emails.
4. A booking that spans the March 8 2026 or Nov 1 2026 DST transition shows the correct local times to Andrew (owner) and a booker in a different timezone.
5. The hosted booking page and embedded widget both render correctly at 320px, 768px, and 1024px viewport widths.
6. A second seeded test account, when probed manually, cannot see Andrew's bookings, event types, availability, or branding.
7. `FUTURE_DIRECTIONS.md` is committed to the repo root covering known limitations, assumptions, future improvements, and technical debt.
8. Andrew explicitly signs off that the tool works for his own NSI bookings.

**Research flag:** None. Sequentially last.

---

## Progress

| Phase | Goal | Status |
|-------|------|--------|
| 1 - Foundation | Multi-tenant Supabase + Next.js scaffold with race/TZ/RLS guards | ✓ Complete (2026-04-19) |
| 2 - Owner Auth + Dashboard Shell | Andrew can log in to a navigable dashboard | ✓ Complete (2026-04-24) |
| 3 - Event Types CRUD | Andrew can define what people book | Pending |
| 4 - Availability Engine | Slot API returns correct UTC slots, DST-safe | Pending |
| 5 - Public Booking Flow + Email + .ics | Visitor books a slot and gets a calendar invite | Pending |
| 6 - Cancel + Reschedule Lifecycle | Booker manages their own booking via email links | Pending |
| 7 - Widget + Branding | Branded embeddable widget for client sites | Pending |
| 8 - Reminders + Hardening + Dashboard List | Reliable reminders, hardened production, bookings UI | Pending |
| 9 - Manual QA & Verification | Andrew signs off v1 is shippable | Pending |

## Coverage Summary

- v1 requirements: 73
- Mapped to phases: 73
- Unmapped: 0
- Duplicated: 0

All v1 requirements map to exactly one phase. Phase mappings match the suggested traceability in REQUIREMENTS.md (no overrides needed).

---
*Roadmap created: 2026-04-18*
