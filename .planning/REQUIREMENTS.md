# Requirements: v1.8 Stripe Paywall + Login UX Polish

**Defined:** 2026-05-10
**Core Value:** A visitor lands on a service business's website, picks an available time slot in a branded widget, and walks away with a confirmed booking in their inbox — no phone tag, no back-and-forth.

**v1.8 strategic shift:** convert the free single-tenant tool into a paid multi-tenant SaaS via Stripe (14-day free trial → owner-app paywall, single plan monthly+annual). Public booker stays free regardless of payment status.

---

## v1.8 Requirements

Requirements for v1.8. Each maps to one roadmap phase.

### AUTH — Login UX Polish

- [ ] **AUTH-33**: Login form moves the Google OAuth button BELOW the email/password form on `/app/login`
- [ ] **AUTH-34**: Signup form moves the Google OAuth button BELOW the email/password form on `/app/signup` (parity with AUTH-33)
- [ ] **AUTH-35**: `/app/login` Password tab is the default (verify-only — already shipped via `defaultValue="password"` at `login-form.tsx:125`; included to lock as v1.8 invariant against future regressions)
- [ ] **AUTH-36**: After 3 consecutive failed password attempts in the current tab session, an inline prompt under the password form offers "Try a magic link instead" with a click-to-switch-tab affordance
- [ ] **AUTH-37**: AUTH-36's failure counter is per-session in-memory (`useState`/`useRef`); resets on tab/window close (no `localStorage`/`sessionStorage` persistence); resets on successful login
- [ ] **AUTH-38**: AUTH-36's counter advances ONLY on auth-rejection responses (e.g., `Invalid login credentials` 400) — NOT on network errors or 5xx; transient outages must not falsely advance the nudge
- [ ] **AUTH-39**: Magic-link tab shows an inline helper line under the email field — identical wording for ALL users regardless of email validity, throttle state, or cooldown state (preserves the AUTH-29 four-way enumeration-safety ambiguity invariant)

### EMAIL — Per-Account Quota Raise

- [ ] **EMAIL-35**: Per-account Gmail send quota raised from 200/day to **400/day** in `lib/email-sender/quota-guard.ts`; 80% warning threshold scales proportionally to 320/day (Phase 36 OQ-1 quota-guard centralization preserved — single constant change, no per-caller branching)

### BILL — Stripe Paywall (Schema + Foundation)

- [x] **BILL-01**: `accounts` table extended with billing columns: `stripe_customer_id text unique`, `stripe_subscription_id text`, `subscription_status text DEFAULT 'trialing'`, `trial_ends_at timestamptz`, `current_period_end timestamptz`, `plan_interval text` (`'monthly' | 'annual' | null`)
- [x] **BILL-02**: `stripe_webhook_events` table created with `stripe_event_id text PRIMARY KEY` for idempotency; `received_at timestamptz`, `event_type text`, `processed_at timestamptz nullable`
- [x] **BILL-03**: Migration grandfathers existing v1.7 accounts at v1.8 deploy time: `trial_ends_at = NOW() + interval '14 days'` (anchored to deploy timestamp, NOT `created_at` — prevents instant lockout of older accounts)
- [x] **BILL-04**: New signups via `provision_account_for_new_user` trigger receive `trial_ends_at = NOW() + interval '14 days'` and `subscription_status = 'trialing'` automatically

### BILL — Webhook Handler

