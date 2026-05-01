---
phase: 17-public-surfaces-and-embed
plan: 01
subsystem: ui
tags: [nextjs, tailwind, react, server-component, header, branding]

# Dependency graph
requires:
  - phase: 16-auth-onboarding-re-skin
    provides: Header variant API (owner/auth) that this plan extends with 'public'
  - phase: 15-backgroundglow-header-owner-shell
    provides: BackgroundGlow component with color prop that this plan patches (MP-10)

provides:
  - BackgroundGlow with both blobs terminating at transparent (MP-10 fix)
  - PoweredByNsi Server Component for public/embed attribution footer
  - Header variant='public' with branding prop + accountName prop

affects:
  - 17-02-public-shell (composes all three atoms into PublicShell)
  - 17-03-embed-shell (uses PoweredByNsi inside EmbedShell)
  - 17-04 through 17-06 (public page migrations use PublicShell which uses these atoms)
  - 17-09-visual-gate (visual verification of public surfaces built on these atoms)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public header variant pattern: variant='public' guard returns early before owner/auth branch — hooks still called every render (no early-return-before-hook violation)"
    - "MP-04 lock: all runtime hex values via inline style={{}} only — never bg-[${color}] Tailwind composition"
    - "Server Component pattern: PoweredByNsi has no use client directive, no hooks, no state"

key-files:
  created:
    - app/_components/powered-by-nsi.tsx
  modified:
    - app/_components/background-glow.tsx
    - app/_components/header.tsx

key-decisions:
  - "usePathname() kept at top of Header function (before public branch guard) — React hooks rule compliance. Hook runs on every render; result is unused on public branch (acceptable)."
  - "accountName passed as separate prop from branding — Branding type does not contain account name (it is an account field, not a branding field)"
  - "public branch guard placed BEFORE owner/auth outerClassName logic — early return avoids mixing concerns while keeping hooks at top"

patterns-established:
  - "Header variant extension pattern: ADD guard block early in function body, return separate JSX tree, leave existing owner/auth code untouched below"
  - "Attribution footer: named export Server Component with py-8 text-center wrapper, text-xs text-gray-400 text, hover:text-gray-600 transition-colors link"

# Metrics
duration: ~8min
completed: 2026-04-30
---

# Phase 17 Plan 01: Foundation Atoms Summary

**BackgroundGlow MP-10 bug fixed (blob 2 transparent), PoweredByNsi Server Component created, Header extended with variant='public' + branding prop — three atoms enabling PublicShell composition in Plan 17-02**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-30T~01:26:00Z
- **Completed:** 2026-04-30T01:34:06Z
- **Tasks:** 3 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Fixed MP-10 bug: BackgroundGlow blob 2 previously terminated at `#111827` (dark navy) — visible dark smear on bg-gray-50 with arbitrary brand colors. Both blobs now terminate at `transparent`.
- Created `PoweredByNsi` as a named Server Component (no `use client`) with `py-8 text-center` wrapper, link to `https://nsintegrations.com` with `target="_blank" rel="noopener noreferrer"`.
- Extended `Header` with `variant='public'` union member, `branding?: Branding` prop, and `accountName?: string` prop. Public branch renders logo `<img>` (max-h 40px, HDR-05) or primary-color initial-circle fallback (HDR-06). Owner and auth branches unchanged byte-for-byte.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix BackgroundGlow MP-10 bug — blob 2 terminus → transparent** - `9e36f58` (fix)
2. **Task 2: Create PoweredByNsi footer component** - `e4fa1ec` (feat)
3. **Task 3: Extend Header with variant='public' + branding prop** - `71092fb` (feat)

**Plan metadata:** committed separately as `docs(17-01): complete foundation-atoms plan`

## Files Created/Modified

- `app/_components/background-glow.tsx` — MP-10 fix: blob 2 gradient terminus `#111827` → `transparent`; Phase 17 comment added
- `app/_components/powered-by-nsi.tsx` — New Server Component; PUB-04 attribution footer
- `app/_components/header.tsx` — `import type { Branding }` added; `HeaderProps` extended with `'public'` variant + `branding?` + `accountName?`; public branch JSX tree added before owner/auth logic

## Decisions Made

- **`usePathname()` hook position:** Kept at top of `Header` function (before the `variant === 'public'` guard) to satisfy React hooks rule (no conditional hook calls). The hook runs every render on the public branch but its result is unused — acceptable trade-off vs. the alternative of splitting into two separate components.
- **`accountName` as separate prop:** `Branding` type holds visual/style fields (logoUrl, primaryColor, etc.) — account name is an account field, not a branding field. Keeping them separate prevents coupling `Branding` to display concerns.
- **No default export on `PoweredByNsi`:** Consistent with naming convention of `BackgroundGlow`, `Header`, and other `_components` — all use named exports only.

## Deviations from Plan

None — plan executed exactly as written. All three tasks implemented verbatim from spec. No blocking issues, no architectural surprises.

## Issues Encountered

None. `npx tsc --noEmit` produced only pre-existing test errors (TS7006/TS2305 in `tests/` directory per STATE.md maintenance backlog) — zero new errors in source files.

## User Setup Required

None — no external service configuration required. This plan is additive component work only; no environment variables, no Supabase changes, no Vercel config.

## Next Phase Readiness

All three atoms are ready for Plan 17-02 (PublicShell):
- `BackgroundGlow` renders cleanly on `bg-gray-50` with any `brand_primary` hex (MP-10 fixed)
- `PoweredByNsi` is importable by `PublicShell` and `EmbedShell`
- `Header` accepts `variant="public"` with `branding` and `accountName` — call sites land in Plan 17-02 (PublicShell) and Plans 17-04..06 (page migrations)

No blockers for Plan 17-02.

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
