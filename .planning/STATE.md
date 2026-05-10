# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-10 — **Phase 42 Plan 03 complete.** /app/billing UI shipped: Server Component (4-state derivation), plan-selection card (monthly/annual toggle, dynamic savings badge, Subscribe → POST + redirect), checkout-return poller (2s/30s, auto-redirect to /app), billing-state-views (locked-state tonal anchor, trial countdown). 3 tasks, 3 commits. Ready for 42-04 manual QA.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish. Phase 41 shipped 2026-05-10. Phase 42 (Checkout Flow + Plan Selection Page) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 42 of 46 — in progress
**Plan:** 03 of 04 complete (42-01 + 42-02 + 42-03 shipped; 42-04 manual QA pending)
**Status:** In progress — 42-03 billing UI complete. 42-04 is manual QA (requires PREREQ-B + PREREQ-E env vars set, then sign-off from Andrew).
**Last activity:** 2026-05-10 — 42-03 (billing page UI) complete. 3 tasks, 4 files created (page.tsx, billing-state-views.tsx, plan-selection-card.tsx, checkout-return-poller.tsx). All CONTEXT-locked decisions honored. Build passing, tsc clean, lint clean.

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
| 42 | Checkout Flow + Plan Selection | BILL-09..11 | Next — blocked on PREREQ-B + PREREQ-E |
| 43 | Paywall Enforcement + Locked-State UX + Trial Banners | BILL-12..20 | Phase 42 must ship first; LD-07 verification mandatory |
| 44 | Customer Portal + Billing Polish + Stripe Emails | BILL-21..24 | PREREQ-C (Portal config); can develop parallel to 43 |
| 45 | Login UX Polish + Gmail Quota Raise | AUTH-33..39 + EMAIL-35 | Fully independent of 41-44 |
| 46 | Andrew Ship Sign-Off | (sign-off) | All of 41-45 complete |

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

- ~~Phase 41 deploy: PREREQ-A + PREREQ-D~~ ✅ Resolved 2026-05-10 (sandbox `NSI Calendar — v1.8 dev`; sk_test + whsec in Vercel)
- ~~Phase 41 live test: PREREQ-F~~ ✅ Resolved 2026-05-10 (webhook `we_1TVfOTJ7PLcBbY73Groz1G13` registered via Stripe CLI; api_version `2026-04-22.dahlia`)
- Phase 42 blocked on: PREREQ-B (create Product + monthly Price + annual Price in Stripe sandbox; capture Price IDs) + PREREQ-E (decide pricing amounts)
- Phase 44 blocked on: PREREQ-C (Customer Portal config in Stripe dashboard)

## Session Continuity

**Last session:** 2026-05-10 — Phase 42 Plans 01+02+03 executed. Wave 1 (42-01 prices + checkout APIs + 42-02 webhook handler) shipped. Wave 2 (42-03 billing page UI) shipped. 3 tasks, 4 files created, 3 commits. tsc clean, lint clean, build passes.

**Stopped at:** 42-03 complete. Next: 42-04 manual QA verification (sign-off from Andrew). Requires PREREQ-B (Stripe Price IDs) + PREREQ-E (pricing amounts) in `.env.local` to test Subscribe end-to-end.

**Resume file:** None — next action is `/gsd:execute-phase 42 04` or Andrew populating PREREQ-B/PREREQ-E and running 42-04 QA checkpoint.

**Resume file:** None — next action is `/gsd:plan-phase 42` (Checkout Flow + Plan Selection Page). Andrew should complete PREREQ-B (create Product + monthly + annual Prices in Stripe sandbox) and PREREQ-E (decide pricing amounts) before Phase 42 deploys, but planning can start with placeholders.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
