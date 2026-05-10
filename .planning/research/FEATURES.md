# Feature Research

**Domain:** SaaS paywall + billing (Stripe) and login UX polish for multi-tenant Next.js booking tool
**Researched:** 2026-05-09
**Confidence:** HIGH (Stripe mechanics from official docs); MEDIUM (UX patterns from community consensus + multiple sources)

---

## Scope

This file covers v1.8 feature decisions only. v1.7 features (multi-tenant signup, OAuth, magic-link, per-account Gmail) are shipped and out of scope.

**80% focus:** Stripe paywall behavior
**20% focus:** Login UX polish (button reorder, 3-fail nudge, magic-link helper)

---

## Feature Landscape

### Table Stakes (Must have for v1.8 to be usable)

| Feature | Why Expected | Complexity | Dependencies | Constraints |
|---------|--------------|------------|--------------|-------------|
| Trial state banner (countdown) | Users expect to know where they stand; surprises at expiry cause churn | SMALL | Stripe webhook + `subscriptions` DB table | None |
| Trial-expired lockout (full-page, `/app/*` only) | Without hard lockout, paywall has no teeth; soft banners are ignored | MEDIUM | Stripe `customer.subscription.updated` webhook; middleware or server-component guard | LD-07: public booker (`/book/*`) MUST remain unlocked even post-expiry |
| `/app/billing` plan-selection page | The one surface accessible while locked; must let user subscribe | MEDIUM | Stripe Checkout (hosted or Elements); Stripe Products + Prices config | Accessible during lockout — cannot be gated behind the same paywall guard |
| Monthly / annual toggle on `/app/billing` | Every single-plan SaaS with annual pricing uses this; omitting it feels broken | SMALL | Two Stripe Price IDs (monthly + annual); toggle state in React | Annual discount math ("Save X%") must be accurate |
| Stripe Customer Portal link (from `/app/billing`) | Invoices, payment method changes, cancellation — users expect self-serve; building these from scratch violates YAGNI | SMALL | Stripe Customer Portal configured in dashboard; `billing_portal.session.create` API call | Delegate everything Portal handles; do NOT duplicate |
| `cancel_at_period_end` cancellation (via Portal) | Users expect to keep access through paid period after canceling | SMALL (Portal handles it) | Stripe Customer Portal config | Portal handles UI; app must listen to `customer.subscription.updated` webhook to reflect `cancel_at_period_end=true` state |
| Failed-payment in-app banner | `past_due` accounts need a visible nudge to update payment method; Stripe emails may land in spam | SMALL | `invoice.payment_failed` webhook; `subscriptions` DB row status field | Banner must not appear on public booker (LD-07) |
| Trial-will-end banner (last 3 days) | `customer.subscription.trial_will_end` fires exactly 3 days before end — Stripe provides the hook; not using it is a missed conversion moment | SMALL | Stripe `customer.subscription.trial_will_end` webhook | Tone shift: gentle reminder → "your trial ends in N days, add a card" |
| Stripe webhook handler (`/api/stripe/webhook`) | Required for all subscription state sync; without it, app never knows what happened | MEDIUM | Stripe webhook signing secret; event handler for 6+ event types | Must verify `Stripe-Signature` header; raw body required (no JSON middleware pre-parse) |
| `subscriptions` DB table (or column on `accounts`) | App needs a local record of trial state, subscription status, Stripe customer/subscription IDs to make lockout decisions without a Stripe API round-trip on every page load | SMALL | Stripe webhook handler must write to it | Schema: `stripe_customer_id`, `stripe_subscription_id`, `status` (trialing/active/past_due/canceled/unpaid/paused), `trial_ends_at`, `current_period_end`, `cancel_at_period_end` |
| Existing v1.7 account grandfather strategy | v1.8 ships to live accounts; they need a defined state | SMALL (decision) + MEDIUM (migration) | DB migration; decision on `trial_ends_at` anchor | See dedicated section below |
| Google OAuth button below password form | v1.8 scope decision (reorder); parity between `/app/login` and `/app/signup` | SMALL | V15-MP-05 Turnstile lifecycle lock must survive DOM reorder | No functional change — layout only |
| Password-first tab default on `/app/login` | v1.8 scope decision | SMALL | Existing Tabs component | Tab ordering change only |
| 3-fail in-memory counter → magic-link nudge | v1.8 scope decision; in-memory per-session, resets on tab close | SMALL | Existing password form; `useState` or `useRef` counter | AUTH-29 invariant NOT affected (nudge is per failed attempt, not per user identity) |
| Magic-link inline helper wording | v1.8 scope decision; AUTH-29 invariant: identical for all users | SMALL | Existing magic-link tab | See wording guidance below |
| Gmail quota raise 200 → 450 | Single constant change in `quota-guard.ts` | SMALL (1 line) | None | Buffer 50 below Google's 500/day free ceiling |

