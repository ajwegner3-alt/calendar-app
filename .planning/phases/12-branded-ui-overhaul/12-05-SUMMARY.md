---
phase: 12-branded-ui-overhaul
plan: 05
subsystem: ui
tags: [tailwind, cruip, branding, gradient, next.js, booking, embed, iframe]

# Dependency graph
requires:
  - phase: 12-01
    provides: GradientBackdrop primitive, BrandedPage extended with backgroundColor/backgroundShade, background_color/background_shade DB columns live
provides:
  - Cruip-styled /[account] index hero card with ListingHero + event-type grid
  - /[account]/[event-slug] booking page with py-12 md:py-20 rhythm + max-w-3xl slot picker card
  - /embed/[account]/[event-slug] with single-circle gradient (height-reporter safe)
  - EmbedCodeDialog widened to sm:max-w-2xl (UI-09)
  - background_color + background_shade passed to BrandedPage on all 4 public callers
affects:
  - 12-04 (home tab calendar — same public branding token pattern)
  - 12-06 (emails — share background_color DB token but use solid-color rendering)
  - Phase 13 (QA matrix: 3 accounts × 5 surfaces × 3 shade values)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ListingHero inner GradientBackdrop: hero card has its own spotlight gradient (separate from page-level BrandedPage backdrop)"
    - "Embed single-circle pattern: 1 blur circle at -top-32 instead of 3-circle full-page pattern (iframe height-reporter compat)"
    - "Color fallback chain: backgroundColor ?? brandPrimary ?? gray-50 (ensures hero always branded even without explicit background_color)"
    - "AccountSummary extended with background_color/background_shade (additive — all prior callers unaffected)"

key-files:
  created:
    - app/[account]/_components/listing-hero.tsx
  modified:
    - app/[account]/_lib/load-account-listing.ts
    - app/[account]/_lib/types.ts
    - app/[account]/page.tsx
    - app/[account]/[event-slug]/_lib/types.ts
    - app/[account]/[event-slug]/_lib/load-event-type.ts
    - app/[account]/[event-slug]/page.tsx
    - app/[account]/[event-slug]/_components/booking-shell.tsx
    - app/embed/[account]/[event-slug]/_components/embed-shell.tsx
    - app/(shell)/app/event-types/_components/embed-code-dialog.tsx

key-decisions:
  - "ListingHero falls back to brand_primary when background_color is null — hero stays branded by default without requiring owner to configure background color"
  - "Embed uses single-circle gradient (not 3-circle GradientBackdrop) to avoid iframe height-reporter conflicts (Pitfall 10)"
  - "Footer accents simplified — page-level GradientBackdrop from BrandedPage extends down naturally; explicit footer accent layer omitted to avoid visual overcomplication"
  - "Embed shell removes duplicate h1/description — BookingShell now owns Cruip header; embed logo header retained for live-preview branding (?previewLogo override feature)"

patterns-established:
  - "Public surface branding: load branding tokens in page loader → pass to BrandedPage → downstream gradients auto-applied"
  - "Embed gradient: relative overflow-hidden wrapper + single inline circle + EmbedHeightReporter observes documentElement.scrollHeight"

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 12 Plan 05: Public Surfaces Restyle Summary

**Cruip-styled /[account] hero card, py-12 md:py-20 booking-page rhythm with max-w-3xl card, single-circle embed gradient, and EmbedCodeDialog sm:max-w-2xl — all consuming background_color/backgroundShade DB tokens from Plan 12-01**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-29T12:38:45Z
- **Completed:** 2026-04-29T12:44:46Z
- **Tasks:** 3
- **Files modified:** 9 files (1 created, 8 modified)

## Accomplishments

