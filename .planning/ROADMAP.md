# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- ✅ **v1.4 Slot Correctness + Polish** — Phases 25-27 (8 plans across 3 phases) — shipped 2026-05-03. Full archive: [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md).
- 🚧 **v1.5 Buffer Fix + Audience Rebrand + Booker Redesign** — Phases 28-30 (6 plans across 3 phases) — in progress.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-04-27</summary>

See [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) for full phase details.

- [x] Phase 1: Foundation — completed 2026-04-19
- [x] Phase 2: Owner Auth + Dashboard Shell — completed 2026-04-24
- [x] Phase 3: Event Types CRUD — completed 2026-04-24
- [x] Phase 4: Availability Engine — completed 2026-04-25
- [x] Phase 5: Public Booking Flow + Email + .ics — completed 2026-04-25
- [x] Phase 6: Cancel + Reschedule Lifecycle — completed 2026-04-25
- [x] Phase 7: Widget + Branding — completed 2026-04-26
- [x] Phase 8: Reminders + Hardening + Dashboard List — completed 2026-04-27
- [x] Phase 9: Manual QA & Verification — completed 2026-04-27 ("ship v1")

</details>

<details>
<summary>✅ v1.1 Multi-User + Capacity + Branded UI (Phases 10-13) — SHIPPED 2026-04-30</summary>

See [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md) for full phase details.

- [x] Phase 10: Multi-User Signup + Onboarding (9 plans) — code complete 2026-04-28
- [x] Phase 11: Booking Capacity + Double-Booking Root-Cause Fix (8 plans) — code complete 2026-04-29
- [x] Phase 12: Branded UI Overhaul (5 Surfaces) (7 plans) — code complete 2026-04-29
- [x] Phase 12.5: Per-Account Heavy Chrome Theming (INSERTED) (4 plans) — code complete 2026-04-29 (deprecated in code by 12.6; DB columns retained)
- [x] Phase 12.6: Direct Per-Account Color Controls (INSERTED) (3 plans) — code complete 2026-04-29 (Andrew live Vercel approval)
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.3)

</details>

<details>
<summary>✅ v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md) for full phase details.

- [x] Phase 14: Typography + CSS Token Foundations (1 plan) — completed 2026-04-30
- [x] Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin (2 plans) — completed 2026-04-30
- [x] Phase 16: Auth + Onboarding Re-Skin (4 plans) — completed 2026-04-30
- [x] Phase 17: Public Surfaces + Embed (9 plans) — completed 2026-04-30
- [x] Phase 18: Branding Editor Simplification (3 plans) — completed 2026-05-01
- [x] Phase 19: Email Layer Simplification (1 plan) — completed 2026-05-01
- [x] Phase 20: Dead Code + Test Cleanup (1 plan) — completed 2026-05-01
- [x] Phase 21: Schema DROP Migration (1 plan) — completed 2026-05-02

</details>

<details>
<summary>✅ v1.3 Bug Fixes + Polish (Phases 22-24) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md) for full phase details.

- [x] Phase 22: Auth Fixes (2 plans) — completed 2026-05-02
- [x] Phase 23: Public Booking Fixes (2 plans) — completed 2026-05-02
- [x] Phase 24: Owner UI Polish (2 plans) — completed 2026-05-02 (Andrew live deploy approved)

</details>

<details>
<summary>✅ v1.4 Slot Correctness + Polish (Phases 25-27) — SHIPPED 2026-05-03</summary>

See [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md) for full phase details.

- [x] Phase 25: Surgical Polish (2 plans) — completed 2026-05-03 (AUTH-21, AUTH-22, OWNER-14, OWNER-15)
- [x] Phase 26: Bookings Page Crash Debug + Fix (3 plans) — completed 2026-05-03 (BOOK-01, BOOK-02; root cause RSC boundary violation)
- [x] Phase 27: Slot Correctness DB-Layer Enforcement (3 plans) — completed 2026-05-03 (SLOT-01..05; EXCLUDE constraint live; Andrew smoke approved)

</details>

<details>
<summary>🚧 v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Phases 28-30) — IN PROGRESS</summary>

**Milestone Goal:** Close the per-event-type buffer gap surfaced in Phase 27 smoke (replace account-wide `buffer_minutes` with per-event-type `buffer_after_minutes`), reposition from "trade contractors" to "service-based businesses" across owner-facing copy and docs, and redesign the public booker into a true 3-column desktop layout (calendar LEFT / times MIDDLE / form RIGHT).

**Phase order locked (LD-08):** Buffer → Rebrand → Booker. Buffer must complete before Booker because both touch `lib/slots.ts` / `booking-shell.tsx`; completing Buffer first avoids merge conflicts. Rebrand is independent and sandwiches naturally between the two complex phases.

---

### Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop

**Goal:** Owners can set a per-event-type post-event buffer; `accounts.buffer_minutes` is permanently dropped via the CP-03 two-step deploy protocol.

**Depends on:** Phase 27 (v1.4 ship — stable `lib/slots.ts` and `booking-shell.tsx` baselines)

**Requirements:** BUFFER-01, BUFFER-02, BUFFER-03, BUFFER-04, BUFFER-05, BUFFER-06

**Success Criteria** (what must be TRUE when this phase completes):
1. Owner can set a "Buffer after event" value (0–360 min, step 5) on each event type in the event-type editor and save it — the control is visible and persists across page reloads.
2. The public slot picker for event type A hides the slot immediately after a confirmed booking when A has buffer > 0, and shows it when A has buffer = 0 — regardless of what other event types on the same account have.
3. A slot adjacent to an event-B booking is bookable by event type A when A's buffer is 0, even though B's buffer is > 0 (asymmetric cross-event-type behavior confirmed).
4. The "Buffer" field is absent from the Availability settings page; the account-level buffer control is gone.
5. `SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'buffer_minutes'` returns zero rows (column permanently dropped; CP-03 30-min drain satisfied before DROP ran).

