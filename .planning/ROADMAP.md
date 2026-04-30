# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- 📋 **v1.2** — Not yet planned. Run `/gsd:new-milestone` to scope.

## Carry-overs into v1.2

These items are tracked but not yet planned:

- **5 marathon items deferred from v1.1 Phase 13** (QA-09 signup E2E, QA-10 multi-tenant UI walkthrough, QA-11 capacity=3 race E2E, QA-12 3-account branded smoke, QA-13 EmbedCodeDialog 320/768/1024) — Andrew waived at sign-off; pre-flight artifacts remain on prod (Test User 3, capacity-test event, 3 branding profiles). See `FUTURE_DIRECTIONS.md` §8.1.
- **~21 per-phase manual checks** accumulated through Phases 10/11/12/12.5/12.6 — canonical row-level enumeration in `MILESTONE_V1_1_DEFERRED_CHECKS.md`.
- **v1.0 marathon QA carry-overs** (EMBED-07, EMAIL-08, QA-01..QA-06) — RE-deferred from v1.0 → v1.1 → v1.2.
- **8 v1.2 backlog items** captured during v1.1 (Resend migration, Vercel Pro hourly cron, NSI mark swap, DROP `accounts.chrome_tint_intensity`, remove `chromeTintToCss` compat export, live cross-client email QA, NSI branding restoration optional, pre-flight artifact cleanup decision). See `FUTURE_DIRECTIONS.md` §8.4.

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
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.2)

</details>

### 📋 v1.2 (Not yet planned)

Run `/gsd:new-milestone` to scope v1.2. Candidate scope items captured in `FUTURE_DIRECTIONS.md` §8.4 + `MILESTONE_V1_1_DEFERRED_CHECKS.md`.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |

## Cumulative Stats

- **Total phases shipped:** 15 (Phases 1-9 + Phases 10/11/12/12.5/12.6/13)
- **Total plans shipped:** 86 (52 + 34)
- **Total commits:** 357 (222 v1.0 + 135 v1.1)
- **Lines of code at v1.1 ship:** 29,450 LOC TS/TSX in runtime tree
- **Test suite at v1.1 ship:** 277 passing + 4 skipped (26 test files)

---

*Roadmap last updated: 2026-04-30 — v1.1 SHIPPED. Run `/gsd:new-milestone` to scope v1.2.*
