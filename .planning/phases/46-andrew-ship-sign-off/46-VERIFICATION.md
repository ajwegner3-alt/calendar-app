---
phase: 46-andrew-ship-sign-off
verified: <TBD — ISO timestamp when Andrew completes UAT>
status: in_progress
score: "0/28 scenarios passed (14 ROADMAP QA + 3 Phase 44 deferred + 4 Phase 45 deferred + 7 supporting)"
signoff_by: Andrew
signoff_at: <TBD>
post_signoff_corrections: []
human_verification_results: []
---

# Phase 46: Andrew Ship Sign-Off — v1.8 UAT Checklist

This is the single audit trail for v1.8 (Stripe Paywall + Login UX Polish) ship sign-off.
Work through this checklist top-to-bottom in one session. Claude runs all Supabase SQL flips
via MCP `execute_sql` on request — Andrew only needs to do browser navigation and Stripe
Dashboard steps. **PREREQ-C must be fully confirmed before running any scenario.** Any
scenario that results in FAIL blocks ship and opens a 46-NN sub-plan; UAT resumes after
the sub-plan passes.

**Ground rule:** 100% pass required. No partial credit. Any single FAIL = ship is blocked
until the scenario is re-run after a fix.

---

## PREREQ-C: Stripe Customer Portal Dashboard Config (BLOCKS ALL UAT)

Complete all four items in Stripe Dashboard before proceeding to any scenario.

- [x] PREREQ-C.1 — Stripe Dashboard → Settings → Billing → Customer portal: **cancel-at-period-end ENABLED** ✓ confirmed Andrew 2026-05-12
- [x] PREREQ-C.2 — Customer portal: **Plan switching ENABLED** with all 4 Prices visible ✓ confirmed Andrew 2026-05-12
- [x] PREREQ-C.3 — Customer portal: **Payment method updates ENABLED** (locked-on by Stripe; cannot be disabled) ✓ confirmed Andrew 2026-05-12
- [x] PREREQ-C.4 — Customer portal: **Invoice history ENABLED** ✓ confirmed Andrew 2026-05-12

**Andrew action only. Claude cannot complete this step. Do not proceed past this block until all four boxes are checked.**

---

## Setup SQL — Read nsi Stripe Customer ID

> **Run ONLY after all four PREREQ-C boxes are confirmed checked.** Do not proceed to any scenario SQL until Section PREREQ-C is fully complete.

Ask Claude to run via MCP `execute_sql`:

```sql
SELECT stripe_customer_id, stripe_subscription_id, subscription_status, plan_tier, trial_ends_at, cancel_at_period_end
FROM accounts
WHERE slug = 'nsi';
```

Setup SQL result (2026-05-12, pre-UAT): `stripe_customer_id = NULL`, `stripe_subscription_id = NULL`, `subscription_status = 'trialing'`, `plan_tier = NULL`, `trial_ends_at = 2026-05-24 14:53:30 UTC`, `cancel_at_period_end = false`. The nsi account is in a clean pre-checkout trialing state — `cus_XXXXX` will be populated by the first Scenario 2.x checkout. Re-read after Scenario 2.x to capture the `cus_XXXXX` for use in Scenarios 6.1/6.2 (Stripe Dashboard customer lookup).

Captured `cus_XXXXX` value after first checkout: `cus_____________` (Claude fills in after Scenario 2.1).

---

## Scenario Group 1 — Trial State + Banners

### Scenario 1.1: Trial flow — 14-day counter (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

**Andrew action:** Log in at production URL, visit `/app`, observe trial banner.

**Expected:** Banner shows "14 days left in trial" (or current day-count); no lockout; full app access.

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew confirmed "I can log in. I see the 14 days left." 2026-05-12_

---