**Plans:** 3 plans

Plans:
- [x] 28-01: Backfill migration + slot engine rewire + event-type-form UI (Deploy A1 — code reads `buffer_after_minutes`; drain window begins) — completed 2026-05-04
- [x] 28-02: DROP migration + availability panel cleanup (Deploy A2 — after 30-min drain; `accounts.buffer_minutes` gone) — completed 2026-05-04 (drain waived per zero-traffic rationale)
- [x] 28-03: Per-event-type divergence tests + smoke checkpoint (vitest green; Andrew live verify buffer behavior on `nsi`) — completed 2026-05-04

**CP-03 checkpoint:** Plans 28-01 and 28-02 have a mandatory human-verified 30-minute drain gate between them. Plan 28-02 must NOT begin until Andrew confirms Plan 28-01's Vercel deploy has been live for at least 30 minutes.

---

### Phase 29: Audience Rebrand

**Goal:** All owner-facing surfaces and developer-facing docs reference "service-based businesses" instead of "trade contractors"; booker-facing surfaces remain unchanged.

**Depends on:** Phase 28 (clean working tree after buffer work; avoids merge risk on `auth-hero.tsx`)

**Requirements:** BRAND-01, BRAND-02, BRAND-03

**Success Criteria** (what must be TRUE when this phase completes):
1. The signup and login pages no longer reference "trade contractors" — the hero copy uses generic or "service-based businesses" framing visible to any prospective owner who lands on the auth surface.
2. `README.md` opening description references "service-based businesses" instead of "trade contractors (plumbers, HVAC, roofers, electricians)".
3. `FUTURE_DIRECTIONS.md` incidental "trade contractors" mentions are updated to reflect the broader audience.
4. `grep -rn "trade contractor" app/ lib/ README.md FUTURE_DIRECTIONS.md` returns zero matches (only the inert `booking-form.tsx:138` developer comment may remain — it is explicitly out of scope per BRAND-03 / LD-07).
5. The public booker form, slot picker, embed widget, and all 6 transactional emails contain no "service-based businesses" audience copy — they stay brand-neutral (contractor's brand, not NSI product copy).

**Plans:** 1 plan

Plans:
- [ ] 29-01: Copy pass across `auth-hero.tsx`, `README.md`, `FUTURE_DIRECTIONS.md` + grep verification + deploy

---

### Phase 30: Public Booker 3-Column Desktop Layout

**Goal:** The public booking card displays a true 3-column layout at desktop widths (calendar LEFT, times MIDDLE, form RIGHT) with no layout shift on slot pick; mobile stacks vertically in the correct interaction order.

**Depends on:** Phase 29 (clean working tree; `EventTypeSummary` type stable from Phase 28)

**Requirements:** BOOKER-01, BOOKER-02, BOOKER-03, BOOKER-04, BOOKER-05

**Success Criteria** (what must be TRUE when this phase completes):
1. At 1024px, 1280px, and 1440px viewport widths the booking card shows three distinct columns — calendar on the left, time slots in the middle, and a form area on the right — with no horizontal overflow or scrollbar.
2. Before a time slot is selected, the form column shows the prompt "Pick a time on the left to continue." in its reserved 320px space; after a slot is selected, the booking form replaces the prompt in-place and the calendar and times columns do not shift position (zero layout shift).
3. On a mobile device (below 1024px), the booking card stacks vertically: calendar first, time slots below it, form below that — matching the natural interaction flow without any horizontal scroll.
4. The embed widget at typical iframe widths (320–600px) renders as a single-column vertical stack, not a 3-column layout — the `lg:` breakpoint handles this automatically with no embed-specific code branch.
5. Andrew has live-verified the 3-column layout on production at 1024px / 1280px / 1440px and confirmed the mobile stack on a real device (BOOKER-05 smoke checkpoint).

**Plans:** 2 plans

Plans:
- [ ] 30-01: Grid restructure — `booking-shell.tsx` 3-col template + `max-w-4xl`; `slot-picker.tsx` internal 2-col wrapper removed; Calendar and slot list as direct grid children; timezone hint to slot-list column header; form column placeholder/conditional-mount preserved (Turnstile lifecycle safe)
- [ ] 30-02: Andrew live-verify smoke checkpoint at 1024px / 1280px / 1440px + mobile real-device check

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25-27 | v1.4 | 8 / 8 | ✅ Shipped | 2026-05-03 |
| 28 | v1.5 | 3 / 3 | ✅ Complete | 2026-05-04 |
| 29 | v1.5 | 0 / 1 | Not started | — |
| 30 | v1.5 | 0 / 2 | Not started | — |

## Cumulative Stats

- **Total phases shipped:** 29 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27)
- **Total plans shipped:** 122 (52 + 34 + 22 + 6 + 8)
- **Total commits:** 499 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4)
- **Test suite at v1.4 ship:** 225 passing + 9 skipped without `SUPABASE_DIRECT_URL` (≥230 + 4 with DIRECT_URL set)
- **v1.5 planned:** 3 phases (28-30), 6 plans, 14 requirements
- **Status:** v1.5 in progress — roadmap defined; Phase 28 ready to plan.

---

*Roadmap last updated: 2026-05-04 — Phase 28 complete (BUFFER-01..06 shipped via CP-03 two-step DROP; drain waived per zero-traffic rationale). Run `/gsd:plan-phase 29` to continue with Audience Rebrand.*
