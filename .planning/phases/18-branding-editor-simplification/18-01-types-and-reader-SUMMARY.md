---
phase: 18-branding-editor-simplification
plan: 01
subsystem: branding
tags: [typescript, supabase, branding, types, refactor]

# Dependency graph
requires:
  - phase: 17-public-surfaces-and-embed
    provides: "PublicShell visual language that Wave 2 MiniPreviewCard will mirror"
provides:
  - "Branding interface with 4 fields marked @deprecated optional (Option B shim)"
  - "getBrandingForAccount SELECT shrunk to logo_url, brand_primary"
  - "loadBrandingForOwner SELECT shrunk to id, slug, logo_url, brand_primary"
  - "BrandingState interface with 5 fields (no deprecated chrome fields)"
affects:
  - "18-02-editor-and-preview (Wave 2 UI rebuild consumes the new BrandingState shape)"
  - "Phase 20 (CLEAN-07..09 will drop the @deprecated shim fields when chrome-tint.ts is deleted)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Option B deprecated-optional shim: keep fields in Branding interface as @deprecated optional so downstream consumers (chrome-tint.ts + its test) stay type-clean across phases"
    - "Types-first commit boundary (CP-04): shrink type interface + reader + editor loader in one atomic commit to surface tsc errors at expected call sites only"

key-files:
  created: []
  modified:
    - lib/branding/types.ts
    - lib/branding/read-branding.ts
    - app/(shell)/app/branding/_lib/load-branding.ts

key-decisions:
  - "Option B shim chosen: 4 Branding fields (backgroundColor, backgroundShade, chromeTintIntensity, sidebarColor) marked @deprecated optional — not deleted — so chrome-tint.ts and tests/branding-chrome-tint.test.ts remain type-clean until Phase 20"
  - "SELECT shrink is the meaningful BRAND-20 win: production code stops reading deprecated columns at runtime despite shim fields still existing on the type"
  - "DEFAULT_BRAND_PRIMARY remains #0A2540 (brandingFromRow fallback); #3B82F6 reset button is Wave 2 concern"
  - "brandingFromRow body kept intact: shim fields still populated with safe defaults so chrome-tint.ts receives valid values at runtime even though SELECT no longer fetches those columns"

patterns-established:
  - "Deprecated-optional shim pattern: mark fields optional + @deprecated rather than deleting when downstream consumers span future phases — prevents cross-phase tsc cascade"

# Metrics
duration: 10min
completed: 2026-05-01
---

# Phase 18 Plan 01: Types and Reader Summary

**Option B deprecated-optional shim landed: 4 Branding fields marked @deprecated optional, both reader SELECTs shrunk to logo_url + brand_primary, BrandingState collapsed to 5 fields — production stops reading deprecated columns at runtime while chrome-tint.ts stays type-clean for Phase 20**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-01T22:54:01Z
- **Completed:** 2026-05-01T23:04:00Z
- **Tasks:** 2 (committed atomically as 1 code commit per CP-04 boundary)
- **Files modified:** 3

## Accomplishments

- `lib/branding/types.ts`: 4 deprecated fields made optional with `@deprecated` JSDoc tags; required fields (`logoUrl`, `primaryColor`, `textColor`) unchanged
- `lib/branding/read-branding.ts`: `getBrandingForAccount` SELECT shrunk from 6 columns to `"logo_url, brand_primary"`; `brandingFromRow` body kept intact to populate shim fields with safe defaults
- `app/(shell)/app/branding/_lib/load-branding.ts`: `BrandingState` collapsed to 5 fields; `BackgroundShade` import removed; `VALID_SHADES` constant and shade-coercion block removed; `loadBrandingForOwner` SELECT shrunk to `"id, slug, logo_url, brand_primary"`

## Task Commits

Both tasks are in one atomic commit per CP-04 plan lock:

