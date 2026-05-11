# Roadmap: Calendar App (NSI Booking Tool)

## Milestones

- ✅ **v1.0 MVP** — Phases 1-9 (52 plans) — shipped 2026-04-27. Full archive: [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md).
- ✅ **v1.1 Multi-User + Capacity + Branded UI** — Phases 10-13 (34 plans, including decimal Phases 12.5 + 12.6) — shipped 2026-04-30. Full archive: [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md).
- ✅ **v1.2 NSI Brand Lock-Down + UI Overhaul** — Phases 14-21 (22 plans across 8 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md).
- ✅ **v1.3 Bug Fixes + Polish** — Phases 22-24 (6 plans across 3 phases) — shipped 2026-05-02. Full archive: [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md).
- ✅ **v1.4 Slot Correctness + Polish** — Phases 25-27 (8 plans across 3 phases) — shipped 2026-05-03. Full archive: [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md).
- ✅ **v1.5 Buffer Fix + Audience Rebrand + Booker Redesign** — Phases 28-30 (6 plans across 3 phases) — shipped 2026-05-05. Full archive: [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md).
- ✅ **v1.6 Day-of-Disruption Tools** — Phases 31-33 (10 plans, 3 phases) — shipped 2026-05-06. Full archive: [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md).
- ✅ **v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code** — Phases 34-40 (32 plans across 7 phases) — shipped 2026-05-09. Full archive: [`milestones/v1.7-ROADMAP.md`](./milestones/v1.7-ROADMAP.md).
- 🚧 **v1.8 Stripe Paywall + Login UX Polish** — Phases 41-46 + inserted 42.5 + 42.6 (Phases 41 + 42.5 + 42.6 + 43 shipped 2026-05-10..11; Phase 42 plumbing code-complete with UI superseded by 42.5; 44-46 in progress).

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-9) — SHIPPED 2026-04-27</summary>

See [`milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) for full phase details.

- [x] Phase 1: Foundation — completed 2026-04-19
- [x] Phase 2: Owner Auth + Dashboard Shell — completed 2026-04-24
- [x] Phase 3: Event Types CRUD — completed 2026-04-24
- [x] Phase 4: Availability Engine — completed 2026-04-25
- [x] Phase 5: Public Booking Flow + Email + .ics — completed 2026-04-25
- [x] Phase 6: Cancel + Reschedule Lifecycle — completed 2026-04-25
- [x] Phase 7: Widget + Branding — completed 2026-04-26
- [x] Phase 8: Reminders + Hardening + Dashboard List — completed 2026-04-27
- [x] Phase 9: Manual QA & Verification — completed 2026-04-27 ("ship v1")

</details>

<details>
<summary>✅ v1.1 Multi-User + Capacity + Branded UI (Phases 10-13) — SHIPPED 2026-04-30</summary>

See [`milestones/v1.1-ROADMAP.md`](./milestones/v1.1-ROADMAP.md) for full phase details.

- [x] Phase 10: Multi-User Signup + Onboarding (9 plans) — code complete 2026-04-28
- [x] Phase 11: Booking Capacity + Double-Booking Root-Cause Fix (8 plans) — code complete 2026-04-29
- [x] Phase 12: Branded UI Overhaul (5 Surfaces) (7 plans) — code complete 2026-04-29
- [x] Phase 12.5: Per-Account Heavy Chrome Theming (INSERTED) (4 plans) — code complete 2026-04-29 (deprecated in code by 12.6; DB columns retained)
- [x] Phase 12.6: Direct Per-Account Color Controls (INSERTED) (3 plans) — code complete 2026-04-29 (Andrew live Vercel approval)
- [x] Phase 13: Manual QA + Andrew Ship Sign-Off (3 plans) — closed 2026-04-30 (Plan 13-01 complete; 13-02 + 13-03 closed-by-waiver; QA-09..13 deferred to v1.3)

</details>

<details>
<summary>✅ v1.2 NSI Brand Lock-Down + UI Overhaul (Phases 14-21) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.2-ROADMAP.md`](./milestones/v1.2-ROADMAP.md) for full phase details.

- [x] Phase 14: Typography + CSS Token Foundations (1 plan) — completed 2026-04-30
- [x] Phase 15: BackgroundGlow + Header Pill + Owner Shell Re-Skin (2 plans) — completed 2026-04-30
- [x] Phase 16: Auth + Onboarding Re-Skin (4 plans) — completed 2026-04-30
- [x] Phase 17: Public Surfaces + Embed (9 plans) — completed 2026-04-30
- [x] Phase 18: Branding Editor Simplification (3 plans) — completed 2026-05-01
- [x] Phase 19: Email Layer Simplification (1 plan) — completed 2026-05-01
- [x] Phase 20: Dead Code + Test Cleanup (1 plan) — completed 2026-05-01
- [x] Phase 21: Schema DROP Migration (1 plan) — completed 2026-05-02

</details>

<details>
<summary>✅ v1.3 Bug Fixes + Polish (Phases 22-24) — SHIPPED 2026-05-02</summary>

See [`milestones/v1.3-ROADMAP.md`](./milestones/v1.3-ROADMAP.md) for full phase details.

- [x] Phase 22: Auth Fixes (2 plans) — completed 2026-05-02
- [x] Phase 23: Public Booking Fixes (2 plans) — completed 2026-05-02
- [x] Phase 24: Owner UI Polish (2 plans) — completed 2026-05-02 (Andrew live deploy approved)

</details>

