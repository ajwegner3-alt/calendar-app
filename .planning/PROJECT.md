# Calendar App (NSI Booking Tool)

## What This Is

A multi-tenant Calendly-style booking tool for trade contractors. Visitors land on a contractor's website, pick an available slot in a branded widget, and walk away with a confirmed booking and a calendar invite in their inbox. **v1.0 shipped 2026-04-27** with Andrew's NSI account end-to-end (single-tenant in production; multi-tenant plumbing baked into the schema). **v1.1 shipped 2026-04-30** opening the tool to public signup (anyone can self-serve at `/signup`), adding per-event-type capacity (race-safe slot_index mechanism replacing v1.0's partial unique index), and rebranding all 5 owner-facing + public surfaces with the Cruip "Simple Light" aesthetic + direct per-account color controls (sidebar / page / primary). The branded embeddable widget (script + iframe; auto-resizes via `nsi-booking:height` postMessage) is what makes it a sellable deliverable for client websites, not just a personal tool.

## Core Value

A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

(Validated in v1.0 — core value held; ship pivot reinforced widget-first distribution as the actual product wedge. v1.1 confirmed: opening signup did not change the core value statement; the booker experience is unchanged from v1.0 except for accent-color branding now reflecting the contractor's choice across all 6 transactional emails + the booking page itself.)

## Requirements

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

## Current Milestone: v1.2 (not yet planned)

**Status:** v1.1 SHIPPED 2026-04-30. v1.2 scope not yet defined. Run `/gsd:new-milestone` to scope.

**Candidate scope items** (captured during v1.1; canonical enumeration in `FUTURE_DIRECTIONS.md` §8 + `MILESTONE_V1_1_DEFERRED_CHECKS.md`):

- v1.1 marathon QA execution (QA-09 signup E2E, QA-10 multi-tenant UI walkthrough, QA-11 capacity=3 race E2E, QA-12 3-account branded smoke, QA-13 EmbedCodeDialog 320/768/1024) — pre-flight artifacts remain on prod (Test User 3, capacity-test event, 3 branding profiles).
- ~21 per-phase manual checks accumulated through v1.1 Phases 10/11/12/12.5/12.6.
- v1.0 marathon RE-deferred items: EMBED-07, EMAIL-08, QA-01..QA-06.
- Resend migration (replaces Gmail SMTP; ~$10/mo for 5k emails; closes EMAIL-08).
- Vercel Pro upgrade + flip cron schedule from `0 13 * * *` daily to `0 * * * *` hourly.
- DROP `accounts.chrome_tint_intensity` column (Phase 12.5 leftover; safe after one v1.1 release window).
- Remove `chromeTintToCss` compat export from `lib/branding/chrome-tint.ts` (paired with column DROP).
- Final NSI mark image swap (`public/nsi-mark.png` is currently a 105-byte solid-navy placeholder; Andrew explicit deferral).
- Live cross-client email QA — Outlook desktop, Apple Mail iOS, Yahoo (deferred since v1.0).
- OAuth signup (Google / GitHub) — `auth/confirm` already supports magiclink type.
- Magic-link / passwordless login — same handler ready.
- Hard-delete cron purge (v1.1 ships soft-delete only).
- Slug 301 redirect for old slugs after change.
- Soft-delete grace period (account restore on re-login within N days).
- Onboarding analytics event log.
- Constant-time delay on signup + forgot-password forms (P-A1 timing-oracle hardening).

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

**Production state at v1.1 ship (2026-04-30):**

- 29,450 LOC TypeScript/TSX in the runtime tree (v1.0: 20,417; v1.1 added ~9,033 net).
- 33,817 lines inserted + 2,153 lines deleted across 239 files in the v1.1 milestone span (`v1.0..HEAD`).
- 357 cumulative commits (222 v1.0 + 135 v1.1; v1.1 git range `4ae2e92` → `e3119bc`).
- 277 passing + 4 skipped automated tests across 26 test files.
- Production URL: `https://calendar-app-xi-smoky.vercel.app` (auto-deploys from `main`).
- GitHub: `https://github.com/ajwegner3-alt/calendar-app`.
- Supabase project ref: `mogfnutxrrbtvnaupoun` (region West US 2, Postgres 17.6.1).
- Seeded NSI account: `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`.
- Pre-flight QA artifacts on prod (KEPT for v1.2 marathon): Test User 3 (`andrew.wegner.3@gmail.com`, slug `nsi-rls-test-3`), capacity-test event_type (`5344a500-acd5-4336-b195-ebea16f8dec4`), 3 distinct branding profiles applied to nsi/nsi-rls-test/nsi-rls-test-3 (navy/magenta/emerald-null).

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

**v1.1 architectural patterns added:**

- **Postgres SECURITY DEFINER provisioning trigger + Server Action UPDATE hybrid** — trigger creates stub `accounts(slug=null, name=null, onboarding_complete=false)` on every `auth.users` INSERT (atomicity-first); wizard UPDATEs to (slug, name, onboarding_complete=true) via RLS-scoped Server Action (UX-error-clarity). Pattern reusable for any future "row must exist before user can interact, but final values come later" provisioning flow.
- **`/auth/confirm` Route Handler with `verifyOtp({ type, token_hash })` pattern** — canonical handler for signup, recovery, magiclink, email_change. Recovery type hard-overrides `next` param → always `/auth/reset-password`. Replaces v1.0's broken `/auth/callback`.
- **Race-safe N-per-slot via slot_index extended unique index** — `bookings_capacity_slot_idx` ON `(event_type_id, start_at, slot_index) WHERE status='confirmed'`. Application retry loop tries slot_index=1..N on Postgres 23505. Replaces v1.0's `bookings_no_double_book` 1-per-slot pattern. Preserves v1.0 capacity=1 behavior (slot_index=1 only).
- **CONCURRENTLY index migration via shell pipe** — `echo | npx supabase db query --linked` (CLI -f wraps in implicit transaction blocking CONCURRENTLY).
- **Per-account inline-style chrome theming via shadcn CSS variable overrides** — `--primary` + `--primary-foreground` + `--sidebar-foreground` overrides on inline `style` props at the `(shell)` layout wrapper. Direct hex (no oklch conversion). Public surfaces NOT in scope.
- **Email header band priority chain** — `branding.sidebarColor ?? branding.brand_primary ?? DEFAULT_BRAND_PRIMARY` for solid-color rendering. No VML, no CSS gradients (Outlook + Yahoo support).
- **Quota-guard wrapper for Gmail SMTP** — `checkAndConsumeQuota()` in `lib/email-sender/quota-guard.ts`; signup-side senders fail-closed at cap; bookings/reminders bypass to protect core flow.

**Known issues / technical debt (carried into v1.2, see FUTURE_DIRECTIONS.md §4 + §8):**

- 1 documented ESLint warning (`react-hooks/incompatible-library` on `event-type-form.tsx:99` — RHF `watch()` not memoizable; refactor to `useWatch`). v1.0 carry-over, RE-confirmed at v1.1 close.
- Pre-existing `tsc --noEmit` test-mock alias errors (mock exports aliased only in `vitest.config.ts`, not `tsconfig.json`). v1.0 carry-over, RE-confirmed at v1.1 close.
- Migration drift workaround: `supabase db push --linked` fails; locked alternative is `supabase db query --linked -f`. v1.0 carry-over.
- `generateMetadata` double-load on public booking page (acceptable; can wrap in `import { cache } from 'react'`). v1.0 carry-over.
- Supabase service-role key still legacy JWT (`sb_secret_*` format not yet rolled out). v1.0 carry-over; waiting on Supabase rollout.
- Plan 08-05/06/07 wave-2 git-index race (multi-agent commits swept in untracked sibling files; future YOLO multi-wave runs should serialize commits or use per-agent worktrees). v1.0 carry-over.
- `accounts.chrome_tint_intensity` column kept post-Phase 12.6 (no longer read by production code; `chromeTintToCss` compat export retained for Phase 12.5 tests). v1.2 cleanup: DROP column + remove compat export pair. v1.1 introduced.
- Vercel cron remains on Hobby tier `0 13 * * *` daily schedule; flip `vercel.json` to `0 * * * *` after Vercel Pro upgrade. v1.0 carry-over, RE-confirmed.
- `rate_limit_events` test DB cleanup gap — 4 transient bookings-api.test.ts failures observed when the table accumulates between runs. v1.1 introduced.
- `/app/unlinked` UX hole for soft-deleted accounts on re-login. v1.1 introduced (Plan 10-07 acceptable trade-off).
- `public/nsi-mark.png` placeholder (105 bytes solid-navy) — replace with final NSI brand asset. v1.1 introduced; Andrew explicit deferral.

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

---
*Last updated: 2026-04-30 after v1.1 milestone shipped*
