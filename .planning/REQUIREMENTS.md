# Requirements: Calendar App (NSI Booking Tool) — v1.1

**Defined:** 2026-04-27
**Core Value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.
**Milestone Goal:** Open the tool to anyone (multi-user signup), close the prod double-booking + add per-event-type capacity, rebrand every owner-facing surface with the Cruip "Simple Light" tailwind-landing-page aesthetic.

## v1.1 Requirements

Numbering continues from v1.0 (FOUND-01..06, AUTH-01..04, EVENT-01..06, AVAIL-01..09, BOOK-01..07, EMAIL-01..07, LIFE-01..05, BRAND-01..04, EMBED-01..08, DASH-01..04, INFRA-01..05, QA-07..08 shipped). v1.0 EMBED-07, EMAIL-08, QA-01..06 carried to v1.2 — not in this milestone.

### Authentication (Phase 10)

- [ ] **AUTH-05**: Public `/signup` form accepts email + password and creates a Supabase `auth.users` row (email/password only — no OAuth in v1.1)
- [ ] **AUTH-06**: Signup form rejects duplicate emails generically without confirming registration ("If your email is registered, you'll receive a verification email") to prevent email-enumeration
- [ ] **AUTH-07**: New users must verify their email before they can log in (hard gate; orphan accounts cleaned up via `accounts.deleted_at`)
- [ ] **AUTH-08**: `/auth/confirm` Route Handler exchanges Supabase token-hash codes for sessions (verifyOtp pattern) for signup, password recovery, and future magic-link/email-change flows
- [ ] **AUTH-09**: User can request a password-reset email at `/forgot-password`; landing page is `/auth/reset-password` and POSTs the new password through `/auth/confirm` (recovery type)
- [ ] **AUTH-10**: Existing single-tenant owner user (`ajwegner3@gmail.com`) continues to log in after email-confirmation is re-enabled (pre-flight UPDATE on `email_confirmed_at` if null)
- [ ] **AUTH-11**: `/api/auth/*` endpoints (signup, login, password-reset) are rate-limited per IP via the existing `rate_limit_events` table

### Account Provisioning + Onboarding (Phase 10)

