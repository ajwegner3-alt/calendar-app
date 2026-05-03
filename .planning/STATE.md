# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-03 — **v1.5 roadmap created.** Phases 28-30 defined; Phase 28 ready to plan.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-03 after v1.5 milestone start)

**Core value:** A visitor lands on a service-based business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.5 — Buffer Fix + Audience Rebrand + Booker Redesign. Roadmap created; ready to plan Phase 28.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.5 (started 2026-05-03).
**Phase:** Phase 28 — Per-Event-Type Buffer Wire-Up + Account Column Drop
**Plan:** — (not yet planned)
**Status:** Ready to plan.
**Last activity:** 2026-05-03 — v1.5 roadmap created (Phases 28-30, 6 plans, 14 requirements mapped).

**Phase queue (v1.5):**
- [ ] Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop (3 plans — BUFFER-01..06)
- [ ] Phase 29: Audience Rebrand (1 plan — BRAND-01..03)
- [ ] Phase 30: Public Booker 3-Column Desktop Layout (2 plans — BOOKER-01..05)

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [ ] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans planned, in progress)
```

## Performance Metrics

**v1.4 velocity (final):**
- 3 phases (25-27), 8 plans, ~17 tasks, 50 commits over ~2 days
- Test suite: 225 passing + 9 skipped (without DIRECT_URL) / ≥230 + 4 (with DIRECT_URL set)
- 11/11 requirements shipped (100%)

**Reference velocities:** v1.3: 3 phases, 6 plans, 34 commits, 1 day. v1.2: 8 phases, 22 plans, 91 commits, 3 days. v1.1: 6 phases, 34 plans, 135 commits, 3 days. v1.0: 9 phases, 52 plans, 222 commits, 10 days.

## Accumulated Context

### Critical constraints for v1.5

- **CP-03 mandatory drain (Phase 28):** Plans 28-01 and 28-02 have a 30-minute hard gate between them. Andrew must confirm 28-01's Vercel deploy has been live ≥30 min before 28-02 begins. DROP migration file held local during drain (do not push).
- **LD-01 column name lock:** Use existing `event_types.buffer_after_minutes` — do NOT add `post_buffer_minutes`. The column already exists in production with correct semantics.
- **LD-08 phase order lock:** Buffer → Rebrand → Booker. Do not reorder.
- **V15-MP-05 Turnstile lock:** Keep conditional mount pattern for `<BookingForm>` in Phase 30 (`{selectedSlot ? <BookingForm /> : <prompt>}`). Always-mounted form causes Turnstile token expiry.
- **Migration apply path:** `echo | npx supabase db query --linked -f <file>` is the only working path in this repo (`supabase db push --linked` is broken).
- **Pre-flight gate (Phase 28-01):** `SELECT id, slug, buffer_after_minutes FROM event_types WHERE buffer_after_minutes <> 0` must return 0 rows before backfill runs.
- **Drain gate (Phase 28-02):** `grep -rn "buffer_minutes" app/ lib/` must return 0 matches before DROP migration applies.

### Patterns carried forward from v1.4

- Static-text scan tests for control-flow invariants (Phase 26 + 27 pattern)
- Pre-flight diagnostic hard gate before VALIDATE-CONSTRAINT-aborting DDL (V14-CP-06)
- `describe.skipIf(skipIfNoDirectUrl)` for pg-driver tests
- Per-instance className override for shared shadcn components (Phases 23-25)
- Deploy-and-eyeball as canonical production gate (5th consecutive milestone)

### Active blockers

None. Roadmap defined. Ready to plan Phase 28.

## Session Continuity

**Last session:** 2026-05-03 — v1.5 roadmap created. ROADMAP.md extended with Phases 28-30 under v1.5 collapsible section. STATE.md updated to reflect Phase 28 as current position. REQUIREMENTS.md traceability table populated.

**Stopped at:** Roadmap complete. Phase 28 ready to plan.

**Resume:** Run `/gsd:plan-phase 28` to begin Phase 28 planning.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-03; v1.5 milestone started)
- `.planning/ROADMAP.md` — phase index (v1.5 Phases 28-30 added)
- `.planning/REQUIREMENTS.md` — 14 v1.5 requirements; traceability table populated
- `.planning/MILESTONES.md` — historical record
- `.planning/STATE.md` — this file
- `.planning/research/SUMMARY.md` — v1.5 research (9 locked decisions LD-01..09)
- `.planning/research/ARCHITECTURE.md` — file touch sites, migration sequence, component boundaries
- `.planning/research/PITFALLS.md` — V15-CP-01..11 + V15-MP-01..07 + V15-XF-01..03 catalog
- `.planning/research/STACK.md` — migration apply path, two-step deploy spec, touch-site maps
- `.planning/research/FEATURES.md` — behavioral specs for buffer, layout mockups
