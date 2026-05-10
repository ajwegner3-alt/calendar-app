# Domain Pitfalls — v1.8

**Domain:** Multi-tenant Next.js/Supabase booking SaaS — Stripe SaaS billing paywall, login UX polish (AUTH-29 + V15-MP-05 invariants), Gmail quota raise
**Researched:** 2026-05-09
**Confidence:** HIGH (derived from live codebase inspection + v1.0–v1.7 incident record + Stripe official docs)

---

## Critical Pitfalls

### V18-CP-01 — Webhook body parsed as JSON instead of raw text

**What happens:** Next.js App Router automatically parses incoming request bodies as JSON via its built-in body handling. `stripe.webhooks.constructEvent(body, signature, secret)` requires the **raw wire bytes** exactly as Stripe sent them — any re-serialization (even semantically equivalent JSON) invalidates the HMAC signature. If you call `await req.json()` before passing to `constructEvent`, every legitimate Stripe webhook will throw `Stripe webhook signature verification failed` and your handler will return 400. Worse: if you short-circuit the signature check to debug, you accept unsigned POSTs from anyone who knows the URL.

**Warning signs:**
- All webhook events fail locally and in production with `No signatures found matching the expected signature for payload` from the Stripe SDK.
- Handler works when `STRIPE_WEBHOOK_SECRET` is blank-commented out (signature skipped) but fails when the secret is restored.
- `stripe trigger payment_intent.created` from the Stripe CLI fires but your DB never updates.

**Prevention:** In the App Router webhook handler, disable body parsing with `export const dynamic = 'force-dynamic'` and read the body as `await req.text()`. Pass the text string to `stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)`. Never call `req.json()` anywhere in this file. Name the route `app/api/webhooks/stripe/route.ts` and add a test: mock the raw text body, generate a real Stripe test signature, assert `constructEvent` succeeds.

**Phase:** Stripe webhook handler phase (first phase introducing billing).

---

### V18-CP-02 — Webhook handler not idempotent on `event.id`

**What happens:** Stripe retries failed webhook deliveries (5xx or timeout) up to 72 hours with exponential backoff. A cold Vercel start, a brief DB hiccup, or a 504 during the `subscription.updated` handler causes Stripe to retry — potentially hours later. If your handler doesn't deduplicate on `event.id`, side effects fire twice: `subscription_status` is set twice (benign), but a welcome email sends twice, a trial-start timestamp is overwritten with a later value, or a "subscription created" row inserts twice (constraint violation). The insert-on-duplicate-key violation crashes the retry silently and your subscription state is now corrupted.

**Warning signs:**
- `stripe_webhook_events` table (or equivalent) has no `UNIQUE(event_id)` constraint.
- Duplicate rows in any billing-state table keyed on a Stripe event.
- Stripe dashboard shows the same event attempted 3+ times; your logs show 3 successful handler completions.

**Prevention:** Create a `stripe_webhook_events` table with columns `(id uuid, event_id text UNIQUE NOT NULL, event_type text, processed_at timestamptz, created_at timestamptz)`. At the top of every handler, attempt `INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING` using the admin client. If `rowCount === 0`, the event was already processed — return 200 immediately without re-executing side effects. The 200 tells Stripe to stop retrying. Use `ON CONFLICT DO NOTHING` not `DO UPDATE` so the original processing timestamp is preserved.

**Phase:** Stripe webhook handler phase.

---

### V18-CP-03 — Test-mode keys bleed into live-mode (or vice versa)

**What happens:** Stripe has fully separate key namespaces: `sk_test_*` / `pk_test_*` for test mode and `sk_live_*` / `pk_live_*` for live. If `STRIPE_SECRET_KEY` (live) is accidentally used with `STRIPE_PUBLISHABLE_KEY_TEST` (test) in the client — or vice versa — every checkout session call silently fails with "No such customer" or "livemode mismatch" errors. Stripe's error messages for mode mismatch are not obvious; developers often spend hours debugging what looks like a product configuration error.

**Warning signs:**
- `stripe.customers.create()` succeeds but the customer appears in the wrong Stripe Dashboard mode (Test vs Live toggle).
- `stripe.checkout.sessions.create()` throws `"Error: The client_reference_id you provided is not a valid UUID"` — often a symptom of mode mismatch corrupting the session.
- `STRIPE_WEBHOOK_SECRET` doesn't match the signing secret for the endpoint (test and live have different signing secrets).

**Prevention:** Env var naming convention: `STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE`. A single `STRIPE_MODE=test|live` env var controls which pair is active. The Stripe client init file selects based on `STRIPE_MODE` and throws loudly at startup if mode is `live` but the key doesn't start with `sk_live_`. Add a smoke test: create a `$0.50` charge in test mode end-to-end (Stripe test card `4242 4242 4242 4242`) before any live key is configured.

**Phase:** Stripe client setup phase (first phase introducing billing). All phases must guard against env bleed.

---

### V18-CP-04 — Subscription state desync: Stripe says `past_due`, DB says `active`

**What happens:** Your webhook handler fires and updates `accounts.subscription_status`. But if the handler returns 5xx (Vercel cold start, DB connection pool exhausted, unhandled exception), Stripe queues the retry but your DB was never updated. The Stripe subscription has moved to `past_due` or `canceled`; your DB still says `active`. The owner continues to access the app — indefinitely, if Stripe eventually stops retrying. This is silent revenue leakage and billing fraud exposure.

