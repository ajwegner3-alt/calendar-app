# Requirements: Calendar App v1.4 — Slot Correctness + Polish

**Defined:** 2026-05-02
**Core Value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Milestone driver:** Five live-use issues from Andrew's first week post-v1.3 (2026-05-02). Carryover backlog (Marathon QA, Resend, Vercel Pro, OAuth, brand asset, tech debt) deferred to v1.5.

## v1.4 Requirements

11 requirements across 4 categories. All map to Phases 25-27 in the roadmap.

### Authentication

- [x] **AUTH-21**: `/login` page renders without "Powered by NSI" pill element. The pill in `app/(auth)/_components/auth-hero.tsx:27-31` is removed (or `AuthHero` is updated to omit it). The pill is a common AI-generation tell and should not appear on auth surfaces.
- [x] **AUTH-22**: `/signup` page renders without "Powered by NSI" pill element. Same fix as AUTH-21 since both pages share `AuthHero`.

### Owner UI Polish

- [x] **OWNER-14**: Home calendar selected-date renders NSI blue (`bg-primary` token, currently `#3B82F6` post-v1.2 owner-side `--primary` lock). Hover state preserves `bg-gray-100`. Today-state preserves `bg-muted + ring-1 ring-gray-300`. Shared `components/ui/calendar.tsx` and `globals.css --color-accent` token UNTOUCHED — per-instance className override on `home-calendar.tsx:72` only (extends Phase 23/24 pattern).
- [x] **OWNER-15**: Home calendar grid does not overflow the parent Card on a 375px-width mobile viewport. The fix targets the `min-w-[var(--cell-size,theme(spacing.9))]` fallback at `home-calendar.tsx:72` (or equivalent width-strategy: `overflow-hidden`, `overflow-x-auto`, or reduced cell-size fallback). Shared `components/ui/calendar.tsx` UNTOUCHED.

### Bookings Page Crash

- [ ] **BOOK-01**: `/app/bookings` page renders without crashing for the seeded NSI account on production. Root cause must be identified and documented (server logs first; null guards on `row.event_types?.duration_minutes` access at `bookings-table.tsx:108` is the leading hypothesis per Architecture research).
- [ ] **BOOK-02**: `/app/bookings` page renders without crashing across all 3 seeded test accounts (NSI + nsi-rls-test + nsi-rls-test-3) on production. Confirms the fix is account-agnostic.

### Slot Correctness (Headline)

- [ ] **SLOT-01**: A booker cannot insert a confirmed booking that overlaps any other confirmed booking on the same `account_id`, regardless of `event_type_id`. DB-enforced via `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status='confirmed')` constraint on `bookings` table. Verified by unit test asserting `error.code === '23P01'` on second INSERT.
- [ ] **SLOT-02**: SLOT-01 must coexist with v1.1 group-booking capacity. A single event type with `max_bookings_per_slot > 1` allows N concurrent same-slot bookings on that event type. The `event_type_id WITH <>` clause in the EXCLUDE constraint is what makes this coexist (constraint only fires when event_type_ids differ). Verified by test: insert 3 bookings on a `max_bookings_per_slot=3` event type at same `start_at` → all 3 succeed.
- [ ] **SLOT-03**: SLOT-01 must coexist with reschedule semantics. A booking moved via `lib/bookings/reschedule.ts` UPDATE-in-place (status stays `'confirmed'`, time range moves) does NOT block its own new slot. Verified by test: insert booking at 9:00, reschedule to 10:00, no constraint error; new INSERT at 9:00 on same event type succeeds.
- [ ] **SLOT-04**: Same-event-type double-booking root-cause analysis documented in Phase 27 SUMMARY. If a regression vs. v1.1 race-safety exists, the fix lives at the same DB layer (insert-time index/constraint), not application logic. The existing `bookings_capacity_slot_idx` partial unique index continues to handle this; if RCA reveals a defect in the index or status filter, the migration may be amended.
- [ ] **SLOT-05**: Production smoke test confirms a cross-event-type collision attempt is rejected. Manual test: book a 60-min appointment at 9:00 on Event A; attempt to book 9:30 on Event B (different event type, same account); expect 4xx with `code: 'CROSS_EVENT_CONFLICT'`. Andrew live-verifies on production deploy.

## Future Requirements (deferred to v1.5+)

These remain in the carryover backlog (canonical enumeration in `FUTURE_DIRECTIONS.md` §8):

### Marathon QA (formally deploy-and-eyeball as of v1.3 — these may stay deferred indefinitely)
- **QA-09..QA-13**: Multi-tenant signup E2E walkthroughs, capacity 3-session live race, 3-account branded smoke matrix, EmbedCodeDialog multi-viewport
- ~21 per-phase manual checks accumulated through v1.0/v1.1/v1.2

### Infrastructure
- **INFRA-01**: Resend migration (closes EMAIL-08, ~$10/mo for 5k emails, unlocks SPF/DKIM/DMARC)
- **INFRA-02**: Vercel Pro upgrade + flip cron to hourly (`0 * * * *` in `vercel.json`)
- **INFRA-03**: Live cross-client email QA (Outlook desktop, Apple Mail iOS, Yahoo)

