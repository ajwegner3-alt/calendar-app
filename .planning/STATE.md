# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-04 — **Phase 30 Plan 01 SHIPPED.** Public booker flat 3-column desktop layout (calendar | times | form) live; state lifted from `slot-picker.tsx` into `booking-shell.tsx`; single feat commit `8b45c50` (1 file, +201/-35). **Mid-execution Rule 4 architectural decision:** Andrew picked Option A — keep `slot-picker.tsx` on disk as Phase-6-only component (still consumed by `app/reschedule/[token]/_components/reschedule-shell.tsx`). Booker no longer imports `SlotPicker` (component); only imports `type Slot` from same file. tsc 33 errors all pre-existing in `tests/` (zero new). Test suite 228 passed | 9 skipped (matches baseline; zero regression). Pre-existing `02-VERIFICATION.md` drift remains UNSTAGED. Pushed to `main`, Vercel auto-deploy in flight. v1.5 progress 5/6. Plan 30-02 (Andrew live-verify smoke at 1024/1280/1440 + mobile) is the final v1.5 step.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-03 after v1.5 milestone start)

**Core value:** A visitor lands on a service-based business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.5 — Buffer Fix + Audience Rebrand + Booker Redesign. Phases 28 + 29 shipped; Phase 30 Plan 01 shipped; Plan 30-02 (live-verify smoke) is the final v1.5 step.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.5 (started 2026-05-03).
**Phase:** Phase 30 — Public Booker 3-Column Desktop Layout (1 of 2 plans complete)
**Plan:** 30-01 — Booker layout restructure ✅ SHIPPED 2026-05-04
**Status:** Plan 30-01 closed. BOOKER-01..04 all shipped. `booking-shell.tsx` is now the single grid owner: owns slot-fetch state (slots, loading, fetchError, rangeFrom/To, slotsByDate, markedDates, slotsForSelectedDate, isCompletelyEmpty), the date-range computation, the canonical async-fetch effect on `/api/slots`, and the 3-col grid template `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`. Calendar + slot list + form column render as direct grid children. Form column always reserved at fixed 320px (zero layout shift on slot pick). V15-MP-05 Turnstile lifecycle lock honored: placeholder is `<div>`, NOT mounted form. V15-MP-04 honored: timezone hint is full-width `<p>` above grid. max-w-3xl on `<header>`, max-w-4xl on `<section>`. Selected-slot highlight ternary preserved verbatim. Empty-state branch lifted to shell level. Embed wrapper untouched. **Mid-execution Rule 4 architectural decision routed to Andrew:** Plan called for deleting `slot-picker.tsx`, but `app/reschedule/[token]/_components/reschedule-shell.tsx:6` still consumes it (per Phase 6 PLAN-04 verbatim reuse). Andrew picked Option A — keep file on disk; deletion deferred until reschedule itself is redesigned. Booker decoupling complete: `booking-shell.tsx` no longer imports `SlotPicker` (component); only imports `type Slot` (smallest-diff path). Single feat commit `8b45c50` (1 file, +201/-35); plan-locked single-commit batching honored. tsc 33 errors all pre-existing in `tests/` (zero new in `app/` or `lib/`). Test suite 228 passed | 9 skipped (zero regression vs baseline). Pre-existing `02-VERIFICATION.md` drift confirmed UNSTAGED. Pushed to `main`; Vercel auto-deploy in flight. Plan 30-02 (live-verify smoke) is the next step — does NOT gate on this plan's completion (this plan does not include human-verify).
**Last activity:** 2026-05-04 — Plan 30-01 executed in ~13 min wall clock (Option A architectural pause + restart accounted for). Zero retries; one architectural deviation (Rule 4) routed cleanly via spawn checkpoint; Option A executed end-to-end with smaller scope than originally planned (no slot-picker.tsx deletion).

**Drain gate (CP-03) — WAIVED 2026-05-04 by Andrew (preserved for record):**
- Original gate: T0 + 30 min = `2026-05-04T00:57:49Z UTC` minimum
- Waiver rationale: No active booking traffic on the product (single-tenant nsi only, no public booker requests in flight). The drain protects warm pre-28-01 `/api/slots` instances from 500'ing on a dropped column; with zero traffic, those instances stay cold and serverless idles them out (~15 min) before any request lands. Andrew confirmed nobody is booking and accepted the small residual risk (bots / monitoring / self-traffic during deploy window).
- Decision logged at `2026-05-04T~00:35Z`. Plan 28-02 launched at `2026-05-04T00:36:24Z` (~9 min after T0).
- Outcome: No regression detected. /api/slots remained HTTP 200 throughout; no 500s observed.

