# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — Phase 31 Plan 02 complete (sender wiring + caller routing). Ready for Plan 31-03.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 31: Email Hard Cap Guard (first phase; foundation for Phases 32 + 33)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 31 of 33 — Email Hard Cap Guard
**Plan:** 02 of TBD — Sender wiring + caller routing — COMPLETE
**Status:** Plan 31-02 shipped. Ready for Plan 31-03 (dashboard alert + manual-reminder UX inline callout).
**Last activity:** 2026-05-05 — Plan 31-02 executed. All 7 email senders now go through checkAndConsumeQuota with typed EmailCategory + logQuotaRefusal. v1.1 carve-out comment in lib/email-sender/index.ts removed. send-booking-emails.ts save-and-flag UPDATEs bookings.confirmation_email_sent=false on quota refusal. lib/bookings/cancel.ts + reschedule.ts switched from after() to await; emailFailed?: "quota" | "send" return field. Cron loop moved out of after(); response returns reminders_sent + quota_refused live counters. Manual reminder action returns locked Gmail-fallback copy + errorCode: "EMAIL_QUOTA_EXCEEDED". TS clean (0 new src/ errors). Vitest unchanged: 177 passing, 4 skipped, 8 pre-existing-broken test files unchanged.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [.] Day-of-Disruption Tools      (Phases 31-33 — Phase 31 Plans 01-02 of TBD complete; Plan 31-03 next)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits + Plans 31-01 + 31-02 (5 task commits + 2 metadata = 7 new commits in v1.6 so far).

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

None. Plans 31-01 + 31-02 complete; Plan 31-03 (dashboard alert + manual-reminder UX inline callout) is next. Plan 31-03 reads bookings.confirmation_email_sent=false (from 31-02 save-and-flag) for the dashboard alert, branches on emailFailed: "quota" (cancel/reschedule) and errorCode: "EMAIL_QUOTA_EXCEEDED" (manual reminder) for the inline Gmail-fallback callout.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted, untouched during Plan 31-01 (filed under "decide later"). Stage/revert decision deferred again.
- Pre-existing TS errors in test-mock files (`tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. Surfaced during Plan 31-01 verification but unrelated to Phase 31 scope. Plan 31-02 should avoid extending those test files; if quota-guard tests need expansion, follow the existing `tests/quota-guard.test.ts` `vi.mock` pattern.

## Session Continuity

**Last session:** 2026-05-05 — Plan 31-02 executed atomically. All 7 senders wired through quota guard; v1.1 carve-out closed; save-and-flag + after()→await + cron live counters + locked Gmail-fallback copy all in place. SUMMARY.md written.

**Stopped at:** Plan 31-02 complete. Ready for Plan 31-03 (dashboard alert + manual-reminder UX inline callout — surfaces the new flags/error codes to the owner).

**Next session:** Run `/gsd:execute-phase 31` (continuation) or `/gsd:plan-phase 31` follow-up to surface Plan 31-03.

**Plan 31-01 commits:**
- `ab3ceb2` — feat(31-01): add Phase 31 email_send_log + bookings migrations
- `ac886ca` — feat(31-01): extend quota-guard with booking categories + helpers
- `42f3c9d` — docs(31-01): complete foundation plan

**Plan 31-02 commits:**
- `7348bc1` — feat(31-02): wire all 7 email senders through quota guard
- `0de8dab` — feat(31-02): route quota errors to save-and-flag, await, cron, manual
- (metadata commit appended at session close)

**Files of record:**
- `.planning/PROJECT.md` — what + why
- `.planning/ROADMAP.md` — phases 31-33 defined
- `.planning/REQUIREMENTS.md` — 25 v1.6 requirements with traceability
- `.planning/STATE.md` — this file
- `.planning/MILESTONES.md` — historical record (v1.6 entry created at milestone close)
- `.planning/phases/31-email-hard-cap-guard/31-01-SUMMARY.md` — Plan 31-01 outcomes
- `.planning/phases/31-email-hard-cap-guard/31-02-SUMMARY.md` — Plan 31-02 outcomes