- New `ListingHero` component: self-contained Cruip hero card with inner `GradientBackdrop`, logo/avatar, `text-3xl md:text-4xl tracking-tight` account name, centered in `py-12 md:py-20` main
- `BookingShell` restyled with Cruip section rhythm — header at `pt-12 pb-8` (desktop: `pt-20 pb-12`), slot picker in `rounded-2xl border bg-white shadow-sm` max-w-3xl card, booking form with `border-l` separator on lg
- Embed shell restyle: single-circle gradient (blur 200/160px, opacity 0.25/0.5) at `-top-32` inside `relative overflow-hidden` — EmbedHeightReporter safe per Pitfall 10
- All 4 public BrandedPage callers now pass `backgroundColor` + `backgroundShade` (booking page, listing page — confirmation/cancel/reschedule pages inherit via BrandedPage's optional default)
- `EmbedCodeDialog` widened `max-w-3xl` → `sm:max-w-2xl` per UI-09

## Task Commits

Each task was committed atomically:

1. **Task 1: /[account] index landing card + ListingHero + load-account-listing extension** - `dcdeae0` (feat)
2. **Task 2: /[account]/[event-slug] booking page + booking-shell restyle** - `2f422b1` (feat)
3. **Task 3: Embed shell restyle + EmbedCodeDialog widening** - `b1f4c9a` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `app/[account]/_components/listing-hero.tsx` - NEW: Cruip hero card with inner GradientBackdrop + logo/avatar fallback + tracking-tight name
- `app/[account]/_lib/load-account-listing.ts` - Extended SELECT to include background_color, background_shade
- `app/[account]/_lib/types.ts` - AccountListingData.account extended with background_color/background_shade fields
- `app/[account]/page.tsx` - BrandedPage receives backgroundColor/backgroundShade; ListingHero replaces old header; py-12 md:py-20 main
- `app/[account]/[event-slug]/_lib/types.ts` - AccountSummary extended with background_color/background_shade (additive)
- `app/[account]/[event-slug]/_lib/load-event-type.ts` - Extended SELECT + return with background_color/background_shade
- `app/[account]/[event-slug]/page.tsx` - BrandedPage receives backgroundColor/backgroundShade
- `app/[account]/[event-slug]/_components/booking-shell.tsx` - Cruip rhythm: py-12 md:py-20 header, max-w-3xl white card container, border-l lg side panel
- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` - Single-circle gradient, relative overflow-hidden, logo header retained, removed duplicate h1/p (BookingShell owns header)
- `app/(shell)/app/event-types/_components/embed-code-dialog.tsx` - max-w-3xl → sm:max-w-2xl (UI-09)

## Decisions Made

**ListingHero color fallback chain:** `backgroundColor ?? brandPrimary ?? null`. When `background_color` is null, the hero's inner `GradientBackdrop` falls back to `brand_primary` so the hero looks branded even before the owner explicitly picks a background color. This delivers a good default visual without requiring owner configuration.

**Footer accents simplified:** CONTEXT.md mentioned "subtle footer accents" but the page-level `GradientBackdrop` from `BrandedPage` (Plan 12-01) already extends down naturally. Adding an explicit footer accent layer would layer two gradient effects and risk visual overcomplication. Simplified to single page-level backdrop. Flag for Phase 13 QA: if Andrew wants explicit footer accent, it can be added as a v1.2 enhancement.

**Embed single-circle pattern:** The 3-circle `GradientBackdrop` positions circles at `-top-32`, `top-[420px]`, and `top-[640px]`. Embed iframes are typically 300-500px tall — circles 2 and 3 would never be visible. Single inline circle at `-top-32` is appropriate for the smaller canvas and avoids `GradientBackdrop` API bloat. EmbedHeightReporter safe: `relative overflow-hidden` wrapper clips blur circles to iframe viewport.

**Embed shell header deduplication:** Old embed shell had its own `h1` + `p` (event name + duration) before `BookingShell`. New `BookingShell` (Task 2) now owns the Cruip header. Removed duplicate from embed shell. Logo header retained — it's the live-preview branding feature (`?previewLogo` override from branding editor).

## Deviations from Plan

None — plan executed exactly as written. One minor simplification: removed duplicate `h1`/`p` from embed shell since `BookingShell` now owns the header section. This is consistent with the plan's directive ("Existing slot-picker + booking-form children unchanged") — the embed shell delegates header responsibility to `BookingShell`.

## Issues Encountered

**Pre-existing test failures (not regressions from this plan):** During vitest run, 6 tests in `bookings-api.test.ts` and `bookings-rate-limit.test.ts` were failing. Verified via `git stash` that these failures existed before my changes — they are caused by concurrent wave-2 agent work (12-06 email branding changes affecting email mock behavior). These are not regressions from Plan 12-05 UI changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All public surfaces styled; Phase 13 QA matrix ready: 3 accounts × 5 surfaces (listing, booking, embed, confirm, cancel) × 3 shade values (none/subtle/bold)
- Plan 12-06 (emails): `background_color` is now in `AccountSummary` from `loadEventTypeForBookingPage`; emails must use solid-color rendering (not gradient) — different code path
- Phase 13 QA: verify `background_shade='none'` flat tint on all surfaces; verify color fallback chain when `background_color=null`; verify EmbedHeightReporter still reports correct height after gradient addition
- Outstanding: confirm/cancel/reschedule pages (`/[account]/[event-slug]/confirmed/[id]`, `/cancel/[token]`, `/reschedule/[token]`) receive `backgroundColor`/`backgroundShade` via BrandedPage optional defaults — they don't pass these props explicitly, so they get `null/'subtle'` defaults. This is acceptable for v1.1; could be enhanced in v1.2 to load branding tokens for those pages too.

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