---

### Differentiators (Could ship in v1.9)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Annual-plan default toggle | Defaulting to annual reduces churn and anchors users on higher commitment; Calendly and similar tools default annual with a "Most popular" badge | SMALL | Andrew's call on which to default; either is defensible |
| Trial extension CTA (5-day extension on card entry) | Appcues found 66% of trial users who enter a card for +5 days convert to paid; softer than hard lockout | MEDIUM | Requires a second Stripe flow; out of v1.8 scope |
| Coupon / promotion code at checkout | Useful for early adopters; Portal supports redemption at plan change | SMALL | Stripe Coupon object; one-time-use promo codes; defer until needed |
| Prorated upgrade/downgrade confirmation | Not applicable for single-plan v1.8; only relevant if multi-plan added | MEDIUM | Irrelevant until second plan tier exists |
| Dunning: custom follow-up email after Stripe retries exhausted | Stripe handles 4 retries automatically; a personal "we noticed a problem" email from the app owner can recover edge cases | SMALL | Can be `invoice.payment_failed` webhook #4 — detect exhausted retries by checking attempt count |
| Lifetime account status page (invoices, MRR, join date) | Satisfies the "I want to know my full history" power user; Portal covers invoices adequately for v1.8 | MEDIUM | Portal already covers invoices; custom page is additive |

---

### Anti-Features (Do NOT Build)

| Anti-Feature | Why Requested | Why NOT Build It | Alternative |
|--------------|---------------|-----------------|-------------|
| Custom invoice history page inside `/app/billing` | Users want to see past invoices | Stripe Customer Portal handles this completely; duplicating it wastes dev time and introduces sync risk | Configure Portal with invoice history enabled; link from `/app/billing` |
| Custom payment method update form | Users want to update card details | Portal handles this; PCI compliance reasons alone make custom card forms inadvisable unless you're using Stripe Elements specifically | Portal link; or Stripe Elements if Portal is insufficient (it won't be) |
| Custom cancellation flow | "We built a better off-boarding" | Portal supports cancellation with optional feedback capture and retention coupons; building this custom doubles the surface area for bugs | Portal with cancellation + feedback enabled |
| "Plan comparison" table (multiple plans) | Looks professional | v1.8 is single-plan; a comparison table with one row is theater | Single pricing card with monthly/annual toggle; add comparison only when a second tier exists |
| Immediate account deletion on cancel | Some apps delete data on cancel | Service businesses depend on their booking history; data should persist for at least 90 days post-cancel | Set subscription status to `canceled`; retain data; notify on final data deletion window |
| Lockout of public booker on trial expiry | "If they're not paying, why should their customers get service?" | VIOLATES LD-07 booker-neutrality invariant AND the explicit v1.8 scope decision. Public booker is the product's revenue mechanism for the owner — locking it punishes the owner's customers for the owner's billing status, and destroys the core value prop | Only lock `/app/*`; public booker stays live always |
| Revealing NSI/billing copy to booker-side users | "Show a 'powered by NSI' upgrade prompt on the booking widget" | VIOLATES LD-07 booker-neutrality. The booker's customers must never see NSI product or billing copy | Keep booker completely brand-neutral; any billing prompts are owner-facing only |
| Magic-link error differentiation per user | "Tell the user if their email isn't registered" | VIOLATES AUTH-29 enumeration-safety invariant — differentiating responses leaks account existence | Same response for all users: "If that email is registered, a magic link is on its way" |
| Per-session magic-link nudge that reveals account state | A nudge saying "Your account uses Google OAuth, not a password" reveals account type | VIOLATES AUTH-29 — the nudge must be triggered by failed password attempts only, not by lookup of the account's auth method | Nudge after N failed attempts regardless of whether the account exists; never reveal auth method |
| Stripe Customer Portal as primary billing UI (no wrapper) | Saves time to just redirect to Portal | Portal needs to be launched from an authenticated session in your app (server-side `billing_portal.session.create`); you need at least a `/app/billing` shell page with the Portal link button | Build minimal `/app/billing` shell; delegate to Portal for the heavy operations |

