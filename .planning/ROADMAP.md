# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- ✅ **v1.4 Slot Correctness + Polish** — Phases 25-27 (8 plans across 3 phases) — shipped 2026-05-03. Full archive: [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md).
- ✅ **v1.5 Buffer Fix + Audience Rebrand + Booker Redesign** — Phases 28-30 (6 plans across 3 phases) — shipped 2026-05-05. Full archive: [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md).
- ✅ **v1.6 Day-of-Disruption Tools** — Phases 31-33 (10 plans, 3 phases) — shipped 2026-05-06. All 25 v1.6 requirements Complete. Phase 33 verifier re-passed after PUSH-10 gap closed by orchestrator commit `2aa9177`.

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-04-27</summary>

See [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) for full phase details.

- [x] Phase 1: Foundation — completed 2026-04-19
- [x] Phase 2: Owner Auth + Dashboard Shell — completed 2026-04-24
- [x] Phase 3: Event Types CRUD — completed 2026-04-24
- [x] Phase 4: Availability Engine — completed 2026-04-25
- [x] Phase 5: Public Booking Flow + Email + .ics — completed 2026-04-25
- [x] Phase 6: Cancel + Reschedule Lifecycle — completed 2026-04-25
- [x] Phase 7: Widget + Branding — completed 2026-04-26
- [x] Phase 8: Reminders + Hardening + Dashboard List — completed 2026-04-27
- [x] Phase 9: Manual QA & Verification — completed 2026-04-27 ("ship v1")

</details>

<details>
<summary>✅ v1.1 Multi-User + Capacity + Branded UI (Phases 10-13) — SHIPPED 2026-04-30</summary>

See [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md) for full phase details.

- [x] Phase 10: Multi-User Signup + Onboarding (9 plans) — code complete 2026-04-28
- [x] Phase 11: Booking Capacity + Double-Booking Root-Cause Fix (8 plans) — code complete 2026-04-29
- [x] Phase 12: Branded UI Overhaul (5 Surfaces) (7 plans) — code complete 2026-04-29
- [x] Phase 12.5: Per-Account Heavy Chrome Theming (INSERTED) (4 plans) — code complete 2026-04-29 (deprecated in code by 12.6; DB columns retained)
- [x] Phase 12.6: Direct Per-Account Color Controls (INSERTED) (3 plans) — code complete 2026-04-29 (Andrew live Vercel approval)
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.3)

</details>

<details>
<summary>✅ v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md) for full phase details.

- [x] Phase 14: Typography + CSS Token Foundations (1 plan) — completed 2026-04-30
- [x] Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin (2 plans) — completed 2026-04-30
- [x] Phase 16: Auth + Onboarding Re-Skin (4 plans) — completed 2026-04-30
- [x] Phase 17: Public Surfaces + Embed (9 plans) — completed 2026-04-30
- [x] Phase 18: Branding Editor Simplification (3 plans) — completed 2026-05-01
- [x] Phase 19: Email Layer Simplification (1 plan) — completed 2026-05-01
- [x] Phase 20: Dead Code + Test Cleanup (1 plan) — completed 2026-05-01
- [x] Phase 21: Schema DROP Migration (1 plan) — completed 2026-05-02

</details>

<details>
<summary>✅ v1.3 Bug Fixes + Polish (Phases 22-24) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md) for full phase details.

- [x] Phase 22: Auth Fixes (2 plans) — completed 2026-05-02
- [x] Phase 23: Public Booking Fixes (2 plans) — completed 2026-05-02
- [x] Phase 24: Owner UI Polish (2 plans) — completed 2026-05-02 (Andrew live deploy approved)

</details>

<details>
<summary>✅ v1.4 Slot Correctness + Polish (Phases 25-27) — SHIPPED 2026-05-03</summary>

See [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md) for full phase details.

- [x] Phase 25: Surgical Polish (2 plans) — completed 2026-05-03 (AUTH-21, AUTH-22, OWNER-14, OWNER-15)
- [x] Phase 26: Bookings Page Crash Debug + Fix (3 plans) — completed 2026-05-03 (BOOK-01, BOOK-02; root cause RSC boundary violation)
- [x] Phase 27: Slot Correctness DB-Layer Enforcement (3 plans) — completed 2026-05-03 (SLOT-01..05; EXCLUDE constraint live; Andrew smoke approved)

</details>

<details>
<summary>✅ v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Phases 28-30) — SHIPPED 2026-05-05</summary>

See [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md) for full phase details.

- [x] Phase 28: Per-Event-Type Buffer + Account Column Drop (3 plans) — completed 2026-05-04 (BUFFER-01..06 shipped; CP-03 DROP completed with drain waiver)
- [x] Phase 29: Audience Rebrand (1 plan) — completed 2026-05-04 (BRAND-01..03 shipped; canonical grep gate clean)
- [x] Phase 30: Public Booker 3-Column Desktop Layout (2 plans) — completed 2026-05-05 (BOOKER-01..05 shipped; Andrew live-verified at 1024/1280/1440 + mobile)

