---
phase: 17-public-surfaces-and-embed
plan: 02
subsystem: ui
tags: [next.js, tailwind, server-component, css-vars, branding, public-shell]

# Dependency graph
requires:
  - phase: 17-01-foundation-atoms
    provides: BackgroundGlow (MP-10 fix), PoweredByNsi, Header variant=public
  - phase: 15-background-glow-header
    provides: BackgroundGlow, Header, lib/brand.ts
  - phase: 14-typography-css-tokens
    provides: CSS token foundations, globals.css
provides:
  - PublicShell Server Component (app/_components/public-shell.tsx)
  - Dual CSS-var injection pattern (--brand-primary + --primary with foreground counterparts)
  - Luminance-based glow fallback to NSI blue when brand_primary > 0.85
affects:
  - 17-03-booking-page (first Wave 3 consumer)
  - 17-04-confirmation-page
  - 17-05-cancel-page
  - 17-06-reschedule-page
  - 17-07-embed-shell

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual CSS-var shell: set both --brand-primary (legacy BookingForm) and --primary (SlotPicker) in a single wrapper div around children"
    - "Luminance fallback: relativeLuminance() > 0.85 triggers NSI blue substitution so glow is always visible on bg-gray-50"
    - "Server Component shell composition: no 'use client'; all atoms are importable server-side"

key-files:
  created:
    - app/_components/public-shell.tsx
  modified: []

key-decisions:
  - "Props: branding: Branding (not raw row) + accountName: string (separate prop, not a branding field)"
  - "Luminance threshold 0.85 per RESEARCH.md Q10 — approximately #D0D0D0; anything lighter substitutes NSI blue"
  - "Dual CSS vars: --brand-primary AND --primary both set because codebase has both patterns active (BookingForm line 248 uses --brand-primary; SlotPicker uses bg-primary class)"
  - "PoweredByNsi rendered outside <div style={cssVars}> and outside <main> — placed after main in the outer bg-gray-50 div per REQUIREMENTS.md PUB-02"
  - "try/catch around relativeLuminance() is defensive belt-and-suspenders — contrast.ts already handles malformed hex gracefully"

patterns-established:
  - "PublicShell is the canonical replacement for BrandedPage on all public surfaces"
  - "CSS-var wrapper wraps only {children}, not BackgroundGlow or Header (those don't need brand vars)"

# Metrics
duration: ~5min
completed: 2026-04-30
---

# Phase 17 Plan 02: Public Shell Summary

**PublicShell Server Component composing BackgroundGlow + public Header + dual brand CSS vars (--brand-primary AND --primary) + PoweredByNsi footer — the keystone Wave 3 page migrations will consume**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30
- **Completed:** 2026-04-30
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- Created `PublicShell` Server Component as the single replacement for `BrandedPage` across all 5 public booking surfaces
- Implemented luminance-based glow fallback: when `brand_primary` relative luminance exceeds 0.85 (near-white), substitutes NSI blue `#3B82F6` so the glow is always visible on bg-gray-50
- Injected dual CSS vars (`--brand-primary` + `--primary` with `-foreground` counterparts) so both the legacy BookingForm submit button and the SlotPicker's `bg-primary` class inherit the customer's brand color without any call-site changes

## Task Commits

1. **Task 1: Create PublicShell Server Component** - `d049c34` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `app/_components/public-shell.tsx` — PublicShell Server Component; accepts `{ branding: Branding, accountName: string, children: ReactNode }`; composes BackgroundGlow + Header(public) + CSS-var div + main + PoweredByNsi

## Decisions Made

**1. Props: `branding: Branding` not raw row, plus separate `accountName: string`**
Callers must call `brandingFromRow(account)` before passing to PublicShell. `accountName` is a separate prop because it is not a branding field — it's the account display name needed for the Header pill right slot. This matches REQUIREMENTS.md PUB-01 wording and keeps the Branding type clean.

**2. Dual CSS vars — both `--brand-primary` and `--primary` set**
REQUIREMENTS.md PUB-03 mentions only `--primary`, but RESEARCH.md Pitfall 1 documents that the codebase has two active patterns simultaneously: BookingForm (`booking-form.tsx` line 248) uses `--brand-primary` for its submit button inline style, while SlotPicker uses Tailwind's `bg-primary` which resolves to `--primary`. Setting only one would leave the other unbranded. PublicShell deliberately sets both. The `--brand-text` and `--primary-foreground` counterparts are also set (both from `branding.textColor`, which is pre-computed by `brandingFromRow()`) so button text is always legible.

**3. Luminance threshold = 0.85**
Per RESEARCH.md Q10 recommendation and CONTEXT.md discretion grant. 0.85 corresponds approximately to #D0D0D0 — anything lighter (e.g., white, light yellow, pale pink) substitutes NSI blue. This ensures the ambient glow is always visible on the bg-gray-50 surface.

**4. `try/catch` around `relativeLuminance()`**
`contrast.ts` already handles malformed hex gracefully (returns luminance of #0A2540), so the try/catch is belt-and-suspenders. The shell must never crash on a bad DB value.

**5. CSS-var wrapper scope**
The `<div style={cssVars}>` wraps only `{children}` (i.e., `<main>`). BackgroundGlow and Header are outside the wrapper because they do not read `--brand-primary` or `--primary` from CSS vars — Header reads branding props directly.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` output contained only pre-existing `tests/` errors (documented in STATE.md as out-of-scope maintenance backlog). Zero non-test TypeScript errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

PublicShell is complete and ready for Wave 3 page migration plans:
- **17-03** (booking page): import PublicShell, wrap BookingPageContent, remove BrandedPage
- **17-04** (confirmation page): same pattern
- **17-05** (cancel page): same pattern
- **17-06** (reschedule page): same pattern
- **17-07** (embed shell): will compose its own EmbedShell using PoweredByNsi directly (CP-05: embed gets its own `--primary` override)

No blockers. The component is a Server Component, tsc-clean, and verified to export `PublicShell` with the correct signature.

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
