# Phase 41: Stripe SDK + Schema + Webhook Skeleton - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The billing foundation: install Stripe SDK (LD-01), add billing columns to `accounts`, create `stripe_webhook_events` idempotency table, update the `provision_account_for_new_user` trigger to default new signups to `trialing`, and ship a working signature-verifying webhook handler at `POST /api/stripe/webhook` that routes lifecycle events to DB writes.

**Not in this phase:** Checkout flow / `/app/billing` page (Phase 42), paywall middleware (Phase 43), Customer Portal + transactional emails (Phase 44).

**Locked decisions inherited from milestone (do not reopen):**
- LD-01 stripe@22.1.1, apiVersion `2026-04-22.dahlia`
- LD-05 idempotency via `stripe_webhook_events (stripe_event_id PRIMARY KEY)` + `ON CONFLICT DO NOTHING`
- LD-06 `await req.text()` before `constructEvent()` — never `req.json()` first
- LD-09 existing accounts grandfathered with `trial_ends_at = NOW() + 14 days` at deploy

</domain>

<decisions>
## Implementation Decisions

### Schema scope (7 columns, not 6)

The roadmap-listed 6 columns are confirmed, plus a 7th added in this discussion:

- `stripe_customer_id` text
- `stripe_subscription_id` text
- `subscription_status` text
- `trial_ends_at` timestamptz
- `current_period_end` timestamptz
- `plan_interval` text (`'monthly'` | `'annual'`)
- **`trial_warning_sent_at` timestamptz** — NEW. Set by webhook when `customer.subscription.trial_will_end` arrives. Phase 44 reads it to gate the trial-ending email and avoid duplicates.

Plus the `stripe_webhook_events` table with `stripe_event_id text PRIMARY KEY`.

### Webhook event coverage (Phase 41 routes all of these to DB writes)

- `customer.subscription.created` — set `stripe_subscription_id`, `subscription_status`, `current_period_end`, `plan_interval`
- `customer.subscription.updated` — update `subscription_status`, `current_period_end`, `plan_interval` (always trust payload's status field, never event ordering)
- `customer.subscription.deleted` — set `subscription_status = 'canceled'`
- `customer.subscription.trial_will_end` — set `trial_warning_sent_at = NOW()`
- `invoice.payment_failed` — update `subscription_status` per payload
- `invoice.payment_succeeded` — update `subscription_status` per payload
- **Unknown event types** — log + return 200, AND record into `stripe_webhook_events` for full audit trail

### Webhook failure semantics

- **Signature verification failure:** return 400; log timestamp + source IP + error message only. No payload (PII risk + attacker probe).
- **DB-write failure after dedupe row inserted:** delete the just-inserted `stripe_webhook_events` row, then return 500 so Stripe's retry can succeed cleanly on next attempt.
- **Multi-column updates:** single atomic `UPDATE accounts SET ... WHERE id = ...` statement with all changed columns. No transaction wrapping needed for single-row updates.
- **Out-of-order events:** trust the payload's `status` field on each event, not event timestamp ordering. Stripe-recommended pattern.

### Migration delivery

- Apply via `mcp__claude_ai_Supabase__apply_migration` with a versioned migration name (matches v1.7 Phase 35/40 pattern).
- **Single migration / single transaction:** `ALTER TABLE` adds the 7 columns + creates `stripe_webhook_events` + updates the `provision_account_for_new_user` trigger + runs the backfill `UPDATE accounts SET trial_ends_at = NOW() + INTERVAL '14 days', subscription_status = 'trialing' WHERE stripe_customer_id IS NULL`. All-or-nothing.
- **Validate first on a Supabase preview branch** (`mcp__Supabase__create_branch`): apply migration there, test new-signup trigger + webhook end-to-end, then merge to production.
- **Rollback plan:** write the reverse migration (DROP COLUMN / DROP TABLE / restore old trigger) alongside the forward migration in the phase plan. Do not apply unless needed; document the runbook.

### Observability

- **Success-path logging (every event):** `stripe_event_id`, event type, `account_id`, `stripe_subscription_id`, outcome (`routed` / `duplicate` / `unknown` / `error`).
- **Log destination:** `console.log` / `console.error` only — surfaced through Vercel runtime logs. Matches v1.7 pattern; no Sentry / no new DB log table for this phase.
- **Signature-verify failure log:** timestamp + source IP + error message only. No payload.
- **DB-write failure log:** `console.error` with event_id + account_id + error message. Stripe retries handle recovery; no Sentry alert in this phase.

### End-to-end verification

- Use `stripe trigger customer.subscription.updated` from Stripe CLI against the deployed endpoint after PREREQ-F (webhook registered).
- Replay the same event_id manually to verify idempotency: confirm exactly 1 row in `stripe_webhook_events` and exactly 1 column update on `accounts`.
- Confirm Andrew's `nsi` test account has `subscription_status = 'trialing'` and `trial_ends_at ≈ deploy_time + 14 days` post-migration.

### Claude's Discretion

- Stripe client structure (singleton in `lib/stripe/client.ts` vs per-route instantiation; env switching between test/live keys)
- Exact migration filename / version label
- Internal organization of the webhook handler file (single switch vs per-event helper functions)
- TypeScript types for webhook event payloads (Stripe SDK types vs hand-rolled)

</decisions>

<specifics>
## Specific Ideas

- Webhook handler should mirror the v1.7 fail-closed pattern from `getSenderForAccount` — verify, dedupe, write, fail loudly to logs on any unexpected state.
- Migration should match the audit style Andrew has come to expect from v1.7 Phase 21 / Phase 28 (single transaction, named migration, test on branch first).
- Andrew's `nsi` test account is the canary — its grandfather state is the V18-CP-06 pre-merge check.

</specifics>

<deferred>
## Deferred Ideas

- **Sentry / structured logging integration** — Phase 41 stays on `console.*` + Vercel logs. Future improvement candidate for `FUTURE_DIRECTIONS.md` if webhook debugging becomes painful.
- **`last_processed_event_at` column** for stricter event ordering — not needed because we trust payload status. Revisit only if out-of-order events cause real bugs.
- **Custom `stripe_webhook_log` table** for persistent audit — deferred; `stripe_webhook_events` (idempotency) is enough for now.
- **Email dispatch on `trial_will_end`** — Phase 41 only writes `trial_warning_sent_at`. Phase 44 reads it and sends the email through `getSenderForAccount` (LD-11).

</deferred>

---

*Phase: 41-stripe-sdk-schema-webhook-skeleton*
*Context gathered: 2026-05-10*
