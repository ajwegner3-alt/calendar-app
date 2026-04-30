# Roadmap: Calendar App (NSI Booking Tool)

A multi-tenant Calendly-style booking tool for trade contractors. v1.0 shipped 2026-04-27 with single-tenant production deployment + multi-tenant schema. v1.1 opens the tool to public signup, closes a prod double-booking observation with per-event-type capacity, and rebrands every owner-facing surface using the Cruip "Simple Light" tailwind-landing-page aesthetic.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- 🚧 **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (in progress, started 2026-04-27).

---

## v1.1 Overview

v1.1 layers three tightly-scoped capability areas on top of the locked v1.0 foundation: (1) public multi-user signup + onboarding wizard with working email verification + password reset, (2) per-event-type booking capacity with race-safe DB enforcement that root-causes and replaces the v1.0 partial-unique-index pattern, and (3) a Cruip "Simple Light"-styled visual overhaul across all 5 owner-facing and public surfaces (dashboard, public booking page, embed widget, transactional emails, auth pages). Free tier — no Stripe in v1.1. v1.0 marathon QA carry-overs (EMAIL-08, QA-01..06) are RE-DEFERRED to v1.2 by project-owner discretion.

## v1.1 Parallelization Notes

Phases execute strictly sequentially: **Phase 10 → Phase 11 → Phase 12 → Phase 12.5 → Phase 12.6 → Phase 13**. No within-milestone parallelization because each phase depends structurally on the prior:

- Phase 11's capacity migration is easier to land while only 1 tenant exists in production (post-Phase 10 multi-user volume increases the risk surface for `event_types` schema changes).
- Phase 12's IA refactor needs the Profile route (Phase 10 ACCT-01) AND the `max_bookings_per_slot` column (Phase 11 CAP-02) to ship cleanly.
- Phase 12.5 extends Phase 12's branding token foundation with per-account chrome tinting — depends on Phase 12 code-complete.
- Phase 12.6 replaces Phase 12.5's color-mix approach with direct per-account color controls — depends on Phase 12.5 code-complete (ADDITIVE: does not drop 12.5 DB columns).
- Phase 13 manual QA needs all capability areas wired before walkthrough is meaningful.

Within each phase, plan-level parallelization is enabled via `parallelization=true` (per `config.json`). Plan-phase will derive parallelizable plan groupings during planning.

---

## Phases

- [✓~] **Phase 10: Multi-User Signup + Onboarding** — Code complete 2026-04-28 (9/9 plans); 6 manual checks deferred to milestone-end QA per `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`. Public `/signup`, email verification, atomic account provisioning, 3-step onboarding wizard, password reset, profile settings.
- [✓~] **Phase 11: Booking Capacity + Double-Booking Root-Cause Fix** — Code complete 2026-04-29 (8/8 plans); 4 manual checks deferred to milestone-end QA per `.planning/MILESTONE_V1_1_DEFERRED_CHECKS.md`. CAP-01 verdict (c): rescheduled-status slot reuse gap (no prod duplicates). slot_index + bookings_capacity_slot_idx replaces v1.0 bookings_no_double_book. Pitfall 4 closed. CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED branching live.
- [✓] **Phase 12: Branded UI Overhaul (5 Surfaces)** — Code complete 2026-04-29 (7/7 plans). Cruip "Simple Light" aesthetic across dashboard + public booking + embed + emails + auth, plus per-account `background_color`/`background_shade` tokens, sidebar IA refactor, Home tab monthly calendar. Chrome was locked to gray-50 by design in this phase.
- [✓] **Phase 12.5: Per-Account Heavy Chrome Theming + Header Removal + Email Token Unification** — Code complete 2026-04-29 (4/4 plans). Per-account `chrome_tint_intensity` (none/subtle/full) tints sidebar + page bg; FloatingHeaderPill removed; email senders unified on same tokens as UI.
- [✓~] **Phase 12.6: Direct Per-Account Color Controls (Page / Sidebar / Primary)** — Code complete 2026-04-29 (3/3 plans). 8/8 must_haves + 7/7 requirements verified at code level; 8 manual checks deferred to milestone-end QA. Three independent color fields ship: `sidebar_color` (sidebar bg), `background_color` (page bg), `brand_primary` wired to shadcn `--primary` CSS variable override. IntensityPicker REMOVED; 3 direct color pickers replace it. Email header band uses `sidebar_color → brand_primary → '#0A2540'` priority chain.
- [ ] **Phase 13: Manual QA + Andrew Ship Sign-Off** — End-to-end signup walkthrough, multi-tenant UI isolation check, capacity E2E, branded smoke across 3 test accounts (including all 3 per-account color controls), explicit "ship v1.1" sign-off.

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

