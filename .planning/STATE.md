# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — Phase 31 Plan 01 complete (foundation: schema + quota-guard extensions). Ready for Plan 31-02.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 31: Email Hard Cap Guard (first phase; foundation for Phases 32 + 33)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 31 of 33 — Email Hard Cap Guard
**Plan:** 01 of TBD — Foundation (schema + quota-guard extensions) — COMPLETE
**Status:** Plan 31-01 shipped. Ready for Plan 31-02 (call-site wiring).
**Last activity:** 2026-05-05 — Plan 31-01 executed. Two migrations applied to linked Supabase (CHECK extension + bookings.confirmation_email_sent column). quota-guard.ts extended with 7 new EmailCategory values + getRemainingDailyQuota + logQuotaRefusal. Existing 80% warn block + boundary semantics unchanged. Existing tests (4/4) green.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [.] Day-of-Disruption Tools      (Phases 31-33 — Phase 31 Plan 01 of TBD complete; Plan 31-02 next)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits + Plan 31-01 (2 task commits + metadata = 3 new commits in v1.6).

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

None. Plan 31-01 complete; Plan 31-02 (call-site wiring) is next.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted, untouched during Plan 31-01 (filed under "decide later"). Stage/revert decision deferred again.
- Pre-existing TS errors in test-mock files (`tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. Surfaced during Plan 31-01 verification but unrelated to Phase 31 scope. Plan 31-02 should avoid extending those test files; if quota-guard tests need expansion, follow the existing `tests/quota-guard.test.ts` `vi.mock` pattern.

## Session Continuity

**Last session:** 2026-05-05 — Plan 31-01 executed atomically. Migrations applied + quota-guard extended. SUMMARY.md written.

**Stopped at:** Plan 31-01 complete. Ready for Plan 31-02 (call-site wiring through all 5 email-sender modules).

**Next session:** Run `/gsd:execute-phase 31` (continuation) or `/gsd:plan-phase 31` follow-up to surface Plan 31-02.

**Plan 31-01 commits:**
- `ab3ceb2` — feat(31-01): add Phase 31 email_send_log + bookings migrations
- `ac886ca` — feat(31-01): extend quota-guard with booking categories + helpers
- (metadata commit appended at session close)

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/ROADMAP.md` — phases 31-33 defined
- `.planning/REQUIREMENTS.md` — 25 v1.6 requirements with traceability
- `.planning/STATE.md` — this file
- `.planning/MILESTONES.md` — historical record (v1.6 entry created at milestone close)
- `.planning/phases/31-email-hard-cap-guard/31-01-SUMMARY.md` — Plan 31-01 outcomes