### Scenario 1.2: Urgent trial banner — ≤3 days (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET trial_ends_at = NOW() + INTERVAL '2 days'
WHERE slug = 'nsi';
```

**Andrew action:** Reload `/app` or any `/app/*` page.

**Expected:** Banner upgrades to urgent amber style ("2 days left — upgrade now" or similar urgent copy); still no lockout.

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew confirmed PASS 2026-05-12_

---

## Scenario Group 2 — Checkout (4 live paths + Branding CTA)

### Scenario 2.1: Basic-Monthly checkout (ROADMAP QA)

**SQL reset (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = NULL
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/billing` → click "Basic — Monthly" → Stripe Checkout page loads → enter card `4242 4242 4242 4242` (any future expiry, any CVC) → complete checkout → return URL polls → billing page shows active state.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT subscription_status, plan_tier, plan_interval
FROM accounts
WHERE slug = 'nsi';
```

**Expected:** `subscription_status = 'active'`, `plan_tier = 'basic'`, `plan_interval = 'month'` (or `'monthly'`).

**Result:** - [x] PASS  - [ ] FAIL — _note: PASS after env-var + webhook-event fixes (Andrew 2026-05-12). Initial attempt failed with "Pricing not configured" because Vercel prod env was missing the 4 STRIPE_PRICE_ID_* vars + 4 *_CENTS vars + NSI_BRANDING_BOOKING_URL (PREREQ-B/D regression). Andrew added all 9 env vars and redeployed. Retry checkout completed successfully but plan_tier remained NULL because checkout.session.completed wasn't in webhook endpoint enabled_events (PREREQ-G regression — Phase 41 only subscribed 6 events, never picked up the 7th). Andrew added the event in Stripe Dashboard, then resent the event via Stripe CLI. Webhook then wrote plan_tier='basic' correctly. Final verified DB state: subscription_status='active', plan_tier='basic', plan_interval='month', stripe_customer_id=cus_UVR7kpncyAoDBp, stripe_subscription_id=sub_1TWQGJJ7PLcBbY73sBwlopNX, current_period_end=2026-06-13._

---

### Scenario 2.2: Basic-Annual checkout (ROADMAP QA)

**SQL reset (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = NULL
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/billing` → click "Basic — Annual" → Stripe Checkout → card `4242 4242 4242 4242` → complete → return URL polls.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT subscription_status, plan_tier, plan_interval
FROM accounts
WHERE slug = 'nsi';
```

**Expected:** `subscription_status = 'active'`, `plan_tier = 'basic'`, `plan_interval = 'year'` (or `'annual'`).

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew 2026-05-12 — DB verified: status=active, plan_tier=basic, plan_interval=year, current_period_end=2027-05-13 (1yr), stripe_customer_id reused (cus_UVR7kpncyAoDBp), new sub_1TWQj7J7PLcBbY737qBsFnBt_

---

### Scenario 2.3: Widget-Monthly checkout (ROADMAP QA)

**SQL reset (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = NULL
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/billing` → click "Widget — Monthly" → Stripe Checkout → card `4242 4242 4242 4242` → complete → return URL polls.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT subscription_status, plan_tier, plan_interval
FROM accounts
WHERE slug = 'nsi';
```

**Expected:** `subscription_status = 'active'`, `plan_tier = 'widget'`, `plan_interval = 'month'` (or `'monthly'`).

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew 2026-05-12 — DB verified: status=active, plan_tier=widget, plan_interval=month, sub_1TWQmTJ7PLcBbY73hc9Xjqii, current_period_end=2026-06-13_

---

### Scenario 2.4: Widget-Annual checkout (ROADMAP QA)

**SQL reset (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = NULL
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/billing` → click "Widget — Annual" → Stripe Checkout → card `4242 4242 4242 4242` → complete → return URL polls.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT subscription_status, plan_tier, plan_interval
FROM accounts
WHERE slug = 'nsi';
```

**Expected:** `subscription_status = 'active'`, `plan_tier = 'widget'`, `plan_interval = 'year'` (or `'annual'`).

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew 2026-05-12 — DB verified: status=active, plan_tier=widget, plan_interval=year, sub_1TWQoHJ7PLcBbY73y738n3Ht, current_period_end=2027-05-13 (1yr). All 4 checkout paths now verified end-to-end with webhook plan_tier+plan_interval writes._

---

### Scenario 2.5: Branding card CTA — no DB write (ROADMAP QA)

**Andrew action:** Visit `/app/billing` → click the Branding tier card CTA button.

**Expected:** Browser navigates to `https://booking.nsintegrations.com/nsi/branding-consultation` (same window). No Stripe Checkout. No plan_tier change.

**Verify no DB write (ask Claude to run via MCP execute_sql):**

```sql
SELECT plan_tier
FROM accounts
WHERE slug = 'nsi';
-- Must NOT be 'branding' — column CHECK constraint only allows NULL, 'basic', 'widget'
```

**Result:** - [x] PASS  - [ ] FAIL — _note: Andrew 2026-05-12 — Same-window redirect to booking.nsintegrations.com/nsi/branding-consultation confirmed. Post-click plan_tier still NULL (no DB write). DB was temporarily flipped to trialing+NULL plan_tier so TierGrid would render against the existing active Widget-Annual sub; restored post-test._

---

## Scenario Group 3 — Customer Portal (including Phase 44 deferred items)

> Restore to active before running Group 3 if Group 2 left account in trialing state.

**SQL restore (ask Claude to run if needed):**

```sql
UPDATE accounts
SET subscription_status = 'active',
    plan_tier = 'widget',
    cancel_at_period_end = FALSE
WHERE slug = 'nsi';
```

---

### Scenario 3.1: Manage subscription opens Customer Portal (ROADMAP QA)

**Andrew action:** Visit `/app/billing` → click "Manage subscription" button → Stripe Customer Portal loads.

**Expected:** Portal page loads (not "unconfigured" error — PREREQ-C enables this). Portal shows current plan, payment method, invoice history.

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 3.2: Cancel-at-period-end — Portal end-to-end cancel (Phase 44 deferred)

**Andrew action:** In Stripe Customer Portal → Cancel subscription → choose "Cancel at period end" → confirm → return to `/app/billing`.

**Expected:** Portal shows "Cancels on \<date\>". App `/app/billing` shows amber "cancel scheduled" status card with period-end date. No immediate lockout.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT cancel_at_period_end, subscription_status
FROM accounts
WHERE slug = 'nsi';
-- Expect: cancel_at_period_end = true, subscription_status = 'active'
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 3.3: Reactivation — cancel reversed (ROADMAP QA)

**Andrew action:** Return to Stripe Customer Portal → click "Renew plan" / Reactivate → confirm → return to `/app/billing`.

**Expected:** `cancel_at_period_end = false`; amber status card clears; billing page shows green active card.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT cancel_at_period_end, subscription_status
FROM accounts
WHERE slug = 'nsi';
-- Expect: cancel_at_period_end = false, subscription_status = 'active'
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 3.4: Plan-switching visible across all 4 Prices (ROADMAP QA)

**Andrew action:** Stripe Customer Portal → click "Update plan" or "Change plan". Confirm all 4 options appear: Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual.

**Expected:** All 4 prices selectable. (No need to execute a switch — visibility alone confirms PREREQ-C.2 is correctly configured.)

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 4 — Lifecycle (past_due, lockout, redirect)

### Scenario 4.1: past_due banner — non-blocking (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'past_due'
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/dashboard` and several `/app/*` pages.

**Expected:** Non-blocking past_due amber banner visible on all `/app/*` pages. No redirect to `/app/billing`. App remains fully usable (LD-08).

**Restore after test (ask Claude to run):**

```sql
UPDATE accounts
SET subscription_status = 'active'
WHERE slug = 'nsi';
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 4.2: Lockout on expired trial / canceled (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET subscription_status = 'canceled',
    trial_ends_at = NOW() - INTERVAL '1 day'
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/app/dashboard`.

**Expected:** Redirected to `/app/billing`. The `/app/billing` page renders the locked-state UX (tier selection grid). Does NOT redirect-loop back to `/app/dashboard`.

**Restore after test (ask Claude to run):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 5 — Public Booker + Widget Gating

### Scenario 5.1: Public booker works in every subscription state (ROADMAP QA)

**Test in each state below — ask Claude to run each SQL flip, then visit the booker URL.**

State A — trialing:

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

State B — active:

```sql
UPDATE accounts
SET subscription_status = 'active'
WHERE slug = 'nsi';
```

State C — canceled:

```sql
UPDATE accounts
SET subscription_status = 'canceled',
    trial_ends_at = NOW() - INTERVAL '1 day'
WHERE slug = 'nsi';
```

**Andrew action:** For each state, visit `https://<production-domain>/nsi/<any-event-slug>` in a browser (no login required).

**Expected:** HTTP 200 in all three states; booking form loads and can be submitted (or at minimum renders without a 404/500). Public booker is NEVER gated by subscription status (LD-07).

**Restore after test (ask Claude to run):**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 5.2: Widget gating — Basic tier sees gated message (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET plan_tier = 'basic',
    subscription_status = 'active',
    cancel_at_period_end = FALSE
WHERE slug = 'nsi';
```

**Andrew action:**
1. Visit `/embed/nsi/<event-slug>` — observe result.
2. Visit owner-side embed code page (Settings → Event Types → "Get embed code" dialog) — observe result.

**Expected:**
1. `/embed/nsi/<event-slug>` shows a gated message (NOT a 404 — iframe must not break; LD-17).
2. Owner embed-code dialog shows "Upgrade to Widget" CTA card, not the embed code snippets.

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 5.3: Widget access — Widget tier works (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET plan_tier = 'widget',
    subscription_status = 'active'
WHERE slug = 'nsi';
```

**Andrew action:**
1. Visit `/embed/nsi/<event-slug>` — observe result.
2. Visit owner embed-code page — observe result.

**Expected:** Both surfaces function normally. Embed page shows the booking widget; embed-code dialog shows the code snippets and preview.

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 5.4: Widget access — Trialing overrides plan_tier (ROADMAP QA)

**SQL flip (ask Claude to run via MCP execute_sql):**

```sql
UPDATE accounts
SET plan_tier = 'basic',
    subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days'
WHERE slug = 'nsi';
```

**Andrew action:** Visit `/embed/nsi/<event-slug>`.

**Expected:** Booking widget loads normally even though `plan_tier = 'basic'` — trialing accounts have full widget access (LD-04 + LD-19: trialing checked FIRST in `requireWidgetTier`).

**Restore after test (ask Claude to run):**

```sql
UPDATE accounts
SET plan_tier = 'widget',
    subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days'
WHERE slug = 'nsi';
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 6 — Email UAT (Phase 44 deferred)

> These two scenarios require Stripe Dashboard access and may take more time. They confirm
> the Phase 44 V18-CP-12 inner try/catch is not silently swallowing real email send errors.

---

### Scenario 6.1: trial_will_end email delivers to inbox (Phase 44 deferred)

**Andrew action — Stripe Dashboard test clock approach (primary):**

1. Stripe Dashboard → Billing → Subscriptions → find nsi customer (`cus_____________` from Setup SQL above).
2. Create a test clock simulation: add nsi customer, create a subscription with trial ending in 4 days from now.
3. Advance the test clock to 3 days before trial-end.
4. Stripe fires `customer.subscription.trial_will_end` against the nsi customer ID.
5. Webhook hits production `/api/stripe/webhook` → `sendTrialEndingEmail` fires.
6. Check `ajwegner3@gmail.com` inbox for the trial-ending email.

**Alternative (if test clock not available):**

```bash
stripe trigger customer.subscription.trial_will_end \
  --override customer.subscription:customer=cus_XXXXX
```

Note: CLI override reliability is MEDIUM (known GitHub issue #1119). Dashboard test clock is preferred.

**Expected:** Trial-ending email arrives in `ajwegner3@gmail.com` inbox with subject referencing the trial end date. (Inbox arrival alone proves V18-CP-12 did not swallow a real error.)

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 6.2: invoice.payment_failed email delivers to inbox (Phase 44 deferred)

**Andrew action — Stripe Dashboard approach:**

1. In Stripe Dashboard, attach test card `4000 0000 0000 0341` to the nsi customer as the default payment method. (This card attaches successfully but charges always decline.)
2. Within the test clock simulation from Scenario 6.1 (or a fresh one), advance time past trial end → invoice opens → payment is attempted → `4000 0000 0000 0341` declines → `invoice.payment_failed` fires.
3. **Alternative:** Dashboard → create a new invoice for nsi customer manually → finalize it → `4000 0000 0000 0341` triggers failure on collection.
4. Webhook hits production `/api/stripe/webhook` → `sendPaymentFailedEmail` fires.
5. Check `ajwegner3@gmail.com` inbox.

**Expected:** payment-failed email arrives in inbox with copy referencing retry date (if applicable) or final-notice copy (if `next_payment_attempt = null`).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 7 — Login UX (Phase 45 deferred)

### Scenario 7.1: OAuth button BELOW Card on /app/login (Phase 45 deferred)

**Andrew action:** Open production `/app/login` in a fresh incognito browser window. Observe the vertical layout of the page.

**Expected:** The email/password Card sits ABOVE the "or continue with" divider and Google OAuth button. DOM order: Card → divider → Google button (AUTH-33).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 7.2: OAuth button BELOW Card on /app/signup (Phase 45 deferred)

**Andrew action:** Open production `/app/signup` in a fresh incognito browser window.

**Expected:** Same vertical order as `/app/login`: email/password Card on top, "or continue with" divider and Google OAuth button below (AUTH-33 applied to signup page as well, per Plan 45-02).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 7.3: 3-fail magic-link nudge end-to-end (Phase 45 deferred)

**Andrew action:**
1. Open `/app/login` in production.
2. Enter a valid nsi email address in the email field.
3. Enter a wrong password → submit → observe (nudge should NOT appear yet after 1 failure).
4. Enter another wrong password → submit → observe (nudge should NOT appear yet after 2 failures).
5. Enter a third wrong password → submit → observe.

**Expected after 3rd failure:** An inline magic-link nudge appears below the password field ("Trouble signing in? Email me a sign-in link instead." or similar). Clicking the nudge:
- Switches to the Magic-link tab.
- Email field in the Magic-link tab is pre-filled with the email entered in step 2.

**Also verify:** Counter does NOT advance on network errors or server errors — only on real Supabase 400 credential rejections (AUTH-38).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 7.4: Gmail quota 400/day cap transition (Phase 45 deferred + ROADMAP QA)

**Setup — ask Claude to run via MCP execute_sql:**

```sql
-- Step 1: Delete any existing test rows for today to start clean
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

-- Step 2: Insert 399 synthetic sends for today
INSERT INTO email_send_log (category, account_id, provider, sent_at)
SELECT 'other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW()
FROM generate_series(1, 399);

-- Step 3: Confirm count (expect 399)
SELECT COUNT(*) FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
```

**Andrew action — send #400 (should SUCCEED):**
Trigger a booking confirmation flow through the nsi account that sends one email (e.g., make a test booking at `/nsi/<event-slug>`).

**Expected:** Send #400 succeeds (399 + 1 = 400, which is still at cap, not over). Booking confirmation email arrives.

**Bump to 400 logged — ask Claude to run:**

```sql
INSERT INTO email_send_log (category, account_id, provider, sent_at)
VALUES ('other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW());
-- Count is now 400 → next send attempt must be refused
```

**Andrew action — send #401 (should REFUSE):**
Trigger another booking flow send through the nsi account.

**Expected:** Send is refused with quota-exhausted reason (`RefusedSend`). Email does NOT arrive in the recipient inbox. Quota guard log shows refusal.

**Cleanup — ask Claude to run after this scenario:**

```sql
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
```

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 8 — Webhook Idempotency

### Scenario 8.1: Duplicate event ID replay does not write a second row (ROADMAP QA)

**Andrew action:**
1. Stripe Dashboard → Developers → Webhooks → find the production endpoint.
2. Click on any recent successfully delivered event for nsi.
3. Note the event ID (e.g., `evt_XXXXXXXX`).
4. Click "Resend" to replay the event to production.

**Verify (ask Claude to run via MCP execute_sql):**

```sql
SELECT COUNT(*)
FROM stripe_webhook_events
WHERE stripe_event_id = '<event_id_from_dashboard>';
-- Expect: exactly 1 (the original row; the resend is blocked by ON CONFLICT DO NOTHING)
```

**Expected:** Count = 1. No duplicate write. Idempotency key (`stripe_event_id PRIMARY KEY`) prevents replay (LD-05).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Scenario Group 9 — Static Invariants

### Scenario 9.1: AUTH-29 four-way enumeration-safety invariant (ROADMAP QA)

**Andrew action:**
1. Open `/app/login` in two separate fresh incognito windows.
2. In Window A: enter a known nsi account email, then switch to the Magic-link tab — observe the helper text below the email field.
3. In Window B: enter an email that does NOT belong to any account, then switch to the Magic-link tab — observe the same helper text area.

**Expected:** The helper text is byte-identical in both windows ("We'll send a sign-in link to your inbox" or the exact AUTH-29 copy in the deployed code). The app does NOT reveal whether the email belongs to an account (AUTH-29 four-way enumeration safety, locked by `tests/login-form-auth-29.test.tsx`).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 9.2: Turnstile single-fetch on tab switch (ROADMAP QA)

**Andrew action:**
1. Open `/app/login` in a fresh browser window with DevTools → Network tab open.
2. Switch between the Password tab and the Magic-link tab 5 times.
3. Filter Network for Cloudflare Turnstile token requests.

**Expected:** Exactly one Turnstile token fetch per page load (not one per tab switch). Tab switching does not trigger re-fetches (V15-MP-05 invariant).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 9.3: 3-fail counter advances ONLY on Supabase 400 (ROADMAP QA)

**Andrew action:**
1. Open `/app/login` in production with DevTools → Network throttling set to **Offline**.
2. Enter nsi email + any password → attempt login. Network request fails.
3. Observe the fail counter (magic-link nudge must NOT appear after this attempt).
4. Re-enable network. Enter nsi email + a wrong password → submit (real Supabase 400).
5. Observe counter: nudge must NOT appear after 1 credential failure; it must appear after the 3rd.

**Expected:** Counter advances ONLY on real Supabase 400 auth-rejection (errorKind = "credentials"). Network errors and server 5xx do NOT advance the counter (AUTH-38, locked by `tests/login-form-counter.test.tsx` tests #2 and #3).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

### Scenario 9.4: Gmail quota cap constant is 400 (static check — ROADMAP QA)

**Ask Claude to run (grep, not MCP SQL):**

```bash
grep -n "SIGNUP_DAILY_EMAIL_CAP" lib/email-sender/quota-guard.ts
grep -n "WARN_THRESHOLD_PCT" lib/email-sender/quota-guard.ts
```

**Expected:**
- `SIGNUP_DAILY_EMAIL_CAP = 400` (not 200 — changed in Phase 45-01 commit `048255f`).
- `WARN_THRESHOLD_PCT` computes to 320 when applied to the 400 cap (400 × 0.8).

**Result:** - [ ] PASS  - [ ] FAIL — _note: _________________________________

---

## Final Restoration SQL (run before sign-off)

After all scenarios are complete, restore nsi to a clean trialing state. Ask Claude to run via MCP `execute_sql`:

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

Confirm restoration via:

```sql
SELECT subscription_status, trial_ends_at, cancel_at_period_end, plan_tier
FROM accounts
WHERE slug = 'nsi';
```

---

## Sign-Off

- [ ] All 14 ROADMAP QA scenarios PASS (Scenarios 1.1, 1.2, 2.1–2.5, 3.1, 3.3, 3.4, 4.1, 4.2, 5.1–5.4, 8.1, 9.1–9.4)
- [ ] All 3 Phase 44 deferred items PASS (Scenarios 3.2, 6.1, 6.2)
- [ ] All 4 Phase 45 deferred items PASS (Scenarios 7.1, 7.2, 7.3, 7.4)
- [ ] PREREQ-C confirmed complete (all 4 Customer Portal config items checked)
- [ ] Final Restoration SQL run — nsi account back to trialing state
- [ ] No FAIL items remaining (any FAIL was addressed by a 46-NN sub-plan and the scenario re-ran successfully)

**Andrew sign-off:** _________________________ Date: _________________________

---

## Post-Sign-Off Actions (Claude executes after Andrew's sign-off above)

1. Update this file's frontmatter: set `status: passed`, `verified: <ISO timestamp>`, `signoff_at: <date>`, populate `human_verification_results` list from scenario results above.
2. Run plan **46-04** (write `FUTURE_DIRECTIONS.md` v1.8 section + create `milestones/v1.8-ROADMAP.md` + collapse ROADMAP.md v1.8 entry to one-line summary).
3. Run plan **46-05** (commit all archival changes + create annotated git tag `v1.8.0` + final STATE.md update marking v1.8 shipped).
