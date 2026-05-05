# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-04 — v1.6 roadmap created (Phases 31-33). Ready to begin Phase 31.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 31: Email Hard Cap Guard (first phase; foundation for Phases 32 + 33)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 31 of 33 — Email Hard Cap Guard
**Plan:** — (not started)
**Status:** Roadmap created. Ready to plan Phase 31.
**Last activity:** 2026-05-04 — REQUIREMENTS.md written, ROADMAP.md written (Phases 31-33), STATE.md updated. Traceability filled.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [ ] Day-of-Disruption Tools      (Phases 31-33 — roadmap created; Phase 31 ready to plan)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits. v1.6 continues from Phase 31.

## Accumulated Context

### Patterns established / locked through v1.5

See PROJECT.md Key Decisions for full table. Key ones relevant to v1.6:

- **CP-03 two-step DROP protocol** — not expected for v1.6 (no column drops planned); if a schema flip on `date_overrides` is needed, follow CP-03.
- **Pre-flight hard-gate checkpoint (V14-CP-06)** — apply before any VALIDATE-CONSTRAINT-aborting DDL in Phase 32 schema work.
- **Deploy-and-eyeball as canonical production gate** — 5 consecutive milestones; no marathon QA.
- **LD-07 booker-neutrality lock** — pushback emails (Phase 33) must stay audience-neutral on booker-facing surfaces.
- **Race-safety at DB layer** — Phase 33 pushback commit must preserve v1.4 EXCLUDE GIST + v1.1 capacity index on new times.
- **`echo | npx supabase db query --linked -f`** — canonical migration apply path (unchanged through v1.5).

### v1.6 cross-phase dependency chain

- Phase 31 must ship before Phase 32 and Phase 33.
- EMAIL-23 (AVAIL auto-cancel quota pre-flight UI) ships inside Phase 32 but depends on Phase 31 guard.
- EMAIL-22 (PUSH batch quota pre-flight UI) ships inside Phase 33 but depends on Phase 31 guard.
- PUSH-09 (reschedule lifecycle reuse) depends on existing v1.0 + v1.4 reschedule infra — no new dep, just reuse.

### Active blockers

None. Roadmap created; Phase 31 is ready to plan.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — decide commit/revert at Phase 31 plan time.

## Session Continuity

**Last session:** 2026-05-04 — `/gsd:new-milestone` complete through roadmap phase. REQUIREMENTS.md written, ROADMAP.md updated, STATE.md updated.

**Stopped at:** Roadmap created, traceability filled. Ready for `/gsd:plan-phase 31`.

**Next session:** Run `/gsd:plan-phase 31` to plan Phase 31: Email Hard Cap Guard.

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/ROADMAP.md` — phases 31-33 defined
- `.planning/REQUIREMENTS.md` — 25 v1.6 requirements with traceability
- `.planning/STATE.md` — this file
- `.planning/MILESTONES.md` — historical record (v1.6 entry created at milestone close)