---

## Stripe Paywall: Mechanics and State Machine

### Subscription Status Values (from Stripe docs, HIGH confidence)

| Status | Meaning | App behavior |
|--------|---------|-------------|
| `trialing` | Free trial active | Show countdown banner; full owner-app access |
| `active` | Paid and in good standing | No banner; full access |
| `past_due` | Latest invoice payment failed; retries in progress | Show "payment failed" banner with Portal link; full access for now |
| `unpaid` | All retries exhausted; no further attempts | Hard lockout same as trial expired |
| `canceled` | Terminal; subscription ended | Hard lockout |
| `paused` | Trial ended without payment method attached | Hard lockout (treat same as trial expired for UX) |
| `incomplete` | Initial payment not completed within 23 hours | Rare; treat as lockout |
| `incomplete_expired` | No further billing; effectively dead | Hard lockout |

### Key Webhook Events (HIGH confidence — Stripe docs)

| Event | Fires when | App action |
|-------|-----------|-----------|
| `checkout.session.completed` | User completes Stripe Checkout | Create/activate subscription record in DB |
| `customer.subscription.created` | Subscription created (includes trial start) | Write `stripe_subscription_id`, `status=trialing`, `trial_ends_at` to DB |
| `customer.subscription.trial_will_end` | 3 days before trial ends | Flip `trial_ending_soon=true` in DB (triggers tone-shift banner) |
| `customer.subscription.updated` | Any subscription change (trial→active, plan change, cancel_at_period_end set) | Sync status, `current_period_end`, `cancel_at_period_end` to DB |
| `customer.subscription.deleted` | Subscription fully canceled | Set status=canceled; lockout |
| `customer.subscription.paused` | Trial ended without payment method | Set status=paused; lockout |
| `customer.subscription.resumed` | Paused subscription becomes active | Set status=active; unlock |
| `invoice.payment_failed` | Charge attempt failed | Set status=past_due; show payment-failed banner |
| `invoice.payment_succeeded` | Charge succeeded | Set status=active; clear any payment-failed banner |

---

## Trial State UX Guidance

### During trial (days 1–11): Subtle, encouraging

A persistent but unobtrusive banner at the top of `/app/*` layout. NOT a modal. NOT a countdown clock on every page. Just visible enough to keep awareness.

Recommended pattern: dismissible top banner with day count.
- Copy direction: "You're on your 14-day free trial. N days remaining. Add a payment method to keep going."
- No tone urgency; no red. Gray or blue-tinted.
- Include "Add payment method" CTA that routes to `/app/billing`.

### Last 3 days (days 12–14): Tone shift

When `customer.subscription.trial_will_end` fires (Stripe sends this exactly 3 days before expiry), shift the banner:
- Amber/yellow color scheme, not red.
- Copy direction: "Your trial ends in N days. Head to billing to keep your calendar running."
- Non-dismissible for the final 3 days. Sticky.

### Trial expired / locked (day 15+): Hard lockout

Pattern: Middleware (Next.js `middleware.ts`) or server-component guard redirects all `/app/*` routes to `/app/billing`, which is the one always-unlocked surface. Do NOT use a floating modal over the existing UI — that pattern is visually noisy and breaks keyboard navigation.

The locked screen at `/app/billing` should:
- Use the existing NS owner-app visual language (not a generic Stripe page).
- Headline: "Everything is waiting for you." (or wordsmithed variant — see below).
- Show the plan card with monthly/annual toggle.
- Single CTA: "Start your subscription" → Stripe Checkout.
- NOT show any reference to NSI branding or billing context to non-owners (LD-07 does not apply here — this IS the owner-facing surface, but keep copy business-focused, not product-promotional).

**Wording note on "Everything is waiting for you! Head over to payments to get set up."**
This is solid direction. If wordsmithing: "Your calendar, bookings, and settings are waiting — add a payment method to unlock." is slightly more specific about what's being unlocked. Andrew's call.

### What stays accessible during lockout

- `/app/billing` — always unlocked (lockout escape hatch)
- `/app/login`, `/app/signup` — always unlocked (auth flows)
- All `/book/*` routes — NEVER locked (LD-07)
- `/api/stripe/webhook` — always reachable (not behind auth)

