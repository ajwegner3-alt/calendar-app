---
phase: 44
plan: 05
subsystem: billing-ui
tags: [stripe, customer-portal, billing-ui, state-machine, status-card, server-component, client-component]
requires:
  - 44-01 (accounts.cancel_at_period_end column — production migration pending)
  - 44-03 (POST /api/stripe/portal route)
  - 42.5 (3-tier billing UI plumbing — LD-18 invariant preserved)
provides:
  - "Server component: app/(shell)/app/billing/_components/status-card.tsx (3 variants)"
  - "Client component: app/(shell)/app/billing/_components/portal-button.tsx (POST + redirect)"
  - "Extended /app/billing state machine (6 variants: polling | active | cancel_scheduled | past_due | plan_selection | locked)"
  - "UI half of BILL-21 (Manage Subscription button on active variant)"
  - "UI half of BILL-22 (Update payment method deep-link on past_due variant)"
  - "UI half of BILL-23 (amber cancel-at-period-end communication)"
affects:
  - "Phase 46 UAT (5 of 6 scenarios listed below)"
tech-stack:
  added: []
  patterns:
    - "Discriminated-union Status Card props (variant: active | cancel_scheduled | past_due)"
    - "Server component wraps client PortalButton (component-boundary pattern)"
    - "Pitfall 4 enforcement: cancel_at_period_end === true checked BEFORE generic active"
key-files:
  created:
    - "app/(shell)/app/billing/_components/portal-button.tsx (97 lines, client component)"
    - "app/(shell)/app/billing/_components/status-card.tsx (131 lines, server component)"
  modified:
    - "app/(shell)/app/billing/page.tsx (SELECT + union + state derivation + render branches)"
decisions:
  - "Used `&apos;` instead of raw apostrophe in 'We couldn't process' copy — preempts react/no-unescaped-entities."
  - "Border styling: border-amber-200 on Card root for cancel_scheduled + past_due — matches Phase 43 SubscriptionBanner amber treatment for visual continuity."
  - "ActiveView export in billing-state-views.tsx left intact (now dead) — non-churn deferred to a future knip pass."
  - "intervalLabel accepts both 'monthly'/'annual' and Stripe's raw 'month'/'year' values per Phase 41 plan_interval CHECK constraint carry-over."
  - "Render container for the three Status Card branches is max-w-2xl (single-card layout) — wider max-w-5xl reserved for the 3-card TierGrid."
duration: "~4 minutes"
completed: 2026-05-11
---

# Phase 44 Plan 05: Status Card + Portal Button UI Summary

## One-liner

Phase 44 (UI half of BILL-21/22/23): extended the `/app/billing` state machine from 4 to 6 variants — `cancel_scheduled` (amber) + `past_due` (amber + payment-method deep-link) — backed by a server-rendered `StatusCard` (3 variants) and a client-rendered `PortalButton` that POSTs to the Plan 44-03 route and `window.location.assign`s the returned Stripe Portal URL.

## What Shipped

### Task 1 — `portal-button.tsx` client component (commit `4b793b1`)

97-line `"use client"` component. POSTs to `/api/stripe/portal` (Plan 44-03 route) with conditional `{ flow }` body (omit for generic Portal; pass `{ flow: 'payment_method_update' }` for past_due deep-link). Uses `useTransition` for pending state (mirror of `subscribe-tier-card.tsx`). Redirects via `window.location.assign(url)` on success (LD-02: hosted Portal, never `@stripe/stripe-js`). Maps all five documented error codes from the route (`unauthorized`, `account_not_found`, `no_stripe_customer`, `stripe_error`, `no_session_url`) plus client-side fallbacks (`network_error`, `portal_failed`, `no_redirect_url`) to user-friendly copy.

### Task 2 — `status-card.tsx` server component, 3 variants (commit `421bcbd`)

131-line SERVER component (NO `"use client"` — only the `PortalButton` child is client). Discriminated-union `StatusCardProps` with three variants:

| variant | data-variant | Title | Border | Button flow |
| --- | --- | --- | --- | --- |
| `active` | `"active"` | "{Tier} Plan" | neutral | generic Portal |
| `cancel_scheduled` | `"cancel_scheduled"` | "Subscription ending" | amber-200 | generic Portal |
| `past_due` | `"past_due"` | "Payment required" | amber-200 | `payment_method_update` deep-link |