<details>
<summary>✅ v1.4 Slot Correctness + Polish (Phases 25-27) — SHIPPED 2026-05-03</summary>

See [`milestones/v1.4-ROADMAP.md`](./milestones/v1.4-ROADMAP.md) for full phase details.

- [x] Phase 25: Surgical Polish (2 plans) — completed 2026-05-03 (AUTH-21, AUTH-22, OWNER-14, OWNER-15)
- [x] Phase 26: Bookings Page Crash Debug + Fix (3 plans) — completed 2026-05-03 (BOOK-01, BOOK-02; root cause RSC boundary violation)
- [x] Phase 27: Slot Correctness DB-Layer Enforcement (3 plans) — completed 2026-05-03 (SLOT-01..05; EXCLUDE constraint live; Andrew smoke approved)

</details>

<details>
<summary>✅ v1.5 Buffer Fix + Audience Rebrand + Booker Redesign (Phases 28-30) — SHIPPED 2026-05-05</summary>

See [`milestones/v1.5-ROADMAP.md`](./milestones/v1.5-ROADMAP.md) for full phase details.

- [x] Phase 28: Per-Event-Type Buffer + Account Column Drop (3 plans) — completed 2026-05-04 (BUFFER-01..06 shipped; CP-03 DROP completed with drain waiver)
- [x] Phase 29: Audience Rebrand (1 plan) — completed 2026-05-04 (BRAND-01..03 shipped; canonical grep gate clean)
- [x] Phase 30: Public Booker 3-Column Desktop Layout (2 plans) — completed 2026-05-05 (BOOKER-01..05 shipped; Andrew live-verified at 1024/1280/1440 + mobile)

</details>

<details>
<summary>✅ v1.6 Day-of-Disruption Tools (Phases 31-33) — SHIPPED 2026-05-06</summary>

See [`milestones/v1.6-ROADMAP.md`](./milestones/v1.6-ROADMAP.md) for full phase details.

- [x] Phase 31: Email Hard Cap Guard (3 plans) — completed 2026-05-05 (Andrew live verification approved)
- [x] Phase 32: Inverse Date Overrides (3 plans) — completed 2026-05-05 (Andrew live verification approved 8/8 scenarios)
- [x] Phase 33: Day-Level Pushback Cascade (4 plans) — completed 2026-05-06 (Andrew live-verified all 8 scenarios; PUSH-10 gap closed by orchestrator commit `2aa9177`; verifier re-passed)

</details>

<details>
<summary>✅ v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code (Phases 34-40) — SHIPPED 2026-05-09</summary>

See [`milestones/v1.7-ROADMAP.md`](./milestones/v1.7-ROADMAP.md) for full phase details.

- [x] Phase 34: Google OAuth Signup + Credential Capture (4 plans) — completed 2026-05-06
- [x] Phase 35: Per-Account Gmail OAuth Send (7 plans) — completed 2026-05-08 (with linkIdentity→direct-OAuth + SMTP→REST API pivots; see 35-DEVIATION-DIRECT-OAUTH.md)
- [x] Phase 36: Resend Backend for Upgraded Accounts (3 plans) — framework completed 2026-05-08 (live activation gated on PREREQ-03)
- [x] Phase 37: Upgrade Flow + In-App Cap-Hit UI (3 plans) — framework completed 2026-05-08 (live Resend delivery gated on PREREQ-03)
- [x] Phase 38: Magic-Link Login (3 plans) — completed 2026-05-08 (Andrew live-verified A/B/C/D)
- [x] Phase 39: BOOKER Polish (3 plans) — completed 2026-05-08 (Andrew live-verified animation + skeleton + reduced-motion + V15-MP-05 lock)
- [x] Phase 40: Dead-Code Audit (9 plans) — completed 2026-05-09 (knip 6.12.1; 1 file + 3 deps + 22 exports removed; CI gate landed; final QA all PASS)

</details>

<details>
<summary>🚧 v1.8 Stripe Paywall + Login UX Polish (Phases 41-46) — IN PROGRESS</summary>

**Milestone Goal:** Convert the free single-tenant tool into a paid multi-tenant SaaS with **three tiers**: Basic (full app except booking widget), Widget (full current app capability), and Branding (consult CTA — non-Stripe, links to NSI booking page for personal onboarding). Owners get a 14-day free trial of the Widget tier from first signup; after expiry the owner app (`/app/*`) locks behind a paywall and owner picks a tier on the 3-card billing page. The public booker (`/[account]/*`) remains fully functional regardless of any account's payment state. Login UX is polished independently of billing.

**Tier model (locked as of 2026-05-10):**
- **Basic** (Stripe) — Everything in `/app/*` except booking widget. 1 Product, 2 Prices (monthly + annual).
- **Widget** (Stripe) — Everything currently built. Same Product as Basic, 2 different Prices. *Default trial tier.*
- **Branding** (non-Stripe) — Consult CTA. Links to `https://booking.nsintegrations.com/nsi/branding-consultation`. No DB state change, no `plan_tier` value. Personal onboarding by Andrew. Build-out is post-v1.8.