---

## Plan Selection Page UX

Single plan with monthly/annual toggle. Standard layout (HIGH confidence from multiple SaaS examples):

```
[Monthly] [Annual — Save 17%]   ← Toggle switch, annual highlighted

┌─────────────────────────────┐
│  NSI Booking Tool           │
│  $XX / month                │   ← Price updates based on toggle
│  (billed annually as $XXX)  │   ← Conditional sub-line
│                             │
│  ✓ Unlimited bookings       │
│  ✓ Custom availability      │
│  ✓ Embeddable widget        │
│  ✓ Gmail send integration   │
│                             │
│  [Start Subscription]       │   ← Calls Stripe Checkout
│                             │
│  [Manage billing →]         │   ← Customer Portal link (post-subscribe)
└─────────────────────────────┘
```

**Toggle default:** Recommend defaulting to monthly for initial v1.8 (lower sticker shock, lower-friction first conversion). Andrew can flip to annual default once conversion data exists.

**Annual discount math:** "Save 17%" requires the math to actually be ~17%. Example: $19/mo × 12 = $228; annual price $190 = 16.7% ≈ "Save 17%". Whatever pricing Andrew chooses — compute the actual percentage, not a round number that doesn't match.

**The Portal link** ("Manage billing") should only appear when the account already has an active subscription. Pre-subscription, there is nothing to manage in the Portal.

---

## Stripe Customer Portal: Delegate vs Build

**Delegate to Portal (do NOT build custom):**

| Function | Portal capability | Confidence |
|----------|------------------|------------|
| View invoice history | Yes — full list with PDF download | HIGH |
| Update payment method (card, bank) | Yes | HIGH |
| Cancel subscription (at period end) | Yes — configurable; also captures cancellation feedback | HIGH |
| Apply promotion codes at renewal | Yes | HIGH |
| Switch monthly ↔ annual | Yes — configurable via "Switch plan" in Portal | HIGH |
| View current plan and next billing date | Yes | HIGH |
| Update billing email / address | Yes | HIGH |

**Build custom (Portal cannot handle these):**

| Function | Why custom | Notes |
|----------|-----------|-------|
| Initial plan selection + Stripe Checkout | Portal only exists post-subscription | Must build the plan card + Checkout redirect |
| Trial state display (countdown, locked screen) | App-side state — Stripe doesn't know your UI | Must build |
| `past_due` / `unpaid` in-app banner | App-side UX decision | Must build; Stripe sends emails but can't inject UI |
| "Payment failed" alert inside owner app | App-side | Must build |
| Middleware lockout guard | App routing logic | Must build |

**How to launch Portal:** Server-side API call to `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: '/app/billing' })` — returns a URL, redirect to it. Do NOT store Portal URLs; they expire.

---

## Cancel + Reactivate Flow

**Cancel behavior (delegate to Portal):**
- Portal supports "cancel at period end" — user retains access through the paid period.
- On `customer.subscription.updated` webhook with `cancel_at_period_end=true`, show a banner in the owner app: "Your subscription ends on [date]. You'll retain access until then."
- Do NOT implement immediate cancellation — "cancel at period end" is the standard SaaS expectation.

**Reactivation:**
- If `cancel_at_period_end=true` but subscription is not yet canceled: user can reactivate from Portal (Stripe sets `cancel_at_period_end=false`).
- If subscription is fully `canceled`: cannot be restored via API. User must subscribe again via Checkout. App must handle this gracefully — show the plan selection card, not an error state.

**Data retention post-cancel:** Booking data, event types, availability, and settings must persist. Do NOT delete account data on subscription cancel. Allow at least 90 days dormant before any data purge conversation.

---

## Failed Payment / Dunning

**Stripe handles automatically (HIGH confidence):**
- Smart Retries: up to 4 automated retry attempts over ~3 weeks using ML-optimized timing.
- Stripe-sent emails (when enabled in dashboard): failed payment notification to customer after each failed attempt; includes "update payment method" link.
- Expiring card warning: 1 month before card expires.

**App must handle additionally:**
- On `invoice.payment_failed` webhook: set `status=past_due` in local DB; render in-app payment-failed banner with Portal link.
- On `invoice.payment_succeeded` webhook: reset status to `active`; clear the banner.
- After retries exhausted (subscription goes to `unpaid`): treat as lockout — same middleware guard as trial expiry, redirect to `/app/billing`.

