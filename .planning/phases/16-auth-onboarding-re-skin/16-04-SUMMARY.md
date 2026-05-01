---
phase: 16-auth-onboarding-re-skin
plan: 04
subsystem: ui
tags: [onboarding, tailwind, nextjs, server-components, reskin, supabase-auth]

# Dependency graph
requires:
  - phase: 16-auth-onboarding-re-skin
    provides: "Header variant='auth' + rightLabel prop (16-01)"
provides:
  - "Re-skinned /onboarding layout: bg-gray-50, BackgroundGlow, Header pill with 'Setup' right-slot label, blue-500 progress bar"
  - "Card-shell wrappers (bg-white rounded-xl border border-gray-200 p-6 shadow-sm) on all 3 onboarding step pages"
  - "Layout-level h1 dropped — pill 'Setup' label + 'Step X of 3' subtext + progress bar + per-step h2 carry the wizard context"
affects: [post-onboarding-app-shell, future-wizard-flows-needing-pill-progress-pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Onboarding wizard chrome lives in layout.tsx; step pages contribute only the card body"
    - "max-w-xl width constraint applied at layout main wrapper, NOT duplicated on step cards"
    - "Progress bar color swap (blue-600 -> blue-500) aligned with Phase 15 :root --primary (#3b82f6)"

key-files:
  created: []
  modified:
    - "app/onboarding/layout.tsx"
    - "app/onboarding/step-1-account/page.tsx"
    - "app/onboarding/step-2-timezone/page.tsx"
    - "app/onboarding/step-3-event-type/page.tsx"

key-decisions:
  - "Dropped layout-level h1 ('Set up your booking page') per CONTEXT.md discretion default — pill + 'Setup' label + progress + per-step h2 are sufficient context"
  - "Width control (max-w-xl mx-auto) stays on layout main; step cards do NOT add their own width clamp (avoids double-constraint)"
  - "BackgroundGlow + Header rendered ONLY in layout.tsx, never duplicated in step pages"

patterns-established:
  - "Wizard layout pattern: layout owns chrome (bg, glow, pill, progress); step pages own card body only"
  - "Onboarding card class: bg-white rounded-xl border border-gray-200 p-6 shadow-sm (no width clamp at card level)"

# Metrics
duration: ~12min (execution) + visual+E2E gate sign-off
completed: 2026-04-30
---

# Phase 16 Plan 04: Onboarding Wizard Re-skin Summary

**Re-skinned /onboarding layout (bg-gray-50 + BackgroundGlow + Header pill + 'Setup' label + blue-500 progress) and wrapped all 3 step pages in the canonical card shell — auth gate, accounts query, and Server Action bindings preserved verbatim.**

## Performance

- **Duration:** ~12 min execution + Vercel preview deploy + visual & end-to-end gate
- **Completed:** 2026-04-30
- **Tasks:** 3 (2 auto + 1 visual+E2E gate)
- **Files modified:** 4

## Accomplishments

- Onboarding layout shell now matches Phase 15 NSI visual language: gray-50 page bg, blue-blot ambient glow, full-width glass pill ("NorthStar" wordmark left, "Setup" right), wizard content cleared of pill via pt-20 md:pt-24
- Progress bar active segment swapped from `bg-blue-600` to `bg-blue-500` — aligns with the `--primary` token established in Phase 15 (#3b82f6)
- All 3 step pages (account, timezone, event-type) now wrap their existing forms in a single canonical card class — visual consistency across the wizard
- Zero functional regressions — auth gate (getClaims, /app/login redirect), accounts query (onboarding_complete, onboarding_step), and form Server Actions all preserved byte-for-byte
- Live preview end-to-end flow validated: signup -> step 1 -> step 2 -> step 3 -> /app, plus authenticated-completed redirect to /app and unauthenticated redirect to /app/login

## Task Commits

1. **Task 1: Re-skin onboarding layout (background, glow, pill, progress color)** — `ba802d5` (refactor)
2. **Task 2: Re-skin the 3 step pages (card wrappers)** — `6e635d5` (refactor)
3. **Task 3: Visual + E2E functional gate (live Vercel preview)** — approved by Andrew on 2026-04-30 (no commit; verification-only checkpoint)

**Plan metadata:** committed separately as `docs(16-04): complete onboarding-reskin plan`

## Files Created/Modified

- `app/onboarding/layout.tsx` — outer wrapper swapped to `relative min-h-screen overflow-hidden bg-gray-50`; added `<BackgroundGlow />` + `<Header variant="auth" rightLabel="Setup" />`; wrapped content in `<main className="relative z-10 mx-auto w-full max-w-xl px-4 pt-20 md:pt-24 pb-12">`; progress bar active segment `bg-blue-600` -> `bg-blue-500`; layout-level h1 removed; auth gate, accounts query, onboarding_complete redirect, and onboarding_step value all preserved verbatim
- `app/onboarding/step-1-account/page.tsx` — outer div now `bg-white rounded-xl border border-gray-200 p-6 shadow-sm`; `<h2>`, subtext `<p>`, and `<AccountForm />` invocation unchanged
- `app/onboarding/step-2-timezone/page.tsx` — same card class applied; `<h2>`, subtext, and `<TimezoneForm />` invocation unchanged
- `app/onboarding/step-3-event-type/page.tsx` — same card class applied; `<h2>`, subtext, and `<EventTypeForm />` invocation unchanged

## Decisions Made

- **Layout-level h1 dropped (per CONTEXT.md discretion default).** The plan called this out as the discretion default: with the glass pill carrying the "NorthStar" + "Setup" label, the "Step X of 3" subtext, the 3-segment progress bar, and the per-step `<h2>` heading inside each card, an additional layout-level h1 ("Set up your booking page") would be redundant. Andrew is now informed; if he wants the h1 back, it's a one-line restore.
- **Step cards do NOT add their own `max-w-xl mx-auto`.** Width clamp lives once, on the layout's `<main>` wrapper. Adding it to step cards would double-constrain when wider screens render.
- **No changes to form-component client islands.** `account-form.tsx`, `timezone-form.tsx`, `event-type-form.tsx` (handling `useActionState`, RHF+Zod, slug availability checks, timezone detection) were untouched — those are functional islands and out of scope for the visual re-skin.

## Deviations from Plan

None — plan executed exactly as written. The 11 must-have truths and 4 artifact provides all verified statically (Grep) and live (Vercel preview).

## Requirements Satisfied

- **ONBOARD-10** — layout bg = `bg-gray-50` (verified)
- **ONBOARD-11** — layout renders `<BackgroundGlow />` + `<Header variant="auth" rightLabel="Setup" />` (verified)
- **ONBOARD-12** — content padding = `pt-20 md:pt-24 pb-12` clears fixed pill (verified)
- **ONBOARD-13** — progress active segment = `bg-blue-500` (zero `bg-blue-600` references in layout) (verified)
- **ONBOARD-14** — all 3 step cards use `bg-white rounded-xl border border-gray-200 p-6 shadow-sm` (verified)
- **ONBOARD-15** — zero functional regressions: auth gate, accounts query, onboarding_complete redirect, onboarding_step value, and all 3 form Server Actions confirmed working end-to-end on live preview

**Roadmap success criterion #3** ("/onboarding (step 1) shows bg-gray-50 background + blue-blot glow + 'NorthStar' pill + 'Setup' context label, with progress bar active segment using bg-blue-500") — fully met.

## Issues Encountered

None.

## Visual + E2E Gate Sign-off

- **Date:** 2026-04-30
- **Approved by:** Andrew (live Vercel preview)
- **Verified flow:** Full /onboarding wizard tested end-to-end on the live preview URL — all 3 steps rendered correctly with white card shell, blue-500 progress bar confirmed (lighter than blue-600), pill wordmark + "Setup" right label visible, redirects working (unauthenticated -> /app/login, completed -> /app, step 3 submit -> /app)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Onboarding wizard re-skin is shipped and verified live. Wave 2 of Phase 16 (plans 02, 03, 04) is complete pending the orchestrator's batched STATE.md updates.
- No blockers. Future wizard flows (e.g., paid-plan onboarding, organization setup) can reuse the same chrome-in-layout / card-body-in-page pattern.

---
*Phase: 16-auth-onboarding-re-skin*
*Completed: 2026-04-30*