**Phase queue (v1.5):**
- [X] Phase 28: Per-Event-Type Buffer Wire-Up + Account Column Drop (3 plans — BUFFER-01..06 shipped 2026-05-04)
  - [X] Plan 28-01: Backfill, Rewire, and Form (shipped 2026-05-04, 3 commits)
  - [X] Plan 28-02: DROP migration + availability cleanup (shipped 2026-05-04, 3 commits)
  - [X] Plan 28-03: Divergence tests + smoke (shipped 2026-05-04, 1 metadata commit — verification only; no code edits required)
- [X] Phase 29: Audience Rebrand (1 plan — BRAND-01..03 shipped 2026-05-04)
  - [X] Plan 29-01: Audience copy scrub (shipped 2026-05-04, 1 content commit `0659c0e` + 1 metadata commit)
- [~] Phase 30: Public Booker 3-Column Desktop Layout (2 plans — BOOKER-01..05; 1/2 complete)
  - [X] Plan 30-01: Booker layout restructure (shipped 2026-05-04, 1 feat commit `8b45c50`; BOOKER-01..04 closed)
  - [ ] Plan 30-02: Live-verify smoke checkpoint at 1024/1280/1440 + mobile (BOOKER-05)

**Phase 28 closing summary:** 3 plans, 7 commits total (3 + 3 + 1), executed across 2026-05-04. Two-step DROP (CP-03) completed end-to-end with drain waived for zero-traffic. Asymmetric per-booking + per-candidate buffer math (LD-04) live in production. accounts.buffer_minutes permanently removed from DB. Owner editor + list table expose buffer_after_minutes. BUFFER-06 divergence proven by both unit test (3/3) and Andrew's live cross-event verification.

**Phase 29 closing summary:** 1 plan, 2 commits (1 batched content + 1 metadata), executed 2026-05-04 in ~2 min. 4 files, 7-line diff. Three independent grep gates (canonical / ROADMAP-verbatim / booker-neutrality) all 0 matches. LD-07 deliberate override executed cleanly: inert dev comment scrubbed, runtime UI byte-identical. Live smoke explicitly waived per CONTEXT (copy-only). Pure stale-copy cleanup; zero behavioral change. **gsd-verifier passed 5/5 must_haves against codebase** — `29-VERIFICATION.md` created with file+line evidence for each criterion (auth-hero subtext+tagline, README opening, FUTURE_DIRECTIONS lines 62/226/232, grep gates, booker neutrality).

**Cumulative project progress:**

