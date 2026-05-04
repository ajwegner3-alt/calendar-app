---
phase: 30-public-booker-3-column-layout
plan: 01
subsystem: ui
tags: [react, tailwind, grid-layout, public-booker, turnstile, css-grid, state-lifting]

# Dependency graph
requires:
  - phase: 05-public-booking-flow
    provides: Original SlotPicker + BookingShell architecture (the 2-col layout being flattened)
  - phase: 06-cancel-and-reschedule-lifecycle
    provides: reschedule-shell.tsx (now sole remaining consumer of slot-picker.tsx)
  - phase: 14-typography-and-css-token-foundations
    provides: Tailwind v4 bracket grid syntax baseline (lg:grid-cols-[Xpx_Ypx])
  - phase: 15-backgroundglow-header-pill-owner-shell-re-skin
    provides: V15-MP-04 (full-width tz hint placement) + V15-MP-05 (Turnstile lifecycle lock)
provides:
  - Flat 3-column desktop grid in booking-shell.tsx (calendar | times | form, lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px])
  - All slot-fetch state lifted to BookingShell (slots, loading, fetchError, rangeFrom/To, slotsByDate, markedDates, slotsForSelectedDate, isCompletelyEmpty)
  - Form column always reserved at fixed 320px (zero layout shift on slot pick)
  - Conditional <BookingForm key={selectedSlot.start_at}> mount preserved (V15-MP-05 lock honored)
  - Selected-slot highlight ternary preserved verbatim (decoupled from form mount)
  - Empty-state branch lifted to shell level (renders above grid, full card width)
  - Timezone hint lifted to full-width <p> above the 3-col grid (V15-MP-04 satisfied)
affects: [30-02 (Andrew live-verify smoke at 1024/1280/1440 + mobile), any future booker-layout work, any future reschedule redesign that may absorb slot-picker.tsx]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single grid owner pattern: parent shell owns the 3-col grid; child columns render as direct grid children (no nested grids). Replaces the prior nested 2-col-inside-2-col pattern."
    - "State-lifted-from-deleted-child pattern (executed as state-lifted-from-now-decoupled-child): pull all fetch state up to the parent so the parent can render the dependent UI inline. Original PLAN intended a delete; Option A architectural decision retained the file as a Phase-6-only component, but the booker-side lift was identical to the planned shape."

key-files:
  modified:
    - "app/[account]/[event-slug]/_components/booking-shell.tsx (3-column grid owner; owns slot-fetch state; renders Calendar + slot list + BookingForm-or-placeholder as direct grid children)"
  preserved-on-disk-deviation-from-plan:
    - "app/[account]/[event-slug]/_components/slot-picker.tsx (Option A architectural decision — kept on disk for app/reschedule/[token]/_components/reschedule-shell.tsx Phase-6 consumer. Original PLAN.md called for deletion.)"

key-decisions:
  - "Option A: keep slot-picker.tsx on disk as a Phase-6-only component for the reschedule page. (Rule 4 architectural decision routed to Andrew mid-execution; he chose Option A.)"
  - "Slot type sourcing: kept `import { type Slot } from \"./slot-picker\"` in booking-shell.tsx rather than moving the type definition. Smallest diff; preserves the existing source of truth; reschedule-shell.tsx continues to read Slot from slot-picker.tsx unchanged."
  - "Booker-side decoupling complete: booking-shell.tsx no longer imports SlotPicker (function/component); only imports the Slot type. The Phase 30 layout flattening is fully realized in the booker surface."

patterns-established:
  - "Mid-execution Rule 4 architectural-decision pattern: when the executor discovers an unanticipated importer of a 'to-be-deleted' file, surface as a Rule 4 architectural decision to the user before proceeding. Don't assume the file is safe to delete just because the active phase no longer needs it. Pattern is reusable for any future component-removal phase."
  - "Smallest-diff override of plan-locked refactor moves: when a plan locks a refactor (e.g., 'move type X from file A to file B'), and an architectural amendment changes the underlying assumption (file A no longer being deleted), the executor should pick the smallest-diff path to satisfy the new constraint (here: keep type X in file A and import from file A in file B). The plan's locked move was a means to an end, not the end itself."
  - "Process-level deviation documentation: SUMMARY records the Option A decision + the executor-surfaced trigger (unanticipated reschedule-shell.tsx importer) end-to-end so the audit trail is preserved. Parallels Plan 29-01 LD-07 deliberate-override pattern, but here it's a Rule 4 decision routed to user."