**When does lockout flip?**
- Trial expiry: `trial_ends_at` passes AND no payment method → `paused` or `canceled` → lockout immediately.
- Failed payment: `past_due` does NOT lock immediately (user gets the retry window, ~3 weeks). `unpaid` triggers lockout.
- This is intentional: don't punish an honest payment failure on day 1 of renewal with a hard lockout.

**Owner notification:** In-app banner is sufficient for v1.8. Stripe's own emails (when enabled in the Stripe dashboard) cover the customer email touchpoints. No need to build custom dunning email infrastructure unless Stripe's emails are insufficient.

---

## Email Touchpoints

Stripe sends these automatically when enabled in the dashboard (HIGH confidence — Stripe docs):

| Email | Sender | When | Notes |
|-------|--------|------|-------|
| Trial ending reminder | Stripe | 7 days before trial ends | Configurable; can enable/disable |
| Failed payment notification | Stripe | After each failed charge attempt | Includes payment method update link |
| Expiring card warning | Stripe | 1 month before card expires | Catches involuntary churn |
| Invoice / receipt | Stripe | After successful payment | Auto-sent |

**App must send (not covered by Stripe):**

| Email | When | Notes |
|-------|------|-------|
| Welcome to paid (subscription activated) | On `invoice.payment_succeeded` after trial | Stripe sends a receipt but it's transactional; a warm welcome email is a differentiator, not table stakes |
| Trial started (welcome) | On account creation | Already covered by existing signup flow — confirm onboarding email mentions trial |

**v1.8 table-stakes email decision:** Enable Stripe's built-in emails (trial ending, failed payment, receipt). Do not build custom billing email templates in v1.8 — defer to v1.9 if Stripe's emails prove insufficient.

---

## Multi-Tenant Grandfather Strategy (Existing v1.7 Accounts)

This is the most consequential migration decision for v1.8.

**The problem:** v1.7 shipped accounts with no billing state. When v1.8 deploys, those accounts have no `stripe_customer_id`, no subscription, no trial. The middleware lockout guard would instantly lock them out.

**Options:**

| Option | Description | Tradeoff |
|--------|-------------|----------|
| A: Instant 14-day trial from v1.8 deploy date | Set `trial_ends_at = deploy_date + 14 days` for all existing accounts | Fair to existing users; consistent with new signup flow; simple |
| B: Trial start = account created_at (retroactive) | Calculate trial as if it started when they signed up | Potentially unfair if v1.7 was live for weeks before v1.8 ships — existing users could be immediately locked |
| C: Grandfather permanently free | Never lock v1.7 accounts | Perverse incentive; harder to manage long-term; creates a privileged class |
| D: Extended grace period (e.g., 30 days from deploy) | Give existing users more notice | Generous but arbitrary; doubles the period |

**Recommendation: Option A.** Set `trial_ends_at = v1.8_deploy_timestamp + 14 days` for all pre-existing accounts via a DB migration. This is:
- Fair (everyone gets the full 14 days to decide)
- Consistent (same trial length as new signups)
- Simple (one migration query)
- Auditable (deploy timestamp is in git history)

**Implementation:** DB migration sets `trial_ends_at` and `status=trialing` for all accounts lacking a `stripe_customer_id`. The webhook handler never fires for these accounts until they hit Checkout — the app must treat "no subscription record" as `trialing` with the migration-set `trial_ends_at`.

**Communication:** Send an in-app banner (or email if Resend is live for their accounts) on first login post-v1.8 deploy: "We're introducing paid plans. You have 14 days free — no action needed."

---

## Login UX

### Google OAuth button placement (Question 9)

**Pattern consensus (MEDIUM confidence — multiple 2025 sources, no RCT data):**
Most SaaS tools currently place Google OAuth above the email/password form. The convention is rooted in "put the most popular method first."

**v1.8 decision:** v1.8 REVERSES this by placing Google below the password form. The stated rationale (from the milestone context) is "password muscle memory" — existing owners who signed up via email/password will reflexively look for the password form first. This is a valid product decision for a tool where:
1. The user base is small and established (not a viral growth product)
2. Email/password signup was the primary onboarding path until v1.7

**Implementation note:** This is a layout reorder only. No functional change. V15-MP-05 Turnstile lifecycle lock must be preserved — verify Turnstile is not bound to a DOM position that changes.