**Warning signs:**
- Vercel function logs show 500s or timeouts on `POST /api/webhooks/stripe` around the time of a failed payment.
- `accounts.subscription_status = 'active'` for an account where `stripe.subscriptions.retrieve(stripe_subscription_id)` returns `status: 'past_due'`.
- Owner is not blocked from the app despite a failed payment email from Stripe.

**Prevention:** Three-layer defense:
1. **Webhook idempotency** (V18-CP-02) minimizes the window.
2. **On-demand reconciliation:** in the billing settings server component (loads on every `/app/settings/billing` visit), call `stripe.subscriptions.retrieve(account.stripe_subscription_id)` and reconcile `accounts.subscription_status` if it differs. Write back with the admin client. This catches drifts without a background job.
3. **Nightly reconciliation script** (Vercel Cron, `0 6 * * *`): query all `accounts WHERE subscription_status IN ('active', 'trialing') AND stripe_subscription_id IS NOT NULL`, call `stripe.subscriptions.retrieve` for each, update any that differ. Log all reconciliations.
Column required: `accounts.stripe_subscription_id text`, `accounts.subscription_status text CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'grandfathered'))`.

**Phase:** Stripe webhook handler phase + billing settings phase. Nightly cron is its own sub-task.

---

### V18-CP-05 — Paywall middleware fires on `/[account]/*` public booker routes

**What happens:** LD-07 (v1.5, Phase 29-01) requires that `/[account]/*` routes never reveal NSI/billing state to invitees. If the paywall middleware naively checks `pathname.startsWith('/app')` it won't catch public routes — but any broader check (e.g., `!publicPaths.includes(pathname)`) will. A single mis-placed conditional redirects a booker trying to book an appointment at `/nsi/30min` to `/app/billing` — exposing that NSI uses this tool, that there is a billing concept, and that the account may have a payment problem. The booker sees a redirect loop or an auth wall with no context.

**Warning signs:**
- A non-authenticated GET to `https://booking.nsintegrations.com/nsi/30min` redirects to `/app/billing` or `/app/login?reason=billing`.
- Any `NextResponse.redirect` in the paywall logic does not first check `!pathname.startsWith('/app')`.
- The existing `proxy.ts` session guard (`pathname.startsWith("/app")`) is modified to include a billing check without path-exemption for public routes.

**Prevention:** The paywall check must live entirely inside the `/app/*` branch of `proxy.ts`. The guard structure must be:
```
if (pathname.startsWith('/app') && !publicAuthPaths.includes(pathname)) {
  // existing auth check
  // NEW: billing paywall check — reads subscription_status from DB
}
```
`/[account]/*`, `/embed/*`, `/api/webhooks/*`, and `/auth/*` must never enter the billing check branch. Write a test: unauthenticated GET to `/test-account/30min` asserts 200, not 3xx.

**Phase:** Paywall middleware phase.

---

### V18-CP-06 — Existing accounts lock out instantly on v1.8 deploy day

**What happens:** v1.8 deploy runs a migration that adds `accounts.trial_ends_at`. If the migration sets `trial_ends_at = created_at + INTERVAL '14 days'`, any account older than 14 days locks out immediately. Andrew's `nsi` account was created in v1.0 (months ago). On deploy day, `trial_ends_at` is set to `[v1.0 creation date] + 14 days` — a date in the past. The paywall middleware reads `trial_ends_at < now()` and `subscription_status IS NULL`, concludes the trial has expired, and redirects Andrew to `/app/billing`. He cannot access the dashboard to add billing details.

**Warning signs:**
- Migration uses `DEFAULT created_at + INTERVAL '14 days'` (not a deploy-date anchor).
- No `grandfathered` status variant in the `subscription_status` CHECK constraint.
- No test that simulates an account created 30 days ago and asserts it is not locked after running the migration.

**Prevention:** Two-option strategy (pick one and commit in the migration):
- **Option A (Grandfather status):** Migration sets `subscription_status = 'grandfathered'` for all `accounts WHERE created_at < [v1.8_deploy_date]`. Paywall reads `subscription_status = 'grandfathered'` as pass-through forever, or until Andrew manually flips them to `active` after they add billing. The paywall logic: `if (status === 'grandfathered') allow; if (status === 'active' || status === 'trialing') allow; else block`.
- **Option B (Deploy-date trial):** Migration sets `trial_ends_at = GREATEST(created_at, NOW()) + INTERVAL '14 days'` — `GREATEST` ensures even old accounts get a 14-day window from deploy day. This is simpler but means old accounts get a trial even if they've used the product for months.
Option A is recommended: it makes the intent explicit and gives Andrew control over when to prompt existing users for billing.
The migration must be grep-verified against `accounts.created_at` (confirmed column, initial schema line 23) before shipping.

**Phase:** Stripe schema migration phase (first billing migration).

---

### V18-CP-07 — Failed payment locks owner out too aggressively (`past_due` vs `unpaid`)

**What happens:** Stripe's dunning process retries failed payments over ~3 weeks before marking a subscription `unpaid`. The sequence is: payment fails → `invoice.payment_failed` → status becomes `past_due` → Stripe retries on schedule (Smart Retries, configurable) → after exhausting retries → `invoice.payment_failed` final → status becomes `unpaid` or `canceled`. If your paywall middleware locks on `past_due`, an owner with a temporarily declined card (hit their limit this week, pays next week) loses dashboard access for up to 3 weeks while Stripe is still actively trying to collect. This will generate support escalations and owner churn.

