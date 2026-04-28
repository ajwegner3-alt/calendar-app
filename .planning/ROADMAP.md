# Roadmap: Calendar App (NSI Booking Tool)

A multi-tenant Calendly-style booking tool for trade contractors. v1.0 shipped 2026-04-27 with single-tenant production deployment + multi-tenant schema. v1.1 opens the tool to public signup, closes a prod double-booking observation with per-event-type capacity, and rebrands every owner-facing surface using the Cruip "Simple Light" tailwind-landing-page aesthetic.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- 🚧 **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (in progress, started 2026-04-27).

---

## v1.1 Overview

v1.1 layers three tightly-scoped capability areas on top of the locked v1.0 foundation: (1) public multi-user signup + onboarding wizard with working email verification + password reset, (2) per-event-type booking capacity with race-safe DB enforcement that root-causes and replaces the v1.0 partial-unique-index pattern, and (3) a Cruip "Simple Light"-styled visual overhaul across all 5 owner-facing and public surfaces (dashboard, public booking page, embed widget, transactional emails, auth pages). Free tier — no Stripe in v1.1. v1.0 marathon QA carry-overs (EMAIL-08, QA-01..06) are RE-DEFERRED to v1.2 by project-owner discretion.

## v1.1 Parallelization Notes

Phases execute strictly sequentially: **Phase 10 → Phase 11 → Phase 12 → Phase 13**. No within-milestone parallelization because each phase depends structurally on the prior:

- Phase 11's capacity migration is easier to land while only 1 tenant exists in production (post-Phase 10 multi-user volume increases the risk surface for `event_types` schema changes).
- Phase 12's IA refactor needs the Profile route (Phase 10 ACCT-01) AND the `max_bookings_per_slot` column (Phase 11 CAP-02) to ship cleanly.
- Phase 13 manual QA needs all three capability areas wired before walkthrough is meaningful.

Within each phase, plan-level parallelization is enabled via `parallelization=true` (per `config.json`). Plan-phase will derive parallelizable plan groupings during planning.

---

## Phases

- [ ] **Phase 10: Multi-User Signup + Onboarding** — Public `/signup`, email verification, atomic account provisioning, 3-step onboarding wizard, password reset, profile settings.
- [ ] **Phase 11: Booking Capacity + Double-Booking Root-Cause Fix** — Reproduce the prod double-booking, replace partial-unique-index with race-safe N-per-slot mechanism, expose `max_bookings_per_slot` per event type.
- [ ] **Phase 12: Branded UI Overhaul (5 Surfaces)** — Cruip "Simple Light" aesthetic across dashboard + public booking + embed + emails + auth, plus per-account `background_color`/`background_shade` tokens, sidebar IA refactor, Home tab monthly calendar.
- [ ] **Phase 13: Manual QA + Andrew Ship Sign-Off** — End-to-end signup walkthrough, multi-tenant UI isolation check, capacity E2E, branded smoke across 3 test accounts, explicit "ship v1.1" sign-off.

---

## Phase Details

### Phase 10: Multi-User Signup + Onboarding

**Goal**: A new visitor can sign up, verify their email, complete a 3-step onboarding wizard, and land on a working dashboard with a public booking link of their own — without Andrew touching a database.

**Depends on**: Nothing (v1.0 shipped; this is the first v1.1 phase).

**Requirements** (19): AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05, ONBOARD-06, ONBOARD-07, ONBOARD-08, ONBOARD-09, ACCT-01, ACCT-02, ACCT-03

