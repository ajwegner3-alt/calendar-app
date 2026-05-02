# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- 🔄 **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — IN PROGRESS

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

<details open>
<summary>🔄 v1.3 Bug Fixes + Polish (Phases 22-24) — IN PROGRESS</summary>

Surgical bug-fix and polish milestone surfaced from Andrew's post-v1.2 live use. No new architecture, no new packages, no new domain capabilities. All 8 requirements target existing surfaces. Marathon QA explicitly NOT scheduled — Andrew has formally adopted deploy-and-eyeball as the de-facto production gate (third consecutive marathon deferral; v1.2 ship-record documents this pattern).

### Phase 22: Auth Fixes

**Goal:** Owner authentication surfaces work as intended — signup is reachable from login, the split-panel layout matches the intended Cruip direction, and authenticated sessions persist long enough that Andrew isn't re-prompted to log in during a normal week of use.

**Dependencies:** None (touches `/login` page + Supabase Auth client config; no schema changes).

**Requirements covered:** AUTH-18, AUTH-19, AUTH-20 (3 requirements).

**Success criteria:**

1. From `/login`, clicking the "Sign up" link navigates the browser to `/signup` (no broken click; correct Next.js Link routing).
2. The `/login` page renders the informational pane on the LEFT side of the viewport and the email/password form on the RIGHT side at desktop widths (≥ 768px).
3. After a successful login, the owner can close the browser, reopen it the next day, navigate back to `/app`, and remain authenticated without being redirected to `/login` (sliding 30-day refresh window).
4. The 30-day session TTL applies on next login or refresh-token rotation; existing sessions are not retroactively extended (acceptable trade-off — Andrew will log in once and the longer TTL kicks in from there).

**Plans:** 2 plans

Plans:
- [x] 22-01-PLAN.md — AUTH-18 middleware allow-list fix + AUTH-19 login page column swap (Wave 1, autonomous) — completed 2026-05-02
- [x] 22-02-PLAN.md — AUTH-20 proxy.ts setAll headers patch + manual session-persistence verification (Wave 2, has human-verify checkpoint) — completed 2026-05-02

---

### Phase 23: Public Booking Fixes

**Goal:** The public-facing booker experience renders correctly across viewports and provides a discoverable entry point at the account root — no off-center calendars, no overlapping helper text, and no dead-end landing page when a booker hits `/[account]` without knowing the event slug.

**Dependencies:** None (touches `/[account]` + `/[account]/[event-slug]` only; uses existing `PublicShell` + slot picker components).

**Requirements covered:** PUB-13, PUB-14, PUB-15 (3 requirements).

**Success criteria:**

1. On a mobile viewport (< 768px wide), the slot picker calendar widget on `/[account]/[event-slug]` is horizontally centered within the public booking card (no left- or right-bias visible to the booker).
2. On a desktop viewport (≥ 1024px wide), the timezone hint ("Times shown in America/Chicago") and the "Pick a date to see available times:" instruction render in their own visual lanes — neither overlaps the calendar widget grid.
3. Visiting `/[account]` (e.g., `/nsi`) renders a landing page listing every public event type for that account as a selectable card, each showing the account logo, event name, duration, and a CTA that routes to `/[account]/[event-slug]` for booking.
4. From the `/[account]` index, clicking any event-type card lands the booker on the existing slot-picker page in the booker's local timezone with no regression to the v1.2 booking flow.

**Plans:** 2 plans

Plans:
- [x] 23-01-PLAN.md — PUB-15 metadata title fix on `/[account]/page.tsx` (Wave 1, autonomous, parallel with 23-02) — completed 2026-05-02
- [x] 23-02-PLAN.md — PUB-13 mobile calendar centering + PUB-14 timezone hint hoist on `slot-picker.tsx` (Wave 1, autonomous, parallel with 23-01) — completed 2026-05-02 (mid-verify follow-up: `mx-auto` swapped to `justify-self-center` for grid-native centering after live mobile check)

---

### Phase 24: Owner UI Polish

**Goal:** Two owner-side dashboard touch-ups that close visible gaps from Andrew's live use — the orange-accent leak in the Home tab calendar disappears, and the event-type edit page exposes a copyable per-event booking URL so Andrew can grab a sendable link without manual URL construction.

**Dependencies:** None (touches `/app/home` calendar component + `/app/event-types/[id]` edit form; no schema changes).

**Requirements covered:** OWNER-12, OWNER-13 (2 requirements).

**Success criteria:**

1. On `/app/home`, the monthly calendar day-grid renders day buttons with no orange (`#F97316`) coloring in any state (default / hover / today / selected / has-bookings) — the surviving `--color-accent` orange from `globals.css` is replaced with grey or NSI blue across all day-button variants.
2. On `/app/event-types/[id]`, the form renders a copyable booking-link field at the top showing the full public per-event URL in the format `https://<host>/<account-slug>/<event-slug>`.
3. Clicking the copy button next to that field copies the URL to the clipboard and shows brief visual confirmation (toast / icon-flip / "Copied!" text).
4. The booking-link URL is correctly constructed from the current account slug and event slug — verified by pasting into a new browser tab and landing on the working public booking page for that event type.

**Estimated plans:** 2 (Plan 24-01: OWNER-12 orange-highlight removal — calendar component CSS / variant audit; Plan 24-02: OWNER-13 copyable booking-link field + clipboard integration on event-type edit page).

</details>


## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22 | v1.3 | 2 / 2 | ✅ Complete | 2026-05-02 |
| 23 | v1.3 | 2 / 2 | ✅ Complete | 2026-05-02 |
| 24 | v1.3 | 0 / 2 (est.) | 🔄 In progress | — |

## Cumulative Stats

- **Total phases shipped:** 23 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21)
- **Total plans shipped:** 108 (52 + 34 + 22)
- **Total commits:** 448 (222 v1.0 + 135 v1.1 + 91 v1.2)
- **Lines of code at v1.2 ship:** 21,871 LOC TS/TSX in runtime tree (down from 29,450 at v1.1 close — first net-deletion milestone)
- **Test suite at v1.2 ship:** 222 passing + 4 skipped (24 test files; -3 deleted in Phase 20)
- **v1.3 projected scope:** 3 phases / 6 plans / 8 requirements (small surgical milestone; no schema changes; no new packages)

---

*Roadmap last updated: 2026-05-02 — Phase 23 (Public Booking Fixes) complete. PUB-13/14/15 verified via Andrew live deploy approval. 1 phase remaining (24).*
