# Calendar App (NSI Booking Tool)

## What This Is

A multi-tenant Calendly-style booking tool for **service businesses** (trade contractors, consultants, salons, fitness studios, anyone who books appointments). Visitors land on the business's website, pick an available slot in a branded widget, and walk away with a confirmed booking and a calendar invite in their inbox. **v1.0 shipped 2026-04-27** with Andrew's NSI account end-to-end (single-tenant in production; multi-tenant plumbing baked into the schema). **v1.1 shipped 2026-04-30** opening the tool to public signup, adding per-event-type capacity (race-safe slot_index mechanism), and rebranding 5 owner-facing + public surfaces with the Cruip "Simple Light" aesthetic + direct per-account color controls. **v1.2 shipped 2026-05-02** locking the entire owner-facing app to a unified North Star Integrations visual language (`bg-gray-50` + blue-blot `BackgroundGlow` + glass "NorthStar" header pill + Inter weights 400-800), preserving each contractor's `brand_primary` only on public booking surfaces and the 6 transactional emails. v1.2 was the first net-deletion milestone (NET -792 lines runtime; 4 deprecated `accounts` columns + 2 ENUM types permanently dropped from production Postgres via two-step deploy protocol; branding editor collapsed from 5 controls to 2). **v1.3 shipped 2026-05-02** as a same-day surgical bug-fix milestone (~10 hours scope-lock to ship): auth signup-link + login layout + 30-day session TTL fixes, public booking mobile centering + desktop layout-collision fix + account-index browser title, owner home calendar de-orange + copyable per-event booking-link field. Marathon QA formally adopted as deploy-and-eyeball (third consecutive deferral now permanent). **v1.4 shipped 2026-05-03** sealing the contractor-can't-be-in-two-places-at-once invariant at the Postgres layer (`bookings_no_account_cross_event_overlap` EXCLUDE constraint with a generated `tstzrange [)` column) mapped end-to-end into a 409 `CROSS_EVENT_CONFLICT` user experience; bookings page crash root-caused as RSC boundary violation and fixed in a 1-line edit; auth + owner-home polish. **v1.5 shipped 2026-05-05** replacing the account-wide `accounts.buffer_minutes` with per-event-type `event_types.buffer_after_minutes` (asymmetric LD-04 math: existing booking's post-buffer pushes back, candidate's own post-buffer pushes forward) — `accounts.buffer_minutes` permanently dropped via the CP-03 two-step deploy protocol (drain waiver pattern formalized for zero-traffic single-tenant deploys); audience rebrand from "trade contractors" to "service businesses" across owner-facing copy + dev docs (booker-facing surfaces stay brand-neutral); public booker redesigned into a true 3-column desktop layout (calendar LEFT / times MIDDLE / form RIGHT) using a flat Tailwind v4 bracket-grid with state lifted from `slot-picker.tsx` into `booking-shell.tsx` and a fixed 320px form column reservation that gives zero layout shift on slot pick. The branded embeddable widget (script + iframe; auto-resizes via `nsi-booking:height` postMessage) is what makes it a sellable deliverable for client websites, not just a personal tool.

## Core Value

A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