**Success Criteria** (what must be TRUE):
  1. A brand-new visitor can hit `/signup`, submit email + password, receive a Supabase verification email, click the link, complete the 3-step onboarding wizard (display name + slug → timezone confirm → first event type), and arrive at a populated dashboard with their own bookable URL — end-to-end, no manual SQL.
  2. A signed-up user who forgot their password can request a reset email at `/forgot-password`, click the link, set a new password at `/auth/reset-password`, and log in — closing the v1.0 BLOCKER (`/auth/callback` 404).
  3. The existing single-tenant owner (`ajwegner3@gmail.com`) continues to log in successfully after email-confirmation is re-enabled (pre-flight UPDATE on `email_confirmed_at` if null per P-A8).
  4. A user can visit `/app/settings/profile` to view their email, change password (with current-password challenge), edit display name, view their slug, and soft-delete their account — soft-deleted accounts return 404 on all public surfaces.
  5. The signup form does not leak whether an email is already registered (generic "If your email is registered..." message) and `/api/auth/*` endpoints are rate-limited per IP.

**Research flag**: ⚠ **Decision-required-during-planning** (no separate research-phase needed — well-documented across 4 research files, but plan-phase must commit on three architectural decisions):
  - **Account auto-provisioning pattern**: Postgres `on auth.users insert` trigger (atomicity-first, STACK.md/PITFALLS.md pick) vs. Server Action after `/auth/confirm` (UX-error-clarity-first, ARCHITECTURE.md pick). Document the choice.
  - **Gmail SMTP quota plan** (highest under-mitigated v1.1 risk per P-A12): cap signups at low daily rate / migrate to Resend or Postmark / wire quota alert. Decision required BEFORE Phase 10 ships.
  - **Pre-flight check on Andrew's `email_confirmed_at`** (P-A8): MUST run `select email, email_confirmed_at from auth.users where email='ajwegner3@gmail.com'` and UPDATE if null BEFORE flipping the email-confirm toggle. Otherwise Andrew gets locked out.

**Internal build order** (locked guidance from SUMMARY.md §Roadmap Implications + ARCHITECTURE.md §C.8 — plan-phase uses this for plan-breakdown):
  1. `RESERVED_SLUGS` consolidation → `lib/reserved-slugs.ts` FIRST (slug picker is the 3rd consumer; consolidating now avoids drift).
  2. `/auth/confirm` Route Handler (`verifyOtp` pattern) + `/forgot-password` + `/auth/reset-password` (fixes v1.0 BLOCKER).
  3. `accounts` INSERT RLS policy migration (so onboarding can write via RLS-scoped client).
  4. `/signup` page + Supabase email-template configuration (Allowed Redirects for Vercel preview URLs).
  5. `/onboarding` 3-step wizard.
  6. `provisionAccount` + `setDefaultAvailability` + `createFirstEventType` Server Actions (or Postgres trigger, per decision above).
  7. `/app/page.tsx` redirect change (0 accounts → `/onboarding`).
  8. RLS cross-tenant matrix test extension to N=3 tenants (gates Phase 10 close).

**Plans**: 9 plans in 6 waves (per `/gsd:plan-phase 10` 2026-04-28).
  - [ ] 10-01-PLAN.md — RESERVED_SLUGS consolidation (Wave 1)
  - [ ] 10-02-PLAN.md — /auth/confirm + /forgot-password + /auth/reset-password + /auth/verify-email + /auth/auth-error (Wave 2)
  - [ ] 10-03-PLAN.md — accounts INSERT/UPDATE RLS + provisioning trigger + onboarding state columns (Wave 2)
  - [ ] 10-04-PLAN.md — Gmail SMTP quota cap (200/day) + 80% warning + fail-closed (Wave 2)
  - [ ] 10-05-PLAN.md — /signup page + P-A8 pre-flight + Supabase email-confirm toggle + auth rate limits (Wave 3, NOT autonomous — pre-flight checkpoint)
  - [ ] 10-06-PLAN.md — 3-step onboarding wizard + slug picker + provisioning Server Actions + welcome email (Wave 4)
  - [ ] 10-07-PLAN.md — /app/settings/profile + soft-delete + public-surface 404 enforcement (Wave 4)
  - [ ] 10-08-PLAN.md — Email change with re-verification (Wave 5; carved out per CONTEXT.md Specifics)
  - [ ] 10-09-PLAN.md — RLS cross-tenant matrix N=3 extension + onboarding checklist + FUTURE_DIRECTIONS update (Wave 6, NOT autonomous — 3rd test user setup)