**Warning signs:**
- Middleware logic: `if (status === 'past_due') redirect('/app/billing')`.
- No grace period or dunning UX (banner with "update your payment method" rather than hard lock).

**Prevention:**
- **Do NOT hard-lock on `past_due`.** Show a non-dismissable in-app banner: "Payment failed — please update your payment method to maintain access." Owner retains full access during the dunning window.
- **Hard-lock on `unpaid` or `canceled`** only. These are post-dunning states where Stripe has given up.
- Implement this in `proxy.ts` as: `if (['unpaid', 'canceled'].includes(status)) redirect('/app/billing/past-due')`.
- Status set by webhook: `invoice.payment_action_required` → set `past_due` + banner flag; `customer.subscription.deleted` or `invoice.payment_failed` (final) → set `unpaid` or `canceled` → hard lock activates.

**Phase:** Paywall middleware phase + webhook handler phase.

---

### V18-CP-08 — Stripe API version not pinned; webhook schema breaks on Stripe's next release

**What happens:** Stripe bumps its API version automatically for new accounts and periodically for existing ones. The Stripe Node SDK defaults to whatever version was current at install time, but the webhook events Stripe sends are shaped by the **endpoint's configured API version** (set in the Stripe Dashboard). If the SDK and the endpoint version differ — e.g., SDK uses `2024-11-20` but the endpoint was created with `2024-06-20` — field names, nested object shapes, and enum values may differ between what you handle and what arrives. The SDK's TypeScript types won't catch this at compile time because the types match the SDK's version, not the endpoint's version.

**Warning signs:**
- Stripe dashboard event logs show `api_version: "2024-06-20"` but your `stripe.ts` init does not specify `apiVersion`.
- A Stripe release changelog contains `BREAKING` entries after your SDK was installed.
- Webhook handler accesses `event.data.object.customer` as a string but Stripe expanded it to an object on a newer version.

**Prevention:** Pin `apiVersion` explicitly in `lib/stripe.ts`:
```typescript
import Stripe from 'stripe';
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20', // pin to verified version; update intentionally
});
```
Set the webhook endpoint's API version to the same value in the Stripe Dashboard. Document the version in the plan. When upgrading the SDK, check the Stripe changelog for breaking changes first.

**Phase:** Stripe client setup phase.

---

### V18-CP-09 — Customer Portal session URL logged or sent to analytics

**What happens:** Stripe Customer Portal sessions are generated via `stripe.billingPortal.sessions.create(...)`. The returned `url` is a short-lived, signed link that gives anyone who holds it full access to the customer's billing portal (payment methods, subscription management, invoice history). If this URL is logged to Vercel's structured logs, sent to an analytics endpoint, or stored in the DB (e.g., as a "recent link" cache), it becomes an attack surface. Stripe portal links are typically valid for 5 minutes but can be used immediately.

**Warning signs:**
- `console.log('Portal URL:', session.url)` in the billing settings server action.
- The URL is returned to the client via an API route that logs the full response.
- Vercel Log Drain or any observability tool is configured to capture full response bodies.

**Prevention:** Never log the `session.url` value. The correct pattern is: generate the URL server-side, immediately return it as a redirect (`NextResponse.redirect(session.url)`) or as a JSON `{ url }` to the client, and let the client redirect. The URL must not appear in any log. The server action should never store the URL anywhere — generate fresh on each request. In the phase plan, add a security review checklist item: "grep the billing action for `console.log` calls that could capture the portal URL."

**Phase:** Billing settings / Customer Portal phase.

---

### V18-CP-10 — `trial_ends_at` timezone math produces 13.5 or 14.5 day trials

**What happens:** `trial_ends_at = NOW() + INTERVAL '14 days'` in UTC is correct if you want "14 days from this UTC moment." But if you present the trial end to the owner as a localized date ("Your trial ends on May 23"), the display date will be timezone-dependent. More critically: if any application code calculates the trial window in the owner's local timezone (e.g., comparing `trial_ends_at` against `new Date()` in the browser), DST transitions or timezone offsets can produce trials that appear to end 30 minutes early or late. The real failure mode is if the migration stores `NOW() AT TIME ZONE account.timezone + INTERVAL '14 days'` — this produces a non-UTC timestamp that will be interpreted as UTC by Postgres comparison operators, shifting the effective end time by ±12 hours.

**Warning signs:**
- Any migration or application code that mixes `NOW() AT TIME ZONE` with an INTERVAL addition.
- Trial end display in the UI uses `toLocaleDateString()` without specifying `timeZone: 'UTC'`.
- An owner in UTC+12 reports "my trial ended a day early."

**Prevention:** Store `trial_ends_at` as UTC always: `NOW() + INTERVAL '14 days'`. All DB comparisons use `NOW() < trial_ends_at` (both UTC). For display, format `trial_ends_at` using `Intl.DateTimeFormat` with the account's IANA timezone (`accounts.timezone`, confirmed column from initial schema). Never calculate trial expiry in the browser — read the `subscription_status` field from the server and pass it as a prop. Add a migration test: `SELECT (NOW() + INTERVAL '14 days')::timestamptz` and verify the result has no timezone offset artifact.

**Phase:** Stripe schema migration phase.

---

### V18-CP-11 — Webhook events arrive out of order; state machine assumes sequence