### Auth additions
- **AUTH-23**: OAuth signup
- **AUTH-24**: Magic-link login
- **AUTH-25**: Hard-delete cron for soft-deleted accounts past grace period
- **AUTH-26**: Soft-delete grace period UI
- **AUTH-27**: Slug 301 redirect on rename
- **AUTH-28**: Onboarding analytics
- **AUTH-29**: Timing-oracle hardening on auth endpoints

### Brand asset
- **BRAND-22**: Final NSI mark image swap (current `public/nsi-mark.png` is 105-byte solid-navy placeholder; v1.2 went text-only "Powered by North Star Integrations" everywhere so this is cosmetic until image-based footer is desired)

### Tech debt (DEBT-01..07 from v1.0/v1.1/v1.2/v1.3 carryover)
- **DEBT-01**: ~22 pre-existing tsc errors in `tests/` (TS7006/TS2305 from mock-alias-only-in-vitest.config)
- **DEBT-02**: `react-hooks/incompatible-library` warning on `event-type-form.tsx:99` (RHF `watch()` → migrate to `useWatch`)
- **DEBT-03**: `generateMetadata` double-load on public booking page (wrap in `import { cache } from 'react'`)
- **DEBT-04**: Supabase service-role JWT rotation when `sb_secret_*` format ships
- **DEBT-05**: `rate_limit_events` test DB cleanup gap (60-90s cooldown between vitest runs)
- **DEBT-06**: `/app/unlinked` UX hole for soft-deleted accounts on re-login
- **DEBT-07**: `AccountSummary` cosmetic field cleanup (residual `background_color` + `background_shade` in local TypeScript interface post-Phase-21 DROP)

## Out of Scope

Explicitly excluded from v1.4 to prevent scope creep. Each entry has a reason:

| Feature | Reason |
|---------|--------|
| Multi-host scheduling (two contractors, one calendar) | Not core to solo trade contractor product. Cal.com Teams territory. |
| Round-robin event types | Anti-feature for v1; targets enterprises, not solo contractors. |
| Resource booking (room/equipment shared across event types) | Solo contractor model — the contractor is the resource. |
| Working-hours conflict detection across separate calendars | The contractor's calendar IS the source of truth; no external calendar sync (per v1.0 decision). |
| Auto-cancel existing bookings on date_override insertion | Existing behavior (admin sees + decides) is correct per Features research. Changing this is out of scope. |
| Configurable per-event-type buffer asymmetry | Buffer is account-level today; deferring per-event-type buffer to a future milestone. |
| "This conflicts" preview UX banner before submit | The 409 inline-banner pattern from v1.0/v1.1 is sufficient; deferring richer pre-submit conflict preview. |
| EXCLUDE constraint with `tstzrange` materialized via function-based index expression | Stack research confirmed only the stored generated column form works; function-based does not compile. Locked decision; not revisiting. |
| Trigger-based enforcement (Option B) | Option A `EXCLUDE USING gist` with `WITH <>` is locked primary. Option B is fallback only if Option A fails verification at execution time. |
| Application-layer SELECT FOR UPDATE conflict check | Bypassable via direct POST; trigger/EXCLUDE is the correct DB-layer enforcement. |
| Two-step `NOT VALID` + `VALIDATE CONSTRAINT` migration | Will be evaluated at execution time based on table size + pre-flight diagnostic outcome; not pre-locked. |
| Touching `components/ui/calendar.tsx`, `globals.css --color-accent`, or shared shadcn components | v1.3 invariant — per-instance className overrides only. |
| Removing "Powered by North Star Integrations" footer from public booking surfaces | Public surfaces still ship NSI footer (per v1.2 decision); auth surfaces are the only locations losing the pill. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-21 | Phase 25 | Complete |
| AUTH-22 | Phase 25 | Complete |
| OWNER-14 | Phase 25 | Complete |
| OWNER-15 | Phase 25 | Complete |
| BOOK-01 | Phase 26 | Pending |
| BOOK-02 | Phase 26 | Pending |
| SLOT-01 | Phase 27 | Pending |
| SLOT-02 | Phase 27 | Pending |
| SLOT-03 | Phase 27 | Pending |
| SLOT-04 | Phase 27 | Pending |
| SLOT-05 | Phase 27 | Pending |

**Coverage:**
- v1.4 requirements: 11 total
- Mapped to phases: 11 mapped, 0 unmapped ✓
- Phase 25: AUTH-21, AUTH-22, OWNER-14, OWNER-15 (4 requirements)
- Phase 26: BOOK-01, BOOK-02 (2 requirements)
- Phase 27: SLOT-01, SLOT-02, SLOT-03, SLOT-04, SLOT-05 (5 requirements)

---

*Requirements defined: 2026-05-02*
*Last updated: 2026-05-02 — traceability filled by gsd-roadmapper (11/11 mapped)*