**Architectural decisions committed during planning:**
  1. **Account auto-provisioning pattern: Postgres trigger (stub row) + wizard UPDATE.** Trigger creates `accounts(onboarding_complete=false, slug=null)` on `auth.users` insert (atomicity-first); wizard UPDATEs to (slug=..., onboarding_complete=true) via RLS-scoped Server Action (UX-error-clarity). Resolves the friction between STACK.md/PITFALLS.md trigger preference and ARCHITECTURE.md Server-Action preference.
  2. **Gmail SMTP quota plan: Cap at 200/day + 80% warning log + fail-closed-at-cap.** Postgres-counter-backed (`email_send_log` table). Bookings/reminders bypass the guard (protect core flow). Resend migration documented as v1.2 backlog.
  3. **P-A8 pre-flight: Mandatory checkpoint task in Plan 10-05** before email-confirm toggle is flipped. Andrew runs SELECT, conditional UPDATE if null, re-SELECT to verify, then flips toggle.

---

### Phase 11: Booking Capacity + Double-Booking Root-Cause Fix

**Goal**: An owner can configure `max_bookings_per_slot` per event type (default 1, preserving v1.0 behavior) and trust that concurrent submissions cannot exceed that cap — with the v1.0 prod double-booking root-caused, documented, and definitively closed before the new mechanism ships.

**Depends on**: Phase 10 (multi-user data shape; capacity migration is easier to validate while only the seeded NSI tenant + new test tenants exist).

**Requirements** (9): CAP-01, CAP-02, CAP-03, CAP-04, CAP-05, CAP-06, CAP-07, CAP-08, CAP-09

**Success Criteria** (what must be TRUE):
  1. The 2026-04-27 prod double-booking observation is reproduced + root-caused (partial-index gap, status-filter gap, or different code path) and findings are documented in Phase 11 SUMMARY before the replacement mechanism is designed.
  2. An owner can set `max_bookings_per_slot` on any event type from the event-type form (number input, default 1, CHECK >= 1); decreasing it on an event with existing future bookings that would exceed the new cap shows a confirmation modal before save.
  3. Concurrent race test: at capacity=N with M concurrent submissions (M > N), exactly N succeed and (M − N) return 409 — verified at the `pg` driver layer (not just supabase-js HTTP serialization). The v1.0 capacity=1 race test continues to pass as a regression check.
  4. `/api/slots` excludes a slot once `confirmed_count >= max_bookings_per_slot`; `/api/bookings` 409 responses distinguish `SLOT_TAKEN` (capacity 1 hit) from `SLOT_CAPACITY_REACHED` (capacity N hit) so the booker UI can render the right message.
  5. When an owner toggles `event_types.show_remaining_capacity` ON, the booker UI displays "X spots left" on each available slot.

**Research flag**: 🔬 **YES — flag explicitly for `/gsd:research-phase` during plan-phase** (per SUMMARY.md). Two viable race-safety patterns surface in research and require a deeper commitment before plan-breakdown:
  - **Option A**: BEFORE-INSERT trigger with `pg_advisory_xact_lock(event_type_id, start_at)` (declarative, ARCHITECTURE.md/STACK.md pick).
  - **Option B**: Extended unique index with `slot_index` retry pattern (PITFALLS.md pick — keeps the v1.0 invariant style of fully index-enforced uniqueness).
  - Specifically verify: (a) is `tests/bookings.race.test.ts` at the supabase-js layer or pg-driver layer? (affects test harness reuse vs. new harness), (b) does the prod double-booking root cause point to partial-index gap or capacity gap? (drives which option is the natural successor), (c) `pg_advisory_xact_lock` interaction with Supabase pooling mode.

