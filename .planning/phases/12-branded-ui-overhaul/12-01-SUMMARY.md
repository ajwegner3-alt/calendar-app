---
phase: 12-branded-ui-overhaul
plan: 01
subsystem: ui
tags: [branding, gradient, tailwind, supabase, vitest, css-variables, background-color, background-shade]

# Dependency graph
requires:
  - phase: 07-widget-and-branding
    provides: "BrandedPage wrapper, Branding type, brandingFromRow, primaryColor/textColor CSS vars"
  - phase: 12-branded-ui-overhaul
    provides: "12-CONTEXT.md and 12-RESEARCH.md design decisions"
provides:
  - "background_color (nullable hex) + background_shade (none/subtle/bold) columns on accounts table with enum + CHECK constraints"
  - "Extended Branding type with BackgroundShade + backgroundColor + backgroundShade fields"
  - "brandingFromRow + getBrandingForAccount return new fields with 'subtle' fallback"
  - "shadeToGradient pure helper: color+shade → GradientPlan with flatTint or 3 GradientCircle definitions"
  - "GradientBackdrop client component: Cruip-pattern blur-circle rendering or flat tint (shade=none)"
  - "NSIGradientBackdrop: fixed NSI-token wrapper for auth pages (color=#0A2540, shade=subtle)"
  - "BrandedPage extended: --brand-bg-color + --brand-bg-shade CSS vars; renders GradientBackdrop as first child; existing 5 callers unbroken"
  - "/app/branding editor: 8 Cruip swatches + custom hex + ShadePicker (3-button toggle) + inline MiniPreviewCard + persistence"
affects:
  - "12-02 (auth-pages-restyle): use NSIGradientBackdrop on login/signup/forgot-password pages"
  - "12-03 (dashboard-chrome): pass branding.backgroundColor + branding.backgroundShade to GradientBackdrop on /app root"
  - "12-04a (home-tab-server-and-calendar): BrandedPage consumers already upgraded — pass new props when branding loaded"
  - "All public surfaces: /[account], /[account]/[event-slug], /cancel/[token], /reschedule/[token] — extend BrandedPage calls with backgroundColor/backgroundShade from branding"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadeToGradient as the single pure source-of-truth for gradient plans — no consumer forks this logic"
    - "GradientBackdrop as the canonical Cruip blur-circle primitive for all surfaces"
    - "NSIGradientBackdrop for auth surfaces — fixed NSI tokens, no account context required"
    - "Phase 7 JIT pitfall enforced: all runtime hex values use inline style={{ backgroundColor: hex }}, never bg-${hex} Tailwind dynamic classes"
    - "saveBrandingAction pattern: validates both fields via Zod, treats empty string as null before writing to accounts"
    - "ColorPickerInput showSaveButton/showSwatches props: same component handles primary-color (save button) and background-color (parent saves) use cases"

key-files:
  created:
    - supabase/migrations/20260429120000_phase12_branding_columns.sql
    - lib/branding/gradient.ts
    - app/_components/gradient-backdrop.tsx
    - components/nsi-gradient-backdrop.tsx
    - app/(shell)/app/branding/_components/shade-picker.tsx
    - app/(shell)/app/branding/_components/mini-preview-card.tsx
    - tests/branding-gradient.test.ts
    - tests/branding-schema.test.ts
  modified:
    - lib/branding/types.ts
    - lib/branding/read-branding.ts
    - app/_components/branded-page.tsx
    - app/(shell)/app/branding/_lib/schema.ts
    - app/(shell)/app/branding/_lib/load-branding.ts
    - app/(shell)/app/branding/_lib/actions.ts
    - app/(shell)/app/branding/_components/color-picker-input.tsx
    - app/(shell)/app/branding/_components/branding-editor.tsx