`data-variant` attributes on each Card root make the cards DOM-targetable for UAT screenshots/automation. `tierLabel()` maps `plan_tier` → `"Basic"`/`"Widget"`/`"Subscription"` (defensive default). `intervalLabel()` accepts both Phase 41 CHECK values (`month`/`year`) and CONTEXT vocabulary (`monthly`/`annual`).

### Task 3 — `page.tsx` extended state machine (commit `8681ef9`)

Five changes inside one file (90 insertions, 17 deletions):

1. **SELECT expanded** from 3 to 8 columns: `+plan_tier, cancel_at_period_end, current_period_end, plan_interval, stripe_customer_id`.
2. **`BillingPageState` union expanded** from 4 to 6 variants:
   - existing `polling`, `plan_selection`, `locked` unchanged
   - `active` gains `{ planTier, planInterval, renewalDate }`
   - new `cancel_scheduled` with `{ planTier, periodEndDate }`
   - new `past_due` (props-less marker — variant alone drives the render)
3. **State derivation**: Pitfall 4 honored — `subscription_status === "active" && cancel_at_period_end === true` checked in the FIRST `else if` after polling, BEFORE the generic `subscription_status === "active"` branch. `past_due` now routes to its own marker state (previously fell into `plan_selection` per Phase 42.5; LD-08 still honored because the past_due card is amber/friendly, never a redirect).
4. **`formatBillingDate(timestamp)` pure helper** added alongside existing `deriveTrialDaysLeft` — formats Stripe ISO timestamps as `"Month D, YYYY"` en-US, returns null on null input.
5. **Three new render branches** — one per StatusCard variant — using `max-w-2xl` container (single-card layout). `ActiveView` import removed from page.tsx; the export in `billing-state-views.tsx` is left intact (harmless dead export, knip-tolerant).

## Verification Results (all grep checks)

```text
[Task 1: portal-button.tsx]
1:"use client";                                   ✓ client component
27:export function PortalButton({                 ✓ named export
44:        const res = await fetch("/api/stripe/portal", {  ✓ POSTs to Plan 44-03 route
47:          body: JSON.stringify(flow ? { flow } : {}),    ✓ conditional flow body
56:          window.location.assign(url);                   ✓ redirect via assign

[Task 2: status-card.tsx]
'^"use client";' count = 0                        ✓ pure server component
2:import { PortalButton } from "./portal-button"; ✓ wraps client child
37:export function StatusCard(props: StatusCardProps) {     ✓ named export
66:    <Card data-variant="active">               ✓ variant 1
90:    <Card data-variant="cancel_scheduled" className="border-amber-200">  ✓ variant 2 + amber
115:    <Card data-variant="past_due" className="border-amber-200">         ✓ variant 3 + amber
127:        <PortalButton flow="payment_method_update" />  ✓ past_due uses deep-link flow
"border-amber-200" count = 2                      ✓ amber on cancel_scheduled + past_due only

[Task 3: page.tsx]
SELECT (8 columns) count = 1                      ✓ extended SELECT
type: "polling"     line 19                       ✓ all 6 union variants present
type: "active";     line 20
type: "cancel_scheduled" line 21
type: "past_due"    line 22
type: "plan_selection" line 23
type: "locked"      line 24
import { StatusCard } line 10                     ✓ StatusCard imported
<StatusCard count = 3                             ✓ rendered in active + cancel_scheduled + past_due branches
function formatBillingDate line 49                ✓ helper added
ActiveView count = 0                              ✓ fully removed from page.tsx

[LD-18 invariant preservation grep counts in page.tsx — all unchanged from pre-plan state]
<CheckoutReturnPoller count = 1                   ✓ polling branch byte-identical
<TrialingHeader count = 1                         ✓ trialing render byte-identical
<LockedView count = 1                             ✓ locked render byte-identical
<TierGrid count = 2                               ✓ plan_selection + locked branches preserve TierGrid

[Build]
npx tsc --noEmit:  zero new errors (only pre-existing tests/ fixture noise from STATE.md tech debt)
npm run build:     35 routes total — /app/billing and /api/stripe/portal both present, zero warnings
```

## Pitfall 4 Enforcement (state machine priority order)

The state-derivation `else if` chain in `page.tsx` lines 105–143 places the cancel_scheduled check BEFORE the generic active check:

```typescript
if (session_id) { ... }
else if (account.subscription_status === "active" && account.cancel_at_period_end === true) {
  state = { type: "cancel_scheduled", ... };   // ← checked FIRST
}
else if (account.subscription_status === "active") {
  state = { type: "active", ... };             // ← only reached when cancel_at_period_end !== true
}
else if (account.subscription_status === "trialing") { ... }
else if (account.subscription_status === "past_due") { state = { type: "past_due" }; }
else { state = { type: "locked" }; }
```

