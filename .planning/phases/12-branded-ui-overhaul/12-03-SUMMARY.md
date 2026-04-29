---
phase: 12-branded-ui-overhaul
plan: "03"
subsystem: ui
tags: [next-font, inter, tailwind-v4, cruip, sidebar, glass-header, gradient-backdrop, branding]

# Dependency graph
requires:
  - phase: 12-01-branding-tokens-foundation
    provides: GradientBackdrop primitive, getBrandingForAccount helper, BackgroundShade type, background_color + background_shade on accounts table
provides:
  - Inter font loaded globally via next/font/google with --font-sans CSS variable
  - bg-gray-50 page background and gray-900 text baseline (Cruip Simple Light)
  - FloatingHeaderPill component (Cruip glass pill, fixed top-2/md:top-6)
  - Rebuilt app-sidebar with flat IA (Home/Event Types/Availability/Bookings/Branding/Settings accordion)
  - GradientBackdrop wired into (shell)/layout.tsx consuming per-account branding tokens
  - --sidebar-width-mobile: 100vw for full-screen mobile drawer
affects:
  - 12-04a (Home tab — sidebar Home item now links to /app; Plan 12-04a refactors /app/page.tsx)
  - 12-05 (public surfaces — GradientBackdrop pattern established; BrandedPage already wires it)
  - 13-manual-qa (dashboard chrome visual QA)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cruip Simple Light glass header pill: fixed-position rounded-2xl bg-white/90 backdrop-blur-sm with gradient hairline border"
    - "Settings inline accordion: useState toggle (NOT route-driven); defaults open on /app/settings/* routes"
    - "Sidebar IA: single flat SidebarGroup, 6 items, exact-match active for /app Home"
    - "Shell layout account fetch: inline SELECT from accounts WHERE owner_user_id = claims.sub (no helper wrapper)"
    - "SidebarInset: relative overflow-hidden bg-background for GradientBackdrop containment"

key-files:
  created:
    - app/(shell)/_components/floating-header-pill.tsx
  modified:
    - app/layout.tsx
    - app/globals.css
    - app/(shell)/layout.tsx
    - components/app-sidebar.tsx

key-decisions:
  - "Settings expansion is local useState only — no cookie persistence; collapses on navigation (CONTEXT.md lock)"
  - "Mobile sidebar width is 100vw via --sidebar-width-mobile CSS var (CONTEXT.md lock)"
  - "FloatingHeaderPill renders on all viewports (not md:hidden) — hamburger trigger always present"
  - "Shell layout fetches account row inline (no helper exists); getBrandingForAccount used for branding"
  - "Sidebar footer (email display + logout) preserved despite not in plan template — critical UX functionality"

patterns-established:
  - "Floating glass pill: fixed top-2 z-30 w-full md:top-6; pill div uses before: pseudo for gradient border"
  - "main content offset: pt-20 sm:px-6 md:pt-28 to clear floating pill height + top offset"

# Metrics
duration: 3min
completed: 2026-04-29
---

# Phase 12 Plan 03: Dashboard Chrome Summary

