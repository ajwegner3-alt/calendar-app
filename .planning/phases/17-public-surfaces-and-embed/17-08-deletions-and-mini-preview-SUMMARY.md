---
phase: 17-public-surfaces-and-embed
plan: 08
subsystem: ui
tags: [branding, gradient, cleanup, dead-code, mini-preview, react, nextjs]

# Dependency graph
requires:
  - phase: 17-03-through-17-07
    provides: Wave 3 public page migrations away from BrandedPage/GradientBackdrop; all public surfaces using PublicShell

provides:
  - MiniPreviewCard freed of GradientBackdrop dependency (flat color tint bridge)
  - BrandedPage deleted
  - GradientBackdrop deleted
  - NSIGradientBackdrop deleted
  - lib/branding/gradient.ts (shadeToGradient) deleted
  - Codebase grep clean: zero source-code consumers of deleted symbols

affects: [phase-18-branding-editor-simplification, phase-20-dead-code-cleanup, phase-21-schema-drop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bridge edit pattern: minimal change to unblock deletion, full rebuild deferred to next phase"
    - "Pre-deletion grep gate: verify zero non-comment consumers before git rm"

key-files:
  created: []
  modified:
    - app/(shell)/app/branding/_components/mini-preview-card.tsx
    - app/(shell)/app/branding/_components/branding-editor.tsx
  deleted:
    - app/_components/branded-page.tsx
    - app/_components/gradient-backdrop.tsx
    - components/nsi-gradient-backdrop.tsx
    - lib/branding/gradient.ts

key-decisions:
  - "Bridge edit only: MiniPreviewCard gets flat color tint, not a full redesign — Phase 18 rebuilds it as faux public booking page (BRAND-17)"
  - "Comment-only matches (auth-hero.tsx, listing-hero.tsx, public-shell.tsx, mini-preview-card.tsx) are acceptable and do not block deletion"
  - "BackgroundShade type in lib/branding/types.ts retained — it is still used by ShadePicker/branding-editor; Phase 18/21 will remove it"

patterns-established:
  - "Pre-deletion grep gate pattern: grep all 4 symbols, confirm only comment-only or self-referential matches remain, then git rm"

# Metrics
duration: ~3min
completed: 2026-04-30
---

# Phase 17 Plan 08: Deletions and Mini-Preview Summary

**Deleted BrandedPage, GradientBackdrop, NSIGradientBackdrop, and gradient utility after migrating MiniPreviewCard to flat color tint — codebase grep gate clean, tsc and npm run build both pass**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-01T01:44:41Z
- **Completed:** 2026-05-01T01:47:35Z
- **Tasks:** 2
- **Files modified:** 2 (mini-preview-card.tsx, branding-editor.tsx)
- **Files deleted:** 4 (branded-page.tsx, gradient-backdrop.tsx, nsi-gradient-backdrop.tsx, lib/branding/gradient.ts)

## Accomplishments

- MiniPreviewCard freed of GradientBackdrop: `shade` prop removed, flat `backgroundColor` tint replaces gradient render
- Pre-deletion grep gate confirmed zero active consumers of all 4 deleted symbols
- Four dead-code files removed via `git rm` — 233 lines of legacy gradient infrastructure gone
- TypeScript clean (non-test files) and full `npm run build` passes post-deletion

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate mini-preview-card.tsx away from GradientBackdrop** - `8fb2480` (refactor)
2. **Task 2: Delete BrandedPage, GradientBackdrop, NSIGradientBackdrop, gradient utility** - `0631667` (chore)

**Plan metadata:** (docs commit follows)

## Deleted Files

| File | Reason |
|------|--------|
| `app/_components/branded-page.tsx` | Replaced by PublicShell in Wave 3 (17-03..07); zero active consumers |
| `app/_components/gradient-backdrop.tsx` | Last consumer (MiniPreviewCard) migrated in Task 1 |
| `components/nsi-gradient-backdrop.tsx` | Thin wrapper around GradientBackdrop; zero active consumers (auth-hero.tsx only references in comment) |
| `lib/branding/gradient.ts` | Exports shadeToGradient; only consumer was GradientBackdrop (now deleted) |

## Pre-Deletion Grep Gate Results

All 4 symbols checked across `app/`, `components/`, `lib/` (`*.ts`, `*.tsx`):

| Symbol | Remaining matches | Status |
|--------|-------------------|--------|
| `BrandedPage` | `public-shell.tsx:2` (comment: "Replaces BrandedPage") | CLEAN |
| `GradientBackdrop` | `auth-hero.tsx:16`, `mini-preview-card.tsx:21`, `listing-hero.tsx:10` (all comments) | CLEAN |
| `NSIGradientBackdrop` | `auth-hero.tsx:16` (comment per plan's explicit acceptable-matches note) | CLEAN |
| `shadeToGradient` | Zero matches outside deleted files | CLEAN |

## MiniPreviewCard Changes

- **Removed:** `import type { BackgroundShade } from "@/lib/branding/types"`
- **Removed:** `import { GradientBackdrop } from "@/app/_components/gradient-backdrop"`
- **Removed:** `shade: BackgroundShade` from `MiniPreviewCardProps` interface
- **Removed:** `shade` from function destructure and `<GradientBackdrop color={pageColor} shade={shade} />` render
- **Retained:** All three color props (`sidebarColor`, `pageColor`, `primaryColor`)
- **Retained:** Flat `style={{ backgroundColor: pageColor ?? undefined }}` on outer container (already present)
- **Consumer updated:** `branding-editor.tsx` — `shade={backgroundShade}` removed from `<MiniPreviewCard>` call site

Note: `BackgroundShade` import in `branding-editor.tsx` is intentionally retained — it is still needed for `ShadePicker` and the `backgroundShade` state variable.

## Decisions Made

- **Bridge edit only:** Task 1 does the minimum to free GradientBackdrop deletion. Phase 18 will fully rebuild MiniPreviewCard as a faux public booking page per BRAND-17.
- **BackgroundShade type retained:** `lib/branding/types.ts` still exports `BackgroundShade`; it remains consumed by ShadePicker. Phase 18/21 scope its removal.
- **Comment-only matches acceptable:** Per plan's explicit note, `auth-hero.tsx` Phase 16 migration comment referencing NSIGradientBackdrop does not block deletion — comments don't break compilation.

## Deviations from Plan

None — plan executed exactly as written. Tasks completed in order, grep gate clean, no unexpected consumers found.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PUB-12 fully satisfied: BrandedPage, GradientBackdrop, NSIGradientBackdrop, and gradient utility all deleted
- CLEAN-04, CLEAN-05, CLEAN-06 (Phase 20 requirements) are pre-satisfied — Phase 20 verifications will be no-op confirms
- Phase 18 (Branding Editor Simplification) is unblocked: MiniPreviewCard bridge edit in place; full rebuild per BRAND-17 can proceed
- `BackgroundShade` type in `lib/branding/types.ts` and `background_shade` column/ENUM are Phase 21 DROP migration targets — still in place

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
