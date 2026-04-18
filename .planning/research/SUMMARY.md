# Project Research Summary

**Project:** calendar-app (NSI booking tool)
**Domain:** Multi-tenant Calendly-style booking SaaS for trade contractors
**Researched:** 2026-04-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a multi-tenant Calendly clone scoped to the trade-contractor vertical (plumbers, HVAC, roofers, electricians taking homeowner quote bookings). v1 ships Andrew's single account + an embeddable widget on the NSI site, but the schema, auth, and RLS are multi-tenant from day one so future NSI clients plug in without migration. The industry-standard build pattern is well-documented: Next.js 15 (App Router) + Supabase (Postgres + Auth + Storage + RLS) + Resend via the existing `@nsi/email-sender` wrapper, deployed on Vercel. The homeowner-facing booking UX must match Calendly quality — homeowners have seen it; anything clunkier reads as broken.

The critical risk surface is narrow but sharp: (1) double-booking via read-then-write races — solved once at the DB layer with a partial unique index or `EXCLUDE USING gist` constraint; (2) timezone/DST bugs — solved by committing to `timestamptz` + IANA strings + `date-fns v4 + @date-fns/tz` and never doing date math in local time; (3) cross-tenant data leaks via misused service-role key or sloppy RLS — solved by routing public reads through server API handlers with service-role + closed RLS for anon, and keeping the service-role client in a single `server-only` module. Get those three right in the foundation phase and the rest is conventional SaaS work.

The recommended shape is one Next.js app with three route zones (`/[account]/*` public booking, `/embed/*` chromeless iframe variant, `/app/*` authenticated owner dashboard), a script-injected iframe widget (Calendly-style `widget.js` + `data-nsi-calendar` attribute), and Vercel Cron hitting a Next.js route handler for 24h reminders with a compare-and-set claim pattern for idempotency. v1 scope is the critical path only (table-stakes booking + email lifecycle + branding + embed); trade-vertical differentiators (ZIP gating, photo upload, urgency tiers) land in v1.1. Calendar sync, payments, SMS, round-robin, and workflow builders are explicit non-goals.

## Key Findings

### Recommended Stack

Established 2026 Next+Supabase stack, with deliberate picks on the date/TZ and embed axes. Full detail in [STACK.md](./STACK.md).

**Core technologies:**
- **Next.js 15 (App Router) + React 19 + TS strict** — Server Components for the public booking page (near-zero client JS), Route Handlers for APIs, Server Actions for forms. Required for `@supabase/ssr`.
- **Supabase (Postgres + Auth + Storage)** — RLS gives per-tenant isolation at the DB layer; free tier covers v1. Use `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`); build custom auth UI (skip `auth-ui-react`).
- **date-fns v4 + @date-fns/tz + @vvo/tzdb** — Tree-shakes to ~5 KB on the widget; v4's official TZ companion handles DST correctly. Explicitly NOT Moment, NOT Day.js (plugin TZ is a footgun), NOT Temporal (not universally shipped).
- **`ics` (npm)** — Pure JS .ics generator, no native deps, works on Vercel. Use `METHOD:REQUEST` + stable UID for update/cancel support.
- **Resend via `@nsi/email-sender` + react-email** — Reuse the existing NSI wrapper; JSX email templates.
- **shadcn/ui + Radix + react-day-picker + Tailwind** — Theme-able via CSS vars for per-tenant branding; calendar picker ~12 KB.
- **React Hook Form + Zod** — Shared schemas between client validation, Server Actions, and Supabase boundary parsing.
- **Vercel Cron (primary)** for 24h reminders; pg_cron listed as fallback but architecture research prefers Vercel Cron (same language, same email-sender, easier to test).
- **Vitest + Playwright + Testing Library** — Unit tests on slot/TZ logic, E2E for booking happy path including widget embed.

Confidence: HIGH on library choices; MEDIUM on exact pinned versions (verify with `npm view` at install time).

### Expected Features

