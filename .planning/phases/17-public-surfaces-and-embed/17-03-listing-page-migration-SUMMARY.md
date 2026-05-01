---
phase: 17-public-surfaces-and-embed
plan: 03
subsystem: ui
tags: [next.js, tailwind, public-shell, branding, listing-page, gradient-backdrop]

# Dependency graph
requires:
  - phase: 17-public-surfaces-and-embed plan 17-02
    provides: PublicShell Server Component (BackgroundGlow + Header public + dual CSS vars + PoweredByNsi)
  - phase: 17-public-surfaces-and-embed plan 17-01
    provides: foundation atoms (BackgroundGlow, PublicHeader, PoweredByNsi, brandingFromRow)
provides:
  - /[account] public listing page wrapped in PublicShell (replaces BrandedPage)
  - ListingHero stripped of inner GradientBackdrop (PUB-05 fulfilled for this surface)
  - Wave 4 prerequisite: GradientBackdrop no longer consumed by listing-hero.tsx
affects:
  - 17-08-gradient-backdrop-deletion (Wave 4 - can now audit/delete GradientBackdrop after all surfaces migrated)
  - 17-09-visual-gate (visual verification of /[account] surface with PublicShell)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PublicShell page migration: import PublicShell + brandingFromRow, call brandingFromRow(data.account), wrap content in <PublicShell branding={...} accountName={...}>"
    - "Inner-div flatten after GradientBackdrop removal: relative+overflow-hidden+z-10 stacking removed; single flex-col div suffices"
    - "v1.2 card lock applied to hero: border border-gray-200 + shadow-sm added alongside existing rounded-2xl bg-white"

key-files:
  created: []
  modified:
    - app/[account]/page.tsx
    - app/[account]/_components/listing-hero.tsx

key-decisions:
  - "Use <div> not <main> inside PublicShell — PublicShell already renders its own <main> wrapper; nested <main> would be invalid HTML"
  - "rounded-2xl retained for hero (PUB-05 spec) — intentionally differs from standard rounded-xl v1.2 card lock; hero is the marquee element and warrants more pronounced rounding"
  - "GradientBackdrop reference in listing-hero.tsx JSDoc comment is acceptable — it is documentation of what was removed, not a functional import"
  - "relative + overflow-hidden removed from hero section outer class — these were solely for GradientBackdrop's absolutely-positioned circles; no longer needed"

patterns-established:
  - "PublicShell migration pattern: replace BrandedPage wrapper, call brandingFromRow on the data row, replace <main> with <div> inside shell"
  - "GradientBackdrop strip pattern: remove import + render + related props + backdropColor derivation + relative/overflow-hidden; apply v1.2 card lock (border-gray-200, shadow-sm)"

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 17 Plan 03: Listing Page Migration Summary

**`/[account]` listing page migrated from BrandedPage to PublicShell; ListingHero inner GradientBackdrop removed and v1.2 card lock applied (PUB-05)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-30T~execution
- **Completed:** 2026-04-30
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `/[account]` page now renders inside `PublicShell` with `brandingFromRow`-derived Branding object — brand-tinted BackgroundGlow, PublicHeader pill, and PoweredByNsi footer all appear automatically
- `ListingHero` strips its inner `GradientBackdrop` (redundant with page-level glow per PUB-05), removing `backgroundColor` and `backgroundShade` props and flattening the JSX structure
- Hero card gains `border-gray-200` and `shadow-sm` per Phase 15 v1.2 card lock, completing the visual refresh
- GradientBackdrop is no longer imported anywhere in the `app/[account]/` subtree — prerequisite for Wave 4 deletion now fulfilled for this surface

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate /[account]/page.tsx from BrandedPage to PublicShell** - `f28dcfa` (refactor)
2. **Task 2: Strip GradientBackdrop from ListingHero** - `e33585b` (refactor)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/[account]/page.tsx` - Replaced BrandedPage wrapper with PublicShell; calls brandingFromRow; uses div not main inside shell; drops backgroundColor/backgroundShade from ListingHero call
- `app/[account]/_components/listing-hero.tsx` - Removed GradientBackdrop import + render; props reduced to accountName/logoUrl/brandPrimary; outer section simplified; v1.2 card lock applied

## Decisions Made

- **`<div>` not `<main>` inside PublicShell:** PublicShell renders its own `<main className="pt-20 md:pt-24 pb-12">` wrapper. Using `<main>` inside would produce nested `<main>` — invalid HTML5 (only one `<main>` per document). Replaced with `<div>` as the plan specifies.
- **`rounded-2xl` retained (not `rounded-xl`):** PUB-05 explicitly calls for `rounded-2xl` on the hero card. This intentionally differs from the `rounded-xl` standard v1.2 card lock — the hero is the marquee element and warrants more pronounced rounding. Locked.
- **`relative`/`overflow-hidden` removed from hero outer section:** These classes existed solely to contain GradientBackdrop's absolutely-positioned gradient circles. With GradientBackdrop gone, they serve no purpose and were removed.
- **JSDoc comment referencing GradientBackdrop retained in listing-hero.tsx:** The comment documents what was removed (PUB-05 rationale). It is not a functional import or render. Acceptable.

## Deviations from Plan

None — plan executed exactly as written. The linter/formatter reverted the page.tsx file during the first commit attempt (CRLF normalization); the write was simply re-applied and committed cleanly on the second attempt.

## Issues Encountered

- **Git linter revert on page.tsx:** After writing `app/[account]/page.tsx`, the pre-commit or editor process reverted the file before `git commit` ran. Git reported "no changes added to commit." Re-wrote the file, re-staged, and committed successfully on the second attempt. No code impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/[account]` listing page is fully migrated to PublicShell — ready for visual gate in Plan 17-09
- `GradientBackdrop` is no longer consumed by `app/[account]/_components/listing-hero.tsx`; Wave 4 (17-08 deletion plan) should audit remaining consumers across all routes before deleting the component
- Parallel Wave 3 plans (17-04, 17-05, 17-06, 17-07) are running concurrently and touch disjoint files; no merge conflicts anticipated

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