</details>

### ✅ v1.6 Day-of-Disruption Tools (Phases 31-33) — shipped 2026-05-06

**Milestone Goal:** Give owners two new operational levers for day-of disruption — partial-day unavailability via inverse date overrides and day-level pushback with smart cascade — while hardening the 200/day Gmail SMTP cap into a true refuse-send guard so pushback's higher email volume can't silently exceed it.

**Dependency note:** Phase 31 (hard cap guard) ships first because both AVAIL-06's auto-cancel batch and PUSH-08's pre-flight quota check depend on the guard being live. EMAIL-23 (AVAIL pre-flight UI) is delivered inside Phase 32 and EMAIL-22 (PUSH pre-flight UI) is delivered inside Phase 33; both depend on the Phase 31 guard layer being present. If Phases 32 or 33 were to ship before Phase 31, the auto-cancel and pushback paths would need the existing v1.1 carve-out as a temporary fallback — avoided by the 31 → 32 → 33 execution order.

- [x] **Phase 31: Email Hard Cap Guard** — completed 2026-05-05 (3 plans, 10 commits; Andrew live verification approved)
- [x] **Phase 32: Inverse Date Overrides** — completed 2026-05-05 (3 plans, 11 commits; Andrew live verification approved 8/8 scenarios)
- [x] **Phase 33: Day-Level Pushback Cascade** — completed 2026-05-06 (4 plans, 16 commits; Andrew live-verified all 8 scenarios; PUSH-10 gap closed by orchestrator commit `2aa9177`; verifier re-passed)

---

#### Phase 31: Email Hard Cap Guard

**Goal:** The Gmail quota guard refuses to send when the daily count is at 200, for every email path in the system — no silent drops, no partial batches.

**Depends on:** Phase 30 (v1.5 invariants preserved; no new dependency)

**Requirements:** EMAIL-21, EMAIL-24, EMAIL-25

**Success Criteria** (what must be TRUE):
1. Sending a booking confirmation or reminder when the day's count is exactly 200 returns a clear error to the caller — no email is sent, no silent swallow.
2. The owner-facing trigger path (e.g., triggering a manual reminder) receives a visible error message when the cap is hit — not a spinner that goes nowhere.
3. Every quota refusal writes a structured log entry with `code: 'EMAIL_QUOTA_EXCEEDED'`, `account_id`, `sender_type`, `count`, and `cap` — no PII fields.
4. The guard's refuse-send behavior covers all sender types (booking confirmation, reminder, cancel, reschedule, owner notification) — not just the paths that previously had fail-closed behavior.

**Plans:** 3 plans

Plans:
- [ ] 31-01-PLAN.md — Foundation: DB migrations (extend `email_send_log.category` CHECK, add `bookings.confirmation_email_sent`) + extend `quota-guard.ts` with new EmailCategory values, `getRemainingDailyQuota()`, and `logQuotaRefusal()` helper
- [ ] 31-02-PLAN.md — Wire all 7 email senders through the guard + caller routing (save-and-flag bookings, await cancel/reschedule, cron mid-batch handling, manual-reminder Gmail-fallback error copy)
- [ ] 31-03-PLAN.md — Owner UX surfaces (inline reminder dialog error, differentiated cancel toast, `/app/bookings` unsent-confirmations banner) + test coverage for refuse paths and PII-free log shape

---

#### Phase 32: Inverse Date Overrides

**Goal:** Owners can mark specific time windows (or the whole day) as unavailable on a date override; the slot engine computes available slots as weekly-hours MINUS unavailable windows; existing bookings inside a new unavailable window are warned about and auto-cancelled on commit.

**Depends on:** Phase 31 (auto-cancel batch pre-flight quota check requires EMAIL-21 guard to be live)

**Requirements:** AVAIL-01, AVAIL-02, AVAIL-03, AVAIL-04, AVAIL-05, AVAIL-06, AVAIL-07, AVAIL-08, EMAIL-23

**Success Criteria** (what must be TRUE):
1. Owner opens the date-override editor and sees "Enter unavailable windows" — the old "Enter available times" mode is gone; the new mode is the only option.
2. Owner can add multiple separate unavailable windows on the same date (e.g., 10:00–11:00 and 14:00–15:00), edit each window, and remove individual windows without affecting others.
3. Owner can toggle "Block entire day" — when on, the unavailable-windows list disappears and the day shows fully blocked; toggling off restores the windows list.
4. The public booking page shows no slots inside newly-created unavailable windows; slots outside the windows continue to appear normally; buffer-after-minutes and the EXCLUDE GIST constraint still apply.
5. When saving unavailable windows that overlap existing confirmed bookings, the editor shows a warning preview listing every affected booking; if the batch would exceed remaining daily email quota, the commit button is disabled with a clear quota error; on confirmation the affected bookings are cancelled (status → `cancelled`, audit row, .ics CANCEL email with rebook CTA link to booker, owner notification).