Full landscape in [FEATURES.md](./FEATURES.md). The bar to hit is homeowner-facing Calendly parity; the bar to ignore is enterprise team-scheduling.

**Must have (table stakes) — v1 ships all of these:**
- Weekly recurring availability + per-date overrides + buffer/min-notice/max-advance/daily-cap
- Multiple event types per account with custom URL slugs and per-type custom questions
- Atomic, race-safe slot reservation (no double-booking, ever)
- Mobile-responsive booker flow: month/day picker → time slots → form → confirmation, TZ-aware
- Email lifecycle: booker confirmation + owner notification + .ics attachment + 24h reminder
- Tokenized cancel + reschedule (no login required for booker)
- Per-account logo + primary color branding
- Admin auth, bookings list, embed snippet generator
- Script-injected iframe embed + standalone hosted booking page

**Should have (trade-vertical differentiators) — v1.1, pick 2:**
- ZIP-code service-area gating (highest leverage — saves drive-to-nowhere estimates)
- Photo upload in booking form (pre-qualify the job before driving out)
- Urgency tier selector ("Emergency / This week / Can wait") for triage

**Defer (v2+):**
- SMS reminders (Twilio = separate integration), custom subdomain CNAME, manual booking entry, analytics dashboard, webhooks, Google Places address autocomplete.

**Anti-features (explicitly NEVER for this product):**
- Calendar sync (Google/Outlook/iCloud), payments, round-robin/team scheduling, workflow builder, video conferencing integration, recurring bookings, waitlists, custom-CSS editor, group bookings, mobile native app, SMS two-way chat.

### Architecture Approach

Single Next.js app, three route zones, Supabase as single source of truth, service-role client gated to server-only code. Full detail in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Major components:**
1. **Public booking routes** (`/[account]/[event-slug]`, `/embed/[account]/[event-slug]`, `/cancel/[token]`, `/reschedule/[token]`) — unauthenticated; Server Components for page shell, Client Components for picker/form; read via `/api/slots`, write via `/api/bookings`.
2. **Owner dashboard** (`/app/*`) — middleware-gated Supabase auth, Server Components with RLS-scoped client; manages event types / availability / branding / bookings list.
3. **API handlers** (`/api/slots`, `/api/bookings`, cancel/reschedule, `/api/cron/send-reminders`) — service-role client for public slot computation and token flows; CAS claim pattern for reminder idempotency; partial unique index `UNIQUE (event_type_id, start_at) WHERE status='confirmed'` is the authoritative no-double-book guard.
4. **Embed loader** (`widget.js` static) — Calendly-style: finds `[data-nsi-calendar]` divs, injects iframe to `/embed/*`, listens for postMessage height updates. Fallback raw `<iframe>` snippet for locked-down hosts.
5. **Data layer** — 6 tables (`accounts`, `event_types`, `availability_rules`, `date_overrides`, `bookings`, `booking_events`); all timestamps `timestamptz`; IANA TZ strings on accounts+bookings; `account_id` denormalized on every table for RLS performance; SHA-256-hashed cancel/reschedule tokens (raw token only in email).

**Key architectural commitments:**
- RLS enabled on every table; anon has no direct table access (public reads go through API handlers with service-role).
- All times stored UTC; owner TZ is a property of the availability schedule, not the booking.
- Slot computation server-side only (availability rules → owner TZ → candidate slots → UTC → subtract existing bookings → return ISO UTC; client renders in booker TZ).
- CSP `frame-ancestors *` on `/embed/*` only; default `self` elsewhere.

### Critical Pitfalls

Top 5 from [PITFALLS.md](./PITFALLS.md) — each gets baked into the foundation phase so later phases can't re-open them.

