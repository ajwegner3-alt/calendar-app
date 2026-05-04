# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-04 — **Phase 28 Plan 28-02 shipped.** `accounts.buffer_minutes` permanently dropped from production Postgres; availability settings panel scrubbed; CP-03 two-step deploy complete. Plan 28-03 (divergence tests + smoke) unblocked.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-03 after v1.5 milestone start)

**Core value:** A visitor lands on a service-based business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.5 — Buffer Fix + Audience Rebrand + Booker Redesign. Roadmap created; ready to plan Phase 28.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.5 (started 2026-05-03).
**Phase:** Phase 28 — Per-Event-Type Buffer Wire-Up + Account Column Drop
**Plan:** 28-02 — DROP migration + availability cleanup ✅ SHIPPED 2026-05-04
**Status:** CP-03 two-step DROP COMPLETE. `accounts.buffer_minutes` permanently dropped. Plan 28-03 (divergence tests + smoke) unblocked.
**Last activity:** 2026-05-04 — Plan 28-02 executed in ~11 min (00:36:24Z → 00:47:38Z). Drain checkpoint waived per prior Andrew decision; availability cleanup committed (`653e620`); DROP migration applied (`dfb421f`); push at `00:43:04Z`; Vercel deploy reached Ready before 00:47:03Z; smoke /api/slots HTTP 200 with real slot JSON.

**Drain gate (CP-03) — WAIVED 2026-05-04 by Andrew (preserved for record):**
- Original gate: T0 + 30 min = `2026-05-04T00:57:49Z UTC` minimum
- Waiver rationale: No active booking traffic on the product (single-tenant nsi only, no public booker requests in flight). The drain protects warm pre-28-01 `/api/slots` instances from 500'ing on a dropped column; with zero traffic, those instances stay cold and serverless idles them out (~15 min) before any request lands. Andrew confirmed nobody is booking and accepted the small residual risk (bots / monitoring / self-traffic during deploy window).
- Decision logged at `2026-05-04T~00:35Z`. Plan 28-02 launched at `2026-05-04T00:36:24Z` (~9 min after T0).
- Outcome: No regression detected. /api/slots remained HTTP 200 throughout; no 500s observed.

**Phase queue (v1.5):**
- [~] Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop (3 plans — BUFFER-01..06)
  - [X] Plan 28-01: Backfill, Rewire, and Form (shipped 2026-05-04)
  - [X] Plan 28-02: DROP migration + availability cleanup (shipped 2026-05-04)
  - [ ] Plan 28-03: Divergence tests + smoke
- [ ] Phase 29: Audience Rebrand (1 plan — BRAND-01..03)
- [ ] Phase 30: Public Booker 3-Column Desktop Layout (2 plans — BOOKER-01..05)

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [~] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 2/6 complete — Plans 28-01..02 shipped 2026-05-04)
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

### Decisions / patterns added by Plan 28-02 (2026-05-04)

- **CP-03 two-step DROP completed end-to-end:** Plan 28-01 (rewire) → drain (waived) → Plan 28-02 cleanup commit clears grep gate → DROP migration applies → cleanup commit deploys → smoke 200. Pattern proven for v1.5; reusable for any future column drops.
- **Drain gate waiver pattern (new):** When the product has zero traffic, the drain protects only theoretical warm-instance state. A documented waiver in STATE.md with explicit rationale + acceptance is acceptable. Future precedent: served drains remain default; waiver requires Andrew sign-off + STATE.md decision before launch.
- **Doc-comment scrubbing as part of literal grep gates:** When the gate is "0 matches anywhere in app/ + lib/", historical doc-comments naming the deprecated token must also be reworded. Treated as Rule 3 (blocking) auto-fix during the cleanup commit.
- **Settings-panel grid auto-flow tolerance:** `sm:grid-cols-2` with 3 fields renders as 2+1 visually; acceptable when grid wasn't hard-coded to a specific column count for the deprecated field.

### Decisions / patterns added by Plan 28-01 (2026-05-04)

- **Asymmetric per-booking + per-candidate buffer math (LD-04 codified):** `bufferedStart = slotStart − existingBooking.buffer_after_minutes`; `bufferedEnd = slotEnd + slotBufferAfterMinutes`. The existing booking's buffer determines back-side blocking; the candidate event type's buffer determines forward-side blocking. BUFFER-06 divergence test block (3 tests) is now a regression gate.
- **Type-drift gate pattern (V15-CP-04 in practice):** Removing a type field entirely (rather than marking optional) surfaces missed callsites at compile time during a multi-deploy refactor.
- **Supabase generated-type narrowing for `!inner` joins:** TS models the join as object|array depending on inferred cardinality. Defensive runtime narrowing required (`Array.isArray(et) ? et[0]?.field : et?.field`).
- **Forgiving Zod numeric inputs:** `.catch(0)` on owner-facing settings coerces empty/NaN to 0 silently — matches CONTEXT lock for Buffer field UX.
- **Push-as-T0-proxy pattern:** When the executor cannot directly observe Vercel deploy status, the local `git push` UTC timestamp is a conservative proxy for T0; user confirms the actual "Ready" timestamp on the dashboard.

### Active blockers

None. CP-03 two-step DROP complete; production smoke 200; Plan 28-03 ready to execute.

**Soft concern (not a blocker for 28-03):** 33 pre-existing tsc errors in `tests/` (test mock helpers `__setTurnstileResult`, `__mockSendCalls`, etc. — runtime-only or test-setup symbols not exported from their modules). None in `app/` or `lib/`. Predates Phase 28. Plan 28-03 may want to scope `tsc --noEmit` to non-test files or address the test-mock symbol exports as a separate cleanup pass.

## Session Continuity

**Last session:** 2026-05-04 — Plan 28-02 executed in ~11 min in a single session. Drain checkpoint waived per prior Andrew decision; Task 2 committed as `653e620` (8 files: 6 availability + 2 doc-comment scrubs); Task 1 committed as `dfb421f` (DROP SQL + .SKIP rollback); Task 3 pushed at `00:43:04Z`; Vercel Ready before 00:47:03Z; smoke /api/slots HTTP 200; final information_schema returns 0 rows for `accounts.buffer_minutes`.

**Stopped at:** Plan 28-02 SUMMARY.md and STATE.md updated. Plan 28-03 is the next step.

**Resume:** Run `/gsd:execute-plan 28-03` to begin Plan 28-03 (divergence tests + smoke). Plan 28-03 PLAN.md already exists at `.planning/phases/28-per-event-type-buffer-and-column-drop/28-03-divergence-tests-and-smoke-PLAN.md`.

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
