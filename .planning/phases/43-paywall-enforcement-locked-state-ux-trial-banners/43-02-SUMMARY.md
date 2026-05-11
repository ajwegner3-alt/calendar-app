---
phase: 43-paywall-enforcement-locked-state-ux-trial-banners
plan: 02
subsystem: ui
tags: [next.js, server-component, tailwind, subscription, stripe, banner, trial, past-due]

# Dependency graph
requires:
  - phase: 43-paywall-enforcement-locked-state-ux-trial-banners
    provides: Phase 43 context, BILL-16/17/18 requirements, locked copy strings
  - phase: 42.5-multi-tier-stripe-schema
    provides: accounts.subscription_status + accounts.trial_ends_at columns; deriveTrialDaysLeft pattern from billing page
  - phase: 41-stripe-sdk-schema-webhook-skeleton
    provides: Phase 41 migration backfill (all accounts set to trialing + trial_ends_at)
provides:
  - SubscriptionBanner server component with neutral/urgent/past-due variants (BILL-16/17/18)
  - Shell layout expanded query: subscription_status + trial_ends_at
  - Banner rendered globally on all /app/* pages via (shell) layout
affects:
  - 43-03 (Plan 43-01 middleware — parallel; this plan is byte-disjoint)
  - 44-customer-portal-billing-polish (Phase 44 adds Portal CTA to past-due banner)
  - 46-andrew-ship-sign-off (manual QA surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subscription state flows from server layout to server banner via props — no client fetch, no client bundle exposure"
    - "Server component banner with urgency threshold branching (daysLeft <= 3)"
    - "deriveTrialDaysLeft() shared utility pattern (billing page → banner, verbatim copy)"

key-files:
  created:
    - app/(shell)/app/_components/subscription-banner.tsx
  modified:
    - app/(shell)/layout.tsx

key-decisions:
  - "Banner is NOT dismissible per CONTEXT decision — no X button, no localStorage"
  - "daysLeft <= 3 urgency threshold locked as BILL-17 invariant"
  - "Trialing + null trial_ends_at -> neutral generic fallback copy (grandfathered accounts)"
  - "active accounts + locked statuses -> null (belt-and-suspenders; middleware already redirected locked accounts)"
  - "as string | null defensive casts in layout props — safe if Supabase codegen is stale"
  - "Banner placement: inside SidebarInset, between Header and main; non-fixed so it pushes content down naturally"

patterns-established:
  - "SubscriptionBanner: pure server JSX with no state or event handlers; props-only data flow"
  - "Urgency copy branching: daysLeft === 0 / === 1 / <= 3 / > 3 as discrete cases"

# Metrics
duration: 3min
completed: 2026-05-11
---

# Phase 43 Plan 02: Subscription Banner Summary

**Server-component SubscriptionBanner with three variants (neutral trial / urgent trial / past-due) rendered globally in (shell) layout between Header and main via prop-drilled subscription_status + trial_ends_at**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-11T15:33:30Z
- **Completed:** 2026-05-11T15:37:14Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Created `app/(shell)/app/_components/subscription-banner.tsx` — pure server component, no `"use client"`, ~133 lines with all six BILL-16/17/18 locked copy strings verbatim
- Expanded `app/(shell)/layout.tsx` accounts query from `select("id")` to `select("id, subscription_status, trial_ends_at")` and threaded both values as props to the banner
- Banner rendered between `<Header />` and `<main>` inside `<SidebarInset>` — non-fixed position so it naturally pushes content down without z-index conflicts
- All five banner variants implemented: neutral blue trial (daysLeft > 3), urgent amber trial (daysLeft ≤ 3 with today/tomorrow/N-day copy), null trial_ends_at grandfathered fallback, past-due amber non-blocking, active/null/locked → null
- LD-07 booker-neutrality preserved: `/[account]/*`, `/embed/*`, `proxy.ts`, `lib/supabase/proxy.ts` byte-untouched (verified via `git diff --stat`)
- `npm run build` ✓; `npx tsc --noEmit` zero new app-source errors (pre-existing tests/ fixture noise only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SubscriptionBanner server component** — `fd59b7d` (feat)
2. **Task 2: Expand shell layout query and render SubscriptionBanner** — `3ca0868` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `app/(shell)/app/_components/subscription-banner.tsx` — New server component; exports `SubscriptionBanner`; five rendering branches; all six BILL-16/17/18 locked copy strings; blue-50/200/900 neutral + amber-50/300/900 urgency/past-due palette matching `UnsentConfirmationsBanner` precedent
- `app/(shell)/layout.tsx` — Expanded accounts select clause; added Phase 43 comment block; captured `account = accounts[0]`; imported and rendered `SubscriptionBanner` between `<Header />` and `<main>`

## Decisions Made

- **Banner placement inside SidebarInset (non-fixed):** Verified from RESEARCH.md that `<main>` already has `pt-20 md:pt-24` for the fixed glass-pill header. A non-fixed banner between `<Header />` and `<main>` sits naturally in document flow and pushes content down — no z-index changes needed and no layout regressions.
- **Defensive `as string | null` casts in layout props:** Supabase codegen types may or may not include `subscription_status` and `trial_ends_at` depending on whether codegen has been refreshed. The cast is a no-op when types are fresh and prevents `any` coercion when they are stale.
- **`role="status"` on banner div:** Standard ARIA role for non-critical live region content; appropriate for trial countdown and past-due notices that do not require immediate action acknowledgment.
- **Urgency link: `font-semibold` vs neutral `font-medium`:** Subtle visual intensification on the urgency CTA link matches the amber-to-blue color swap — together they create a coherent urgent vs. neutral tone without introducing new design tokens.

## Deviations from Plan

None — plan executed exactly as written. All JSX scaffolds, copy strings, Tailwind classes, and prop signatures match the PLAN.md specification verbatim.

## Issues Encountered

None. TypeScript check showed only pre-existing `tests/` fixture errors (documented in STATE.md as known open tech debt — `tests/bookings-api.test.ts`, `tests/cancel-reschedule-api.test.ts`, etc.). No new app-source errors introduced.

## User Setup Required

None — no external service configuration required. All styling uses existing Tailwind classes already in the project.

## Next Phase Readiness

- **Plan 43-01** (middleware subscription gate) runs in parallel and is byte-disjoint: it owns `lib/supabase/proxy.ts`; this plan owns `app/(shell)/layout.tsx` + `app/(shell)/app/_components/subscription-banner.tsx`. Zero file overlap confirmed.
- The banner will render correctly for all subscription states as soon as Plan 43-01's middleware gate is deployed — locked accounts will be redirected before reaching the shell, active accounts will see null, trialing/past-due accounts will see the appropriate banner.
- BILL-16, BILL-17, BILL-18 are structurally closed by this plan. Manual QA verification (Phase 46) will confirm visual rendering in live environment.
- BILL-19 (locked-state copy on /app/billing) was already shipped in Phase 42.5's `LockedView` component — no work needed here.
- Phase 44 (Customer Portal + Billing Polish) owns adding a Stripe Customer Portal "Manage payment" CTA to the past-due banner — the current `/app/billing` link is the correct placeholder per CONTEXT deferred decisions.

---
*Phase: 43-paywall-enforcement-locked-state-ux-trial-banners*
*Completed: 2026-05-11*