**Manual prerequisites Andrew must complete before specific phases:**
- **PREREQ-A** — Create Stripe account *(blocks Phase 41 deploy)* ✅
- **PREREQ-B** *(revised 2026-05-10)* — Create ONE Product with **four Prices** in Stripe dashboard: Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual. Capture all 4 Price IDs *(blocks Phase 42.5)*
- **PREREQ-C** — Configure Customer Portal in Stripe dashboard (cancel-at-period-end, plan switching across all 4 Prices, invoice history, payment-method updates) *(blocks Phase 44)*
- **PREREQ-D** *(revised 2026-05-10)* — Add env vars to Vercel: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_BASIC_MONTHLY`, `STRIPE_PRICE_ID_BASIC_ANNUAL`, `STRIPE_PRICE_ID_WIDGET_MONTHLY`, `STRIPE_PRICE_ID_WIDGET_ANNUAL`, `STRIPE_PRICE_BASIC_MONTHLY_CENTS`, `STRIPE_PRICE_BASIC_ANNUAL_CENTS`, `STRIPE_PRICE_WIDGET_MONTHLY_CENTS`, `STRIPE_PRICE_WIDGET_ANNUAL_CENTS`, `NSI_BRANDING_BOOKING_URL`; verify `NEXT_PUBLIC_APP_URL` exists *(blocks Phase 42.5 deploy)*
- **PREREQ-E** *(revised 2026-05-10)* — Decide pricing amounts for all 4 SKUs (Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual) *(blocks Phase 42.5 final numbers; placeholders work for development)*
- **PREREQ-F** — Register Stripe webhook endpoint after Phase 41 deploys; capture `whsec_...` *(required before Phase 41 live test)* ✅
- **PREREQ-G** *(new 2026-05-10)* — Verify webhook `enabled_events` includes `checkout.session.completed` (Phase 42-02 needs it; Phase 41 only registered 6 events) *(blocks Phase 42.5 UAT)*

---

### Phase 41: Stripe SDK + Schema + Webhook Skeleton

**Goal:** The billing foundation exists in the database and a working (log-only) webhook handler is live in production — no payment UI yet, but every subsequent phase can build on this without DB migration surprises.

**Depends on:** Phase 40 (last v1.7 phase) + PREREQ-A + PREREQ-D (test-mode keys minimum). PREREQ-F required after deploy for live webhook test.

**Requirements:** BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08

**Success Criteria** (what must be TRUE when this phase ships):
1. The `accounts` table has the 6 new billing columns (`stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`, `current_period_end`, `plan_interval`) and all existing v1.7 accounts have `subscription_status = 'trialing'` and `trial_ends_at = deploy_time + 14 days` (not `created_at + 14 days`).
2. A new `stripe_webhook_events` table exists with `stripe_event_id text PRIMARY KEY` for idempotency.
3. New account signups via the `provision_account_for_new_user` trigger automatically receive `subscription_status = 'trialing'` and `trial_ends_at = NOW() + 14 days`.
4. `POST /api/stripe/webhook` verifies the Stripe signature (`req.text()` raw-body pattern), deduplicates events via `ON CONFLICT DO NOTHING`, and correctly routes all 6 lifecycle events to `accounts` column updates — verified by replaying a duplicate event ID and confirming only one DB write occurs.
5. Sending a test `customer.subscription.updated` event via Stripe CLI results in the correct `subscription_status` and `current_period_end` values written to the `accounts` row.

**Verification gates (not requirements — pre-merge checks):**
- Webhook idempotency: replay duplicate `stripe_event_id` → confirms `stripe_webhook_events` has exactly 1 row and `accounts` was updated exactly once (V18-CP-02 check).
- Existing-account grandfather: Andrew's `nsi` test account has `subscription_status = 'trialing'` and `trial_ends_at` approximately 14 days from deploy time after migration runs (V18-CP-06 check).

**Plans:** 4 plans

- [x] 41-01-stripe-sdk-and-client-PLAN.md — Install stripe@22.1.1 + create lib/stripe/client.ts singleton (apiVersion 2026-04-22.dahlia) ✓ shipped 2026-05-10
- [x] 41-02-billing-schema-migration-PLAN.md — Single-transaction migration: 7 columns on accounts + stripe_webhook_events table + trigger update + grandfather backfill ✓ shipped 2026-05-10 (5 existing accounts grandfathered to trialing with trial_ends_at = 2026-05-24)
- [x] 41-03-webhook-route-handler-PLAN.md — POST /api/stripe/webhook with raw-body signature verify, dedupe upsert, atomic per-event UPDATEs, dedupe-rollback on DB failure ✓ shipped 2026-05-10 (291 lines; adapted to apiVersion 2026-04-22.dahlia type changes)
- [x] 41-04-end-to-end-verification-PLAN.md — PREREQ-F handoff + idempotency proof + nsi canary + bad-signature curl + Andrew sign-off ✓ shipped 2026-05-10 (Stripe-CLI workaround for v2-only Dashboard UI; SC-5 deferred to Phase 42 first-checkout natural exercise)

---

### Phase 42: Checkout Flow Plumbing (single-tier — UI superseded by 42.5)

**Status:** Code-complete 2026-05-10. UI/UAT superseded by Phase 42.5 multi-tier expansion.

**Goal (original):** An owner can visit `/app/billing`, choose monthly or annual billing, and complete a Stripe Checkout session — arriving back in the app with `subscription_status = 'active'` once the webhook confirms payment.

**Outcome:** Plumbing landed correctly (customer linkage, webhook safety net, no-store polling, return flow), but the single-tier UI does not match the actual product surface decided after Phase 42-03 shipped. Phase 42.5 refactors `prices.ts`, the checkout route body, and the billing page UI to support 3 tiers. The Phase 42 plumbing files (`lib/stripe/prices.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/checkout/status/route.ts`, the webhook `checkout.session.completed` handler, and the `/app/billing` Server Component shell) are reused and extended — none thrown away.

**Depends on:** Phase 41 ✅

**Requirements:** BILL-09 (partial — checkout route exists), BILL-10 ✅ (webhook handler), BILL-11 ✅ (status poller); BILL-09 full closure deferred to Phase 42.5 (3-tier UI).

**Plans:** 4 plans

- [x] 42-01-PLAN.md — Backend: prices config + POST /api/stripe/checkout + GET /api/stripe/checkout/status ✓ shipped 2026-05-10
- [x] 42-02-PLAN.md — Webhook: checkout.session.completed handler (SC-5 safety net) ✓ shipped 2026-05-10
- [x] 42-03-PLAN.md — UI: /app/billing page + single plan selection card + return-flow poller ✓ shipped 2026-05-10 *(card to be replaced by 3-card TierGrid in 42.5)*
- [⊘] 42-04-PLAN.md — Manual QA + SC-5 sign-off **SUPERSEDED** by 42.5 UAT (single-tier UI never deployed/verified; multi-tier UAT replaces it)

---

### Phase 42.5: Multi-Tier Stripe + Schema (INSERTED 2026-05-10)

**Goal:** The `/app/billing` page presents three tier cards — Basic (Stripe), Widget (Stripe), Branding (consult CTA) — each Stripe card with a monthly/annual toggle. The `accounts` table has a new `plan_tier` column. The webhook derives `plan_tier` from the returned Price ID and writes it. A first-checkout end-to-end (any tier, any interval) lands `stripe_customer_id` + `stripe_subscription_id` + `plan_tier` + `subscription_status='active'` on the row.

**Depends on:** Phase 42 (plumbing) + PREREQ-B (revised — 4 Price IDs) + PREREQ-D (revised — 10 env vars + `NSI_BRANDING_BOOKING_URL`) + PREREQ-E (revised — 4 pricing amounts) + PREREQ-G (webhook `checkout.session.completed` enabled).

**Requirements:** BILL-09 (full closure — 3-tier card), BILL-10b *(new — `plan_tier` column + webhook write)*, BILL-25 *(new — Branding consult CTA renders + links correctly)*

**Success Criteria** (what must be TRUE when this phase ships):
1. `accounts.plan_tier` column exists with CHECK constraint (`'basic'` | `'widget'`) + NULL allowed (trialing accounts before first checkout); all existing v1.7 grandfathered accounts have `plan_tier = NULL` and remain `trialing`.
2. `/app/billing` renders three side-by-side cards: Basic (Subscribe button), Widget (Subscribe button, marked "Most popular" or equivalent), Branding (link button styled distinctly from Subscribe). Each Stripe card has its own monthly/annual toggle (or one global toggle — designer's call; both are CONTEXT-compatible).
3. Branding card "Book a consultation" link points to `process.env.NSI_BRANDING_BOOKING_URL` (= `https://booking.nsintegrations.com/nsi/branding-consultation`). Click opens in same window. No POST, no API call, no DB state change.
4. `POST /api/stripe/checkout` accepts `{tier: 'basic' | 'widget', interval: 'monthly' | 'annual'}`; rejects `{tier: 'branding'}` with 400 `{error: 'use_consult_link'}`; rejects unknown tier with 400 `{error: 'unknown_tier'}`.
5. After completing Checkout in test mode for *any* (tier, interval) combination, the webhook writes the correct `plan_tier` ("basic" or "widget") onto the accounts row alongside the existing `stripe_subscription_id`, `subscription_status='active'`, `plan_interval`, `current_period_end` writes.
6. SC-5 carry-over from Phase 41 is closed: a real Stripe trigger has written to a real `accounts` row with all four billing columns populated.

