---
phase: 24-owner-ui-polish
plan: 01
subsystem: ui
tags: [tailwind, react-day-picker, shadcn, calendar, theming, owner-ui]

# Dependency graph
requires:
  - phase: 23-public-booking-fixes
    provides: "Phase 23 invariant — shared components/ui/calendar.tsx untouchable; per-instance overrides only"
provides:
  - "Grey-only day-button affordances on /app/home (hover, selected, today, has-bookings)"
  - "Closure of OWNER-12 orange-leak bug"
  - "Pattern: per-instance className overrides for shadcn Calendar to avoid touching shared component or shared tokens"
affects: [phase-24-plan-02-copyable-link, future-owner-ui-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-instance Tailwind className overrides for shadcn Calendar DayButton — avoids both shared-component edits AND shared-token edits when other consumers depend on the token"

key-files:
  created: []
  modified:
    - "app/(shell)/app/_components/home-calendar.tsx — DayButton hover/selected/today classes + booking-dot color"

key-decisions:
  - "Selected day uses bg-gray-700 + text-white (NOT NSI blue / bg-primary) per CONTEXT.md 'all grey, no brand color' lock"
  - "Today affordance is grey-only: bg-muted + font-semibold + ring-1 ring-gray-300 (no orange, no brand fill)"
  - "Booking dot color hard-coded to #9CA3AF (Tailwind gray-400) inline-style — does NOT use --color-accent token (which 3 other consumers depend on)"
  - "globals.css --color-accent token PRESERVED — public booker .day-has-slots dot, bookings-table hover, cancel-confirm-form hover all keep orange"

patterns-established:
  - "When a CSS custom property is shared across multiple consumers and only ONE needs to change, override at the consumer site (per-instance className or inline style) instead of redefining the token globally"

# Metrics
duration: ~6min
completed: 2026-05-02
---

# Phase 24 Plan 01: Home Calendar De-Orange Summary

**De-oranged /app/home day-button states (hover, selected, today, has-bookings dot) to a grey-only treatment via per-instance overrides; preserved shared --color-accent token for three other consumers.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-02T23:00:00Z (approx)
- **Completed:** 2026-05-02T23:06:15Z
- **Tasks:** 1 of 1
- **Files modified:** 1

## Accomplishments
- Eliminated orange `#F97316` (`--color-accent`) leak from `/app/home` monthly calendar
- All four day-button states now grey: hover (gray-100), selected (gray-700), today (gray-300 ring + bold), has-bookings dot (#9CA3AF)
- Shared `components/ui/calendar.tsx` and `app/globals.css` preserved unchanged (Phase 23 invariant + 3-consumer token preservation)
- `npm run build` passes; full test suite (222 passed, 4 skipped) passes with no new failures

## Task Commits

Each task was committed atomically:

1. **Task 1: De-orange the DayButton** — `2397f4c` (fix)

**Plan metadata:** _pending — committed after this SUMMARY.md is written_

## Files Created/Modified
- `app/(shell)/app/_components/home-calendar.tsx` — Three className/style edits inside the custom `DayButton`:
  - **Edit 1 (line 73):** `hover:bg-accent hover:text-accent-foreground` → `hover:bg-gray-100 hover:text-gray-900`
  - **Edit 2 (lines 75-79):** Selected branch `bg-primary text-primary-foreground` → `bg-gray-700 text-white`; today branch `bg-muted text-foreground` → `bg-muted text-foreground font-semibold ring-1 ring-gray-300 rounded-[var(--cell-radius,var(--radius-md))]`
  - **Edit 3 (lines 96-100):** Booking-dot inline style `backgroundColor: hsl(var(--primary))` → `backgroundColor: "#9CA3AF"`

## Decisions Made
- **Selected = gray-700 (NOT bg-primary):** Plan and CONTEXT.md explicitly lock to "all grey, no brand color" — the original Phase 7 design used NSI blue but Andrew chose pure grey for v1.3.
- **Today = grey ring + bold (NOT solid grey fill):** The today state shares `bg-muted` with the default neutral background, so visual distinction now comes from `font-semibold` + `ring-1 ring-gray-300` rather than a fill swap. This keeps the today affordance subtle and grey-only.
- **Inline `#9CA3AF` hex (NOT a Tailwind class or new token):** Hard-coded gray-400 hex matches v1.2 MP-04 pattern (runtime hex via inline style only; never `bg-[${color}]` JIT). Avoids introducing a new design token for a single-use color.
- **--color-accent preserved:** RESEARCH.md confirmed three other consumers (`.day-has-slots::after`, bookings-table hover, cancel-confirm-form hover) depend on the orange `--color-accent`. Per-instance override at the home-calendar site is the surgical fix.

## Deviations from Plan

None — plan executed exactly as written. All three edits applied verbatim from the plan's task spec. All 8 grep verifications passed on first attempt:
- `hover:bg-gray-100 hover:text-gray-900` → 1 match (line 73) ✓
- `hover:bg-accent` → 0 matches ✓
- `bg-gray-700 text-white` → 1 match (line 76) ✓
- `bg-primary text-primary-foreground` → 0 matches ✓
- `ring-1 ring-gray-300` → 1 match (line 78) ✓
- `"#9CA3AF"` → 1 match (line 99) ✓
- `hsl(var(--primary))` → 0 matches ✓
- `git status components/ui/calendar.tsx app/globals.css` → clean ✓

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

**Visual confirmation pending Andrew's live deploy.** Per Phase 23 protocol, the production gate is deploy-and-eyeball: push to GitHub → Vercel preview → Andrew verifies on `/app/home` that no day-button state shows orange and that selected/today/has-bookings affordances read as grey-only.

## Next Phase Readiness
- Plan 24-01 done; Phase 24 has one more plan to execute: **24-02** (OWNER-13 — copyable booking link on event-type edit page).
- No blockers. Phase 24 can proceed to Plan 02 immediately, or pause here for Andrew's live-deploy verification of the de-orange change.
- Once Plan 24-02 ships and Andrew approves both OWNER-12 + OWNER-13 on live, **Phase 24 closes → v1.3 milestone closes** (final phase of v1.3).

---
*Phase: 24-owner-ui-polish*
*Completed: 2026-05-02*