**Plans**: 8 plans in 4 waves (per /gsd:plan-phase 11 2026-04-28). Locked decision: Option B (slot_index + extended unique index) per RESEARCH.md verdict. CAP-01 root-cause leads in Wave 1 alone.
  - [ ] 11-01-PLAN.md — CAP-01 root-cause investigation + findings + Plan 03 gate (Wave 1, NOT autonomous — verdict checkpoint)
  - [ ] 11-02-PLAN.md — Migration A: event_types capacity columns (max_bookings_per_slot + show_remaining_capacity) (Wave 2)
  - [ ] 11-03-PLAN.md — Migration B: bookings.slot_index column + bookings_capacity_slot_idx CONCURRENTLY + drop bookings_no_double_book (Wave 2; two SQL files because CONCURRENTLY cannot live in a transaction)
  - [ ] 11-04-PLAN.md — /api/bookings slot_index retry loop + CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED distinguishing (Wave 3)
  - [ ] 11-05-PLAN.md — /api/slots capacity-aware exclusion + remaining_capacity exposure + Pitfall 4 fix (status=confirmed filter) (Wave 3)
  - [ ] 11-06-PLAN.md — pg-driver race test (postgres.js dev-dep + tests/helpers/pg-direct.ts + new describe block in race-guard.test.ts) (Wave 4)
  - [ ] 11-07-PLAN.md — Event-type form: capacity input + show_remaining_capacity toggle + CAP-09 decrease-cap confirmation modal (SQL truth check) (Wave 4)
  - [ ] 11-08-PLAN.md — Booker UI: X spots left rendering + 409 message branched on response.code (Wave 4)

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

**Plans**: 6 plans in 3 waves (per /gsd:plan-phase 12 2026-04-29). Architectural decisions committed during planning: (1) email gradient strategy = solid-color-only per CONTEXT.md lock (no VML); (2) Playwright visual-regression suite DEFERRED — manual QA in Phase 13 + deploy-and-eyeball workflow per Andrew CLAUDE.md (research recommendation; defer cost ~1.5d not worth marginal coverage). Plain-text alt scope extended beyond EMAIL-10 minimum to all booker-facing emails (cancel + reschedule). Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo) deferred to v1.2 per existing pattern.
  - [ ] 12-01-PLAN.md — Branding tokens foundation (background_color + background_shade migration; GradientBackdrop + NSIGradientBackdrop primitives; /app/branding swatch + shade picker + mini-preview) (Wave 1)
  - [ ] 12-02-PLAN.md — Auth pages restyle (Cruip split-panel + NSI hero across /login + /signup + /forgot-password + /verify-email + /auth/reset-password + /auth/auth-error) (Wave 1)
  - [ ] 12-03-PLAN.md — Dashboard chrome (Inter font + bg-gray-50 + floating glass header pill + sidebar IA: Home/Event Types/Availability/Bookings/Branding/Settings with inline accordion + mobile full-screen drawer) (Wave 2)
  - [ ] 12-04-PLAN.md — Home tab (monthly calendar with capped dots + Sheet drawer with 4 row actions: View/Cancel/Copy-reschedule-link/Send-reminder; OnboardingChecklist demoted to banner) (Wave 3)
  - [ ] 12-05-PLAN.md — Public surfaces restyle (/[account] landing card + /[account]/[event-slug] booking page + /embed widget + EmbedCodeDialog widening to sm:max-w-2xl) (Wave 2)
  - [ ] 12-06-PLAN.md — Email restyle (6 transactional templates with solid-color branded header + NSI footer mark + plain-text alt on booker-facing emails) (Wave 2)

---

### Phase 12.5: Per-Account Heavy Chrome Theming + Header Removal + Email Token Unification

**Goal**: An owner who picks a brand color and intensity sees that color reflected across the entire dashboard chrome — sidebar, page background — with auto-WCAG text contrast flipping, configurable per-account intensity (none/subtle/full), and email branding that derives from the same tokens (no separate email-branding user controls). The floating header pill is removed everywhere; sidebar trigger moves to a plain mobile-only hamburger.