```
v1.0 [X] MVP                          (Phases 1-9, 52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13 incl. 12.5/12.6, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans, 91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24, 6 plans, 34 commits, shipped 2026-05-02 — same-day)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27, 8 plans, 50 commits, shipped 2026-05-03 — 2 days)
v1.5 [~] Buffer + Rebrand + Booker    (Phases 28-30, 6 plans, 5/6 complete — Phases 28+29 shipped 2026-05-04, Plan 30-01 shipped 2026-05-04)
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

### Decisions / patterns added by Plan 30-01 (2026-05-04)

- **Mid-execution Rule 4 architectural-decision pattern (new, validated):** When the executor discovers an unanticipated importer of a "to-be-deleted" file, surface as a Rule 4 architectural decision to the user before proceeding — do NOT assume the file is safe to delete just because the active phase no longer needs it. Plan 30-01 was the first v1.5 plan to exercise this pattern: the planner intended to delete `slot-picker.tsx` but missed that `app/reschedule/[token]/_components/reschedule-shell.tsx:6` (Phase 6 consumer, live in production) still imports it. Executor surfaced 3 options to Andrew (A: keep file as Phase-6-only / B: refactor reschedule to absorb the lift / C: extract a shared `<CalendarSlotPicker>`). Andrew chose **Option A**. Pattern is reusable for any future component-removal phase.
- **Smallest-diff override of plan-locked refactor moves:** When a plan locks a refactor as a means to an end (e.g., "move type X from file A to file B because file A will be deleted"), and an architectural amendment changes the underlying assumption (file A no longer being deleted), pick the smallest-diff path to satisfy the new constraint — not the plan-locked move. Plan 30-01 example: the plan said move `Slot` interface into `booking-shell.tsx` because `slot-picker.tsx` was being deleted. With Option A, `slot-picker.tsx` stays; executor kept `import { type Slot } from "./slot-picker"` in `booking-shell.tsx` (single-line diff) instead of moving the type definition (would have caused churn for `reschedule-shell.tsx`). The plan's locked move was instrumental, not load-bearing.
- **Single grid owner pattern (UI):** Parent shell owns the grid template; child columns render as direct grid children (no nested grids). Replaces the prior nested 2-col-inside-2-col booker pattern. Reusable for any future multi-column layout where the columns logically belong to the same visual unit (a "card") and should reflow together at breakpoint changes. Implementation in `booking-shell.tsx:180` — `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]` Tailwind v4 bracket-grid syntax.
- **Reserved-column pattern for conditional-mount UI:** When a UI element (e.g., a form) is mounted/unmounted conditionally but should NOT cause layout shift in sibling columns, reserve its grid track at a fixed width (here: 320px). Show a `<div>` placeholder before mount; swap the placeholder for the real component on mount. Combined with V15-MP-05 Turnstile lifecycle lock, this gives "form column always visible at fixed width, content swaps in place, zero layout shift, Turnstile token never stales". Reusable for any other conditional-mount-with-side-effect component (analytics widgets, payment forms, etc.).
- **Research-gap risk for component-removal phases:** Phase 30 RESEARCH.md cited STACK.md "Option C" (lift state out, delete child) without checking for non-booker consumers. Caught at execution time only because the executor ran a pre-deletion grep. **Future planner discipline:** any plan that deletes a shared component MUST run `grep -rn "from .*<filename>" app/ lib/ tests/` during research, NOT only during execution. Add to plan-phase research checklist.

### Decisions / patterns added by Plan 29-01 (2026-05-04)

- **Copy-only phase pattern (new):** When an entire phase is documentation/copy and a deterministic grep gate exists, the gate replaces live-eyeball QA. Auto-deploy on push still happens (Andrew's global "live testing" default), but no human-verify checkpoint is needed. Reusable for any future pure-copy / pure-doc phase. Plan 29-01 baseline: ~2 min wall clock from start to push.
- **LD-lock deliberate-override pattern (new):** A successor phase's CONTEXT.md can deliberately override a prior LD-lock when the carve-out is narrow (e.g., single inert line, no runtime/UI effect) and the override is auditable end-to-end (stated in CONTEXT → restated in PLAN → restated in SUMMARY). Plan 29-01 used this for LD-07 → `booking-form.tsx:138` dev comment. Pattern requires explicit narrow-scope language; it is NOT a license to revisit locks broadly.
- **Plan-locked commit-batching pattern:** GSD's atomic-per-task default can be overridden by a plan author when (a) the change is several tiny string swaps, (b) a single canonical grep gate verifies them together, and (c) Andrew's "commit after a logical unit of work" preference favors batching. The plan must state the override in the body (Plan 29-01 did so in Task 3 Step 5) and lock the exact commit message verbatim. Recorded in SUMMARY as a process-level deviation for traceability.
- **In-product term-of-art over audience term in dev docs:** When a developer-facing doc references the audience by their in-product role (e.g., "owners" — the role with an account on the product), use the in-product term rather than the marketing audience term ("service businesses"). Plan 29-01 applied this to FUTURE_DIRECTIONS lines 226 + 232. Marketing/onboarding-facing copy (auth-hero, README opening) gets the audience term.
- **Three-gate verification block for copy phases:** Canonical grep gate + ROADMAP-verbatim narrower gate + booker-surface neutrality gate. The neutrality gate (proving the new audience copy did NOT leak into booker-facing surfaces) is novel and reusable for any future copy phase that has an audience-segmented contract.
- **Pre-existing-modification preservation:** Files modified in the working tree before plan start that are orthogonal to the plan (e.g., `02-VERIFICATION.md` here) must NOT be staged into plan commits. Per-file `git add` of plan files only — never `git add -A`. Recorded in SUMMARY for audit.

### Decisions / patterns added by Plan 28-03 (2026-05-04)

- **Verification-only plan pattern:** When prior plans in a phase have already shipped the implementation, a phase-closing plan can be a pure verification pass with zero code commits. Plan 28-03's Task 1 (auto) found BUFFER-06 + full suite + grep + DB all green from Plan 28-01/02 work — no edits, no commits needed. The only commit is the SUMMARY metadata commit. Reusable for any future "prove it works in prod" closer.
- **Andrew-quote-on-record approval format:** For live smoke checkpoints with multiple Verifications, capture Andrew's exact words verbatim in the SUMMARY. Free-text approval is acceptable when the words map unambiguously back to plan Verifications, and the mapping is documented in the SUMMARY for traceability. Avoids forcing rigid "type 'approved'" UX when the substance is already clear.
- **Soft scrub deferred:** `tests/slot-generation.test.ts:31` retains a JSDoc historical reference to `buffer_minutes` (descriptive prose explaining the Phase 28 transition). Not live code; the gate intentionally scopes to `app/` + `lib/`. Flagged for a future docs scrub if a token-comprehensive cleanup is ever performed; not a blocker.

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

None. Phase 29 complete; production deploy in flight (auto-deploy on push, no eyeball gate per CONTEXT waiver). **Phase 30 (Public Booker 3-Column Desktop Layout) ready to plan via `/gsd:plan-phase 30`.**

**Soft concerns carried into Phase 30 (not blockers, unchanged from Phase 28/29 close):**
- 33 pre-existing tsc errors in `tests/` (test mock helpers `__setTurnstileResult`, `__mockSendCalls`, etc. — runtime-only or test-setup symbols not exported from their modules). None in `app/` or `lib/`. Predates Phase 28. Address as a separate cleanup pass when convenient.
- `tests/slot-generation.test.ts:31` JSDoc historical reference to `buffer_minutes` (descriptive prose, not live code). Optional future docs scrub.
- Pre-existing `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` modification still in working tree (orthogonal; predates Plan 29-01). Decide whether to commit, revert, or leave at start of Phase 30.

## Session Continuity

**Last session:** 2026-05-04 — Plan 29-01 executed in ~2 min (1m 48s, `2026-05-04T01:39:11Z` → `2026-05-04T01:40:59Z`). Single batched content commit `0659c0e` (4 files, 7-line diff): auth-hero subtext default (line 21) + tagline `<li>` (line 42) → audience-neutral / "service businesses" copy; README opening (line 3) rewritten audience-led, drops "Calendly-style" + trade parenthetical; FUTURE_DIRECTIONS lines 62 / 226 / 232 audience-context contractor refs rewritten (`service-business` modifier on 62; `owners` on 226 + 232); booking-form.tsx:138 dev comment swapped contractor→owner per LD-07 override (runtime line 139 byte-identical, booker UI untouched). Three grep gates (canonical / ROADMAP-verbatim / booker-neutrality) all 0 matches. tsc 33 errors all pre-existing in `tests/` (zero new). Pushed `8c464f6..0659c0e main -> main`; Vercel auto-deploy triggered. Live smoke waived per 29-CONTEXT.md (copy-only).

**Stopped at:** Plan 30-02 checkpoint PRESENTED to Andrew, awaiting verbatim live-verify replies. Andrew paused the session before completing checks A–G ("Save these for later. Let's move on for now"). Plan 30-01 is fully shipped (commits `8b45c50` feat + `f83119f` docs on `main`, Vercel deploy live, HTTP 200 confirmed). No code work pending — only Andrew's eyeball verification remains.

**Resume Phase 30 verification:** Open `https://calendar-app-xi-smoky.vercel.app/nsi/30-minute-consultation` (deploy SHA `8b45c50`) and run the 8 checks defined in `.planning/phases/30-public-booker-3-column-layout/30-02-PLAN.md` `<how-to-verify>` block:
- A: 1024×768 — 3 cols, no scroll, no internal dividers
- B: 1280×800 — 3 cols, no scroll, comfortable
- C: 1440×900 — 3 cols, no scroll, card stays max-w-4xl (no full-width)
- D: pick a slot at 1280 — form fills col 3 in-place, NO shift in cols 1/2
- E: selected slot stays highlighted (filled bg, primary color) while form is visible
- F: re-pick a different slot — Name field clears (RHF reset via `key={selectedSlot.start_at}`)
- G: mobile (real device or 375×667) — vertical stack calendar→times→form, no horizontal scroll
- H (optional): embed iframe at 320–600px stays single-column

