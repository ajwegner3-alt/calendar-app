# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-04 — `/gsd:new-milestone` started **v1.6 Day-of-Disruption Tools**. Three features locked through questioning: (1) inverse-window date overrides (replace "available times" with "unavailable windows" + multi-window + full-day toggle + warn-and-auto-cancel affected bookings), (2) day-level pushback under Bookings tab (anchor booking + delay; smart cascade rule: only push when prior end exceeds next start; optional reason; owner confirmation preview; existing reschedule lifecycle for all affected including end-of-day pushes), (3) Gmail SMTP 200/day hard cap (extend existing quota guard to refuse-send fail-closed for all paths, or pre-flight-budget pushback batches). Per-account Gmail / Resend migration deferred to v1.7+ per Path A scope-lock. PROJECT.md updated with Current Milestone section + Active requirements; awaiting research decision → REQUIREMENTS.md → ROADMAP.md.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-04 after `/gsd:new-milestone` for v1.6)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.6 — defining requirements then roadmap. Three features: inverse date overrides + day-level pushback + 200/day hard cap.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.6 Day-of-Disruption Tools (started 2026-05-04 via `/gsd:new-milestone`)
**Phase:** Not started — defining requirements.
**Plan:** —
**Status:** Defining requirements (research decision pending → then REQUIREMENTS.md → then ROADMAP.md).
**Last activity:** 2026-05-04 — Andrew completed questioning, locked Path A (defer per-account Gmail to v1.7+, ship 200/day hard cap now). PROJECT.md updated with Current Milestone section.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 31 commits, shipped 2026-05-05 — ~2 days)
v1.6 [ ] Day-of-Disruption Tools      (Phases TBD — 3 features locked; phases not yet defined)
```

**Total shipped:** 6 milestones, 32 phases, 128 plans, ~510 commits. v1.6 phase numbering will continue from Phase 31.

## Accumulated Context

### Patterns established / locked through v1.5 (cumulative — see PROJECT.md Key Decisions for full table)

- **Race-safety at the DB layer** (v1.0 → reinforced v1.4 EXCLUDE GIST + half-open `[)` bound)
- **Two-step DROP migration deploy protocol (CP-03)** (v1.2 → reused v1.5 with formal drain-waiver pattern for zero-traffic single-tenant)
- **`echo | npx supabase db query --linked -f`** as canonical migration apply path (v1.1 → unchanged through v1.5)
- **Per-instance className override for shared shadcn components** (v1.3 → 4th-milestone reuse pattern)
- **Static-text scan tests for control-flow invariants** (v1.4 Phase 26+27 → reusable for any source-shape regression class)
- **Pre-flight diagnostic hard gate before VALIDATE-CONSTRAINT-aborting DDL (V14-CP-06)** (v1.4 → reusable for any partial-WHERE migration)
- **Deploy-and-eyeball as canonical production gate** (v1.3 formalized → 5 consecutive milestones; marathon QA fully retired)
- **Verification-only plan pattern with Andrew-quote-on-record SUMMARY** (v1.4 Plan 28-03 → reused v1.5 Plan 30-02 with single-phrase blanket approval sub-pattern)
- **Mid-execution Rule 4 architectural-decision pattern** (v1.5 Plan 30-01 first use; new — surface unanticipated importer of "to-be-deleted" file as Rule 4 routing)
- **Smallest-diff override of plan-locked refactor moves** (v1.5 Plan 30-01; new — when amendment changes underlying assumption, pick smallest-diff path not plan-locked literal text)
- **Drain-waiver pattern** (v1.5 Plan 28-02; new — formal CP-03 30-min skip under documented zero-traffic acceptance + Andrew sign-off)
- **Single grid owner UI pattern** (v1.5 Plan 30-01; new — parent shell owns grid template, children are direct grid children, no nested grids)
- **Reserved-column conditional-mount pattern** (v1.5 Plan 30-01; new — fixed-width track with `<div>` placeholder swapping to mounted form, zero layout shift, V15-MP-05 Turnstile lifecycle preserved)
- **LD-lock deliberate-override pattern** (v1.5 LD-07; new — narrow auditable carve-out re-stated CONTEXT → PLAN → SUMMARY)
- **Three-gate verification block for copy phases** (v1.5 Phase 29; new — canonical / ROADMAP-verbatim / booker-neutrality)

### Active blockers

None. v1.6 scope locked through questioning; ready for requirements definition.

### Open tech debt (carried into v1.6)

**Introduced in v1.5 (3 items, deferred — not in v1.6 scope unless reschedule UI is touched):**
- `slot-picker.tsx` kept on disk per Andrew Option A (Plan 30-01 Rule 4 amendment) — full date+slot UI now duplicated across `booking-shell.tsx` + `slot-picker.tsx`. Resolve when reschedule UI is itself redesigned (preferred fix: extract shared `<CalendarSlotPicker>` component).
- Slot-fetch effect duplication: `booking-shell.tsx:68-96` and `slot-picker.tsx:51-79` near-identical. Future changes (pagination, retry, cache headers) must be applied in two places until slot-picker.tsx is deleted.
- `Slot` type import asymmetry: `booking-shell.tsx:8` imports `type Slot` from `./slot-picker` even though component no longer used here. Natural home is `lib/slots.types.ts`. Two `Slot` type sources with slightly different shapes; tidy when slot-picker.tsx is deleted.

**Pre-existing (carried through v1.5 unchanged; NOT in v1.6 scope):**
- 33 pre-existing tsc errors in `tests/` (test mock helpers `__setTurnstileResult`, `__mockSendCalls`, etc. — not exported from their modules). Predates v1.5. Address as separate cleanup pass.
- `tests/slot-generation.test.ts:31` JSDoc historical reference to `buffer_minutes` (descriptive prose; not live code; outside grep gate scope of `app/+lib/`).
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` working-tree drift — orthogonal to v1.5; survived all 6 v1.5 plans + milestone archive without ever being staged. Decide commit/revert at v1.6 plan time.

