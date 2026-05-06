# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-06 — v1.6 Day-of-Disruption Tools milestone archived. MILESTONES.md, PROJECT.md, ROADMAP.md, STATE.md updated. Archives: `milestones/v1.6-ROADMAP.md` + `milestones/v1.6-REQUIREMENTS.md`. REQUIREMENTS.md deleted. Git tag v1.6 created and pushed.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-06 after v1.6 milestone)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** Planning next milestone. All milestones through v1.6 shipped and archived. Run `/gsd:new-milestone` to define v1.7.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools — COMPLETE and ARCHIVED
**Phase:** All phases (31-33) shipped and verified. Next phase: undefined (start with `/gsd:new-milestone`)
**Plan:** N/A — no active plan
**Status:** Milestone archived. Ready to plan v1.7.
**Last activity:** 2026-05-06 — v1.6 milestone complete. `chore: complete v1.6 milestone` commit + git tag `v1.6` pushed.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans, 53 commits, shipped 2026-05-06 — ~2 days)
```

**Total shipped:** 7 milestones archived (v1.0–v1.6), 33 phases, 138 plans, ~563 commits

## Accumulated Context

### Patterns established / locked through v1.6

See PROJECT.md Key Decisions for full table. Key ones relevant to v1.7:

- **Refuse-send fail-closed (Phase 31)** — all 7 email senders now go through `checkAndConsumeQuota()`; v1.1 carve-out permanently removed. `getRemainingDailyQuota()` available for batch pre-flights. Inline quota error UX vocabulary locked: `text-sm text-red-600` + `role="alert"`.
- **MINUS semantics for date overrides (Phase 32)** — `windowsForDate()` in `lib/slots.ts` returns weekly-base MINUS unavailable windows. `subtractWindows()` exported as reusable pure helper. All legacy custom_hours rows wiped.
- **ABORT-on-diverge for cascade operations (Phase 33)** — when operation's correctness depends on ordering (cascade math), abort on any ID set difference rather than union. Contrasts with Phase 32's union approach for set operations where ordering doesn't matter.
- **`skipOwnerEmail`/`actor` owner-batch pattern** — symmetric across `cancelBooking` + `rescheduleBooking` + their respective email orchestrators. Quota math = N (not 2N) with `skipOwnerEmail=true`.
- **`firstNameOf(fullName)` render helper** — first name derived at render time; not stored in DB. Pattern for all future surfaces needing first-name-only display.
- **Planner discipline: grep migrations before naming DB columns in plan bodies** — `booker_first_name` invented column caused silent runtime failure (fixed commit `bba0e18`).
- **Vitest `resolve.alias` array/regex exact-match** — `find: /^@\/lib\/email-sender$/` prevents alias prefix-bleed to sub-paths. Locked in `vitest.config.ts`.
- **PUSH-10 reason callout pattern** — `actor='owner' && reason non-empty` → apology + "Reason:" block in booker template. Mirrored in cancel and reschedule lifecycles. LD-07 preserved.
- **Deploy-and-eyeball as canonical production gate** — 6th consecutive milestone with no marathon QA. Pattern is the operating model.

### Open tech debt (carried into v1.7)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted.
- Pre-existing TS errors in test-mock files (9 files) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. `tests/bookings-api.test.ts` one failing test (fixture mismatch vs quota-gated production code). 30/31 test files green.
- `oldEndAt` placeholder in `retryPushbackEmailAction` = `input.oldStartAt` — safe today (`sendOwner:false`); thread properly if owner retry leg ever activates.

### v1.7 carryover backlog (no scope commitment yet)

INFRA-01 (Resend migration), INFRA-02 (Vercel Pro hourly cron), AUTH-23 (OAuth), AUTH-24 (magic-link), BRAND-22 (NSI brand asset), DEBT-01..08, BUFFER-07/08/09, BOOKER-06/07, EMAIL-26/27 (per-account Gmail / Resend). Live-use feedback on inverse overrides and pushback will drive v1.7 scope.

## Session Continuity

**Last session:** 2026-05-06 — v1.6 milestone archived. All planning artifacts updated. git tag `v1.6` created and pushed. `chore: complete v1.6 milestone` commit pushed to main.

**Stopped at:** Milestone archive complete.

**Next session:** Run `/gsd:new-milestone` to plan v1.7. `/clear` first for a fresh context window.

**Files of record:**
- `.planning/PROJECT.md` — updated 2026-05-06 after v1.6
- `.planning/ROADMAP.md` — v1.6 collapsed to `<details>` block; all milestones v1.0-v1.6 shown
- `.planning/MILESTONES.md` — v1.6 entry prepended (reverse-chrono)
- `.planning/STATE.md` — this file
- `.planning/milestones/v1.6-ROADMAP.md` — full phase 31-33 details archive
- `.planning/milestones/v1.6-REQUIREMENTS.md` — all 25 v1.6 requirements archived as Complete
- `.planning/phases/31-email-hard-cap-guard/31-0{1,2,3}-SUMMARY.md` — Phase 31 plan outcomes
- `.planning/phases/32-inverse-date-overrides/32-0{1,2,3}-SUMMARY.md` — Phase 32 plan outcomes
- `.planning/phases/33-day-level-pushback-cascade/33-0{1,2,3,4}-SUMMARY.md` — Phase 33 plan outcomes