**Depends on**: Phase 12 code-complete (extends the branding token foundation from Plan 12-01; modifies the dashboard chrome from Plan 12-03; extends email senders from Plan 12-06).

**Why 12.5 not a Phase 12 gap**: Phase 12 verified at code level (5/5 must_haves, 20/20 requirements). The gray-chrome behavior was what Phase 12 was scoped to deliver. Phase 12.5 is a scope extension inserted between Phase 12 and Phase 13 so Phase 13 QA still runs against the final intended UI.

**Requirements** (6 new): BRAND-08, BRAND-09, UI-14, UI-15, UI-16, UI-17, EMAIL-13

**Success Criteria** (what must be TRUE):
  1. An owner who sets `brand_primary='#0A2540'` + `background_color='#0A2540'` + `chrome_tint_intensity='full'` sees the dashboard sidebar, page background, and email headers all reflect that navy — with black text auto-selected for contrast on the lightly tinted sidebar.
  2. An owner who sets `chrome_tint_intensity='none'` sees the original Phase 12 gray-50 chrome (regression-safe path).
  3. The floating header pill is gone from every dashboard route. The sidebar trigger is reachable on mobile.
  4. The 6 transactional emails inherit the same per-account tokens — no user-facing email-branding fields exist.
  5. `npx vitest run` ≥225 passing plus new tests for chromeTintToCss helper and intensity picker.
  6. `npx tsc --noEmit` clean on production code.

**Architectural decisions committed during planning:**
  1. **Tinting strategy**: `color-mix(in oklch, ${color} N%, white)`. NOT opacity overlays. Percentages locked in `lib/branding/chrome-tint.ts`: sidebar-full=14%, sidebar-subtle=6%, page-full=8%, page-subtle=3%. Cards always white.
  2. **WCAG helper**: `lib/branding/contrast.ts` with `pickTextColor` was already extracted in Plan 12-01 and is already shared by both UI (read-branding.ts) and email (branding-blocks.ts). No code movement required.
  3. **Header trigger relocation**: Option (c) — plain hamburger `<SidebarTrigger>` in a `fixed top-3 left-3 z-20 md:hidden` div inside SidebarInset. FloatingHeaderPill file deleted.
  4. **Branding editor preview**: Option (a) — REPLACE gradient-only mini-preview with chrome-aware preview showing faux-sidebar + faux-page-bg + faux-card (card always white). Single source of truth.
  5. **Email intensity semantics**: intensity='none' → header band uses brand_primary; intensity='subtle'/'full' → uses backgroundColor (current Phase 12 behavior, preserved as default).

**Plans**: 4 plans in 2 waves (per /gsd:plan-phase 12.5 2026-04-29).
  - [ ] 12.5-01-PLAN.md — Foundation: DB migration (chrome_tint_intensity column) + Branding type extension + getBrandingForAccount reader + chromeTintToCss pure helper + unit tests (Wave 1)
  - [ ] 12.5-02-PLAN.md — Dashboard chrome: sidebar tinting + page bg tinting + FloatingHeaderPill removal + plain hamburger trigger (Wave 2)
  - [ ] 12.5-03-PLAN.md — Branding editor: intensity picker UI + chrome-aware mini-preview-card (Wave 2)
  - [ ] 12.5-04-PLAN.md — Email tokens: EmailBranding.chromeTintIntensity + renderEmailBrandedHeader intensity-aware + all 6 senders wired (Wave 2)

---

### Phase 12.6: Direct Per-Account Color Controls (Page / Sidebar / Primary)

**Goal**: A dashboard owner can independently configure THREE per-account colors and see each one render at full strength on the surface it controls, with auto-WCAG text contrast: sidebar color (sidebar bg), page background color (background_color column), and primary color (brand_primary wired to shadcn --primary CSS variable override). IntensityPicker removed; direct hex = direct rendering.

**Depends on**: Phase 12.5 code-complete (ADDITIVE on top of 12.5 schema; does not drop chrome_tint_intensity or background_shade columns; rewrites the chrome-tint.ts helper to export resolveChromeColors alongside existing chromeTintToCss).