**Carryover backlog from v1.0–v1.4 (NOT executed in v1.5; NOT in v1.6 scope per Path A lock — Resend / per-account Gmail deferred to v1.7+):**
- Marathon QA execution — formally retired as deploy-and-eyeball model (5th consecutive milestone)
- INFRA-01: Resend migration (Gmail SMTP 200/day cap; ~$10/mo for 5k emails) — **deferred to v1.7+; v1.6 hardens the cap instead**
- INFRA-02: Vercel Pro hourly cron flip (`vercel.json` `0 * * * *`)
- AUTH-23: OAuth signup
- AUTH-24: Magic-link login
- BRAND-22: NSI brand asset replacement (`public/nsi-mark.png` placeholder)
- DEBT-01..07 (7 items from v1.0–v1.2 carryover)
- 3 Phase 26 audit fragilities: `bookings-table.tsx:37` unguarded TZDate; `queries.ts:92-94` undefined normalization; `queries.ts:86` unguarded throw

**Future feature backlog from v1.5 (NOT in v1.6 scope):**
- BUFFER-07: pre-event buffer wiring (`buffer_before_minutes` schema column already exists at default 0)
- BUFFER-08: owner sees "15 min buffer" badge on event-type list card
- BUFFER-09: configurable buffer step granularity (1-min instead of 5-min)
- BOOKER-06: animated form slide-in (CSS translate-x transition on slot pick)
- BOOKER-07: skeleton loader on slow `/api/slots` response

## v1.6 Scope Lock (from questioning, 2026-05-04)

**Feature 1 — Inverse availability on date overrides:**
- REPLACE the "enter available times" mode in date overrides with "enter unavailable windows."
- Multi-window per day supported (e.g. 10–11am AND 2–3pm).
- Full-day off stays as a separate toggle/button (cleaner UX than entering 12am–11:59pm).
- Existing bookings inside a new unavailable window: warning issued in preview; on commit, auto-cancel + email affected bookings via existing cancel lifecycle (.ics CANCEL).

**Feature 2 — Day-level pushback under Bookings tab:**
- Lives under `/app/bookings`. New "Pushback" action button/menu opens a dialog.
- Dialog defaults to today's date; owner can change.
- Owner picks anchor booking from that day's bookings; enters delay (minutes or hours).
- Smart cascade rule: each later booking only moves if the prior booking's new end time pushes into its original start; otherwise the gap is absorbed and the booking is left alone. (Example: 30-min appts at 1:00 and 2:00; if 1:00 pushed to 1:15 → ends 1:45 → 2:00 unchanged. If 1:00 pushed to 1:45 → ends 2:15 → 2:00 must move to 2:15 / soonest available.)
- Reason field: optional, encouraged. Single reason text applies to every email in the batch.
- Owner confirmation step required before commit: preview shows X bookings will move from [old] to [new]; Y will be rescheduled past end-of-day.
- All affected bookings ride the existing reschedule lifecycle: `METHOD:REQUEST` SEQUENCE+1 .ics, calendar invite updates, cancel link in email, "sorry for the inconvenience" copy + reason text.
- Bookings pushed past end-of-workday: same email pattern, no separate variant.

**Feature 3 — Gmail SMTP 200/day hard cap:**
- Harden existing v1.1 `lib/email-sender/quota-guard.ts` `checkAndConsumeQuota()` from soft-warning into refuse-send fail-closed at 200/day for ALL paths (v1.1 carved out bookings/reminders to protect core flow; pushback emails are reschedule-class and may fire 5+ at once, so the carve-out becomes a real risk).
- Two implementation options for planning to evaluate: (a) extend fail-closed to all senders + add user-visible error in pushback preview when remaining quota < batch size, or (b) pre-flight-budget the pushback batch (count emails before sending; refuse the entire pushback if batch would exceed remaining quota).

**Out of v1.6 scope (Path A lock):**
- Per-account Gmail account connection (deferred to v1.7+; revisit after live-use signal)
- INFRA-01 Resend migration (deferred to v1.7+; revisit alongside per-account Gmail decision)

## Session Continuity

**Last session:** 2026-05-04 — `/gsd:new-milestone` Phase 1-2 (questioning + scope lock) complete. Andrew chose Path A (defer per-account Gmail / Resend, ship hard cap now). PROJECT.md + STATE.md updated. Next: research decision → REQUIREMENTS.md → ROADMAP.md.

**Stopped at:** Milestone-init Phase 4 complete (PROJECT.md + STATE.md updated). Phase 5 (commit milestone-start docs) next.

**Next session:** Continue `/gsd:new-milestone` flow — Phase 6 commit → Phase 7 research decision → Phase 8 REQUIREMENTS.md → Phase 9 ROADMAP.md → Phase 10 done.

**Files of record:**
- `.planning/PROJECT.md` — what + why (updated 2026-05-04 with v1.6 Current Milestone section + 3 Active requirements)
- `.planning/ROADMAP.md` — milestone index (v1.6 phases not yet appended)
- `.planning/MILESTONES.md` — historical record (v1.5 entry at top; v1.6 entry created at milestone close)
- `.planning/STATE.md` — this file
- `.planning/REQUIREMENTS.md` — DELETED at v1.5 close; will be created in milestone-init Phase 8
- `.planning/milestones/v1.0-ROADMAP.md` … `v1.5-ROADMAP.md` — full archives
- `.planning/phases/01-…` … `30-public-booker-3-column-layout/` — raw execution history (NOT deleted; phase directories accumulate across milestones)
