---
phase: 17-public-surfaces-and-embed
plan: 04
subsystem: ui
tags: [next.js, tailwind, public-shell, branding, booking, confirmation]

# Dependency graph
requires:
  - phase: 17-02
    provides: PublicShell Server Component with dual CSS vars (--brand-primary + --primary), BackgroundGlow, Header(public), PoweredByNsi

provides:
  - Booking page (/[account]/[event-slug]) wrapped in PublicShell (PUB-06)
  - Confirmation page (/[account]/[event-slug]/confirmed/[booking-id]) both branches wrapped in PublicShell (PUB-07)
  - v1.2 card lock applied to confirmation cards (rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm)

affects:
  - Phase 18 (branding editor — public surface now drives PublicShell visual)
  - Phase 20 (dead code cleanup — BrandedPage no longer consumed by booking flow)
  - Phase 21 (schema DROP — background_shade/background_color no longer read in booking page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Booking flow page migration pattern: brandingFromRow(data.account) → PublicShell props, BookingShell as direct child"
    - "Confirmation page migration: brandingFromRow partial row ({logo_url, brand_primary}) when full row unavailable"
    - "Nested main avoidance: PublicShell owns <main>; page-level containers use <div>"

key-files:
  created: []
  modified:
    - app/[account]/[event-slug]/page.tsx
    - app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx

key-decisions:
  - "brandingFromRow receives partial row on confirmation page (only logo_url + brand_primary exposed by loadConfirmedBooking) — safe because brandingFromRow defaults all missing optional fields"
  - "Stale PLAN-05-06-REPLACE-* comment markers removed from booking page as part of tidy-up (no functional impact)"
  - "Containers inside PublicShell use <div> not <main> — PublicShell renders its own <main className='pt-20 md:pt-24 pb-12'>; nested main would be invalid HTML"

patterns-established:
  - "PublicShell migration pattern: import PublicShell + brandingFromRow, derive branding, wrap root return, replace main with div for inner containers"

# Metrics
duration: 10min
completed: 2026-04-30
---

# Phase 17 Plan 04: Booking and Confirmed Migration Summary

**Booking page and both confirmation branches migrated from BrandedPage to PublicShell; confirmation cards standardized to v1.2 lock (rounded-xl border-gray-200 bg-white shadow-sm) and checkmark var(--brand-primary) preserved**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-30T00:00:00Z
- **Completed:** 2026-04-30T00:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Booking page (`/[account]/[event-slug]`) now renders BookingShell inside PublicShell — slot picker selected state and BookingForm submit button inherit customer brand color via --primary/--brand-primary CSS vars set by PublicShell (no SlotPicker or BookingForm code changes needed)
- Confirmation page (`/[account]/[event-slug]/confirmed/[booking-id]`) has both branches (`!isConfirmed` fallback + `isConfirmed` happy path) wrapped in PublicShell with branding derived from partial account row
- Both confirmation cards updated to v1.2 card lock: `rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm`; checkmark `var(--brand-primary, #0A2540)` inline styles preserved verbatim and now resolve to customer color via PublicShell
- Stale PLAN-05-06-REPLACE-INLINE-* comment markers removed from booking page

## Task Commits

1. **Task 1: Migrate booking page to PublicShell** - `be25c84` (refactor)
2. **Task 2: Migrate confirmation page (both branches) to PublicShell** - `bc9b790` (refactor)

**Plan metadata:** _(pending)_

## Files Created/Modified

- `app/[account]/[event-slug]/page.tsx` - Replaced BrandedPage + backgroundShade local var with PublicShell + brandingFromRow; removed stale PLAN-05-06 markers; BookingShell is direct child
- `app/[account]/[event-slug]/confirmed/[booking-id]/page.tsx` - Replaced BrandedPage in both branches with PublicShell; added brandingFromRow partial row call; upgraded card classes to v1.2 lock; replaced nested `<main>` with `<div>`; BookingRow + maskEmail helpers unchanged

## Decisions Made

- **brandingFromRow receives partial row on confirmation page:** The `loadConfirmedBooking` loader only exposes `logo_url` and `brand_primary` on the account object. Passing `{ logo_url, brand_primary }` to brandingFromRow is safe — all other fields (`background_color`, `background_shade`, `chrome_tint_intensity`, `sidebar_color`) are optional and default cleanly in brandingFromRow.
- **Stale PLAN-05-06 markers removed:** The `PLAN-05-06-REPLACE-IMPORT-START/END` and `PLAN-05-06-REPLACE-INLINE-START/END` comment blocks in the booking page were Phase 5 artifacts marking a swap point from 2024. They served no current purpose and were removed as part of the migration tidy-up.
- **Inner containers use `<div>` not `<main>`:** PublicShell renders `<main className="pt-20 md:pt-24 pb-12">` around children. Having a second `<main>` inside would be invalid HTML (only one landmark per page). Both confirmation branches replaced `<main>` with `<div>` for their inner layout containers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing `app/[account]/page.tsx` TypeScript error (TS2739 missing `backgroundColor`/`backgroundShade` props) was present on baseline before this plan ran — confirmed by stash comparison. That error was resolved by a parallel Wave 3 plan (17-03 or similar) modifying `app/[account]/page.tsx`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Booking flow (pick slot → fill form → confirm) now fully on PublicShell with customer brand color driving glow, glass pill, slot picker selected state, form submit button, and confirmation checkmark
- BrandedPage is no longer consumed by any page in the booking flow — Phase 20 dead code cleanup can safely audit BrandedPage's remaining consumers
- The `background_shade` and `background_color` account columns are no longer read by the booking page — Phase 21 schema DROP preparation is unblocked for those columns

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
