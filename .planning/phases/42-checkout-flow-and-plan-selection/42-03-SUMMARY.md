---
phase: 42-checkout-flow-and-plan-selection
plan: "03"
subsystem: payments
tags: [stripe, nextjs, billing-ui, server-component, polling, checkout]

requires:
  - phase: 42-checkout-flow-and-plan-selection
    plan: "01"
    provides: "lib/stripe/prices.ts PRICES config, POST /api/stripe/checkout, GET /api/stripe/checkout/status"

provides:
  - "app/(shell)/app/billing/page.tsx: Server Component — auth gate, account fetch, 4-state derivation, conditional render"
  - "app/(shell)/app/billing/_components/billing-state-views.tsx: TrialingHeader (countdown + NULL fallback), ActiveView, LockedView (CONTEXT tonal anchor)"
  - "app/(shell)/app/billing/_components/plan-selection-card.tsx: Client component — monthly/annual toggle, Subscribe → POST + window.location.href redirect"
  - "app/(shell)/app/billing/_components/checkout-return-poller.tsx: Client component — 2s polling, 30s timeout, success auto-redirect to /app"

affects:
  - 42-04 (manual QA verifies all four states: trialing + active + locked + cancel-return + polling timeout)
  - 43 (paywall middleware redirect to /app/billing — locked-state copy already in place, Phase 43 just wires routing)
  - 44 (Customer Portal "Manage subscription" CTA will be added to ActiveView)

tech-stack:
  added: []
  patterns:
    - "Module-level pure helper for Date arithmetic (deriveTrialDaysLeft) — moves Date.now() out of component body to satisfy react-hooks/purity lint rule"
    - "startedAt.current initialized in useEffect (not useRef(Date.now())) — same purity rule workaround in client component"
    - "4-branch BillingPageState discriminated union (polling/active/plan_selection/locked) — clean conditional render via if-chain"
    - "Server-side prop drilling: PRICES read in page.tsx, labels passed as strings to PlanSelectionCard — client component never imports server-only lib"

key-files:
  created:
    - app/(shell)/app/billing/page.tsx
    - app/(shell)/app/billing/_components/billing-state-views.tsx
    - app/(shell)/app/billing/_components/plan-selection-card.tsx
    - app/(shell)/app/billing/_components/checkout-return-poller.tsx
  modified: []

key-decisions:
  - "deriveTrialDaysLeft extracted as module-level helper to satisfy react-hooks/purity ESLint rule (Date.now() cannot be called inside inner functions in component scope)"
  - "startedAt ref initialized to 0, set to Date.now() inside useEffect — avoids react-hooks/purity error on useRef(Date.now())"
  - "Stub client components created first, replaced in-place — page.tsx compiles from Task 1 onward"
  - "Non-null assertion removed from page.tsx in favor of flat if-else branch after accountData check (TypeScript-idiomatic)"

metrics:
  duration: 7min 46sec
  completed: 2026-05-10
---

# Phase 42 Plan 03: Billing Page UI Summary

**Server Component state derivation + three sub-components (plan-selection card, checkout-return poller, billing state views) — full owner-facing /app/billing page for Stripe Hosted Checkout flow**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-10T23:42:24Z
- **Completed:** 2026-05-10T23:50:10Z
- **Tasks:** 3
- **Files created:** 4

## Accomplishments

- `app/(shell)/app/billing/page.tsx` — Server Component with auth gate (`getClaims` + redirect), account fetch (RLS-scoped, `maybeSingle`), `BillingPageState` discriminated-union derivation, and conditional render of four states. Trial days computed via pure `deriveTrialDaysLeft` helper. `searchParams` awaited (Next 16 invariant).
- `billing-state-views.tsx` — Three server-rendered blocks: `TrialingHeader` (numeric countdown or "Your trial is active" fallback when `trial_ends_at IS NULL`), `ActiveView` (placeholder for Phase 44 Portal link), `LockedView` with exact CONTEXT tonal anchor copy ("Everything is waiting for you! Head over to payments to get set up.").
- `plan-selection-card.tsx` — Client component with `annual` pre-selected, dynamic `Save {savingsPct}%` badge, prominent `annualMonthlyEquivalentLabel` label, Subscribe handler: `fetch /api/stripe/checkout` + `window.location.href` redirect. No `@stripe/stripe-js` (LD-02), no `router.push` for cross-domain redirect.
- `checkout-return-poller.tsx` — Client component polling `/api/stripe/checkout/status` every 2s with `cache: 'no-store'`, 30s hard timeout, three visual states (polling/active/timeout). Success auto-redirects to `/app` after 2s. Timeout shows reassuring "Almost there…" with Refresh CTA (not "failed" framing). LD-10 preserved — `pollState` only transitions to `active` from poll response, never optimistically.

