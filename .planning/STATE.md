# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — **v1.5 MILESTONE ARCHIVED.** All v1.5 artifacts moved to `.planning/milestones/`: `v1.5-ROADMAP.md` (full archive), `v1.5-REQUIREMENTS.md` (14/14 shipped), `v1.5-MILESTONE-AUDIT.md` (passed 5/5 phases × 5/5 must-haves; 6/6 cross-phase risks cleared; 3/3 E2E flows traced clean). PROJECT.md evolved (audience term updated to "service businesses"; v1.5 requirements moved to Validated; 9 new Key Decisions added covering LD-01/04/07, drain-waiver pattern, mid-execution Rule 4 pattern, smallest-diff override pattern, verification-only plan reuse, single grid owner UI pattern, reserved-column pattern, marathon QA 5th deferral). MILESTONES.md updated with v1.5 entry (top of file). ROADMAP.md collapsed v1.5 details to one-line summary linking to archive. REQUIREMENTS.md DELETED (fresh one created by next `/gsd:new-milestone` invocation). Git tag `v1.5` created and pushed. Pre-existing `02-VERIFICATION.md` working-tree drift preserved unstaged through entire v1.5 + archive (hygiene perfect across 6 plans + milestone close).

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-05 after v1.5 milestone shipped)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** Awaiting next milestone. Run `/gsd:new-milestone` to start v1.6 (or whatever the next version is) — questioning → research → requirements → roadmap.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.5 ✅ SHIPPED 2026-05-05 and ARCHIVED. No active milestone.
**Phase:** None active.
**Plan:** None active.
**Status:** Ready to start next milestone via `/gsd:new-milestone`.
**Last activity:** 2026-05-05 — `/gsd:complete-milestone 1.5` archived v1.5 (full ROADMAP + REQUIREMENTS + AUDIT moved to `milestones/`); PROJECT.md evolved; ROADMAP.md collapsed; MILESTONES.md updated; git tag `v1.5` created and pushed. Andrew handed off to next milestone planning.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits, 14/14 requirements at v1.5 close.

## Performance Metrics

**v1.5 final velocity:**
- 3 phases (28-30), 6 plans, ~10 tasks, 31 commits over ~2 days (`ca402a7` 2026-05-03 16:00 -0500 → `6dc91e8` 2026-05-04 19:44 -0500)
- Test suite at sign-off: 228 passing + 9 skipped (without DIRECT_URL); zero regression vs v1.4 baseline; 3 new BUFFER-06 divergence tests added
- Per-phase verifier results: 28 (5/5), 29 (5/5), 30 (5/5)
- Milestone audit: passed (14/14 reqs, 3/3 phases, 6/6 cross-phase risks, 3/3 E2E flows)
- 14/14 requirements shipped (100%)

**Reference velocities:** v1.4: 3 phases / 8 plans / 50 commits / 2 days. v1.3: 3 phases / 6 plans / 34 commits / same-day. v1.2: 8 phases / 22 plans / 91 commits / 3 days. v1.1: 6 phases / 34 plans / 135 commits / 3 days. v1.0: 9 phases / 52 plans / 222 commits / 10 days.

## Accumulated Context

### Patterns established / locked through v1.5 (cumulative — see PROJECT.md Key Decisions for full table)

- **Race-safety at the DB layer** (v1.0 → reinforced v1.4 EXCLUDE GIST + half-open `[)` bound)
- **Two-step DROP migration deploy protocol (CP-03)** (v1.2 → reused v1.5 with formal drain-waiver pattern for zero-traffic single-tenant)
- **`echo | npx supabase db query --linked -f`** as canonical migration apply path (v1.1 → unchanged through v1.5)
- **Per-instance className override for shared shadcn components** (v1.3 → 4th-milestone reuse pattern)
- **Static-text scan tests for control-flow invariants** (v1.4 Phase 26+27 → reusable for any source-shape regression class)
- **Pre-flight diagnostic hard gate before VALIDATE-CONSTRAINT-aborting DDL (V14-CP-06)** (v1.4 → reusable for any partial-WHERE migration)
- **Deploy-and-eyeball as canonical production gate** (v1.3 formalized → 5 consecutive milestones; marathon QA fully retired)
- **Verification-only plan pattern with Andrew-quote-on-record SUMMARY** (v1.4 Plan 28-03 → reused v1.5 Plan 30-02 with single-phrase blanket approval sub-pattern)
- **Mid-execution Rule 4 architectural-decision pattern** (v1.5 Plan 30-01 first use; new — surface unanticipated importer of "to-be-deleted" file as Rule 4 routing)
- **Smallest-diff override of plan-locked refactor moves** (v1.5 Plan 30-01; new — when amendment changes underlying assumption, pick smallest-diff path not plan-locked literal text)
- **Drain-waiver pattern** (v1.5 Plan 28-02; new — formal CP-03 30-min skip under documented zero-traffic acceptance + Andrew sign-off)
- **Single grid owner UI pattern** (v1.5 Plan 30-01; new — parent shell owns grid template, children are direct grid children, no nested grids)
- **Reserved-column conditional-mount pattern** (v1.5 Plan 30-01; new — fixed-width track with `<div>` placeholder swapping to mounted form, zero layout shift, V15-MP-05 Turnstile lifecycle preserved)
- **LD-lock deliberate-override pattern** (v1.5 LD-07; new — narrow auditable carve-out re-stated CONTEXT → PLAN → SUMMARY)
- **Three-gate verification block for copy phases** (v1.5 Phase 29; new — canonical / ROADMAP-verbatim / booker-neutrality)

