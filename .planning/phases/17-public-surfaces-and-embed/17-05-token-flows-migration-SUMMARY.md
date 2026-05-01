---
phase: 17-public-surfaces-and-embed
plan: 05
subsystem: ui
tags: [next.js, tailwind, branding, PublicShell, brandingFromRow, cancel, reschedule, token]

# Dependency graph
requires:
  - phase: 17-public-surfaces-and-embed
    plan: 02
    provides: PublicShell component (BackgroundGlow + Header variant=public + dual CSS vars + PoweredByNsi)
provides:
  - cancel token flow (/cancel/[token]) cancelled + active branches wrapped in PublicShell
  - reschedule token flow (/reschedule/[token]) active branch wrapped in PublicShell
  - brandingFromRow partial-input pattern validated on token resolver account objects
affects:
  - 17-06 (TokenNotActive component — not_active branches deferred; those branches untouched here)
  - Phase 20 (dead code cleanup — BrandedPage may be removable once all consumers migrated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "brandingFromRow partial input: token resolver account objects omit background_color/background_shade; pass only logo_url + brand_primary; safe defaults apply"
    - "PublicShell CSS var inheritance: --brand-primary + --brand-text set by shell; Book again inline style consumes them without re-declaring"

key-files:
  created: []
  modified:
    - app/cancel/[token]/page.tsx
    - app/reschedule/[token]/page.tsx

key-decisions:
  - "not_active branches left untouched on both pages — Plan 17-06 owns TokenNotActive re-skin"
  - "brandingFromRow receives only {logo_url, brand_primary} — optional background_color/background_shade fields absent from token resolver types; brandingFromRow defaults to backgroundColor: null, backgroundShade: subtle (unused by PublicShell)"
  - "Outer wrapper padding changed from p-6 sm:p-10 to px-6 sm:px-10 — PublicShell main already provides pt-20 md:pt-24 pb-12 vertical spacing"
  - "All CancelConfirmForm and RescheduleShell props preserved verbatim — visual wrapper only, zero logic changes"

patterns-established:
  - "Token-flow BrandedPage→PublicShell: brandingFromRow({logo_url, brand_primary}) + accountName prop only"
  - "v1.2 card lock on token pages: rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm"

# Metrics
duration: 2min
completed: 2026-04-30
---

# Phase 17 Plan 05: Token Flows Migration Summary

**Cancel + reschedule token pages migrated from BrandedPage to PublicShell using brandingFromRow partial-input pattern; v1.2 card lock applied; not_active branches preserved for Plan 17-06**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-01T01:40:27Z
- **Completed:** 2026-05-01T01:42:30Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Cancel page (`/cancel/[token]`) cancelled + active branches now render inside PublicShell with brandingFromRow-derived Branding
- Reschedule page (`/reschedule/[token]`) active branch now renders inside PublicShell with brandingFromRow-derived Branding
- Confirmed `brandingFromRow` handles partial account objects (no background_color / background_shade) safely — defaults to `backgroundColor: null`, `backgroundShade: 'subtle'`
- v1.2 card lock applied across all migrated branches (`rounded-xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm`)
- "Book again" inline style preserved verbatim — CSS vars (`--brand-primary`, `--brand-text`) now resolve via PublicShell wrapper

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate /cancel/[token]/page.tsx (cancelled + active branches) to PublicShell** - `4b8d44d` (refactor)
2. **Task 2: Migrate /reschedule/[token]/page.tsx (active branch) to PublicShell** - `c1f132c` (refactor)

**Plan metadata:** (pending — will be added by final commit)

## Files Created/Modified
- `app/cancel/[token]/page.tsx` - BrandedPage replaced with PublicShell on cancelled + active branches; not_active branch unchanged
- `app/reschedule/[token]/page.tsx` - BrandedPage replaced with PublicShell on active branch; not_active branch unchanged

## Decisions Made
- **not_active branches left untouched:** Both pages return `<TokenNotActive ownerEmail={null} />` unchanged. Plan 17-06 (parallel wave) owns that component re-skin. Touching those branches here would create a merge conflict risk.
- **brandingFromRow partial input:** Token resolver types (`resolveCancelToken`, `resolveRescheduleToken`) return account objects with only `logo_url`, `brand_primary`, `name`, `slug`, `timezone`, `owner_email`. Passing `{logo_url, brand_primary}` to `brandingFromRow` is safe — optional fields default to null/subtle. The resulting `backgroundColor: null` and `backgroundShade: 'subtle'` are unused by PublicShell anyway.
- **px-6 vs p-6 outer wrapper:** Changed from `p-6 sm:p-10` to `px-6 sm:px-10` on both pages. PublicShell's `<main className="pt-20 md:pt-24 pb-12">` already handles vertical spacing; duplicating it would create excessive top padding below the sticky header.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `app/[account]/page.tsx` (introduced by parallel Plan 17-03) appeared during tsc run. Confirmed pre-existing via `git stash` verification — not introduced by this plan. All `app/` errors exclusive to this plan's files: zero.
- Pre-existing `tests/` TypeScript errors (~20 errors, TS7006/TS2305) documented in STATE.md maintenance backlog — unrelated to this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PUB-08 (cancel token flow) and PUB-09 (reschedule token flow) satisfied
- not_active branches on both token pages remain untouched — Plan 17-06 will re-skin TokenNotActive component
- BrandedPage is now unused by cancel and reschedule token flows; Phase 20 dead-code cleanup can assess full removal once all consumers are migrated

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
