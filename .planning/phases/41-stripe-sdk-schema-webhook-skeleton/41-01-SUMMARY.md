---
phase: 41-stripe-sdk-schema-webhook-skeleton
plan: "01"
subsystem: billing
tags: [stripe, sdk, singleton, server-only, billing, webhook]

# Dependency graph
requires: []
provides:
  - "stripe@22.1.1 exact-pinned SDK installed in package.json"
  - "lib/stripe/client.ts — singleton server-side Stripe client with server-only guard"
affects: [41-02, 41-03, 42-01, 42-02, 44-01]

# Tech tracking
tech-stack:
  added: ["stripe@22.1.1"]
  patterns:
    - "Module-scope singleton for stateless HTTP wrapper SDKs (Stripe) — opposite of Supabase admin.ts per-request factory"
    - "server-only import as first line — bundle-time guard against client-side import"

key-files:
  created: ["lib/stripe/client.ts"]
  modified: ["package.json", "package-lock.json"]

key-decisions:
  - "stripe@22.1.1 pinned exact (no ^) per LD-01 — prevents silent apiVersion drift on npm install"
  - "apiVersion: '2026-04-22.dahlia' pinned per LD-01 / V18-CP-08 — webhook schema stable"
  - "tsconfigPaths() plugin + tsconfig @/* -> ./* already covers @/lib/stripe/* — no explicit vitest.config.ts alias needed"
  - "Module-scope singleton (not factory) for Stripe — SDK has internal HTTP keep-alive; re-instantiating per request burns TCP handshakes"

patterns-established:
  - "Canonical import: import { stripe } from '@/lib/stripe/client' — used by Plans 41-03, 42-*, 44-*"
  - "STRIPE_WEBHOOK_SECRET consumed at webhook call site (not here) — secrets co-located with usage"

# Metrics
duration: 4min
completed: 2026-05-10
---

# Phase 41 Plan 01: Stripe SDK and Client Singleton Summary

**stripe@22.1.1 exact-pinned and lib/stripe/client.ts singleton with server-only guard and apiVersion: "2026-04-22.dahlia"**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-10T14:33:27Z
- **Completed:** 2026-05-10T14:37:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Installed `stripe@22.1.1` with `--save-exact` flag — `package.json` has `"stripe": "22.1.1"` (no `^` or `~`); lockfile updated
- Created `lib/stripe/client.ts` with `import "server-only"` first, module-scope singleton, apiVersion pinned to `"2026-04-22.dahlia"`
- Confirmed vitest alias coverage: `tsconfigPaths()` plugin + tsconfig `"@/*": ["./*"]` already resolves `@/lib/stripe/*` — no explicit entry needed in vitest.config.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Install stripe@22.1.1 (exact pin) and verify vitest alias** - `b47cd6b` (feat)
2. **Task 2: Create lib/stripe/client.ts singleton** - `bafec76` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified

- `lib/stripe/client.ts` — Singleton Stripe server-side client; `import "server-only"` + `new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" })`; canonical import for all Phase 41-44 billing code
- `package.json` — Added `"stripe": "22.1.1"` (exact pin, no semver prefix)
- `package-lock.json` — Lockfile updated with stripe@22.1.1 resolution

## Decisions Made

- **Exact pin enforced:** `--save-exact` flag used on `npm install` per LD-01. A caret would allow silent 22.x.y minor bumps that could drift bundled apiVersion typings (V18-CP-08 pitfall).
- **Module-scope singleton (not factory):** The Stripe SDK is a stateless typed HTTP wrapper with an internal keep-alive agent. Re-instantiating per request wastes TCP handshakes. This is intentionally OPPOSITE to `lib/supabase/admin.ts` which is a per-request factory (Fluid compute Postgres connection pooling).
- **No explicit vitest.config.ts alias needed:** The existing `tsconfigPaths()` plugin reads the tsconfig `"@/*": ["./*"]` path mapping and makes it available in Vitest. All `@/lib/stripe/*` imports resolve correctly without an additional alias entry. Verified by reading vitest.config.ts and tsconfig.json paths section.
- **STRIPE_WEBHOOK_SECRET absent from client.ts:** Secret consumed at webhook route call site (`stripe.webhooks.constructEvent()`), not at client instantiation — keeps dependency graph explicit per LD-06.

## Deviations from Plan

None - plan executed exactly as written.

The plan anticipated that vitest.config.ts might need an explicit alias entry. After inspection, the existing `tsconfigPaths()` plugin + tsconfig generic `@/*` mapping already covers `@/lib/stripe/*` — so the "add alias or document generic coverage" branch resolved to documentation only with no code change.

## Issues Encountered

`npx tsc --noEmit` exits with errors — but ALL are pre-existing test file failures (`tests/bookings-api.test.ts`, `tests/cancel-reschedule-api.test.ts`, etc.) documented in STATE.md as known tech debt. No errors exist in `lib/stripe/client.ts` or any production source file. `npx next build` completed cleanly with no server-only violations.

## User Setup Required

**External services require manual configuration before Phase 41 can deploy to production:**

- **PREREQ-A:** Create Stripe account at https://dashboard.stripe.com/register (if not already done)
- **PREREQ-D:** Add `STRIPE_SECRET_KEY` (test mode: `sk_test_*`) and `STRIPE_WEBHOOK_SECRET` (test) to Vercel Preview environment variables
  - Location: Vercel project -> Settings -> Environment Variables
  - `STRIPE_SECRET_KEY` source: Stripe Dashboard -> Developers -> API keys (test mode)
  - `STRIPE_WEBHOOK_SECRET` source: Stripe Dashboard -> Developers -> Webhooks -> signing secret (after PREREQ-F: register webhook endpoint post-deploy)

**Downstream plans can be built now** — they only need the Stripe SDK and client module. Live keys and webhook secrets are consumed at runtime, not build time.

## Next Phase Readiness

- `import { stripe } from "@/lib/stripe/client"` is the canonical import for all subsequent billing code
- Plans 41-02 (database schema), 41-03 (webhook route), 42-01/42-02 (checkout), and 44-01 (portal) all depend on this client
- No blockers for continuing Phase 41 plan execution (Plans 41-02 and 41-03 are database/routing work that does not require live Stripe keys)
- Production deploy blocked on PREREQ-A (Stripe account) + PREREQ-D (env vars in Vercel) — development can proceed

---
*Phase: 41-stripe-sdk-schema-webhook-skeleton*
*Completed: 2026-05-10*
