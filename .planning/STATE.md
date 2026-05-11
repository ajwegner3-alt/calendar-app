# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-11 — Phase 42.6 Plan 01 (Wave 1) COMPLETE. Pure `requireWidgetTier(account)` helper landed at `lib/stripe/widget-gate.ts` with 12-case branch-coverage test suite at `tests/widget-gate.test.ts` — all 12 passing, zero new tsc errors. Trialing-first branch ordering preserved (critical invariant for Plans 02/03): trialing always allowed regardless of plan_tier (including NULL during the pre-first-checkout window), past_due+widget allowed (LD-08 mirror), basic+active/past_due denied with reason 'basic_tier', everything else denied with reason 'no_subscription'. Helper imports `PriceTier` from `lib/stripe/prices.ts` (no redefinition). Wave 2 (Plans 42.6-02 public embed + 42.6-03 owner dialog) is unblocked and can run in parallel — both consume `requireWidgetTier` unmodified. SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-01-SUMMARY.md`, commit `61b65ba`. Previous status: Phase 42.5 SHIPPED 2026-05-10 (multi-tier Stripe paywall foundation), Plan 42.5-06 UAT closed via Andrew's verbal "approved" sign-off.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (3-tier model). Phase 41 shipped 2026-05-10. Phase 42 plumbing code-complete 2026-05-10. Phase 42.5 (Multi-Tier Stripe + Schema) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 42.6 of 46 (+ inserted 42.5/42.6) — **IN PROGRESS** (Wave 1 complete; Wave 2 unblocked)
**Plan:** 42.6-01 complete; next = 42.6-02 (public embed gate) + 42.6-03 (owner dialog gate) in parallel
**Status:** Phase 42.6 Wave 1 COMPLETE. Pure widget-gate helper landed at `lib/stripe/widget-gate.ts` with 12-case vitest branch-coverage suite at `tests/widget-gate.test.ts` — all 12 passing, zero new tsc errors. Exports `requireWidgetTier(account: AccountGateInput): WidgetGateResult` plus the `WidgetGateResult` discriminated union (`{ allowed: true }` | `{ allowed: false; reason: 'basic_tier' | 'no_subscription' }`). Trialing-first branch ordering is the critical invariant locked in for Plans 02/03 — new accounts during 14-day trial have `plan_tier = NULL` (webhook writes plan_tier only on first paid checkout, per Phase 42.5) and MUST be allowed; the gate would otherwise fail every trialing user through to `'no_subscription'`. Branches in order: (1) trialing → allowed regardless of plan_tier; (2) widget + active/past_due → allowed (LD-08 mirror); (3) basic + active/past_due → denied:'basic_tier'; (4) fallthrough → denied:'no_subscription'. Helper imports `PriceTier` from `lib/stripe/prices.ts` (no redefinition — single source of truth for tier vocabulary). Pure function, no DB/network/async — callers own UX shaping. SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-01-SUMMARY.md`, commit `61b65ba`. Wave 2 (Plans 42.6-02 public embed + 42.6-03 owner dialog) can now run in parallel — both consume `requireWidgetTier` unmodified.
**Last activity:** 2026-05-11 — Executed Plan 42.6-01 (autonomous, no checkpoints). Created `lib/stripe/widget-gate.ts` (87 lines) + `tests/widget-gate.test.ts` (127 lines), committed atomically as `feat(42.6-01)`. `npm test -- widget-gate` → 12/12 passing in ~5ms. Pre-existing 42-line tsc noise in `tests/reminder-cron.test.ts` + `tests/upgrade-action.test.ts` confirmed unchanged (documented tech debt) — Plan 01 introduces zero new tsc errors.

## Cumulative project progress

```
v1.0 [X] MVP                          (Phases 1-9,   52 plans, 222 commits, shipped 2026-04-27)
v1.1 [X] Multi-User + Capacity + UI   (Phases 10-13, 34 plans, 135 commits, shipped 2026-04-30)
v1.2 [X] NSI Brand Lock-Down + UI     (Phases 14-21, 22 plans,  91 commits, shipped 2026-05-02)
v1.3 [X] Bug Fixes + Polish           (Phases 22-24,  6 plans,  34 commits, shipped 2026-05-02)
v1.4 [X] Slot Correctness + Polish    (Phases 25-27,  8 plans,  50 commits, shipped 2026-05-03)
v1.5 [X] Buffer + Rebrand + Booker    (Phases 28-30,  6 plans,  31 commits, shipped 2026-05-05)
v1.6 [X] Day-of-Disruption Tools      (Phases 31-33, 10 plans,  53 commits, shipped 2026-05-06)
v1.7 [X] Auth + Email + Polish + Debt (Phases 34-40, 32 plans, 129 commits, shipped 2026-05-09)
v1.8 [-] Stripe Paywall + Login UX    (Phases 41-46, Phases 41 + 42.5 shipped 2026-05-10; Phase 42.6 Wave 1 complete 2026-05-11; Waves 2-N of 42.6 + phases 43/44/45/46 remain)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7) + Phase 41 of v1.8 = 41 phases, 174 plans, ~701 commits