# Metrics
duration: ~13min
completed: 2026-05-03
---

# Phase 30 Plan 01: Public Booker 3-Column Desktop Layout Summary

**Flat 3-column desktop booker grid (calendar | times | form, all visible simultaneously) shipped via state-lift from slot-picker into booking-shell; slot-picker.tsx retained on disk as Phase-6-only component per mid-execution Option A architectural decision.**

## Performance

- **Duration:** ~13 min total wall clock (start ~2026-05-03T21:11Z, push 2026-05-03T21:18Z, summary 2026-05-03T21:18Z)
- **Tasks completed:** 1 of 2 originally planned (Task 1 = restructure; Task 2 = delete + commit + push, executed in amended form: no deletion, just commit + push)
- **Files modified:** 1 (booking-shell.tsx)
- **Files preserved (deviation):** 1 (slot-picker.tsx — Option A)

## Accomplishments

- **booking-shell.tsx is now the single grid owner.** Owns all slot-fetch state (`slots`, `loading`, `fetchError`), the date-range computation (`rangeFrom`, `rangeTo`), the canonical async-fetch effect on `/api/slots`, the `slotsByDate` / `markedDates` / `slotsForSelectedDate` derivations, and the `isCompletelyEmpty` shell-level branch.
- **3-column desktop grid live:** `lg:grid-cols-[minmax(280px,auto)_minmax(160px,auto)_320px]`, gap-6, p-6.
- **Form column always reserved at 320px.** Before slot pick: plain `<div>` placeholder ("Pick a time on the left to continue."). After slot pick: `<BookingForm key={selectedSlot.start_at} ...>`. Zero layout shift in calendar/times columns when slot is picked.
- **All locked constraints honored:**
  - V15-MP-05 Turnstile lifecycle lock — placeholder is `<div>`, NOT mounted form. Conditional ternary, no `invisible`/`hidden`/`&&`.
  - V15-MP-04 — timezone hint rendered as full-width `<p>` above the grid (display-only, no click handler).
  - Seamless single card — zero internal dividers; `border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6` aside removed entirely.
  - max-w-4xl on `<section>` wrapper; max-w-3xl on `<header>` wrapper preserved.
  - Selected-slot highlight ternary (`bg-primary text-primary-foreground border-primary` vs `bg-background hover:bg-muted border-border`) preserved verbatim.
  - Calendar's `justify-self-center rounded-md border` className preserved verbatim.
  - Empty-state branch handled at shell level (renders above the grid, full card width) instead of inside the calendar column.
  - Mobile (< lg:) collapses to natural single-column DOM order: calendar → times → form.
- **Embed wrapper untouched** (`app/embed/[account]/[event-slug]/...` not modified — `lg:` breakpoint provides automatic single-column at typical iframe widths).
- **Pushed to `main`; Vercel auto-deploy in flight.** Live testing per global preferences.

## Task Commits

1. **Task 1 (restructure booking-shell.tsx):** `8b45c50` (feat) — combined Task 1 + Task 2's commit step in a single feat commit per plan-locked single-commit batching.

**Plan metadata:** [pending — this SUMMARY commit]

## Files Created/Modified

- **Modified:** `app/[account]/[event-slug]/_components/booking-shell.tsx` — flat 3-col grid owner; slot-fetch state lifted in; Calendar + slot list + form column rendered as direct grid children; +201 / -35 lines.
- **Preserved (deviation):** `app/[account]/[event-slug]/_components/slot-picker.tsx` — kept on disk per Option A. No edits. Now Phase-6-only (sole consumer is `app/reschedule/[token]/_components/reschedule-shell.tsx`).

