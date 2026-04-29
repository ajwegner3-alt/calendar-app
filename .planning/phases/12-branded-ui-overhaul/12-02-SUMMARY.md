---
phase: 12-branded-ui-overhaul
plan: "02"
subsystem: auth
tags: [next.js, tailwind, auth, branding, split-panel, cruip, NSI]

# Dependency graph
requires:
  - phase: 12-01
    provides: NSIGradientBackdrop component (components/nsi-gradient-backdrop.tsx) with fixed #0A2540 + subtle tokens

provides:
  - AuthHero reusable server component (NSI marketing hero panel for all auth pages)
  - 6 auth pages restyled to Cruip split-panel layout (lg:grid-cols-2)
  - UI-12 requirement satisfied for auth surface

affects:
  - Phase 13 QA (auth pages must be visually inspected in browser; all 3 test accounts should see identical NSI-token auth styling)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth page split-panel: grid min-h-screen lg:grid-cols-2 — form column (white bg) left, AuthHero (hidden mobile, lg:flex) right"
    - "JSX-shell restyle: preserve all Server Actions, getClaims redirects, searchParams entirely; only the outer wrapper changes"
    - "AuthHero page-specific copy: headline/subtext props override defaults per page"

key-files:
  created:
    - app/(auth)/_components/auth-hero.tsx
  modified:
    - app/(auth)/app/login/page.tsx
    - app/(auth)/app/signup/page.tsx
    - app/(auth)/app/forgot-password/page.tsx
    - app/(auth)/app/verify-email/page.tsx
    - app/auth/reset-password/page.tsx
    - app/auth/auth-error/page.tsx

key-decisions:
  - "AuthHero is a server component — no client-side state needed for static marketing copy"
  - "Default hero copy: 'Bookings without the back-and-forth.' + NSI pitch; each page overrides headline/subtext"
  - "Import path for reset-password + auth-error: @/app/(auth)/_components/auth-hero — parens are valid on filesystem (Next.js route groups don't affect import paths)"
  - "NSIGradientBackdrop used inside AuthHero sidebar (not page root) — AuthHero is already relative+overflow-hidden via aside element"
  - "Hero on auth-error page uses fixed copy ('That link did not work') regardless of reason/email searchParams — hero is marketing, not error state"

patterns-established:
  - "Split-panel auth layout: divide min-h-screen into 2 columns on lg+; left=white form, right=brand hero"
  - "Mobile-first: hero hidden on mobile (hidden lg:flex); form is full-width stacked"
  - "Page-specific hero copy locked: login=Welcome back, signup=Start scheduling, forgot-password=We've got your back, verify-email=One quick step, reset-password=Set a new password, auth-error=That link didn't work"

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 12 Plan 02: auth-pages-restyle Summary

**Cruip split-panel layout on all 6 auth pages using AuthHero + NSIGradientBackdrop — NSI marketing surface for visiting trade contractors; all auth logic (getClaims, searchParams, Server Actions) preserved verbatim**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-29T12:37:53Z
- **Completed:** 2026-04-29T12:43:40Z
- **Tasks:** 3
- **Files created/modified:** 7

## Accomplishments

- Created `AuthHero` reusable server component: NSI marketing panel with gradient backdrop, "Powered by NSI" pill, headline/subtext props, 3 value-prop bullets, hidden on mobile
- Restyled 4 `(auth)/app/` pages (login, signup, forgot-password, verify-email) to Cruip split-panel layout — form column left + NSIGradientBackdrop hero right
- Restyled 2 `app/auth/` pages (reset-password, auth-error) with same pattern — including expired-link fallback branch in reset-password also adopting the split-panel

## Task Commits

Each task was committed atomically:

1. **Task 1: AuthHero component + NSI hero copy** - `8abc9ec` (feat)
2. **Task 2: Restyle login, signup, forgot-password, verify-email** - `8df9fc9` (feat)
3. **Task 3: Restyle /auth/reset-password + /auth/auth-error** - `ccf5e88` (feat)

## Files Created/Modified

- `app/(auth)/_components/auth-hero.tsx` — NEW: reusable NSI marketing hero panel (server component)
- `app/(auth)/app/login/page.tsx` — split-panel restyle; getClaims redirect + reset searchParam preserved
- `app/(auth)/app/signup/page.tsx` — split-panel restyle; SignupForm client component binding preserved
- `app/(auth)/app/forgot-password/page.tsx` — split-panel restyle; ForgotPasswordForm + "Back to login" link preserved
- `app/(auth)/app/verify-email/page.tsx` — split-panel restyle; resendVerification action + email searchParam display preserved
- `app/auth/reset-password/page.tsx` — split-panel restyle; getClaims session guard + expired-link fallback branch both adopt layout
- `app/auth/auth-error/page.tsx` — split-panel restyle; reason/email searchParams + dynamic headline/body + ResendVerificationButton preserved

## Decisions Made

- **AuthHero as server component** — no client-side state needed for static marketing copy; simpler than client component
- **"Powered by NSI" pill** — signals product origin; appears in hero regardless of page context
- **Import path `@/app/(auth)/_components/auth-hero`** — works from both `app/(auth)/app/` and `app/auth/` because Next.js route group parens don't affect the filesystem import path
- **Per-page headline overrides** — marketing copy differentiated per auth context; defaults remain generic fallback
- **hero on auth-error uses fixed static copy** — hero is a marketing/brand panel; dynamic error info stays in the form column only

## Deviations from Plan

None — plan executed exactly as written.

Note: During task 3 verification, TSC initially showed a type error in `app/[account]/[event-slug]/_lib/load-event-type.ts` (AccountSummary missing `background_color`/`background_shade` in return object). Investigation revealed the file had already been corrected (git diff showed the fix was present in the working tree from prior 12-01 work). TSC was clean without any additional changes needed from this plan.

## Issues Encountered

- **Transient test failures in bookings-api.test.ts + bookings-rate-limit.test.ts**: These integration tests hit the live Supabase rate limiter. Running full suite back-to-back triggers 429s. Individual runs pass. Pre-existing condition — not a regression from this plan. Baseline of 173+ tests (175 passed in final run) preserved with 26 skipped.

## User Setup Required

None — no external service configuration required. Auth pages are JSX-shell restyles only.

## Next Phase Readiness

- UI-12 requirement satisfied for the auth surface (all 6 pages)
- AuthHero is reusable — any future auth page can `import { AuthHero }` and adopt the same pattern
- Phase 13 QA checklist: visit each auth page in browser at lg+ viewport, confirm split-panel renders; also test at 375px (mobile) to confirm hero is hidden and form stacks correctly
- Phase 13 multi-account smoke: all 3 test accounts should see identical auth-page styling (auth pages always render NSI tokens — no account context on pre-login surfaces)

---
*Phase: 12-branded-ui-overhaul*
*Completed: 2026-04-29*
