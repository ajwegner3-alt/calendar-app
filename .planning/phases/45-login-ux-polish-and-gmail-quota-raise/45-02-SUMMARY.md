---
phase: 45-login-ux-polish-and-gmail-quota-raise
plan: "45-02"
subsystem: auth
tags: [signup, oauth, google, jsx-reorder, ui, auth-34, react]

# Dependency graph
requires:
  - phase: 34-auth-google-oauth
    provides: SignupForm with GoogleOAuthButton + GoogleErrorAlerts + initiateGoogleOAuthAction wired above the email/password Card
provides:
  - app/(auth)/app/signup/signup-form.tsx with OAuth button + OR divider relocated below the email/password Card (signup half of AUTH-34)
  - JSDoc paragraph documenting Phase 45 demotion of OAuth to secondary CTA on signup
affects: [45-01-login-form-reorder (parallel sibling, no overlap), 46-andrew-ship-signoff (visual UAT for AUTH-34 signup half)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure DOM reorder convention: when AUTH-34-style visual demotion is requested, perform JSX block move only — preserve all action handlers, classNames, copy, and props verbatim"

key-files:
  created: []
  modified:
    - "app/(auth)/app/signup/signup-form.tsx"

key-decisions:
  - "Order below Card is divider-then-OAuth (divider visually separates Card from OAuth alternative)"
  - "Lowercase 'or' divider preserved (Phase 34 precedent; no small-caps restyle — would be scope creep beyond AUTH-34)"
  - "GoogleErrorAlerts (Suspense) stays at top of outer div per RESEARCH (errors must surface above primary CTA)"

patterns-established:
  - "JSX-only reorder: action handlers, copy, classNames, and props are preserved byte-for-byte during visual restructuring"

# Metrics
duration: 5min
completed: 2026-05-11
---

# Phase 45 Plan 02: Signup OAuth Reorder Summary

**Signup OAuth button + OR divider moved below the email/password Card per AUTH-34; pure DOM reorder, zero behavior changes.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Google OAuth `<form action={initiateGoogleOAuthAction}>` block + OR divider relocated from above the `<Card>` to below it in `app/(auth)/app/signup/signup-form.tsx`
- Email/password Card is now the first interactive surface after `<GoogleErrorAlerts />` (Suspense remains at top — per RESEARCH guidance, error surfaces must precede primary CTA)
- Inline comment + JSDoc updated to document the Phase 45 (AUTH-34) demotion rationale
- Source-order verification: `</Card>...Sign up with Google` regex matches; `Sign up with Google...<Card` (negative) does NOT match

## Task Commits

1. **Task 1: Move Google OAuth + OR divider below the signup Card** - `fbae4b3` (refactor)

## Files Created/Modified
- `app/(auth)/app/signup/signup-form.tsx` - JSX block move (OAuth form + divider relocated below Card); comment + JSDoc text touchups

**NOT touched** (sibling-plan territory, explicitly avoided per plan-specific orchestrator guidance):
- `app/(auth)/app/login/login-form.tsx` (Plan 45-01 territory)
- `app/(auth)/app/login/actions.ts` (Plan 45-01 territory)
- `lib/email/quota-guard.ts` (Plan 45-03 territory)

## Decisions Made
- Followed plan as written. Below-Card order locked to: divider FIRST, then OAuth `<form>` (divider visually separates Card from OAuth alternative — matches plan spec).
- No copy edits (OAuth label "Sign up with Google" preserved; divider "or" preserved in lowercase).
- No styling changes (zero className/border/spacing modifications).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Pre-existing lint errors in `tests/` directory** (21 errors, 10 warnings — `tests/load-month-bookings.test.ts`, `tests/quota-guard.test.ts`, `tests/regenerate-reschedule-token.test.ts`, `tests/send-reminder-for-booking.test.ts`, `tests/upgrade-action.test.ts`, etc.). Documented in STATE.md as known tech debt; zero violations in `app/(auth)/app/signup/signup-form.tsx`. NOT a 45-02 regression.
- **Pre-existing TypeScript errors in `tests/` directory** (cancel-reschedule-api.test.ts, owner-note-action.test.ts, reminder-cron.test.ts, upgrade-action.test.ts). Documented in STATE.md as known tech debt; zero non-test errors. NOT a 45-02 regression.
- **`npm run typecheck` script does not exist** — project uses `npx tsc --noEmit` per existing convention (visible in repeated STATE.md references). Used `npx tsc --noEmit` directly.
- **Concurrent sibling-plan working-tree drift** — at commit time `app/(auth)/app/login/{actions.ts,login-form.tsx}` and `tests/login-form-auth-29.test.tsx` were modified/untracked from parallel Plan 45-01 work. Staged ONLY `app/(auth)/app/signup/signup-form.tsx` per plan-specific orchestrator guidance. `git diff --name-only HEAD~1 HEAD` confirms commit `fbae4b3` touches only the signup-form file.

## Build / Lint / Typecheck Status

- **`npx tsc --noEmit`** — PASS (zero non-test errors; pre-existing `tests/` tech debt unchanged)
- **`npm run lint`** — PASS for this file (zero violations in `signup-form.tsx`); pre-existing `tests/` errors unchanged
- **`npm run build`** — PASS; `/app/signup` route compiled successfully (static rendering preserved); 35 routes total

## Source-Order Verification

- `grep -Pzo '(?s)</Card>.*?Sign up with Google' app/(auth)/app/signup/signup-form.tsx` — MATCH (Card closes before OAuth label; correct)
- `grep -Pzo '(?s)Sign up with Google.*?<Card' app/(auth)/app/signup/signup-form.tsx` — NO MATCH (OAuth does not appear before Card; correct)
- `grep -c "Sign up with Google" app/(auth)/app/signup/signup-form.tsx` — 1 (single occurrence preserved)
- `grep -c "initiateGoogleOAuthAction" app/(auth)/app/signup/signup-form.tsx` — 2 (import + form action; preserved)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Signup half of AUTH-34 ready for visual confirmation in Phase 46 manual QA
- Plan 45-01 (login parity) can land independently; zero file overlap with 45-02
- Plan 45-03 (Gmail quota raise) can land independently; zero file overlap with 45-02

---
*Phase: 45-login-ux-polish-and-gmail-quota-raise*
*Completed: 2026-05-11*
