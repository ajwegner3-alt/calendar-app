# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-05 — Phase 33 Plan 03 (Commit Path) complete. rescheduleBooking skipOwnerEmail/actor extensions, sendRescheduleEmails sendOwner gate, commitPushbackAction with ABORT-on-diverge + per-booking result rows, dialog Confirm wired end-to-end. Pushed to main. Plan 33-04 (summary rendering + retry) is next.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — Phase 33: Day-Level Pushback Cascade (Phases 31 + 32 now live as foundations)

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** 33 of 33 — Day-Level Pushback Cascade (Plan 33-03 complete)
**Plan:** 03 of 4 complete — Plan 33-04 remains
**Status:** Plan 33-03 finalized. commitPushbackAction + rescheduleBooking extensions + dialog Confirm wired + pushed to main. Plan 33-04 (summary rendering + retryPushbackEmailAction) is next.
**Last activity:** 2026-05-05 — Plan 33-03 executed (Tasks 1+2+3 committed: 5c96a9c, f31b064, 18577de). Pushed to main.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [.] Day-of-Disruption Tools      (Phases 31-33 — Phases 31 + 32 verified 2026-05-05; Phase 33 not yet started — final phase of v1.6)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits + Phase 31 (8 task commits + 3 metadata) + Plan 32-01 (3 task commits + 1 metadata) + Plan 32-03 (3 task commits + 1 metadata) + Plan 32-02 (2 task commits + 1 metadata = 3 new commits) = 22 new commits in v1.6 so far.

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

None. All 3 Phase 32 plans shipped and human-verified. Phase 32 verifier (`/gsd:verify-phase 32`) is the next gate. Phase 33 (Day-of-Pushback) is unblocked once Phase 32 verifier passes; the canonical "preview-then-commit with HARD quota gate" pattern (previewAffectedBookingsAction + commitInverseOverrideAction + Phase 31 inline-error UX) is now ready to be mirrored for the EMAIL-22 PUSH batch quota pre-flight UI.

### Plan 32-01 decisions (accumulated context)

- **Wipe (Option B) over `semantics_v2` column (Option A)** — Production diagnostic confirmed exactly 3 legacy `is_closed=false` rows. Wipe is simpler than CP-03 dual-read; no schema column changes triggered. Migration `20260505120000_phase32_wipe_legacy_custom_hours.sql`.
- **Phase 32 MINUS semantics locked into `lib/slots.ts`** — `is_closed=true` → null (full block); `is_closed=false` rows → `subtractWindows(weekly base, unavailable windows)`; if MINUS yields empty, return null. Closed-weekday no-op behavior: an unavailable window cannot open a day with no weekly rules (deliberate divergence vs pre-Phase-32).
- **`subtractWindows()` exported and reusable** — Phases 32-02 and 32-03 (and any future planner that needs interval subtraction) can import from `@/lib/slots` rather than re-implementing.

### Plan 32-03 decisions (accumulated context)

- **`skipOwnerEmail` flag plumbed `cancelBooking` → `sendCancelEmails`** — owner-initiated batch cancels (Plan 32-03 + future Phase 33 pushback) suppress N duplicate owner notifications; booker leg unconditional (LD-07 preserved).
- **Quota math = `affectedBookingIds.length`** — with `skipOwnerEmail=true` each `cancelBooking()` sends 1 email (booker only), so `needed = N` matches actual send volume. Documented inline in `actions-batch-cancel.ts`.
- **Race-safety pattern: write → re-query → union** — override rows written first (slot engine starts blocking new bookings), then `getAffectedBookings()` re-queried, then UNION'd with the preview-approved IDs. No booking missed even if a race-window booking landed between preview and commit.
- **Vitest `resolve.alias` array+regex form** — exact-match for `@/lib/email-sender` so sub-paths (`@/lib/email-sender/quota-guard`, `@/lib/email-sender/types`) pass through. Side-effect: 5+ previously-broken tech-debt test files now load and mostly pass.

### Plan 32-02 decisions (accumulated context)