**Critical sequencing**: Migration applied via `npx supabase db query --linked -f` (LOCKED workaround). Drop `bookings_no_double_book` + create new mechanism MUST be in the same transaction (sub-millisecond exposure window) — or use `CREATE UNIQUE INDEX CONCURRENTLY` + `DROP INDEX` for the slot_index pattern. **CAP-01 (root-cause investigation) must lead** — do not design the replacement before reproducing the existing incident.

**Plans**: ~3-4 plans (most contained phase; one investigation + one migration + one API/UI extension + one race-test harness).

---

### Phase 12: Branded UI Overhaul (5 Surfaces)

**Goal**: Every owner-facing and public-facing surface (dashboard, public booking page, embed widget, transactional emails, auth pages) ships the Cruip "Simple Light" aesthetic — Inter font, gray-50 base, gradient accents derived from per-account `background_color` + `background_shade` tokens — with sidebar IA refactored so Settings is reachable and a new Home tab showing a monthly calendar with day-detail drawer.

**Depends on**: Phase 10 (Profile route exists for sidebar IA + auth-page restyle covers `/login` + `/signup` + `/auth/reset-password`) AND Phase 11 (capacity column lands in `event_types` before the event-type form is restyled).

**Requirements** (20): BRAND-05, BRAND-06, BRAND-07, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12, UI-13, EMAIL-09, EMAIL-10, EMAIL-11, EMAIL-12

**Success Criteria** (what must be TRUE):
  1. The dashboard renders Inter typography + `bg-gray-50` page background + a floating glass header pill + sidebar IA (Home / Event Types / Availability / Bookings / Branding / Settings, with Settings expanding in-place to Reminders + Profile) — Settings is reachable from every page.
  2. A new `/app/home` (or `/app`) Home tab renders a monthly calendar (`react-day-picker@9`) with `modifiers` highlighting days that have bookings; clicking a day opens a shadcn `Sheet` drawer listing that day's bookings with View / Cancel / Copy-link actions per row.
  3. An owner can pick a `background_color` swatch and a `background_shade` (none / subtle / bold) from `/app/branding` and see the gradient blur-circle decorative backgrounds update live across dashboard, public booking page, embed, and `/[account]` index — with `background_shade='none'` rendering a flat surface (no gradient).
  4. The public booking page, embed widget, `/[account]` index landing card, and auth pages (`/login`, `/signup`, `/auth/reset-password`) all adopt the Cruip "Simple Light" restyle with section rhythm `py-12 md:py-20`, `max-w-3xl` slot picker, and gradient backgrounds keyed off the account's branding tokens; the embed snippet dialog widens to `sm:max-w-2xl` so the snippet does not overflow at 320 / 768 / 1024 viewports.
  5. All 6 transactional emails (booker × owner × confirm/cancel/reschedule) ship a per-account branded header with the chosen gradient strategy; booker confirmation includes a plain-text alternative; the email footer includes the NSI mark image; per-template branding is visually verified across the 6-row matrix.

**Research flag**: ⚠ **Decision-required-during-planning** (planner needs to commit on two architectural decisions, but no separate research-phase needed — STACK.md and PITFALLS.md document both options with sufficient depth):
  - **Email gradient strategy**: solid-color-only across all clients (STACK.md pick — lowest risk for v1.1 given Outlook desktop + Yahoo zero gradient support) vs. VML conditional-comment fallback (ARCHITECTURE.md alternative — more visual parity with web surfaces, more QA matrix). Document the decision in Phase 12 plan.
  - **Visual regression scope** (cheap-insurance question per P-C7): pull a minimum-viable Playwright suite forward into Phase 12 prerequisites (~1 day, 5 critical screenshots × 3 viewports) OR accept that Phase 13 manual QA falls entirely on Andrew's eyes? No Playwright suite exists yet; Phase 12 is the largest visual surface in the project's history.
  - **Out of scope for this flag** but worth noting: Cruip "Simple Light" license/redistribution terms (legal check, not architectural).