**Why 12.6**: Andrew reviewed Phase 12.5 on Vercel and found that at 6-14% color-mix percentages, even strong navy looks indistinguishable from gray-50. Phase 12.6 replaces the tinting model with direct hex application. brand_primary had also never been wired to the shadcn --primary variable, so buttons/switches/focus-rings were always black regardless of account branding.

**Requirements** (6 new): BRAND-10, BRAND-11, BRAND-12, UI-18, UI-19, UI-20, EMAIL-14

**Success Criteria** (what must be TRUE):
  1. An owner who sets `sidebar_color='#0A2540'`, `background_color='#F8FAFC'`, `brand_primary='#0A2540'` sees navy sidebar + light-gray page + navy buttons + navy switches throughout the dashboard.
  2. Setting any color to null/empty restores the shadcn default for that surface (regression-safe path).
  3. The IntensityPicker is gone from `/app/branding`; 3 distinct color pickers are present (Sidebar color, Page background, Button & accent color).
  4. MiniPreviewCard renders all 3 colors live — faux-sidebar (sidebar_color), faux-page (background_color), faux-button + faux-switch (brand_primary).
  5. The 6 transactional emails use `sidebar_color → brand_primary → '#0A2540'` for the header band.
  6. `npx vitest run` ≥240 passing (Phase 12.5 baseline).
  7. `npx tsc --noEmit` clean.

**Architectural decisions committed during planning:**
  1. **Column strategy**: ADD `sidebar_color` (new). KEEP `background_color` column name (page color alias, no rename). Do NOT drop `chrome_tint_intensity` or `background_shade`.
  2. **--primary CSS variable format**: Override with raw hex string (e.g. `#0A2540`). No oklch conversion helper needed. globals.css uses oklch for defaults but CSS custom property substitution accepts any valid `<color>` value — hex is universally valid. The `@theme inline` block maps `--color-primary: var(--primary)`; downstream consumers (bg-primary Tailwind class) receive the hex and it renders correctly.
  3. **WCAG text-color application**: Sidebar: `--sidebar-foreground` CSS var override using `pickTextColor(sidebarColor)`. Primary: `--primary-foreground` CSS var override using `pickTextColor(primaryColor)`. Page: page area uses `--foreground` default (page bg is rarely dark enough to need flipping; deferred to v1.2 polish per CONTEXT.md).
  4. **--primary override scope**: Inline style on a wrapper `<div>` that wraps the entire `<TooltipProvider>` in shell layout. CSS variable inheritance applies to all shadcn components within the shell. Public `/[account]` and `/embed` surfaces are NOT in this scope.
  5. **MiniPreviewCard layout**: faux-sidebar strip (left, sidebar_color) + faux-page area (right, background_color) with GradientBackdrop composited + faux-card (always white) containing faux-button + faux-switch both colored with brand_primary (inline style).
  6. **resolveChromeColors() helper**: New export from `lib/branding/chrome-tint.ts`. Returns `{ pageColor, sidebarColor, primaryColor, sidebarTextColor, primaryTextColor }`. `primaryColor` is always set (DEFAULT_BRAND_PRIMARY fallback); `sidebarColor` and `pageColor` are null when not set. Existing `chromeTintToCss` preserved as export.

**Plans**: 3 plans in 2 waves.
  - [ ] 12.6-01-foundation-PLAN.md — DB migration (sidebar_color column) + types extension (Branding.sidebarColor) + reader extension + resolveChromeColors() helper (Wave 1)
  - [ ] 12.6-02-dashboard-chrome-and-editor-PLAN.md — Shell layout (--primary override wrapper + direct sidebarColor on AppSidebar + pageColor on SidebarInset) + branding editor (3 pickers, IntensityPicker removed, MiniPreviewCard 3-color) + actions/schema/loader (Wave 2)
  - [ ] 12.6-03-email-tokens-PLAN.md — EmailBranding.sidebarColor + renderEmailBrandedHeader sidebar_color→brand_primary chain + all 6 senders + 4 callers wired (Wave 2)

---

### Phase 13: Manual QA + Andrew Ship Sign-Off

**Goal**: Andrew personally verifies each v1.1 capability area end-to-end across the production deployment and gives explicit "ship v1.1" sign-off; FUTURE_DIRECTIONS.md is updated with anything deferred during QA.

**Depends on**: Phase 10 + Phase 11 + Phase 12 + Phase 12.5 + Phase 12.6 (all v1.1 capability areas wired before walkthrough begins).