## Decisions Made

- **Option A — keep slot-picker.tsx on disk.** During Step 1 verification, executor ran `grep -rn "from .*slot-picker" app/ lib/ tests/` and discovered `app/reschedule/[token]/_components/reschedule-shell.tsx:6` still imports `{ SlotPicker, type Slot } from @/app/[account]/[event-slug]/_components/slot-picker` — confirmed by Phase 6 PLAN-04 (Plan 06-04 explicitly reused SlotPicker verbatim in the reschedule page with zero modifications, and Plan 06-VERIFICATION.md shows the wiring is live in production). Deleting slot-picker.tsx would have broken the reschedule page. Executor surfaced as Rule 4 architectural decision; Andrew chose **Option A** (keep file on disk, scope this plan to booker-side decoupling only). Plan 30-01's intent (3-col booker layout) is fully realized; the cleanup of the now-Phase-6-only file is deferred until reschedule itself is redesigned.
- **Slot type sourcing — smallest-diff path.** Original plan called for moving `Slot` interface into booking-shell.tsx and re-exporting. With Option A, slot-picker.tsx remains the source of truth (reschedule-shell still reads Slot from there). Executor kept `import { type Slot } from "./slot-picker"` in booking-shell.tsx — single-line diff, no duplicated type definition, no churn for reschedule-shell.tsx. This satisfies the locked-constraint that Slot type be available without forcing a structural move that no longer makes sense.
- **Plan-locked single-commit batching honored.** Task 1 + Task 2 originally split into two steps (restructure, then delete+commit). Under Option A there is nothing to delete, so the plan reduces to a single restructure + commit. One conventional commit captures the whole change. Matches the plan's single-feat-commit intent.

## Deviations from Plan

### Architectural decision (Rule 4 — routed to user)

**1. [Rule 4 — Architectural] slot-picker.tsx kept on disk; not deleted.**
- **Found during:** Task 1 Step 1 (grep verification of slot-picker importers).
- **Issue:** Plan called for deleting `slot-picker.tsx` after the booker decouples from it, but `app/reschedule/[token]/_components/reschedule-shell.tsx:6` still imports `{ SlotPicker, type Slot }` from that path. Phase 6 (cancel/reschedule lifecycle) deliberately reused SlotPicker verbatim and that wiring is live in production (Plan 06-04 SUMMARY + 06-VERIFICATION.md confirm). Deletion would break the reschedule page.
- **Action:** Executor stopped (per deviation Rule 4 — architectural change requires user decision), surfaced 3 options to Andrew (A: keep file as Phase-6-only / B: refactor reschedule to absorb the lift / C: extract a shared `<CalendarSlotPicker>`). Andrew picked **Option A**.
- **Resolution:** No deletion. `slot-picker.tsx` unchanged on disk. `booking-shell.tsx` no longer imports `SlotPicker` (the component); only imports `type Slot` from `./slot-picker` (smallest-diff path).
- **Files modified:** None for the deviation itself (only `booking-shell.tsx` for the planned restructure).
- **Verification:** `grep -rn "SlotPicker" app/[account]/[event-slug]/` → only `slot-picker.tsx` itself (the function/interface definitions). `grep -rn "from .*slot-picker" app/[account]/[event-slug]/` → only `booking-shell.tsx` line 8 (`import { type Slot }`). Reschedule-shell.tsx untouched.
- **Committed in:** N/A (the deviation is a no-op on git; only the planned restructure is in `8b45c50`).

### Verification-gate amendments executed

- Plan's project-wide gate `grep -rn "SlotPicker" app/ lib/ tests/ → 0` was REPLACED by `grep -rn "SlotPicker" app/[account]/[event-slug]/ → only slot-picker.tsx self-references`. Per amended scope. ✅
- Plan's `ls slot-picker.tsx → no such file` gate was REPLACED by `ls slot-picker.tsx → exists`. Per amended scope. ✅
- Plan's "may still import `type Slot` — that's acceptable" carve-out was exercised: booking-shell.tsx:8 retains `import { type Slot } from "./slot-picker"`.

