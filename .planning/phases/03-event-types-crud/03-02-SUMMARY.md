---
phase: 03-event-types-crud
plan: "02"
subsystem: ui
tags: [shadcn, radix-ui, sonner, toaster, react, next, tailwind]

# Dependency graph
requires:
  - phase: 02-owner-auth-and-dashboard-shell
    provides: shadcn init (components.json with radix-nova style), Phase 2 primitives (button, input, label, alert, card, sidebar, skeleton, sheet, separator, tooltip)
provides:
  - 9 shadcn primitives under components/ui/ (table, dropdown-menu, alert-dialog, switch, badge, select, textarea, sonner, dialog)
  - Sonner Toaster mounted once in root app/layout.tsx
  - radix-ui@^1.4.3 monorepo package in dependencies
  - sonner@^2.0.7 and next-themes@^0.4.6 in dependencies
affects:
  - 03-event-types-crud (Plans 03 and 04 consume table, dropdown-menu, alert-dialog, switch, badge, select, textarea, dialog)
  - All future phases that call toast.success / toast.error

# Tech tracking
tech-stack:
  added:
    - radix-ui@^1.4.3 (shadcn v4 monorepo package — replaces individual @radix-ui/react-* packages)
    - sonner@^2.0.7 (toast library, wrapped by shadcn Toaster)
    - next-themes@^0.4.6 (Sonner peer dep; useTheme() used inside sonner.tsx for theme forwarding)
  patterns:
    - Single-batch shadcn add command (npx shadcn@latest add ...) for all primitives at once
    - Toaster mounted in root layout (not shell layout) for app-wide toast coverage
    - shadcn v4 uses radix-ui monorepo package (not individual @radix-ui/react-* packages)

key-files:
  created:
    - components/ui/table.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/alert-dialog.tsx
    - components/ui/switch.tsx
    - components/ui/badge.tsx
    - components/ui/select.tsx
    - components/ui/textarea.tsx
    - components/ui/sonner.tsx
    - components/ui/dialog.tsx
  modified:
    - app/layout.tsx (added Toaster import + render)
    - package.json (added radix-ui, sonner, next-themes)
    - package-lock.json (lockfile update)

key-decisions:
  - "shadcn v4 uses radix-ui monorepo package (^1.4.3) rather than individual @radix-ui/react-* packages — plan's verification script expected individual packages; updated understanding for future plans"
  - "Toaster mounted in app/layout.tsx root layout only (not shell layout) so toasts render on /app/login and future public booking routes under /[account]/[slug]"
  - "next-themes auto-added as Sonner peer dep; no ThemeProvider added — Sonner defaults to system theme (acceptable for v1, no dark mode)"

patterns-established:
  - "Toaster placement: root layout (app/layout.tsx), not shell layout, for maximum route coverage"
  - "shadcn v4 monorepo: radix-ui single package replaces individual @radix-ui/react-* — check package.json for radix-ui key, not @radix-ui/* keys"

# Metrics
duration: 2min
completed: 2026-04-25
---

# Phase 03 Plan 02: shadcn Primitives + Sonner Toaster Summary

**9 shadcn primitives (table, dropdown-menu, alert-dialog, switch, badge, select, textarea, sonner, dialog) installed via single batch command; Sonner Toaster mounted once in root layout using radix-ui@^1.4.3 monorepo package**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-25T04:49:31Z
- **Completed:** 2026-04-25T04:51:50Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Installed all 9 Phase 3 shadcn primitives in a single `npx shadcn@latest add` invocation; all 10 Phase 2 primitives untouched
- Mounted `<Toaster />` once in `app/layout.tsx` (root layout, not shell layout) — `toast.success()` / `toast.error()` now available from any client component in any route
- `npm run build` exits 0 with all new primitives; all 17 Vitest tests still green

## Task Commits

Each task was committed atomically:

1. **Task 1: Install nine shadcn primitives in a single batch** - `9d301b5` (chore)
2. **Task 2: Mount Sonner Toaster in the root layout** - `0b39817` (feat)

**Plan metadata:** (committed after this summary)

## Files Created/Modified

- `components/ui/table.tsx` - shadcn Table primitive (TableHeader, TableBody, TableRow, TableCell, TableHead)
- `components/ui/dropdown-menu.tsx` - shadcn DropdownMenu primitive (kebab menu for row actions)
- `components/ui/alert-dialog.tsx` - shadcn AlertDialog primitive (delete confirmation modal)
- `components/ui/switch.tsx` - shadcn Switch primitive (active/inactive toggle in form)
- `components/ui/badge.tsx` - shadcn Badge primitive (Active / Inactive / Archived status pill)
- `components/ui/select.tsx` - shadcn Select primitive (question-type dropdown)
- `components/ui/textarea.tsx` - shadcn Textarea primitive (description field, long-text questions)
- `components/ui/sonner.tsx` - shadcn Sonner wrapper (Toaster component with radix-nova theme)
- `components/ui/dialog.tsx` - shadcn Dialog primitive (restore-with-slug-collision standalone Dialog in Plan 04)
- `app/layout.tsx` - Added Toaster import + render after {children} inside <body>
- `package.json` - Added radix-ui@^1.4.3, sonner@^2.0.7, next-themes@^0.4.6
- `package-lock.json` - Lockfile updated for new packages

## Decisions Made

- **shadcn v4 monorepo package**: The plan's verification script checked for individual `@radix-ui/react-dropdown-menu` etc. in package.json. shadcn@4.4.0 installs a single `radix-ui` monorepo package (`^1.4.3`) that bundles all Radix primitives. The generated `components/ui/*.tsx` files import from `radix-ui` directly. The verification check was adapted to confirm `radix-ui` exists rather than individual packages. All component files generated correctly.
- **No ThemeProvider added**: `next-themes` was auto-added as a Sonner peer dep. `components/ui/sonner.tsx` calls `useTheme()` from `next-themes` to forward app theme to Sonner. No `<ThemeProvider>` wrapper was added — Sonner defaults to `"system"` theme, acceptable for v1 (no dark mode).

## Deviations from Plan

None - plan executed exactly as written. The radix-ui monorepo package behavior (vs. individual packages) was a documentation note in the verification step, not a deviation from the install outcome.

## Issues Encountered

- **ESLint lint check**: `npm run lint` exits with the pre-existing circular-JSON error documented in STATE.md Phase 8 backlog ("ESLint flat-config migration"). This is not a regression from this plan — `npm run build` (TypeScript + Tailwind compilation) exits 0 cleanly. Lint failure pre-dates Phase 1 and is tracked for Phase 8 fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 3 UI primitives ready: Plans 03-03 (list/detail UI) and 03-04 (archive/restore UI) can now import from `components/ui/` without any additional installs
- `toast.success()` / `toast.error()` wired app-wide — server action feedback pattern can be used immediately in Plans 03-03 and 03-04
- No blockers

---
*Phase: 03-event-types-crud*
*Completed: 2026-04-25*