## State-Derivation Branches

| State | Trigger condition | Sub-components rendered |
|-------|-------------------|-------------------------|
| `polling` | `?session_id=cs_*` in URL | `CheckoutReturnPoller` only |
| `active` | `subscription_status === "active"` | `ActiveView` only |
| `plan_selection` | `trialing` or `past_due` | `TrialingHeader` (trialing only) + `PlanSelectionCard` |
| `locked` | `canceled` / `unpaid` / `incomplete` / `incomplete_expired` | `LockedView` + `PlanSelectionCard` (re-subscribe path) |

**Note on `past_due`:** LD-08 — `past_due` is NOT a lockout state. It falls into `plan_selection` (no trial header) so the owner can update their subscription. Phase 43 will add the `past_due` banner.

## Auto-Redirect Target

- **Route:** `/app` (the dashboard — not `/app/dashboard`)
- **Delay:** 2s after observing `active` from the poller
- **CONTEXT lock:** Honored — user reads "You're all set!" before redirect

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Billing Server Component and state views | `2fa6b85` | billing/page.tsx, billing-state-views.tsx |
| 2 | Plan selection card with monthly/annual toggle | `ad49e57` | plan-selection-card.tsx |
| 3 | Checkout return poller with 30s timeout and auto-redirect | `cbfa652` | checkout-return-poller.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint react-hooks/purity on Date.now() — two locations**

- **Found during:** Task 1 verify (page.tsx inner function), Task 3 verify (checkout-return-poller.tsx useRef initial value)
- **Issue:** The `react-hooks/purity` ESLint rule flags `Date.now()` as an "impure function" when called inside component-scoped functions or as a `useRef` initial argument
- **Fix (page.tsx):** Extracted `deriveTrialDaysLeft(trialEndsAt)` as a module-level pure function; rewrote state derivation as flat `if-else` chain (no inner `derive()` function)
- **Fix (checkout-return-poller.tsx):** Changed `useRef(Date.now())` to `useRef<number>(0)` and set `startedAt.current = Date.now()` at the top of the `useEffect` callback
- **Files modified:** page.tsx, checkout-return-poller.tsx
- **Deviation rule:** Rule 1 — Bug fix (lint error prevents `npm run lint` from passing)

**2. [Rule 3 - Blocking] TypeScript null-narrowing after redirect() on accountData**

- **Found during:** Task 1 verify (tsc)
- **Issue:** `maybeSingle()` returns `T | null`. TypeScript does not treat `redirect()` as `never` for narrowing, so `account` remained `T | null` after the guard. Initial fix using `accountData!` non-null assertion triggered an "unused eslint-disable" warning
- **Fix:** Renamed to `accountData`, placed the null check, then flat if-else chain references `account` directly (TypeScript sees `accountData` narrowed after the `if (!accountData)` redirect)
- **Files modified:** page.tsx
- **Deviation rule:** Rule 3 — Blocking issue (tsc errors would fail the verify step)

## Notes for 42-04 (Manual QA)

The QA plan must visually verify these states:

1. **Trialing with `trial_ends_at` set** → `/app/billing` shows trial countdown ("N days left in your trial") + plan card, annual tab pre-selected
2. **Trialing with `trial_ends_at = NULL`** → shows "Your trial is active" fallback sub-line + plan card
3. **Active subscription** → `/app/billing` shows "Your subscription is active." card only (no plan card, no nag)
4. **Locked (canceled/unpaid/etc.)** → shows "Everything is waiting for you!" card + plan card below for re-subscribe
5. **Cancel return** → visit `/app/billing` (no `session_id`) → renders plan-selection state silently (no error state)
6. **Checkout return** → visit `/app/billing?session_id=cs_test_FAKE` → poller shows spinner, then after 30s transitions to "Almost there…" with Refresh button
7. **Subscribe button** → click "Subscribe" on the plan card → browser navigates to Stripe-hosted checkout URL (verify Network tab shows POST to `/api/stripe/checkout`)

## Next Phase Readiness

**Ready for:**
- **42-04** — Billing page is complete. All four states render. Manual QA can proceed once PREREQ-B (real Stripe Price IDs) and PREREQ-E (pricing amounts) are configured in `.env.local`
- **Phase 43** — Locked-state copy is in place. Phase 43 only needs to add the paywall middleware redirect to `/app/billing` (no new copy needed on the billing page itself)
- **Phase 44** — `ActiveView` has a placeholder comment for the Customer Portal "Manage subscription" link

**No blockers** from this plan. All BILL-09, BILL-10 (UI half), and BILL-11 (UI half) requirements fulfilled.

---
*Phase: 42-checkout-flow-and-plan-selection*
*Completed: 2026-05-10*