- **Discriminator rename `custom_hours` → `unavailable` end-to-end.** Schema, types, modal state literal, and action branch labels all use the new label. DB row shape unchanged (still `is_closed=false` + `start_minute`/`end_minute` per window). Plan 32-01's wipe migration cleared the only legacy rows so the rename is safe.
- **Block-entire-day toggle is hide+preserve, not wipe.** Owners can experiment with the mode flip without losing the windows they've entered. Implemented by gating the windows-list render on `mode === "unavailable"` while keeping `windows` state untouched on toggle (CONTEXT.md "safer default").
- **`previewAffectedBookingsAction` placed in `actions-batch-cancel.ts` alongside `commitInverseOverrideAction`.** Both are UI-facing server actions that share auth + the `isFullDayBlock`-vs-windows discriminated input shape. Plan 32-03 deliberately deferred this helper to 32-02 because its return shape is UI-driven.
- **Fast path retained via `upsertDateOverrideAction`.** When the preview returns `affected.length === 0`, the modal bypasses the slow path entirely and calls `upsertDateOverrideAction` directly — preserving snappy UX for the common case of blocking a future date with no bookings.
- **`accountTimezone` threaded from server loader, not derived in the browser.** Booker time ranges in the preview are formatted via `Intl.DateTimeFormat` with the account's IANA zone, not the browser's local zone — owners always see times the way bookers received them.
- **Phase 31 inline quota error UX reused verbatim.** `text-sm text-red-600`, `role="alert"`, copy: "X email(s) needed, Y remaining today. Quota resets at UTC midnight. Wait until tomorrow or contact bookers manually." — locks the EMAIL-22/EMAIL-23 visual vocabulary across the v1.6 surfaces.

### Plan 33-02 decisions (accumulated context)

- **Pure cascade module API locked:** `computeCascadePreview(args: ComputeCascadeArgs): CascadeRow[]` — zero I/O, zero Supabase. `snapToNextSlotMs`, `isPastEod`, `countMoved` helpers exported. All types from `lib/bookings/pushback.ts`.
- **1440 sentinel for no-rules days (OQ-5):** `getEndOfDayMinute` returns `1440` when `windowsForDate` returns null or empty. `isPastEod` short-circuits immediately — no PAST_EOD badges on days with no availability rules.
- **Per-booking slot step (OQ-2):** `snapToNextSlotMs` called with each booking's own `duration_minutes`. 30-min bookings snap to 30-min boundaries; 60-min bookings to 60-min boundaries. Not a shared account-wide step.
- **Quota math = `movedBookings.length` NOT x2:** `skipOwnerEmail=true` on commit (Plan 32-03 decision) means 1 email per moved booking. `countMoved(rows)` directly equals `emailsNeeded`. Locked in `previewPushbackAction` and documented inline.
- **Phase 31 quota error markup VERBATIM reused:** `text-sm text-red-600` + `role="alert"` + exact copy. Source: `override-modal.tsx` lines 426-432. Replicated at `pushback-dialog.tsx` lines 331-337. EMAIL-22 visual vocabulary locked.
- **booker_name column fix (critical lesson):** Plan text invented non-existent column `booker_first_name`. Real column is `booker_name` (full name, v1.0). Caused silent runtime failure — empty anchor list on live test. Fixed in commit `bba0e18` by orchestrator mid-checkpoint. **Future planning must grep migrations before naming DB fields.**
- **`firstNameOf(fullName)` render helper:** First name derived at render time by splitting `booker_name` on whitespace. Not stored separately in DB. Pattern to reuse in 33-03/33-04 surfaces.
- **Scenario (d) absorb-then-move skipped:** Valid non-overlapping absorb-then-move not constructible in 30-min slot grids without booking overlap. Pre-authorized skip in plan text. Scenarios (b)+(c) cover the same algorithm branches.

### Plan 33-03 decisions (accumulated context)

- **ABORT-on-diverge (NOT union):** Phase 32's commitInverseOverrideAction unions the preview IDs with re-queried IDs. Phase 33 ABORTS — cascade math is order-dependent; any addition or removal on the day invalidates all computed new times. Returns `{ ok: false, diverged: true, message }`. No partial commits.
- **rescheduleBooking() returns discriminated union — never throws on DB failure:** DB failures are `{ ok: false, reason: "slot_taken" | "not_active" | ... }` — not throws. Email failures surface as `emailFailed?: "quota" | "send"` on the `ok: true` branch. The commit loop checks `rescheduleResult.ok` rather than try/catch. Critical to understand for 33-04 retry logic.
- **reason text not in reschedule email (PUSH-10 partial):** `RescheduleBookingArgs` has no `reason` field and the template has no reason block. Reason is captured in `CommitPushbackInput` for owner context but not surfaced in the booker email. Tech debt deferred.
- **CommitPushbackResultRow uses booker_name (full name):** Consistent with DB column lock and Plan 33-02 pattern. `firstNameOf()` helper at render time.
- **ABSORBED → status='skipped' in result rows:** Complete summary coverage for 33-04 — every booking on the day appears in commitRows with an appropriate status badge, not just moved ones.
- **skipOwnerEmail/actor pattern mirrored from Phase 32:** `RescheduleBookingArgs.skipOwnerEmail?` + `actor?` exactly parallels Phase 32's `CancelBookingArgs.skipOwnerEmail` + `actor` (already had actor). `SendRescheduleEmailsArgs.sendOwner?` mirrors `SendCancelEmailsArgs.sendOwner?`. Canonical pattern for owner-batch email suppression established across both cancel and reschedule lifecycles.