### Commit message body amended

The original PLAN.md commit body said "slot-picker.tsx deleted; Slot type re-exported from booking-shell.tsx". The amended commit `8b45c50` body says "slot-picker.tsx retained on disk for reschedule-shell.tsx (Phase 6 consumer); booker no longer imports SlotPicker". All other lines verbatim.

---

**Total deviations:** 1 architectural (Rule 4, routed to user, resolved via Option A).
**Impact on plan:** Plan's primary objective (3-col booker layout) fully realized. Secondary objective (slot-picker.tsx deletion) deferred to a future phase when reschedule-shell.tsx is itself redesigned. No scope creep; smaller scope than originally planned.

## Issues Encountered

- The Phase 6 reschedule-page consumer of `SlotPicker` was not surfaced in Phase 30 RESEARCH.md or PLAN.md. RESEARCH.md cited STACK.md "Option C" (lift state out, delete child) without checking for non-booker consumers. Caught by the executor's pre-deletion grep (Task 1 Step 1). Plan-time research gap; not a runtime issue.
- Pre-existing tsc baseline (33 errors all in `tests/`) confirmed pre-edit. Zero new errors after the booking-shell.tsx restructure — confirmed by `npx tsc --noEmit | grep -c "error TS"` returning 33 both before and after.

## Test Suite

- **Pre-plan baseline:** 228 passed | 9 skipped (237 total) — captured via `npx vitest run`.
- **Post-edit:** 228 passed | 9 skipped (237 total) — identical, zero regression.
- **No tests added or modified** (plan was pure layout/state-lift; behavior unchanged).

## Git / Push

- **Feat commit:** `8b45c50` (1 file changed, 201 insertions, 35 deletions).
- **Files staged:** ONLY `app/[account]/[event-slug]/_components/booking-shell.tsx` (per-file `git add`, no `-A` / `.`).
- **Pre-existing `02-VERIFICATION.md` drift:** Confirmed UNSTAGED. `git status` post-commit shows `M .planning/phases/02-owner-auth-and-dashboard-shell/02-VERIFICATION.md` still in working tree.
- **Push:** `eb220bd..8b45c50 main -> main` (push range includes the prior 3 phase-30 docs commits + the new feat). Push exit 0.
- **Vercel auto-deploy:** triggered; Andrew will eyeball in Plan 30-02.

## Future Follow-Ups

- **`slot-picker.tsx` is now Phase-6-only.** When the reschedule page (`app/reschedule/[token]/_components/reschedule-shell.tsx`) is itself redesigned in a future phase, evaluate whether to:
  1. Lift the same slot-fetch state into `reschedule-shell.tsx` and delete `slot-picker.tsx` outright (matching the Plan 30-01 booker pattern).
  2. Extract a shared `<CalendarSlotPicker>` primitive that both `booking-shell.tsx` (re-coupled) and the reschedule page consume.
  3. Keep `slot-picker.tsx` indefinitely as the reschedule-only component.
  Recommended: Option 1 if reschedule is ever rebuilt for layout parity with the new 3-col booker; Option 2 if a third surface ever needs the same primitive. Defer until there's a concrete reschedule redesign plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 30-02 (Andrew live-verify smoke) is the next step.** This plan does NOT include human-verify; Plan 30-02 is the dedicated checkpoint at 1024/1280/1440px desktop + mobile real-device.
- **Vercel deploy in flight; Andrew should wait for build success before opening the booker.**
- **No blockers.** All locked constraints satisfied; pre-existing drift untouched; test suite green at baseline.
- **Phase 30 progress:** 1 of 2 plans complete. Plan 30-02 awaits live deploy + Andrew eyeball.
- **v1.5 progress:** 5 of 6 plans complete after this push (Phase 28's 3 plans + Phase 29's 1 plan + Phase 30's Plan 01 = 5; Plan 30-02 = the last v1.5 plan).

---
*Phase: 30-public-booker-3-column-layout*
*Completed: 2026-05-03*