### Active blockers

None. v1.5 milestone closed and archived. Next milestone scope undefined.

### Open tech debt (carried into v1.6+)

**Introduced in v1.5 (3 items):**
- `slot-picker.tsx` kept on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — full date+slot UI now duplicated across `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is itself redesigned (preferred fix: extract shared `<CalendarSlotPicker>` component).
- Slot-fetch effect duplication: `booking-shell.tsx:68-96` and `slot-picker.tsx:51-79` near-identical. Future changes (pagination, retry, cache headers) must be applied in two places until slot-picker.tsx is deleted.
- `Slot` type import asymmetry: `booking-shell.tsx:8` imports `type Slot` from `./slot-picker` even though component no longer used here. Natural home is `lib/slots.types.ts`. Two `Slot` type sources with slightly different shapes; tidy when slot-picker.tsx is deleted.

**Pre-existing (carried through v1.5 unchanged):**
- 33 pre-existing tsc errors in `tests/` (test mock helpers `__setTurnstileResult`, `__mockSendCalls`, etc. — not exported from their modules). Predates v1.5. Address as separate cleanup pass.
- `tests/slot-generation.test.ts:31` JSDoc historical reference to `buffer_minutes` (descriptive prose; not live code; outside grep gate scope of `app/+lib/`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — orthogonal to v1.5; survived all 6 v1.5 plans + milestone archive without ever being staged. Decide commit/revert at v1.6 plan time.

**Carryover backlog from v1.0–v1.4 (NOT executed in v1.5):**
- Marathon QA execution — formally retired as deploy-and-eyeball model (5th consecutive milestone)
- INFRA-01: Resend migration (Gmail SMTP 200/day cap; ~$10/mo for 5k emails)
- INFRA-02: Vercel Pro hourly cron flip (`vercel.json` `0 * * * *`)
- AUTH-23: OAuth signup
- AUTH-24: Magic-link login
- BRAND-22: NSI brand asset replacement (`public/nsi-mark.png` placeholder)
- DEBT-01..07 (7 items from v1.0–v1.2 carryover)
- 3 Phase 26 audit fragilities: `bookings-table.tsx:37` unguarded TZDate; `queries.ts:92-94` undefined normalization; `queries.ts:86` unguarded throw

**Future feature backlog from v1.5 (NOT executed in v1.5):**
- BUFFER-07: pre-event buffer wiring (`buffer_before_minutes` schema column already exists at default 0)
- BUFFER-08: owner sees "15 min buffer" badge on event-type list card
- BUFFER-09: configurable buffer step granularity (1-min instead of 5-min)
- BOOKER-06: animated form slide-in (CSS translate-x transition on slot pick)
- BOOKER-07: skeleton loader on slow `/api/slots` response

## Session Continuity

**Last session:** 2026-05-05 — `/gsd:execute-phase 30` resumed Plan 30-02 from prior pause; Andrew approved with blanket "Everything looks good"; continuation agent wrote SUMMARY + commit `3118d68`; orchestrator updated ROADMAP/STATE/REQUIREMENTS + verifier 5/5; phase commit `6dc91e8`. Then `/gsd:audit-milestone` produced `v1.5-MILESTONE-AUDIT.md` (passed). Then `/gsd:complete-milestone 1.5` archived v1.5 — created `milestones/v1.5-ROADMAP.md` + `milestones/v1.5-REQUIREMENTS.md`; moved `v1.5-MILESTONE-AUDIT.md` to `milestones/`; deleted `REQUIREMENTS.md`; updated PROJECT.md / MILESTONES.md / ROADMAP.md / STATE.md; created git tag `v1.5`; committed milestone-close artifacts; pushed.

**Stopped at:** Milestone-archive-complete. No active work; awaiting next milestone scope from Andrew.

**Next session:** Run `/gsd:new-milestone` to begin questioning → research → requirements → roadmap for the next milestone. Live-use feedback during the v1.5 → next-milestone interval will likely drive headline scope (pattern: same as v1.3 → v1.4 and v1.4 → v1.5 transitions).

**Files of record (post-archive):**
- `.planning/PROJECT.md` — what + why (updated 2026-05-05; v1.5 requirements in Validated section; v1.5 Key Decisions added)
- `.planning/ROADMAP.md` — milestone index (v1.5 collapsed to one-line summary linking to archive)
- `.planning/MILESTONES.md` — historical record (v1.5 entry at top of file)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.5-ROADMAP.md` — full v1.5 phase + plan archive
- `.planning/milestones/v1.5-REQUIREMENTS.md` — v1.5 requirements with traceability
- `.planning/milestones/v1.5-MILESTONE-AUDIT.md` — cross-phase integration + E2E audit (passed)
- `.planning/phases/28-per-event-type-buffer-and-column-drop/`, `29-audience-rebrand/`, `30-public-booker-3-column-layout/` — raw execution history (NOT deleted; phase directories accumulate across milestones)