- [ ] **ONBOARD-01**: First-login wizard runs at `/onboarding` for accounts where `onboarding_complete = false`; wizard is 3 steps (display name + slug → timezone confirm → first event type or skip)
- [ ] **ONBOARD-02**: Wizard creates an `accounts` row atomically with `slug`, `display_name`, `timezone`, `owner_user_id`, `owner_email`, and `onboarding_complete = true` on final-step submission
- [ ] **ONBOARD-03**: Wizard seeds 5 default `availability_rules` rows (Mon–Fri, 09:00–17:00) in the user's local timezone (captured at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- [ ] **ONBOARD-04**: Wizard creates 1 default `event_types` row ("30 Minute Meeting", `slug=30min`, `duration_minutes=30`, `max_bookings_per_slot=1`, active) on completion
- [ ] **ONBOARD-05**: Slug picker validates `/^[a-z0-9-]{3,40}$/` and rejects entries in the consolidated `RESERVED_SLUGS` set (single source of truth at `lib/reserved-slugs.ts` — replaces v1.0's 2-file duplication)
- [ ] **ONBOARD-06**: Slug picker provides real-time collision detection via `/api/check-slug` (debounced)
- [ ] **ONBOARD-07**: When a slug is taken, the picker suggests 3 alternatives (e.g., `andrew-2`, `andrew-nsi`, `andrewbookings`) — appends numeric suffix + email-prefix variants
- [ ] **ONBOARD-08**: User receives a welcome email post-signup with their booking link (separate from the Supabase verification email)
- [ ] **ONBOARD-09**: Dashboard shows an onboarding progress checklist for accounts in their first 7 days (Set availability ✓ / Customize event ✓ / Share your link ☐); user can dismiss; dismissal persists in `accounts.onboarding_checklist_dismissed_at`

### Account Settings + Profile (Phase 10)

- [ ] **ACCT-01**: New `/app/settings/profile` route lets the user view email (read-only), change password (current-password challenge), edit display name, and view account slug
- [ ] **ACCT-02**: User can soft-delete their own account from `/app/settings/profile` (sets `accounts.deleted_at`; account hidden from public; auth.users row preserved for v1.1; hard delete deferred to v1.2 cron purge)
- [ ] **ACCT-03**: Soft-deleted accounts return 404 on all public surfaces (`/[account]/*`, `/embed/[account]/*`)

### Booking Capacity (Phase 11)

- [x] **CAP-01**: Investigate root cause of 2026-04-27 prod double-booking observation (partial-index gap, status-filter gap, or different code path); document findings in Phase 11 SUMMARY before designing the replacement
- [x] **CAP-02**: New `event_types.max_bookings_per_slot INTEGER NOT NULL DEFAULT 1 CHECK (max_bookings_per_slot >= 1)` column
- [x] **CAP-03**: Owner can set `max_bookings_per_slot` per event type from the event-type form (number input, default 1)
- [x] **CAP-04**: `/api/slots` excludes a slot once `confirmed_count >= max_bookings_per_slot` for that event type (existing single-capacity behavior preserved when capacity = 1)
- [x] **CAP-05**: `/api/bookings` is race-safe under concurrent submissions when capacity > 1; the v1.0 partial unique index `bookings_no_double_book` is replaced atomically with the new mechanism (advisory-lock trigger or slot-index pattern — planner picks during Phase 11 plan)
- [x] **CAP-06**: Race test: capacity=N, M concurrent submits (M > N) → exactly N bookings succeed and (M − N) return 409. Tested at the `pg` driver layer (not just supabase-js HTTP serialization). v1.0 capacity=1 race test must continue to pass as a regression check.
- [x] **CAP-07**: `/api/bookings` 409 responses distinguish `SLOT_TAKEN` (capacity 1 hit) from `SLOT_CAPACITY_REACHED` (capacity N hit) so the booker UX can show the right message
- [x] **CAP-08**: Owner can toggle `event_types.show_remaining_capacity` (default OFF). When on, `/api/slots` returns `remaining_capacity` and the booker UI shows "X spots left"
- [x] **CAP-09**: When the owner decreases `max_bookings_per_slot` on an event type with existing future bookings that would exceed the new cap, a confirmation modal warns before save

### Branding Tokens (Phase 12)

- [ ] **BRAND-05**: New `accounts.background_color TEXT` column (nullable hex; null falls back to `gray-50`)
- [ ] **BRAND-06**: New `accounts.background_shade TEXT CHECK (background_shade IN ('none','subtle','bold')) DEFAULT 'subtle'` column controls gradient intensity
- [ ] **BRAND-07**: Branding editor at `/app/branding` adds `background_color` swatch picker and `background_shade` 3-button toggle with live preview iframe

### Owner UI (Phase 12)

- [ ] **UI-01**: Dashboard global typography uses Inter via `next/font/google` with `tracking-tight`
- [ ] **UI-02**: Dashboard surfaces use `bg-gray-50` page background + `gray-900` primary text per Cruip "Simple Light"
- [ ] **UI-03**: Dashboard renders a floating glass header pill (`fixed top-2 md:top-6`)
- [ ] **UI-04**: Surfaces with `background_shade != 'none'` render gradient blur-circle decorative backgrounds derived from the account's `brand_primary` and `background_color`; hidden when `background_shade = 'none'`
- [ ] **UI-05**: Sidebar IA: Home / Event Types / Availability / Bookings / Branding / Settings (flat list; Settings expands to Reminders + Profile in-place)
- [ ] **UI-06**: New `/app/home` (or `/app`) Home tab renders a monthly calendar (`react-day-picker@9`) with `modifiers` highlighting days that have bookings
- [ ] **UI-07**: Clicking a day in the Home calendar opens a shadcn `Sheet` drawer listing that day's bookings
- [ ] **UI-08**: Day-detail drawer rows include a dropdown menu with View, Cancel, and Copy-link actions (reusing Phase 8 booking-detail-page primitives)
- [ ] **UI-09**: Embed snippet dialog (`EmbedCodeDialog`) widens to `sm:max-w-2xl` (or wider) so the snippet does not overflow / overlap

### Public Surfaces (Phase 12)

- [ ] **UI-10**: Public booking page `/[account]/[event-slug]` is restyled per Cruip "Simple Light": section rhythm `py-12 md:py-20`, `max-w-3xl` slot picker, gradient backgrounds keyed off the account's branding tokens
- [ ] **UI-11**: Embed widget `/embed/[account]/[event-slug]` adopts the same restyle, scoped chromeless (no nav, no header pill); height-postMessage protocol continues to work
- [ ] **UI-12**: `/login`, `/signup`, `/auth/reset-password` adopt the skill's split-panel auth-page pattern (form left, decorative branded panel right on `lg:`)
- [ ] **UI-13**: `/[account]` public index page is restyled as a polished personal landing card (logo + display name + brand color + active event types) — the URL contractors share on business cards

### Email Branding (Phase 12)

- [ ] **EMAIL-09**: Booker confirmation, reminder, cancel, and reschedule emails (and owner notification + cancel + reschedule) ship a per-account branded header (gradient with solid-color fallback for Outlook + Yahoo, OR solid-color-only — planner picks during Phase 12 plan)
- [ ] **EMAIL-10**: Booker confirmation email includes a plain-text alternative (`text: stripHtml(html)`) — mirrors reminder pattern; closes FUTURE_DIRECTIONS.md §3 backlog
- [ ] **EMAIL-11**: Email footer includes the NSI mark image (sets `NSI_MARK_URL`) — closes FUTURE_DIRECTIONS.md §3 backlog
- [ ] **EMAIL-12**: Per-template branding visual smoke verified across all 6 transactional surfaces (booker × owner × confirm/cancel/reschedule) — closes FUTURE_DIRECTIONS.md §3 6-row smoke backlog

### Per-Account Chrome Theming (Phase 12.5 — DEPRECATED in code by Phase 12.6, DB columns retained)

- [x] **BRAND-08**: `accounts.chrome_tint_intensity` enum column (`'none' | 'subtle' | 'full'`, NOT NULL DEFAULT `'subtle'`). Column persists in DB but no longer drives chrome rendering as of Phase 12.6.
- [x] **BRAND-09**: Auto-WCAG text contrast helper (`pickTextColor` in `lib/branding/contrast.ts`) shared by both UI surfaces and email senders.
- [x] **UI-14**: Sidebar tints per-account (DEPRECATED — replaced by direct sidebar_color in Phase 12.6).
- [x] **UI-15**: Page background tints per-account (DEPRECATED — replaced by direct background_color rendering in Phase 12.6).
- [x] **UI-16**: `FloatingHeaderPill` component DELETED; plain hamburger trigger replaces it.
- [x] **UI-17**: Branding editor exposes intensity picker (DEPRECATED — IntensityPicker DELETED in Phase 12.6 in favor of 3 direct color pickers).
- [x] **EMAIL-13**: Email senders unified on per-account branding tokens — no separate user-controlled email-branding fields exist.

### Direct Per-Account Color Controls (Phase 12.6)

- [x] **BRAND-10**: `accounts.sidebar_color` text column (nullable, hex CHECK). Null = shadcn default sidebar bg; set = literal hex applied to sidebar root via inline style.
- [x] **BRAND-11**: `accounts.background_color` (existing v1.0 column, repurposed semantically) serves as the page color field. Direct hex applied to SidebarInset via inline style.
- [x] **BRAND-12**: `accounts.brand_primary` (existing v1.0 column) wired to override the shadcn `--primary` + `--primary-foreground` CSS variables on the `(shell)` wrapper, so all dashboard buttons / switches / focus rings inherit the brand color.
- [x] **UI-18**: `/app/branding` exposes 3 distinct color pickers (Sidebar color, Page background, Button & accent color); IntensityPicker REMOVED.
- [x] **UI-19**: `MiniPreviewCard` renders all 3 colors live (faux-sidebar, faux-page, faux-button + faux-switch) as the owner adjusts.
- [x] **UI-20**: Auto-WCAG text contrast on sidebar (`--sidebar-foreground` override) and primary (`--primary-foreground` override).
- [x] **EMAIL-14**: Email header band priority chain `sidebar_color → brand_primary → '#0A2540'` so emails visually mirror the dashboard sidebar.

### Manual QA (Phase 13)

- [ ] **QA-09**: End-to-end signup → email-verify → onboarding wizard → first booking received completes for a brand-new test user with no errors
- [ ] **QA-10**: Multi-tenant UI isolation walkthrough: log in as a 2nd test owner; confirm they see ZERO of Andrew's data on every dashboard surface (Home calendar, Event Types, Availability, Bookings, Branding, Settings)
- [ ] **QA-11**: Capacity end-to-end: create event with capacity=3; book it 3 times from different sessions; 4th attempt returns the right SLOT_CAPACITY_REACHED error in the UI
- [ ] **QA-12**: Branded UI smoke: 3 different test accounts (different `brand_primary`, `background_color`, `background_shade`) render correctly on dashboard + public booking page + embed + emails
- [ ] **QA-13**: Embed snippet dialog widening verified at 320 / 768 / 1024px (no horizontal overflow on copy-paste)
- [ ] **QA-14**: Andrew explicit ship sign-off: "ship v1.1"
- [ ] **QA-15**: `FUTURE_DIRECTIONS.md` updated with v1.1 carry-overs to v1.2 (anything deferred during marathon QA)

## v1.2 Requirements (deferred from v1.1 + carried from v1.0)

Tracked but NOT in current milestone.

### v1.0 Marathon QA Carry-Overs (RE-DEFERRED — Andrew scope-cut 2026-04-27)

- **EMBED-07** — Live Squarespace/Wix/WordPress embed test (Andrew is on Next.js sites; revisit if a non-Next host emerges)
- **EMAIL-08** — SPF/DKIM/DMARC verified; mail-tester ≥ 9/10 for confirmation AND reminder
- **QA-01..QA-06** — Marathon QA criteria (live email-client cross-test, mail-tester scoring, DST live E2E, responsive multi-viewport pass, multi-tenant UI walkthrough — note QA-10 in v1.1 partially closes the multi-tenant walkthrough)

### Anti-Differentiators Deferred to v1.2 or Later

- OAuth signup (Google/GitHub)
- Magic-link / passwordless login
- Email change with confirmation loop UI
- Capacity-aware reminder emails ("you and N others")
- Minimum-attendee threshold (`min_bookings_to_confirm`)
- Hard-delete cron purge (v1.1 ships soft-delete only)
- Calendar density heatmap
- AOS scroll animations
- Custom auth-page decorative panel illustration

## v2 Requirements

Multi-user-per-account / team seats. Stripe paid tiers. Per-tenant subdomains. SVG logo upload. Custom domains. Account self-deletion hard-delete with cascade.

## Out of Scope (v1.1 — reasoning audited, all v1.0 entries still valid)

| Feature | Reason |
|---------|--------|
| Custom CSS / arbitrary stylesheet upload | XSS surface; per-account `brand_primary` + `background_color` + `background_shade` is the v1.1 ceiling |
| Custom HTML email templates per account | Multiplies QA matrix by N accounts × 6 templates × 4 email clients; unmaintainable |
| Multiple themes / theme presets | One light theme + per-account brand color is the commit |
| SVG logo upload | XSS surface; PNG only with 2 MB cap (v1.0 lock) |
| Email animations (CSS keyframes, GIFs) | Outlook strips them; Apple Mail iOS often blocks GIFs |
| Per-tenant subdomain (`andrew.calendar-app.com`) | DNS + wildcard SSL + Vercel domain config = significant infra; path-based `/[account]` URLs sufficient |
| Round-robin / team scheduling | Out of Scope per v1.0 (anti-feature; targets enterprises) |
| Waitlists when slot is full | Out of Scope per v1.0; slot disappears when full |
| Per-slot capacity overrides (different limits at different times) | Per-event-type capacity only; create a second event type if needed |
| Group-call video integration | Out of Scope per v1.0 (trade bookings are in-person) |
| Capacity 0 to "pause" an event | Confusing semantics; use existing `event_types.is_active` toggle |
| Per-event-type theme override | Per-account branding is sufficient; covered by v1.0 anti-feature |
| Captcha on signup form | Cloudflare Turnstile already on bookings; defer until signup spam observed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-05 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-06 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-07 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-08 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-09 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-10 | Phase 10 | Complete (code; manual deferred to v1.2) |
| AUTH-11 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-01 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-02 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-03 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-04 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-05 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-06 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-07 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-08 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ONBOARD-09 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ACCT-01 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ACCT-02 | Phase 10 | Complete (code; manual deferred to v1.2) |
| ACCT-03 | Phase 10 | Complete (code; manual deferred to v1.2) |
| CAP-01 | Phase 11 | Complete (code) |
| CAP-02 | Phase 11 | Complete (code) |
| CAP-03 | Phase 11 | Complete (code; manual deferred to v1.2) |
| CAP-04 | Phase 11 | Complete (code) |
| CAP-05 | Phase 11 | Complete (code) |
| CAP-06 | Phase 11 | Complete (code; manual deferred to v1.2) |
| CAP-07 | Phase 11 | Complete (code; manual deferred to v1.2) |
| CAP-08 | Phase 11 | Complete (code; manual deferred to v1.2) |
| CAP-09 | Phase 11 | Complete (code; manual deferred to v1.2) |
| BRAND-05 | Phase 12 | Complete (code; manual deferred to v1.2) |
| BRAND-06 | Phase 12 | Complete (code; manual deferred to v1.2) |
| BRAND-07 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-01 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-02 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-03 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-04 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-05 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-06 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-07 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-08 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-09 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-10 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-11 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-12 | Phase 12 | Complete (code; manual deferred to v1.2) |
| UI-13 | Phase 12 | Complete (code; manual deferred to v1.2) |
| EMAIL-09 | Phase 12 | Complete (code; manual deferred to v1.2) |
| EMAIL-10 | Phase 12 | Complete (code; manual deferred to v1.2) |
| EMAIL-11 | Phase 12 | Complete (code; manual deferred to v1.2) |
| EMAIL-12 | Phase 12 | Complete (code; manual deferred to v1.2) |
| BRAND-08 | Phase 12.5 | Complete (code; manual deferred to v1.2) |
| BRAND-09 | Phase 12.5 | Complete (code) |
| UI-14 | Phase 12.5 | Complete (code; manual deferred to v1.2) |
| UI-15 | Phase 12.5 | Complete (code; manual deferred to v1.2) |
| UI-16 | Phase 12.5 | Complete (code) |
| UI-17 | Phase 12.5 | Complete (code; manual deferred to v1.2) |
| EMAIL-13 | Phase 12.5 | Complete (code) |
| BRAND-10 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| BRAND-11 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| BRAND-12 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| UI-18 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| UI-19 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| UI-20 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| EMAIL-14 | Phase 12.6 | Complete (code; manual deferred to v1.2) |
| QA-09 | Phase 13 | DEFERRED-V1.2 (marathon waived 2026-04-30) |
| QA-10 | Phase 13 | DEFERRED-V1.2 (marathon waived 2026-04-30; backend RLS green) |
| QA-11 | Phase 13 | DEFERRED-V1.2 (marathon waived 2026-04-30; CAP-06 race test skip-guarded) |
| QA-12 | Phase 13 | DEFERRED-V1.2 (marathon waived 2026-04-30; single-account live OK 2026-04-29) |
| QA-13 | Phase 13 | DEFERRED-V1.2 (marathon waived 2026-04-30; code lock at commit `2dc5ae1`) |
| QA-14 | Phase 13 | Complete (Andrew sign-off 2026-04-30) |
| QA-15 | Phase 13 | Complete (FUTURE_DIRECTIONS.md §8 updated 2026-04-30) |

**Coverage:**
- v1.1 requirements: 67 total (53 original + 7 added in Phase 12.5 + 7 added in Phase 12.6)
- Mapped to phases: 67
- Unmapped: 0 ✓
- Phase 12.5 reqs (BRAND-08/09, UI-14/15/16/17, EMAIL-13): per-account chrome theming with intensity picker — DEPRECATED in code by Phase 12.6 but DB columns retained (additive)
- Phase 12.6 reqs (BRAND-10/11/12, UI-18/19/20, EMAIL-14): direct per-account color controls (sidebar/page/primary at full strength) replacing 12.5's color-mix approach

---
*Requirements defined: 2026-04-27 for v1.1 milestone*
*Last updated: 2026-04-30 — v1.1 SHIPPED. Phase 13 closed via marathon waiver (Andrew verbatim "consider everything good. close out the milestone"). QA-09..QA-13 DEFERRED-V1.2 (5 items); QA-14 + QA-15 Complete. v1.1 cumulative: 62/67 requirements complete; 5 marathon items + per-phase manual deferrals carried to v1.2 backlog per `FUTURE_DIRECTIONS.md` §8.*