1. **Task 1 + Task 2 (atomic):** `64164aa` — `refactor(18-01): shrink Branding type + reader + editor loader (BRAND-19, BRAND-20)`

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/branding/types.ts` — 4 fields changed from required to `@deprecated` optional; comments consolidated
- `lib/branding/read-branding.ts` — SELECT shrunk; Phase 18 shim contract documented in JSDoc
- `app/(shell)/app/branding/_lib/load-branding.ts` — BrandingState shrunk to 5 fields; BackgroundShade import + VALID_SHADES + shade-coercion block removed; SELECT shrunk

## Decisions Made

- **Option B shim (RESEARCH.md Q1):** The 4 deprecated fields (`backgroundColor`, `backgroundShade`, `chromeTintIntensity`, `sidebarColor`) are kept as `@deprecated` optional fields on the `Branding` interface. Rationale: `chrome-tint.ts` and `tests/branding-chrome-tint.test.ts` reference these fields; removing them in Phase 18 would break tsc and violate ROADMAP success criterion 4 ("tsc --noEmit passes with zero errors"). Phase 20 owns their deletion alongside chrome-tint.ts.
- **`brandingFromRow` body unchanged:** Even though `getBrandingForAccount`'s SELECT no longer fetches the deprecated columns, `brandingFromRow`'s body still populates them with safe defaults (`null/null/"subtle"/"subtle"`). This is correct — `brandingFromRow` is also called by email senders and embed page loaders that may pass full rows; keeping the body intact avoids breaking those callers.
- **`DEFAULT_BRAND_PRIMARY` = `#0A2540` preserved:** The Wave 2 "Reset to NSI blue (#3B82F6)" button is a UI concern and Wave 2 territory.

## Deviations from Plan

None — plan executed exactly as written. All edits matched the task action specs. No bugs found, no blocking issues encountered.

## tsc Gate Result

**Pre-existing baseline (unchanged):** errors in `tests/bookings-api.test.ts`, `tests/bookings-rate-limit.test.ts`, `tests/branding-gradient.test.ts`, `tests/cancel-reschedule-api.test.ts`, `tests/email-6-row-matrix.test.ts`, `tests/owner-note-action.test.ts`, `tests/reminder-cron.test.ts`, `tests/reminder-email-content.test.ts` — all pre-existing from before Phase 18.

**Expected new surface (Wave 2 fixes):**
- `app/(shell)/app/branding/_components/branding-editor.tsx(40,11): error TS2339: Property 'backgroundColor' does not exist on type 'BrandingState'`
- `app/(shell)/app/branding/_components/branding-editor.tsx(43,11): error TS2339: Property 'backgroundShade' does not exist on type 'BrandingState'`
- `app/(shell)/app/branding/_components/branding-editor.tsx(48,11): error TS2339: Property 'sidebarColor' does not exist on type 'BrandingState'`

**Option B shim confirmed working:** Zero errors in:
- `lib/branding/chrome-tint.ts` — reads `branding.backgroundColor` and `branding.sidebarColor` (now optional but still present on type)
- `tests/branding-chrome-tint.test.ts` — constructs `Branding` fixture with all 4 deprecated fields
- `lib/branding/types.ts`, `lib/branding/read-branding.ts`, `app/(shell)/app/branding/_lib/load-branding.ts`
- `tests/branding-schema.test.ts`, `tests/branding-contrast.test.ts`

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. No DB changes in this wave.

## Next Phase Readiness

**Hand-off to Wave 2 (Plan 18-02):**
- `BrandingState` now has exactly 5 fields — Wave 2's `BrandingEditor` rewrite can consume it cleanly
- `branding-editor.tsx` has 3 known tsc errors on `state.backgroundColor`, `state.backgroundShade`, `state.sidebarColor` — these are the exact import sites Wave 2 rewrites
- `chrome-tint.ts` and its test remain type-clean (no Wave 2 work needed there)
- **Do NOT push until Wave 2 lands.** `npm run build` will fail until `branding-editor.tsx` errors are fixed in Wave 2.

---
*Phase: 18-branding-editor-simplification*
*Completed: 2026-05-01*