### 3-fail magic-link nudge (Question 10)

**Standard pattern (MEDIUM confidence):**
After N failed attempts, show an inline alert (not a modal, not a shake animation) below the submit button. The alert contains a CTA that switches to the magic-link tab.

Recommended UX:
```
[amber inline alert]
"Having trouble with your password? Try signing in with a magic link instead."
[→ Use magic link]   ← button that switches tabs
```

**Counter behavior:**
- In-memory `useRef` or `useState` on the password form component. NOT stored in localStorage (resets on tab close is the desired behavior).
- Increment on each `signInWithPassword` failure (any error: wrong password, rate limited, etc.).
- At count >= 3: render the nudge inline. Do not hide the password form — user may still want to try.
- Counter does NOT reset on successful login (redirect happens; component unmounts).
- Counter does NOT differentiate by email address — AUTH-29 invariant: counter is per-session, per-device, not per-identity.

**What the nudge must NOT do:**
- Must NOT say "Your account uses Google OAuth" or any identity-specific message (AUTH-29).
- Must NOT reveal whether the email address is registered.
- Must NOT auto-switch tabs (user choice to click the CTA).

### Magic-link inline helper wording (Question 11)

**AUTH-29 invariant constraint:** The same string must appear for ALL users regardless of whether their email is registered, whether they signed up via Google or password, etc.

**Recommended wording (MEDIUM confidence — derived from pattern research):**
> "Make sure you're using the email address you signed up with."

Alternative if more helpful tone desired:
> "Enter the email you used when you created your account."

**What NOT to say:**
- "If your email is registered, you'll receive a link" — this is AUTH-29 compliant but sounds hedging; fine to use if AUTH-29 paranoia demands it, but the inline helper is a UX hint, not a security disclaimer.
- "Check your spam folder" — too instructional for a pre-send helper; save this for the post-send confirmation screen.
- "No account? Sign up here" — reveals the negative case; violates AUTH-29 spirit even if not technically enumeration (no lookup is performed).

**Placement:** Below the email input, above the submit button. Static text (not tied to form state), always visible on the magic-link tab. Same for all users.

---

## Feature Dependencies

```
[Stripe Products + Prices configured in Stripe dashboard]
    └──required by──> [/app/billing plan card + Checkout redirect]
                          └──required by──> [Trial-expired lockout UX]
                                                └──required by──> [Middleware guard]

[Stripe webhook handler (/api/stripe/webhook)]
    └──writes to──> [subscriptions DB table / accounts billing columns]
                        └──read by──> [Trial countdown banner]
                        └──read by──> [Trial-expired lockout guard]
                        └──read by──> [past_due payment-failed banner]

[subscriptions DB table]
    └──required by──> [All paywall UX surfaces]

[customer.subscription.trial_will_end event]
    └──triggers──> [Tone-shift banner (last 3 days)]

[Stripe Customer Portal]
    └──launched from──> [/app/billing Manage button]
    └──handles──> [invoice history, payment method, cancellation, plan switch]

[Login form reorder]
    └──must preserve──> [V15-MP-05 Turnstile lifecycle lock]

[3-fail counter]
    └──must NOT read──> [user identity / account existence]  ← AUTH-29
```

---

## MVP Definition (v1.8)

### Launch With (v1.8)

- [x] Stripe Products + Prices (monthly + annual) configured in Stripe dashboard
- [x] `subscriptions` table (or billing columns on `accounts`) with status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id
- [x] DB migration: set trial_ends_at for all pre-existing v1.7 accounts
- [x] Stripe webhook handler with signature verification; handles 8+ lifecycle events
- [x] `/app/billing` plan-selection page (monthly/annual toggle, Checkout redirect)
- [x] Middleware or server-component lockout guard — `/app/*` minus `/app/billing`
- [x] Trial countdown banner (days remaining; neutral tone)
- [x] Trial-will-end tone-shift (last 3 days; amber; non-dismissible)
- [x] Trial-expired lockout screen (locked `/app/*` → `/app/billing`)
- [x] Past-due payment-failed banner (with Portal link)
- [x] Stripe Customer Portal link on `/app/billing` (post-subscription)
- [x] Stripe built-in emails enabled in dashboard (trial reminder, failed payment, receipt)
- [x] LD-07 compliance verified: public booker unlocked regardless of subscription status
- [x] Login form reorder (Google below password; parity on `/app/login` + `/app/signup`)
- [x] Password-first tab default on `/app/login`
- [x] 3-fail in-memory counter → magic-link nudge
- [x] Magic-link inline helper wording (AUTH-29 invariant)
- [x] Gmail quota constant raised 200 → 450 in `quota-guard.ts`

