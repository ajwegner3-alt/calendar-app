---
phase: 17-public-surfaces-and-embed
plan: 07
subsystem: ui
tags: [embed, iframe, css-vars, tailwind, branding, slot-picker]

# Dependency graph
requires:
  - phase: 17-01
    provides: PoweredByNsi component (PUB-04 foundation atom)
provides:
  - Restyled EmbedShell with bg-gray-50, --primary CSS var override, and NSI footer
  - CP-05 fix: embed iframe now owns its own --primary so SlotPicker bg-primary shows customer color
  - EMBED-09: background_color/background_shade column reads removed from EmbedShell
affects:
  - Phase 18 (branding editor): live preview still works via previewColor/previewLogo overrides
  - Phase 21 (schema DROP): background_color/background_shade columns no longer read anywhere in embed

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Embed iframe owns its own --primary CSS var (CP-05 pattern): CSS vars don't cross iframe boundaries"
    - "Single-circle gradient at opacity 0.40 / blur 160px for small iframe canvas (not BackgroundGlow 2-blob)"

key-files:
  created: []
  modified:
    - app/embed/[account]/[event-slug]/_components/embed-shell.tsx

key-decisions:
  - "Single-circle gradient retained (not BackgroundGlow) -- iframe canvas too small for 2-blob pattern"
  - "PoweredByNsi rendered inside iframe, before EmbedHeightReporter (reporter must stay last)"
  - "background_color/background_shade columns no longer read by EmbedShell; type fields retained until Phase 21 DROP"
  - "--primary and --primary-foreground added to cssVars alongside existing --brand-primary/--brand-text"

patterns-established:
  - "CP-05 pattern: embed must set its own --primary; never rely on parent-page :root --primary cascading across iframe"

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 17 Plan 07: Embed Restyle Summary

**EmbedShell restyled to bg-gray-50 with --primary CSS var override (CP-05 iframe boundary fix), simplified single-circle gradient from brand_primary, and PoweredByNsi footer rendered inside the iframe**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-30T00:00:00Z
- **Completed:** 2026-04-30T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- EMBED-08: Changed root background from `bg-white` to `bg-gray-50`
- EMBED-09: Removed `backdropColor` and `shade` derivation (deprecated `background_color`/`background_shade` column reads); gradient now driven by `effectiveColor` directly
- EMBED-10 / CP-05: Added `--primary` and `--primary-foreground` to `cssVars` — the critical fix ensuring SlotPicker's `bg-primary` selected state renders in customer brand color instead of NSI blue (CSS variables do not cross iframe document boundaries)
- PUB-04: `PoweredByNsi` rendered inside the iframe, positioned after `BookingShell` and before `EmbedHeightReporter`
- Gradient simplified to single unconditional circle at `opacity-40` / `blur(160px)` matching BackgroundGlow blob 1 intensity; `relative z-10` wrappers added on logo header and BookingShell div
- `--brand-primary` and `--brand-text` preserved (BookingForm submit button still consumes them)
- `EmbedHeightReporter` unchanged — ResizeObserver auto-handles the new footer height

## Task Commits

1. **Task 1: Restyle EmbedShell** - `b03d8b6` (refactor)

**Plan metadata:** (pending — in final metadata commit)

## Files Created/Modified

- `app/embed/[account]/[event-slug]/_components/embed-shell.tsx` - Restyled embed shell: bg-gray-50, --primary override, simplified gradient, PoweredByNsi footer

## Decisions Made

**cssVars structure (both --brand-primary AND --primary, with foregrounds):**

The final `cssVars` object carries four CSS variables:
1. `--brand-primary` + `--brand-text` — consumed by BookingForm submit button (retained from Phase 12)
2. `--primary` + `--primary-foreground` — consumed by SlotPicker's `bg-primary` selected-day class (new in Phase 17)

Both sets are necessary: `--brand-primary` for the form submit button, `--primary` for the slot picker. They point at the same value (`effectiveColor`) and same contrast text (`textColor`).

**Single-circle gradient (not BackgroundGlow):**

BackgroundGlow's second blob is positioned at approximately `top:420px`. Embed iframes are typically 300-500px tall — the second blob would be invisible on most contractor embed placements. The existing single-circle pattern (absolute, `-top-32`, `h-80 w-80`, behind `-z-10`) is the correct scale for the smaller canvas. Pulling in the BackgroundGlow component would add unnecessary code with no visible benefit.

**PoweredByNsi inside embed:**

CONTEXT.md locks footer as "always renders" for all public surfaces including embed. Positioned after `<BookingShell>` and before `<EmbedHeightReporter>`. The reporter's ResizeObserver watches `document.documentElement.scrollHeight`, so it automatically accounts for the additional footer height without any code change (EMBED-11 confirmed).

**background_color/background_shade columns no longer read:**

EmbedShell no longer references `account.background_color` or `account.background_shade`. The `AccountSummary` type retains these fields (they exist in the database) — type-level cleanup is deferred to Phase 21 schema DROP migration. This is a deliberate two-step approach (code stops reading first; DROP migration second).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript clean (all errors are pre-existing `tests/` TS7006/TS2305 in the maintenance backlog, not introduced by this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EmbedShell is Phase 17 complete. SlotPicker's `bg-primary` selected state will now show customer brand color inside any iframe deployment.
- Phase 21 (Schema DROP): `background_color` and `background_shade` are safe to DROP. EmbedShell is the last consumer that read them; it no longer does.
- Phase 18 (Branding Editor): Live preview flow (`?previewColor` + `?previewLogo` overrides) still works unchanged.

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
