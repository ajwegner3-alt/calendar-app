---
phase: 39-booker-polish
plan: 02
subsystem: ui
tags: [react, tailwind, skeleton, booker, booking-form, placeholder, ssr]

# Dependency graph
requires:
  - phase: 39-booker-polish
    provides: Plan 39-01 V15-MP-05 lock (BookingForm absent before slot pick) and stable BookingShell conditional render structure
provides:
  - Static (no-pulse) BookingFormSkeleton component for the pre-slot form column
  - Wired conditional render in booking-shell.tsx that reserves form-column footprint on first paint
  - Helper copy "Pick a time to continue" inside the skeleton column for next-step clarity
affects: [39-03 form-arrival animation, future booker UX work, any phase touching booking-shell pre-slot state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static shape-only placeholders (flat bg-muted blocks, no animate-pulse) for 'waiting on user input' states — distinct from 'system is loading' which uses pulse"
    - "aria-hidden on decorative skeleton; helper copy carries the SR semantics"
    - "Custom skeleton primitive (not shadcn <Skeleton/>) when pulse semantics are wrong for the use case"

key-files:
  created:
    - app/[account]/[event-slug]/_components/booking-form-skeleton.tsx
  modified:
    - app/[account]/[event-slug]/_components/booking-shell.tsx

key-decisions:
  - "Static blocks over animate-pulse — 'waiting on user input' is semantically distinct from 'system loading'; pulse would mislead"
  - "Inline helper copy 'Pick a time to continue' inside the skeleton column rather than a separate empty-state component"
  - "Did NOT use shadcn <Skeleton/> primitive because it ships with animate-pulse baked in"

patterns-established:
  - "Pre-interaction form placeholder: shape-mirror the real form's fields (3 label/input pairs + Turnstile + submit) to preserve visual rhythm without CLS concern"
  - "Decorative skeletons get aria-hidden; meaningful instruction lives in adjacent visible text"

# Metrics
duration: ~15min
completed: 2026-05-08
---

# Phase 39 Plan 02: Skeleton Placeholder Summary

**Static shape-only BookingFormSkeleton replaces the bare-text pre-slot placeholder — reserves the 320px form-column footprint without falsely implying a loading state.**

## Performance

- **Duration:** ~15 min (2 atomic auto tasks + human-verify checkpoint)
- **Completed:** 2026-05-08
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files created:** 1
- **Files modified:** 1

## Accomplishments
- New `BookingFormSkeleton` component: 8 static shape blocks (3 label/input pairs + Turnstile-shaped 300x65 block + submit button) plus centered helper copy
- Replaced the bare `<div>Pick a time on the left to continue.</div>` placeholder in `booking-shell.tsx` with `<BookingFormSkeleton />`
- Form-column footprint now reserved on first paint — no layout shift when a slot is picked and the real form mounts
- V15-MP-05 lock from Plan 39-01 verified to still hold (BookingForm absent in DOM before slot pick)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BookingFormSkeleton component (static, no pulse)** — `672500b` (feat)
2. **Task 2: Wire BookingFormSkeleton into booking-shell.tsx** — `8223203` (feat)

**Plan metadata:** `docs(39-02): complete skeleton-placeholder plan` (this commit)

## Files Created/Modified
- `app/[account]/[event-slug]/_components/booking-form-skeleton.tsx` — NEW. 45-line component exporting `BookingFormSkeleton`. 8 static `bg-muted` blocks shaped to mirror BookingForm's real fields. `aria-hidden="true"` on the wrapper. Inline helper copy "Pick a time to continue". No `animate-pulse`. No `"use client"` directive (server-friendly).
- `app/[account]/[event-slug]/_components/booking-shell.tsx` — MODIFIED. Added `import { BookingFormSkeleton } from "./booking-form-skeleton";` near the existing `BookingForm` import, then replaced the bare-text else branch of the `selectedSlot ? <BookingForm /> : ...` ternary with `<BookingFormSkeleton />`. Wrapping div and surrounding logic untouched. Net change: +2/-3 lines.

## Decisions Made
- **Static over pulse:** `animate-pulse` reads as "system is loading" but the booker is waiting on user input — different semantic. Flat `bg-muted` blocks signal "shape will appear here" without lying about state.
- **Custom component over shadcn `<Skeleton/>`:** The shadcn primitive includes `animate-pulse` by default; rather than override it everywhere, a purpose-built local component is clearer and self-documenting.
- **Helper copy lives inside the skeleton column, not above the calendar:** keeps the next-action affordance co-located with where the form will render, preserving the user's eye path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Live Verification (Andrew, 2026-05-08)

Andrew approved on production after deploy. All 5 checkpoint steps passed:

1. Desktop pre-slot: form column shows 3 label/input pairs, 300x65 Turnstile-shaped block, submit-button-shaped block, and "Pick a time to continue" centered text.
2. Static blocks confirmed — no pulse/shimmer observed over 5+ seconds of inspection.
3. Mobile (< `lg` breakpoint): skeleton stacks below calendar in single-column layout, full width, same shape, helper copy still centered.
4. Slot pick swaps skeleton out for real `<BookingForm />` instantly (animation deferred to Plan 39-03).
5. V15-MP-05 lock holds — `BookingForm` still absent from DOM before any slot is selected.

## Next Phase Readiness
- Form-column footprint is now stable across pre-slot and post-slot states, which is the prerequisite Plan 39-03 needs to layer in the form-arrival animation without compounding layout shift.
- Skeleton/Form swap is currently instantaneous; Plan 39-03 will replace the swap with a fade/slide transition.
- No blockers for the remainder of Phase 39.

---
*Phase: 39-booker-polish*
*Completed: 2026-05-08*
