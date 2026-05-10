---
phase: 42-checkout-flow-and-plan-selection
plan: "01"
subsystem: payments
tags: [stripe, supabase, nextjs, checkout, subscription, polling]

requires:
  - phase: 41-stripe-sdk-schema-webhook-skeleton
    provides: "Stripe SDK singleton (lib/stripe/client.ts), billing columns on accounts (stripe_customer_id, subscription_status, plan_interval, trial_ends_at), stripe_webhook_events dedup table, webhook handler pattern"

provides:
  - "lib/stripe/prices.ts: centralized env-var-driven pricing config (PRICES.monthly + PRICES.annual) with computed savingsPct"
  - "POST /api/stripe/checkout: creates Stripe Customer + Checkout Session, writes stripe_customer_id to accounts (SC-5 closure)"
  - "GET /api/stripe/checkout/status: polling endpoint returning subscription_status with no-store caching"
  - ".env.local.example documenting 4 new Phase 42 env vars"

affects:
  - 42-02 (webhook update — checkout.session.completed handler already in working tree)
  - 42-03 (billing page UI consumes POST /api/stripe/checkout + GET /api/stripe/checkout/status)
  - 42-04 (verification — SC-5 end-to-end linkage, requires PREREQ-B + PREREQ-E env vars set)
  - 43 (paywall middleware reads subscription_status written by webhook, not by checkout route)

tech-stack:
  added: []
  patterns:
    - "Env-var-driven pricing config: price IDs + amounts as env vars (no Stripe API roundtrip at render)"
    - "Customer pre-create before Checkout Session (SC-5 strategy): write stripe_customer_id before redirect"
    - "Race-safe conditional update: .is('stripe_customer_id', null) guard on admin client UPDATE"
    - "Dual anti-stale-cache guards: force-dynamic + Cache-Control: no-store on polling endpoint"
    - "Structured logging on every outcome: {account_id, customer_id, interval, outcome} shape"

key-files:
  created:
    - lib/stripe/prices.ts
    - app/api/stripe/checkout/route.ts
    - app/api/stripe/checkout/status/route.ts
    - .env.local.example
  modified: []

key-decisions:
  - "Pre-create Stripe Customer before Checkout Session (closes SC-5 gap from Phase 41)"
  - "Env-var-driven prices — no stripe.prices.retrieve() at page-load (RESEARCH Open Question 1)"
  - "Race guard via conditional .is('stripe_customer_id', null) UPDATE, re-fetch on race loss"
  - "Placeholder price IDs blocked in production (NODE_ENV check) to prevent silent misconfiguration"
  - "dollars() helper preserves cents portion — no Math.round on display values"

patterns-established:
  - "PRICES config in lib/stripe/prices.ts: single import point for UI + checkout route"
  - "NO_STORE const pattern: { 'Cache-Control': 'no-store' } as const on every response"
  - "Checkout route logging: [stripe-checkout] prefix, structured {account_id, customer_id, interval, outcome}"

duration: 6min
completed: 2026-05-10
---

# Phase 42 Plan 01: Prices Config and Checkout Backend Summary

**Env-var-driven PRICES config, POST /api/stripe/checkout (SC-5 customer linkage before session), and GET /api/stripe/checkout/status polling endpoint — full backend surface for Stripe Hosted Checkout**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-10T23:33:35Z
- **Completed:** 2026-05-10T23:39:06Z
- **Tasks:** 3
- **Files created:** 4 (366 lines total)

## Accomplishments

- Centralized pricing config in `lib/stripe/prices.ts` — PRICES constant with monthly/annual intervals, computed savingsPct, env-var fallback placeholders so dev server boots without PREREQ-E configuration
- POST /api/stripe/checkout closes the Phase 41 SC-5 deferred gap: writes `stripe_customer_id` to accounts before returning the Checkout URL, ensuring subscription webhooks can always resolve the account by customer ID
- GET /api/stripe/checkout/status polling endpoint with dual anti-stale-cache guards (`force-dynamic` + `Cache-Control: no-store`), preventing the Pitfall 4 scenario where a poller always sees cached `trialing` and times out

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralized prices config + .env.local.example** — `ce24f5b` (feat — note: pre-commit hook bundled with pre-existing webhook handler in one commit labeled 42-02; see Deviations)
2. **Task 2: POST /api/stripe/checkout** — `ec9b779` (feat(42-01))
3. **Task 3: GET /api/stripe/checkout/status** — `18223b9` (feat(42-01))

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `lib/stripe/prices.ts` (57 lines) — PRICES config: monthly (priceId, amountCents, label) + annual (priceId, amountCents, totalLabel, monthlyEquivalentLabel, savingsPct). PriceInterval type exported.
- `app/api/stripe/checkout/route.ts` (225 lines) — POST handler: auth gate, body parse, account fetch, Stripe Customer create/reuse (SC-5 strategy), race-safe conditional write, origin derivation, Checkout Session creation, session.url validation, structured logs.
- `app/api/stripe/checkout/status/route.ts` (74 lines) — GET handler: auth gate, `subscription_status` select, dual no-store guards.
- `.env.local.example` (10 lines) — Four Phase 42 env vars with PREREQ source comments: `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_MONTHLY_CENTS`, `STRIPE_PRICE_ANNUAL_CENTS`.

