# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-10 — **MID-EXECUTION SCOPE PIVOT.** Phase 42 plumbing landed (42-01/02/03 = 15 commits, 3 plans shipped); Phase 42-04 UAT scaffolded but **superseded** before running. New 3-tier product model locked: Basic (Stripe, no widget) + Widget (Stripe, full app) + Branding (consult CTA, no Stripe). Phases 42.5 + 42.6 inserted. ROADMAP.md updated. Next: `/gsd:plan-phase 42.5`.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (3-tier model). Phase 41 shipped 2026-05-10. Phase 42 plumbing code-complete 2026-05-10. Phase 42.5 (Multi-Tier Stripe + Schema) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 42.5 of 46 (+ inserted 42.5/42.6) — ready to plan
**Plan:** —
**Status:** Phase 42 plumbing code-complete (42-01 + 42-02 + 42-03 = 15 commits pushed to origin/main); 42-04 UAT scaffolded but superseded by 42.5 UAT before running. Phase 42.5 (multi-tier expansion) and 42.6 (widget gating) inserted into ROADMAP. Awaiting `/gsd:plan-phase 42.5`.
**Last activity:** 2026-05-10 — Mid-execution pivot: single-plan → 3-tier model. Existing on-disk code (`lib/stripe/prices.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout/status/route.ts`, webhook handler, `/app/billing/page.tsx` + 3 client components) will be refactored in-place by 42.5 — none thrown away. 5 grandfathered v1.7 accounts unchanged.

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
v1.8 [-] Stripe Paywall + Login UX    (Phases 41-46, Phase 41 shipped 2026-05-10 — 4 plans, 9 commits; phases 42-46 remain)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7) + Phase 41 of v1.8 = 41 phases, 174 plans, ~701 commits

## v1.8 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 41 | Stripe SDK + Schema + Webhook Skeleton | BILL-01..08 ✅ | ✅ Shipped 2026-05-10 |
| 42 | Checkout Flow Plumbing | BILL-09 (partial) + BILL-10/11 | ⚠ Code-complete 2026-05-10; 3/4 plans shipped; 42-04 UAT superseded by 42.5 |
| **42.5** | **Multi-Tier Stripe + Schema** (INSERTED) | BILL-09 (full) + BILL-10b + BILL-25 | Ready to plan — blocked on revised PREREQ-B/D/E + PREREQ-G |
| **42.6** | **Widget Feature Gating** (INSERTED) | BILL-26 + BILL-27 | Depends on 42.5 |
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
- Phase 42.5 blocked on: PREREQ-B revised (create 1 Product with 4 Prices: Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual; capture all 4 Price IDs) + PREREQ-D revised (10 env vars: 4 Price IDs + 4 cents amounts + `NSI_BRANDING_BOOKING_URL` + Vercel deploy) + PREREQ-E revised (4 pricing amounts) + PREREQ-G new (`checkout.session.completed` added to webhook `we_1TVfOTJ7PLcBbY73Groz1G13` enabled_events list)
- Phase 44 blocked on: PREREQ-C (Customer Portal config — must enable plan-switching across all 4 Prices)

## Session Continuity

**Last session:** 2026-05-10 — Phase 42 executed Waves 1+2 (42-01/02/03) shipped 15 commits, pushed to origin/main. Wave 3 (42-04 UAT) hit checkpoint; before Andrew ran UAT, a scope conversation revealed the actual product model is 3-tier (Basic / Widget / Branding) not single-plan. Phase 42-04 UAT abandoned; Phase 42.5 + 42.6 inserted into roadmap. STATE + ROADMAP updated.

**Stopped at:** 42-04 UAT pre-empted by scope pivot. Phase 42 plumbing remains in working order; UI will be refactored by 42.5.

**Resume file:** None — next action is `/gsd:plan-phase 42.5` (Multi-Tier Stripe + Schema). Andrew should kick off PREREQ-B revised (create 4 Prices in Stripe), PREREQ-D revised (add 10 env vars to Vercel + push redeploy), PREREQ-E revised (decide 4 amounts), and PREREQ-G (add `checkout.session.completed` to webhook events) in parallel — planning can begin with placeholders.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