1. **Double-booking race (C1)** — Naive "check then insert" has a race window. Prevent with partial unique index on `(event_type_id, start_at) WHERE status='confirmed'` (or `EXCLUDE USING gist` with `tstzrange`). DB constraint is source of truth; app-level checks are for clean 409 UX. Load-test with 20 concurrent `Promise.all` POSTs against one slot — exactly one must succeed.
2. **Timezone/DST corruption (C2)** — `timestamp` without TZ, raw `Date` math, or "HH:MM + offset" storage all silently break at DST transitions. Enforce `timestamptz` everywhere, IANA strings (`America/Chicago`, never `CST`), `date-fns v4 + @date-fns/tz`, and DST-transition fixtures in unit tests (March 8 2026, Nov 1 2026 US; March 29 2026 EU).
3. **Service-role key misuse (C3) / RLS gaps (C4)** — Never `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. Service-role in a single `lib/supabase/admin.ts` with `import 'server-only'`. RLS enabled on every table with `account_id` scoping; anon has no direct table access; public booking reads route through API handlers. Write automated RLS tests with two tenant contexts + anon before shipping.
4. **Cron duplicate/missed reminders (C6, C7)** — Vercel Cron is at-least-once. Use CAS: `UPDATE bookings SET reminder_sent_at = now() WHERE id=? AND reminder_sent_at IS NULL RETURNING *` — if zero rows, skip. Run hourly (not daily) so bookings created inside the 24h window still get caught; for <24h-ahead bookings, send reminder immediately on creation.
5. **Embed iframe sizing + CSP (C8, C9)** — Fixed iframe height = broken mobile. postMessage height protocol with namespaced type (`nsi-booking:height`) + ResizeObserver on the embed root. Remove `X-Frame-Options` and set `frame-ancestors *` ONLY on `/embed/*` routes. Test on a real WordPress site with strict CSP and at mobile widths (320/768/1024).

Also worth flagging before launch: **email deliverability (C5)** — SPF + DKIM + DMARC all configured, send from a dedicated subdomain, verify with mail-tester.com pre-launch.

## Implications for Roadmap

Research points to a clear critical path. Suggested 9-phase structure:

### Phase 1: Foundation — Next.js + Supabase wiring + schema + RLS
**Rationale:** Everything downstream depends on the schema and RLS policies. Retrofitting `timestamptz`, the partial unique index, and tenant-scoped RLS is expensive; getting them right on day one is cheap.
**Delivers:** Next 15 App Router scaffold with `@supabase/ssr`, all 6 tables migrated, RLS policies + `current_owner_account_ids()` helper, partial unique index on bookings, Andrew's account seeded manually, service-role module gated with `server-only`, env vars on Vercel.
**Addresses:** Multi-tenant foundation for all features.
**Avoids:** C1, C2, C3, C4, M8, M10.

### Phase 2: Owner Auth + Dashboard Shell
**Rationale:** Gates every owner-facing feature. Custom auth form (~100 lines, per STACK research — skip `auth-ui-react`).
**Delivers:** Supabase Auth email/password, `/app/*` middleware guard, empty dashboard shell with nav.
**Uses:** `@supabase/ssr`, React Hook Form + Zod, shadcn form primitives.

### Phase 3: Event Types CRUD
**Rationale:** Blocks the public booking page (need something to book).
**Delivers:** Create/edit/delete/toggle-active event types with custom questions editor (jsonb).
**Implements:** `event_types` CRUD + RLS-scoped dashboard views.

### Phase 4: Availability Engine (weekly + overrides + slot API)
**Rationale:** Architecturally the core of the product and the #1 bug hotspot (DST, buffers, conflict subtraction). Heavy unit-test coverage with DST fixtures required.
**Delivers:** Availability rules editor, date overrides editor, `/api/slots` combining rules + overrides + buffers + min-notice + max-advance + existing bookings → UTC slot list.
**Avoids:** C2, M1, M2, M5, M6.
**FLAG:** Needs `/gsd:research-phase` on `@date-fns/tz` v4 API and slot-generation algorithm before implementation.

### Phase 5: Public Booking Flow (hosted page + /api/bookings + email)
**Rationale:** Revenue-generating path end-to-end. Once this ships, the tool is usable even without the widget.
**Delivers:** `/[account]/[event-slug]` page with branding, date/time picker consuming `/api/slots`, booking form with custom questions, `/api/bookings` with race-safe insert (409 on conflict), `@nsi/email-sender` integration for booker confirmation + owner notification + .ics attachment.
**Avoids:** C1, M1, M3, M7.
**FLAG:** Needs `/gsd:research-phase` on .ics `METHOD:REQUEST`/VTIMEZONE handling across Gmail/Outlook/Apple Calendar and current `@nsi/email-sender` attachment API.

### Phase 6: Cancel + Reschedule Flows (tokenized)
**Rationale:** Table-stakes lifecycle; independent after bookings + email. Security design (SHA-256 hash + expiry + rate limit) matters.
**Delivers:** `/cancel/[token]`, `/reschedule/[token]` routes, token hash storage, post-cancel/reschedule emails, rate limiting on cancel endpoint.
**Avoids:** C10.

### Phase 7: Widget + Embed + Branding
**Rationale:** Primary v1 distribution mechanism. Research is clear: script-injected iframe, postMessage height, CSP overrides on `/embed/*` only.
**Delivers:** `/embed/[account]/[event-slug]` chromeless route, `widget.js` loader, embed snippet generator in admin, per-account logo (Supabase Storage) + primary color, postMessage height protocol with namespaced type.
**Avoids:** C8, C9, m6.
**FLAG:** Needs `/gsd:research-phase` on Next 15 per-route CSP header config and serving `widget.js` as a static asset on Vercel.

### Phase 8: Reminders Cron + Hardening
**Rationale:** Reminder job is independent after bookings exist. Hardening (rate limits, Turnstile, deliverability DNS, RLS audit) batches naturally at the end.
**Delivers:** Vercel Cron `/api/cron/send-reminders` with CAS claim pattern (hourly), CRON_SECRET auth, SPF/DKIM/DMARC DNS on sending subdomain, Turnstile on booking form, rate-limit middleware, automated RLS test matrix, Resend bounce webhook handler, owner bookings dashboard list.
**Avoids:** C5, C6, C7, M4, M9, M10.
**FLAG:** Needs `/gsd:research-phase` on current Vercel Cron hobby-tier interval limits and Resend domain-verification DNS format (both flagged LOW confidence in PITFALLS).

### Phase 9: Manual QA & Verification (REQUIRED per CLAUDE.md)
**Rationale:** Per global Andrew instructions, every project ends in an explicit manual QA phase — not optional.
**Delivers:** Live widget test on real NSI Squarespace/WordPress page; .ics verified in Gmail web + Gmail iOS + Apple Mail + Outlook; deliverability via mail-tester.com (target 10/10); DST transition sanity test; mobile 320/768/1024 widths; cross-tenant RLS manual probe; `FUTURE_DIRECTIONS.md` committed.
**Sign-off:** Andrew.

### Phase Ordering Rationale

- **Dependency order enforced by the architecture research:** schema → auth → event types → availability → booking flow → lifecycle → widget → cron → QA. Phases 6/7/8 could parallelize after 5; sequential ordering keeps scope tight.
- **Critical-path pitfalls front-loaded:** C1/C2/C3/C4 all addressed in Phase 1, so later phases don't revisit foundational data-model decisions.
- **Differentiators deferred to v1.1:** FEATURES research is explicit that ZIP gating / photo upload / urgency tiers are post-launch. Not in v1 roadmap.
- **QA phase at the end is non-negotiable** per CLAUDE.md; treated as a real phase with deliverables.

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:
- **Phase 4 (Availability Engine)** — DST + `@date-fns/tz` v4 API + slot-generation algorithm; biggest bug hotspot.
- **Phase 5 (Booking Flow)** — `.ics` `METHOD:REQUEST`/VTIMEZONE correctness + current `@nsi/email-sender` attachment shape.
- **Phase 7 (Widget/Embed)** — Next 15 per-route CSP/header config + static `widget.js` on Vercel.
- **Phase 8 (Cron + Hardening)** — Current Vercel Cron hobby limits + Resend DNS records.

Phases with standard patterns (skip research-phase):
- **Phases 1, 2, 3** — Standard Next 15 + Supabase SSR + shadcn scaffolding; STACK research sufficient.
- **Phase 6** — Tokenized-link cancel/reschedule is a well-documented security pattern; ARCHITECTURE gives the full recipe.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Library *choices* are HIGH (well-established 2026 defaults); exact pinned *versions* MEDIUM — verify with `npm view` at install. |
| Features | MEDIUM-HIGH | Table-stakes and anti-features HIGH (stable Calendly/Cal.com patterns). Specific competitor UI details MEDIUM. No-show-reduction percentages LOW. |
| Architecture | MEDIUM-HIGH | Multi-tenant RLS + `TIMESTAMPTZ` + partial unique index + iframe embed all HIGH. Next 15 / `@supabase/ssr` exact API surfaces MEDIUM — verify per phase. |
| Pitfalls | MEDIUM-HIGH | Core failure modes HIGH (universal booking-tool pitfalls). Vendor-specific LOW items (Vercel cron limits, Resend DNS, Supabase free-tier connections) flagged for validation. |

**Overall confidence:** MEDIUM-HIGH. Sufficient to proceed to requirements + roadmap.

### Gaps to Address

- **Live Calendly/Cal.com spot-check** — Research done without web search; 15-min manual check of current booker flow before finalizing v1 scope to catch any new "default" feature (e.g., AI summaries).
- **`@nsi/email-sender` API surface** — Assumed to support Resend attachments for .ics; confirm wrapper's attachment signature before Phase 5.
- **Vercel Cron hobby-tier minimum interval** — If hobby is daily-only, fall back to Supabase `pg_cron`. Verify before Phase 8.
- **pg_cron availability on Supabase Free tier** — Verify at project start in case fallback is needed.
- **Resend domain-verification record format** — Pull fresh from Resend dashboard at Phase 8.
- **Temporal vs date-fns** — v1 uses date-fns v4; re-evaluate Temporal migration in 12–18 months.

## Sources

### Primary (HIGH confidence)
- Supabase docs: RLS, `@supabase/ssr`, multi-tenant patterns
- PostgreSQL docs: `TIMESTAMPTZ`, `tstzrange`, `EXCLUDE USING gist`, partial unique indexes
- Calendly / Cal.com / SavvyCal established product behavior
- IANA timezone database + DST-transition semantics
- RFC 5545 (.ics / iCalendar), `METHOD:REQUEST` semantics
- SPF / DKIM / DMARC email-auth standards

### Secondary (MEDIUM confidence)
- Next.js 15 App Router + React 19 conventions — verify Route Handler + Server Action signatures at Phase 1
- date-fns v4 + `@date-fns/tz` API — v4 TZ support recent; confirm before Phase 4
- shadcn/ui + react-day-picker current component APIs
- `ics` npm package API — confirm before Phase 5

### Tertiary (LOW confidence — validate before phase implementation)
- Current Vercel Cron hobby-tier interval limits (verify before Phase 8)
- Current Resend DNS record format + webhook event schema (verify before Phase 8)
- Supabase Free-tier connection-pool limit + `pg_cron` availability (verify before Phase 1)
- Specific no-show-reduction percentages (directional only)
- Turnstile / hCaptcha current Next.js 14+ integration patterns (verify before Phase 8)

### Detailed research files
- [STACK.md](./STACK.md) — full technology choices with alternatives considered
- [FEATURES.md](./FEATURES.md) — table stakes, differentiators, anti-features, dependency map
- [ARCHITECTURE.md](./ARCHITECTURE.md) — topology, data model, RLS policies, cron pattern, embed pattern, build order
- [PITFALLS.md](./PITFALLS.md) — 10 critical + 10 moderate + 10 minor pitfalls with phase mapping

---
*Research completed: 2026-04-18*
*Ready for roadmap: yes*
