# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- 🚧 **v1.4 Slot Correctness + Polish** — Phases 25-27 (in progress) — started 2026-05-02.

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
<summary>🚧 v1.4 Slot Correctness + Polish (Phases 25-27) — IN PROGRESS</summary>

### Phase 25: Surgical Polish

**Goal:** Ship four UI-only fixes that improve auth and owner-home surfaces without touching shared components or the database.

**Requirements:** AUTH-21, AUTH-22, OWNER-14, OWNER-15

**Dependencies:** None. Parallel-safe with Phase 26 and Phase 27.

**Parallelization:** Can execute in any order relative to Phases 26 and 27; all four items are independent single-file className changes.

**Research flag:** NONE — all fix locations precisely identified by research.

**Success Criteria** (what must be TRUE when this phase completes):
1. Visiting `/login` or `/signup` shows no "Powered by NSI" pill element anywhere on the page; the public `PoweredByNsi` footer on booking pages is unchanged.
2. Clicking a selected date on the owner home calendar shows the day cell with NSI blue (`bg-primary`) background; hovering an unselected date shows `bg-gray-100`.
3. The home calendar grid fits inside its Card container on a 375px-wide mobile viewport with no horizontal overflow or scrollbar.
4. Shared `components/ui/calendar.tsx`, `globals.css --color-accent`, `Header` component, and `powered-by-nsi.tsx` are untouched (v1.3 invariant preserved).

**Pitfalls to avoid:**
- V14-mp-01: Do NOT add `overflow-x-auto` to the Calendar root for OWNER-15 — override `--cell-size` on the instance instead.
- V14-mp-02: Auth pill removal targets `auth-hero.tsx:27-31` only — do NOT modify `header.tsx` shared `variant="auth"` branch or remove the header entirely.
- V14-mp-03: Use `bg-primary` Tailwind token for the selected-date color (not a hardcoded hex) so it inherits the owner-shell `--primary` lock from v1.2.

**Plans:** TBD (estimated 1-2 plans)

Plans:
- [ ] 25-01: Remove NSI pill from auth-hero + flip calendar selected color + fix mobile overflow

---

### Phase 26: Bookings Page Crash Debug + Fix

**Goal:** Identify and fix the root cause of the `/app/bookings` page crash so the page renders for all seeded production accounts.

**Requirements:** BOOK-01, BOOK-02

**Dependencies:** None. Independent of Phases 25 and 27. If root cause turns out to be schema-related, re-evaluate before running Phase 27 migration (unlikely per research).

**Parallelization:** Can execute in any order relative to Phases 25 and 27.

**Research flag:** LOW — debug path well-defined; root cause narrowed to `event_types!inner` join normalization or RLS artifact in `_lib/queries.ts:85-92`; exact stack trace requires Vercel server log inspection.

**Success Criteria** (what must be TRUE when this phase completes):
1. `/app/bookings` loads without a server error or client crash for the seeded NSI account (`slug=nsi`) on production.
2. `/app/bookings` loads without errors for all three seeded test accounts (NSI, nsi-rls-test, nsi-rls-test-3) — confirming the fix is account-agnostic.
3. Root cause is documented in the phase SUMMARY (Vercel log stack frame confirmed; not speculative).

**Pitfalls to avoid:**
- V14-MP-04: Diagnostic-first protocol — read Vercel server logs and reproduce in Supabase SQL Editor before writing any fix. Do NOT add speculative null guards before confirming the root cause.

**Plans:** TBD (estimated 1-2 plans)

Plans:
- [ ] 26-01: Diagnose crash via server logs + SQL Editor; implement confirmed fix; verify across 3 accounts

---

### Phase 27: Slot Correctness (DB-Layer Enforcement)

**Goal:** Close the contractor-can't-be-in-two-places-at-once invariant at the database layer by adding an account-scoped EXCLUDE constraint that rejects overlapping bookings across different event types.

**Requirements:** SLOT-01, SLOT-02, SLOT-03, SLOT-04, SLOT-05

**Dependencies:** None. Independent of Phases 25 and 26. Pre-flight diagnostic must return zero rows before any migration SQL runs (hard gate, not optional).

**Parallelization:** No dependency on Phase 25 or 26; can run in any order. However, the internal Phase 27 task sequence is fixed (see below).

**Research flag:** NONE — DDL live-verified against production Postgres 17.6.1; all behavioral edge cases confirmed; error code 23P01 confirmed; migration apply path established.