key-decisions:
  - "shade=none renders color-mix(in oklch, ${color} 4%, white) flat tint — research recommendation for accessibility without full gradient"
  - "8 curated Cruip-aligned swatches: NSI Navy, Cruip Blue, Forest, Sunset, Magenta, Violet, Slate, Stone"
  - "MiniPreviewCard lives only on /app/branding — CONTEXT.md lock: owners navigate to actual surfaces for in-context experience"
  - "GradientBackdrop is a 'use client' component to support live preview updates; BrandedPage is a server component that passes static branding values"
  - "ColorPickerInput showSaveButton=false for background-color slot — parent branding-editor owns save lifecycle via saveBrandingAction"
  - "NSIGradientBackdrop is a separate component from BrandedPage — auth pages have no account context"
  - "brandingFromRow background_shade fallback = 'subtle' (not 'none') — ensures new accounts get the styled experience before owner customizes"

patterns-established:
  - "GradientBackdrop pattern: place inside relative parent with overflow-hidden; use aria-hidden on decorative divs"
  - "CSS var naming: --brand-bg-color / --brand-bg-shade alongside --brand-primary / --brand-text"
  - "Wave 2/3 consumer pattern: pass branding.backgroundColor + branding.backgroundShade to <BrandedPage> for public surfaces; pass to <GradientBackdrop> directly for dashboard chrome"

# Metrics
duration: 9min
completed: 2026-04-29
---

# Phase 12 Plan 01: Branding Tokens Foundation Summary

**Per-account gradient backdrop tokens (background_color hex + background_shade enum) in DB, types, pure shadeToGradient helper, GradientBackdrop/NSIGradientBackdrop primitives, BrandedPage CSS var extension, and full /app/branding editor UI with 8 Cruip swatches + ShadePicker + live MiniPreviewCard**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-29T12:26:52Z
- **Completed:** 2026-04-29T12:35:30Z
- **Tasks:** 3
- **Files created:** 8 | **Files modified:** 8

## Accomplishments

- Migration `20260429120000_phase12_branding_columns.sql` applied to prod: `background_color text` (nullable, hex CHECK) + `background_shade background_shade` enum (none/subtle/bold, DEFAULT subtle). NSI account row verified as (null, 'subtle').
- Pure `shadeToGradient` helper established as the single source of truth for gradient plans across all surfaces (shade=none → flat color-mix tint; subtle/bold → 3 GradientCircle definitions with scaled opacity/blur).
- `GradientBackdrop` client component renders Cruip blur-circles using only inline `style` for runtime hex (Phase 7 JIT pitfall strictly avoided). `NSIGradientBackdrop` wraps it with fixed NSI tokens for auth pages.
- `BrandedPage` extended additively: new optional `backgroundColor` + `backgroundShade` props, two new CSS vars (`--brand-bg-color`, `--brand-bg-shade`), GradientBackdrop rendered as first child; all 5 existing callers unbroken with no code changes.
- `/app/branding` editor: 8 swatch buttons + native color picker + hex input for background color; 3-button ShadePicker; inline MiniPreviewCard updating live; "Save background" button persisting via `saveBrandingAction`; BRAND-05/06/07 all satisfied.
- Test suite grows from 148 → 173 passing (25 new: 8 gradient unit tests + 17 schema unit tests), 26 skipped.

## Task Commits

