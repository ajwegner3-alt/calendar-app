---
phase: 37-upgrade-flow-and-cap-hit-ui
plan: "03"
subsystem: settings-page, ui-form
tags: [next.js, server-component, react, useTransition, tailwind, supabase, getClaims]

# Dependency graph
requires:
  - phase: 37-01
    provides: last_upgrade_request_at column on accounts table + cap-hit banner link to /app/settings/upgrade
  - phase: 37-02
    provides: requestUpgradeAction server action (Resend direct send, 24h rate-limit, core/wrapper split)
provides:
  - /app/settings/upgrade server component (auth guard, account fetch, 24h computation)
  - UpgradeForm client component (5 visual states: idle, submitting, success, locked-out, error)
  - End-to-end UPGRADE-01 through UPGRADE-04 phase success criteria all observable
affects: [38-magic-link-login, 39-booker-polish, phase-40-dead-code-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getClaims() auth pattern (matches gmail/page.tsx — NOT getUser())
    - Server computes locked-out state + countdown string; passes as props to client
    - useTransition + ok/error result pattern (matches reminder-toggles-form.tsx shape)
    - No react-hook-form / zod for simple single-field forms

key-files:
  created:
    - app/(shell)/app/settings/upgrade/page.tsx
    - app/(shell)/app/settings/upgrade/_components/upgrade-form.tsx
  modified: []

key-decisions:
  - "getClaims() not getUser() — matches gmail/page.tsx, the most recent settings page precedent"
  - "account.id NOT passed to UpgradeForm props — action re-derives account from session to avoid trusting client-provided id"
  - "No react-hook-form or zod — single textarea with no per-field validation; useState sufficient and matches action's RequestUpgradeArgs shape"
  - "No setInterval/setTimeout for countdown — CONTEXT-locked decision; timeRemaining is server-rendered static string; user reloads for update"
  - "column is accounts.name not accounts.business_name — RESEARCH Pitfall 1 re-confirmed in select"

patterns-established:
  - "Server-rendered locked-out countdown: page.tsx computes lockedOut + timeRemaining and passes as props; client never recalculates"
  - "lockedOut disables BOTH textarea and submit button — defense-in-depth layered over server action's 24h guard"

# Metrics
duration: 2min
completed: 2026-05-08
---

# Phase 37 Plan 03: Upgrade Page and Form Summary

**Auth-guarded /app/settings/upgrade server page with 5-state UpgradeForm client component closes the Phase 37 user-visible loop — banner link now lands on a real submission page with server-rendered 24h locked-out countdown**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-08T19:39:53Z
- **Completed:** 2026-05-08T19:41:55Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments

- `/app/settings/upgrade` is a real, browseable, auth-guarded route (UPGRADE-01 + UPGRADE-02 observable end-to-end)
- Server computes `lockedOut` + `timeRemaining` from `accounts.last_upgrade_request_at` before any client code runs — no client-side countdown timer required
- UpgradeForm renders 5 distinct visual states using only `useTransition` + `useState` (no external form library)
- All Plan 02 Vitest tests remain green (9/9 pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement /app/settings/upgrade server component (page.tsx)** — `bf0307a` (feat)
2. **Task 2: Implement UpgradeForm client component (_components/upgrade-form.tsx)** — `9b5eca7` (feat)

**Plan metadata:** see docs commit below

## Files Created/Modified

- `app/(shell)/app/settings/upgrade/page.tsx` — Server component: auth guard via getClaims(), accounts fetch with `last_upgrade_request_at`, 24h computation, renders UpgradeForm with lockedOut + timeRemaining props
- `app/(shell)/app/settings/upgrade/_components/upgrade-form.tsx` — Client component: 5 visual states (idle/submitting/success/locked-out/error), useTransition, calls requestUpgradeAction, no react-hook-form/zod, no setInterval

## Decisions Made

**1. getClaims() not getUser()**
Matches `gmail/page.tsx` (the most recent settings page). `getClaims()` is the established v1.7 pattern for server component auth checks.

**2. account.id NOT passed as prop to UpgradeForm**
The server action re-derives the account from the session (RLS-scoped query inside `requestUpgradeCore`). Passing the id as a client prop would allow a user to substitute a different account id. This avoids trusting client-supplied values for a privileged write path.

**3. No react-hook-form / zod**
The form has one optional textarea with no per-field validation rules. `useState` + a null/empty check is sufficient and matches the action's `RequestUpgradeArgs` type directly. Using form libraries here would add overhead without benefit.

**4. Server-rendered countdown only (no setInterval)**
CONTEXT-locked decision from `37-CONTEXT.md`. The countdown string ("18h 23m") is computed server-side and passed as a static prop. The user reloads the page to see an updated value. This avoids hydration mismatches and keeps the component free of timer cleanup logic.

**5. column is `name` not `business_name`**
RESEARCH Pitfall 1, re-confirmed. The `accounts` table column is `name`. No `business_name` column exists.

## Deviations from Plan

None — plan executed exactly as written. Both files match the code skeletons in the plan verbatim.

## Issues Encountered

None. TypeScript errors reported by `npx tsc --noEmit` and lint errors from `npm run lint` are all pre-existing in `tests/` — zero new errors introduced in `app/`.

## User Setup Required

None — no external service configuration required. The page is pure Next.js server/client component routing. End-to-end smoke test (live Resend delivery to ajwegner3@gmail.com) is deferred to Andrew per CLAUDE.md "live testing" convention.

## Next Phase Readiness

- Phase 37 complete — all 3 plans shipped (migration, server action, settings page + form).
- UPGRADE-01 (banner link), UPGRADE-02 (page + submission), UPGRADE-03 (quota bypass via direct Resend send), UPGRADE-04 (24h debounce + locked-out UI) are all end-to-end observable after a deploy.
- Phase 38 (Magic-link login) and Phase 39 (Booker polish) have zero dependencies on Phase 37 output.
- No Phase 37 deferrals beyond items already in `FUTURE_DIRECTIONS.md` and `37-CONTEXT.md` (hard cap, live countdown, multi-account upgrade management).

---
*Phase: 37-upgrade-flow-and-cap-hit-ui*
*Completed: 2026-05-08*
