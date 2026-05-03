# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-02 — **v1.4 MILESTONE STARTED.** Slot Correctness + Polish. Scope locked to 5 live-use items (carryover backlog deferred to v1.5). Headline item is the cross-event-type DB-layer enforcement of the contractor-busy-time invariant; remaining items are surgical polish + 1 unrelated bookings-page crash to debug.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 after v1.4 milestone start)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.4 Slot Correctness + Polish — defining requirements after research.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.4 Slot Correctness + Polish (active).
**Phase:** Not started (research → requirements → roadmap pending).
**Plan:** —
**Status:** Defining requirements.
**Last activity:** 2026-05-02 — Milestone v1.4 started; PROJECT.md evolved with Current Milestone section + 11 active requirements (AUTH-21/22, OWNER-14/15, BOOK-01/02, SLOT-01..05). Research stage spawning 4 parallel project-researcher agents next.

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [ ] Carryover backlog            (TBD — Marathon QA + Resend + OAuth + NSI mark image + tech debt)
```

## Performance Metrics

**v1.3 velocity (final):**
- 3 phases (22-24), 6 plans, ~9 tasks, 34 commits over ~10 hours (2026-05-02 11:35 → 21:36)
- 13 files changed, 326 insertions(+), 126 deletions(-) — surgical, NET +200 LOC runtime
- Final LOC: 22,071 TS/TSX in runtime tree (up from 21,871 at v1.2 close)
- Final test suite: 222 passing + 4 skipped (26 test files — exact baseline from v1.2)
- Same-day milestone is reproducible when scope is < 10 plans and all touch existing surfaces

**Reference velocities (cumulative):**
- v1.2: 8 phases, 22 plans, 91 commits, 3 days. NET -792 lines runtime (first net-deletion milestone).
- v1.1: 6 phases (incl. 12.5/12.6), 34 plans, 135 commits, 3 days. NET +31,664 lines (additive).
- v1.0: 9 phases, 52 plans, 222 commits, 10 days. NET +85,014 lines (greenfield scaffolding).

## Accumulated Context

### Architectural patterns established (carried into v1.4)

(See `PROJECT.md` "Context" → "Architectural patterns established" + "v1.1 architectural patterns added" + "v1.2 architectural patterns added" for the canonical record. v1.3 added no new architectural patterns — surgical milestone, all fixes within existing patterns.)

**v1.3 patterns worth keeping in mind for v1.4:**

- **Per-instance className override pattern** is now locked across 3 surfaces (Phase 23 calendar, Phase 24 home-calendar, Phase 24 dropdown menu). When a CSS custom property is shared across multiple consumers and only ONE needs to change, override at the consumer site. Reusable any time future per-surface theming conflicts with a shared component or token. `components/ui/calendar.tsx` and `components/ui/dropdown-menu.tsx` should remain untouched for the same reason; tweak per-instance `className`.
- **`current_owner_account_ids` RPC + `accounts.slug` query** is the canonical owner-context lookup. Three call sites: `event-types/page.tsx`, `loadBrandingForOwner`, and Phase 24's `event-types/[id]/edit/page.tsx` + `event-types/new/page.tsx`. Reuse this pattern for any future Server Component that needs the owner's account slug.
- **Required-prop typing flushes out missing consumers** — Phase 24 Plan 02 made `accountSlug: string` required on `EventTypeForm`, which forced `new/page.tsx` to convert from sync stub to async server component. Pattern: when adding a required prop to a shared component, run `grep -rn '<ComponentName' app/` and update every consumer in the same atomic plan. Build will catch missed consumers.
- **Mid-checkpoint scope expansion is acceptable when it fits the same surface** — Plan 24-02 absorbed two follow-up requirements (per-row copy-link button, blue dropdown highlight) into commit `db7fb62` rather than spawning new plans. Pattern: document deviation under Rule 3 in SUMMARY.md, verifier checks the expansion as part of the parent plan's must-haves.
- **`@supabase/ssr@0.10.2` 400-day cookie default is trusted** — never override `cookieOptions.maxAge` (any value would shorten sessions). `proxy.ts setAll(cookiesToSet, headers)` forwards cache-control headers via `Object.entries(headers ?? {})` defensively against CDN cache poisoning during token rotation. Maintain this signature if `proxy.ts` is touched in v1.4.

### v1.3 ship-time invariants (still true post-archive)

- `accounts` schema unchanged from v1.2 ship: `id, slug, name, owner_email, logo_url, brand_primary, timezone, onboarding_complete` + standard timestamps. No schema changes in v1.3.
- `Branding` interface canonical shape: `{ logoUrl, primaryColor, textColor }` (3 fields).
- `EmailBranding` interface canonical shape: `{ name, logo_url, brand_primary }` (3 fields).
- NSI account `brand_primary` = `#0A2540` (dark navy).
- `globals.css --color-accent` = `#F97316` orange (preserved; 3 consumers depend on it: bookings-table hover, cancel-confirm-form hover, public booker `.day-has-slots::after`).
- Pre-flight QA artifacts on prod (KEPT for v1.4 marathon): Test User 3, capacity-test event_type, 3 distinct branding profiles (navy/magenta/emerald-null).

