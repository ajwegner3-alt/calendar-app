---
phase: 23-public-booking-fixes
plan: 02
subsystem: ui
tags: [tailwind, react, calendar, layout, slot-picker, mobile, responsive]

# Dependency graph
requires:
  - phase: 23-public-booking-fixes-01
    provides: public-booking-page public-slot-picker component
provides:
  - PUB-13: mobile Calendar mx-auto centering in slot-picker.tsx
  - PUB-14: timezone hint hoisted above grid wrapper as full-width header
affects:
  - Phase 24 (Owner UI Polish) — slot-picker.tsx layout is stabilized; any future edits to the component should maintain fragment-root pattern

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-instance Calendar className override (mx-auto) rather than touching shared components/ui/calendar.tsx — avoids cross-phase regression"
    - "React fragment root (<>) for slot-picker main return — enables full-width siblings above grid without extra DOM wrapper"

key-files:
  created: []
  modified:
    - app/[account]/[event-slug]/_components/slot-picker.tsx

key-decisions:
  - "DO NOT modify components/ui/calendar.tsx — per-instance mx-auto override is safer (Phase 24 uses calendar; shared-component edit = cross-phase regression risk)"
  - "React fragment, not wrapping div — extra DOM node would introduce unwanted spacing/layout drift"
  - "Timezone hint kept as <p> (not a heading element) — preserves visual hierarchy already in design"
  - "Pick a date copy stays in right-column conditional ladder — aligns with RESEARCH.md recommendation (provides contextual guidance when no date selected)"

patterns-established:
  - "Per-instance className override for w-fit centering: add mx-auto to the component's className prop, not the shared component's defaults"
  - "Fragment-root return pattern for slot-picker: <> tz-hint </> then grid — natural reading order on mobile (top-to-bottom: hint, calendar, slots)"

# Metrics
duration: 3min
completed: 2026-05-02
---

# Phase 23 Plan 02: Public Booking Fixes (PUB-13 + PUB-14) Summary

**Two surgical edits to slot-picker.tsx: mx-auto centers the w-fit calendar on mobile; React fragment hoists timezone hint above the two-column grid as a full-width desktop header**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-02T19:29:07Z
- **Completed:** 2026-05-02T19:32:06Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- PUB-13 closed: `<Calendar className="mx-auto rounded-md border">` centers the `w-fit` calendar within the full-width mobile grid cell without touching the shared `components/ui/calendar.tsx`
- PUB-14 closed: timezone hint `<p>` hoisted above the `grid gap-6 lg:grid-cols-2` wrapper inside a React fragment — renders as a full-width top-level label on desktop, natural first item on mobile
- Build passes cleanly (Next.js 16.2.4 Turbopack, TypeScript clean)
- Test suite unchanged: 222 passing, 4 skipped — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: PUB-13 — Add mx-auto to Calendar className for mobile centering** - `7467dae` (fix)
2. **Task 2: PUB-14 — Hoist timezone hint above the grid wrapper** - `e94a287` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/[account]/[event-slug]/_components/slot-picker.tsx` — Two edits: (1) `className="mx-auto rounded-md border"` on `<Calendar>`; (2) main return restructured to `<>` fragment with timezone `<p>` as first child, then `<div className="grid gap-6 lg:grid-cols-2">` below it

## Decisions Made

1. **No shared Calendar component modification** — `components/ui/calendar.tsx` sets `classNames.root = "w-fit ..."` intentionally for desktop. Touching it would affect Phase 24's `/app/home` calendar requirement and create cross-phase regression risk. Per-instance `mx-auto` override is the correct scoped fix.

2. **React fragment, not wrapping div** — A `<div>` around the fragment would add an extra DOM node, introducing potential spacing and layout drift in the booking card. Fragment gives the timezone hint and the grid a clean sibling relationship.

3. **Timezone hint kept as `<p>`, not a heading element** — The existing `text-xs text-muted-foreground` styling is already a visual indicator; promoting it to `<h3>` etc. would affect heading hierarchy without design spec approval.

4. **"Pick a date" copy stays in right column** — CONTEXT.md delegates this to Claude's discretion; RESEARCH.md recommends keeping it. It provides meaningful contextual guidance when no date is selected.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — both edits applied cleanly, build passed first run, tests unchanged.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PUB-13 and PUB-14 are code-complete. Visual confirmation is pending Andrew's live deploy review (push to Vercel and eyeball on mobile + desktop).
- PUB-15 (account-index event-type cards page, `app/[account]/page.tsx`) is handled by plan 23-01 (parallel agent).
- Phase 24 (Owner UI Polish: home calendar highlight removal, copyable booking link) can begin once Phase 23 plans are deployed and visually approved.

---
*Phase: 23-public-booking-fixes*
*Completed: 2026-05-02*