**Inter + Cruip glass pill header + GradientBackdrop + flat sidebar IA (Home/Event Types/Availability/Bookings/Branding/Settings accordion) across all dashboard routes**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-29T12:38:14Z
- **Completed:** 2026-04-29T12:41:34Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Swapped Geist for Inter via `next/font/google`; `tracking-tight` added to `<html>` globally (UI-01)
- Created `FloatingHeaderPill` (Cruip glass pill, `fixed top-2 z-30 w-full md:top-6`) with `SidebarTrigger` hamburger replacing old mobile-only header (UI-03)
- Wired `GradientBackdrop` into `(shell)/layout.tsx` consuming `account.background_color` + `account.background_shade` via `getBrandingForAccount` (UI-04 dashboard portion)
- Rebuilt `app-sidebar.tsx` with single flat group: Home / Event Types / Availability / Bookings / Branding / Settings (inline accordion to Reminders + Profile) (UI-05)
- Set `--background: oklch(0.985 0.002 247)` (gray-50) and `--sidebar-width-mobile: 100vw` in `@theme` (UI-02, mobile drawer)
- Test suite: 184 passing + 26 skipped (baseline was 173; no regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Inter font + globals.css tokens + sidebar mobile width override** - `e33db45` (feat)
2. **Task 2: FloatingHeaderPill + (shell)/layout.tsx wiring with GradientBackdrop** - `41d2d90` (feat)
3. **Task 3: Refactor app-sidebar.tsx — flat IA + Settings inline accordion + Home item** - `6589d25` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `app/layout.tsx` — Geist → Inter; `tracking-tight` on `<html>`
- `app/globals.css` — `--background` (gray-50) + `--foreground` (gray-900) + `--sidebar-width-mobile: 100vw` added to `@theme`
- `app/(shell)/_components/floating-header-pill.tsx` — NEW: Cruip glass header pill component
- `app/(shell)/layout.tsx` — adds account row fetch + branding fetch + GradientBackdrop + FloatingHeaderPill; removes old md:hidden header; main gets `pt-20 md:pt-28` offset
- `components/app-sidebar.tsx` — full rebuild: flat IA, Settings inline accordion, Home item added, footer preserved

## Decisions Made

1. **Settings expansion is local `useState` only** — no cookie persistence; collapses on page navigation. Per CONTEXT.md lock (NOT route-driven, NOT flyout). Flag for v1.2 follow-up if Andrew requests persistence.
2. **FloatingHeaderPill renders on all viewports** — not conditionally hidden on desktop. Mobile uses hamburger; desktop sidebar stays open by default. Both paths use the same pill component.
3. **Sidebar footer preserved** — plan template omitted the email display + logout form. Kept as critical UX (without it users have no way to log out). Not a deviation from requirements.
4. **`main` offset `pt-20 md:pt-28`** — clears the fixed pill's height (h-14) plus its top offset (top-2/md:top-6) with breathing room.
5. **Account row fetched inline in shell layout** — no `loadAccountForUser` helper exists in this codebase. Replicated pattern from `app/(shell)/app/page.tsx`. Row includes `background_color + background_shade` needed for GradientBackdrop.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `getBrandingForAccount` instead of `readBrandingForAccount`**
- **Found during:** Task 2 (FloatingHeaderPill + layout wiring)
- **Issue:** Plan referenced `readBrandingForAccount` (from plan context notes), but the actual function exported from `lib/branding/read-branding.ts` is `getBrandingForAccount`. `readBrandingForAccount` does not exist anywhere in the codebase.
- **Fix:** Used `getBrandingForAccount(account.id)` — the correct canonical helper.
- **Files modified:** `app/(shell)/layout.tsx`
- **Verification:** `npx tsc --noEmit` clean; function signature matches usage.
- **Committed in:** `41d2d90` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug — incorrect function name in plan)
**Impact on plan:** Fix essential for correctness. No scope creep.

## Issues Encountered

None — TypeScript was clean after each task; pre-existing test-mock alias errors in `tests/` files are v1.2 tech debt (documented in STATE.md) and unaffected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 12-04a (Home tab calendar):** Sidebar Home item links to `/app`; Plan 12-04a refactors `app/(shell)/app/page.tsx` to be the calendar landing. No blockers.
- **Plan 12-05 (public surfaces):** GradientBackdrop pattern established in dashboard; BrandedPage (12-01) already wires it for public surfaces. No blockers.
- **Plan 12-06 (email branding):** No dependency on dashboard chrome. No blockers.
- **Pitfall 5 (sidebar_state cookie):** Verified — `SIDEBAR_COOKIE_NAME` constant in `components/ui/sidebar.tsx` and `cookieStore.get("sidebar_state")` in layout both intact. Phase 7 contract preserved.
- **Settings reachable from every dashboard route:** Yes — sidebar is in `(shell)/layout.tsx` which wraps all dashboard routes.

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