## v1.8 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 41 | Stripe SDK + Schema + Webhook Skeleton | BILL-01..08 ✅ | ✅ Shipped 2026-05-10 |
| 42 | Checkout Flow Plumbing | BILL-09 (partial) + BILL-10/11 | ⚠ Code-complete 2026-05-10; 3/4 plans shipped; 42-04 UAT superseded by 42.5 |
| **42.5** | **Multi-Tier Stripe + Schema** (INSERTED) | BILL-09 (full) + BILL-10b + BILL-25 | ✅ Shipped 2026-05-10 |
| **42.6** | **Widget Feature Gating** (INSERTED) | BILL-26 + BILL-27 | ⚠ In progress 2026-05-11 — Plan 01 (helper) complete; Plans 02 + 03 unblocked |
| 43 | Paywall Enforcement + Locked-State UX + Trial Banners | BILL-12..20 | 42.5 must ship first; LD-07 verification mandatory |
| 44 | Customer Portal + Billing Polish + Stripe Emails | BILL-21..24 | PREREQ-C (Portal config — 4-Price plan-switching); can develop parallel to 43 |
| 45 | Login UX Polish + Gmail Quota Raise | AUTH-33..39 + EMAIL-35 | Fully independent |
| 46 | Andrew Ship Sign-Off | (sign-off) | All of 41-45 + 42.5 + 42.6 complete |

## Accumulated Context

### Locked Decisions (must not be reopened in phase plans)

- **LD-01** stripe@22.1.1; `apiVersion: '2026-04-22.dahlia'`; pin forever
- **LD-02** No `@stripe/stripe-js`; hosted Checkout only; zero client-side Stripe code
- **LD-03** Customer Portal handles cancel/update-payment/invoices/plan-switch; no custom equivalents
- **LD-04** Paywall gate allows `trialing` and `active` only; locked = all other statuses
- **LD-05** Webhook idempotency via `stripe_webhook_events (stripe_event_id PRIMARY KEY)` + `ON CONFLICT DO NOTHING`
- **LD-06** Webhook MUST `await req.text()` before `constructEvent()` — never `req.json()` first
- **LD-07** Paywall middleware extends `lib/supabase/proxy.ts` inside existing `pathname.startsWith('/app')` branch; `/[account]/*` structurally exempt
- **LD-08** `past_due` = banner only, NOT lockout; only `unpaid`/`canceled`/trial-expired → redirect
- **LD-09** Existing v1.7 accounts: `trial_ends_at = NOW() + INTERVAL '14 days'` at deploy (NOT `created_at + 14 days`)
- **LD-10** Checkout return lag-window uses polling; webhook is canonical source of truth; no optimistic update
- **LD-11** Stripe-triggered emails route through `getSenderForAccount(accountId)`; Stripe receipts complement for dollar-amount emails
- **LD-12** AUTH-29 four-way enumeration-safety invariant preserved; magic-link helper identical wording for all users

### Roadmap Evolution