**Verification gates (not requirements — pre-merge checks):**
- Card visual: all three cards visible without horizontal scroll at 1024px viewport.
- Tier inference: webhook resolves `plan_tier` by matching `session.line_items[0].price.id` against the 4-SKU map in `lib/stripe/prices.ts` (not by reading metadata, not by hardcoding).
- Trial defaults: new signups still get `trialing` + `trial_ends_at = NOW()+14d` + `plan_tier = NULL`; column defaulting to NULL doesn't break the trigger.

**Plans:** 6 plans

- [x] 42.5-01-PLAN.md — Schema migration: add accounts.plan_tier column with CHECK constraint ✓ shipped 2026-05-10
- [x] 42.5-02-PLAN.md — Refactor lib/stripe/prices.ts to 4-SKU map + helpers + .env.local.example update ✓ shipped 2026-05-10
- [x] 42.5-03-PLAN.md — Checkout route accepts {tier, interval}; rejects branding + unknown tier ✓ shipped 2026-05-10
- [x] 42.5-04-PLAN.md — Webhook derives plan_tier via listLineItems and writes to accounts ✓ shipped 2026-05-10
- [x] 42.5-05-PLAN.md — Replace PlanSelectionCard with 3-card TierGrid + Branding consult link ✓ shipped 2026-05-10
- [x] 42.5-06-PLAN.md — Manual QA / UAT: end-to-end SC-1..SC-6 with real Stripe test mode ✓ Andrew approved 2026-05-10

---

### Phase 42.6: Widget Feature Gating (INSERTED 2026-05-10)

