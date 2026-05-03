# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-03 — **Phase 26 complete.** All 3 plans done; Andrew sign-off received. Phase 27 next.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-02 after v1.4 milestone start)

**Core value:** A visitor lands on a contractor's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.4 Slot Correctness + Polish — Phase 26 complete. Fix deployed (RSC onClick deletion), cross-account verification passed (Andrew sign-off 2026-05-03). Phase 27 (Slot Correctness DB-Layer Enforcement) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.4 Slot Correctness + Polish (active).
**Phase:** 26 — COMPLETE.
**Plan:** 03 of 3 — COMPLETE. Phase 26 done.
**Status:** Phase 26 complete. Andrew sign-off 2026-05-03. Phase 27 ready to execute.
**Last activity:** 2026-05-03 — Phase 26 complete. Cross-account verification passed. Commits `8e3116b`, `359f4f1`, `c33d0ef`, planning docs committed.

**Phase queue:**
- ~~Phase 25: Surgical Polish (AUTH-21, AUTH-22, OWNER-14, OWNER-15)~~ — COMPLETE 2026-05-03
- ~~Phase 26: Bookings Page Crash Debug + Fix (BOOK-01, BOOK-02)~~ — COMPLETE 2026-05-03
- Phase 27: Slot Correctness DB-Layer Enforcement (SLOT-01..05) — independent, highest risk

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [ ] Slot Correctness + Polish    (Phases 25-27, TBD plans, active — 2 of 3 phases complete)
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
- **RSC boundary violations are a real failure class** — function props on intrinsic HTML elements in Server Components crash before render with digest. Use static structural tests to prevent regression (see `tests/bookings-table-rsc-boundary.test.ts` pattern).

### Active blockers

None. Phase 26 complete. Phase 27 (Slot Correctness DB-Layer Enforcement) ready to execute.

### Decisions from Phase 26 (26-01 + 26-02 + 26-03)

- **RSC boundary violation confirmed as root cause** — `bookings-table.tsx:93` had `onClick` on a Server Component `<a>` element. Fix: 1-line deletion. Not Candidates A-E (data-layer hypotheses). Deployed to Vercel 2026-05-03.
- **Regression test: Option 1 (static text scan)** — reads source file as fs text, regex-asserts no `onClick=` in tel: anchor block. Zero new dependencies. Fails if onClick re-introduced; updates required if component converts to "use client".
- **Deferred fragilities for Phase 27** — unguarded `TZDate` at `bookings-table.tsx:37` (Candidate C), normalization `undefined` at `queries.ts:92-94` (Candidate B), unguarded throw at `queries.ts:86` (Candidate A). All safe today; flagged for future hardening.
- **!inner audit DOCUMENT-RISK** — `load-month-bookings.ts:47` uses optional-chain only (no normalization); safe for current callers. Flag if future callers access `event_types.account_id` without `?.`.
- **Cross-account verification: shape-waiver protocol** — shapes with 0 production rows are waived with documented rationale, not silently skipped. 4 live shapes passed; 3 waived (Shapes 5/6/7: cancelled-only, >50 bookings, soft-deleted event_type).

## Session Continuity

**Last session:** 2026-05-03 — Completed Phase 26 (Plan 03). Cross-account verification passed. Andrew sign-off received.

**Stopped at:** Phase 26 — COMPLETE. Phase 27 ready.

**Resume:** Execute Phase 27 (Slot Correctness DB-Layer Enforcement). Start with pre-flight diagnostic SQL (V14-CP-06 hard gate) before any migration SQL.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-02 after v1.4 milestone start)
- `.planning/ROADMAP.md` — v1.0-v1.3 collapsed; v1.4 Phases 25-27 defined
- `.planning/REQUIREMENTS.md` — 11 v1.4 requirements; traceability table filled
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — all mechanism decisions locked; phase structure confirmed
- `.planning/research/PITFALLS.md` — V14-CP-01..07, V14-MP-01..06, V14-mp-01..03
- `.planning/phases/26-bookings-page-crash-debug-fix/26-SUMMARY.md` — full Phase 26 phase summary (root cause, fix, verification matrix, deferred findings)
