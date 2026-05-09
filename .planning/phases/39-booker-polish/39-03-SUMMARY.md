---
phase: 39-booker-polish
plan: 03
subsystem: ui
tags: [animation, accessibility, tailwind, tw-animate-css, prefers-reduced-motion, booker]

# Dependency graph
requires:
  - phase: 39-booker-polish
    provides: "Plan 39-01 V15-MP-05 mount lock (BookingForm mounts once, never remounts on re-pick); Plan 39-02 BookingFormSkeleton placeholder for pre-slot state"
provides:
  - "220ms fade + 8px rise entry animation on form column at first slot pick"
  - "Defense-in-depth @media (prefers-reduced-motion: reduce) override that nullifies tw-animate-css enter/exit keyframes"
  - "CLS = 0 booker interaction (transform/opacity-only animation)"
affects: [booker-polish, accessibility, future-booker-ui-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wrapper-div animation pattern: animate on a parent div (no key prop) so child component never remounts — animation fires once on first mount, never re-fires on prop changes"
    - "Belt-and-suspenders reduced-motion: combine Tailwind motion-reduce: variant with explicit @media (prefers-reduced-motion: reduce) CSS override for tw-animate-css utilities"

key-files:
  created: []
  modified:
    - "app/[account]/[event-slug]/_components/booking-shell.tsx"
    - "app/globals.css"

key-decisions:
  - "Used duration-[220ms] (Tailwind v4 arbitrary value) instead of duration-220 (invalid scale value flagged in RESEARCH Pitfall 2)"
  - "No key prop on wrapper div — keying would remount on slot re-pick and defeat Plan 39-01's mount lock; animation fires only on first mount (selectedSlot transitions from null → first slot)"
  - "Added CSS @media reduced-motion override despite Tailwind motion-reduce: variant — RESEARCH Open Questions #1 flagged motion-reduce: × tw-animate-css interaction as MEDIUM confidence; pre-included fallback rather than treat as contingent"
  - "Animated only the form column (not the skeleton) — skeleton appears on initial paint, not as a transition target"

patterns-established:
  - "Entry-animation wrapper: <div className=\"animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none\"> wraps a stable child"
  - "Reduced-motion safeguard rule lives in globals.css under tw-animate-css imports, targeting .animate-in/.animate-out globally"

# Metrics
duration: 15min
completed: 2026-05-08
---

# Phase 39 Plan 03: Entry Animation and Reduced Motion Summary

**220ms fade + 8px rise entry animation on form column at first slot pick via tw-animate-css wrapper div, with @media (prefers-reduced-motion: reduce) defense-in-depth override in globals.css**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 auto + 1 human-verify checkpoint
- **Files modified:** 2

## Accomplishments

- Form column now animates in smoothly on first slot pick (fade + ~8px upward rise over 220ms, transform/opacity only)
- Animation does NOT re-fire on slot re-pick — wrapper has no `key` prop, so React keeps `BookingForm` mounted and animate-in only triggers on first mount
- OS reduced-motion (macOS Reduce Motion / Windows Animation effects OFF) fully suppresses the animation — instant skeleton-to-form swap
- CLS = 0 across full booker interaction (Andrew confirmed in DevTools Performance)
- V15-MP-05 mount lock from Plan 39-01 remains intact: BookingForm mounts once, fields persist across re-picks, Turnstile token does not stale

## Task Commits

1. **Task 1: Wrap BookingForm in animate-in wrapper div** — `c3108b3` (feat)
2. **Task 2: Add reduced-motion CSS override in globals.css** — `0595108` (feat)

Both commits pushed to `origin/main`.

## Files Created/Modified

### `app/[account]/[event-slug]/_components/booking-shell.tsx` (modified)

Wrapped `<BookingForm>` in an animation div inside the `selectedSlot ? ... : <BookingFormSkeleton />` ternary:

```tsx
{selectedSlot ? (
  <div className="animate-in fade-in slide-in-from-bottom-2 duration-[220ms] ease-out motion-reduce:animate-none">
    <BookingForm
      accountSlug={account.slug}
      eventType={eventType}
      selectedSlot={selectedSlot}
      bookerTimezone={bookerTz}
      onRaceLoss={handleRaceLoss}
    />
  </div>
) : (
  <BookingFormSkeleton />
)}
```

Critical: the wrapper has NO `key` prop — keying would remount on slot re-pick and re-trigger animate-in, defeating Plan 39-01's mount lock. The skeleton is intentionally NOT wrapped (it's an initial-paint placeholder, not a transition target).