## Decisions Made

**Decision 1 — Pre-create Stripe Customer before Checkout Session (SC-5 strategy)**
The checkout route creates `stripe.customers.create()` and immediately writes `stripe_customer_id` to `accounts` before calling `stripe.checkout.sessions.create()`. This ensures subsequent `customer.subscription.*` webhooks can resolve the account via `stripe_customer_id`. `client_reference_id: account.id` is passed as belt-and-suspenders for the `checkout.session.completed` handler. The race-safe conditional update (`.is("stripe_customer_id", null)`) prevents duplicate customer IDs on concurrent clicks.

**Decision 2 — Env-var-driven prices, no Stripe API roundtrip at render**
`STRIPE_PRICE_MONTHLY_CENTS` and `STRIPE_PRICE_ANNUAL_CENTS` are env vars alongside the price IDs. `dollars()` helper preserves `.99` pricing without rounding. No `stripe.prices.retrieve()` call at page load — authoritative amounts live in env vars per RESEARCH Open Question 1.

**Decision 3 — Placeholder price IDs blocked in production**
If `priceId.startsWith("price_placeholder_")` and `NODE_ENV === "production"`, the checkout route returns `400 {error: "missing_price_id"}`. This prevents a misconfigured production environment from silently creating broken Checkout sessions.

**Decision 4 — Status endpoint returns only subscription_status**
The polling endpoint (`/api/stripe/checkout/status`) selects only `subscription_status`. No `stripe_customer_id`, `current_period_end`, or other billing columns. Single-purpose endpoint — the poller only needs to detect the `trialing` → `active` flip.

## Deviations from Plan

### Commit Attribution Deviation

**[Pre-commit hook behavior] Task 1 files bundled into a pre-existing 42-02 labeled commit**

- **Found during:** Task 1 commit attempt
- **Issue:** The working tree contained pre-existing uncommitted changes to `app/api/stripe/webhook/route.ts` (the `checkout.session.completed` handler, which belongs to Plan 42-02). When `git add lib/stripe/prices.ts .env.local.example` was run and `git commit` attempted, a pre-commit hook (Ralph/GSD automation) auto-staged and committed all three files together under commit `ce24f5b` with message `feat(42-02): add checkout-session-completed webhook handler`.
- **Impact:** The Task 1 files (`lib/stripe/prices.ts`, `.env.local.example`) are in commit `ce24f5b` which is labeled `42-02` rather than a separate `42-01` commit. The webhook handler content is correct and matches RESEARCH Pattern 4.
- **Resolution:** All task artifacts are committed and correct. Tasks 2 and 3 received properly scoped `feat(42-01)` commits. No code was lost or corrupted.
- **Deviation rule:** This is an environmental/tooling behavior, not a Rule 1-4 code deviation.

## Issues Encountered

**Pre-existing test TS errors (pre-existing drift, not introduced by this plan)**

`npx tsc --noEmit` shows errors only in `tests/` files referencing `__mockSendCalls`, `__setTurnstileResult`, etc. These are pre-existing failures documented in STATE.md ("Pre-existing test fixture failures"). Zero errors in new source files (`lib/stripe/prices.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout/status/route.ts`).

## User Setup Required

**External services require manual configuration before Phase 42 verification (SC-5 live test).**

Add to `.env.local` (development) and Vercel project settings (production):

| Variable | Source | Example |
|----------|--------|---------|
| `STRIPE_PRICE_ID_MONTHLY` | Stripe Dashboard (test mode) → Products → [product] → monthly price → copy ID | `price_1ABC...` |
| `STRIPE_PRICE_ID_ANNUAL` | Stripe Dashboard (test mode) → Products → [product] → annual price → copy ID | `price_1DEF...` |
| `STRIPE_PRICE_MONTHLY_CENTS` | PREREQ-E pricing decision, in cents | `2900` ($29/mo) |
| `STRIPE_PRICE_ANNUAL_CENTS` | PREREQ-E pricing decision, in cents | `27840` ($232/yr) |

Also confirm `checkout.session.completed` is enabled on the Stripe Dashboard webhook endpoint `we_1TVfOTJ7PLcBbY73Groz1G13` (RESEARCH Open Question 3).

## Next Phase Readiness

**Ready for:**
- **42-02** — Webhook `checkout.session.completed` handler already committed to working tree in `ce24f5b`; needs its own plan execution or staging
- **42-03** — Billing page UI can now call `POST /api/stripe/checkout` and `GET /api/stripe/checkout/status`; PRICES config provides all display values
- **42-04** — SC-5 end-to-end verification requires PREREQ-B (Stripe Product + Prices created) and PREREQ-E (pricing amounts decided)

**Blockers:**
- PREREQ-B: Stripe sandbox Product + monthly/annual Prices must be created before live testing
- PREREQ-E: Pricing amounts must be decided before env vars can be populated with real values

---
*Phase: 42-checkout-flow-and-plan-selection*
*Completed: 2026-05-10*