**Requirements** (7): QA-09, QA-10, QA-11, QA-12, QA-13, QA-14, QA-15

**Success Criteria** (what must be TRUE):
  1. A brand-new test user completes signup → email-verify → onboarding wizard → first booking received end-to-end with no errors (QA-09).
  2. A 2nd test owner logged into the dashboard sees ZERO of Andrew's data on every surface (Home calendar, Event Types, Availability, Bookings, Branding, Settings) — multi-tenant UI isolation walkthrough complete (QA-10).
  3. Capacity end-to-end: an event with capacity=3 accepts exactly 3 bookings from different sessions; the 4th attempt returns the right `SLOT_CAPACITY_REACHED` error message in the UI (QA-11).
  4. Branded UI smoke: 3 different test accounts (different `brand_primary`, `background_color`, `background_shade`, `sidebar_color` combinations) render correctly on dashboard + public booking page + embed + emails (QA-12); embed snippet dialog widening verified at 320 / 768 / 1024 viewports without horizontal overflow (QA-13).
  5. Andrew gives explicit "ship v1.1" sign-off (QA-14) and `FUTURE_DIRECTIONS.md` is updated with v1.1 carry-overs to v1.2 (QA-15).

**Scope NOT in Phase 13** (explicit RE-deferral per Andrew 2026-04-27): EMAIL-08 (SPF/DKIM/DMARC + mail-tester), QA-01..QA-06 (v1.0 marathon QA — live email-client cross-test, mail-tester scoring, DST live E2E, responsive multi-viewport pass, multi-tenant UI walkthrough). These remain in v1.2 backlog. QA-10 partially closes the v1.0 multi-tenant walkthrough as a side-effect of v1.1 multi-user work but does not retire QA-06 formally.

**Research flag**: None. Standard manual QA — no decisions required.

**Plans**: ~2-3 plans (pre-QA prerequisites + QA execution + future-directions/sign-off, mirroring Phase 9 structure).

---

## Progress

**Execution Order:** Phase 10 → Phase 11 → Phase 12 → Phase 12.5 → Phase 12.6 → Phase 13 (locked sequential)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 10. Multi-User Signup + Onboarding | v1.1 | 9 / 9 | Code complete; 6 manual checks deferred | 2026-04-28 (code) |
| 11. Booking Capacity + Double-Booking Fix | v1.1 | 8 / 8 | Code complete; 4 manual checks deferred | 2026-04-29 (code) |
| 12. Branded UI Overhaul (5 Surfaces) | v1.1 | 7 / 7 | Code complete (all 7 plans done) | 2026-04-29 (code) |
| 12.5. Per-Account Chrome Theming + Header + Email | v1.1 | 4 / 4 | Code complete | 2026-04-29 (code) |
| 12.6. Direct Per-Account Color Controls | v1.1 | 3 / 3 | Code complete; 8 manual checks deferred | 2026-04-29 (code) |
| 13. Manual QA + Andrew Ship Sign-Off | v1.1 | 0 / TBD | Not started — UP NEXT | - |

## Coverage Summary

- v1.1 requirements: **67 total** (53 original + 7 new in Phase 12.5 + 7 new in Phase 12.6)
- Mapped to phases: **67**
- Unmapped: **0**
- Phase 10: 19 requirements (AUTH-05..11, ONBOARD-01..09, ACCT-01..03)
- Phase 11: 9 requirements (CAP-01..09)
- Phase 12: 20 requirements (BRAND-05..07, UI-01..13, EMAIL-09..12)
- Phase 12.5: 7 requirements (BRAND-08..09, UI-14..17, EMAIL-13)
- Phase 12.6: 7 requirements (BRAND-10..12, UI-18..20, EMAIL-14)
- Phase 13: 7 requirements (QA-09..15)

---

*Roadmap last updated: 2026-04-29 — Phase 12, 12.5, 12.6 all CODE-COMPLETE with manual checks deferred to milestone-end QA per `MILESTONE_V1_1_DEFERRED_CHECKS.md`. v1.1 cumulative: 53/67 requirements complete (Phase 10: 19; Phase 11: 9; Phase 12: 20; Phase 12.5: 7 [deprecated by 12.6 in code]; Phase 12.6: 7 [active]). Phase 13 (Manual QA + Andrew Ship Sign-Off) is UP NEXT.*
