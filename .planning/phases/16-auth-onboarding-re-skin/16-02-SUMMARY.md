---
phase: 16-auth-onboarding-re-skin
plan: 02
subsystem: ui
tags: [auth, nextjs, tailwind, react, supabase, background-glow, header-pill]

# Dependency graph
requires:
  - phase: 16-auth-onboarding-re-skin
    provides: Header variant + rightLabel API (16-01)
  - phase: 15-backgroundglow-header-pill-owner-shell-re-skin
    provides: BackgroundGlow component + Header pill component (auth variant offset)
provides:
  - AuthHero re-skinned with NSI blue BackgroundGlow (replaces NSIGradientBackdrop dark navy gradient)
  - /app/login renders fixed Header pill (variant="auth") spanning full viewport
  - /app/signup renders fixed Header pill (variant="auth") spanning full viewport
  - Mobile glow visibility on <lg via lg:hidden BackgroundGlow at page-level wrapper
  - All Server Component logic preserved byte-for-byte (createClient, getClaims, redirect, searchParams, LoginForm/SignupForm props)
affects: [16-03 short-auth-pages-reskin, 16-04 onboarding-reskin, 17 forgot-password-flow, 20 nsigradientbackdrop-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-level BackgroundGlow wrapper with lg:hidden for mobile-only glow"
    - "pt-20 md:pt-24 clearance below fixed Header pill on auth form column"
    - "form-column main bg-white/0 on mobile (glow leaks through), lg:bg-white on desktop"

key-files:
  created: []
  modified:
    - "app/(auth)/_components/auth-hero.tsx"
    - "app/(auth)/app/login/page.tsx"
    - "app/(auth)/app/signup/page.tsx"

key-decisions:
  - "Mobile glow approach: page-level wrapper with lg:hidden BackgroundGlow rather than restructuring AuthHero (minimal-delta — AuthHero internals untouched except backdrop swap)"
  - "Form column main uses bg-white/0 lg:bg-white so the page-level glow leaks through on mobile but desktop keeps a clean white form column"
  - "Used pt-20 md:pt-24 clearance (matches Phase 15 owner-shell convention)"
  - "Deferred NSIGradientBackdrop component file deletion to Phase 20 (cleanup) — only the import + usage swap was in scope here"
  - "rightLabel prop omitted on Header — wordmark-only is the locked CONTEXT.md default for auth pages"

patterns-established:
  - "Auth page shell pattern: <div className='relative min-h-screen overflow-hidden bg-gray-50'> wrapping <Header variant='auth' /> + <BackgroundGlow className='lg:hidden' /> + split-panel grid"
  - "Functional preservation in Server Component re-skins: byte-for-byte preservation of auth checks, redirects, searchParams parsing, and client-island prop passing"

# Metrics
duration: ~30min
completed: 2026-04-30
---

# Phase 16 Plan 02: AuthHero Re-skin + Login/Signup Header Pill Summary

**Split-panel auth pages now render NSI blue BackgroundGlow (replacing dark navy NSIGradientBackdrop) with fixed Header pill spanning both columns and mobile-visible glow via lg:hidden page wrapper.**

## Performance

- **Duration:** ~30 min (2 implementation tasks + visual gate)
- **Completed:** 2026-04-30
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 3

## Accomplishments
- AuthHero swapped from NSIGradientBackdrop to BackgroundGlow (NSI blue #3B82F6) — marketing copy preserved verbatim
- /app/login and /app/signup render fixed glass Header pill spanning full viewport (auth variant strips sidebar offset)
- Mobile (<lg) shows form-only column with blue glow visible behind the form (lg:hidden BackgroundGlow at page-level wrapper)
- Login + signup Server Component logic preserved byte-for-byte: createClient, getClaims redirect, searchParams reset parsing, LoginForm/SignupForm prop passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-skin AuthHero — swap backdrop to BackgroundGlow** — `887a7f6` (refactor)
2. **Task 2: Add Header pill to login + signup with mobile glow** — `68aa833` (feat)
3. **Task 3: Visual gate on live Vercel preview** — approved by Andrew on https://calendar-app-xi-smoky.vercel.app/login + /signup (no commit — verification only)

**Plan metadata:** _this commit_ (docs: complete authhero-reskin-login-signup plan)

## Files Created/Modified
- `app/(auth)/_components/auth-hero.tsx` — Removed NSIGradientBackdrop import + usage, added BackgroundGlow import + `<BackgroundGlow />` JSX. All marketing copy (Powered by NSI badge, headline, subtext, 3 bullets), aside layout (hidden lg:flex, relative, bg-gray-50), and Server Component status preserved verbatim.
- `app/(auth)/app/login/page.tsx` — Wrapped in `<div className="relative min-h-screen overflow-hidden bg-gray-50">`, added `<Header variant="auth" />` and `<BackgroundGlow />` (lg:hidden) at top, added pt-20 md:pt-24 clearance and bg-white/0 lg:bg-white on form column main. createClient + getClaims + redirect + searchParams reset parsing + `<LoginForm resetSuccess={reset === 'success'} />` preserved byte-for-byte.
- `app/(auth)/app/signup/page.tsx` — Same shell wrap pattern as login. `<SignupForm />` and `<AuthHero />` invocations preserved byte-for-byte.

## Decisions Made
- **Mobile glow strategy:** Implemented the recommended minimal-delta approach from the plan — page-level `<div className="relative min-h-screen overflow-hidden bg-gray-50">` wrapper with a second `<BackgroundGlow />` at `lg:hidden`. On desktop, this mobile glow disappears and AuthHero's own internal BackgroundGlow takes over inside the right column. AuthHero internals untouched beyond the backdrop swap.
- **Form-column transparency on mobile:** Form column main set to `bg-white/0` on mobile and `lg:bg-white` on desktop so the page-level glow leaks through behind the form on mobile.
- **NSIGradientBackdrop file:** Deferred component file deletion to Phase 20 cleanup — only the import + JSX usage in AuthHero was swapped here. Other consumers (if any) will be audited later.

## Deviations from Plan

None — plan executed exactly as written. The mobile glow approach matched the plan's recommended minimal-delta path. No deviation rules triggered.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Visual Gate Sign-off

**Approved:** 2026-04-30 by Andrew on the live Vercel preview at https://calendar-app-xi-smoky.vercel.app/login and /signup.

Verified on the live preview:
- Desktop (≥lg): split-panel layout with form on left, AuthHero on right showing NSI blue blob glow (not dark navy gradient)
- Glass NorthStar pill fixed at top, spanning full viewport width (no left-side sidebar gap)
- Marketing copy unchanged: "Powered by NSI" badge, headline, subtext, 3 bullets present
- Mobile (<lg): AuthHero aside hidden, form column visible with blue glow behind it, pill stays at top
- Functional smoke test: login submit redirects to /app, signup proceeds with existing post-signup behavior

## Requirements Satisfied

- **AUTH-12** — AuthHero renders `<BackgroundGlow />`; zero references to `NSIGradientBackdrop` remain in auth-hero.tsx
- **AUTH-13** (partial — login + signup slice) — Both pages render `<Header variant="auth" />` pill at top spanning both columns. Remaining AUTH-13 surfaces (short-auth pages, onboarding) covered by 16-03 + 16-04.
- **AUTH-15** — All functional Server Component logic preserved byte-for-byte: createClient, getClaims, redirect("/app"), searchParams reset parsing, `<LoginForm resetSuccess={...} />` prop, `<SignupForm />` render, `<AuthHero />` invocations and headline/subtext props.
- **Roadmap success criterion #1** — Split-panel layout with blue-blot glow on right column replacing NSIGradientBackdrop.
- **Roadmap success criterion #2** (partial — login + signup slice) — Pill at top of login/signup spanning both columns.

## Next Phase Readiness

- AuthHero re-skin pattern established for sibling Wave 2 plans (16-03 short auth pages, 16-04 onboarding) which run in parallel and touch disjoint files
- Page-level wrapper + lg:hidden glow pattern available as template for any future split-panel auth surfaces (e.g., Phase 17 forgot-password)
- NSIGradientBackdrop component file remains in repo with one fewer consumer; full deletion deferred to Phase 20 cleanup

---
*Phase: 16-auth-onboarding-re-skin*
*Completed: 2026-04-30*