**Goal:** The booking widget (`/embed/[account]/[slug]` public render + the owner-side embed-code page) is gated by `account.plan_tier === 'widget'`. Basic-tier accounts see an "Upgrade to Widget" prompt where the widget would have appeared and cannot generate working embed codes. Widget-tier and `trialing` accounts retain current behavior.

**Depends on:** Phase 42.5 (`plan_tier` column must exist + be written by webhook).

**Requirements:** BILL-26 *(new — `/embed/...` route gated by plan_tier)*, BILL-27 *(new — owner embed-code page gated by plan_tier)*

**Success Criteria** (what must be TRUE when this phase ships):
1. A server helper `requireWidgetTier(account)` returns `{ allowed: true }` when `plan_tier === 'widget'` OR `subscription_status === 'trialing'`; otherwise returns `{ allowed: false, reason: 'basic_tier' | 'no_subscription' }`.
2. `/embed/[account]/[slug]` public route: when the account's owner has `plan_tier === 'basic'` and a non-`trialing` subscription, the route renders a small "This booking widget is no longer available" message (NOT a full 404, NOT a redirect — must not break iframes silently). When the account is `trialing` or `plan_tier === 'widget'` (or `active`+widget), renders the booker normally.
3. Owner-side embed-code page (the existing settings/widget page wherever it lives in `/app/*`): for Basic-tier owners, replaces the embed code with an "Upgrade to Widget" card linking to `/app/billing`. For Widget/trialing owners, shows the embed code as today.
4. Booker route under `/{account}/{slug}` (non-embedded direct visit) is NOT gated — it works regardless of tier (it's the booker, not the widget).
5. Existing `trialing` accounts (the 5 v1.7 grandfathered + any new signups during trial) experience zero feature change while in trial.

**Verification gates (not requirements — pre-merge checks):**
- Booker neutrality (LD-07 invariant extension): `/{account}/{slug}` returns 200 regardless of `plan_tier`.
- Trial-to-Basic regression: an account that trials, expires, then subscribes to Basic has working `/[account]/{slug}` but a gated `/embed/...` — verified end-to-end in the UAT.
- Iframe degradation: when an existing third-party page has embedded a Basic-tier account's widget, the iframe loads (200 not 404) and displays the gated message — not a broken X icon.

**Plans:** 3 plans

- [x] 42.6-01-PLAN.md — requireWidgetTier helper + unit tests (Wave 1) ✓ shipped 2026-05-11
- [x] 42.6-02-PLAN.md — Gate /embed/* public route + EmbedGatedMessage component (Wave 2) ✓ shipped 2026-05-11
- [x] 42.6-03-PLAN.md — Gate owner embed-code dialog (prop threading + upgrade card) (Wave 2) ✓ shipped 2026-05-11

---

### Phase 43: Paywall Enforcement + Locked-State UX + Trial Banners

**Goal:** The middleware enforces subscription gating: trialing and active owners have full `/app/*` access with an appropriate banner; expired/canceled/unpaid owners are redirected to `/app/billing`; past_due owners see a banner but retain access; the public booker is structurally unaffected.

**Depends on:** Phase 42 + Phase 42.5 (`/app/billing` 3-card UI must exist before middleware can redirect locked owners there). Tier is irrelevant to the paywall gate — paywall is tier-agnostic per the v1.8 milestone goal.

**Requirements:** BILL-12, BILL-13, BILL-14, BILL-15, BILL-16, BILL-17, BILL-18, BILL-19, BILL-20

**Success Criteria** (what must be TRUE when this phase ships):
1. An owner whose `subscription_status = 'trialing'` and `trial_ends_at` is more than 3 days away sees a neutral trial banner on every `/app/*` page and has full access to all app features.
2. An owner whose trial expires in 3 days or fewer sees a visually distinct (color/copy-intensified) urgency banner on every `/app/*` page.
3. An owner whose `subscription_status` is not `trialing` or `active` (e.g., `canceled`, `unpaid`) is redirected to `/app/billing` for any `/app/*` path — and `/app/billing` itself loads without redirect loop, showing the "Everything is waiting for you! Head over to payments to get set up." message with the 3-tier card grid (Basic + Widget Stripe cards + Branding consult card).
4. An owner whose `subscription_status = 'past_due'` can reach all `/app/*` pages normally and sees only a non-blocking banner indicating payment retry is in progress — they are NOT redirected.
5. An unauthenticated GET to any `/{account}/{slug}` public booker URL returns HTTP 200 and renders the booking page normally — the paywall middleware has no effect on public routes.

**Verification gates (not requirements — mandatory pre-merge checks):**
- LD-07 booker-neutrality: unauthenticated GET to `/{account}/{slug}` asserts 200, not 302 (V18-CP-05 check).
- Existing-account grandfather: Andrew's `nsi` test account is NOT locked out on deploy day — it has `subscription_status = 'trialing'` from the Phase 41 migration (V18-CP-06 check).
- Redirect loop prevention: a locked account navigating directly to `/app/billing` gets the locked-state card, not an infinite redirect.
- `past_due` is NOT a lockout trigger: confirm `past_due` account reaches `/app/dashboard` (V18-CP-07 check).

**Plans:** 2 plans

- [x] 43-01-PLAN.md — Middleware subscription gate in `lib/supabase/proxy.ts` (BILL-12, BILL-13, BILL-14, BILL-15, BILL-20) ✓ shipped 2026-05-11
- [x] 43-02-PLAN.md — Shell layout query expansion + `SubscriptionBanner` server component for trial neutral/urgent + past-due (BILL-16, BILL-17, BILL-18) ✓ shipped 2026-05-11

**Post-merge corrections (committed during live verification):**
- `fb909f9` fix(43): SubscriptionBanner moved inside `<main>` to inherit `pt-20 md:pt-24` header clearance — fixed Header was hiding the banner
- `b9fa84e` feat(43): Billing entry added to sidebar nav (Phase 42.5 shipped `/app/billing` without a nav entry)
- Migration applied to live DB: `phase42_5_plan_tier` (Phase 42.5-01 column was never registered in `schema_migrations` and never reached production — public booker `/[account]/[event-slug]` was returning 404 to all customers because shared loader selects `plan_tier`. Applied during Phase 43 UAT.)

---

### Phase 44: Customer Portal + Billing Settings Polish + Stripe-Triggered Emails

**Goal:** A subscribed owner can manage their subscription (cancel, update payment method, view invoices, switch plan interval) entirely through the Stripe Customer Portal with one click from `/app/billing`. Stripe lifecycle events trigger transactional emails through the existing `getSenderForAccount` factory.

**Depends on:** Phase 41 (webhook handler — email dispatch wired to subscription events) + Phase 42.5 (`/app/billing` 3-card UI exists with `plan_tier` data path) + PREREQ-C (Customer Portal configured in Stripe dashboard — must enable plan-switching across all 4 Prices since they live on one Product).

**Requirements:** BILL-21, BILL-22, BILL-23, BILL-24

**Success Criteria** (what must be TRUE when this phase ships):
1. An owner with an active subscription sees a "Manage subscription" button on `/app/billing`; clicking it redirects to the Stripe Customer Portal (stripe.com) — no custom cancel/invoice/payment-update UI exists in the app.
2. Canceling through the Customer Portal sets `cancel_at_period_end = true`; the owner retains access through the end of the paid period and only loses access after `subscription_status` transitions to `canceled` via webhook.
3. When a `customer.subscription.trial_will_end` event fires (3 days before trial expiry), the owner receives a transactional email routed through `getSenderForAccount(accountId)`.
4. When a `invoice.payment_failed` event fires, the owner receives a payment-failed transactional email routed through `getSenderForAccount(accountId)`.

**Verification gates (not requirements — pre-merge checks):**
- Customer Portal URL is never logged server-side (V18-CP-09 check).
- `cancel_at_period_end` behavior verified: owner retains access after clicking cancel until period end (BILL-23 check).

**Plans:** 5 plans

- [ ] 44-01-PLAN.md — Schema migration: add accounts.cancel_at_period_end column (Wave 1)
- [ ] 44-02-PLAN.md — Email senders: send-trial-ending-email.ts + send-payment-failed-email.ts (Wave 1)
- [ ] 44-03-PLAN.md — Stripe Customer Portal route: POST /api/stripe/portal (Wave 1)
- [ ] 44-04-PLAN.md — Webhook integration: cancel_at_period_end write + trial-ending + payment-failed email dispatch (Wave 2)
- [ ] 44-05-PLAN.md — Billing page Status Card + state-aware rendering (active / cancel_scheduled / past_due) (Wave 2)

**Planner notes:** see 44-00-PLANNER-NOTES.md for BILL-24 partial-closure traceability (2 of 4 emails per CONTEXT.md scope narrowing), PREREQ-C blocking gate (Customer Portal config), and LD-11 sender identity reality.

---

### Phase 45: Login UX Polish + Gmail Quota Raise

**Goal:** The login and signup forms have Google OAuth below the primary form (not above); the password tab is the default; three consecutive failed password attempts surface an inline magic-link nudge; the magic-link tab shows a uniform helper line for all users; Gmail send quota raises to 400/day.

**Depends on:** Nothing — fully independent of Phases 41-44. Can be developed and merged in any order relative to billing phases; bundled here as the last code phase for QA efficiency.

**Requirements:** AUTH-33, AUTH-34, AUTH-35, AUTH-36, AUTH-37, AUTH-38, AUTH-39, EMAIL-35

**Success Criteria** (what must be TRUE when this phase ships):
1. On both `/app/login` and `/app/signup`, the Google OAuth button appears below the email/password form card, not above it.
2. The `/app/login` page opens with the Password tab active by default (not the Magic-link tab).
3. After three consecutive failed password-authentication attempts (HTTP 400 auth-rejection responses only) in the same tab session, an inline prompt appears under the password form offering to switch to the magic-link tab — clicking it switches the tab.
4. The failure counter resets to zero on successful login and on tab/window close; it does NOT advance on network errors or 5xx server errors; it does NOT persist in `localStorage` or `sessionStorage`.
5. The magic-link tab shows an inline helper line under the email field; the helper line wording is byte-identical regardless of whether the entered email is known, unknown, rate-limited, or in Supabase's OTP cooldown — preserving the AUTH-29 four-way enumeration-safety invariant.
6. `lib/email-sender/quota-guard.ts` daily quota constant is 400 (raised from 200); the 80% warning threshold is 320; the change is a single constant update with no per-caller branching.

**Verification gates (not requirements — mandatory pre-merge checks):**
- AUTH-29 four-way invariant: submit known email and unknown email to magic-link tab; assert byte-identical DOM response for both (V18-MP-03 check).
- V15-MP-05 Turnstile lifecycle: the Turnstile widget mounts exactly once per page load through Password ↔ Magic-link tab switching — no remount, no extra token fetches.
- 3-fail counter: verify counter advances ONLY on auth-rejection (400 from Supabase), NOT on network error or 5xx.

**Plans:** TBD

- [ ] 45-01: TBD
- [ ] 45-02: TBD

---

### Phase 46: Andrew Ship Sign-Off

**Goal:** Andrew live-verifies the full v1.8 Stripe paywall end-to-end in Stripe test mode and approves v1.8 as shipped. `FUTURE_DIRECTIONS.md` is updated to reflect v1.8 scope and known limitations.

**Depends on:** All of Phases 41-45 + 42.5 + 42.6.

**Requirements:** v1.8 ship sign-off (no discrete requirement IDs — this is the per-milestone Andrew approval gate per CLAUDE.md project-completion convention).

**Success Criteria** (what must be TRUE when this phase ships):
1. Andrew live-verifies the full trial → checkout → active → cancel → access-loss lifecycle in Stripe test mode on the production deployment.
2. Andrew live-verifies that the public booker at `/{nsi}/{slug}` loads and accepts a booking while the `nsi` account is in each subscription state (trialing, active, canceled).
3. Andrew live-verifies the login UX polish (Google button position, password-first tab, 3-fail nudge, magic-link helper).
4. `FUTURE_DIRECTIONS.md` is committed with v1.8 Known Limitations, Assumptions, Future Improvements, and Technical Debt sections updated.
5. Andrew issues explicit ship sign-off and v1.8 is tagged.

**Full QA checklist (sourced from PITFALLS.md Looks-Done-But-Isnt section):**
- Trial flow: new signup → 14-day trial counter correct; `nsi` test account NOT instantly locked
- Lockout: trial-expired account → redirected to `/app/billing`; `/app/billing` not redirect-looping
- Checkout (Basic + Widget, monthly + annual = 4 paths): plan selection → Stripe Checkout → return URL polling → `subscription_status = 'active'` with correct `plan_tier` written
- Branding card: CTA links to `booking.nsintegrations.com/nsi/branding-consultation`; no DB write
- Widget gating: Basic-tier account → `/embed/...` shows gated message; owner embed-code page shows upgrade CTA. Widget-tier or trialing account → both work normally.
- Customer Portal: "Manage subscription" button → Portal loads; cancel-at-period-end behavior confirmed; plan-switching across all 4 Prices visible
- `past_due`: non-blocking banner on `/app/*`; no redirect to `/app/billing`
- Reactivation: resubscribe after cancel → access restored after webhook fires
- Public booker: `/{account}/{slug}` returns 200 and works regardless of account subscription state
- Webhook idempotency: duplicate event ID replay → single DB write confirmed
- AUTH-29 four-way invariant: known + unknown email → byte-identical magic-link tab DOM
- V15-MP-05 Turnstile: tab-switch Password ↔ Magic-link → exactly 1 token fetch per page load
- 3-fail counter: advances on 400 auth-rejection only; not on network error / 5xx
- Gmail quota: `quota-guard.ts` constant is 400; 80% threshold is 320

**Plans:** TBD

- [ ] 46-01: TBD

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9 | v1.0 | 52 / 52 | ✅ Shipped | 2026-04-27 |
| 10-13 | v1.1 | 34 / 34 | ✅ Shipped | 2026-04-30 |
| 14-21 | v1.2 | 22 / 22 | ✅ Shipped | 2026-05-02 |
| 22-24 | v1.3 | 6 / 6 | ✅ Shipped | 2026-05-02 |
| 25-27 | v1.4 | 8 / 8 | ✅ Shipped | 2026-05-03 |
| 28-30 | v1.5 | 6 / 6 | ✅ Shipped | 2026-05-05 |
| 31-33 | v1.6 | 10 / 10 | ✅ Shipped | 2026-05-06 |
| 34 | v1.7 | 4 / 4 | ✅ Code complete — connect path superseded by Phase 35 direct-OAuth (commit `ab02a23`); signup path still uses original `/auth/google-callback` | 2026-05-06 |
| 35 | v1.7 | 7 / 7 | ✅ Shipped — verifier 5/5 PASS; SMTP singleton + `GMAIL_APP_PASSWORD` removed (commits `31db425`, `138cfb0`, `6aecfbb`). See `35-DEVIATION-DIRECT-OAUTH.md` for architecture pivots. | 2026-05-08 |
| 36 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 13/13 PASS; live activation requires PREREQ-03 (Resend domain DNS) per FUTURE_DIRECTIONS.md | 2026-05-08 |
| 37 | v1.7 | 3 / 3 | ✅ Framework shipped — verifier 4/4 PASS; live Resend delivery requires PREREQ-03 (same gate as Phase 36) | 2026-05-08 |
| 38 | v1.7 | 3 / 3 | ✅ Shipped — verifier 19/19 PASS; Andrew live-verified A/B/C/D against production (`booking.nsintegrations.com`); two non-blocking deviations captured (Site URL fix, Supabase inner-cooldown observation) | 2026-05-08 |
| 39 | v1.7 | 3 / 3 | ✅ Shipped — verifier 4/4 PASS; Andrew live-verified all three checkpoints (key-prop removal, skeleton, animation+reduced-motion) on production | 2026-05-08 |
| 40 | v1.7 | 9 / 9 | ✅ Shipped — knip 6.12.1; 27 REMOVE / 53 KEEP; 4 atomic chore commits (deps `14fb48c`, dups n/a, exports `1cbb273`, files `2a1b665`); CI gate `d94ca07`; final QA all PASS `c42529d` | 2026-05-09 |
| 41 | v1.8 | 4 / 4 | ✅ Shipped — verifier passed; SC-1..4 verified live; SC-5 deferred to Phase 42.5 first-checkout natural exercise; Andrew sign-off received | 2026-05-10 |
| 42 | v1.8 | 3 / 4 | ⚠ Plumbing code-complete (42-01/02/03 shipped, 15 commits); UI superseded by 42.5; 42-04 UAT replaced by 42.5 UAT | 2026-05-10 (partial) |
| 42.5 | v1.8 | 6 / 6 | ✅ Shipped — verifier 6/6 SC + 3/3 gates PASS; Andrew UAT sign-off; closes BILL-09 (full) + BILL-10b + BILL-25; Phase 41 SC-5 carry-over closed | 2026-05-10 |
| 42.6 | v1.8 | 3 / 3 | ✅ Shipped — verifier 5/5 SC + 3/3 gates PASS (static); Andrew live walkthrough sign-off; closes BILL-26 + BILL-27 | 2026-05-11 |
| 43 | v1.8 | 2 / 2 | ✅ Shipped — verifier 9/9 SC + 4/4 gates PASS (static); Andrew live-verified all 7 scenarios; 2 post-merge fixes (banner positioning, sidebar nav) + 1 production migration applied during UAT (`plan_tier` column — fixed booker outage) | 2026-05-11 |
| 44 | v1.8 | 0 / 5 | Planned — 5 plans across 2 waves; blocked on PREREQ-C (Customer Portal config) | - |
| 45 | v1.8 | 0 / TBD | Not started | - |
| 46 | v1.8 | 0 / TBD | Not started | - |

## Cumulative Stats

- **Total milestones shipped:** 7 (v1.0 → v1.7)
- **Total phases shipped:** 40 (Phases 1-9 + 10/11/12/12.5/12.6/13 + 14-21 + 22-24 + 25-27 + 28-30 + 31-33 + 34-40)
- **Total plans shipped:** 170 (52 + 34 + 22 + 6 + 8 + 6 + 10 + 32)
- **Total commits:** ~692 (222 v1.0 + 135 v1.1 + 91 v1.2 + 34 v1.3 + 50 v1.4 + 31 v1.5 + 53 v1.6 + 129 v1.7)
- **v1.8 in progress:** Phases 41 + 42.5 + 42.6 shipped 2026-05-10..11 (4 + 6 + 3 plans); Phase 42 plumbing shipped 3/4 (UI superseded by 42.5); phases 43/44/45/46 remain

---

*Roadmap last updated: 2026-05-11 — Phase 43 SHIPPED. Verifier 9/9 SC + 4/4 gates PASS (static); Andrew live-verified all 7 scenarios on production. Closes BILL-12..BILL-20. Two post-merge fixes during UAT: `fb909f9` (banner positioning — moved inside `<main>` to clear fixed Header) + `b9fa84e` (Billing entry added to sidebar nav, top-level CreditCard icon — Phase 42.5 had shipped `/app/billing` without a nav entry). One production database fix applied during UAT: `phase42_5_plan_tier` migration (Phase 42.5-01 column was never registered in `schema_migrations` and never reached production — public booker `/[account]/[event-slug]` was returning 404 to all customers because shared loader selects `plan_tier`. Outage resolved by MCP `apply_migration`). Plan commits: `d559305`, `1fbbaab` (43-01); `fd59b7d`, `3ca0868`, `e1f35c2` (43-02). Next: Phase 44 (Customer Portal + Billing Polish + Stripe Emails) unblocked, plus Phase 45 (Login UX Polish) which is fully independent and can develop in parallel.*

*Prior: 2026-05-11 — Phase 42.6 SHIPPED. Verifier 5/5 SC + 3/3 gates PASS (static); Andrew live walkthrough sign-off. Closes BILL-26 (`/embed/*` route gated by `plan_tier`) + BILL-27 (owner embed-code dialog gated by `plan_tier`). 12 atomic commits across Wave 1 (`61b65ba`, `a4fbe27`) + Wave 2 (`57a8bce`, `596bd56`, `82502d4`, `eac0e41`, `6e826c8`, `0a1b647`, `3b8df3f`, `734d31a`). Next: Phase 43 (Paywall Enforcement + Locked-State UX + Trial Banners) unblocked.*

*Prior: 2026-05-10 — Phase 42.5 SHIPPED. Verifier 6/6 SC + 3/3 gates PASS; Andrew UAT sign-off received. Closes BILL-09 (full), BILL-10b (new — `accounts.plan_tier` column + webhook write), BILL-25 (new — Branding consult CTA via `NSI_BRANDING_BOOKING_URL`). Phase 41 SC-5 carry-over OFFICIALLY CLOSED — Tests 5a (Basic-Monthly) + 5b (Widget-Annual) each independently proved a real Stripe trigger lands all 4 billing columns. Commits: `e890334` (42.5-01 schema), `6238b3e`+`185b2d0`+`637bbf2` (42.5-02 prices), `39054a8`+`9c8e42b` (42.5-03 checkout), `1d9aac3`+`0a1ae5d` (42.5-04 webhook), `74e1d91`+`a7db58c`+`53646eb` (42.5-05 TierGrid UI), `5e493b1`+`8178344` (42.5-06 UAT). Next: Phase 42.6 (Widget Feature Gating — BILL-26 + BILL-27) unblocked. Phase 43 (Paywall Enforcement) also unblocked and can develop in parallel.*