### Active blockers / open items (carried to v1.4)

- **Marathon QA carryover (4th consecutive deferral; now permanently deploy-and-eyeball):** QA-09..QA-13 + ~21 per-phase manual checks accumulated through v1.1+v1.2+v1.3 are tracked in `FUTURE_DIRECTIONS.md` §8 as v1.4 backlog. Andrew formally adopted deploy-and-eyeball as the canonical production gate at v1.3 close.
- **Infrastructure migrations awaiting v1.4:** Resend migration (closes EMAIL-08), Vercel Pro upgrade + hourly cron flip, live cross-client email QA.
- **Auth additions awaiting v1.4:** OAuth signup, magic-link, hard-delete cron, soft-delete grace, slug 301, onboarding analytics, timing-oracle hardening.
- **Brand asset awaiting v1.4:** Final NSI mark image swap (`public/nsi-mark.png` placeholder, 105 bytes solid-navy); add NSI mark image to "Powered by NSI" footer on web + emails.
- **Tech debt baseline (DEBT-01..07):** ~22 pre-existing tsc errors in `tests/` (TS7006/TS2305), `react-hooks/incompatible-library` warning on `event-type-form.tsx:99`, `generateMetadata` double-load on public booking page, Supabase service-role JWT rotation, `rate_limit_events` test cleanup gap, `/app/unlinked` UX hole for soft-deleted accounts, `AccountSummary` cosmetic field cleanup. All carried to v1.4.

## Session Continuity

**Last session:** 2026-05-02 — Executed Phase 24 (Plans 24-01 + 24-02 + mid-checkpoint commit `db7fb62`). Andrew live-verified OWNER-12 + OWNER-13 + per-row copy button + blue dropdown highlight on Vercel deploy. Phase 24 verifier passed 12/12. Closed v1.3 milestone: wrote archives, collapsed ROADMAP, deleted REQUIREMENTS.md, prepended MILESTONES.md, evolved PROJECT.md, tagged `v1.3`.

**Stopped at:** v1.3 milestone shipped. Between milestones; no active phase or plan.

**Resume:** Run `/gsd:new-milestone` to scope v1.4. Reference `FUTURE_DIRECTIONS.md` §8 for canonical carryover backlog enumeration.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02 after v1.3 ship)
- `.planning/ROADMAP.md` — all 4 milestones collapsed; awaiting v1.4 scope
- `.planning/MILESTONES.md` — full ship records (v1.0/v1.1/v1.2/v1.3)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.3-ROADMAP.md` — full v1.3 phase detail archive
- `.planning/milestones/v1.3-REQUIREMENTS.md` — v1.3 requirements archive (8/8 complete)
- `FUTURE_DIRECTIONS.md` — v1.4 backlog enumeration