(Validated in v1.0; held through v1.1, v1.2, v1.3, v1.4. v1.5 confirmed once more: per-event-type buffer + 3-column desktop layout strengthened the wedge by removing two friction sources (cross-event-type buffer correctness + form-on-pick layout shift); the audience rebrand from "trade contractors" to "service businesses" extended the wedge's reach without changing the core promise. The booker experience itself remains brand-neutral — invitees see the contractor's brand, never NSI's product copy.)

## Current Milestone: (none — ready for next)

v1.5 shipped 2026-05-05. Awaiting next milestone via `/gsd:new-milestone`.

## Requirements

### Active

(None — v1.5 closed all 14 requirements at 100%; next milestone TBD via `/gsd:new-milestone`.)

### Validated

**v1.0 — shipped 2026-04-27 (66 of 73 requirements complete):**

- ✓ Multi-tenant data model in Supabase (accounts, event types, availability, bookings) — v1.0 (single tenant in production; schema supports many)
- ✓ Secure owner authentication via Supabase Auth (email/password) — v1.0
- ✓ Deployed as a single Vercel app — v1.0 (`calendar-app-xi-smoky.vercel.app`)
- ✓ Owner can define multiple event types per account with per-type duration and custom questions — v1.0
- ✓ Owner sets weekly recurring availability with per-date overrides — v1.0
- ✓ Owner sees a dashboard listing upcoming and past bookings — v1.0
- ✓ Owner can cancel a booking from the dashboard — v1.0
- ✓ Public booking page shows available slots in booker's local time zone — v1.0
- ✓ Booker fills standard fields + custom questions — v1.0
- ✓ Booking is persisted in Supabase as the sole source of truth — v1.0 (no Google Calendar sync)
- ✓ Booker receives email confirmation with .ics calendar invite attached — v1.0 (live cross-client import verification deferred to v1.1)
- ✓ Booker receives reminder email 24 hours before the appointment — v1.0
- ✓ Booker can cancel or reschedule via tokenized links in confirmation email — v1.0
- ✓ Embeddable widget (iframe + script snippet) — v1.0 (live Squarespace/WordPress test deferred to v1.1)
- ✓ Per-account branding: logo + brand color — v1.0
- ✓ Hosted booking page URL for direct linking — v1.0 (`/[account]` index + `/[account]/[event-slug]` per-event)
- ✓ Owner receives email when a new booking is created — v1.0
- ✓ Emails sent via vendored `@nsi/email-sender` — v1.0 (provider pivoted from Resend to Gmail SMTP during Phase 5)
- ✓ Reminder emails dispatched by Vercel Cron — v1.0 (hourly schedule; Vercel Pro tier required)
- ✓ DB-level race-safe booking via partial unique index — v1.0
- ✓ DST-correct slot computation across March 8 + Nov 1 2026 — v1.0
- ✓ RLS cross-tenant isolation (automated 16-case matrix × 4 client contexts) — v1.0
- ✓ Rate limiting on `/api/bookings`, `/api/cancel`, `/api/reschedule` (per-IP, Postgres-backed) — v1.0
- ✓ Cloudflare Turnstile bot protection on booking form — v1.0
- ✓ `FUTURE_DIRECTIONS.md` authored at repo root — v1.0 (213 lines; canonical v1.1 backlog)

**v1.1 — shipped 2026-04-30 (62 of 67 requirements complete; 5 marathon items deferred to v1.2):**

- ✓ Public `/signup` with email/password (no OAuth) — v1.1 (AUTH-05/06/07)
- ✓ `/auth/confirm` Route Handler with `verifyOtp` pattern (closes v1.0 `/auth/callback` 404 BLOCKER) — v1.1 (AUTH-08)
- ✓ Forgot-password + reset-password flows — v1.1 (AUTH-09)
- ✓ `/api/auth/*` rate-limited per IP via `rate_limit_events` — v1.1 (AUTH-11)
- ✓ Postgres SECURITY DEFINER trigger creates stub `accounts` row on `auth.users` INSERT; wizard UPDATEs via RLS-scoped Server Action — v1.1 (ONBOARD-01..09)
- ✓ 3-step onboarding wizard (slug + name + timezone + first event type) at `/onboarding` — v1.1
- ✓ `/app/settings/profile` (display name, password change, soft-delete with type-slug-to-confirm) — v1.1 (ACCT-01..03)
- ✓ Email change with re-verification round-trip — v1.1 (folds into AUTH-08 + auth/confirm)
- ✓ Per-event-type `max_bookings_per_slot` (race-safe slot_index mechanism replaces v1.0 partial unique index) — v1.1 (CAP-01..09)
- ✓ CAP-07 distinguishes SLOT_TAKEN (cap=1) from SLOT_CAPACITY_REACHED (cap>1) for booker UX — v1.1
- ✓ pg-driver race test (CAP-06) at the postgres.js layer — v1.1 (skip-guarded; runs against prod when SUPABASE_DIRECT_URL set)
- ✓ Cruip "Simple Light" visual overhaul across 5 surfaces (dashboard + public booking + embed + emails + 6 auth pages) — v1.1 (UI-01..13, EMAIL-09..12)
- ✓ Inter font + bg-gray-50 + flat sidebar IA (Home / Event Types / Availability / Bookings / Branding / Settings accordion) — v1.1
- ✓ Home tab monthly calendar with day-detail Sheet drawer + 4 row actions (View / Cancel / Copy-reschedule-link / Send-reminder) — v1.1 (UI-06..08)
- ✓ EmbedCodeDialog widened to `sm:max-w-2xl` — v1.1 (UI-09; live multi-viewport verification deferred to v1.2)
- ✓ Direct per-account color controls: `sidebar_color` + `background_color` + `brand_primary` with auto-WCAG text contrast — v1.1 (BRAND-10..12, UI-18..20, EMAIL-14)
- ✓ `brand_primary` wired to shadcn `--primary` CSS variable for first time — v1.1 (dashboard buttons / switches / focus rings inherit account branding)
- ✓ All 6 transactional emails ship per-account branded header band (priority: `sidebar_color → brand_primary → '#0A2540'`) + plain-text alts on booker-facing senders + NSI footer mark — v1.1
- ✓ Gmail SMTP quota guard (200/day cap + 80% warning + fail-closed; bookings/reminders bypass) — v1.1
- ✓ RLS cross-tenant matrix extended to N=3 tenants (24 new test cases) — v1.1
- ✓ `FUTURE_DIRECTIONS.md` §8 appended with v1.1 marathon waiver record + carry-overs — v1.1 (QA-15)
- ✓ Andrew explicit ship sign-off — v1.1 (QA-14, verbatim 2026-04-30 "consider everything good. close out the milestone")

**v1.2 — shipped 2026-05-02 (95 of 95 requirements complete; 100%):**

- ✓ Typography + CSS token foundations: Inter weights 400-800 + Roboto Mono via `next/font/google`; `globals.css` em-based letter-spacing; `--color-primary` flipped to `#3B82F6` — v1.2 (TYPO-01..07)
- ✓ `BackgroundGlow` component (Server Component, two-blob lead-scoring layout, `position: absolute`, optional `color` prop) at `app/_components/background-glow.tsx` — v1.2 (GLOW-01..05)
- ✓ Glass `Header` pill (3 variants: owner / auth / public) at `app/_components/header.tsx`; "NorthStar" wordmark from `lib/brand.ts WORDMARK` constant — v1.2 (HDR-01..08)
- ✓ Owner shell re-skin: per-account chrome theming stripped from `(shell)/layout.tsx` + `AppSidebar`; `<Header variant="owner" />` rendered shell-wide; 14 owner-page cards standardized — v1.2 (OWNER-01..11)
- ✓ All 7 auth pages + 3-step onboarding wizard re-skinned with `BackgroundGlow` (NSI blue) + glass pill + gray-50 base — v1.2 (AUTH-12..17, ONBOARD-10..15)
- ✓ `PublicShell` component replaces `BrandedPage` across 5 public surfaces; customer `brand_primary` drives `BackgroundGlow` tint + glass pill; "Powered by North Star Integrations" footer — v1.2 (PUB-01..12, HDR-05..06)
- ✓ Embed widget re-skin: `bg-gray-50` base, single-circle gradient retained (correct for iframe canvas), iframe-local `--primary` override; `PoweredByNsi` rendered inside iframe — v1.2 (EMBED-08..11)
- ✓ Branding editor collapsed to 2 controls (logo + "Booking page primary color"); `MiniPreviewCard` rebuilt as faux public booking page; `saveBrandingAction` deleted entirely — v1.2 (BRAND-13..21)
- ✓ Email layer simplified: `EmailBranding` interface = `{ name, logo_url, brand_primary }`; color resolution = `brand_primary → DEFAULT`; footer text-only — v1.2 (EMAIL-15..20)
- ✓ Dead code cleanup: 5 deprecated theming files deleted (`chrome-tint.ts`, `shade-picker.tsx`, `branding-chrome-tint.test.ts`, `branding-gradient.test.ts`, `branding-schema.test.ts`); `Branding` interface canonical 3-field shape — v1.2 (CLEAN-01..10)
- ✓ Schema DROP migration: 4 deprecated `accounts` columns + 2 ENUM types permanently removed from production Postgres via two-step deploy protocol (CP-03 30-min drain) — v1.2 (DB-01..11)
- ✓ `FUTURE_DIRECTIONS.md` §8.4 v1.2 backlog closed via Phase 21 strikethrough — v1.2 (DB-11)
- ✓ Andrew explicit ship sign-off — v1.2 (Phase 21 production booking smoke test PASSED 2026-05-02; verifier 8/8 must-haves on live DB + git history)

**v1.3 — shipped 2026-05-02 (8 of 8 requirements complete; 100%):**

- ✓ AUTH-18: signup link from `/login` navigates correctly to `/signup` (middleware `publicAuthPaths.includes()` exact-match) — v1.3
- ✓ AUTH-19: sign-in page layout — `AuthHero` LEFT, form RIGHT (column swap; preserved `lg:` breakpoint) — v1.3
- ✓ AUTH-20: 30-day session TTL — verified `@supabase/ssr@0.10.2` 400-day cookie default not overridden; `proxy.ts setAll` patched to forward cache-control headers — v1.3 (observational confirmation week-of-use)
- ✓ PUB-13: mobile slot picker calendar centered via `justify-self-center` (mid-verify correction from `mx-auto`) — v1.3
- ✓ PUB-14: desktop timezone hint hoisted above `grid lg:grid-cols-2` wrapper as full-width sibling via React fragment root — v1.3
- ✓ PUB-15: public account-index browser title locked to `Book with ${name}` via `generateMetadata()` (cards listing UI already shipped from prior phase) — v1.3
- ✓ OWNER-12: home calendar DayButton de-oranged via per-instance className overrides (selected = `bg-gray-700`, today = `bg-muted` + grey ring, dot = `#9CA3AF`); shared `components/ui/calendar.tsx` and `globals.css --color-accent` UNTOUCHED — v1.3
- ✓ OWNER-13: copyable `BookingLinkField` rendered as first form section in event-type-form.tsx (Copy → Check icon flip ~1.5s); `current_owner_account_ids` RPC threads `accountSlug`; `UrlPreview` deleted — v1.3
- ✓ Mid-checkpoint scope expansion (commit `db7fb62`): per-row `RowCopyLinkButton` on event-types list page + blue per-instance focus override on dropdown menu items (shared `components/ui/dropdown-menu.tsx` UNTOUCHED) — v1.3
- ✓ Andrew explicit ship sign-off — v1.3 (verbatim 2026-05-02 21:35 "approved" on Phase 24 live deploy verification; no marathon QA executed; deploy-and-eyeball formally adopted as production gate)

**v1.4 — shipped 2026-05-03 (11 of 11 requirements complete; 100%):**

- ✓ AUTH-21: `/login` page renders without "Powered by NSI" pill — v1.4 (Phase 25; pill removed from `app/(auth)/_components/auth-hero.tsx`)
- ✓ AUTH-22: `/signup` page renders without "Powered by NSI" pill — v1.4 (Phase 25; same `AuthHero` fix)
- ✓ OWNER-14: home calendar selected-date renders NSI blue (`bg-primary text-primary-foreground`) with hover guard preserving `bg-gray-100` — v1.4 (Phase 25; per-instance className override on `home-calendar.tsx:72`; shared `components/ui/calendar.tsx` UNTOUCHED)
- ✓ OWNER-15: home calendar grid does not overflow parent Card on 375px mobile via `min-w-[var(--cell-size,theme(spacing.8))]` — v1.4 (Phase 25)
- ✓ BOOK-01: `/app/bookings` page renders without crashing for seeded NSI account — v1.4 (Phase 26; root cause RSC boundary violation at `bookings-table.tsx:93` confirmed via Vercel server logs; 1-line `onClick` deletion + static-text regression test)
- ✓ BOOK-02: `/app/bookings` page renders without crashing across all 3 seeded test accounts — v1.4 (Phase 26; cross-account verification 4 live shapes + 3 documented waivers)
- ✓ SLOT-01: cross-event-type overlap blocked at DB layer via `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status='confirmed')` — v1.4 (Phase 27 Plan 27-01; constraint live in production; verified verbatim against `pg_constraint`)
- ✓ SLOT-02: SLOT-01 coexists with v1.1 group-booking capacity via `event_type_id WITH <>` operator — v1.4 (Phase 27 Test 2 pins the regression-guard)
- ✓ SLOT-03: SLOT-01 coexists with reschedule semantics — v1.4 (Phase 27 Plan 27-02 maps 23P01 → existing `slot_taken` reason; `app/api/reschedule/route.ts` UNTOUCHED; Test 5 pins the lib-layer mapping)
- ✓ SLOT-04: same-event-type double-booking RCA — v1.4 (Phase 27 SUMMARY: existing `bookings_capacity_slot_idx` partial unique index continues to handle same-event-type race-safety; no regression vs. v1.1; mechanism unchanged)
- ✓ SLOT-05: Andrew live-verified cross-event collision rejection on production `nsi` account — v1.4 (Phase 27 Plan 27-03 smoke checkpoint; Phase A passed; Phase B Turnstile-blocked but acceptable per plan)
- ✓ Andrew explicit ship sign-off — v1.4 (each phase live-deploy approved as it shipped; no marathon QA executed; deploy-and-eyeball pattern continues, 4th consecutive milestone)

**v1.5 — shipped 2026-05-05 (14 of 14 requirements complete; 100%):**

- ✓ BUFFER-01: Owner can set per-event-type post-event buffer (0–360 min, step 5) on each event type via the event-type editor — v1.5 (Phase 28-01; `event-type-form.tsx:304-322` Input + Zod `z.coerce.number().int().min(0).max(360).catch(0)`)
- ✓ BUFFER-02: Slot engine reads `event_types.buffer_after_minutes` per booking with asymmetric semantics (existing booking's post-buffer extends back; candidate's own post-buffer extends forward) — v1.5 (Phase 28-01; LD-04 math at `lib/slots.ts:212-230`)
- ✓ BUFFER-03: Existing event types backfilled from `accounts.buffer_minutes` at migration time (no behavior change on day-1) — v1.5 (Phase 28-01; idempotent UPDATE migration)
- ✓ BUFFER-04: `accounts.buffer_minutes` permanently dropped from production Postgres via CP-03 two-step deploy protocol — v1.5 (Phase 28-02; drain WAIVED with explicit Andrew sign-off under documented zero-traffic rationale; new reusable drain-waiver pattern established)
- ✓ BUFFER-05: Account-level buffer control removed from availability settings; per-event-type buffer is the sole owner-facing control — v1.5 (Phase 28-02; `settings-panel.tsx` 3 Field children only)
- ✓ BUFFER-06: Cross-event-type asymmetric divergence verified on production (event A buffer=0 vs event B buffer>0; one event's buffer doesn't bleed onto another's slots) — v1.5 (Phase 28-03; 3 unit tests at `tests/slot-generation.test.ts:400-496` + Andrew live verbatim "cross event is working")
- ✓ BRAND-01: Owner-facing surfaces (auth hero subtext + tagline) reference "service businesses" instead of "trade contractors" — v1.5 (Phase 29-01; canonical phrasing tightened from "service-based businesses" → "service businesses")
- ✓ BRAND-02: README.md and FUTURE_DIRECTIONS.md reframed audience-led; LD-07 narrow override applied to `booking-form.tsx:138` inert dev comment (runtime byte-identical) — v1.5 (Phase 29-01)
- ✓ BRAND-03: Booker-facing surfaces remain audience-neutral (no NSI product copy added; existing copy unchanged) — v1.5 (Phase 29-01; three-gate verification: canonical / ROADMAP-verbatim / booker-neutrality, all 0 matches)
- ✓ BOOKER-01: Public booking card displays a 3-column horizontal layout at `lg:` (1024px+): calendar LEFT, time slots MIDDLE, form RIGHT — v1.5 (Phase 30-01; `booking-shell.tsx:180` Tailwind v4 bracket-grid `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`; Andrew live-verified at 1024/1280/1440)
- ✓ BOOKER-02: Booker card uses `max-w-4xl` (was `max-w-3xl`) to accommodate 3-column content — v1.5 (Phase 30-01; section wrapper at `booking-shell.tsx:150`; `<header>` retains `max-w-3xl` intentionally)
- ✓ BOOKER-03: Form column reserves fixed 320px at all times; placeholder before slot pick swaps to BookingForm in-place after pick with NO layout shift; RHF reset via `key={selectedSlot.start_at}` — v1.5 (Phase 30-01; reserved-column pattern + V15-MP-05 Turnstile lifecycle lock honored)
- ✓ BOOKER-04: Mobile (below `lg:`) stacks vertically in DOM order: calendar → times → form — v1.5 (Phase 30-01; single grid rule + natural document flow; embed iframe single-column at 320–600px structurally guaranteed by same `lg:` breakpoint with no embed-specific code branch)
- ✓ BOOKER-05: Andrew live-verified the 3-column desktop layout on production at 1024/1280/1440 + mobile real-device — v1.5 (Phase 30-02; verbatim "Everything looks good" blanket approval covering all 7 mandatory checks A–G on deploy SHA `8b45c50`)
- ✓ Andrew explicit ship sign-off — v1.5 (each phase live-deploy approved or waiver-justified; milestone audit `v1.5-MILESTONE-AUDIT.md` cleared 6/6 cross-phase risks; deploy-and-eyeball pattern continues, 5th consecutive milestone)

**Out of scope (carried from v1.2):** No new monetization layer (Stripe / billing); no Google Calendar sync; no SMS notifications; no mobile app; no round-robin / team scheduling; no workflow builder; no recurring bookings; no waitlists / group bookings; no two-way SMS; no per-event-type availability schedules; no multiple reminders (24h + 1h); no configurable reminder timing.

### Out of Scope

(Reasoning audited at v1.0 milestone — all entries still valid; no removals or additions.)

- **Google Calendar / iCal / Outlook sync** — Andrew explicitly wants Supabase as the sole source of truth; no external calendar OAuth.
- **Paid bookings / Stripe integration** — all bookings are free in v1; trade contractors don't typically charge for quote consultations.
- **Signup UI for new accounts / client self-serve onboarding** — v1 ships Andrew's account only; additional accounts are provisioned by Andrew when selling to a client. v2 milestone scope (per Phase 9 CONTEXT lock: "multi-tenant signup + onboarding flow; out of scope for v1").
- **Custom subdomains (`book.clientsite.com`)** — per-account path-based URLs (`app.com/[account]/[event-slug]`) are sufficient for v1; DNS work deferred.
- **Custom CSS white-label** — v1 offers logo + color theming only, not arbitrary CSS.
- **Configurable reminder timing** — hardcoded at 24h before appointment in v1.
- **Per-event-type availability schedules** — v1 uses account-wide availability applied to all event types.
- **Multiple reminders (24h + 1h)** — single 24h reminder in v1.
- **SMS notifications** — email only in v1.
- **Mobile app** — web-only (widget + hosted page).
- **Round-robin / team scheduling** — anti-feature; targets enterprises, not solo trade contractors.
- **Workflow builder** — anti-feature; n8n exists for this.
- **Video conferencing integration** — trade bookings are in-person.
- **Recurring bookings** — trade bookings are one-off jobs.
- **Waitlists / Group bookings** — complexity not justified by demand in this vertical.
- **Two-way SMS chat** — pushes into messaging-platform territory.
- **Temporal (JS proposal)** — v1 uses `date-fns v4 + @date-fns/tz`; re-evaluate when Temporal ships natively.

## Context

**Production state at v1.5 ship (2026-05-05):**

- 22,356 LOC TypeScript/TSX in the runtime tree (v1.0: 20,417; v1.1: 29,450; v1.2: 21,871 — first net-deletion milestone; v1.3: 22,071; v1.4: ~22,071 unchanged; v1.5: 22,356, NET +285 vs v1.4 close — Phase 30 state lift added ~200 LOC to `booking-shell.tsx`; Phase 28 buffer wiring contributed the rest).
- v1.5 delta: +7,502 / -990 across 55 files (most of which is `.planning/` planning artifacts; runtime code diff is much smaller).
- ~510 cumulative commits (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4 + 31 v1.5; v1.5 git range `ca402a7` → `6dc91e8`).
- 228 passing + 9 skipped automated tests at v1.5 ship (zero regression vs v1.4 baseline; 3 new BUFFER-06 divergence tests added).
- Production URL: `https://calendar-app-xi-smoky.vercel.app` (auto-deploys from `main`).
- GitHub: `https://github.com/ajwegner3-alt/calendar-app`.
- Supabase project ref: `mogfnutxrrbtvnaupoun` (region West US 2, Postgres 17.6.1).
- Seeded NSI account: `slug=nsi`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`. NSI `brand_primary` = `#0A2540` (dark navy).
- `accounts` table schema (post-v1.5): `id`, `slug`, `name`, `owner_email`, `logo_url`, `brand_primary`, `timezone`, `onboarding_complete` (and standard timestamps). `buffer_minutes` PERMANENTLY DROPPED in v1.5 (CP-03 two-step). All deprecated v1.2 columns also remain DROPPED.
- `event_types` table key columns: includes `buffer_after_minutes` (per-event-type post-buffer; default 0; range 0-360 step 5) — wired to slot engine at `lib/slots.ts:212-230` with asymmetric LD-04 math. `buffer_before_minutes` exists at default 0 (BUFFER-07 wiring deferred to v1.6+).
- `bookings` table invariants (v1.4 sealed, v1.5 unchanged): `bookings_capacity_slot_idx` partial unique on `(event_type_id, start_at, slot_index) WHERE status='confirmed'` (v1.1 group-booking capacity); `bookings_no_account_cross_event_overlap` EXCLUDE GIST on `(account_id, event_type_id WITH <>, during)` WHERE confirmed (v1.4 cross-event-type guard); generated `during tstzrange` column with `[)` half-open bound (v1.4).

**Production state historical (preserved for reference):**

- v1.2 ship (2026-05-02): 21,871 LOC TypeScript/TSX (v1.0: 20,417; v1.1: 29,450; v1.2: NET -7,579 from v1.1 close — first net-deletion milestone).
- 910 lines inserted + 1,702 lines deleted across 74 files (excluding `.planning/`) in the v1.2 milestone span.
- 448 cumulative commits (222 v1.0 + 135 v1.1 + 91 v1.2; v1.2 git range `9263770` → `d81a990`).
- 222 passing + 4 skipped automated tests across 24 test files (3 deprecated-theming test files deleted in Phase 20).
- Production URL: `https://calendar-app-xi-smoky.vercel.app` (auto-deploys from `main`).
- GitHub: `https://github.com/ajwegner3-alt/calendar-app`.
- Supabase project ref: `mogfnutxrrbtvnaupoun` (region West US 2, Postgres 17.6.1).
- Seeded NSI account: `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`. NSI `brand_primary` = `#0A2540` (dark navy; Phase 21 smoke confirmed).
- `accounts` table schema (post-Phase-21): `id`, `slug`, `name`, `owner_email`, `logo_url`, `brand_primary`, `timezone`, `onboarding_complete` (and standard timestamps). Deprecated columns (`sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity`) PERMANENTLY DROPPED.
- Pre-flight QA artifacts on prod (KEPT for v1.3 marathon): Test User 3 (`andrew.wegner.3@gmail.com`, slug `nsi-rls-test-3`), capacity-test event_type (`5344a500-acd5-4336-b195-ebea16f8dec4`), 3 distinct branding profiles applied to nsi/nsi-rls-test/nsi-rls-test-3 (navy/magenta/emerald-null).

**Tech stack (as shipped):**

- Next.js 16 + App Router + Turbopack (upgraded from spec'd Next 15 during Phase 1 research).
- TypeScript + Tailwind CSS v4 + shadcn/ui v4 (radix-nova style; `radix-ui` monorepo package).
- Supabase (Auth + Postgres + Storage); `@supabase/ssr` for cookie-based session.
- Gmail SMTP via vendored `lib/email-sender/` (post-Resend pivot during Phase 5).
- `date-fns@4.1.0` + `@date-fns/tz@1.4.1` for all time math (no raw `Date` math; `TZDate` constructor for wall-clock window endpoints).
- Cloudflare Turnstile (Managed widget) for booking-form bot protection.
- Vercel hosting + Vercel Cron (Pro tier required for hourly cron).
- `ical-generator@10` for `.ics` building; `timezones-ical-library` for VTIMEZONE blocks.
- Vitest + `@vitest/coverage-v8` for tests; alias-level mock interception in `vitest.config.ts`.

**Architectural patterns established (carried forward through v1.1):**

- **Race-safety at the DB layer** — `bookings_no_double_book` partial unique index is the authoritative double-book guard. Pattern reusable for any future "exactly one of these can succeed" insert race.
- **Service-role gate** — `lib/supabase/admin.ts` line 1 `import "server-only"`. Pattern locked for any future service-role module.
- **Per-route CSP via `proxy.ts` exclusively** — `next.config.ts` cannot conditionally delete headers. proxy.ts is the sole CSP and `X-Frame-Options` owner; locked for all future routes.
- **Direct-call Server Action contract** — actions accept structured TS objects (NOT FormData) when forms have nested arrays/discriminated unions. NEXT_REDIRECT re-throw in form catch handler.
- **Two-stage owner authorization** — RLS-scoped pre-check (via `createClient()` from `next/headers`) before delegating to service-role mutation. Pattern repeated in 3+ places.
- **Postgres-backed rate limiting** — single `rate_limit_events` table with composite index, per-route key prefix (`bookings:`, `cancel:`, `reschedule:`). `checkRateLimit` fails OPEN on DB error (transient hiccup must not lock out legitimate users).
- **Token-based public lifecycle routes** — SHA-256 hashes in DB, raw tokens only in email; rotation on every reminder send; double CAS guard on reschedule. GET pages are read-only Server Components (Gmail/Outlook prefetch links); mutations only on POST Route Handlers.
- **Reminder cron claim-once via CAS UPDATE** — `WHERE reminder_sent_at IS NULL` claim guarantees exactly one reminder per booking even with duplicate cron invocations. Reminder retry on send failure = NONE by design (RESEARCH Pitfall 4).
- **Vendor over npm-link for sibling tools** — Vercel build cannot resolve `file:../` paths. Future cross-project tools must be vendored into `lib/` (or published to npm).

**v1.2 architectural patterns added:**

- **Two-step DROP migration deploy protocol (CP-03)** — code-stop-reading deploy first; wait minimum 30 minutes for stale Vercel function instances to drain; then apply DROP SQL via locked `db query --linked -f` workaround. First production application in Phase 21. Pattern reusable for any future DROP that touches columns currently read by deployed code.
- **`db query --linked -f` LOCKED as the canonical migration apply method** — `npx supabase db push --linked` is broken in this repo (orphan timestamps in remote tracking table). All schema migrations from v1.1 forward use the workaround.
- **Atomic `BEGIN/COMMIT` migration with `IF EXISTS` guards + `DO $$ RAISE NOTICE` header** — pattern for any defensive forward-only schema migration. Substantive defensive checks (grep, tsc, pg_type existence) live in pre-flight gates, NOT in SQL.
- **`.SKIP` extension for inert rollback artifacts** — `<TIMESTAMP+1>_readd_<thing>.sql.SKIP` authored alongside DROP migrations. Excluded from Supabase migration runner. Activate by renaming if rollback genuinely required (forward-only posture by default).
- **Held-local commit during drain windows** — Phase 21 Task 2 commit was held LOCAL (not pushed) during the 30-min drain so a push wouldn't restart the timer. Pattern for any future protocol that gates on "no new code deploys for N minutes".
- **CSS variable scope contract: variables do NOT cross iframe document boundaries** (CP-05) — confirmed in Phase 17. Embed widget sets its OWN `--primary` independently from parent PublicShell. Phase 12.6's `style={{ "--primary": ... }}` wrapper pattern is decommissioned for owner shell but REQUIRED for embed.
- **Single-source `--primary` cascade on owner shell** — `:root --primary: oklch(0.606 0.195 264.5)` (closest oklch to `#3B82F6`); shadcn Button / Switch / Calendar / focus rings inherit directly; no per-account chrome wrapper. Locked for owner side. Public side keeps the dual `--brand-primary` + `--primary` contract via `PublicShell`.
- **Multi-variant `Header` component** (`'owner' | 'auth' | 'public'`) — single component, three branches; `variant="auth"` skips `SidebarTrigger`; `variant="public"` carries `branding?` + `accountName?` props. Reusable for any future no-sidebar surface.
- **Owner shell card class lock** — `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`. Auth/onboarding cards use `rounded-xl` (12px) by intentional design distinction. Public hero card uses `rounded-2xl` (more pronounced curve).
- **Visual gates run on live Vercel preview, not local dev** — wip commits used for gates are reverted in follow-up commits; both stay in history. "All testing is done live" project rule honored.
- **JIT pitfall lock (MP-04)** — runtime hex via inline `style={{}}` only. NEVER `bg-[${color}]` dynamic Tailwind (purged at build time, not regenerated at runtime). Applies to `BackgroundGlow color`, blob inline styles, `MiniPreviewCard` runtime color props, all email senders' band color.
- **First net-deletion milestone pattern** — v1.2 deleted 8 deprecated component files + 3 test files + 4 DB columns + 2 ENUM types. NET -792 lines runtime. Pattern: deprecate-with-shim (Phase 18) → migrate-consumers (Phases 15-17, 19) → delete-tests-then-functions (Phase 20) → DROP-DB-with-drain (Phase 21). Deletion-heavy phases follow this 4-step ordering.

**v1.1 architectural patterns added:**

- **Postgres SECURITY DEFINER provisioning trigger + Server Action UPDATE hybrid** — trigger creates stub `accounts(slug=null, name=null, onboarding_complete=false)` on every `auth.users` INSERT (atomicity-first); wizard UPDATEs to (slug, name, onboarding_complete=true) via RLS-scoped Server Action (UX-error-clarity). Pattern reusable for any future "row must exist before user can interact, but final values come later" provisioning flow.
- **`/auth/confirm` Route Handler with `verifyOtp({ type, token_hash })` pattern** — canonical handler for signup, recovery, magiclink, email_change. Recovery type hard-overrides `next` param → always `/auth/reset-password`. Replaces v1.0's broken `/auth/callback`.
- **Race-safe N-per-slot via slot_index extended unique index** — `bookings_capacity_slot_idx` ON `(event_type_id, start_at, slot_index) WHERE status='confirmed'`. Application retry loop tries slot_index=1..N on Postgres 23505. Replaces v1.0's `bookings_no_double_book` 1-per-slot pattern. Preserves v1.0 capacity=1 behavior (slot_index=1 only).
- **CONCURRENTLY index migration via shell pipe** — `echo | npx supabase db query --linked` (CLI -f wraps in implicit transaction blocking CONCURRENTLY).
- **Per-account inline-style chrome theming via shadcn CSS variable overrides** — `--primary` + `--primary-foreground` + `--sidebar-foreground` overrides on inline `style` props at the `(shell)` layout wrapper. Direct hex (no oklch conversion). Public surfaces NOT in scope.
- **Email header band priority chain** — `branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY` for solid-color rendering. No VML, no CSS gradients (Outlook + Yahoo support).
- **Quota-guard wrapper for Gmail SMTP** — `checkAndConsumeQuota()` in `lib/email-sender/quota-guard.ts`; signup-side senders fail-closed at cap; bookings/reminders bypass to protect core flow.

**Known issues / technical debt (carried into v1.3, see FUTURE_DIRECTIONS.md §4 + §8):**

- 1 documented ESLint warning (`react-hooks/incompatible-library` on `event-type-form.tsx:99` — RHF `watch()` not memoizable; refactor to `useWatch`). v1.0 carry-over, RE-confirmed at v1.1 + v1.2 close.
- Pre-existing `tsc --noEmit` test-mock alias errors in `tests/` (~22 errors, all `TS7006`/`TS2305`; mock exports aliased only in `vitest.config.ts`, not `tsconfig.json`). v1.0 carry-over, RE-confirmed at v1.2 close as baseline.
- Migration drift workaround: `supabase db push --linked` fails; locked alternative is `supabase db query --linked -f`. v1.0 carry-over; first DROP migration (Phase 21) used the workaround successfully.
- `generateMetadata` double-load on public booking page (acceptable; can wrap in `import { cache } from 'react'`). v1.0 carry-over.
- Supabase service-role key still legacy JWT (`sb_secret_*` format not yet rolled out). v1.0 carry-over; waiting on Supabase rollout.
- Plan 08-05/06/07 wave-2 git-index race (multi-agent commits swept in untracked sibling files; future YOLO multi-wave runs should serialize commits or use per-agent worktrees). v1.0 carry-over.
- Vercel cron remains on Hobby tier `0 13 * * *` daily schedule; flip `vercel.json` to `0 * * * *` after Vercel Pro upgrade. v1.0 carry-over, RE-confirmed at v1.2 close.
- `rate_limit_events` test DB cleanup gap — 4 transient bookings-api.test.ts failures observed when the table accumulates between runs; rate-limited integration tests require 60-90s cooldown between vitest runs. v1.1 introduced; RE-confirmed at v1.2 close as pre-existing environment constraint.
- `/app/unlinked` UX hole for soft-deleted accounts on re-login. v1.1 introduced (Plan 10-07 acceptable trade-off).
- `public/nsi-mark.png` placeholder (105 bytes solid-navy) — replaced with text-only "Powered by North Star Integrations" footer in v1.2 (EMAIL-19 + PUB-04). Image asset still in `public/`; cleanup at v1.3 image swap.
- Two known comment-only files (`app/(shell)/layout.tsx`, `app/embed/[account]/[event-slug]/_components/embed-shell.tsx`) contain inert JSDoc/comment references to dropped column names — left in place as inert documentation post-Phase-21 DROP.
- `app/embed/[account]/[event-slug]/_lib/types.ts` `AccountSummary` retained `background_color` + `background_shade` fields through Phase 20; cleaned by Phase 21 DROP migration but the local interface still has the fields. Cosmetic; not load-bearing post-DROP.

**Existing tooling reused:**

- `lib/email-sender/` (vendored from `tools-made-by-claude-for-claude/email-sender`; post-Resend pivot to Gmail SMTP).
- Supabase `calendar` project pre-existed.

## Constraints

(Audited at v1.0 milestone — all entries still valid; one constraint changed during development.)

- **Tech stack**: Next.js + Tailwind CSS + TypeScript on Vercel, Supabase for DB + Auth, vendored `@nsi/email-sender` for Gmail SMTP. — Matches Andrew's standard NSI stack.
- **Hosting budget**: Free tier of Supabase + Resend (3k emails/mo). **Updated 2026-04-26:** Vercel Pro tier required for hourly cron schedule (`vercel.json` `0 * * * *` does not deploy on Hobby; cron-job.org fallback was researched and dropped during Plan 08-08).
- **Data ownership**: Supabase is the sole source of truth for availability and bookings.
- **Multi-tenant from day one**: Schema isolates data per account even though only one account exists in v1.
- **Deploy after every logical unit**: Push to GitHub → Vercel for each completed feature per Andrew's live-testing workflow.
- **Manual QA as final phase**: Last phase is explicitly Manual QA & Verification; project isn't done until Andrew signs off. — v1.0 sign-off recorded 2026-04-27 with verbatim "ship v1" direction; marathon QA scope-cut to v1.1 by project-owner discretion.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Calendly-style booking tool, not a general calendar | Matches the actual use case; narrower scope ships faster | ✓ Good — scope held; shipped in 10 days |
| Multi-tenant architecture from day one, v1 ships single account | Supports the NSI business model without forcing later data migration | ✓ Good — schema supports v2 signup with no migrations needed |
| Embeddable widget (script + iframe) as primary distribution + hosted page per account | Portable to any host site; hosted page gives shareable link | ✓ Good — `/widget.js` live-verified posting from `https://example.com` (2026-04-26); live Squarespace/WordPress deferred to v1.1 |
| Supabase is sole source of truth — no Google Calendar sync | Removes OAuth/sync complexity; trade-off is owner manages all availability in-app | ✓ Good — race-safe at DB layer; no sync failure modes |
| Per-account branding = logo + colors only (no custom CSS) | Good enough for trade contractors; avoids support burden | ✓ Good — `BrandedPage` wrapper + email branding-blocks shipped clean |
| Vendor `@nsi/email-sender` into `lib/email-sender/` (NOT `npm install ../email-sender`) | Vercel build cannot resolve sibling-relative `file:../` paths | ✓ Good — locked pattern for any future shared tooling |
| Email provider pivot Resend → Gmail SMTP | Resend domain verification stuck; Gmail SMTP available immediately via owner's account | ⚠ Revisit when scaling — Gmail SMTP not suitable for high volume; revisit if multi-account v2 lights up |
| POST `/api/bookings` is a Route Handler, NOT a Server Action | Server Actions cannot return 409 status code (race-loser flow requires it) | ✓ Good — clean inline-banner UX preserves form values |
| DB-level race-safe via partial unique index | RESEARCH Pitfall 1 — application-layer race checks don't close the window | ✓ Good — Vitest race test proves: 2 concurrent submits → 1 success + 1 23505 → 409 |
| `timestamptz` everywhere + IANA TZ + `date-fns v4 + @date-fns/tz` | RESEARCH Pitfall 2 — raw Date math fails DST; `formatInTimeZone` doesn't exist in `@date-fns/tz` | ✓ Good — March 8 + Nov 1 2026 DST tests green |
| CSP lives ONLY in `proxy.ts` (never `next.config.ts`) | `next.config.ts` cannot conditionally delete `X-Frame-Options` at runtime | ✓ Good — locked across Phases 7+; embed CSP works |
| Vercel Pro tier for hourly cron | Hobby tier deploys at most daily; cron-job.org fallback dropped during Plan 08-08 | ✓ Good — `vercel.json` `0 * * * *` deployed (production verification deferred to v1.1) |
| Token rotation on every reminder send | Prevents stale-token replay; same UPDATE that claims `reminder_sent_at` | ✓ Good — accepted side-effect: original confirmation tokens stop working post-reminder (v1.1 may add resend UI) |
| Reminder retry on send failure = NONE | RESEARCH Pitfall 4 — clearing `reminder_sent_at` on failure causes retry spam | ✓ Good — at-most-once delivery acceptable for v1 |
| Marathon QA scope-cut to v1.1 by project-owner discretion | "Other problems are more pressing and will be addressed in the next milestone" | ⚠ Revisit — v1.1 ALSO deprioritized marathon QA at sign-off; same items now carried to v1.2. Pattern of marathon-deferral is forming; v1.2 should commit time-boxed marathon execution or formally accept deploy-and-eyeball as the production gate. |
| v1.1 scope-cut on 2026-04-27 to focus on multi-user + capacity bug + branding overhaul | Andrew flagged a real prod double-booking, no UI for settings discovery, plain UI lacking "website feel", and most urgent need = open signup. Marathon QA recarried to v1.2. | ✓ Good — all 3 capability areas shipped at code level in 3 days; Andrew live-approved Phase 12.6 on Vercel; sign-off "consider everything good" 2026-04-30. |
| Multi-user signup ships free in v1.1 (no Stripe / billing) | Distribution first; monetization layer in later milestone | ✓ Good — `/signup` live; Gmail SMTP quota guard caps signup-side emails at 200/day so cost stays bounded until v1.2 Resend migration. |
| Branding tokens grow to include `background_color` + `background_shade` per-account | Andrew explicitly named tailwind-landing-page Cruip "Simple Light" gradient style as the target; per-account customization keeps multi-user theme-able | ⚠ Revisit — `background_shade` (none/subtle/bold) shipped but its usefulness is questionable now that direct `sidebar_color` + `background_color` + `brand_primary` (Phase 12.6) override the dashboard chrome. v1.2 may consider deprecating `background_shade` if Andrew finds the 3-color picker sufficient. |
| Phase 12.5 inserted as scope extension between Phase 12 and Phase 13 | Per-account heavy chrome theming + email token unification + FloatingHeaderPill removal — Phase 12 verified at code level (5/5 must_haves) but Andrew wanted owner-controllable chrome intensity before QA | ⚠ Revisit — Phase 12.5's color-mix tinting (6-14% percentages) was visually-indistinguishable on Vercel review; superseded by Phase 12.6 within 24h. Pattern: visual decisions deserve a deploy-and-eyeball checkpoint before locking the implementation. |
| Phase 12.6 inserted same day as 12.5 closure as Andrew course-correction | Vercel review showed 12.5 chromes were indistinguishable from gray-50 even at full intensity with strong navy; replaced tinting model with direct hex application across 3 controls; first wire-up of `brand_primary` to shadcn `--primary` CSS variable | ✓ Good — Andrew live-approved 12.6 deploy same day; the 3-color direct-pickers UX is what shipped to production. DB columns from 12.5 retained for one v1.1 release window before v1.2 DROP. |
| Capacity mechanism: Option B (slot_index + extended unique index) replaces v1.0 partial unique index | RESEARCH.md verdict per CAP-01 root-cause investigation; preserves v1.0 invariant style of fully index-enforced uniqueness; CAP-07 SLOT_TAKEN/SLOT_CAPACITY_REACHED branching for booker UX | ✓ Good — `bookings_capacity_slot_idx` live on prod; `bookings_no_double_book` cleanly dropped via defensive transaction; smoke 23505 confirmed; 148+ tests green; pg-driver race test (CAP-06) skip-guarded for v1.2 live execution. |
| CAP-01 verdict (c) rescheduled-status slot reuse is structural-gap-by-design | 6-step diagnostic against prod found ZERO duplicate confirmed bookings; the apparent gap is rescheduled bookings holding their original slot for audit purposes | ✓ Good — root cause documented; mechanism replacement landed regardless; no behavior change to confirmed bookings semantics. |
| Email gradient strategy = solid-color-only (no VML, no CSS gradients) | CONTEXT.md lock per Phase 12 plan; lowest risk for v1.1 given Outlook desktop + Yahoo zero gradient support; trade-off is less visual parity with web surfaces | ✓ Good — `renderEmailBrandedHeader` ships solid-color band across all 6 transactional senders; live cross-client QA deferred to v1.2 but the architecture is correct. |
| `--primary` CSS variable override scope: dashboard `(shell)` only | Public `/[account]` and `/embed` surfaces NOT in scope; Phase 12.6 lock; deferred to v1.2 if Andrew requests | — Pending — v1.2 may extend to public surfaces if branded-button rendering on the booker side becomes important; not requested at v1.1 sign-off. |
| Phase 13 marathon waived by Andrew at sign-off 2026-04-30 | Verbatim "consider everything good. close out the milestone." Ship gate is code-level verifier passes (Phases 10/11/12/12.5/12.6) + Andrew live Vercel approval of 12.6 + 277 passing tests | ⚠ Revisit — same waiver pattern as v1.0 → v1.1 (marathon scope-cut). Pre-flight artifacts for v1.2 marathon are KEPT on prod (Test User 3, capacity-test event, 3 branding profiles). v1.2 should either commit time-boxed marathon execution upfront or formally adopt deploy-and-eyeball as the production gate. |
| v1.2 owner shell locked to NSI ONLY; per-account chrome theming stripped from `(shell)/layout.tsx` + `AppSidebar` | Phase 12.6's per-account `--primary` wrapper made the owner side feel like a generic Calendly clone, not an NSI product. Lead-scoring "Simple Light" reference was the visual target. | ✓ Good — Andrew approved live Vercel after Phase 15 deploy. Owner side now reads as an NSI product. Public booking surfaces still ship the contractor's `brand_primary`. |
| v1.2 `BrandedPage` REPLACED with new `PublicShell` | Clean break retired `GradientBackdrop` + `NSIGradientBackdrop` complexity in one move; avoided 2-month deprecation window. | ✓ Good — Phase 17 9-plan migration landed in 5 waves; Andrew approved 10/10 visual gates. 233 lines legacy chrome deleted. |
| v1.2 `brand_accent` column DROPPED at scoping (never built) | Adding then dropping a column is unnecessary thrash; lead-scoring uses single accent color; trade contractors don't need 2 brand colors. | ✓ Good — saved a roundtrip; ships as 1 color (`brand_primary`) only. |
| v1.2 Branding editor collapsed from 5 controls to 2 (logo + brand_primary) | 3 deprecated controls (`sidebar_color`, `background_color`, `background_shade`) were leftovers from Phase 12.5/12.6 chrome experimentation. After owner shell locked to NSI, they had no effect on the owner side and were redundant on the booker side (where `brand_primary` already drives the customer color). | ✓ Good — `saveBrandingAction` deleted entirely (zero callers post-rewrite); `MiniPreviewCard` rebuilt as faux public booking page; Andrew approved 8/8 visual gates Phase 18. |
| v1.2 Two-step DROP deploy protocol (CP-03) | The 4 deprecated columns + 2 ENUM types were still being read by deployed Vercel function instances after Phase 20 ship; dropping them immediately would 500 stale function instances. Mandatory 30-minute drain window. | ✓ Good — Phase 21 first production application; drain satisfied by 25× minimum (772 minutes overnight); zero booking failures during the smoke test against the schema-cleaned table. Pattern locked for any future DROP migration. |
| v1.2 `db query --linked -f` LOCKED as canonical migration apply method | `npx supabase db push --linked` is broken in this repo (orphan timestamps in remote tracking table). Workaround proven in v1.1 capacity migration; v1.2 first DROP migration further validated. | ✓ Good — Phase 21 applied successfully; 3 verification queries confirmed the schema state. |
| v1.2 Atomic single-commit pattern (CP-02) for cross-cutting interface changes | Phase 19 (`EmailBranding` collapse) had no external consumers outside the email layer itself; types-first wave split was unnecessary overhead. | ✓ Good — single commit `0130415` landed clean; the 5th `sendReminderBooker` caller was discovered and fixed inline (pre-flight tsc gate caught it); CP-02 atomic lock preserved. |
| v1.2 Types-first wave split for shim-and-rewrite (CP-04) | Phase 18 (`Branding` interface shrink) had `chrome-tint.ts` + its test as type-broken intermediate consumers; Wave 1 commit intentionally tsc-broken; Wave 2 fixed via editor rewrite; push deferred until end of Wave 2. | ✓ Good — clean break landed despite tsc-broken intermediate; production deploy succeeded on first push at end of Wave 2. Pattern reusable for any "shrink type → rewrite consumer" two-wave plan. |
| v1.2 First net-deletion milestone (NET -792 lines runtime) | After 3 milestones of additive growth (v1.0 + v1.1 = 29,450 LOC), v1.2 deliberately shipped deletion-heavy: 8 deprecated component files + 3 test files + 4 DB columns + 2 ENUM types. | ✓ Good — codebase shrunk to 21,871 LOC; test suite shrunk to 222 passing (broken-on-import tests removed); CI faster. Pattern: deprecate-with-shim → migrate-consumers → delete-tests-then-functions → DROP-DB-with-drain. |
| Marathon QA waived AGAIN at v1.2 sign-off (third deferral) | Phase 21 production booking smoke test confirmed end-to-end correctness against schema-cleaned `accounts` table; verifier 8/8 must-haves PASSED. Andrew opted for direct `/gsd:complete-milestone` over `/gsd:audit-milestone`. | ⚠ Revisit — third consecutive marathon deferral (v1.0 → v1.1 → v1.2 → v1.3). Pattern is fully formed: deploy-and-eyeball is the de-facto production gate. v1.3 should formalize this — either commit time-boxed marathon execution UP FRONT (with hard ship gate) OR formally adopt deploy-and-eyeball as the canonical production gate and retire the QA-09..QA-13 + 21-item carryover backlog. |
| v1.3 formally adopted deploy-and-eyeball as canonical production gate | Marathon QA waived for fourth consecutive milestone (v1.0 → v1.1 → v1.2 → v1.3); Andrew chose surgical bug-fix scope and direct `/gsd:complete-milestone` path with no audit. Same pattern across 4 milestones is no longer "deferral" — it's the operating model. | ✓ Good — the carryover backlog (5 clusters: Marathon QA, Infrastructure, Auth additions, Brand asset, Tech debt) is now correctly classified as v1.4 backlog rather than v1.3 deferred work. Future milestones SHOULD ship surgically against direct user feedback, not against marathon-style QA. |
| v1.3 same-day milestone shipped (~10 hours scope-lock to ship) | Surgical scope (8 items, 3 phases, 6 plans, all touching existing surfaces) executed via parallel waves. No new packages, no new architecture, no schema changes. | ✓ Good — pattern reproducible when scope is < 10 plans and all touch existing surfaces. v1.0 took 10 days, v1.1 took 3, v1.2 took 3, v1.3 took 1 (same-day). Surgical milestones can compress to a working day; greenfield milestones cannot. |
| v1.3 mid-checkpoint scope expansion accepted into Plan 24-02 (commit `db7fb62`) | Andrew's live-verify feedback added two requirements (per-row copy-link button + blue dropdown highlight) that fit the same surface as Plan 24-02. Bundling into the open plan was simpler than spawning new plans for two-className-override edits. | ✓ Good — pattern: mid-execution feedback that fits the same surface gets bundled rather than spawning new plans. Document in SUMMARY.md as a deviation under Rule 3, then verifier checks it as part of the parent plan's must-haves. |
| v1.3 per-instance className override pattern extended from Phase 23 to Phase 24 (calendar + dropdown) | Phase 23 established the invariant for shared `components/ui/calendar.tsx`. Phase 24 applied the same pattern to `components/ui/dropdown-menu.tsx` and `home-calendar.tsx` DayButton. When a CSS custom property is shared across multiple consumers and only ONE needs to change, override at the consumer site. | ✓ Good — pattern locked across 3 surfaces. `globals.css --color-accent` token preserved for 3 other consumers (bookings-table hover, cancel-confirm-form hover, public booker `.day-has-slots::after`). Reusable any time a per-surface theming change conflicts with a shared component or token. |
| v1.4 EXCLUDE constraint (Option A) over trigger (Option B) for cross-event overlap | DDL live-verified against production Postgres 17.6.1 by research; `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status='confirmed')` with `btree_gist`. Trigger is fallback only and was never needed. | ✓ Good — Phase 27 constraint live in production; verified verbatim via `pg_constraint`. Pattern reusable for any future "this combination of rows must be unique under a partial predicate" invariant. |
| v1.4 Pre-flight diagnostic as hard gate (V14-CP-06) before VALIDATE-CONSTRAINT-aborting DDL | `VALIDATE CONSTRAINT` aborts on existing rows that violate the new constraint, leaving the migration in unrecoverable partial state. The diagnostic catches exactly the abort-trigger rows BEFORE any DDL runs. Non-zero rows STOP the workflow and surface to the user for manual data resolution; do NOT auto-cancel programmatically. | ✓ Good — Phase 27 Plan 27-01 pre-flight returned 0 cross-event overlap rows on a 6-row bookings table; gate satisfied without manual data resolution. Pattern: pre-flight → checkpoint:human-verify → migrate. Reusable for any future EXCLUDE / unique constraint / partial-WHERE migration. |
| v1.4 23P01 retry-loop-break ordering in `app/api/bookings/route.ts` (V14-MP-01) | The capacity retry loop iterates `slot_index` on 23505 (capacity races). 23P01 (cross-event overlap) is independent of slot_index — incrementing it would loop infinitely. Branch placement: 23P01 BEFORE the `code !== "23505"` check, with an immediate `break` (no `continue`, no slot_index increment). | ✓ Good — Phase 27 Plan 27-02 + Plan 27-03 Test 6 (static-text scan asserts ordering). Pattern: any new error code that's independent of the retry condition must break BEFORE the retry guard. |
| v1.4 Reuse-existing-reason mapping for indistinguishable error classes (23P01 → `slot_taken` in reschedule lib) | The booker can't distinguish a same-event-type race from a cross-event-type race — both manifest as "your time was taken." Mapping 23P01 → existing `slot_taken` reason in `lib/bookings/reschedule.ts` reuses the existing 409 SLOT_TAKEN response in `app/api/reschedule/route.ts` unchanged. No new code path, no copy change, no parallel updates to client UI for the reschedule flow. | ✓ Good — Phase 27 Plan 27-02 V14-MP-02. Pattern reusable for any error class that's user-indistinguishable from an existing one. |
| v1.4 PII-free observability logs for new error branches | Production-monitoring needs require structured log lines for new error paths (23P01 in route.ts and reschedule.ts) but the lines must NEVER include `booker_email`, `booker_name`, `booker_phone`, or `ip`. Allowed structural identifiers only: `code`, `account_id`, `event_type_id`, `booking_id`. | ✓ Good — Phase 27 Plan 27-02 verified by PII-grep. Pattern locked for all future log lines on user-data paths. |
| v1.4 Static-text scan tests for control-flow invariants (extended from Phase 26 to Phase 27) | Some invariants live in source code structure (RSC boundary correctness, branch ordering, presence of a `break`). Reading the source as fs text + regex-asserting properties catches exactly these regression classes with zero new dependencies. Place OUTSIDE `describe.skipIf` blocks so they run in CI without `SUPABASE_DIRECT_URL`. | ✓ Good — Phase 26 `tests/bookings-table-rsc-boundary.test.ts` (no `onClick=` in tel: anchor block) and Phase 27 Test 6 (`retry-loop-break`: 23P01 BEFORE 23505 check, `break;` follows, no `slot_index` increment). Pattern reusable for any control-flow or boundary invariant. |
| v1.4 `describe.skipIf(skipIfNoDirectUrl)` for pg-driver tests (V14-MP-05) | pg-driver tests need `SUPABASE_DIRECT_URL` to exercise constraint behavior end-to-end; CI doesn't have that. The `describe.skipIf` wrapper makes 5/6 of Phase 27's tests skip cleanly while still running Test 6 (the static-text scan) in every environment. | ✓ Good — Phase 27 Plan 27-03; mirrors `tests/race-guard.test.ts` precedent. Locally without DIRECT_URL: 225 + 9 (5 skip); with DIRECT_URL set: ≥230 + 4. Pattern locked for all future pg-driver tests. |
| v1.4 Marathon QA waived AGAIN at sign-off (4th consecutive deferral; deploy-and-eyeball formally the operating model) | v1.0 → v1.1 → v1.2 → v1.3 → v1.4 all chose deploy-and-eyeball with no marathon QA executed. Andrew live-approved each phase as it shipped on production Vercel. | ✓ Good — pattern is no longer deferral; it IS the operating model. The carryover backlog (Marathon QA, Resend, Vercel Pro, OAuth, magic-link, brand asset, ~7 tech-debt items) is correctly reclassified as v1.5+ backlog. Future milestones SHOULD ship surgically against direct user feedback. |
| v1.4 Buffer semantics intentionally NOT modified (account-scoped, pre-existing v1.0) | Phase 27 smoke surfaced that `accounts.buffer_minutes` (account-scoped, pre-existing v1.0) causes `lib/slots.ts:203 slotConflictsWithBookings` to pre-hide adjacent slots for ANY same-account booking. The DB constraint correctly allows `[)` adjacency (Test 3 pins this); the picker pre-hides slots earlier due to buffer. Andrew chose option (a) keep buffer behavior; surfaced BUFFER-01 candidate (event-type-scoped buffer) for v1.5. | ✓ Good — surfaced as v1.5 candidate; closed by Phase 28 (BUFFER-01..06 shipped 2026-05-04) with asymmetric LD-04 math replacing the symmetric account-wide pre-hiding. |
| v1.5 LD-01 column-name lock (BUFFER): reuse existing `event_types.buffer_after_minutes` (already at default 0); do NOT add `post_buffer_minutes` | Column already existed in production with correct semantics; renaming would be migration thrash with no behavior change | ✓ Good — saved a migration roundtrip; semantics already correct in the existing column. Pattern: when an existing column matches the desired semantic shape, reuse it rather than introducing a parallel rename. |
| v1.5 LD-04 asymmetric buffer math: existing booking's post-buffer extends BACK (per-booking field); candidate's own post-buffer extends FORWARD (per-candidate field) | Symmetric account-wide pre-hiding (the v1.0 model) bled buffer between unrelated event types; asymmetric per-event-type math gives owners cross-event independence (event A buffer=0 doesn't cost slots to event B's buffer>0) | ✓ Good — Phase 28 BUFFER-06 divergence test block (3 tests) pins the asymmetric contract; Andrew live-verified on production nsi account ("cross event is working"). Pattern reusable for any future "this resource's behavior should be local to its owner, not bleed across siblings" semantic. |
| v1.5 CP-03 30-min drain WAIVED for Phase 28-02 with explicit Andrew sign-off (zero-traffic single-tenant rationale) | Single-tenant nsi product with no public booker traffic in flight; serverless cold-instance idle-out (~15 min) covers warm-instance protection; residual risk explicitly accepted by Andrew | ✓ Good — first formal use of the new drain-waiver pattern. Pattern: future served drains remain default; waiver requires explicit user sign-off + STATE.md decision before launch. Reusable for any future zero-traffic single-tenant DROP migration. |
| v1.5 LD-07 narrow override: rebrand `booking-form.tsx:138` inert dev comment despite booker-neutrality lock (runtime byte-identical at line 139) | The booker-neutrality lock is about runtime UI strings; an inert dev comment is auditable to byte-equivalent runtime output, so a narrow carve-out preserves the spirit of the lock while completing the canonical grep gate | ✓ Good — established the LD-lock deliberate-override pattern. Pattern requires explicit narrow-scope language re-stated CONTEXT → PLAN → SUMMARY for auditability; NOT a license to revisit locks broadly. |
| v1.5 Mid-execution Rule 4 architectural-decision pattern (new): when an executor discovers an unanticipated importer of a "to-be-deleted" file, surface as a Rule 4 architectural decision to the user before proceeding — do NOT assume safe to delete just because the active phase no longer needs it | Plan 30-01 as written locked `slot-picker.tsx` for deletion; executor discovered `app/reschedule/[token]/_components/reschedule-shell.tsx:6` still imports it (Phase 6 reschedule flow, live in production). Surfacing as architectural decision preserves user control over scope amendments | ✓ Good — first exercised cleanly in Plan 30-01; Andrew chose Option A (keep file on disk; deletion deferred). Pattern reusable for any future component-removal phase. New planner discipline: any plan that locks a file deletion MUST grep all importers during research, NOT only at execution time. |
| v1.5 Smallest-diff override of plan-locked refactor moves: when an architectural amendment changes the underlying assumption (e.g., file no longer being deleted), pick the smallest-diff path to satisfy the new constraint — not the plan-locked move | Plan 30-01 said move `Slot` interface into `booking-shell.tsx` because `slot-picker.tsx` was being deleted. With Option A (file stays), executor kept `import { type Slot } from "./slot-picker"` (single-line diff) instead of moving the type definition. The plan's locked move was instrumental (means to an end), not load-bearing (the actual deliverable) | ✓ Good — pattern locked. When a plan locks a refactor as a means to an end, the executor evaluates whether the means is still required after an amendment, not whether to execute the literal text. |
| v1.5 Verification-only plan pattern (reused twice): when prior plans in a phase have already shipped the implementation, a phase-closing plan can be a pure verification pass with zero code commits | Plan 28-03 + Plan 30-02 both shipped as zero-code closers with Andrew-quote-on-record SUMMARY format. Plan 28-03 found everything green from prior plans; Plan 30-02 was Andrew's live-verify smoke approval | ✓ Good — reusable for any future "prove it works in prod" closer. Plan 30-02 also introduced the **single-phrase blanket approval** sub-pattern (free-text "Everything looks good" mapped 1:1 to enumerated checks because the checkpoint message itself enumerated the exact scope). |
| v1.5 Single grid owner UI pattern: parent shell owns the grid template; child columns render as direct grid children (no nested grids) | Replaces the prior nested 2-col-inside-2-col booker pattern. State for slot-fetch + selection lives in the parent so columns can reflow together at breakpoint changes | ✓ Good — Phase 30-01 implementation in `booking-shell.tsx:180`. Reusable for any future multi-column layout where the columns logically belong to the same visual unit (a "card") and should reflow together. Tailwind v4 bracket-grid syntax (`lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`) is the canonical form. |
| v1.5 Reserved-column pattern for conditional-mount UI: when a UI element is mounted/unmounted conditionally but should NOT cause layout shift in sibling columns, reserve its grid track at a fixed width, show a `<div>` placeholder before mount, swap for the real component on mount | Combines with V15-MP-05 Turnstile lifecycle lock to give "form column always visible at fixed width, content swaps in place, zero layout shift, Turnstile token never stales" | ✓ Good — Phase 30-01 implementation. Reusable for any conditional-mount-with-side-effect component (analytics widgets, payment forms, etc.). RHF reset on re-pick handled cleanly via `key={selectedSlot.start_at}` on the mounted form. |
| Marathon QA waived AGAIN at v1.5 sign-off (5th consecutive deferral; deploy-and-eyeball formally the operating model since v1.3) | v1.0 → v1.1 → v1.2 → v1.3 → v1.4 → v1.5 all chose deploy-and-eyeball with no marathon QA executed. Andrew live-approved each phase as it shipped on production Vercel. The pattern is no longer deferral; it IS the operating model | ✓ Good — pattern fully institutionalized. The carryover backlog (Marathon QA retired, INFRA-01/02, AUTH-23/24, BRAND-22, DEBT-01..07, 3 Phase 26 audit fragilities) remains correctly classified as v1.6+ backlog. Future milestones SHOULD ship surgically against direct user feedback. |

---
*Last updated: 2026-05-05 after v1.5 milestone shipped (Buffer Fix + Audience Rebrand + Booker Redesign — 14/14 requirements complete; 3 phases; 6 plans; ~2 calendar days; per-phase verifier 5/5 × 3; milestone audit cleared 6/6 cross-phase risks; deploy-and-eyeball 5th consecutive milestone)*
