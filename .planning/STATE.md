# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-10 — Phase 42.5 SHIPPED. Plan 42.5-06 UAT closed via Andrew's verbal "approved" sign-off in chat. UAT.md frontmatter flipped to `status: passed`, `completed_at: 2026-05-10`, `signoff_by: Andrew`. All 6 SCs (SC-1 plan_tier column + CHECK; SC-2 3-card TierGrid render; SC-3 Branding consult link with no POST; SC-4 `{tier, interval}` validation incl. `use_consult_link`/`unknown_tier`/auth-precedence; SC-5 webhook plan_tier write — Basic-Monthly + Widget-Annual end-to-end; SC-6 Phase 41 SC-5 carry-over derived pass), all 3 verification gates (1024px no-scroll; tier inference via `priceIdToTier(listLineItems)` not metadata; trial defaults unchanged), and all regression checks accepted. **Phase 41 SC-5 carry-over is OFFICIALLY CLOSED** — Test 5a (Basic-Monthly) + Test 5b (Widget-Annual) each independently proved a real Stripe trigger lands all 4 billing columns (`stripe_customer_id`, `stripe_subscription_id`, `plan_tier`, `subscription_status`) on a real accounts row. Per-SC evidence rows in 42.5-UAT.md remain blank by design — Andrew owns audit-trail backfill in his own copy if needed (verbal-signoff pattern). Phase 42.5 closes BILL-09 (full closure of paywall checkout flow), BILL-10b (new — `accounts.plan_tier` column + webhook write), and BILL-25 (new — Branding consultation CTA via `NSI_BRANDING_BOOKING_URL` same-window navigation). Next: Phase 42.6 (Widget Feature Gating — BILL-26 + BILL-27) is unblocked and ready to research/plan.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (3-tier model). Phase 41 shipped 2026-05-10. Phase 42 plumbing code-complete 2026-05-10. Phase 42.5 (Multi-Tier Stripe + Schema) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 42.5 of 46 (+ inserted 42.5/42.6) — **COMPLETE** (Wave 4 UAT signed off by Andrew 2026-05-10)
**Plan:** 42.5-01..42.5-06 all complete; next phase = 42.6 Widget Feature Gating
**Status:** Phase 42.5 SHIPPED. Plan 42.5-06 UAT closed via Andrew's verbal "approved" sign-off in chat. `42.5-UAT.md` frontmatter flipped to `status: passed` / `completed_at: 2026-05-10` / `signoff_by: Andrew` (per-SC evidence rows intentionally left blank — verbal-signoff pattern, Andrew owns backfill if audit trail needed). All 6 SCs accepted (SC-1 plan_tier column + CHECK constraint, SC-2 3-card TierGrid render, SC-3 Branding consult link with no POST, SC-4 `{tier, interval}` validation incl. `use_consult_link`/`unknown_tier`/auth-precedence, SC-5 webhook plan_tier write — Basic-Monthly + Widget-Annual end-to-end, SC-6 Phase 41 SC-5 carry-over derived pass). All 3 verification gates accepted (1024px no-scroll; tier inference via `priceIdToTier(listLineItems)` not metadata; trial defaults unchanged — new signups still get `subscription_status='trialing'` + `trial_ends_at ≈ NOW()+14d` + `plan_tier IS NULL`). All regression checks accepted (polling state machine identical to Phase 42; grandfathered v1.7 accounts see 3-card layout on trial expiry; booker `/{account}/{slug}` non-gated per LD-07/LD-17; webhook still middleware-exempt). **Phase 41 SC-5 carry-over OFFICIALLY CLOSED** — Tests 5a + 5b each independently proved a real Stripe trigger lands all 4 billing columns on a real accounts row. Phase 42.5 closes BILL-09 (full closure), BILL-10b (new — `accounts.plan_tier` column + webhook write), BILL-25 (new — Branding consult CTA). SUMMARY at `.planning/phases/42.5-multi-tier-stripe-and-schema/42.5-06-SUMMARY.md`.
**Last activity:** 2026-05-10 — Phase 42.5 shipped (multi-tier Stripe paywall foundation). Plan 42.5-06 UAT executed: scaffolded 42.5-UAT.md (Task 1, commit `5e493b1`), Andrew completed walkthrough offline and signaled "approved" in orchestrator chat (Task 2 checkpoint:human-verify), UAT.md frontmatter updated, SUMMARY committed.

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
v1.8 [-] Stripe Paywall + Login UX    (Phases 41-46, Phases 41 + 42.5 shipped 2026-05-10; phases 42.6/43/44/45/46 remain)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7) + Phase 41 of v1.8 = 41 phases, 174 plans, ~701 commits

## v1.8 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 41 | Stripe SDK + Schema + Webhook Skeleton | BILL-01..08 ✅ | ✅ Shipped 2026-05-10 |
| 42 | Checkout Flow Plumbing | BILL-09 (partial) + BILL-10/11 | ⚠ Code-complete 2026-05-10; 3/4 plans shipped; 42-04 UAT superseded by 42.5 |
| **42.5** | **Multi-Tier Stripe + Schema** (INSERTED) | BILL-09 (full) + BILL-10b + BILL-25 | ✅ Shipped 2026-05-10 |
| **42.6** | **Widget Feature Gating** (INSERTED) | BILL-26 + BILL-27 | Unblocked — ready to research/plan |
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
- ~~Phase 41 SC-5 carry-over (real Stripe trigger writes to real accounts row)~~ ✅ Closed by Phase 42.5 SC-5 Tests 5a + 5b on 2026-05-10
- ~~Phase 42.5 blocked on: PREREQ-B/D/E revised + PREREQ-G~~ ✅ Resolved 2026-05-10 (verified during UAT walkthrough)
- ~~Plan 42.5-04 blocked on Andrew running `npx supabase db push --linked`~~ ✅ Resolved 2026-05-10 (verified during UAT — webhook write of `plan_tier` exercised end-to-end in SC-5)
- Phase 44 blocked on: PREREQ-C (Customer Portal config — must enable plan-switching across all 4 Prices)

## Session Continuity

**Last session:** 2026-05-10 — Executed Plan 42.5-06 (UAT). Task 1 scaffolded `42.5-UAT.md` (commit `5e493b1`). Task 2 was a `checkpoint:human-verify` — Andrew ran the UAT walkthrough offline (live deploy with real Stripe test mode against the live Supabase project) and signaled "approved" in orchestrator chat. Updated UAT.md frontmatter (`status: passed`, `completed_at: 2026-05-10`, `signoff_by: Andrew`); per-SC evidence rows intentionally left blank (verbal-signoff pattern). Authored `42.5-06-SUMMARY.md`. Phase 42.5 is now SHIPPED — all 6 SCs + 3 gates + regression checks accepted; Phase 41 SC-5 carry-over closed by SC-5 Tests 5a + 5b.

**Stopped at:** Phase 42.5 ship-complete. Phase 42.6 (Widget Feature Gating, BILL-26 + BILL-27) is unblocked and ready to research/plan. Phase 43 (Paywall Enforcement) is also unblocked and can proceed in parallel with 42.6.

**Resume file:** None — next action is to begin Phase 42.6 research (`/gsd:research-phase 42.6`) or plan (`/gsd:plan-phase 42.6`) per Andrew's preference. Phase 43 may be sequenced before, after, or in parallel with 42.6.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