If the order were reversed, the green `active` card would render even for owners who scheduled cancellation in the Stripe Portal — a silent UX bug. The branch order is locked.

## LD-18 Invariant Preservation

Phase 42 / 42.5 plumbing that MUST remain byte-identical (per LD-18):

| Element | Status |
| --- | --- |
| `<CheckoutReturnPoller />` in polling branch | UNCHANGED |
| `<TrialingHeader />` inside plan_selection branch | UNCHANGED |
| `<LockedView />` inside locked branch | UNCHANGED |
| `<TierGrid />` inside plan_selection + locked branches (count=2) | UNCHANGED |
| `tierGridProps` derivation from `PRICES` map | UNCHANGED |
| `brandingBookingUrl` server-side env read | UNCHANGED |
| auth gate (`getClaims` + redirect) | UNCHANGED |
| `searchParams` await pattern | UNCHANGED |
| `metadata` export | UNCHANGED |
| `deriveTrialDaysLeft` helper | UNCHANGED |
| Cross-domain redirect pattern (`window.location.assign`, NOT `router.push`) | EXTENDED to PortalButton |

## Deviations from Plan

**Single Rule 1 preemptive fix during execution:**

**1. [Rule 1 - Bug-preempt] `couldn't` apostrophe escaped as `&apos;`**

- **Found during:** Task 2 (status-card.tsx authoring)
- **Issue:** Raw `couldn't` in JSX text would trip Next.js's `react/no-unescaped-entities` build-time lint, blocking the Task 3 `npm run build` verification step.
- **Fix:** Used `couldn&apos;t` (HTML entity) in the past_due card's `<CardDescription>` copy. Rendered output identical.
- **Files modified:** `app/(shell)/app/billing/_components/status-card.tsx` (line 116)
- **Commit:** included in `421bcbd` (no separate fix commit needed — caught at write-time)

All other plan content executed verbatim. No architectural deviations.

## Phase 46 UAT Scenarios (carried forward)

After PREREQ-C is complete (Customer Portal Dashboard config with plan-switching across all 4 Prices):

1. **Active owner** → /app/billing renders neutral StatusCard with plan tier + interval + "Renews on {date}" + "Manage Subscription" → click → POSTs to /api/stripe/portal → Stripe Customer Portal opens
2. **Cancel via Portal** → return to /app/billing → amber StatusCard "Subscription ending" with period-end date + "Manage Subscription"
3. **Simulate past_due via Supabase MCP** (`update accounts set subscription_status = 'past_due' where id = <account>`) → reload → amber StatusCard "Payment required" + "Update payment method" → click → opens Stripe Portal's payment-method-update deep-link (BILL-22 specific verification)
4. **Trialing accounts** → UNCHANGED (TrialingHeader + TierGrid, max-w-5xl container)
5. **Canceled / unpaid / incomplete accounts** → UNCHANGED (LockedView + TierGrid, max-w-5xl container)
6. **Polling state** (`?session_id=...` in URL after Checkout return) → UNCHANGED (CheckoutReturnPoller, max-w-2xl container)

## Next Phase Readiness

Phase 44 remaining work:
- ~~Plan 44-04 (webhook integration)~~ shipped sibling-of-this-plan (commits `1163a84` + `442767a`)
- Plan 44-01 production migration of `cancel_at_period_end` column — **still PENDING** as of this plan's completion. Until applied, the Status Card cancel_scheduled branch can never fire (column read returns `undefined` and the boolean strict-equality `=== true` rejects it cleanly). Page does NOT crash without the column — RLS-scoped select returns the row with the unknown column simply absent in the response.
- PREREQ-C (Stripe Customer Portal Dashboard config) — still pending; the Portal route itself works without it, but customers clicking "Manage Subscription" will see an "unconfigured" error from Stripe until PREREQ-C is complete. Deferred to Phase 46 UAT.

Both blockers are tracked in STATE.md.

## Atomic Commits

| # | Commit | Task |
| --- | --- | --- |
| 1 | `4b793b1` | `feat(44-05): create portal-button.tsx client component` |
| 2 | `421bcbd` | `feat(44-05): create status-card.tsx server component with 3 variants` |
| 3 | `8681ef9` | `feat(44-05): extend billing page state machine with cancel_scheduled + past_due` |

Plus metadata commit (this SUMMARY + STATE.md) to follow.
