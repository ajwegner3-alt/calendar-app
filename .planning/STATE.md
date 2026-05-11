# Project State: Calendar App (NSI Booking Tool)

**Last updated:** 2026-05-11 — **Plan 44-03 SHIPPED** (Stripe Customer Portal route). New file `app/api/stripe/portal/route.ts` (164 lines) mirrors `app/api/stripe/checkout/route.ts` skeleton: `server-only` + `runtime='nodejs'` + `dynamic='force-dynamic'` + `Cache-Control: no-store` on every response. RLS-scoped read of `accounts.stripe_customer_id`; calls `stripe.billingPortal.sessions.create()` (uses existing singleton from `@/lib/stripe/client` per LD-01). Optional request body `{ flow: 'payment_method_update' }` adds `flow_data` deep-link to Stripe's payment-method-update page (past_due UX, BILL-22). Five error outcomes wired: 401 unauthorized, 404 account_not_found, 400 no_stripe_customer, 500 stripe_error, 500 no_session_url. Return URL = `${origin}/app/billing` (mirrors checkout origin derivation). All 8 verify-block grep checks pass; **V18-CP-09 enforcement grep (`console\\.(log|error|warn).*session\\.url`) returns ZERO matches** — session URLs are never logged server-side. `npm run build` succeeds and lists `/api/stripe/portal` in the route table — this resolves the build block flagged by Plan 44-02's STATE entry. Plan commit: `9049389`. Closes API half of BILL-21 + supports BILL-22; UI half ships in Plan 44-05. **Two Rule-1 auto-fixes during execution (both inline before commit):** (a) Plan-supplied type path `Stripe.BillingPortal.SessionCreateParams.FlowData` failed TS check under `import type Stripe from "stripe"` (TS declined the namespace-vs-interface declaration-merge under type-only import) — replaced with `Parameters<typeof stripe.billingPortal.sessions.create>[0]`-derived local alias `PortalFlowData = NonNullable<...>["flow_data"]` (SDK-version-resilient; the `import type Stripe` line was dropped). (b) Empty-URL log message originally `"[stripe-portal] session.url is empty"` tripped the V18-CP-09 grep on its string literal — renamed to `"[stripe-portal] portal session created without a redirect URL"` (same intent, no `session.url` substring; logged payload unchanged). Functional behavior identical to plan intent. Pattern established: when a Stripe.X.Y.Z namespace-merge type fails under type-only import, use `Parameters<typeof sdkFn>[0]`-derived aliases. Open watch item for Phase 46 UAT: PREREQ-C (Customer Portal Dashboard config — plan-switching across all 4 Prices) still pending; route itself works without it but Portal page surfaces "unconfigured" error to customers until PREREQ-C completes. SUMMARY at `.planning/phases/44-customer-portal-billing-polish-stripe-emails/44-03-SUMMARY.md`. **Prior status: Plan 44-02 SHIPPED** (Stripe-triggered email senders). Two new modules in `lib/email/`: `send-trial-ending-email.ts` (149 lines) + `send-payment-failed-email.ts` (188 lines). Both route through `getSenderForAccount(accountId)` per LD-11 strict (no parallel send path). Both NEVER throw — return `{success, error?}` so Plan 44-04 webhook handler can ignore email failures without rolling back the `stripe_webhook_events` dedupe row. Branded chrome via `branding-blocks` helpers (`renderEmailBrandedHeader`, `brandedHeadingStyle`, `renderBrandedButton`, `renderEmailFooter`, `stripHtml`). CTAs target `${appUrl}/app/billing` (NOT Stripe Portal — keep owner in-app per CONTEXT.md; Status Card routes them onward in one more click). Plan-44-02-specific decisions: NO quota guard (`checkAndConsumeQuota`) — billing emails are operationally distinct from booking confirmations and must never be silently suppressed by the per-account booking-quota cap. `escapeHtml` duplicated locally per file (mirrors `send-booking-confirmation.ts` pattern; branding-blocks `escapeHtml` is internal-only). Adaptive subject on trial-ending (today / tomorrow / N days). Adaptive copy on payment-failed (`nextPaymentAttempt === null` → amber final-notice; non-null → "Stripe will retry on {date}"). Sends on EVERY retry — Stripe event ID dedupe is sufficient per 44-00-PLANNER-NOTES resolved Q1. Plan commits: `6ad405e` (44-02-01 trial-ending), `cf4c723` (44-02-02 payment-failed). SUMMARY at `.planning/phases/44-customer-portal-billing-polish-stripe-emails/44-02-SUMMARY.md`. `npx tsc --noEmit` zero errors attributable to either new file (only pre-existing tests/ tech debt + unrelated `app/api/stripe/portal/route.ts` namespace-access error from sibling Plan 44 wave member — Plan 44-02 did NOT touch that file; it's untracked from a parallel plan). `npm run build` blocked ONLY on that unrelated portal route TS error (sibling plan territory; not a Plan 44-02 regression). **LD-11 strict carry-forward for Phase 46 UAT:** Gmail-provider accounts → emails arrive from owner's Gmail OAuth address (same as booking confirmations); Resend-provider accounts → emails arrive from `bookings@nsintegrations.com` reply-to `owner_email`. If Andrew finds this confusing during UAT a future phase can introduce a billing-specific sender override. **Downstream contract for Plan 44-04:** import from `@/lib/email/send-trial-ending-email` and `@/lib/email/send-payment-failed-email`; both functions return `Promise<{success, error?}>` and never throw; webhook handler should log on `!result.success` but still return HTTP 200 to Stripe (do NOT roll back dedupe row). Closes EMAIL half of BILL-24 partial closure (2 of 4 named emails — `account-locked` + `welcome-to-paid` formally deferred per CONTEXT.md). **Prior status: Phase 43 SHIPPED.** Verifier 9/9 SC + 4/4 gates PASS (static); Andrew live-verified all 7 scenarios on production deploy via in-conversation Supabase MCP state-flips (trial >3d neutral blue → urgent amber ≤3d → canceled redirect → past_due banner non-blocking → public booker 200 → grandfather no-lockout → sidebar Billing entry visible). Closes BILL-12..BILL-20 (9 requirements). Plan commits: `d559305`+`1fbbaab` (43-01 middleware gate at `lib/supabase/proxy.ts`), `fd59b7d`+`3ca0868`+`e1f35c2` (43-02 SubscriptionBanner). **Two post-merge corrections committed during UAT:** `fb909f9` SubscriptionBanner moved inside `<main>` so it inherits `pt-20 md:pt-24` header clearance — Header is `position: fixed` and was hiding the banner; banner outer `mx-auto max-w-6xl px-4 sm:px-6` wrapper stripped (main provides it); `mt-4` swapped for `mb-4`. `b9fa84e` added Billing entry to sidebar nav (top-level CreditCard icon between Branding and Settings — Phase 42.5 had shipped `/app/billing` without a nav entry; owners could only reach it via banner link or lock-redirect). **One production database fix during UAT (applied via MCP `apply_migration`):** `phase42_5_plan_tier` migration. Phase 42.5-01 plan_tier column was never registered in `schema_migrations` and never reached production — public booker `/[account]/[event-slug]` was returning **HTTP 404 to all customers** because shared loader at `app/[account]/[event-slug]/_lib/load-event-type.ts:32` selects `plan_tier`, the failing select returned null, `notFound()` fired. **Production booker outage resolved.** All 5 grandfathered accounts now have `plan_tier = NULL` (correct state — they pre-date Stripe checkout). Migration is purely additive: `ADD COLUMN plan_tier TEXT CHECK (NULL OR 'basic'/'widget')` + COMMENT. **Migration sync gap finding (dormant tech debt):** Phases 36, 37, 41 migration files exist in repo and their columns exist in production DB, but they are NOT registered in `schema_migrations` (someone applied them via Dashboard SQL editor without recording). `supabase db push --linked` could re-run them and fail on column-already-exists. Repair scheduled at owner discretion. Phase 44 (Customer Portal + Billing Polish + Stripe Emails) and Phase 45 (Login UX Polish) both unblocked. **Prior status:** Phase 42.6 SHIPPED 2026-05-11 — Verifier 5/5 SC + 3/3 gates PASS (static); Andrew live walkthrough sign-off received via "approved". VERIFICATION.md frontmatter flipped to `status: passed`, `signoff_by: Andrew`, `signoff_at: 2026-05-11`. Closes BILL-26 (`/embed/*` route gated by `plan_tier`) + BILL-27 (owner embed-code dialog gated by `plan_tier`). All 7 human-verification scenarios accepted: (1) Basic-active /embed/* → gated message, (2) Widget-active /embed/* → booker, (3) Trialing /embed/* → booker, (4) Basic owner dialog → upgrade card, (5) Widget/trialing owner dialog → tabs+preview, (6) bare booker `/{account}/{slug}` non-gated regardless of tier (LD-07), (7) iframe degradation → gated message renders inside third-party iframe. Phase 42.6 represents the first plan_tier-gated user-visible feature in the codebase. Next: Phase 43 (Paywall Enforcement + Locked-State UX + Trial Banners). Prior status: Phase 42.6 Wave 2 COMPLETE (both Plan 02 + Plan 03). **Plan 02 (public embed gate):** `/embed/[account]/[event-slug]` now calls `requireWidgetTier()` between data load and `EmbedShell` render; when `!gate.allowed` the route returns HTTP 200 + neutral `EmbedGatedMessage` server component (NEVER `notFound()` or `redirect()` — iframes would render a broken X). Bare booker `/[account]/[event-slug]/page.tsx` byte-identical to pre-plan state (LD-07 preserved — `git diff --stat` empty). `AccountSummary` extended additively with `plan_tier: 'basic'|'widget'|null` + `subscription_status: string|null`; shared loader selects both columns but contains zero `requireWidgetTier` calls (gate stays at route level). No `force-dynamic`/`revalidate` added — route remains naturally dynamic. `proxy.ts` unchanged. 4 files touched, 3 atomic commits (`57a8bce`, `596bd56`, `82502d4`). SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-02-SUMMARY.md`. **Plan 03 (owner-side dialog gate):** Gated the owner "Get embed code" dialog body on `plan_tier` via server-side `requireWidgetTier` in `event-types/page.tsx`, threading `isWidgetAllowed: boolean` through EventTypesTable → RowActionsMenu → EmbedCodeDialog. When `!isWidgetAllowed`, dialog renders a `<Card>` with "Upgrade to Widget" `<Link href="/app/billing">` in place of the embed snippets + preview iframe. "Get embed code" menu item remains visible/clickable for all tiers — only the dialog body is gated (CONTEXT decision). Defensive default `isWidgetAllowed=false` when account row is null. No `requireWidgetTier` call in any client component — gate is server-only. Atomic commits: `6e826c8` (page gate), `0a1b647` (prop threading), `3b8df3f` (dialog body branch). SUMMARY at `.planning/phases/42.6-widget-feature-gating/42.6-03-SUMMARY.md`. **Both plans:** `npm run build` ✓ 35 routes; `npx tsc --noEmit` zero new errors outside pre-existing tests/ noise. Manual smoke matrix (Basic-active / Widget-active / Trialing-NULL) deferred to phase 42.6 manual QA — static-analysis evidence (grep + build + tsc) proves wiring correct, and `requireWidgetTier` branches are tested by Plan 01's 12/12 unit suite. **Phase 42.6 ready for manual QA**; Phase 43 (Paywall Enforcement) unblocked. Previous status: Plan 42.6-01 (helper) shipped 2026-05-11 (`61b65ba`). Phase 42.5 SHIPPED 2026-05-10.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-09 with v1.8 Current Milestone section)

**Core value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**Current focus:** v1.8 — Stripe Paywall + Login UX Polish (3-tier model). Phase 41 shipped 2026-05-10. Phase 42 plumbing code-complete 2026-05-10. Phase 42.5 (Multi-Tier Stripe + Schema) is next.

**Mode:** yolo | **Depth:** standard | **Parallelization:** enabled

## Current Position

**Milestone:** v1.8 Stripe Paywall + Login UX Polish
**Phase:** 44 of 46 — **IN PROGRESS** (Customer Portal + Billing Polish + Stripe Emails). Plan 44-01 (schema) code-complete 2026-05-11 (`894119b`) — migration application to production still PENDING (human-action checkpoint, Andrew). Plan 44-02 (Stripe-triggered email senders) shipped 2026-05-11 — `6ad405e` (trial-ending) + `cf4c723` (payment-failed). **Plan 44-03 (Customer Portal route) shipped 2026-05-11 — `9049389`.** New `POST /api/stripe/portal` server route closes API half of BILL-21 + supports BILL-22 past_due deep-link UX.
**Plan:** 44-01 (schema) + 44-02 (email senders) + 44-03 (Portal route) shipped to repo; next = 44-04 (webhook integration — unblocked, can consume the two new email modules from 44-02 and write to the new schema column from 44-01) and 44-05 (Status Card UI — unblocked, can `fetch('/api/stripe/portal')` against the new route from 44-03).
**Status:** Phase 44 Wave 1 PARTIAL. 44-01 storage half of BILL-23 shipped to repo (migration pending production apply). 44-02 EMAIL half of BILL-24 partial closure (2 of 4) shipped — `account-locked` + `welcome-to-paid` formally deferred per CONTEXT.md. **44-03 API half of BILL-21 + BILL-22 shipped — `npm run build` block from Plan 44-02's STATE entry RESOLVED.** All three plans build clean; `npx tsc --noEmit` shows only pre-existing test-fixture tech debt. Phase 43 remains SHIPPED.
**Last activity:** 2026-05-11 — Plan 44-03 executed. Created `app/api/stripe/portal/route.ts` (164 lines). Atomic commit `9049389`. SUMMARY at `.planning/phases/44-customer-portal-billing-polish-stripe-emails/44-03-SUMMARY.md`. Two Rule-1 auto-fixes applied inline before commit: (a) `Parameters<>`-derived type alias replaces plan's namespace-merge type path (TS resolution quirk under type-only import); (b) empty-URL log message renamed to avoid the `session.url` substring tripping V18-CP-09 grep. All 8 verify-block grep checks pass; V18-CP-09 enforcement returns ZERO matches; `/api/stripe/portal` now appears in the build route table. Working tree retains the three pre-existing Phase 02/23/33 doc drifts.

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
v1.8 [-] Stripe Paywall + Login UX    (Phases 41-46, Phases 41 + 42.5 + 42.6 shipped 2026-05-10..11; phases 43/44/45/46 remain)
```

**Total shipped:** 7 milestones archived (v1.0–v1.7) + Phases 41 + 42 + 42.5 + 42.6 of v1.8 = 44 phases, 186 plans, ~716 commits

## v1.8 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 41 | Stripe SDK + Schema + Webhook Skeleton | BILL-01..08 ✅ | ✅ Shipped 2026-05-10 |
| 42 | Checkout Flow Plumbing | BILL-09 (partial) + BILL-10/11 | ⚠ Code-complete 2026-05-10; 3/4 plans shipped; 42-04 UAT superseded by 42.5 |
| **42.5** | **Multi-Tier Stripe + Schema** (INSERTED) | BILL-09 (full) + BILL-10b + BILL-25 | ✅ Shipped 2026-05-10 |
| **42.6** | **Widget Feature Gating** (INSERTED) | BILL-26 + BILL-27 | ✅ Shipped 2026-05-11 |
| 43 | Paywall Enforcement + Locked-State UX + Trial Banners | BILL-12..20 ✅ | ✅ Shipped 2026-05-11 |
| 44 | Customer Portal + Billing Polish + Stripe Emails | BILL-21..24 | ⏳ In progress — 44-01 schema code-complete (`894119b`, production migration PENDING); 44-02 email senders shipped (`6ad405e` + `cf4c723`); 44-03 Portal route shipped (`9049389`). Remaining: 44-04 webhook integration + 44-05 Status Card UI. PREREQ-C (Customer Portal Dashboard config) still pending — Portal route works without it; UAT validates it. |
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
- Phase 44 end-to-end UAT blocked on: PREREQ-C (Customer Portal config — must enable plan-switching across all 4 Prices). Plan 44-03 Portal route now SHIPPED — the route itself works without PREREQ-C, but the Portal page surfaces an "unconfigured" error to customers until PREREQ-C completes. Deferred to Phase 46 UAT.
- Plan 44-01 cancel_at_period_end migration application to production — PENDING (human-action checkpoint surfaced in `.planning/phases/44-customer-portal-billing-polish-stripe-emails/44-01-SUMMARY.md`); Andrew to apply via MCP `apply_migration` or Dashboard SQL editor before Plans 44-04 (webhook write) and 44-05 (billing UI read) execute.

## Session Continuity

**Last session:** 2026-05-11 — Plan 44-03 executed (Stripe Customer Portal route). Created `app/api/stripe/portal/route.ts` (164 lines, `POST` handler). Mirrors checkout/route.ts skeleton — `server-only` + `runtime='nodejs'` + `dynamic='force-dynamic'` + `Cache-Control: no-store` on every response. RLS-scoped read of `accounts.stripe_customer_id`; calls `stripe.billingPortal.sessions.create()` with optional `flow_data` deep-link. Five distinct error outcomes wired. Return URL = `${origin}/app/billing`. All 8 verify-block grep checks pass; V18-CP-09 enforcement (`session.url` never logged) returns ZERO matches. `npm run build` succeeds and lists `/api/stripe/portal` in the route table — this resolves the build block flagged at the end of the Plan 44-02 session. Plan commit: `9049389`. Two Rule-1 auto-fixes inline before commit: (a) `Parameters<>`-derived type alias replaces plan's namespace-merge type path; (b) empty-URL log message renamed to avoid the `session.url` substring tripping V18-CP-09 grep. Prior session: Plan 44-02 executed (Stripe-triggered email senders — `6ad405e` + `cf4c723`).

**Stopped at:** Plan 44-03 complete. Phase 44 progress: 44-01 (schema) committed + awaiting prod apply; 44-02 (email senders) committed; 44-03 (Portal route) committed. Remaining in Phase 44: 44-04 (webhook integration — unblocked, can import the two Plan-44-02 email modules and write to the Plan-44-01 schema column), 44-05 (Status Card + Portal Button UI — unblocked, can `fetch('/api/stripe/portal', { method: 'POST' })` against the route shipped in 44-03; client should POST `{ flow: 'payment_method_update' }` for past_due variant or `{}` for generic).

**Resume file:** None. Two actionable next steps:
1. Apply 44-01 migration to production (15-second task; Andrew via Supabase MCP `apply_migration` or Dashboard SQL editor) — gates Plan 44-05.
2. Plan 44-04 (webhook integration) can begin immediately — it consumes Plan 44-02's two new email modules via `@/lib/email/send-trial-ending-email` and `@/lib/email/send-payment-failed-email`. Once 44-01 migration is applied to production, Plan 44-05 (Status Card UI) is also unblocked and can consume the Portal route shipped in this session.

**PREREQ-C** (Customer Portal config in Stripe Dashboard with plan-switching across all 4 Prices) still required before Phase 44 can be live-verified end-to-end.

## Files of record

- `.planning/PROJECT.md` — vision, requirements, key decisions, evolution log
- `.planning/ROADMAP.md` — milestone summary + Phase progress table (Phase 41 marked shipped)
- `.planning/REQUIREMENTS.md` — v1.8 requirements with traceability (BILL-01..08 marked Complete)
- `.planning/STATE.md` — this file
- `.planning/phases/41-stripe-sdk-schema-webhook-skeleton/` — Phase 41 plans, summaries, VERIFICATION.md
- `.planning/research/` — v1.8 research outputs (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- `.planning/milestones/v1.7-ROADMAP.md` — v1.7 archive