1. **Task 1: DB migration + branding types + reader + gradient helper** - `a4638d1` (feat)
2. **Task 2: GradientBackdrop + NSIGradientBackdrop + BrandedPage extension** - `e3fa418` (feat)
3. **Task 3: /app/branding swatches + shade picker + mini-preview + persistence** - `72a7a7e` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `supabase/migrations/20260429120000_phase12_branding_columns.sql` — background_color + background_shade columns + enum + CHECK constraints
- `lib/branding/types.ts` — BackgroundShade type + Branding interface extended with backgroundColor/backgroundShade
- `lib/branding/read-branding.ts` — brandingFromRow + getBrandingForAccount SELECT and map new columns
- `lib/branding/gradient.ts` — shadeToGradient pure helper (GradientCircle, GradientPlan interfaces)
- `app/_components/gradient-backdrop.tsx` — Cruip blur-circle client component
- `components/nsi-gradient-backdrop.tsx` — NSI-fixed auth wrapper
- `app/_components/branded-page.tsx` — CSS var extension + GradientBackdrop render
- `app/(shell)/app/branding/_lib/schema.ts` — backgroundColorSchema + backgroundShadeSchema + brandingBackgroundSchema
- `app/(shell)/app/branding/_lib/load-branding.ts` — BrandingState extended; SELECT includes new columns
- `app/(shell)/app/branding/_lib/actions.ts` — saveBrandingAction (validates + writes both fields)
- `app/(shell)/app/branding/_components/color-picker-input.tsx` — showSaveButton + showSwatches optional props; 8 swatch buttons
- `app/(shell)/app/branding/_components/shade-picker.tsx` — NEW: 3-button none/subtle/bold toggle
- `app/(shell)/app/branding/_components/mini-preview-card.tsx` — NEW: live inline preview card
- `app/(shell)/app/branding/_components/branding-editor.tsx` — wires all 4 new state pieces + save lifecycle
- `tests/branding-gradient.test.ts` — 8 unit tests for shadeToGradient
- `tests/branding-schema.test.ts` — 17 unit tests for background schemas

## Decisions Made

- **shade=none → color-mix flat tint**: `color-mix(in oklch, ${color} 4%, white)` per research recommendation. Low alpha preserves readability on all backgrounds.
- **8 curated swatches**: NSI Navy (#0A2540), Cruip Blue (#3B82F6), Forest (#10B981), Sunset (#F97316), Magenta (#EC4899), Violet (#8B5CF6), Slate (#475569), Stone (#78716C). Selected for gradient aesthetics per 12-RESEARCH.md.
- **MiniPreviewCard inline on /app/branding only** (CONTEXT.md lock): owners navigate to actual surfaces for full in-context experience; the card is a narrowly-scoped gradient preview only.
- **ColorPickerInput dual-mode**: `showSaveButton=false` + `showSwatches=true` for the background-color slot; parent branding-editor owns the save lifecycle. Primary color slot keeps original behavior unchanged.
- **brandingFromRow shade fallback = 'subtle'**: new accounts get the styled gradient experience before any customization. A fallback to 'none' would silently hide the feature.
- **saveBrandingAction treats empty string as null**: defensive null coercion before Zod validation so clearing the field in the UI correctly persists DB null.

## Deviations from Plan

None — plan executed exactly as written. The `showSaveButton`/`showSwatches` pattern on ColorPickerInput is an implementation detail within the plan's directive to reuse the component for both slots.

## Issues Encountered

None. Migration applied cleanly. TypeScript errors shown by `npx tsc --noEmit` are all pre-existing test mock alias errors (documented in STATE.md as v1.2 tech debt); zero new errors introduced.

## User Setup Required

None — no new environment variables, external services, or dashboard configuration required.

## Next Phase Readiness

**Foundation complete. Wave 2 and Wave 3 plans can now consume:**

- Auth pages (12-02): `import { NSIGradientBackdrop } from "@/components/nsi-gradient-backdrop"` — place inside `relative overflow-hidden` wrapper on login/signup/forgot-password pages.
- Dashboard chrome (12-03): `import { GradientBackdrop } from "@/app/_components/gradient-backdrop"` — pass `branding.backgroundColor` + `branding.backgroundShade` from the shell layout's branding loader.
- Public booking surfaces (12-04+): extend existing `<BrandedPage>` calls with `backgroundColor={branding.backgroundColor}` + `backgroundShade={branding.backgroundShade}` — backdrop renders automatically.

**Requirements satisfied:** BRAND-05 (background_color column), BRAND-06 (background_shade enum + DEFAULT), BRAND-07 (branding editor swatches + shade toggle + live preview).

**Known concern:** `GradientBackdrop` renders 3 absolutely-positioned divs with `blur(160-200px)`. On embed iframe surfaces (v1.0 `/embed/[account]/[event-slug]`), the iframe may clip the circles — plan 12-05 or embed owner must add `overflow-hidden` to the iframe host. Documented for Wave 3 consumer plans.

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