After all 7 mandatory checks (A–G) confirmed verbatim, run `/gsd:execute-phase 30` to resume — the orchestrator will spawn a continuation agent to write `30-02-SUMMARY.md` (Andrew-quote-on-record format, precedent from Plan 28-03), commit it, push, then close Phase 30 + v1.5. If anything fails, the continuation will branch to fix-forward (small) or open a 30-03 gap-closure plan (large).

**Plan 30-01 architectural deviation (recorded for audit):** Plan as written locked `slot-picker.tsx` for deletion. Executor surfaced unanticipated production importer at `app/reschedule/[token]/_components/reschedule-shell.tsx:6` (Phase 6 reschedule flow). Routed to Andrew as Rule 4 architectural decision; Andrew picked Option A (keep file on disk; booker no longer imports `SlotPicker` component, only `type Slot`). Plan body otherwise executed verbatim. Future follow-up: when reschedule layout is itself redesigned, evaluate extracting `<CalendarSlotPicker>` shared component or further consolidation. Documented in `30-01-SUMMARY.md`.

**Planner-discipline note (new pattern):** Before any plan that locks a file deletion, the plan author MUST run `grep -rn "from .*<filename>" app/ lib/ tests/` and enumerate every importer in the plan body — not just the file the plan is primarily editing. Plan 30-01 missed this on `slot-picker.tsx` (caught the inline-shape consumer in `booking-form.tsx:40` but not the type-and-component consumer in `reschedule-shell.tsx`). Cost: one mid-execution Rule 4 routing + scope amendment. Cheap, but avoidable. Add to gsd-planner deletion checklist.

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