**Plans**: ~5-7 plans (largest visual surface but the work splits cleanly along surface boundaries — branding tokens migration + dashboard restyle + public/embed/auth restyles can parallelize, emails restyle is its own track).

---

### Phase 13: Manual QA + Andrew Ship Sign-Off

**Goal**: Andrew personally verifies each v1.1 capability area end-to-end across the production deployment and gives explicit "ship v1.1" sign-off; FUTURE_DIRECTIONS.md is updated with anything deferred during QA.

**Depends on**: Phase 10 + Phase 11 + Phase 12 (all v1.1 capability areas wired before walkthrough begins).

**Requirements** (7): QA-09, QA-10, QA-11, QA-12, QA-13, QA-14, QA-15

**Success Criteria** (what must be TRUE):
  1. A brand-new test user completes signup → email-verify → onboarding wizard → first booking received end-to-end with no errors (QA-09).
  2. A 2nd test owner logged into the dashboard sees ZERO of Andrew's data on every surface (Home calendar, Event Types, Availability, Bookings, Branding, Settings) — multi-tenant UI isolation walkthrough complete (QA-10).
  3. Capacity end-to-end: an event with capacity=3 accepts exactly 3 bookings from different sessions; the 4th attempt returns the right `SLOT_CAPACITY_REACHED` error message in the UI (QA-11).
  4. Branded UI smoke: 3 different test accounts (different `brand_primary`, `background_color`, `background_shade` combinations) render correctly on dashboard + public booking page + embed + emails (QA-12); embed snippet dialog widening verified at 320 / 768 / 1024 viewports without horizontal overflow (QA-13).
  5. Andrew gives explicit "ship v1.1" sign-off (QA-14) and `FUTURE_DIRECTIONS.md` is updated with v1.1 carry-overs to v1.2 (QA-15).

**Scope NOT in Phase 13** (explicit RE-deferral per Andrew 2026-04-27): EMAIL-08 (SPF/DKIM/DMARC + mail-tester), QA-01..QA-06 (v1.0 marathon QA — live email-client cross-test, mail-tester scoring, DST live E2E, responsive multi-viewport pass, multi-tenant UI walkthrough). These remain in v1.2 backlog. QA-10 partially closes the v1.0 multi-tenant walkthrough as a side-effect of v1.1 multi-user work but does not retire QA-06 formally.

**Research flag**: None. Standard manual QA — no decisions required.

**Plans**: ~2-3 plans (pre-QA prerequisites + QA execution + future-directions/sign-off, mirroring Phase 9 structure).

---

## Progress

**Execution Order:** Phase 10 → Phase 11 → Phase 12 → Phase 13 (locked sequential)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Multi-User Signup + Onboarding | v1.1 | 0 / 9 | Plans created (2026-04-28) | - |
| 11. Booking Capacity + Double-Booking Fix | v1.1 | 0 / TBD | Not started | - |
| 12. Branded UI Overhaul (5 Surfaces) | v1.1 | 0 / TBD | Not started | - |
| 13. Manual QA + Andrew Ship Sign-Off | v1.1 | 0 / TBD | Not started | - |

## Coverage Summary

- v1.1 requirements: **53 total**
- Mapped to phases: **53**
- Unmapped: **0** ✓
- Phase 10: 19 requirements (AUTH-05..11, ONBOARD-01..09, ACCT-01..03)
- Phase 11: 9 requirements (CAP-01..09)
- Phase 12: 20 requirements (BRAND-05..07, UI-01..13, EMAIL-09..12)
- Phase 13: 7 requirements (QA-09..15)

---

*Roadmap last updated: 2026-04-27 — v1.1 phase structure created (Phases 10-13).*