**What happens:** Stripe does not guarantee event delivery order. `customer.subscription.created` and `invoice.payment_succeeded` (for the first payment) can arrive in either order, separated by seconds or minutes. If your webhook handler for `invoice.payment_succeeded` sets `subscription_status = 'active'` but `customer.subscription.created` arrives later and sets `subscription_status = 'trialing'` (its initial state on a trial plan), you've moved the status backward. Owner was briefly `active`, is now `trialing` with a past trial end — paywall fires.

**Warning signs:**
- Webhook handler for `customer.subscription.created` unconditionally writes `subscription_status` regardless of current DB state.
- No `updated_at` comparison or "only write if this is newer" guard.
- Stripe test event replay (`stripe trigger`) for two events sent 10ms apart shows status flapping.

**Prevention:** Every webhook handler that writes `subscription_status` must be **commutative**: the final state should be the same regardless of arrival order. Strategy: define a status priority order (`active > trialing > past_due > unpaid > canceled`). Webhook handlers only write status if the incoming status is "higher priority" than the current DB value, OR if the event's `created` timestamp is newer than the last status write. Add an `accounts.subscription_status_updated_at timestamptz` column. Handler: `UPDATE accounts SET subscription_status = $new, subscription_status_updated_at = $event_created WHERE id = $account_id AND (subscription_status_updated_at IS NULL OR subscription_status_updated_at < $event_created)`.

**Phase:** Stripe webhook handler phase.

---

## Moderate Pitfalls

### V18-MP-01 — Annual/monthly proration set to `none` causes overpayment

**What happens:** When a user switches from monthly to annual mid-period, Stripe calculates a proration by default. If you set `proration_behavior: 'none'` when calling `stripe.subscriptions.update()`, Stripe bills the full annual price immediately without crediting the remaining monthly days. The customer pays for days they already paid for. For a $29/mo → $290/yr switch on day 20 of a billing cycle, they overpay by ~$19. This is a billing error, not just UX.

**Warning signs:**
- `stripe.subscriptions.update()` call has `proration_behavior: 'none'` or `proration_behavior: 'create_prorations'` without verifying invoice behavior.
- No test that switches plan mid-cycle and asserts the proration invoice amount.

**Prevention:** Use `proration_behavior: 'always_invoice'` for plan switches. This immediately creates and pays an invoice for the prorated difference, giving the customer an immediate credit and charging the adjusted annual amount. For downgrade (annual → monthly), use `proration_behavior: 'always_invoice'` and set `billing_cycle_anchor: 'unchanged'` so the annual remaining credit applies. Document the chosen behavior in the billing settings phase plan and validate with a Stripe test-mode switch.

**Phase:** Billing plan management phase (if plan switching is in scope for v1.8; otherwise flag for v1.9).

---

### V18-MP-02 — Cancel behavior: immediate cancellation vs cancel at period end

**What happens:** `stripe.subscriptions.cancel(subscriptionId)` cancels immediately and stops access now. `stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })` marks the subscription to cancel at the end of the current billing period, preserving access through the paid period. If your "Cancel subscription" button calls the immediate cancel, users lose access the moment they click Cancel even though they've paid for the rest of the month. This drives chargebacks.

**Warning signs:**
- Cancel button handler calls `stripe.subscriptions.cancel()` directly.
- No `cancel_at_period_end` pathway in the code.
- No "you'll retain access until [date]" confirmation dialog before cancellation.

**Prevention:** Default to `cancel_at_period_end: true`. The webhook handler for `customer.subscription.updated` checks `cancel_at_period_end === true` and sets a `cancels_at_period_end: true` flag on the account (show a banner: "Your subscription will end on [date]. Reactivate to continue."). Only offer immediate cancel in a support-facing admin path. The Customer Portal (Stripe-hosted) handles this correctly by default — if using the portal for self-service cancellation, test that its default behavior matches your policy.

**Phase:** Billing settings / Customer Portal phase.

---

### V18-MP-03 — AUTH-29 invariant broken by "helper hint" that differs per email

**What happens:** AUTH-29 requires the magic-link success state to be byte-identical regardless of whether the email is registered, rate-limited, or on the Supabase ~60s inner cooldown. v1.8 may introduce a "helper line" in the login form — e.g., "Make sure you're using the email you signed up with" — visible after submitting the magic-link form. If this line renders only when the email is found in `auth.users` (or only when it is NOT found), it leaks account existence. The v1.7 QA verified AUTH-29 passes. v1.8 login UX polish could regress this if the helper line is gated on backend response shape.

**Warning signs:**
- The helper line render condition reads anything from the server action state beyond `{ success: boolean, formError?: string }`.
- A/B behavior: submit with a real email vs. an unknown email and observe different DOM.
- Any component conditional that branches on whether `error` from `signInWithOtp` was present (server action must swallow this).

**Prevention:** The success state must render identically for all four cases: unknown email, rate-limited, Supabase cooldown, genuine send. The only allowed branch is `success: true` → show success state; `formError: string` → show generic server error (5xx only). Explicitly test: open DevTools Network, submit with `ajwegner3@gmail.com` (known), note the response body. Submit with `doesnotexist@example.com` (unknown). Assert response bodies are byte-for-byte identical. This test is the acceptance gate for the login UX polish phase.

**Phase:** Login UX polish phase.

---

### V18-MP-04 — V15-MP-05 Turnstile lifecycle lock broken by tab-switch remount