- [x] **BILL-05**: `app/api/stripe/webhook/route.ts` verifies signatures via `stripe.webhooks.constructEvent(body, sig, secret)` with `body` obtained via `await req.text()` (App Router raw-body pattern; NEVER `req.json()` first)
- [x] **BILL-06**: Webhook handler is idempotent: `INSERT INTO stripe_webhook_events (stripe_event_id, ...) ON CONFLICT DO NOTHING`; returns 200 immediately if event already processed
- [x] **BILL-07**: Webhook handler processes the canonical Stripe lifecycle events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.trial_will_end`
- [x] **BILL-08**: Webhook handler updates `accounts.subscription_status`, `current_period_end`, `plan_interval`, `stripe_subscription_id` in response to subscription events; commutative under arbitrary event arrival order

### BILL — Checkout Flow

- [ ] **BILL-09**: `/app/billing` page renders single-plan card with monthly ↔ annual toggle; annual savings % computed from price IDs (numbers TBD per PREREQ-E)
- [ ] **BILL-10**: Plan selection POSTs to `app/api/stripe/checkout/route.ts` which creates a hosted Checkout Session and returns the redirect URL; client redirects to `stripe.com`
- [ ] **BILL-11**: Checkout return URL (`/app/billing?session_id=...`) polls `/api/stripe/checkout/status` every 2s for up to 30s until webhook updates `subscription_status` to `active` (no optimistic update; webhook is canonical)

### BILL — Paywall Enforcement

- [ ] **BILL-12**: Middleware extension at `lib/supabase/proxy.ts` reads `subscription_status` from `accounts` when request path matches `/app/*` AND is NOT `/app/billing`
- [ ] **BILL-13**: Locked accounts (`subscription_status` not in `'trialing' | 'active'`) redirect to `/app/billing`
- [ ] **BILL-14**: `past_due` does NOT trigger lockout — banner only; Stripe-managed dunning retry window (~3 weeks) preserves owner access
- [ ] **BILL-15**: Public booker `/[account]/*` and `/embed/*` routes are NEVER subject to the paywall middleware (LD-07 booker-neutrality preserved structurally — paywall lives inside the existing `pathname.startsWith('/app')` branch)

### BILL — UX (Banners + Locked State)

- [ ] **BILL-16**: Global trial banner displays on all `/app/*` pages during 14-day trial — copy direction: "Trial ends in N days. Head over to payments to get set up." (final wording in plan)
- [ ] **BILL-17**: Trial banner shifts tone/urgency in the last 3 days of trial (color and/or copy intensification)
- [ ] **BILL-18**: `past_due` state displays a non-blocking banner on `/app/*` pages indicating payment retry in progress
- [ ] **BILL-19**: Locked-state `/app/billing` page renders Andrew's spec messaging: "Everything is waiting for you! Head over to payments to get set up." with the plan-selection card directly below
- [ ] **BILL-20**: Locked accounts can access `/app/billing` only; all other `/app/*` paths redirect there (single unlocked owner-app surface when locked)

### BILL — Customer Portal

- [ ] **BILL-21**: `/app/billing` renders a "Manage subscription" button (visible only when `stripe_customer_id` exists) that creates a Stripe Customer Portal session via `app/api/stripe/portal/route.ts` and redirects
- [ ] **BILL-22**: Customer Portal (configured via Stripe dashboard PREREQ-C) handles cancel-at-period-end, payment-method updates, invoice history, monthly↔annual plan switch, expiring-card reminders. NO custom UI built for any of these
- [ ] **BILL-23**: Default cancellation behavior is `cancel_at_period_end = true` — owner keeps access through the period they paid for

### BILL — Email Integration

- [ ] **BILL-24**: Stripe-triggered transactional emails (trial-ending-3-days-out, payment-failed, account-locked, welcome-to-paid) route through the existing `getSenderForAccount(accountId)` factory; Stripe-built-in receipts continue to send dollar-bearing receipts in parallel (do not disable)

### v1.8 Ship Sign-Off

- [ ] **Andrew explicit ship sign-off** — each phase live-deploy approved as it ships per the deploy-and-eyeball pattern (8th consecutive milestone with no formal QA milestone — yolo mode default)

---

## Future Requirements (v1.9+)

Tracked but not in v1.8 roadmap.

### Carryover from v1.7

- **PREREQ-03 — Resend live activation** — flip `accounts.email_provider='resend'` for upgraded accounts after Resend domain DNS verified via Namecheap + `RESEND_API_KEY` in Vercel
- **Lockfile regeneration** — `package-lock.json` from Node 20 / npm 10 to make the dormant knip CI gate green
- **Vercel env-var cleanup** — delete inert `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` from Vercel Preview + Production
- **Resend abuse hard cap + bounce handling** — deferred from Phase 36
- **EMAIL-34** — per-account custom Resend domain (currently shared NSI domain)

### Carryover from earlier milestones

- **AUTH-31** — Microsoft OAuth signup
- **AUTH-32** — SAML/SSO (enterprise)
- **CAL-SYNC-01/02** — Google Calendar read/write sync (extends `gmail.send` → full Workspace integration)
- **BRAND-22** — NSI logo asset (currently text-only "Powered by North Star Integrations")
- **BOOKER-10** — page-transition animations between event-types index and event-page

### Stripe / Billing v2

- **BILL-V2-01** — Multi-tier plans (Starter / Pro / Business) with per-tier feature gating
- **BILL-V2-02** — Promo codes / coupons / time-limited discounts
- **BILL-V2-03** — Team plans (multiple owners per account, seat-based billing)
- **BILL-V2-04** — Affiliate / referral revenue share
- **BILL-V2-05** — Per-account custom pricing (manual override in Stripe dashboard, app reflects)
- **BILL-V2-06** — Usage-based metering (per-booking pricing tier)
- **BILL-V2-07** — Annual auto-renewal grace period with explicit consent
- **BILL-V2-08** — Stripe Tax integration for US sales tax / international VAT

---

## Out of Scope (v1.8 explicit exclusions)

| Feature | Reason |
|---------|--------|
| Custom invoice/payment-method/cancellation UI | Stripe Customer Portal handles all of these for free; building custom is wasted work and adds PCI surface to our own components |
| Stripe Elements (embedded card form) | Hosted Checkout chosen for simpler integration + zero PCI scope; `@stripe/stripe-js` deliberately NOT installed |
| Multi-plan tiers in v1.8 | Single plan only; tier sprawl deferred to v2 once we have actual conversion data |
| Coupons/discounts/promo codes | Acquisition cost optimization belongs in v2 after baseline conversion is known |
| Booker-side paywall display | LD-07 booker-neutrality — invitees never see NSI/billing context regardless of account payment state |
| Per-feature gating during trial | Full app access during 14-day trial; no feature locks until trial expiry |
| `past_due` immediate lockout | Stripe runs a ~3-week dunning retry window automatically; locking on first `past_due` event would block legitimate cards that recover |
| In-app cancellation flow | Customer Portal owns this; cancel-at-period-end default; we do not build a confirmation modal |
| Pricing tier auto-detection by account size | Single plan; no tier logic |
| Subscription-pause feature | Stripe supports `paused` status but we treat it as locked; no in-app pause UI |
| Sales tax / VAT calculation | Defer until customer geography spans tax-bearing jurisdictions |
| Quota raise above 400/day | Pitfalls research recommends 100-msg buffer below Google's 500/day soft limit; raising further requires usage data |
| Magic-link "this email isn't registered" error wording | Direct AUTH-29 invariant violation — would re-introduce account enumeration leak |
| Persistent 3-fail counter | Per-session in-memory only — persistent counter would require user-identity lookup, leaking enumeration data |

---

## Manual Prerequisites (Andrew action items)

These are NOT requirements — they're external setup tasks Andrew must complete to unblock specific phases.

| ID | Task | Blocks |
|----|------|--------|
| **PREREQ-A** | Create Stripe account | All BILL-* requirements |
| **PREREQ-B** | Create Product + monthly Price + annual Price in Stripe dashboard; capture Price IDs | BILL-09, BILL-10 |
| **PREREQ-C** | Configure Customer Portal in Stripe dashboard (enable cancel-at-period-end, plan switching, invoice history, payment-method updates) | BILL-21, BILL-22 |
| **PREREQ-D** | Add env vars to Vercel: `STRIPE_SECRET_KEY` (test + live), `STRIPE_WEBHOOK_SECRET` (test + live), `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`; verify `NEXT_PUBLIC_APP_URL` exists | All BILL-* requirements |
| **PREREQ-E** | Decide pricing (monthly + annual amounts) | BILL-09 (plan-selection page can plan with placeholder until decided) |
| **PREREQ-F** | Register Stripe webhook endpoint (`https://booking.nsintegrations.com/api/stripe/webhook`) after Phase A deploy; capture webhook signing secret into PREREQ-D | BILL-05 (live test) |

---

## Traceability

Updated: 2026-05-10 — Phase 41 complete (BILL-01..08 → Complete); 24 requirements remain pending across phases 42-45.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BILL-01 | Phase 41 | Complete |
| BILL-02 | Phase 41 | Complete |
| BILL-03 | Phase 41 | Complete |
| BILL-04 | Phase 41 | Complete |
| BILL-05 | Phase 41 | Complete |
| BILL-06 | Phase 41 | Complete |
| BILL-07 | Phase 41 | Complete |
| BILL-08 | Phase 41 | Complete |
| BILL-09 | Phase 42 | Pending |
| BILL-10 | Phase 42 | Pending |
| BILL-11 | Phase 42 | Pending |
| BILL-12 | Phase 43 | Pending |
| BILL-13 | Phase 43 | Pending |
| BILL-14 | Phase 43 | Pending |
| BILL-15 | Phase 43 | Pending |
| BILL-16 | Phase 43 | Pending |
| BILL-17 | Phase 43 | Pending |
| BILL-18 | Phase 43 | Pending |
| BILL-19 | Phase 43 | Pending |
| BILL-20 | Phase 43 | Pending |
| BILL-21 | Phase 44 | Pending |
| BILL-22 | Phase 44 | Pending |
| BILL-23 | Phase 44 | Pending |
| BILL-24 | Phase 44 | Pending |
| AUTH-33 | Phase 45 | Pending |
| AUTH-34 | Phase 45 | Pending |
| AUTH-35 | Phase 45 | Pending |
| AUTH-36 | Phase 45 | Pending |
| AUTH-37 | Phase 45 | Pending |
| AUTH-38 | Phase 45 | Pending |
| AUTH-39 | Phase 45 | Pending |
| EMAIL-35 | Phase 45 | Pending |

**Coverage:**
- v1.8 requirements: 32 total (24 BILL + 7 AUTH + 1 EMAIL)
- Mapped to phases: 32 / 32 ✓
- Unmapped: 0

| Phase | Requirements | Count |
|-------|-------------|-------|
| 41 — Stripe SDK + Schema + Webhook Skeleton | BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07, BILL-08 | 8 |
| 42 — Checkout Flow + Plan Selection | BILL-09, BILL-10, BILL-11 | 3 |
| 43 — Paywall Enforcement + Locked-State UX + Trial Banners | BILL-12, BILL-13, BILL-14, BILL-15, BILL-16, BILL-17, BILL-18, BILL-19, BILL-20 | 9 |
| 44 — Customer Portal + Billing Polish + Stripe Emails | BILL-21, BILL-22, BILL-23, BILL-24 | 4 |
| 45 — Login UX Polish + Gmail Quota Raise | AUTH-33, AUTH-34, AUTH-35, AUTH-36, AUTH-37, AUTH-38, AUTH-39, EMAIL-35 | 8 |
| 46 — Andrew Ship Sign-Off | (ship sign-off — no discrete requirement IDs) | 0 |

---

*Requirements defined: 2026-05-10*
*Last updated: 2026-05-10 — traceability complete after roadmap creation*
