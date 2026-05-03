# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-03 — **Phase 26 in progress.** 26-01 complete (diagnosis confirmed by Andrew). Plan 02 (fix) next.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 after v1.4 milestone start)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.4 Slot Correctness + Polish — Phase 26 Plan 01 complete. RSC boundary violation diagnosed and confirmed. Plan 02 (fix: delete onClick at bookings-table.tsx:93) ready to execute.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.4 Slot Correctness + Polish (active).
**Phase:** 26 — in progress.
**Plan:** 01 of 3 — COMPLETE. Plan 02 next.
**Status:** Plan 01 done. Ready for Plan 02 (fix).
**Last activity:** 2026-05-03 — 26-01 complete. Andrew confirmed RSC boundary violation at `bookings-table.tsx:93`. Commits `ed7eb22`, `8cbfca9`.

**Phase queue:**
- Phase 25: Surgical Polish (AUTH-21, AUTH-22, OWNER-14, OWNER-15) — UI-only, no DB risk
- Phase 26: Bookings Page Crash Debug + Fix (BOOK-01, BOOK-02) — parallel-safe with 25
- Phase 27: Slot Correctness DB-Layer Enforcement (SLOT-01..05) — independent, highest risk

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [ ] Slot Correctness + Polish    (Phases 25-27, TBD plans, active)
```

## Performance Metrics

**v1.3 velocity (final):**
- 3 phases (22-24), 6 plans, ~9 tasks, 34 commits over ~10 hours
- NET +200 LOC runtime; 22,071 LOC TS/TSX at sign-off
- Test suite: 222 passing + 4 skipped (baseline preserved from v1.2)

**Reference velocities:** v1.2: 8 phases, 22 plans, 91 commits, 3 days. v1.1: 6 phases, 34 plans, 135 commits, 3 days. v1.0: 9 phases, 52 plans, 222 commits, 10 days.

## Accumulated Context

### Key decisions carried into v1.4

- **EXCLUDE constraint mechanism locked** — `EXCLUDE USING gist (account_id WITH =, event_type_id WITH <>, during WITH &&) WHERE (status = 'confirmed')` with `btree_gist`. Option B (trigger) is fallback only. DDL live-verified against production Postgres 17.6.1 by research.
- **Pre-flight diagnostic is a hard gate** — existing cross-event overlapping confirmed bookings abort `VALIDATE CONSTRAINT`. V14-CP-06. Must run before any Phase 27 migration SQL.
- **23P01 error mapping required in two files** — `app/api/bookings/route.ts` (before 23505 branch; break retry loop) and `lib/bookings/reschedule.ts` (map to slot_taken). V14-MP-01 + V14-MP-02.
- **Per-instance className override pattern** — extends v1.3 Phases 23/24 invariant. Shared `components/ui/calendar.tsx` and `globals.css --color-accent` UNTOUCHED. Phase 25 uses instance-level overrides only.
- **Migration apply path locked** — `echo | npx supabase db query --linked -f <file>`. `supabase db push --linked` is broken in this repo.

### Active blockers

None. Phase 26 Plan 01 complete. Plan 02 (fix) is cleared to execute.

### Decisions from Phase 26 diagnosis

- **RSC boundary violation confirmed as root cause** — `bookings-table.tsx:93` has `onClick` on a Server Component `<a>` element. Fix is 1-line deletion of the `onClick` prop. Not Candidates A-E (those were data-layer hypotheses).
- **Deferred fragilities noted** — unguarded `TZDate` at `bookings-table.tsx:37` (Candidate C) and normalization undefined at `queries.ts:92-94` (Candidate B) are real but not the crash cause. Flag for Phase 27.

## Session Continuity

**Last session:** 2026-05-03 — Completed 26-01-PLAN.md. Andrew confirmed diagnosis. Plan 02 ready to execute.

**Stopped at:** Phase 26, Plan 01 — COMPLETE.

**Resume:** Execute 26-02-PLAN.md (fix: delete onClick at bookings-table.tsx:93).

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02 after v1.4 milestone start)
- `.planning/ROADMAP.md` — v1.0-v1.3 collapsed; v1.4 Phases 25-27 defined
- `.planning/REQUIREMENTS.md` — 11 v1.4 requirements; traceability table filled
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — all mechanism decisions locked; phase structure confirmed
- `.planning/research/PITFALLS.md` — V14-CP-01..07, V14-MP-01..06, V14-mp-01..03
