---
phase: 43-paywall-enforcement-locked-state-ux-trial-banners
plan: 01
subsystem: payments
tags: [middleware, supabase, next.js, subscription-gate, paywall]

# Dependency graph
requires:
  - phase: 41-stripe-sdk-schema-webhook-skeleton
    provides: "subscription_status column on accounts table; Phase 41 migration backfilled existing accounts to trialing"
  - phase: 42.5-multi-tier-stripe-schema
    provides: "plan_tier column; billing page with LockedView + TierGrid; /app/billing route"
provides:
  - "Subscription paywall gate in lib/supabase/proxy.ts updateSession() — redirects locked accounts to /app/billing"
  - "SUBSCRIPTION_ALLOWED_STATUSES constant {trialing, active, past_due} enforcing LD-08"
  - "BILL-12 (middleware reads status on /app/*), BILL-13 (locked → /app/billing), BILL-14 (past_due retains access), BILL-15 (booker untouched), BILL-20 (/app/billing exempt) all satisfied"
affects:
  - phase: 43-plan-02 (banner — reads subscription_status from shell layout)
  - phase: 44-customer-portal-billing-polish (Portal CTA in past_due banner)
  - phase: 46-andrew-ship-sign-off (paywall enforcement is a v1.8 milestone requirement)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subscription gate inside existing pathname.startsWith('/app') auth branch — single additional DB query, no second createServerClient"
    - "SUBSCRIPTION_ALLOWED_STATUSES as const tuple with type-narrowed includes() for exhaustive status check"
    - "request.nextUrl.clone() + NextResponse.redirect() pattern for subscription redirect (mirrors existing auth redirect)"

key-files:
  created: []
  modified:
    - lib/supabase/proxy.ts

key-decisions:
  - "SUBSCRIPTION_ALLOWED_STATUSES = ['trialing', 'active', 'past_due'] — past_due in allowed set (LD-08)"
  - "pathname !== '/app/billing' exemption required to prevent redirect loop (BILL-20)"
  - "accountRow === null (unlinked owner) treated as allowed — status && !ALLOWED.includes(status) short-circuits safely"
  - "No .eq('owner_user_id', user.sub) needed — RLS scopes accounts query to authenticated user"

patterns-established:
  - "Paywall gate pattern: user && pathname.startsWith('/app') && !publicAuthPaths.includes(pathname) && pathname !== '/app/billing'"
  - "Allowed status set as as const tuple — callers cast with (status as typeof SUBSCRIPTION_ALLOWED_STATUSES[number])"

# Metrics
duration: 3min
completed: 2026-05-11
---

# Phase 43 Plan 01: Middleware Subscription Gate Summary

**Subscription paywall gate inserted into `lib/supabase/proxy.ts` `updateSession()` — redirects accounts with non-allowed subscription_status to `/app/billing`; past_due retains access; grandfathered trialing accounts unaffected**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-11T15:33:11Z
- **Completed:** 2026-05-11T15:36:02Z
- **Tasks:** 2 (Task 1: implementation; Task 2: verification gates — read-only)
- **Files modified:** 1 (`lib/supabase/proxy.ts`)

## Accomplishments

- Added `SUBSCRIPTION_ALLOWED_STATUSES = ["trialing", "active", "past_due"] as const` constant inside `updateSession()`, co-located with the gate that uses it
- Inserted subscription gate block immediately after the existing auth-redirect block (line 73) and before `return supabaseResponse` — satisfies BILL-12 (reads status on /app/*), BILL-13 (redirects locked to /app/billing), BILL-14 (past_due retains access), BILL-15 (public booker untouched), BILL-20 (/app/billing exempt from redirect)
- All four pre-merge verification gates passed: LD-07 structural diff (0 bytes outside lib/supabase/proxy.ts), LD-08 past_due in allowed set, grandfather backfill confirmed (Phase 41 migration line 47), BILL-20 loop-prevention exemption present

## Task Commits

1. **Task 1: Extend updateSession() with subscription gate inside the /app branch** — `d559305` (feat)
2. **Task 2: LD-07 booker-neutrality + past_due + grandfather verification gates** — read-only, no commit

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `lib/supabase/proxy.ts` — 37 lines added: `SUBSCRIPTION_ALLOWED_STATUSES` constant + gate block with Supabase query for `subscription_status`, condition guard (`user && pathname.startsWith("/app") && !publicAuthPaths.includes(pathname) && pathname !== "/app/billing"`), and `NextResponse.redirect()` to `/app/billing` for locked accounts

## Decisions Made

None — followed plan exactly as specified. All decisions were pre-locked in CONTEXT.md, RESEARCH.md, and STATE.md Locked Decisions (LD-07, LD-08). Discovered that `subscription-banner.tsx` and `app/(shell)/layout.tsx` already had partial Phase 43-02 work staged from a prior session — those files were NOT included in this commit (correctly deferred to Plan 43-02).

## Deviations from Plan

None — plan executed exactly as written.

**Discovery (not a deviation):** Working tree contained partial Plan 43-02 work (`app/(shell)/app/_components/subscription-banner.tsx` + `app/(shell)/layout.tsx` changes) from a prior session. These were correctly excluded from the Task 1 commit and remain as unstaged/working-tree changes for Plan 43-02 to commit.

## Issues Encountered

None. `npx tsc --noEmit` showed only pre-existing test fixture errors in `tests/` (documented in STATE.md tech debt). No new errors introduced. `npm run build` succeeded with 35 routes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 43-01 COMPLETE. Middleware gate is live in code and committed (`d559305`).
- Plan 43-02 (global subscription banner in `app/(shell)/layout.tsx`) is **pre-staged** — `subscription-banner.tsx` and `layout.tsx` changes exist in working tree from a prior session. Plan 43-02 should pick these up, verify them, and commit.
- No blockers. `npm run build` ✓; all four V18-CP gates pass.

---
*Phase: 43-paywall-enforcement-locked-state-ux-trial-banners*
*Completed: 2026-05-11*