### `app/globals.css` (modified)

Added defense-in-depth reduced-motion block after the `@import "tw-animate-css";` import:

```css
/* Phase 39: defense-in-depth reduced-motion override.
   tw-animate-css drives entry/exit via CSS custom properties; Tailwind's
   `motion-reduce:animate-none` variant SHOULD nullify it, but this @media
   rule is a belt-and-suspenders safeguard so the animation is fully
   cancelled for any user with prefers-reduced-motion: reduce. */
@media (prefers-reduced-motion: reduce) {
  .animate-in,
  .animate-out {
    animation: none !important;
    transition: none !important;
  }
}
```

This nullifies the tw-animate-css `animate-in`/`animate-out` keyframes globally for any user with OS reduced-motion enabled — protects against future entry animations beyond just the booker form.

## Decisions Made

- **`duration-[220ms]` (arbitrary value), not `duration-220`** — Tailwind v4 doesn't have a 220 step on the duration scale; arbitrary value is the only correct form (RESEARCH Pitfall 2).
- **No `key` prop on the wrapper div** — keying would remount the wrapper on every `selectedSlot` change and re-trigger animate-in, defeating Plan 39-01's V15-MP-05 mount lock and re-challenging Turnstile.
- **CSS override added pre-emptively, not contingently** — RESEARCH Open Questions #1 flagged `motion-reduce:` × `tw-animate-css` interaction as MEDIUM confidence; belt-and-suspenders is cheaper than discovering reduced-motion is broken in production.
- **Skeleton NOT wrapped in animate-in** — `BookingFormSkeleton` is the initial-paint state, not a transition target; animating it would cause a visible flicker on hard-refresh.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Live Verification (Andrew, 2026-05-08)

All three checkpoint sections passed live in production:

### Section A: Animation correctness (reduced-motion OFF)
- Form column fades in and rises ~8px smoothly over ~220ms on first slot pick — confirmed
- Re-picking a different slot does NOT re-animate the form column — confirmed
- DevTools Performance: Cumulative Layout Shift = 0 — Andrew confirmed in DevTools Performance

### Section B: Reduced-motion correctness
- With OS reduced-motion enabled (macOS Reduce Motion ON / Windows Animation effects OFF), form appears INSTANTLY on slot pick — no fade, no rise, no transition
- Disabling OS reduced-motion and hard-refreshing restored the animation — confirmed

### Section C: V15-MP-05 lock still intact (regression check)
- `BookingForm` absent in React DevTools before any slot pick — confirmed
- After picking slot A, typing a name, and waiting for Turnstile to solve, picking slot B keeps `BookingForm` mounted (no remount) — confirmed
- Name field retained typed value across re-pick; Turnstile not re-challenged — confirmed
- Booking submitted successfully — confirmed

## Next Phase Readiness

- All four phase Success Criteria for Phase 39 are now met (combined with Plans 39-01 and 39-02):
  1. 200-250ms entry via transform/opacity only, CLS = 0 ✓
  2. Skeleton placeholder pre-pick ✓ (Plan 39-02)
  3. Reduced-motion suppresses animation entirely ✓
  4. BookingForm absent pre-pick, mounted-once post-pick, Turnstile token does not stale ✓ (Plan 39-01 + verified here)
- Phase 39 is ready for closeout. No blockers, no concerns carried forward.

---
*Phase: 39-booker-polish*
*Completed: 2026-05-08*
