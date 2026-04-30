---
phase: 14-typography-and-css-token-foundations
plan: 14-01
subsystem: typography-css-tokens
tags: [inter, roboto-mono, next-font, tailwind-v4, css-tokens, letter-spacing]

# Dependency graph
requires: []
provides:
  - Inter weights 400-800 loaded via next/font/google (font-extrabold ready for Phase 15 wordmark)
  - Roboto Mono loaded via next/font/google with --font-roboto-mono CSS variable on <html>
  - --font-mono token in @theme inline resolving to Roboto Mono with ui-monospace fallback
  - em-based body letter-spacing: -0.017em (supersedes removed tracking-tight)
  - em-based h1-h3 letter-spacing: -0.037em (overridable by component-level tracking utilities)
  - code/pre/kbd elements wired to Roboto Mono via explicit font-family rule
  - --color-primary: #3B82F6 (NSI blue-500) propagating to all shadcn bg-primary consumers
  - --color-sidebar-primary: #3B82F6 (NSI blue-500) for sidebar active-state pill
affects:
  - Phase 15 (font-extrabold wordmark, BackgroundGlow, Header pill — all assume Inter 800 + --color-primary #3B82F6)
  - Phase 16 (auth/onboarding re-skin — inherits primary color + mono stack)
  - Phase 17 (public surfaces + embed — inherits full font/color foundation)
  - Phase 18 (branding editor simplification — inherits primary token chain)
  - Phase 19 (email layer — inherits font/color foundation for template consistency)

# Tech tracking
tech-stack:
  added:
    - Roboto_Mono via next/font/google (new; Inter was already loaded)
  patterns:
    - next/font/google multi-font pattern: both font constructors in layout.tsx, both .variable on <html> className
    - @theme inline for CSS variables that reference document-scope CSS custom properties (next/font injection)
    - plain @theme for hardcoded brand color tokens (hex values)
    - Standalone top-level CSS rules (after @layer base, before @theme) for element-selector letter-spacing
    - Explicit code/pre/kbd rule required to wire @theme inline font token to raw HTML elements

key-files:
  created: []
  modified:
    - app/layout.tsx
    - app/globals.css

key-decisions:
  - "MP-07 Approach A: tracking-tight removed from <html>; letter-spacing now solely governed by globals.css em-based rules"
  - "Inter weight array [400,500,600,700,800] — 800 is required for Phase 15 font-extrabold NorthStar wordmark"
  - "Roboto_Mono (underscore) is the correct Next.js import name — RobotoMono and Roboto Mono both cause build errors"
  - "--font-mono goes in @theme inline (not plain @theme) because --font-roboto-mono is injected at document scope by next/font"
  - "--color-primary and --color-sidebar-primary updated in plain @theme block to #3B82F6; :root oklch values left untouched"
  - "Component-level tracking-tight utility classes on 17+ existing headings are intentional overrides of the new h1-h3 baseline"

patterns-established:
  - "Multi-font next/font: all font .variable props must appear on <html> className or CSS var is never injected"
  - "@theme inline for runtime-resolved font vars; plain @theme for hardcoded brand hex tokens"
  - "Standalone top-level rules for element-selector typography — do not merge into @layer base"

# Metrics
duration: 25min
completed: 2026-04-30
---

# Phase 14 Plan 14-01: Typography + CSS Token Foundations Summary

**Inter 400-800 + Roboto Mono loaded via next/font; em letter-spacing rules; --color-primary flipped to #3B82F6 (NSI blue-500); all 7 TYPO requirements verified on Vercel preview**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-30T21:05:10Z
- **Completed:** 2026-04-30T21:30:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Loaded Inter weights 400-800 and Roboto Mono (with correct `Roboto_Mono` underscore name) via next/font/google; both `.variable` props injected on `<html>` className (TYPO-01, TYPO-02)
- Added `--font-mono: var(--font-roboto-mono), ui-monospace, monospace` to `@theme inline` block and explicit `code, pre, kbd { font-family: var(--font-mono) }` rule (TYPO-03)
- Added em-based letter-spacing: body `-0.017em`, h1-h3 `-0.037em` as standalone top-level rules after `@layer base` (TYPO-04, TYPO-05)
- Updated `--color-primary` and `--color-sidebar-primary` from `#0A2540` navy to `#3B82F6` NSI blue-500 in the plain `@theme` block (TYPO-06, TYPO-07)
- Removed `tracking-tight` from `<html>` className per MP-07 Approach A locked decision
- All 7 TYPO automated curl + grep checks PASS on Vercel preview `https://calendar-app-xi-smoky.vercel.app`

## Task Commits

Each task was committed atomically:

1. **Task 1: Update app/layout.tsx** - `9263770` (feat)
2. **Task 2: Update app/globals.css** - `b3706d6` (feat)
3. **Task 3: Push + Vercel verification** - (no separate code commit; verification done against Task 1+2 commits pushed to main)

## Files Created/Modified

- `app/layout.tsx` — Added `Roboto_Mono` import, expanded Inter weight array to `[400,500,600,700,800]`, added `robotoMono` constructor with `variable: "--font-roboto-mono"`, added `robotoMono.variable` to `<html>` className, removed `tracking-tight`
- `app/globals.css` — Added `--font-mono` line to `@theme inline`; added three standalone top-level rules (`body`, `h1,h2,h3`, `code,pre,kbd`); updated `--color-primary` and `--color-sidebar-primary` to `#3B82F6` in plain `@theme`

## Decisions Made

All decisions were pre-locked in `14-RESEARCH.md` and `14-01-PLAN.md <locked_decisions>`. None required re-evaluation during execution:

- **MP-07 Approach A confirmed:** Removing `tracking-tight` from `<html>` (not replacing with anything). Em-based CSS rules now govern all body/heading letter-spacing.
- **`@theme inline` placement confirmed:** `--font-mono` must live here because `--font-roboto-mono` is injected by next/font at document scope (not `:root`), requiring inline resolution.
- **Explicit element-selector rule confirmed required:** Declaring `--font-mono` in `@theme inline` only generates the Tailwind `font-mono` utility class — it does NOT auto-apply to raw `<code>` elements. The explicit `code, pre, kbd { font-family: var(--font-mono) }` rule is load-bearing.

## Deviations from Plan

None — plan executed exactly as written.

**Pre-existing condition noted (not a deviation):** `npx tsc --noEmit` reports 34 errors in `tests/` directory files referencing `__setTurnstileResult`, `__mockSendCalls`, etc. — these are test-infrastructure mock exports unrelated to Phase 14 changes. All errors exist in files not touched by this plan (`tests/*.test.ts`). `npm run build` passes cleanly (Next.js build excludes test files). This pre-existing condition is unchanged.

## Verification Evidence

All 7 TYPO automated checks run against Vercel preview `https://calendar-app-xi-smoky.vercel.app/app/login`:

| Check | Result |
|-------|--------|
| TYPO-01 Inter font variable on `<html>` | PASS: `inter_298da749-module__zPE8pq__variable` present |
| TYPO-02 Roboto Mono variable on `<html>` | PASS: `roboto_mono_ca6955e2-module__j4Vwua__variable` present |
| TYPO-03 `--font-mono:var(--font-roboto-mono)` in compiled CSS | PASS |
| TYPO-04 `letter-spacing:-.017em` in compiled CSS | PASS |
| TYPO-05 `letter-spacing:-.037em` in compiled CSS | PASS |
| TYPO-06 `--color-primary:#3b82f6` in compiled CSS | PASS |
| TYPO-07 `--color-sidebar-primary:#3b82f6` in compiled CSS | PASS |
| MP-07 `tracking-tight` absent from `<html>` | PASS |
| CP-07 `--color-accent: #F97316` unchanged | PASS |
| Q3 `code,pre,kbd{font-family:var(--font-mono)}` in compiled CSS | PASS |

## Issues Encountered

- Vercel deployment took ~90 seconds to register after `git push` and an additional ~60 seconds to go fully live. Polled using `until` loop rather than fixed sleep.
- Initial curl check for `--font-roboto-mono` string on `<html>` returned FAIL — this is expected behavior: Next.js injects hashed CSS variable class names (e.g., `roboto_mono_ca6955e2-module__j4Vwua__variable`), not the raw CSS property name. Verification adapted to match the actual hashed class name pattern.

## Known Carryover

- Component-level `tracking-tight` utility classes on 17+ existing headings (e.g., `<h2 className="tracking-tight">`) remain intentionally. They override the new `h1, h2, h3 { letter-spacing: -0.037em }` baseline via Tailwind `@layer utilities` cascade priority. This is correct behavior documented in RESEARCH.md Risk #6.
- Phase 15 will introduce the first components that actively consume Inter weight 800 (`font-extrabold` NorthStar wordmark) and `--font-mono` (embed code snippet display). The Phase 14 foundation makes those components possible without additional font loading work.

## Next Phase Readiness

Phase 15 (BackgroundGlow + Header Pill + Owner Shell Re-Skin) can assume:
1. `font-extrabold` (Inter weight 800) renders correctly — no browser font synthesis.
2. `var(--font-mono)` resolves to Roboto Mono on raw `<code>` elements.
3. `--color-primary: #3B82F6` is the active value — all shadcn `bg-primary` consumers (Button, Switch, focus-ring, etc.) automatically show NSI blue-500.
4. Body letter-spacing is `-0.017em`; headings without explicit tracking utilities baseline to `-0.037em`.
5. `tracking-tight` is not applied at document root.

Next: `/gsd:plan-phase 15`

---
*Phase: 14-typography-and-css-token-foundations*
*Completed: 2026-04-30*
