---
phase: 10-multi-user-signup-and-onboarding
plan: 01
subsystem: api
tags: [typescript, reserved-slugs, refactor, deduplication, server-only]

# Dependency graph
requires:
  - phase: 07-widget-and-branding
    provides: "load-account-listing.ts and load-event-type.ts with RESERVED_SLUGS guards (both now consolidated)"
provides:
  - "lib/reserved-slugs.ts — single source of truth RESERVED_SLUGS ReadonlySet + isReservedSlug() helper"
  - "Both v1.0 consumers migrated to import from the canonical module"
  - "Phase 10 entries added: signup, onboarding, login, forgot-password, settings"
affects:
  - "10-06-onboarding-wizard-and-provisioning (slug picker is the 3rd consumer; imports from here)"
  - "10-07-profile-settings-and-soft-delete (slug change validation uses RESERVED_SLUGS)"
  - "Any future top-level route addition that needs slug protection"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReadonlySet<string> for exported constants — prevents consumer mutation"
    - "Single source of truth lib/ module pattern for cross-cutting validation constants"

key-files:
  created:
    - lib/reserved-slugs.ts
  modified:
    - app/[account]/_lib/load-account-listing.ts
    - app/[account]/[event-slug]/_lib/load-event-type.ts

key-decisions:
  - "RESERVED_SLUGS typed as ReadonlySet<string> (not Set<string>) so consumers cannot mutate the export"
  - "Phase 10 additions included at consolidation time: signup, onboarding, login, forgot-password, settings — closes future-proofing edge before any downstream plan adds a 3rd consumer"

patterns-established:
  - "Reserved slug guard: import { RESERVED_SLUGS } from '@/lib/reserved-slugs' — all future route loaders use this import"
  - "isReservedSlug() helper available for form validation in slug picker (Plan 10-06) and profile settings (Plan 10-07)"

# Metrics
duration: 2min
completed: 2026-04-28
---

# Phase 10 Plan 01: reserved-slugs-consolidation Summary

**Deduplicated RESERVED_SLUGS from 2 hand-synced v1.0 files into a single ReadonlySet module at lib/reserved-slugs.ts, adding Phase 10 route entries (signup, onboarding, login, forgot-password, settings) and migrating both consumers to import from it**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-28T13:30:07Z
- **Completed:** 2026-04-28T13:32:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `lib/reserved-slugs.ts` as canonical single source of truth with `ReadonlySet<string>` type, preserving all 5 v1.0 entries and adding 5 Phase 10 entries
- Removed duplicate `const RESERVED_SLUGS = new Set([...])` from both `load-account-listing.ts` and `load-event-type.ts`; replaced with `import { RESERVED_SLUGS } from "@/lib/reserved-slugs"`
- All 131 existing tests continue to pass; no duplicate Set definitions remain in `app/`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create canonical reserved-slugs module** - `793ea9a` (feat)
2. **Task 2: Migrate consumers to import from canonical module** - `45ac82e` (refactor)

**Plan metadata:** `docs(10-01)` commit (see below)

## Files Created/Modified

- `lib/reserved-slugs.ts` — New canonical module: `RESERVED_SLUGS` as `ReadonlySet<string>` with v1.0 + Phase 10 entries; `isReservedSlug()` helper
- `app/[account]/_lib/load-account-listing.ts` — Removed local Set definition and mirror comment; imports from `@/lib/reserved-slugs`
- `app/[account]/[event-slug]/_lib/load-event-type.ts` — Removed local Set definition and phase-7 comment; imports from `@/lib/reserved-slugs`

## Decisions Made

- **`ReadonlySet<string>` type** — Prevents any consumer from accidentally mutating the exported Set. Typed at declaration rather than relying on `as const`.
- **Phase 10 entries added at consolidation time** — `signup`, `onboarding`, `login`, `forgot-password`, `settings` were added to the canonical module immediately rather than piecemeal in later plans, avoiding the drift risk that motivated this consolidation.
- **No `server-only` guard on `lib/reserved-slugs.ts`** — The module contains no secrets and no server-only APIs; it is pure string data that may legitimately be imported by client-side form validation in Plan 10-06.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing `tsc --noEmit` errors in test files (test-mock alias resolution) — confirmed v1.2 tech debt per STATE.md; none of the three touched source files introduced or affected by those errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/reserved-slugs.ts` is available for Plan 10-06 (slug picker, 3rd consumer) and Plan 10-07 (profile settings slug change validation)
- `isReservedSlug()` helper ready for Zod schema `.refine()` usage in both plans
- No blockers for Plan 10-02 (auth/confirm route handler)

---
*Phase: 10-multi-user-signup-and-onboarding*
*Completed: 2026-04-28*