**What happens:** V15-MP-05 establishes that the Turnstile widget mounts ONCE per form session. The login form now has Password and Magic-link tabs (Phase 38). If the Turnstile widget is inside `<TabsContent value="magic-link">`, switching from Password → Magic-link → Password → Magic-link remounts the `TabsContent` on each switch (Radix Tabs unmounts inactive content by default). Each remount re-fetches a Turnstile token. On the 3rd switch, the first token has been consumed, the 2nd token may have expired, and the widget is fetching a 3rd. Submitting a form with a stale token causes Cloudflare to reject the verification and the booking/login fails with `Turnstile verification failed`.

**Warning signs:**
- DevTools Network tab shows repeated `challenges.cloudflare.com/turnstile/v0/siteverify` or `turnstile/v0/challenge` requests when switching tabs.
- Turnstile `onSuccess` callback fires more than once per page load.
- `useEffect` cleanup in the Turnstile component does not call `window.turnstile.remove(widgetId)` on unmount.

**Prevention:** Two strategies:
- **Option A (Preferred):** Mount Turnstile outside the tabs, in the parent form component, shared between both tab forms. One token, one mount.
- **Option B:** Use Radix Tabs' `forceMount` prop on `TabsContent` — keeps inactive content mounted (hidden) so Turnstile never unmounts. Validate that the hidden tab's form inputs do not participate in a submit event for the visible tab.
Detection test: open DevTools, tab-switch 3 times, count `turnstile` network requests — must be exactly 1.

**Phase:** Login UX polish phase.

---

### V18-MP-05 — Failed-attempt nudge counter triggered by network error (not auth failure)

**What happens:** The login form's "failed attempt" counter (which nudges toward magic-link after N failures) increments on every submit that does not result in a successful session. If a transient 500 or network timeout causes the `loginAction` server action to error, the counter increments as if the user typed a wrong password. After 2 network errors and 1 real wrong-password attempt, the user is at 3 failures and sees the magic-link nudge — not because they don't know their password, but because Vercel had a blip.

**Warning signs:**
- Counter increment logic in `loginAction` is: "if error, increment" without distinguishing 401 from 500.
- The counter is incremented on the client on every non-success response, regardless of HTTP status.
- Manual test: kill network mid-submit; observe counter advancing.

**Prevention:** Only increment the failed-attempt counter on `error.status === 401` or Supabase's `AuthInvalidCredentialsError` code. Do not increment on `error.status >= 500` or network-level fetch failures (catch block in the action). The server action should return a distinct state shape: `{ authError: true }` for 401 (increment counter) vs `{ serverError: true }` for 5xx (show "Something went wrong, try again" — do not increment counter). On the client, branch on `state.authError` vs `state.serverError` before updating the nudge counter.

**Phase:** Login UX polish phase.

---

### V18-MP-06 — Failed-attempt counter persists across browser sessions via accidental storage

**What happens:** The login failed-attempt counter is implemented in React `useState` — per-component-instance, naturally resets on page unload. This is correct per the v1.8 design ("per-session in-memory"). The risk is an accidental `localStorage.setItem('loginAttempts', ...)` or `sessionStorage.setItem(...)` introduced during implementation, which would persist the counter across tab closes and reloads. A user who made 2 failed attempts last week would see the magic-link nudge on their next fresh login.

**Warning signs:**
- `localStorage.getItem` or `sessionStorage.getItem` calls in the login form component.
- `useEffect` that reads/writes to storage based on attempt count.
- `usePersistentState` or similar custom hook used where plain `useState` was intended.

**Prevention:** Use only `useState` (no storage APIs) for the failed-attempt counter. Explicitly add a test: render the `LoginForm`, fail 2 attempts, unmount the component, remount — assert the counter is 0 on remount. If a `useEffect` is needed for side effects on attempt count change, audit it to confirm it only mutates local state, never storage.

**Phase:** Login UX polish phase.

---

### V18-MP-07 — Soft-lock vs hard-lock decision undefined: owner has unsaved dashboard changes

**What happens:** When a paywall hard-lock fires (subscription `unpaid` or `canceled`), the middleware redirects on every request. If the owner was mid-edit in a form (event type name, availability rules, branding) and a paywall check fires mid-session (e.g., the webhook arrived, DB was updated, and the next navigation request triggers the check), they are redirected and all unsaved changes are lost. This is not a data integrity problem, but it is a UX failure that will generate support tickets.

**Warning signs:**
- No `beforeunload` warning on the dashboard's edit forms.
- The paywall check fires on GET requests for static dashboard shell loads (not just data-mutating requests).
- No "save your work" prompt before the billing redirect.

**Prevention:**
- **Soft lock first:** for `past_due`, show a non-dismissable banner but do NOT redirect. Owners can continue working; they just cannot dismiss the banner.
- **Hard lock only on `unpaid`/`canceled`:** redirect to `/app/billing/locked` which has minimal chrome — just the billing update form, no dashboard navigation. Ensure the redirect page has a "Your data is safe and will be available once billing is resolved" message.
- For forms with unsaved state, existing `useFormState` patterns in this codebase do not persist across redirects — this is acceptable for the MVP. Document it as known UX debt.

**Phase:** Paywall middleware phase.

---

### V18-MP-08 — Gmail per-account quota raise to 450: bounce-rate variance leaves only 50 headroom

