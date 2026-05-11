# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-11 — Phase 42.6 Plan 03 (Wave 2, owner-side) COMPLETE. Gated the owner "Get embed code" dialog body on `plan_tier` via server-side `requireWidgetTier` in `event-types/page.tsx`, threading `isWidgetAllowed: boolean` through EventTypesTable → RowActionsMenu → EmbedCodeDialog. When `!isWidgetAllowed`, dialog renders a `<Card>` with "Upgrade to Widget" `<Link href="/app/billing">` in place of the embed snippets + preview iframe. "Get embed code" menu item remains visible/clickable for all tiers — only the dialog body is gated (CONTEXT decision). Page itself, Create-event-type button, edit/archive flows all remain accessible to Basic-tier owners. Defensive default `isWidgetAllowed=false` when account row is null. Plain `/app/billing` href, zero anchor fragments. No `requireWidgetTier` call in any client component — gate is server-only. `npm run build` ✓, `npx tsc --noEmit` zero new errors (pre-existing tests/ noise unchanged). Atomic commits: `6e826c8` (page gate), `0a1b647` (prop threading through table+menu), `3b8df3f` (dialog body branch). SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-03-SUMMARY.md`. Manual UI smoke across Basic/Widget/Trialing deferred to Phase 42.6 manual QA. Phase 42.6 Wave 2 owner side complete; Plan 42.6-02 (public embed gate) running in parallel — no file overlap with this plan. Previous status: Plan 42.6-01 (helper) shipped 2026-05-11 (`61b65ba`). Phase 42.5 SHIPPED 2026-05-10 (multi-tier Stripe paywall foundation).

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (3-tier model). Phase 41 shipped 2026-05-10. Phase 42 plumbing code-complete 2026-05-10. Phase 42.5 (Multi-Tier Stripe + Schema) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 42.6 of 46 (+ inserted 42.5/42.6) — **IN PROGRESS** (Wave 1 complete; Wave 2 owner-side complete; Wave 2 public-side in parallel)
**Plan:** 42.6-01 complete; 42.6-03 complete; 42.6-02 (public embed gate) running in parallel
**Status:** Phase 42.6 Plan 03 (Wave 2, owner side) COMPLETE. Gated owner "Get embed code" dialog body on `plan_tier` via server-side `requireWidgetTier` in `event-types/page.tsx`, threading `isWidgetAllowed: boolean` through EventTypesTable → RowActionsMenu → EmbedCodeDialog. Dialog body branches: allowed → existing EmbedTabs + preview iframe; gated → `<Card>` with "Upgrade to Widget" `<Link href="/app/billing">` (plain href, zero anchor fragments). "Get embed code" menu item remains visible/clickable for all tiers — only the dialog body is gated. Page itself, Create-event-type button, edit/archive flows all remain accessible to Basic-tier owners. Defensive default `isWidgetAllowed=false` when account row is null. No `requireWidgetTier` call in any client component — gate is server-only (verified: 0 matches in `_components/*.tsx`). Card primitives `Card, CardHeader, CardTitle, CardContent, CardFooter` confirmed exported from `@/components/ui/card` before use. `npm run build` ✓ 6.4s, 35 routes built; `npx tsc --noEmit` zero new errors outside pre-existing tests/ noise. Atomic commits: `6e826c8` (page gate), `0a1b647` (prop threading through table+menu), `3b8df3f` (dialog body branch). SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-03-SUMMARY.md`. Manual UI smoke matrix (Basic-active / Widget-active / Trialing-NULL) deferred to Phase 42.6 manual QA — static-analysis evidence (grep + build + tsc) proves prop chain wired correctly and `requireWidgetTier` branches are tested (12/12 from Plan 01). Plan 42.6-02 (public `/embed/[account]/[slug]` gate) runs in parallel — no file overlap (this plan touched only `app/(shell)/app/event-types/*`; Plan 02 owns `app/embed/*` and `app/[account]/[event-slug]/_lib/*`).
**Last activity:** 2026-05-11 — Executed Plan 42.6-03 (autonomous, no checkpoints). Modified 4 files: `event-types/page.tsx` (added requireWidgetTier import + extended account select to `slug, plan_tier, subscription_status` + derived `isWidgetAllowed` + passed prop), `event-types-table.tsx` (added prop to type + destructure + forwarded to RowActionsMenu), `row-actions-menu.tsx` (added prop to type + destructure + forwarded to EmbedCodeDialog), `embed-code-dialog.tsx` (added prop to type + destructure + branched DialogContent body on it; gated branch renders Card with upgrade pitch + Button asChild wrapping Link to `/app/billing`). 3 atomic commits. `npx tsc --noEmit` clean outside pre-existing tests/ noise. `npm run build` ✓.

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
| **42.6** | **Widget Feature Gating** (INSERTED) | BILL-26 + BILL-27 | ⚠ In progress 2026-05-11 — Plan 01 (helper) + Plan 03 (owner dialog) complete; Plan 02 (public embed) in parallel |
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
- **LD-20** Owner-side widget gate (Plan 42.6-03) runs SERVER-SIDE only — in `app/(shell)/app/event-types/page.tsx`. The boolean result `isWidgetAllowed` threads through `EventTypesTable → RowActionsMenu → EmbedCodeDialog` as a plain prop. Client components MUST NOT import `requireWidgetTier`. The "Get embed code" dropdown menu item stays visible/clickable for all tiers — only the dialog BODY branches (gated branch shows a Card with `<Link href="/app/billing">Upgrade to Widget</Link>`, plain href, zero anchor fragments / query strings). Page itself, "Create event type" button, Edit/Make-inactive/Archive menu items remain accessible to Basic-tier owners. Defensive default: `isWidgetAllowed = false` when account row is null.

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

**Last session:** 2026-05-11 — Executed Plan 42.6-03 (Wave 2 owner-side, autonomous, no checkpoints). Modified 4 files: `app/(shell)/app/event-types/page.tsx` + `_components/event-types-table.tsx` + `_components/row-actions-menu.tsx` + `_components/embed-code-dialog.tsx`. 3 atomic commits: `6e826c8` → `0a1b647` → `3b8df3f`. Server-side `requireWidgetTier` call lives in page.tsx; client components only consume the `isWidgetAllowed` boolean prop. Dialog body branches on the boolean — gated branch is a `<Card>` with `<Link href="/app/billing">Upgrade to Widget</Link>`. `npm run build` ✓ 6.4s; `npx tsc --noEmit` zero new errors outside pre-existing tests/ noise. Authored `42.6-03-SUMMARY.md`. Previous session: Plan 42.6-01 (helper + tests), commit `61b65ba`.

**Stopped at:** Completed Plan 42.6-03. Phase 42.6 owner-side gate shipped. Plan 42.6-02 (public `/embed/[account]/[slug]` gate) is running in parallel — once it completes, Phase 42.6 will be content-complete and ready for manual UI smoke testing (Basic / Widget / Trialing matrix across both surfaces).

**Resume file:** None — next action depends on Plan 42.6-02 completion. Once 42.6-02 lands, run the cross-surface manual UI smoke on a live deploy to close Phase 42.6 (Andrew owns the spoof-account walkthrough).

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
