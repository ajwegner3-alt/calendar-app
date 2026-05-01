---
phase: 17-public-surfaces-and-embed
plan: 06
subsystem: ui
tags: [nextjs, tailwind, public-surfaces, error-pages, not-found, token-not-active]

# Dependency graph
requires:
  - phase: 17-public-surfaces-and-embed/17-02
    provides: v1.2 card lock class string + bg-gray-50 visual language established in PublicShell

provides:
  - not-found page at /[account]/[event-slug] re-skinned with min-h-screen bg-gray-50 + v1.2 card lock
  - TokenNotActive component re-skinned with min-h-screen bg-gray-50 + main + v1.2 card lock

affects:
  - 17-05 (cancel/reschedule page migrations — consume TokenNotActive from not_active branches)
  - Phase 20 dead code cleanup (bg-card + rounded-lg instances now eliminated from these two files)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge pages (no branding context) use min-h-screen bg-gray-50 outer + v1.2 card lock directly — no PublicShell"
    - "v1.2 card lock: rounded-xl border border-gray-200 bg-white p-6 sm:p-8 text-center shadow-sm"

key-files:
  created: []
  modified:
    - app/[account]/[event-slug]/not-found.tsx
    - app/_components/token-not-active.tsx

key-decisions:
  - "No PublicShell on either page — PUB-10/PUB-11 explicit: no branding available at 404 or token-invalid time"
  - "TokenNotActiveProps interface unchanged — callers (cancel, reschedule not_active branches) depend on it verbatim"
  - "text-primary on ownerEmail mailto link resolves to global NSI blue (:root --primary = oklch(0.606 0.195 264.5)) when no PublicShell wraps — acceptable per PUB-11"
  - "max-w-xl narrowed to max-w-md on not-found page — focused error card per PUB-10 spec"

patterns-established:
  - "Edge error pages without branding context: min-h-screen bg-gray-50 wrapper + max-w-md main + v1.2 card — NO PublicShell"

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 17 Plan 06: Edge Pages Migration Summary

**Both pre-branding edge pages (404 not-found + TokenNotActive) re-skinned with min-h-screen bg-gray-50 + v1.2 rounded-xl card lock, eliminating bg-card + rounded-lg remnants without touching PublicShell**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T00:00:00Z
- **Completed:** 2026-04-30T00:05:00Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- `app/[account]/[event-slug]/not-found.tsx` now renders `min-h-screen bg-gray-50` outer div + `max-w-md` main + v1.2 card lock (PUB-10)
- `app/_components/token-not-active.tsx` now renders `min-h-screen bg-gray-50` outer div + `<main>` + v1.2 card lock; JSDoc updated to explain PUB-11 rationale (PUB-11)
- `bg-card` and `rounded-lg` purged from both files; replaced with `bg-white` and `rounded-xl` per v1.2 lock
- Consumers (`app/cancel/[token]/page.tsx`, `app/reschedule/[token]/page.tsx`) continue to work without any modification

## Task Commits

1. **Task 1: Re-skin /[account]/[event-slug]/not-found.tsx** - `1615155` (refactor)
2. **Task 2: Re-skin TokenNotActive with bg-gray-50 + centered card** - `4175135` (refactor)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `app/[account]/[event-slug]/not-found.tsx` - 404 page for invalid booking URLs; now uses min-h-screen bg-gray-50 + v1.2 card (no PublicShell — no account context at 404 time)
- `app/_components/token-not-active.tsx` - Cancel/reschedule invalid-token fallback; now uses min-h-screen bg-gray-50 + main + v1.2 card; TokenNotActiveProps preserved verbatim

## Decisions Made

- **No PublicShell on either page** — PUB-10/PUB-11 are explicit: both pages run before account context resolves (404 = account/event missing; TokenNotActive = token invalid/expired). No `Branding` object is available, so `PublicShell` cannot be used. Plain `bg-gray-50` wrapper is the correct pattern.
- **TokenNotActiveProps interface unchanged** — `ownerEmail: string | null` and `ownerName?: string | null` preserved. Callers in cancel/reschedule not_active branches pass `ownerEmail={null}` and work without modification.
- **`text-primary` on mailto link** — In the not_active code path, no PublicShell means `--primary` resolves to global NSI blue (`oklch(0.606 0.195 264.5)`). The "Contact {ownerName}" link renders NSI blue, not customer brand color. Acceptable per PUB-11 ("no PublicShell here, no branding available").
- **max-w-xl → max-w-md on not-found** — Narrower error card looks more focused; per PUB-10 spec.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing tsc errors in `tests/` directory are the known maintenance backlog (STATE.md). Source files (`app/`) produced zero tsc errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PUB-10 (not-found page) and PUB-11 (TokenNotActive) requirements are complete.
- Wave 3 parallel plans (17-03 through 17-06) can complete independently; all modify disjoint files.
- Phase 18 (Branding Editor Simplification) unblocked — no dependencies on these edge pages.

---
*Phase: 17-public-surfaces-and-embed*
*Completed: 2026-04-30*
