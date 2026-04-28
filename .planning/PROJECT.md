# Calendar App (NSI Booking Tool)

## What This Is

A multi-tenant Calendly-style booking tool for trade contractors. Visitors land on a contractor's website, pick an available slot in a branded widget, and walk away with a confirmed booking and a calendar invite in their inbox. v1.0 shipped 2026-04-27 with Andrew's NSI account end-to-end (single-tenant in production; multi-tenant plumbing baked into the schema for v2 onboarding). The branded embeddable widget (script + iframe; auto-resizes via `nsi-booking:height` postMessage) is what makes it a sellable deliverable for client websites, not just a personal tool.

## Core Value

A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

(Validated in v1.0 — core value held; ship pivot reinforced widget-first distribution as the actual product wedge.)

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

## Current Milestone: v1.1

**Goal:** Open the tool to anyone (multi-user signup), close the double-booking correctness bug + add per-event-type capacity, and rebrand every owner-facing surface with the Cruip "Simple Light" tailwind-landing-page aesthetic (gradient backgrounds + per-account color/shade tokens).

**Ordering rationale:** Multi-user is most urgent (per Andrew 2026-04-27); capacity bug investigation runs second so the correctness fix is in place before broad UI rework; UI overhaul comes last because IA must cover the full onboarded-user surface; QA + sign-off as always.

**Target features (in order):**

1. **Multi-user signup + onboarding** — public `/signup`, email verification, account auto-provisioning (slug picker, default availability), first-login wizard. Free tier (no Stripe in v1.1). Includes a defensive race-guard verification task at start so multi-user does not ship double-booking exposed to new accounts.
2. **Booking capacity** — investigate Andrew's prod observation that double-booking succeeded; add `max_bookings_per_slot` on `event_types` (default 1, owner-toggleable); slot API + booking API enforce.
3. **Branded UI overhaul (5 surfaces)** — apply `website-creation/.claude/skills/tailwind-landing-page` (Inter + gray-50 base + gradient accents) to dashboard + public booking page + `/[account]` index + embed widget + emails. Per-account branding tokens grow: `background_color` + `background_shade` (gradient intensity). Sidebar IA fix so Settings is reachable. Home tab = monthly calendar with click-day → drawer of that day's bookings. Embed snippet dialog overlap fix folds in here.
4. **Manual QA + Andrew sign-off.**

**Active requirements being built:**

- [ ] **AUTH-05** through AUTH-NN (multi-user signup, email verify, password reset, account provisioning) — Phase 10
- [ ] **CAP-01..NN** — booking capacity per event type + double-booking root cause fix — Phase 11
- [ ] **BRAND-05..NN** — per-account `background_color` + `background_shade` tokens — Phase 12
- [ ] **UI-01..NN** — sidebar IA, Home tab monthly calendar + day-drawer, embed dialog widening, settings discoverability, full-surface tailwind-landing-page styling — Phase 12
- [ ] **QA-09..NN** — v1.1-specific manual QA + Andrew sign-off — Phase 13

(Specific REQ-IDs assigned during requirements definition.)

### Carried-forward (deferred to v1.2 or later)

The 8 v1.0-deferred items below remain deferred — Andrew confirmed v1.1 does NOT include them:

- [ ] **EMBED-07** — Live Squarespace/Wix/WordPress embed test (deferred; Andrew is using own Next.js sites only).
- [ ] **EMAIL-08** — SPF/DKIM/DMARC verified; mail-tester ≥9/10 (deferred to live-deliverability QA cycle).
- [ ] **QA-01..QA-06** — Marathon QA criteria (live email-client cross-test, mail-tester scoring, DST live E2E, responsive multi-viewport pass, multi-tenant UI walkthrough). Note: QA-06 (multi-tenant UI walkthrough) becomes naturally exercised by v1.1 multi-user flow, but the formal walkthrough remains deferred unless v1.1 Phase 13 picks it up.

**v1.1 also includes from FUTURE_DIRECTIONS.md §3 Future Improvements:**

- [ ] Per-template branding 6-row smoke (booker × owner × confirm/cancel/reschedule) — folds into Phase 12 emails work.
- [ ] Plain-text alternative on confirmation email — mirrors reminder pattern; folds into Phase 12 emails work.
- [ ] NSI mark image in "Powered by NSI" email footer — folds into Phase 12 emails work.
- [ ] `RESERVED_SLUGS` deduplication — Phase 10 needs this for slug-picker validation; fold in.

**Tech debt deferred:**

- [ ] `react-hooks/incompatible-library` warning on `event-type-form.tsx:99` (RHF `watch()` → `useWatch`).
- [ ] `tsc --noEmit` test-mock alias errors (alias only in `vitest.config.ts`, not `tsconfig.json`).
- [ ] `/auth/callback` route 404s (blocks Supabase password-reset flow). **Becomes v1.1 BLOCKER** — multi-user signup needs working email-confirmation callback. Phase 10 must fix.
- [ ] Supabase service-role key migration to `sb_secret_*` (waiting on Supabase rollout).
- [ ] Plan 08-05/06/07 wave-2 git-index race (multi-agent commits swept untracked siblings).
- [ ] `generateMetadata` double-load on public booking page.

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