### Open tech debt (carried into v1.6)

- `slot-picker.tsx` on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — date+slot UI duplicated in `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is redesigned (extract shared `<CalendarSlotPicker>`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — still uncommitted, untouched during Plan 32-02 (filed under "decide later"). Stage/revert decision deferred again.
- `app/globals.css` `@source not "../.planning"` correction — orchestrator-level fix introduced during Plan 32-02 execution to keep Tailwind's source-glob from scanning the planning tree. Intentionally NOT bundled into Plan 32-02's metadata commit; the orchestrator commits it separately as a phase-level fix.
- Pre-existing TS errors in test-mock files (`tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/cross-event-overlap.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts`, `tests/send-reminder-for-booking.test.ts`) referencing removed `__mockSendCalls` / `__setTurnstileResult` helpers. Plan 32-03's vitest alias fix (`d05dd88`) unblocked module resolution for several of these — most now load and pass; `tests/bookings-api.test.ts` "(a)" case still fails on a fixture mismatch (`__mockSendCalls.length >= 1` against quota-gated production code that needs per-test guard setup the broken mock never provides). Resolution deferred to a future cleanup pass.

## Session Continuity

**Last session:** 2026-05-05 — Plan 33-03 complete. Tasks 1+2+3 committed (5c96a9c, f31b064, 18577de). rescheduleBooking skipOwnerEmail/actor extensions, sendRescheduleEmails sendOwner gate, commitPushbackAction with ABORT-on-diverge + per-booking result rows, dialog Confirm wired end-to-end + pushed to main.

**Stopped at:** Plan 33-03 complete. Plan 33-04 is next (summary rendering + retryPushbackEmailAction).

**Next session:** Execute Plan 33-04 (summary rendering + retry). commitRows: CommitPushbackResultRow[] in dialog state is the data source. 33-04 replaces the JSON debug dump in summary state with styled per-row badges. retryPushbackEmailAction handles email_failed row re-sends.

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
- `10715d6` — docs(32-03): complete server-actions + batch-cancel plan

**Plan 32-02 commits:**
- `7913349` — feat(32-02): rename schema + types from custom_hours to unavailable
- `7ea8292` — feat(32-02): override modal rewrite — unavailable windows + preview + quota gate
- (metadata commit appended at this session close)

**Plan 33-01 commits:**
- `89b10b1` — feat(33-01): add getBookingsForPushback query + accountTimezone wiring
- `760a345` — feat(33-01): PushbackDialog shell — date picker, anchor radios, delay input, reason textarea
- `86192c6` — feat(33-01): PushbackDialogProvider + day-grouped view + page mount

**Plan 33-02 commits (complete + human-verified):**
- `9020fe5` — feat(33-02): pure cascade module + getEndOfDayMinute + unit tests
- `9220802` — feat(33-02): previewPushbackAction + cascade preview render with quota gate
- `bba0e18` — fix(33-02): use bookings.booker_name (not invented booker_first_name) [orchestrator correction]
- (metadata commit — docs(33-02): complete cascade preview plan)

**Plan 33-03 commits (complete):**
- `5c96a9c` — feat(33-03): extend rescheduleBooking with skipOwnerEmail + actor params
- `f31b064` — feat(33-03): commitPushbackAction with abort-on-diverge race safety + per-row failure shape
- `18577de` — feat(33-03): wire dialog Confirm to commitPushbackAction; transition to summary
- (metadata commit — docs(33-03): complete commit-path plan)

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
- `.planning/phases/32-inverse-date-overrides/32-02-SUMMARY.md` — Plan 32-02 outcomes
- `.planning/phases/32-inverse-date-overrides/32-03-SUMMARY.md` — Plan 32-03 outcomes
- `.planning/phases/33-day-level-pushback-cascade/33-01-SUMMARY.md` — Plan 33-01 outcomes
- `.planning/phases/33-day-level-pushback-cascade/33-02-SUMMARY.md` — Plan 33-02 outcomes (complete + human-verified)
- `.planning/phases/33-day-level-pushback-cascade/33-03-SUMMARY.md` — Plan 33-03 outcomes (complete)