**What happens:** The proposed quota raise is from 200 to 450/day, leaving 50 messages of headroom against Gmail's ~500/day personal account soft limit. The original 200 cap was set at 40% of the 500 limit (a 300-message buffer). The raise to 450 cuts the buffer to 50 messages (10%). Gmail's 500/day limit is a soft limit — accounts with high bounce rates, spam complaints, or unusual send patterns can hit suspension at lower thresholds. A single day with 30 bounce-backs (out of 450 sends) plus the 450 legitimate sends could put the account at risk. "Sign-in threshold" (Google's verified-sender trust scoring) further compresses the effective limit.

**Warning signs:**
- `SIGNUP_DAILY_EMAIL_CAP` constant set to 450 with no comment documenting the headroom rationale.
- No bounce-rate monitoring or rejection-rate alert.
- Quota raise is the only change; no degraded-send alerting added.

**Prevention:** Raise to **400 instead of 450** to maintain a 100-message buffer (20% headroom — matching the original 200/300 ratio). The `SIGNUP_DAILY_EMAIL_CAP` constant in `lib/email-sender/quota-guard.ts` is the single canonical location per Phase 36 OQ-1 centralization requirement (one constant, do NOT scatter). Document the headroom reasoning in a comment:
```typescript
// 400/day = 80% of Gmail's ~500/day soft limit.
// Preserving 100-msg buffer (matching original 40% headroom philosophy).
// Raise only via this constant — see Phase 36 OQ-1 centralization.
export const SIGNUP_DAILY_EMAIL_CAP = 400;
```
Add a 90%-warning threshold log at 360 sends (`WARN_THRESHOLD_PCT` already exists at 0.8 — update to 0.9 for the new cap, or add a second threshold). Phase: Gmail quota bump sub-phase.

**Phase:** Gmail quota bump phase.

---

### V18-MP-09 — Stripe customer created without `metadata.account_id`; webhook cannot find the account

**What happens:** When creating a Stripe Customer, you pass account-identifying information. If `metadata` does not include `account_id` (the Supabase `accounts.id` UUID), your webhook handler for `customer.subscription.updated` cannot look up which account to update. You can try to look up by `customer.email`, but email is not unique across accounts in a multi-tenant system (an owner could theoretically use the same email for two accounts, though unlikely). The handler will either update the wrong account or fail with `no matching account found`.

**Warning signs:**
- `stripe.customers.create({ email: owner.email })` call with no `metadata` block.
- Webhook handler for subscription events uses `event.data.object.customer_email` (not `metadata.account_id`) for account lookup.
- `accounts` table has no `stripe_customer_id text` column to enable reverse lookup.

**Prevention:** Always create Stripe customers with:
```typescript
await stripe.customers.create({
  email: ownerEmail,
  metadata: { account_id: account.id }, // Supabase accounts.id
  name: account.name,
});
```
Store `stripe_customer_id` on the `accounts` table (add in billing migration). Webhook handlers look up accounts via `accounts.stripe_customer_id = event.data.object.customer`. This is deterministic and immune to email changes. Also store `stripe_subscription_id` on the account for direct reconciliation (V18-CP-04).

**Phase:** Stripe schema migration phase.

---

### V18-MP-10 — `password` tab is default but existing Google OAuth users are confused

**What happens:** Phase 38 shipped with `defaultValue="password"` on the login tab switcher. After v1.8 launches, some owners who previously only signed up via Google OAuth will visit `/app/login`, see the Password tab, and try to enter a password they never created. They will fail, hit the 3-attempt nudge, request a magic link, and be confused why their "Google login" is gone. Google OAuth is still above the tabs (confirmed by Phase 38 decision log), so it remains accessible — but visual prominence defaulting to Password creates a path confusion.

**Warning signs:**
- No "or continue with Google" copy above the tabs that makes Google OAuth's continued availability obvious.
- The tab toggle is the only login option a user sees on first viewport scroll (Google OAuth is above the fold on desktop, but may be below fold on mobile with a small viewport).

**Prevention:** This is a UX documentation decision, not a code fix. The Google OAuth button already remains at the top (Phase 38 decision lock). The login UX polish phase should verify that the Google OAuth button remains visually prominent and above the Tabs divider on mobile viewports. No last-used tab persistence is needed for MVP; document this as known UX debt if it generates support tickets post-launch.

**Phase:** Login UX polish phase (manual QA checklist item: verify Google OAuth button visible on 375px viewport).

---

### V18-MP-11 — `stripe_webhook_events` table missing from Supabase migrations; schema drift on push

**What happens:** v1.7 lesson: "plans must reference real DB columns — grep migrations before naming fields" (Phase 33 `booker_first_name` incident). For v1.8, the equivalent risk is writing a webhook handler that inserts into `stripe_webhook_events` before the migration that creates that table has been pushed to production. Vercel deploys the function code first; the first Stripe test event fires before the migration is applied; the handler throws `relation "stripe_webhook_events" does not exist`; Stripe marks the delivery as failed; the event is retried; the migration arrives; subsequent retries succeed — but the first event's state was never written. If that first event was `checkout.session.completed`, the new subscriber's account is never activated.

**Warning signs:**
- Stripe integration added to a phase plan without an explicit migration sub-task in the same phase.
- Schema migration and webhook handler code in separate phase plans with no dependency ordering.
- No Supabase `db push` step in the deploy checklist before function deployment.

**Prevention:** The v1.8 billing schema migration (adds `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at` to `accounts`, and creates `stripe_webhook_events`) must be deployed and confirmed BEFORE the webhook handler code goes live. Phase plan ordering: migration sub-task always runs before webhook handler sub-task. Deploy checklist: `supabase db push → verify migration applied → deploy Vercel → register Stripe webhook endpoint → test with Stripe CLI`.

**Phase:** Stripe schema migration phase (prerequisite to all other billing phases).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip nightly reconciliation cron; rely on webhook only | No cron setup overhead | Silent billing desync if webhooks miss | NEVER for paid subscriptions — add from day one |
| Hard-lock on `past_due` | Simple middleware condition | Owner churn from aggressive lockout during dunning | NEVER — lock on `unpaid`/`canceled` only |
| Use `proration_behavior: 'none'` | No proration complexity | Customers overpay on plan switch | NEVER — use `always_invoice` |
| Store `trial_ends_at` as account-timezone timestamp | Localized display is easy | Timezone math errors in comparisons | NEVER — store UTC always |
| Skip `stripe_webhook_events` idempotency table | Faster initial implementation | Double-fire side effects on Stripe retries | NEVER for money-touching handlers |
| Raise Gmail cap to 450 (50-msg buffer) | More sends available | Account suspension risk with high bounce rate | NEVER — 400 maintains the 20% headroom ratio |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe webhooks | `await req.json()` before `constructEvent` | `await req.text()` then pass raw string to `constructEvent` |
| Stripe webhooks | No idempotency check | `INSERT INTO stripe_webhook_events ON CONFLICT DO NOTHING`; return 200 if `rowCount === 0` |
| Stripe webhooks | Assume event order | Commutative status writes gated on `subscription_status_updated_at` |
| Stripe customers | No `metadata.account_id` | Always set `metadata: { account_id }` and store `stripe_customer_id` on `accounts` |
| Stripe keys | Mix test/live keys | Explicit `STRIPE_MODE=test|live`; startup assertion that key prefix matches mode |
| Stripe API version | SDK default version | Pin `apiVersion` in `new Stripe(key, { apiVersion: '...' })` |
| Stripe portal URL | Logged or cached | Generate on demand, `NextResponse.redirect` immediately, never log the URL |
| Next.js + Stripe | Body parser interferes | `export const dynamic = 'force-dynamic'`; read body as `req.text()` |
| Supabase magic-link | Helper hint differs per email | Same DOM for all outcomes; test with known + unknown email, assert byte-identical |
| Turnstile + tabs | `TabsContent` unmounts on tab switch | Mount Turnstile outside tabs or use `forceMount` |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Paywall check fires on `/[account]/*` routes | LD-07 violation: booker sees NSI billing state | Paywall branch guarded strictly inside `pathname.startsWith('/app')` |
| Webhook signature verification skipped | Anyone who knows the URL can forge events | Never skip `constructEvent`; raw body required |
| Customer Portal URL logged | Attacker gains billing portal access | Never log `session.url`; redirect immediately |
| Stripe live keys in non-production Vercel environments | Live charges in preview/test | `STRIPE_MODE` env var + key prefix assertion at startup |
| AUTH-29 broken by conditional helper line | Email enumeration | UI state transitions must be byte-identical for all four AUTH-29 cases |

---

## "Looks Done But Isn't" Checklist

- [ ] **Webhook idempotency:** `stripe_webhook_events` table exists with `UNIQUE(event_id)` constraint; handler returns 200 on duplicate
- [ ] **Webhook signature:** handler uses `req.text()`, not `req.json()`; `constructEvent` called with raw body
- [ ] **Stripe mode isolation:** `STRIPE_MODE` env var set for all Vercel environments; startup assertion on key prefix
- [ ] **Existing account grandfather:** accounts older than v1.8 deploy date have `subscription_status = 'grandfathered'`; none are in past-trial state immediately post-deploy
- [ ] **Paywall path exemption:** GET to `/nsi/30min` with no session returns 200 (not 302 to `/app/billing`)
- [ ] **Dunning grace:** paywall hard-locks on `unpaid`/`canceled` only; `past_due` shows banner, not redirect
- [ ] **Event ordering:** `subscription_status` writes check `subscription_status_updated_at` before overwriting
- [ ] **Desync reconciliation:** billing settings page calls `stripe.subscriptions.retrieve()` on every load; nightly cron exists
- [ ] **AUTH-29 preserved:** submit known email and unknown email on magic-link form; assert byte-identical DOM response
- [ ] **Turnstile lock preserved:** tab-switch 3x on login form; DevTools shows exactly 1 Turnstile token fetch per page load
- [ ] **Failed-attempt counter:** increment only on `AuthInvalidCredentialsError`, not on 5xx/network errors; `useState` only (no storage)
- [ ] **Quota constant:** `SIGNUP_DAILY_EMAIL_CAP` set to 400 (not 450) in `lib/email-sender/quota-guard.ts`; comment documents headroom rationale
- [ ] **Customer Portal URL:** no `console.log` of `session.url` in billing actions; grep confirms
- [ ] **`stripe_webhook_events` migration deployed before handler code:** deploy checklist enforces order

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| V18-CP-01 Raw body | LOW | Fix `req.text()` + redeploy; Stripe will retry any failed events from the last 3 days |
| V18-CP-02 Non-idempotent handler | MEDIUM | Add `stripe_webhook_events` table + dedup logic; audit `email_send_log` for duplicate rows; manually delete dupes |
| V18-CP-04 State desync | LOW-MEDIUM | Run nightly reconciliation ad-hoc against all `active`/`trialing` accounts; fix any that differ from Stripe |
| V18-CP-05 Paywall on booker routes | HIGH | Hotfix deploy within minutes; LD-07 violation affects all live public bookings |
| V18-CP-06 Existing account lockout | HIGH | Emergency migration to set `subscription_status = 'grandfathered'` for all affected accounts; hotfix deploy of paywall to honor `grandfathered` |
| V18-CP-07 Aggressive past_due lock | MEDIUM | Update middleware condition + deploy; reach out to affected owners with apology |
| V18-MP-03 AUTH-29 regression | HIGH | Revert login UX polish change that introduced the conditional; v1.8 must not ship until AUTH-29 test passes |
| V18-MP-08 Gmail cap at 450 | MEDIUM | Update constant to 400; deploy; if Google flags the account, wait 24h and document the incident |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| V18-CP-01 Raw body webhook | Stripe webhook handler | Unit test: mock raw text body + Stripe-signed signature; assert `constructEvent` succeeds |
| V18-CP-02 Webhook idempotency | Stripe webhook handler | Test: send same event twice; assert DB has 1 row in `stripe_webhook_events`; state updated once |
| V18-CP-03 Key bleed | Stripe client setup | Smoke test: test-mode $0.50 charge succeeds; startup throws on key/mode mismatch |
| V18-CP-04 State desync | Webhook handler + billing settings | Manual: kill webhook handler mid-flight (simulate 500); run reconciliation; assert status corrected |
| V18-CP-05 Paywall on public routes | Paywall middleware | Test: unauthenticated GET `/[account]/[slug]` returns 200 after middleware changes |
| V18-CP-06 Existing account lockout | Stripe schema migration | Test: simulate account with `created_at = NOW() - INTERVAL '60 days'`; assert `subscription_status = 'grandfathered'` post-migration |
| V18-CP-07 Aggressive `past_due` lock | Paywall middleware | Test: set `subscription_status = 'past_due'`; assert `/app` renders with banner, no redirect |
| V18-CP-08 Stripe API version | Stripe client setup | Code review: `apiVersion` pinned in `lib/stripe.ts`; Stripe Dashboard endpoint version matches |
| V18-CP-09 Portal URL logged | Billing settings phase | grep `session.url` in billing action files; assert no `console.log` captures it |
| V18-CP-10 Trial timezone math | Stripe schema migration | SQL test: `SELECT NOW() + INTERVAL '14 days'` produces UTC timestamp; no AT TIME ZONE in migration |
| V18-CP-11 Event ordering | Webhook handler | Test: send `subscription.created` then `invoice.payment_succeeded` out-of-order; assert final status is `active` |
| V18-MP-01 Proration | Billing plan management | Stripe test-mode plan switch mid-cycle; verify proration invoice created, not overpayment |
| V18-MP-02 Cancel behavior | Billing settings | Test: cancel in test mode; assert `cancel_at_period_end = true`; user retains access until period end |
| V18-MP-03 AUTH-29 regression | Login UX polish | Byte-comparison test: known email response DOM === unknown email response DOM |
| V18-MP-04 Turnstile lifecycle | Login UX polish | DevTools: tab-switch 3x; assert exactly 1 Turnstile token fetch per page load |
| V18-MP-05 Counter on network error | Login UX polish | Test: mock 500 from `loginAction`; assert attempt counter does not increment |
| V18-MP-06 Counter in storage | Login UX polish | Test: fail 2 attempts, unmount, remount; assert counter is 0 |
| V18-MP-08 Gmail quota 450 vs 400 | Gmail quota bump | Code review: `SIGNUP_DAILY_EMAIL_CAP = 400` in `quota-guard.ts` with comment |
| V18-MP-09 Missing `metadata.account_id` | Stripe schema migration | Code review: `stripe.customers.create` includes `metadata.account_id`; `accounts.stripe_customer_id` populated after creation |
| V18-MP-11 Migration before handler | Stripe schema migration | Deploy checklist: migration applied + verified before Vercel handler deploy |

---

## Sources

- Live codebase inspection: `proxy.ts` (route guard structure), `lib/email-sender/quota-guard.ts` (`SIGNUP_DAILY_EMAIL_CAP = 200`, `WARN_THRESHOLD_PCT = 0.8`), `supabase/migrations/20260419120000_initial_schema.sql` (`accounts.created_at` confirmed), `supabase/migrations/20260506120000_phase34_account_oauth_credentials.sql` (AES-256-GCM pattern), `supabase/migrations/20260507120000_phase36_resend_provider.sql` (`email_provider` column)
- Phase 38 CONTEXT.md + RESEARCH.md: AUTH-29 four-way invariant implementation, Turnstile lifecycle, rate-limit silent path, `useActionState` patterns
- Phase 39 final QA: V15-MP-05 Turnstile lock re-verified PASS on production 2026-05-09
- Phase 37 CONTEXT.md: `SIGNUP_DAILY_EMAIL_CAP` centralization, LD-05 bootstrap-safe Resend path, Phase 36 OQ-1 one-constant requirement
- v1.7 PITFALLS.md: CP-03 bootstrap problem, CP-05 strangler-fig protocol, V15-MP-05 Turnstile lock definition, LD-07 booker-neutrality
- Stripe official docs: `stripe.webhooks.constructEvent` raw body requirement, idempotency recommendations, subscription status lifecycle, proration behavior options, Customer Portal session URL security
- Stripe Changelog: `apiVersion` pinning guidance, `cancel_at_period_end` vs immediate cancel behavior

---

*Domain: Multi-tenant booking SaaS — v1.8 Stripe paywall + login UX polish*
*Researched: 2026-05-09*