**Production state at v1.0 ship (2026-04-27):**

- 20,417 lines of TypeScript/TSX in the runtime tree.
- 85,014 lines inserted across 344 files in the milestone span.
- 222 commits (`e068ab8` → `3f83461`).
- 131 passing + 1 skipped automated tests across 16 test files.
- Production URL: `https://calendar-app-xi-smoky.vercel.app` (auto-deploys from `main`).
- GitHub: `https://github.com/ajwegner3-alt/calendar-app`.
- Supabase project ref: `mogfnutxrrbtvnaupoun` (region West US 2, Postgres 17.6.1).
- Seeded NSI account: `slug=nsi`, `id=ba8e712d-28b7-4071-b3d4-361fb6fb7a60`, timezone `America/Chicago`, `owner_email=ajwegner3@gmail.com`.

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

**Architectural patterns established (will carry forward to v1.1+):**

- **Race-safety at the DB layer** — `bookings_no_double_book` partial unique index is the authoritative double-book guard. Pattern reusable for any future "exactly one of these can succeed" insert race.
- **Service-role gate** — `lib/supabase/admin.ts` line 1 `import "server-only"`. Pattern locked for any future service-role module.
- **Per-route CSP via `proxy.ts` exclusively** — `next.config.ts` cannot conditionally delete headers. proxy.ts is the sole CSP and `X-Frame-Options` owner; locked for all future routes.
- **Direct-call Server Action contract** — actions accept structured TS objects (NOT FormData) when forms have nested arrays/discriminated unions. NEXT_REDIRECT re-throw in form catch handler.
- **Two-stage owner authorization** — RLS-scoped pre-check (via `createClient()` from `next/headers`) before delegating to service-role mutation. Pattern repeated in 3+ places.
- **Postgres-backed rate limiting** — single `rate_limit_events` table with composite index, per-route key prefix (`bookings:`, `cancel:`, `reschedule:`). `checkRateLimit` fails OPEN on DB error (transient hiccup must not lock out legitimate users).
- **Token-based public lifecycle routes** — SHA-256 hashes in DB, raw tokens only in email; rotation on every reminder send; double CAS guard on reschedule. GET pages are read-only Server Components (Gmail/Outlook prefetch links); mutations only on POST Route Handlers.
- **Reminder cron claim-once via CAS UPDATE** — `WHERE reminder_sent_at IS NULL` claim guarantees exactly one reminder per booking even with duplicate cron invocations. Reminder retry on send failure = NONE by design (RESEARCH Pitfall 4).
- **Vendor over npm-link for sibling tools** — Vercel build cannot resolve `file:../` paths. Future cross-project tools must be vendored into `lib/` (or published to npm).

**Known issues / technical debt (carried into v1.1, see FUTURE_DIRECTIONS.md §4):**

- 1 documented ESLint warning (`react-hooks/incompatible-library` on `event-type-form.tsx:99` — RHF `watch()` not memoizable; refactor to `useWatch`).
- Pre-existing `tsc --noEmit` test-mock alias errors (mock exports aliased only in `vitest.config.ts`, not `tsconfig.json`).
- `RESERVED_SLUGS` duplicated across 2 files (must be hand-synced).
- Migration drift workaround: `supabase db push --linked` fails; locked alternative is `supabase db query --linked -f`.
- `generateMetadata` double-load on public booking page (acceptable v1; can wrap in `import { cache } from 'react'`).
- `/auth/callback` route 404s (blocks Supabase password-reset / magic-link flows; v2 backlog).
- Supabase service-role key still legacy JWT (`sb_secret_*` format not yet rolled out).
- Plan 08-05/06/07 wave-2 git-index race (multi-agent commits swept in untracked sibling files; future YOLO multi-wave runs should serialize commits or use per-agent worktrees).

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
| Marathon QA scope-cut to v1.1 by project-owner discretion | "Other problems are more pressing and will be addressed in the next milestone" | — Pending — v1.1 deprioritizes marathon QA; carried into v1.2 backlog instead |
| v1.1 scope-cut on 2026-04-27 to focus on multi-user + capacity bug + branding overhaul | Andrew flagged a real prod double-booking, no UI for settings discovery, plain UI lacking "website feel", and most urgent need = open signup. Marathon QA recarried to v1.2. | — Pending |
| Multi-user signup ships free in v1.1 (no Stripe / billing) | Distribution first; monetization layer in later milestone | — Pending |
| Branding tokens grow to include `background_color` + `background_shade` per-account | Andrew explicitly named tailwind-landing-page Cruip "Simple Light" gradient style as the target; per-account customization keeps multi-user theme-able | — Pending |

---
*Last updated: 2026-04-27 after starting v1.1 milestone*
