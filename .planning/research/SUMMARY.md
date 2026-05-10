# Project Research Summary

**Project:** NSI Booking Tool v1.8 — Stripe Paywall + Login UX Polish
**Domain:** Multi-tenant SaaS calendar/booking tool — subscription billing enforcement
**Researched:** 2026-05-09
**Confidence:** HIGH

---

## Executive Summary

v1.8 adds a Stripe subscription paywall and polishes the login UX of an existing Next.js 14 + Supabase + Vercel booking SaaS that has shipped 7 prior milestones. The only new npm package is stripe@22.1.1; every other change — login button reorder, 3-fail nudge counter, Gmail quota raise, magic-link inline helper — requires zero additional dependencies. The recommended integration strategy is Stripe-hosted Checkout (no Stripe.js on the client) and the Stripe Customer Portal (no custom billing UI). These two choices together keep the frontend surface minimal and delegate PCI scope, payment form maintenance, invoice history, and cancellation flows entirely to Stripe.

The critical architectural decision is where subscription enforcement lives: middleware (lib/supabase/proxy.ts), extended inside the existing /app/* branch. This is the only location that guarantees uniform enforcement before any React Server Component tree renders, matches the existing auth-gate pattern, and is structurally immune to accidentally gating the public booker (/[account]/*) — satisfying the LD-07 booker-neutrality invariant locked since v1.5. The webhook handler must use await req.text() before signature verification (the single most common App Router/Stripe integration failure). Idempotency is enforced via a stripe_webhook_events table with a UNIQUE(stripe_event_id) constraint and ON CONFLICT DO NOTHING.

The most operationally consequential risk is the existing-account lockout on deploy day: any migration that anchors trial_ends_at to accounts.created_at will instantly lock every pre-v1.8 account. The fix is to anchor the trial to the deploy timestamp (NOW() + INTERVAL '14 days'), not account creation. One open question — Gmail quota 450 (Andrew spec) vs 400 (pitfalls recommendation) — is flagged but not locked; the roadmapper should propose 400 and let Andrew override.

---

## Key Findings

### Recommended Stack

v1.8 introduces exactly one new package. stripe@22.1.1 (verified npm 2026-05-09) handles all billing server-side. @stripe/stripe-js and @stripe/react-stripe-js must NOT be installed — hosted Checkout requires zero client-side Stripe code.

**Core technologies:**
- stripe@22.1.1: server-side billing SDK — only new install; pin apiVersion to 2026-04-22.dahlia
- Stripe Hosted Checkout: subscription creation — handles 3DS, Apple Pay, PSD2, localization with zero frontend code
- Stripe Customer Portal: self-serve billing management — one API call replaces 200-500 hours of custom cancel/card-update/invoice UI
- Supabase accounts table (5 new columns): subscription state cache — avoids a Stripe API round-trip on every authenticated middleware check
- stripe_webhook_events table: idempotency log — prevents double-fire on Stripe 72-hour retry window
- Existing getSenderForAccount() factory: Stripe-triggered transactional emails — no new email infrastructure needed

**Environment variables required (Vercel dashboard, manual action):**
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_ANNUAL, NEXT_PUBLIC_APP_URL (verify it exists)

### Expected Features

**Must have (table stakes) — v1.8:**
- Stripe webhook handler (app/api/stripe/webhook/route.ts) — all subscription state flows through this
- accounts table: 5 billing columns (stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, current_period_end)
- stripe_webhook_events idempotency table with UNIQUE(stripe_event_id)
- Migration backfill: pre-v1.8 accounts get trial_ends_at = NOW() + 14 days, subscription_status = trialing (NOT created_at + 14 days)
- provision_account_for_new_user trigger updated to set trial_ends_at on new signups
- /app/billing page with monthly/annual toggle and Stripe Checkout redirect
- Paywall middleware in proxy.ts — redirects locked owners to /app/billing; never touches /[account]/*
- Trial countdown banner on all /app/* pages (neutral tone)
- Last-3-days tone-shift banner (amber, non-dismissible; triggered by customer.subscription.trial_will_end webhook)
- Trial-expired locked-state card on /app/billing
- past_due in-app banner with Customer Portal link — NOT a hard lockout (LD-08)
- Customer Portal link on /app/billing (post-subscription only)
- Checkout return polling on ?session_id= — webhook is canonical source of truth, no optimistic update (LD-10)
- Login form: Google OAuth button moved below password/magic-link card
- Login form: 3-fail in-memory counter (useState only, no storage) nudges to magic-link tab
- Magic-link tab: inline helper with AUTH-29-safe identical wording for all users (LD-12)
- Gmail quota: SIGNUP_DAILY_EMAIL_CAP raised in quota-guard.ts (value TBD — see Open Question)

**Should have (defer to v1.9):**
- Welcome-to-paid custom email template (Stripe receipt covers it for now)
- Trial extension offer (+5 days on card entry)
- Coupon / promotion code support
- Custom dunning email after Stripe retries exhaust
- Annual plan as default toggle (defer until conversion data exists)
- Multi-plan pricing tiers

**Anti-features (do NOT build):**
- Custom invoice history page — Customer Portal handles it
- Custom payment method update form — PCI scope risk; Portal handles it
- Custom cancellation flow — Portal handles it
- Lockout of public booker (/[account]/*) — violates LD-07
- Magic-link response differentiation per email — violates AUTH-29

### Architecture Approach

The paywall is a thin enforcement layer bolted onto the existing middleware. Subscription state lives in two DB additions (columns on accounts + stripe_webhook_events table), written by the webhook handler and read by the middleware. The billing page (/app/billing) is the one /app/* route exempt from the paywall redirect. Public booker routes (/[account]/*) never enter the paywall branch — enforced structurally by the pathname.startsWith('/app') gate, not by a string allowlist.

**Major components:**
1. lib/stripe/client.ts — singleton Stripe SDK, apiVersion pinned, server-only guard
2. app/api/stripe/webhook/route.ts — raw body, signature verify, idempotency check, event routing; emails fire async (fire-and-forget matching existing booking email pattern)
3. app/api/stripe/checkout/route.ts + status/route.ts — session creation + polling endpoint for lag window
4. app/api/stripe/portal/route.ts — Customer Portal session; URL never logged (V18-CP-09 prevention)
5. lib/supabase/proxy.ts (extended) — subscription gate after existing auth gate, inside /app/* branch only
6. app/(shell)/app/billing/page.tsx + _components/ — plan selector, state cards, banners, checkout-return poller
7. app/(auth)/app/login/login-form.tsx (modified) — 3-fail counter, magic-link helper, Google button reorder
8. Two Supabase migrations — must deploy before handler code (V18-MP-11 prevention)

### Critical Pitfalls

1. **Raw body parsed before signature verification (V18-CP-01)** — Calling await req.json() before constructEvent() invalidates the HMAC signature on every webhook. Use await req.text() and pass the raw string. Add export const dynamic = 'force-dynamic'. This is the single most common Stripe + App Router failure mode.

2. **Existing accounts lock out instantly on deploy (V18-CP-06)** — Setting trial_ends_at = created_at + INTERVAL '14 days' locks accounts created months ago immediately. Set trial_ends_at = NOW() + INTERVAL '14 days' anchored to deploy time. Also update the provision_account_for_new_user trigger for new post-v1.8 signups.

3. **Paywall middleware fires on public booker routes (V18-CP-05)** — A mis-placed conditional could redirect a booker at /nsi/30min to /app/billing, violating LD-07. The subscription gate must live entirely inside the pathname.startsWith('/app') branch. Write a test: unauthenticated GET to /{account}/{slug} asserts 200.

4. **past_due triggers hard lockout (V18-CP-07)** — Locking on past_due punishes owners during Stripe ~3-week retry window for a temporarily declined card. Hard-lock only on unpaid and canceled. past_due gets a non-dismissible banner with a Customer Portal link (LD-08).

5. **Webhook handler not idempotent (V18-CP-02)** — Stripe retries for 72 hours. Without INSERT INTO stripe_webhook_events ON CONFLICT DO NOTHING, the same event fires side effects multiple times. Return 200 on duplicate.

6. **AUTH-29 regression from conditional magic-link helper (V18-MP-03)** — The helper text must be identical for all users. Any branch on server action response that varies by user identity breaks the four-way enumeration-safety invariant. Test: submit known + unknown email; assert byte-identical DOM.

---

## Locked Decisions

These decisions are final. Phase plans must not reopen them.

| ID | Decision |
|----|----------|
| LD-01 | Stripe SDK: stripe@22.1.1; pin apiVersion: 2026-04-22.dahlia |
| LD-02 | No @stripe/stripe-js install; hosted Checkout only, no Elements |
| LD-03 | Customer Portal handles cancel/update-payment/invoices/plan-switch; no custom equivalents |
| LD-04 | subscription_status uses Stripe 8-value vocabulary; paywall gate allows trialing and active only |
| LD-05 | Webhook idempotency via stripe_webhook_events (stripe_event_id text PRIMARY KEY) + ON CONFLICT DO NOTHING |
| LD-06 | App Router webhook MUST use await req.text() not req.json() before signature verification |
| LD-07 | Paywall middleware extends lib/supabase/proxy.ts inside existing pathname.startsWith('/app') branch; /[account]/* structurally exempt |
| LD-08 | past_due does NOT trigger lockout (banner only); only unpaid/canceled/trial-expired redirect to /app/billing |
| LD-09 | Existing v1.7 accounts: trial_ends_at = NOW() + INTERVAL '14 days' at deploy time (NOT created_at + 14 days) |
| LD-10 | Checkout return lag-window uses polling; webhook is canonical source of truth; no optimistic update |
| LD-11 | Stripe-triggered transactional emails route through getSenderForAccount(accountId); Stripe-built-in receipts complement for dollar-amount emails |
| LD-12 | AUTH-29 four-way enumeration-safety invariant preserved; magic-link inline helper identical wording for all users |

---

## Open Question (Not Locked — Roadmapper Must Propose)

**Gmail quota raise: 450 (Andrew spec) vs 400 (pitfalls recommendation)**

The pitfalls researcher recommends 400 to preserve a 100-message buffer (20% headroom) against Gmail ~500/day soft limit, matching the original 40% headroom philosophy behind the existing 200 cap. Raising to 450 leaves only 50 messages of buffer (10%), which bounce-backs alone can consume on a high-send day.

Roadmapper should propose 400 with a comment in quota-guard.ts documenting the headroom rationale. Andrew can override to 450 if operationally needed. The value lives in a single constant per Phase 36 OQ-1 centralization requirement.

---

## Manual Prerequisites (Andrew Action Items)

| ID | Action | Needed Before |
|----|--------|---------------|
| PREREQ-A | Create Stripe account | Phase A |
| PREREQ-B | Create Product + monthly Price + annual Price in Stripe dashboard; capture both Price IDs | Phase B |
| PREREQ-C | Configure Customer Portal in Stripe dashboard (cancel-at-period-end, plan switching, invoice history, payment-method updates) | Phase D |
| PREREQ-D | Add env vars to Vercel: STRIPE_SECRET_KEY (test + live), STRIPE_WEBHOOK_SECRET (test + live), STRIPE_PRICE_ID_MONTHLY, STRIPE_PRICE_ID_ANNUAL; verify NEXT_PUBLIC_APP_URL | Phase A deploy |
| PREREQ-E | Decide monthly + annual pricing (amounts and discount percentage) | Phase B |
| PREREQ-F | Register Stripe webhook endpoint in Stripe dashboard after Phase A deploys; capture whsec_... for each environment | After Phase A |

---

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase A: Stripe SDK + Schema + Webhook Skeleton

**Rationale:** Every subsequent phase depends on the DB columns existing and the webhook handler being live. Schema must deploy before handler code (V18-MP-11). The webhook can run in log-only mode to validate event routing in test mode before any paywall UI exists.

**Delivers:** lib/stripe/client.ts, lib/stripe/price-ids.ts, both Supabase migrations (accounts billing columns + webhook events table), backfill of trial_ends_at for existing accounts, provision_account_for_new_user trigger update, app/api/stripe/webhook/route.ts (skeleton: idempotency + event routing, no enforcement yet), Stripe CLI local dev setup.

**Avoids:** V18-CP-01 (raw body), V18-CP-02 (idempotency), V18-CP-06 (instant lockout on deploy), V18-CP-08 (API version drift), V18-MP-09 (missing account_id metadata), V18-MP-11 (migration before handler)

**Research flag:** Standard patterns — fully documented in STACK.md and ARCHITECTURE.md. No additional research phase needed.

---

### Phase B: Checkout Flow + Plan Selection Page

**Rationale:** The /app/billing page must exist before Phase C turns on the paywall redirect. A locked owner needs somewhere to land. Phase C is blocked on Phase B.

**Delivers:** app/(shell)/app/billing/page.tsx (initial shell), plan-selector.tsx (monthly/annual toggle), app/api/stripe/checkout/route.ts, app/api/stripe/checkout/status/route.ts (polling), checkout-return-poller.tsx.

**Addresses:** Plan selection, monthly/annual toggle, Checkout redirect, lag-window handling (LD-10)

**PREREQ blocked on:** PREREQ-B (Price IDs), PREREQ-E (pricing decision)

**Research flag:** Standard patterns — ARCHITECTURE.md section 3 covers the full flow.

---

### Phase C: Paywall Enforcement + Locked-State UI + Global Banner

**Rationale:** Most sensitive phase — touches the auth/navigation critical path. Must come after Phase B. Ship last among billing phases. LD-07 verification mandatory before merge.

**Delivers:** proxy.ts subscription gate extension, locked-state-card.tsx, global-paywall-banner.tsx, updated (shell)/layout.tsx.

**Addresses:** Trial lockout, past_due banner (LD-08 compliant), LD-07 preservation, trial countdown display

**Avoids:** V18-CP-05 (paywall on booker routes), V18-CP-07 (aggressive past_due lockout), V18-MP-07 (soft-lock first)

**Mandatory pre-merge checklist:**
- Unauthenticated GET /{account}/{slug} returns 200, not 302
- Authenticated owner with trial_ends_at = tomorrow reaches /app dashboard
- Authenticated owner with expired trial redirected to /app/billing (not 404)
- /app/billing accessible while locked (no redirect loop)
- past_due account: /app renders with banner, no redirect

**Research flag:** Standard patterns — mandatory manual LD-07 verification before merge.

---

### Phase D: Customer Portal + Billing Settings Polish + Stripe-Triggered Emails

**Rationale:** Can begin after Phases A and B. Can parallelize with Phase C at the file level (no shared files). Recommend merging Phase C last.

**Delivers:** app/api/stripe/portal/route.ts, active-subscription-card.tsx, past-due-banner.tsx, trial-status-card.tsx, 4 email templates (trial-ending, payment-failed, account-locked, welcome-paid), webhook handler email dispatch wired to getSenderForAccount(), billing-page-load reconciliation call (V18-CP-04 defense layer 2).

**Addresses:** Customer Portal self-serve, cancel flow (delegate to Portal), invoice history (delegate to Portal), transactional emails (LD-11)

**Avoids:** V18-CP-09 (Portal URL logged), V18-MP-01 (proration), V18-MP-02 (immediate cancellation)

**Research flag:** Standard patterns — Portal session creation in STACK.md; email routing follows existing getSenderForAccount pattern.

---

### Phase E: Login UX Polish + Gmail Quota Raise

**Rationale:** Completely independent of Phases A-D. No shared files. Bundle as final code phase for QA efficiency.

**Delivers:** login-form.tsx changes — Google button reorder below card, 3-fail useState counter (increment on authError only, not serverError or network), magic-link inline helper text. quota-guard.ts — SIGNUP_DAILY_EMAIL_CAP update (propose 400; Andrew decides).

**Addresses:** Login UX polish, AUTH-29 preservation (LD-12), V15-MP-05 Turnstile lifecycle verification

**Avoids:** V18-MP-03 (AUTH-29 regression), V18-MP-04 (Turnstile remount on tab-switch), V18-MP-05 (counter on network error), V18-MP-06 (counter in storage), V18-MP-08 (Gmail cap too tight)

**Codebase verification required:** Architecture researcher confirmed app/(auth)/app/login/login-form.tsx already has defaultValue="password" on the Tabs component — password-first is already the default. The password-first tabs scope item may be a no-op. Verify against live code before including it as a task.

**Research flag:** Standard patterns — no additional research needed.

---

### Phase F: Manual QA + FUTURE_DIRECTIONS.md

**Rationale:** Per Andrew CLAUDE.md project-completion convention — all manual checks in a final phase; project is not complete until signed off.

**Delivers:** Full end-to-end QA in Stripe test mode (trial flow, lockout, Checkout, Portal, cancel, past_due dunning, reactivation), LD-07 public booker verification, AUTH-29 byte-comparison test, Turnstile tab-switch test (exactly 1 token fetch per page load), Gmail quota verification. FUTURE_DIRECTIONS.md committed to repo.

**Checklist source:** PITFALLS.md Looks-Done-But-Isnt section (14-item checklist)

**Research flag:** Not applicable — manual verification phase.

---

### Phase Ordering Rationale

- **Schema before code:** stripe_webhook_events and accounts billing columns must exist before handler code deploys. Non-negotiable (V18-MP-11).
- **Billing page before enforcement:** /app/billing must exist before proxy.ts redirects locked owners there. Phase C depends on Phase B.
- **Enforcement last among billing phases:** Phase C is the most sensitive change. D and C can be developed in parallel but C merges last.
- **Login UX independent:** Phase E has zero dependencies on A-D. Bundle it last for QA efficiency, not dependency.
- **Manual QA always final:** Per Andrew CLAUDE.md convention.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | stripe@22.1.1 verified against live npm registry 2026-05-09; API patterns verified against official Stripe docs and stripe-node repo |
| Features | HIGH / MEDIUM | Stripe subscription lifecycle from official docs (HIGH); UX patterns from community consensus, multiple agreeing sources (MEDIUM) |
| Architecture | HIGH | Grounded against live codebase; middleware extension confirmed against existing proxy.ts; file paths confirmed against existing route structure |
| Pitfalls | HIGH | Derived from live codebase inspection + v1.0-v1.7 incident record + Stripe official docs |

**Overall confidence: HIGH**

### Gaps to Address

- **Password-first tab no-op:** Architecture researcher found defaultValue="password" may already be set. Verify against live login-form.tsx before writing Phase E plan — this scope item may be removed.

- **Gmail quota 450 vs 400:** Open question, not locked. Roadmapper proposes 400; Andrew decides. Document headroom rationale in the constant comment regardless of chosen value.

- **Pricing not decided (PREREQ-E):** STRIPE_PRICE_ID_MONTHLY and STRIPE_PRICE_ID_ANNUAL cannot be set until Andrew decides pricing. Phase B is blocked until PREREQ-E is resolved.

- **subscription_status CHECK constraint vocabulary:** Architecture researcher included a 'locked' 9th status value (trial-expired-without-subscribing), distinct from 'canceled'. STACK.md recommends only Stripe native 8 values. Roadmapper should decide: add 'locked' as a 9th app-defined status, or derive the locked state from subscription_status = 'trialing' AND trial_ends_at < now() at read time. The latter avoids a status Stripe webhooks can never set directly and is simpler.

---

## Sources

### Primary (HIGH confidence)
- Stripe official docs: API versioning, webhook raw body requirement, constructEvent signature, subscription status vocabulary, Customer Portal capabilities, Checkout session creation, free trial configuration, Smart Retries, cancel-at-period-end behavior
- stripe-node GitHub repo (PR #2259): official App Router webhook example confirming request.text() pattern
- npm registry (2026-05-09): stripe at 22.1.1
- Live codebase: lib/supabase/proxy.ts, lib/email-sender/quota-guard.ts, lib/email-sender/account-sender.ts, multiple supabase/migrations/, app/(auth)/app/login/login-form.tsx, app/api/bookings/route.ts
- v1.7 incident record and phase context: AUTH-29, V15-MP-05, LD-07, Phase 36 OQ-1 centralization, Phase 38 login form implementation, Phase 39 QA

### Secondary (MEDIUM confidence)
- Authgear: Login and Signup UX 2025 Guide — OAuth button placement conventions
- LogRocket, Userpilot: modal vs banner UX patterns for trial expiry
- Baytech Consulting: magic-link UX patterns and fallback
- Appcues: trial extension 66% conversion stat (single source)
- mrcoles.com: past_due vs unpaid timing distinction (cross-verified against official docs)
- Kitson Broadhurst (Medium): Next.js App Router + Stripe webhook req.text() pattern (cross-verified with official raw-body requirement)

---

*Research completed: 2026-05-09*
*Ready for roadmap: yes*