### Defer to v1.9

- [ ] Custom welcome-to-paid email template — Stripe receipt covers it for now
- [ ] Trial extension offer (+5 days on card entry) — tested to convert at 66% but adds checkout complexity
- [ ] Coupon / promotion code support at checkout
- [ ] Custom dunning follow-up email (app-sent) after Stripe's retries exhaust
- [ ] Annual plan as default toggle selection (defer until conversion data exists)
- [ ] Lifetime invoice / account history page (Portal handles invoices adequately)
- [ ] Multi-plan pricing tiers

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stripe webhook handler | HIGH (everything depends on it) | MEDIUM | P1 |
| `subscriptions` DB table + migration | HIGH (blocks all paywall features) | SMALL | P1 |
| Trial lockout middleware + `/app/billing` | HIGH (the paywall) | MEDIUM | P1 |
| Trial countdown banner | HIGH (conversion; trust) | SMALL | P1 |
| Past-due payment-failed banner | HIGH (revenue recovery) | SMALL | P1 |
| Customer Portal link | HIGH (self-serve) | SMALL | P1 |
| Monthly/annual toggle on plan card | HIGH (annual = lower churn) | SMALL | P1 |
| Stripe built-in emails (dashboard config) | HIGH (dunning, trial reminders) | SMALL (dashboard config) | P1 |
| Grandfather migration for v1.7 accounts | HIGH (prevents instant lockout) | SMALL | P1 |
| Login form reorder | MEDIUM (UX polish) | SMALL | P1 |
| 3-fail nudge | MEDIUM (recovery path) | SMALL | P1 |
| Magic-link helper | MEDIUM (onboarding friction) | SMALL | P1 |
| Gmail quota raise | LOW (operational headroom) | SMALL (1 line) | P1 |
| Welcome-to-paid email | MEDIUM (retention) | SMALL | P2 |
| Trial extension offer | MEDIUM (conversion) | MEDIUM | P2 |

---

## Sources

- [Stripe: Configure trial offers](https://docs.stripe.com/billing/subscriptions/trials) — trial mechanics, `trialing` status, `customer.subscription.trial_will_end` event (HIGH confidence)
- [Stripe: Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — all subscription lifecycle events, status values (HIGH confidence)
- [Stripe: Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel) — cancel at period end, reactivation limits (HIGH confidence)
- [Stripe: Customer Portal configuration](https://docs.stripe.com/customer-management/configure-portal) — Portal capabilities (HIGH confidence)
- [Stripe: Automate customer emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails) — built-in email types, configuration (HIGH confidence)
- [Stripe: Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries) — dunning retry mechanics (HIGH confidence)
- [Appcues: Trial-to-paid acceleration](https://www.appcues.com/blog/from-trial-to-paid-how-we-accelerated-sales-by-68-percent-with-our-very-own-paywall) — trial extension 66% conversion stat (MEDIUM confidence — single source)
- [Authgear: Login & Signup UX 2025 Guide](https://www.authgear.com/post/login-signup-ux-guide) — OAuth placement conventions, failed login patterns (MEDIUM confidence)
- [LogRocket: Modal UX best practices](https://blog.logrocket.com/ux-design/modal-ux-best-practices/) — modal vs banner for critical actions (MEDIUM confidence)
- [Userpilot: Modal UX Design for SaaS 2026](https://userpilot.com/blog/modal-ux-design/) — trial expiry lockout modal patterns (MEDIUM confidence)
- [Baytech: Magic links UX 2025](https://www.baytechconsulting.com/blog/magic-links-ux-security-and-growth-impacts-for-saas-platforms-2025) — magic link patterns and fallback UX (MEDIUM confidence)
- [Stripe Subscription status reference](https://mrcoles.com/stripe-api-subscription-status/) — `past_due` vs `unpaid` distinction and timing (MEDIUM confidence — third-party verified against official docs)

---
*Feature research for: NSI Booking Tool v1.8 — Stripe Paywall + Login UX Polish*
*Researched: 2026-05-09*
