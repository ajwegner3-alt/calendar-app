# Project Milestones: Calendar App (NSI Booking Tool)

## v1.2 NSI Brand Lock-Down + UI Overhaul (Shipped: 2026-05-02)

**Delivered:** Unified North Star Integrations visual language across the entire owner-facing app — `bg-gray-50` + blue-blot `BackgroundGlow` + glass "NorthStar" header pill + Inter weights 400-800 — while preserving each contractor's `brand_primary` on public booking surfaces and the 6 transactional emails. Per-account chrome theming stripped from the owner shell. Branding editor collapsed from 5 controls to 2 (logo + `brand_primary`). 4 deprecated `accounts` columns and 2 ENUM types permanently dropped from production Postgres via two-step deploy protocol. First net-deletion milestone (NET -792 lines).

**Phases completed:** 14-21 — 8 phases, 22 plans total.

**Key accomplishments:**

- **Owner shell + auth + onboarding re-skinned to lead-scoring "Simple Light" reference** — `BackgroundGlow` + glass `Header` pill with "NorthStar" wordmark + gray-50 base + Inter weights 400-800 + Roboto Mono. Phase 12.6's `--primary` wrapper div decommissioned; shadcn primary inherits NSI blue-500 directly via `:root --primary`. 14 owner-page cards standardized to `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`. Andrew live-approved on Vercel after Phase 15 deploy.
- **Public booking + embed surfaces unified under `PublicShell`** — replaced legacy `BrandedPage` + `GradientBackdrop` + `NSIGradientBackdrop`. Customer `brand_primary` drives `BackgroundGlow` tint, glass pill (logo or initial circle), and slot-picker `--primary`. Embed widget sets its OWN `--primary` independently (CP-05 confirmed: CSS vars don't cross iframe boundaries). PoweredByNsi footer renders inside iframe. 233 lines legacy chrome deleted in Phase 17. Andrew approved 10/10 visual gates 2026-04-30.
- **Branding editor collapsed from 5 controls to 2** — removed `sidebar_color`, `background_color`, `background_shade` pickers; kept logo uploader + "Booking page primary color". `MiniPreviewCard` rebuilt as faux public booking page (gray-50 + brand-primary blob + white card + slot picker). `saveBrandingAction` deleted entirely (zero callers post-rewrite). Andrew approved 8/8 visual gates 2026-05-01.
- **Email layer simplified atomically** — `EmailBranding` interface collapsed to `{ name, logo_url, brand_primary }`. Color resolution simplified from 3-step `sidebarColor → brand_primary → DEFAULT` chain to `brand_primary → DEFAULT`. All 6 senders + 4 route/cron callers + 2 tests in single atomic deploy (`0130415`). Footer `nsi-mark.png` replaced with text-only "Powered by North Star Integrations". 5th `sendReminderBooker` caller (manual-trigger reminder path) discovered and fixed in same commit.
- **653 lines of deprecated theming dead code deleted** — `chrome-tint.ts`, `shade-picker.tsx`, `branding-chrome-tint.test.ts`, `branding-gradient.test.ts`, `branding-schema.test.ts`. `Branding` interface canonical shape (3 fields: `logoUrl`, `primaryColor`, `textColor`). `brandingFromRow` stripped to 2-param signature. AccountSummary + AccountListingData column drops. Single atomic commit `8ec82d5`.
- **4 deprecated DB columns + 2 ENUM types permanently dropped via two-step deploy protocol** — `sidebar_color`, `background_color`, `background_shade`, `chrome_tint_intensity` columns removed from `accounts`. `background_shade` and `chrome_tint_intensity` ENUM types removed from `pg_type`. Pre-flight gates (CP-01 grep + tsc + ENUM existence) → 30-min Vercel function drain (CP-03, satisfied by 25× minimum at 772 minutes overnight) → atomic `BEGIN/COMMIT` migration via locked `db query --linked -f` workaround → 3-query post-verification → real production booking smoke test → §8.4 backlog closure. First production application of the v1.2-locked workflow.
- **Apply method `db query --linked -f` LOCKED.** `npx supabase db push` is broken in this repo (orphan timestamps in remote tracking table per PROJECT.md §200). All schema migrations from v1.1 forward use the workaround. Phase 21 was first DROP migration to use it.
- **First net-deletion milestone in project history.** v1.0 + v1.1 were additive (29,450 LOC at v1.1 close); v1.2 ended at 21,871 LOC TS/TSX in runtime tree (NET -7,579 LOC across the milestone span, including the planning ramp-up; 91 commits, 910 inserted, 1,702 deleted excluding `.planning/`).

**Stats:**

- 74 files changed across the v1.2 phase span (excluding `.planning/`)
- 910 lines inserted; 1,702 lines deleted (NET -792 lines runtime; first net-deletion milestone)
- 21,871 LOC TypeScript/TSX in the runtime tree at sign-off (down from 29,450 at v1.1 close)
- 8 phases, 22 plans, ~80 tasks, 91 commits
- 3 days from kickoff (2026-04-30) to ship (2026-05-02)
- 222 passing automated tests (down from 277 at v1.1 close — 3 deprecated-theming test files deleted in Phase 20)

**Git range:** `9263770` (`feat(14-01): load Inter weights 400-800 + Roboto Mono`) → `d81a990` (`docs(21): complete schema-drop-migration phase`)

**Sign-off:** Andrew confirmed `smoke passed` on Phase 21 production booking 2026-05-02 — booking submitted at `/nsi/30-minute-consultation`, confirmation email arrived with `#0A2540` (NSI `brand_primary`) header band rendered correctly against schema-cleaned `accounts` table.

**What's next:** v1.3 — execute the third-deferral marathon QA (QA-09..QA-13) + ~21 per-phase manual checks accumulated through v1.2 + Resend migration (closes EMAIL-08, ~$10/mo for 5k emails) + Vercel Pro hourly cron flip + final NSI mark image swap + live cross-client email QA + OAuth signup + magic-link login + hard-delete cron + soft-delete grace + slug 301 redirect. See `FUTURE_DIRECTIONS.md` §8 for canonical v1.3 backlog.

---

## v1.1 Multi-User + Capacity + Branded UI (Shipped: 2026-04-30)

**Delivered:** Public multi-user signup with email verification + 3-step onboarding wizard + per-event-type booking capacity (race-safe slot_index mechanism replacing v1.0 partial unique index) + Cruip "Simple Light" visual overhaul across all 5 owner-facing and public surfaces with direct per-account color controls (sidebar / page / primary) wired to shadcn `--primary` CSS variable for full dashboard chrome theming.

**Phases completed:** 10-13 (with decimal Phase 12.5 + 12.6 inserted) — 6 phases, 34 plans total.

**Key accomplishments:**

- **Public multi-user signup + onboarding wizard end-to-end shipped** — `/signup` → email verification via `/auth/confirm` (verifyOtp pattern, closes v1.0 BLOCKER) → 3-step wizard (slug + name + timezone + first event type) → working dashboard with the user's own bookable URL. Postgres SECURITY DEFINER trigger atomically creates stub `accounts` row on `auth.users` INSERT; wizard UPDATEs via RLS-scoped Server Action. Forgot-password + reset-password flows close v1.0 `/auth/callback` 404 BLOCKER.
- **Per-event-type booking capacity with race-safe slot_index mechanism** — `bookings_capacity_slot_idx` ON `(event_type_id, start_at, slot_index) WHERE status='confirmed'` replaces v1.0 `bookings_no_double_book`. CAP-07 distinguishes `SLOT_TAKEN` (cap=1) from `SLOT_CAPACITY_REACHED` (cap>1) for booker UX message branching. CAP-01 root-cause investigation confirmed zero prod duplicate confirmed bookings; rescheduled-status slot reuse documented as accepted structural gap.
- **Cruip "Simple Light" visual overhaul across 5 surfaces** — dashboard (Inter font + bg-gray-50 + flat sidebar IA + Home tab monthly calendar with day-detail Sheet drawer + 4 row actions), public booking page (`py-12 md:py-20` + `max-w-3xl`), embed widget (single-circle gradient pattern, EmbedCodeDialog `sm:max-w-2xl`), 6 transactional emails (solid-color branded header band + plain-text alts on booker-facing senders + NSI footer mark), and 6 auth pages (Cruip split-panel with NSI hero).
- **Direct per-account color controls (Phase 12.6 course-correction)** — three independent color pickers (`sidebar_color` / `background_color` / `brand_primary`) with auto-WCAG text contrast on `--sidebar-foreground` + `--primary-foreground` overrides. First wire-up of `brand_primary` to shadcn `--primary` CSS variable (buttons / switches / focus rings now inherit account branding). IntensityPicker REMOVED; MiniPreviewCard rebuilt as 3-color faux-dashboard preview.
- **RLS cross-tenant matrix extended to N=3 tenants** — 24 new test cases across 8 table×direction combos plus admin-sees-all-3 verification. Plus pg-driver race test (CAP-06) at the postgres.js layer (skip-guarded; runs against prod when `SUPABASE_DIRECT_URL` is set).
- **Email senders unified on per-account tokens** — header band priority chain `sidebar_color → brand_primary → '#0A2540'`. No separate user-controlled email branding fields. Plain-text alts shipped on confirmation + cancel + reschedule (extends EMAIL-10 minimum). Live cross-client QA (Outlook desktop, Apple Mail iOS, Yahoo) deferred to v1.2.
- **Gmail SMTP quota-guard shipped** — 200/day cap via `email_send_log` Postgres counter; 80% threshold logs `[GMAIL_SMTP_QUOTA_APPROACHING]`; fail-closed at cap; bookings/reminders bypass. Resend migration documented as v1.2 backlog (~$10/mo for 5k emails).

**Stats:**

- 239 files changed across the v1.1 phase span
- 33,817 lines inserted; 2,153 lines deleted
- 29,450 LOC TypeScript/TSX in the runtime tree at sign-off
- 6 phases, 34 plans, ~95 tasks (estimated), 135 commits
- 3 days from kickoff (2026-04-27) to sign-off (2026-04-30)
- 277 passing + 4 skipped automated tests (26 test files) at sign-off

**Git range:** `4ae2e92` (first v1.1 commit) → `e3119bc` (`docs(13): close phase + ship v1.1 milestone — Andrew marathon waiver`)

**Sign-off:** Andrew verbatim 2026-04-30 — *"consider everything good. close out the milestone."*

**What's next:** v1.2 — execute the deferred Phase 13 marathon (QA-09..QA-13) + per-phase manual checks accumulated through Phases 10/11/12/12.5/12.6 (~21 items per `MILESTONE_V1_1_DEFERRED_CHECKS.md`) + Resend migration + Vercel Pro hourly cron flip + DROP `accounts.chrome_tint_intensity` + remove `chromeTintToCss` compat export + final NSI mark image swap + live cross-client email QA. See `FUTURE_DIRECTIONS.md` §8 for canonical v1.2 backlog.

---

## v1.0 MVP (Shipped: 2026-04-27)

**Delivered:** A Calendly-style multi-tenant booking tool with race-safe DB-level slot uniqueness, DST-correct slot computation, branded embeddable widget with postMessage height protocol, and end-to-end booking lifecycle (book / confirm / cancel / reschedule / 24h reminder) wired to Andrew's NSI account on Vercel + Supabase.

**Phases completed:** 1-9 (52 plans total)

**Key accomplishments:**

- **DB-level race-safe booking via partial unique index** (`bookings_no_double_book` on `(event_type_id, start_at) WHERE status='confirmed'`) — proven by Vitest race test; two concurrent submits → one 201, one 409 with clean inline-banner UX preserving form values.
- **DST-correct slot engine** (`lib/slots.ts` pure `computeSlots()` + 13-test integration suite) validated against March 8 + Nov 1 2026 US DST transitions with no missing or duplicate slots at the boundary; `TZDate` from `@date-fns/tz` v4 for wall-clock construction, never `addMinutes` for window endpoints.
- **Multi-tenant data layer with RLS cross-tenant matrix** — 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`) all with `account_id` denormalized + RLS policies; Plan 08-08 RLS matrix test proves a second seeded tenant cannot read or write the first tenant's data via any client context.
- **Branded embeddable widget with `nsi-booking:height` postMessage protocol** — chromeless `/embed/[account]/[event-slug]` route with per-route CSP `frame-ancestors *` (proxy.ts owns CSP exclusively); `/widget.js` Route Handler with 5s handshake timeout; live-verified posting from `https://example.com` 2026-04-26.
- **Full email lifecycle on Gmail SMTP via vendored `@nsi/email-sender`** — booker confirmation + .ics (`METHOD:REQUEST`, stable UID, VTIMEZONE block), owner notification, cancel pair, reschedule pair (`METHOD:REQUEST` SEQUENCE+1), and 24h reminder; per-account branded email blocks (logo header + brand H1 + branded CTA + Powered by NSI footer).
- **Reliable reminder cron with claim-once semantics** — Vercel hourly Cron at `/api/cron/send-reminders` authenticated by `CRON_SECRET`; compare-and-set UPDATE claims `reminder_sent_at` so duplicate cron invocations send exactly one reminder per booking; immediate-send hook for bookings created inside the 24h window.
- **Token-based booker self-service for cancel + reschedule** — SHA-256 hashed tokens in DB, raw tokens only in email; rate-limited at 10/5min/IP via Postgres-backed `rate_limit_events` table; double CAS guard prevents concurrent same-token success; tokens rotate on every reminder send.

**Stats:**

- 344 files created/modified across the 9-phase span
- 85,014 lines inserted total; 20,417 lines of TypeScript/TSX in the runtime tree at sign-off
- 9 phases, 52 plans, ~180 tasks, 222 commits
- 10 days from project start (2026-04-18) to v1 ship (2026-04-27)
- 131 passing + 1 skipped automated tests (16 test files) at sign-off

**Git range:** `e068ab8` (docs: initialize project) → `3f83461` (docs(09): complete manual-qa-and-verification phase)

**What's next:** v1.1 — close deferred QA items (marathon QA execution: 6 ROADMAP criteria + 9 Phase 8 dashboard sub-criteria + per-template branding 6-row smoke + Squarespace/Wix verification + cron-fired-in-prod). See FUTURE_DIRECTIONS.md for canonical v1.1 backlog enumeration.

---