**Internal task sequence (hard order — do not reorder):**
1. Run pre-flight diagnostic SQL (V14-CP-06) — must return zero rows before proceeding
2. Apply single migration file: `CREATE EXTENSION IF NOT EXISTS btree_gist` → `ADD COLUMN during tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED` → `ADD CONSTRAINT bookings_no_account_cross_event_overlap EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = 'confirmed')`
3. Add `23P01` branch in `app/api/bookings/route.ts` before the `23505` branch; break retry loop; return 409 `CROSS_EVENT_CONFLICT`
4. Add `23P01` → `slot_taken` branch in `lib/bookings/reschedule.ts`
5. Write `tests/cross-event-overlap.test.ts`: basic cross-event block, group-booking regression (same-event-type capacity coexistence), adjacent-slot non-collision
6. Production smoke test: Andrew live-verifies cross-event collision attempt returns 4xx

**Success Criteria** (what must be TRUE when this phase completes):
1. A booker who attempts to book Event B at a time already occupied by a confirmed Event A booking on the same account receives a 409 response with `code: "CROSS_EVENT_CONFLICT"` — not a 201 or 500.
2. A single event type with `max_bookings_per_slot=3` still accepts 3 concurrent confirmed bookings at the same time (group-booking capacity coexistence verified; v1.1 regression absent).
3. A booking rescheduled via `/api/reschedule` to a time blocked by a different event type returns 409 (not 500); rescheduling to a free time still succeeds.
4. Andrew manually verifies on production: POST to `/api/bookings` with an overlapping interval for a different event type on the same account returns 4xx with `CROSS_EVENT_CONFLICT` code.
5. All new pg-driver tests pass with `SUPABASE_DIRECT_URL` set; CI passes (tests skip cleanly) without it.

**Pitfalls to avoid:**
- V14-CP-01: `CREATE EXTENSION IF NOT EXISTS btree_gist` must be the first statement in the migration — without it the EXCLUDE USING gist on UUID raises an error and the deploy fails.
- V14-CP-02: Use `tstzrange(start_at, end_at, '[)')` (half-open, inclusive start, exclusive end) — fully-closed `[]` causes adjacent slots to falsely collide.
- V14-CP-03: Include `WHERE (status = 'confirmed')` partial predicate — without it, cancelled bookings permanently block their original slots.
- V14-CP-04: `event_type_id WITH <>` operator is mandatory — without it, same-event-type group bookings are blocked, destroying v1.1 capacity feature.
- V14-CP-05: EXCLUDE constraints cannot be added `CONCURRENTLY`; evaluate table row count first; use `NOT VALID` + `VALIDATE CONSTRAINT` two-step if warranted.
- V14-CP-06: Pre-flight diagnostic SQL is a hard gate — existing cross-event overlapping confirmed bookings abort `VALIDATE CONSTRAINT`. Run and confirm zero rows before ANY migration SQL.
- V14-CP-07: Reschedule UPDATE-in-place is constraint-safe; document JSDoc invariant about INSERT+UPDATE ordering for any future admin-reschedule code.
- V14-MP-01: Add explicit `23P01` branch in `route.ts` before the `23505` branch; break the retry loop immediately on `23P01` (do not increment `slot_index`).
- V14-MP-02: Add `23P01` → `slot_taken` branch in `reschedule.ts:149`.
- V14-MP-05: New pg-driver tests must use `describe.skipIf(skipIfNoDirectUrl)` guard pattern from `race-guard.test.ts`.

**Plans:** TBD (estimated 2-3 plans)

Plans:
- [ ] 27-01: Pre-flight diagnostic + migration (btree_gist + during column + EXCLUDE constraint)
- [ ] 27-02: Error mapping (route.ts + reschedule.ts + client 409 handler) + tests + production smoke

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25 | v1.4 | 0 / TBD | Not started | - |
| 26 | v1.4 | 0 / TBD | Not started | - |
| 27 | v1.4 | 0 / TBD | Not started | - |

## Cumulative Stats

- **Total phases shipped:** 26 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24)
- **Total plans shipped:** 114 (52 + 34 + 22 + 6)
- **Total commits:** 482 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3)
- **Lines of code at v1.3 ship:** 22,071 LOC TS/TSX in runtime tree (NET +200 from v1.2 close — surgical milestone)
- **Test suite at v1.3 ship:** 222 passing + 4 skipped (26 test files — baseline preserved exactly from v1.2)
- **v1.4 status:** Active — 3 phases (25-27), 11 requirements, roadmap defined 2026-05-02.

---

*Roadmap last updated: 2026-05-02 — v1.4 milestone roadmap created (Slot Correctness + Polish; Phases 25-27; 11/11 requirements mapped).*
