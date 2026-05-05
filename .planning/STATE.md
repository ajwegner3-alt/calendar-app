# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — Phase 31 (Email Hard Cap Guard) complete + Andrew live verification approved. Ready for Phase 32.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 32: Inverse Date Overrides (Phase 31 guard now live as foundation for Phases 32 + 33)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 32 of 33 — Inverse Date Overrides (Phase 31 complete + verified)
**Plan:** — (not started)
**Status:** Phase 31 verified (status: human_needed → Andrew approved 2026-05-05). REQUIREMENTS.md EMAIL-21/24/25 marked Complete. ROADMAP.md updated. Ready to plan Phase 32.
**Last activity:** 2026-05-05 — Phase 31 closed: 4/4 must-haves + 4/4 ROADMAP success criteria structurally verified by gsd-verifier; 6 live runtime checks passed by Andrew (manual reminder inline error, differentiated cancel toast, save-and-flag booker confirmation, /app/bookings banner self-suppression, cron mid-batch quota_refused counter, booker reschedule generic copy). 10 commits this phase (`ab3ceb2` through `035f779`). VERIFICATION.md created. Pre-existing M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md drift carried forward — still unresolved.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [.] Day-of-Disruption Tools      (Phases 31-33 — Phase 31 complete + verified 2026-05-05; Phase 32 next)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits + Plans 31-01 + 31-02 + 31-03 (8 task commits + 3 metadata = 11 new commits in v1.6 so far).

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

None. Phase 31 is feature-complete (all 3 plans shipped). Next step: `/gsd:verify-phase 31` to confirm production readiness, then unblock Phase 32 (auto-cancel batch) and Phase 33 (pushback batch) — both depend on Phase 31's `getRemainingDailyQuota()` for batch pre-flight, and the inline-error / save-and-flag UX patterns from Plan 31-03.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted, untouched during Plan 31-01 (filed under "decide later"). Stage/revert decision deferred again.
- Pre-existing TS errors in test-mock files (`tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/cross-event-overlap.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`, `tests/send-reminder-for-booking.test.ts`) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. Confirmed unrelated to Phase 31 (verified by stashing Plan 31-03 changes — same files fail at HEAD~3 too). Plan 31-03 followed the `tests/quota-guard.test.ts` `vi.mock` pattern in the new `tests/email-quota-refuse.test.ts` to avoid touching the broken files. Resolution deferred to a future cleanup pass.

## Session Continuity

**Last session:** 2026-05-05 — `/gsd:execute-phase 31` ran all 3 plans through 3 sequential waves, then verifier returned `human_needed`. Andrew live-verified the 6 checkpoints (inline reminder error, differentiated cancel toast, save-and-flag booker confirmation, /app/bookings banner self-suppression, cron mid-batch quota_refused counter, booker reschedule generic copy) and approved. REQUIREMENTS.md EMAIL-21/24/25 → Complete. ROADMAP.md Phase 31 → ✅ Complete 2026-05-05.

**Stopped at:** Phase 31 closed. Ready for Phase 32 (Inverse Date Overrides).

**Next session:** Run `/gsd:discuss-phase 32` (or `/gsd:plan-phase 32` to skip discussion) to begin Phase 32 — slot engine MINUS-semantics, date-override editor UI, auto-cancel lifecycle with quota pre-flight (uses Phase 31 `getRemainingDailyQuota`).

**Plan 31-01 commits:**
- `ab3ceb2` — feat(31-01): add Phase 31 email_send_log + bookings migrations
- `ac886ca` — feat(31-01): extend quota-guard with booking categories + helpers
- `42f3c9d` — docs(31-01): complete foundation plan

**Plan 31-02 commits:**
- `7348bc1` — feat(31-02): wire all 7 email senders through quota guard
- `0de8dab` — feat(31-02): route quota errors to save-and-flag, await, cron, manual
- `5b824dc` — docs(31-02): complete sender wiring plan

**Plan 31-03 commits:**
- `38f5688` — feat(31-03): inline reminder quota error + differentiated cancel toast
- `0dc55e5` — feat(31-03): add unsent-confirmations dashboard banner + count query
- `2f53f7e` — test(31-03): refuse-send coverage + 80% warn regression
- (metadata commit appended at session close)

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/ROADMAP.md` — phases 31-33 defined
- `.planning/REQUIREMENTS.md` — 25 v1.6 requirements with traceability
- `.planning/STATE.md` — this file
- `.planning/MILESTONES.md` — historical record (v1.6 entry created at milestone close)
- `.planning/phases/31-email-hard-cap-guard/31-01-SUMMARY.md` — Plan 31-01 outcomes
- `.planning/phases/31-email-hard-cap-guard/31-02-SUMMARY.md` — Plan 31-02 outcomes
- `.planning/phases/31-email-hard-cap-guard/31-03-SUMMARY.md` — Plan 31-03 outcomes