**Plans:** 3 plans

Plans:
- [ ] 32-01-PLAN.md — Slot engine MINUS semantics + wipe-and-flip migration for legacy custom_hours rows + subtractWindows helper (Wave 1)
- [ ] 32-03-PLAN.md — Server action surface: skipOwnerEmail flag on cancelBooking + getAffectedBookings query + commitInverseOverrideAction with HARD quota pre-flight + race-safe re-query (Wave 2)
- [ ] 32-02-PLAN.md — Override modal rewrite: unavailable-windows mode + Block-entire-day hide+preserve toggle + inline affected-bookings preview + EMAIL-23 quota gate UX (Wave 3, has human-verify checkpoint)

---

#### Phase 33: Day-Level Pushback Cascade

**Goal:** Owners can push back all bookings from a chosen anchor point forward on a given day by a specified delay, with smart cascade (gap absorption), a pre-commit preview, an optional reason field, and all affected bookings processed through the existing reschedule lifecycle.

**Depends on:** Phase 31 (batch email pre-flight quota check requires EMAIL-21 guard to be live), Phase 32 (no hard dep but natural last in v1.6 — both earlier phases preserve v1.5 invariants that pushback also relies on)

**Requirements:** PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06, PUSH-07, PUSH-08, PUSH-09, PUSH-10, PUSH-11, PUSH-12, EMAIL-22

**Success Criteria** (what must be TRUE):
1. Owner opens `/app/bookings`, triggers "Pushback," and sees a dialog defaulting to today's date listing that day's confirmed bookings in chronological order; owner can change the date.
2. Owner picks an anchor booking, enters a delay (positive integer, minutes or hours), and optionally types a reason; the dialog recalculates new times in real time as delay input changes.
3. The confirmation preview accurately shows: every booking that will move (old time → new time), every booking whose gap absorbs the push (stays in place), and every booking flagged "past end-of-day"; total email count and remaining daily quota are surfaced; if the batch would exceed remaining quota the commit button is disabled.
4. On confirm, every affected booking's status updates and the existing reschedule lifecycle fires: `booking_events` audit row, .ics `METHOD:REQUEST` SEQUENCE+1 calendar invite, "sorry for the inconvenience" copy plus reason text in the email (brand-neutral on booker-facing surfaces), and a cancel link so bookers can decline the new time.
5. A concurrent booker cancellation or reschedule during the pushback commit does not produce duplicate emails or inconsistent calendar state; the existing v1.4 EXCLUDE GIST + v1.1 capacity index continue to bind on the new times.
6. Owner sees a post-commit summary listing emails sent and bookings updated; any individual email failure surfaces in the summary without rolling back successful sends.

**Plans:** 4 plans

Plans:
- [ ] 33-01-PLAN.md — Pushback dialog shell + day-grouped upcoming view + getBookingsForPushback query (Wave 1)
- [ ] 33-02-PLAN.md — Pure cascade module + previewPushbackAction + EMAIL-22 quota gate (Wave 2, has human-verify checkpoint)
- [ ] 33-03-PLAN.md — rescheduleBooking() skipOwnerEmail+actor extensions + commitPushbackAction with abort-on-diverge race safety (Wave 3)
- [ ] 33-04-PLAN.md — Post-commit summary state + per-row retryPushbackEmailAction (Wave 4, has human-verify checkpoint)

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25-27 | v1.4 | 8 / 8 | ✅ Shipped | 2026-05-03 |
| 28 | v1.5 | 3 / 3 | ✅ Complete | 2026-05-04 |
| 29 | v1.5 | 1 / 1 | ✅ Complete | 2026-05-04 |
| 30 | v1.5 | 2 / 2 | ✅ Complete | 2026-05-05 |
| 31 | v1.6 | 3 / 3 | ✅ Complete | 2026-05-05 |
| 32 | v1.6 | 3 / 3 | ✅ Complete | 2026-05-05 |
| 33 | v1.6 | 4 / 4 | ✅ Complete | 2026-05-06 |

## Cumulative Stats

- **Total phases shipped:** 32 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27 + 28-30)
- **Total plans shipped:** 128 (52 + 34 + 22 + 6 + 8 + 6)
- **Total commits:** ~510 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4 + ~11 v1.5)
- **v1.6 scope:** 3 phases (31-33), 10 plans (3+3+4), 25 requirements

---

*Roadmap last updated: 2026-05-06 — Phase 33 (Day-Level Pushback Cascade) shipped and verified: 4 plans, 16 commits, all 8 human scenarios approved by Andrew, PUSH-10 closed by orchestrator commit `2aa9177`. v1.6 milestone complete — 3 phases, 10 plans, ~38 commits. Run `/gsd:complete-milestone` to archive v1.6.*