- **2026-05-10** — Phase 42.5 INSERTED after Phase 42 (Multi-Tier Stripe + Schema). Reason: mid-execution scope pivot from single-plan to 3-tier model (Basic / Widget / Branding). Phase 42 plumbing remains correct and is reused; only the prices map, checkout body, and billing UI need refactoring.
- **2026-05-10** — Phase 42.6 INSERTED after Phase 42.5 (Widget Feature Gating). Reason: Basic tier excludes the booking widget; need server-side gate on `/embed/[account]/[slug]` + owner embed-code page based on `plan_tier`.

### Locked decisions (3-tier model, 2026-05-10)

- **LD-13** Three tiers: Basic (Stripe), Widget (Stripe), Branding (consult CTA, non-Stripe). 1 Stripe Product, 4 Prices. Branding never writes to `accounts.plan_tier`.
- **LD-14** `accounts.plan_tier` column: text, CHECK `('basic','widget')`, NULL allowed (trialing accounts before first checkout). Webhook derives from Price ID matched against `lib/stripe/prices.ts`.
- **LD-15** Trial default tier = Widget (full app capability during trial). On trial expiry, account is locked and must pick a tier on the 3-card billing page. Existing 5 v1.7 grandfathered accounts follow the same path — no special-casing.
- **LD-16** Branding CTA destination is `process.env.NSI_BRANDING_BOOKING_URL` (= `https://booking.nsintegrations.com/nsi/branding-consultation`). Same-window navigation, no API call, no DB write.
- **LD-17** Widget tier gating happens on TWO surfaces: public `/embed/[account]/[slug]` (renders gated message, NOT 404 — must not break iframes) + owner-side embed-code settings page (replaces embed code with upgrade CTA). The bare booker `/{account}/{slug}` is NEVER gated (LD-07 extension).
- **LD-18** Phase 42 single-plan UI on disk is to be refactored in-place by Phase 42.5 — not thrown away. SC-5 plumbing (customer linkage, no-store cache, 2s/30s polling, return flow) is preserved.
- **LD-19** Widget-gate helper `requireWidgetTier(account)` lives at `lib/stripe/widget-gate.ts` and is the ONLY gate logic for widget access — both public `/embed/[account]/[slug]` (Plan 42.6-02) and owner-side embed-code dialog (Plan 42.6-03) MUST consume it unmodified. Branch order is locked: trialing checked FIRST (allowed regardless of plan_tier — covers NULL plan_tier during pre-first-checkout trial), then widget+active/past_due (allowed), then basic+active/past_due (denied:'basic_tier'), then fallthrough (denied:'no_subscription'). Return shape is a discriminated union `{ allowed: true } | { allowed: false, reason: 'basic_tier' | 'no_subscription' }` — callers MUST branch on `result.allowed` first. Helper is pure (no DB/network/async); callers fetch the account row and own UX shaping.

### Phase 41 decisions (carry into Phase 42+)

