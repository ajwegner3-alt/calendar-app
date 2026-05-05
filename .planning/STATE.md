# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — Plan 32-03 (Server Actions + Batch Cancel) executed. Phase 32 in progress (2 of 3 plans complete; Wave 2 done).

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 32: Inverse Date Overrides (Phase 31 guard now live as foundation for Phases 32 + 33)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 32 of 33 — Inverse Date Overrides (in progress)
**Plan:** 32-03 of 3 — Server Actions + Batch Cancel (complete, 2026-05-05)
**Status:** Plans 32-01 (slot engine) + 32-03 (server actions + batch cancel) complete. Wave 2 done. Plan 32-02 (override editor UI) still pending — it consumes the now-shipped `commitInverseOverrideAction` server action and `getAffectedBookings` query helper. EMAIL-23 hard quota gate live; `skipOwnerEmail` flag plumbed end-to-end through `cancelBooking → sendCancelEmails`.
**Last activity:** 2026-05-05 — Plan 32-03 shipped: 3 atomic commits (`a001b0a` flag+query, `73c32ed` server action, `d05dd88` tests+vitest alias fix) + metadata. 9 new tests green. Vitest `resolve.alias` migrated string-prefix → array+regex form (Rule 3 - Blocking deviation); side-effect: unblocks 5+ pre-existing broken test files (30 of 31 test files now pass; pre-stash baseline was 24/31). Lone remaining failure (`bookings-api.test.ts` "(a)" case) confirmed pre-existing fixture mismatch unrelated to this plan.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [.] Day-of-Disruption Tools      (Phases 31-33 — Phase 31 verified 2026-05-05; Plans 32-01 + 32-03 complete 2026-05-05; 32-02 pending)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits + Phase 31 (8 task commits + 3 metadata) + Plan 32-01 (3 task commits + 1 metadata) + Plan 32-03 (3 task commits + 1 metadata = 4 new commits) = 19 new commits in v1.6 so far.

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

None. Plans 32-01 + 32-03 shipped. Plan 32-02 (override editor UI) is unblocked — it can now import `commitInverseOverrideAction` (server action) and `getAffectedBookings` (query helper) directly. Phase 31's `getRemainingDailyQuota()` is wired into the action as the EMAIL-23 hard gate.

### Plan 32-01 decisions (accumulated context)

- **Wipe (Option B) over `semantics_v2` column (Option A)** — Production diagnostic confirmed exactly 3 legacy `is_closed=false` rows. Wipe is simpler than CP-03 dual-read; no schema column changes triggered. Migration `20260505120000_phase32_wipe_legacy_custom_hours.sql`.
- **Phase 32 MINUS semantics locked into `lib/slots.ts`** — `is_closed=true` → null (full block); `is_closed=false` rows → `subtractWindows(weekly base, unavailable windows)`; if MINUS yields empty, return null. Closed-weekday no-op behavior: an unavailable window cannot open a day with no weekly rules (deliberate divergence vs pre-Phase-32).
- **`subtractWindows()` exported and reusable** — Phases 32-02 and 32-03 (and any future planner that needs interval subtraction) can import from `@/lib/slots` rather than re-implementing.

### Plan 32-03 decisions (accumulated context)

- **`skipOwnerEmail` flag plumbed `cancelBooking` → `sendCancelEmails`** — owner-initiated batch cancels (Plan 32-03 + future Phase 33 pushback) suppress N duplicate owner notifications; booker leg unconditional (LD-07 preserved).
- **Quota math = `affectedBookingIds.length`** — with `skipOwnerEmail=true` each `cancelBooking()` sends 1 email (booker only), so `needed = N` matches actual send volume. Documented inline in `actions-batch-cancel.ts`.
- **Race-safety pattern: write → re-query → union** — override rows written first (slot engine starts blocking new bookings), then `getAffectedBookings()` re-queried, then UNION'd with the preview-approved IDs. No booking missed even if a race-window booking landed between preview and commit.
- **Vitest `resolve.alias` array+regex form** — exact-match for `@/lib/email-sender` so sub-paths (`@/lib/email-sender/quota-guard`, `@/lib/email-sender/types`) pass through. Side-effect: 5+ previously-broken tech-debt test files now load and mostly pass.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted, untouched during Plan 31-01 (filed under "decide later"). Stage/revert decision deferred again.
- Pre-existing TS errors in test-mock files (`tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/cross-event-overlap.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`, `tests/send-reminder-for-booking.test.ts`) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. Plan 32-03's vitest alias fix (`d05dd88`) unblocked module resolution for several of these — most now load and pass; `tests/bookings-api.test.ts` "(a)" case still fails on a fixture mismatch (`__mockSendCalls.length >= 1` against quota-gated production code that needs per-test guard setup the broken mock never provides). Resolution deferred to a future cleanup pass.

## Session Continuity

**Last session:** 2026-05-05 — `/gsd:execute-phase 32` Plan 32-03 executed atomically. New server action `commitInverseOverrideAction` (HARD quota pre-flight + override write + race-safe re-query + Promise.allSettled batch cancel via `cancelBooking` with `skipOwnerEmail: true`) live at `app/(shell)/app/availability/_lib/actions-batch-cancel.ts`. New `getAffectedBookings()` query helper at `app/(shell)/app/availability/_lib/queries.ts`. 9 new tests green; 30 of 31 test files pass (up from 24/31). Vitest `resolve.alias` migrated to array+regex form (Rule 3 deviation, commit `d05dd88`).

**Stopped at:** Plan 32-03 complete. Plan 32-02 (override editor UI) is the only plan remaining in Phase 32.

**Next session:** Run `/gsd:execute-phase 32` to execute Plan 32-02 — override editor UI: rename "Custom hours" → "Add unavailable windows" mode, hide+preserve toggle behavior on "Block entire day," inline affected-bookings preview, wire to the now-shipped `commitInverseOverrideAction` server action and `getAffectedBookings` query.

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

**Plan 32-01 commits:**
- `7ac5def` — feat(32-01): wipe-and-flip migration for legacy custom_hours rows
- `8c673e6` — feat(32-01): slot engine MINUS semantics + subtractWindows helper
- `dc12ada` — test(32-01): unit tests for subtractWindows + MINUS semantics
- (metadata commit appended at session close)

**Plan 32-03 commits:**
- `a001b0a` — feat(32-03): skipOwnerEmail flag on cancelBooking + getAffectedBookings query
- `73c32ed` — feat(32-03): commitInverseOverrideAction server action with quota pre-flight
- `d05dd88` — test(32-03): batch cancel server action coverage + vitest alias fix
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
- `.planning/phases/32-inverse-date-overrides/32-01-SUMMARY.md` — Plan 32-01 outcomes
- `.planning/phases/32-inverse-date-overrides/32-03-SUMMARY.md` — Plan 32-03 outcomes