- **plan_interval CHECK:** Accepts both Stripe payload values (`month`/`year`) AND CONTEXT vocabulary (`monthly`/`annual`). Phase 42 normalizes (don't write `monthly`/`annual` from checkout — write what Stripe gives back via webhook).
- **stripe_webhook_events:** RLS enabled with zero policies = service-role-only access (no anon/authenticated reads).
- **Trigger function (production):** INSERT cols: `owner_user_id, owner_email, slug, name, timezone, onboarding_complete, onboarding_step, subscription_status, trial_ends_at`. All Phase 10 columns preserved.
- **Stripe API 2026-04-22.dahlia field migration:** `current_period_end` moved from `Stripe.Subscription` to `Stripe.SubscriptionItem` — access via `sub.items.data[0]?.current_period_end`. Invoice subscription reference moved from `invoice.subscription` to `invoice.parent?.subscription_details?.subscription`. Phase 42 checkout code referencing these fields must use the new paths.
- **Phase 43 invariant:** `/api/stripe/webhook` MUST be exempt from the paywall middleware auth gate (invoked by Stripe servers, not authenticated users). Failing to exempt will break the billing state machine.
- **Local build placeholder:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` placeholder values added to `.env.local` (gitignored). Stripe SDK throws at module init if key is absent; placeholder is never used in API calls.
- **Stripe Dashboard v2 UI restriction:** Stripe's "+ Add destination" UI defaults to v2/Event Destinations source which doesn't include `customer.subscription.*` or `invoice.*`. Workaround: `stripe webhook_endpoints create` CLI bypasses the UI restriction. Phase 44+ may need same workaround for additional endpoints.
- **SC-5 deferred to Phase 42:** Phase 41's "real Stripe trigger writes to a real accounts row" success criterion was not exercised because no `accounts` row has `stripe_customer_id` set yet. Phase 42's first checkout naturally creates this linkage. Phase 42 verification should include a "first checkout end-to-end" sign-off that captures this.

### Carried patterns from v1.7

- `getSenderForAccount` factory fail-closed contract — Stripe webhook email dispatch (Phase 44) uses same pattern
- `isRefusedSend(error)` dual-prefix helper — reuse for billing email error handling
- 5xx-only formError gate for enumeration-safe actions — preserved in magic-link helper (Phase 45)
- Knip CI gate is active — RESOLVED for lib/stripe: tsconfigPaths() + tsconfig @/* -> ./* covers @/lib/stripe/* generically (no explicit alias needed)

### Open tech debt (carried unchanged)

- PREREQ-03 (Resend live activation) — framework shipped; live activation gated on DNS
- Lockfile regeneration under Node 20 — knip CI gate dormant
- Vercel env-var cleanup — delete inert `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME`
- `slot-picker.tsx` on disk — Plan 30-01 Rule 4
- Pre-existing test fixture failures — `tests/bookings-api.test.ts` + `tests/slots-api.test.ts` date-sensitive
- Pre-existing working-tree drift — three pre-existing modified files (Phase 02/23/33 docs)

### Blockers

- ~~Phase 41 deploy: PREREQ-A + PREREQ-D~~ ✅ Resolved 2026-05-10
- ~~Phase 41 live test: PREREQ-F~~ ✅ Resolved 2026-05-10
- ~~Phase 41 SC-5 carry-over (real Stripe trigger writes to real accounts row)~~ ✅ Closed by Phase 42.5 SC-5 Tests 5a + 5b on 2026-05-10
- ~~Phase 42.5 blocked on: PREREQ-B/D/E revised + PREREQ-G~~ ✅ Resolved 2026-05-10 (verified during UAT walkthrough)
- ~~Plan 42.5-04 blocked on Andrew running `npx supabase db push --linked`~~ ✅ Resolved 2026-05-10 (verified during UAT — webhook write of `plan_tier` exercised end-to-end in SC-5)
- Phase 44 blocked on: PREREQ-C (Customer Portal config — must enable plan-switching across all 4 Prices)

## Session Continuity

**Last session:** 2026-05-11 — Executed Plan 42.6-01 (Wave 1, autonomous, no checkpoints). Created `lib/stripe/widget-gate.ts` (pure `requireWidgetTier` helper) + `tests/widget-gate.test.ts` (12-case branch-coverage suite). Atomic commit `61b65ba` — `feat(42.6-01): add requireWidgetTier helper + unit tests`. `npm test -- widget-gate` → 12 passed. Authored `42.6-01-SUMMARY.md`. Pre-existing 42-line tsc noise in unrelated test files confirmed unchanged (documented tech debt). Previous session 2026-05-10: Phase 42.5 shipped.

**Stopped at:** Completed Plan 42.6-01. Phase 42.6 Wave 2 (Plans 42.6-02 public embed gate + 42.6-03 owner-side embed dialog gate) is unblocked and can run in parallel — both consume `requireWidgetTier` unmodified. Phase 43 (Paywall Enforcement) also remains unblocked and can proceed in parallel with the rest of Phase 42.6.

**Resume file:** None — next action is to execute Plans 42.6-02 and 42.6-03 (Wave 2) in parallel via `/gsd:execute-phase 42.6` or `/gsd:execute-plan 42.6-02` / `42.6-03` per Andrew's preference.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
