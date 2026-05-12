# Phase 46: Andrew Ship Sign-Off — Research

**Researched:** 2026-05-11
**Domain:** UAT orchestration, Stripe test-mode event triggering, Supabase state flips, migration repair, git tagging, ROADMAP archiving
**Confidence:** HIGH (all facts verified from source files or official docs)

---

## Summary

Phase 46 is a verification-and-archival phase with no new feature code. The planner needs five
concrete artifacts: (1) a linear UAT checklist with embedded SQL stubs and Stripe trigger
instructions, (2) a migration-repair sub-plan for phases 36/37/41 schema_migrations gaps,
(3) a FUTURE_DIRECTIONS.md v1.8 append, (4) ROADMAP archival + collapse, and (5) a v1.8.0
annotated git tag.

All accounts table columns are confirmed from source migrations. The `email_send_log` quota-
manipulation approach is confirmed from `quota-guard.ts`. The `supabase migration repair
--linked --status applied` command is the canonical tool for dormant-entry repair (no raw SQL
INSERT needed). All prior tags (v1.0..v1.7) are annotated — v1.8.0 must be annotated too.
FUTURE_DIRECTIONS.md exists at project root and must receive a new `## v1.8` section appended
after the existing content. No v1.8-ROADMAP.md milestone archive exists yet; it must be created
mirroring the v1.7-ROADMAP.md structure.

**Primary recommendation:** Build the VERIFICATION.md checklist first; all other deliverables
(sub-plan 46-01 migration repair, FUTURE_DIRECTIONS append, ROADMAP archive, git tag) follow
naturally after checklist sign-off.

---

## 1. Stripe CLI / Dashboard Event Triggers

### Confirmed supported events for `stripe trigger`

The `stripe trigger` command accepts these Stripe event names (verified from
https://docs.stripe.com/cli/trigger):

- `customer.subscription.trial_will_end` — supported
- `invoice.payment_failed` — supported

**Syntax:**

```bash
stripe trigger customer.subscription.trial_will_end
stripe trigger invoice.payment_failed
```

**Critical limitation:** `stripe trigger` creates *new* synthetic API objects. It does NOT
fire the event against the existing `nsi` Stripe Customer ID (cus_*). The triggered event
will reference a freshly-created test customer, not the nsi row in Supabase.

**Consequence for UAT:** Webhook fires but `handleSubscriptionEvent` / `handleInvoiceEvent`
will not find the nsi account via `stripe_customer_id` lookup → the account row is not
updated. The only way to use `stripe trigger` for inbox confirmation is to accept that the
webhook logs `account_not_found` and treat inbox arrival alone as the email-delivery test,
OR use the override flag:

```bash
# Attempt to override customer parameter (LOW confidence — CLI may not accept on these events)
stripe trigger customer.subscription.trial_will_end \
  --override customer.subscription:customer=cus_XXXXX
```

**More reliable path (Stripe Dashboard — Simulations / Test Clocks):**

For `customer.subscription.trial_will_end`:
1. Dashboard → Billing → Subscriptions → Simulations (test clock)
2. Create a simulation with the nsi Customer, add a subscription with a trial ending in 4 days
3. Advance clock to 3 days before trial end → Stripe fires real `customer.subscription.trial_will_end` against the nsi customer
4. Webhook hits production `/api/stripe/webhook` → `sendTrialEndingEmail` fires → check `ajwegner3@gmail.com` inbox

For `invoice.payment_failed`:
1. Attach test card `4000 0000 0000 0341` to the nsi Stripe Customer as default payment method
2. Within a test clock simulation, advance time past trial end → draft invoice → after ~1hr invoice opens → payment fails → `invoice.payment_failed` fires
3. OR: use the Stripe Dashboard to manually create an invoice for the nsi customer and finalize it — the 0341 card triggers failure on collection

**Test cards (HIGH confidence — official Stripe docs):**

| Card number | What it does |
|-------------|-------------|
| `4242 4242 4242 4242` | Always succeeds (Visa) |
| `4000 0000 0000 0341` | Attaches successfully; charges always decline → `invoice.payment_failed` |
| `4000 0027 6000 3184` | 3D Secure required |

**Finding the nsi Stripe Customer ID:**

The nsi account (`id = ba8e712d-28b7-4071-b3d4-361fb6fb7a60`) has `stripe_customer_id`
written by Phase 42.5 checkout. Read it via Supabase MCP:

```sql
SELECT stripe_customer_id, stripe_subscription_id, subscription_status, plan_tier
FROM accounts
WHERE slug = 'nsi';
```

Then locate `cus_XXXXX` in Stripe Dashboard → Customers → search for that ID.

**Confidence:** HIGH for CLI syntax; MEDIUM for override-flag support (known GitHub issue
#1119 documents that `--add customer` param doesn't reliably thread to subscription events);
HIGH for test clock / Dashboard approach.

---

## 2. Supabase MCP State-Flip SQL Stubs

### Confirmed tables and columns

From source migrations and `quota-guard.ts` (HIGH confidence):

**`public.accounts` columns relevant to UAT:**

| Column | Type | Source migration |
|--------|------|-----------------|
| `subscription_status` | TEXT CHECK IN ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused') | `20260510120000_phase41_stripe_billing_foundation.sql` |
| `trial_ends_at` | TIMESTAMPTZ | phase41 |
| `current_period_end` | TIMESTAMPTZ | phase41 |
| `plan_interval` | TEXT CHECK IN (NULL, 'monthly','annual','month','year') | phase41 |
| `trial_warning_sent_at` | TIMESTAMPTZ | phase41 |
| `cancel_at_period_end` | BOOLEAN DEFAULT FALSE | `20260511120000_phase44_cancel_at_period_end.sql` |
| `plan_tier` | TEXT CHECK IN (NULL,'basic','widget') | `20260510130000_phase42_5_plan_tier.sql` |
| `stripe_customer_id` | TEXT UNIQUE | phase41 |
| `stripe_subscription_id` | TEXT UNIQUE | phase41 |

**`public.email_send_log` columns relevant to UAT:**

| Column | Type | Source migration |
|--------|------|-----------------|
| `id` | bigserial PK | `20260428120003_phase10_email_send_log.sql` |
| `sent_at` | TIMESTAMPTZ DEFAULT now() | phase10 |
| `category` | TEXT | phase10 + phase31 |
| `account_id` | UUID | `20260506140000_phase35_email_send_log_account_id.sql` |
| `provider` | TEXT DEFAULT 'gmail' | `20260507120000_phase36_resend_provider.sql` |

### One-liner SQL stubs for each UAT scenario

All stubs target `slug = 'nsi'`. Execute via Supabase MCP `execute_sql`.

**A. Flip trial → expired (locks /app/*, triggers LockedView)**

```sql
UPDATE accounts
SET subscription_status = 'canceled', trial_ends_at = NOW() - INTERVAL '1 day'
WHERE slug = 'nsi';
```

_Restore to trialing after test:_
```sql
UPDATE accounts
SET subscription_status = 'trialing', trial_ends_at = NOW() + INTERVAL '14 days'
WHERE slug = 'nsi';
```

**B. Flip to active (after checkout simulation)**

```sql
UPDATE accounts
SET subscription_status = 'active'
WHERE slug = 'nsi';
```

**C. Flip cancel_at_period_end true (Customer Portal cancel path)**

```sql
UPDATE accounts
SET cancel_at_period_end = TRUE
WHERE slug = 'nsi';
```

_Revert:_
```sql
UPDATE accounts
SET cancel_at_period_end = FALSE
WHERE slug = 'nsi';
```

**D. Flip past_due (non-blocking banner scenario)**

```sql
UPDATE accounts
SET subscription_status = 'past_due'
WHERE slug = 'nsi';
```

**E. Flip plan_tier basic ↔ widget**

```sql
-- Set basic (widget gated)
UPDATE accounts SET plan_tier = 'basic' WHERE slug = 'nsi';

-- Set widget (full access)
UPDATE accounts SET plan_tier = 'widget' WHERE slug = 'nsi';
```

**F. Bump email_send_log count to 399 (one below cap)**

The quota guard reads `email_send_log` rows for `account_id` = nsi UUID (`ba8e712d-28b7-4071-b3d4-361fb6fb7a60`) where `sent_at >= UTC midnight today`. Insert synthetic rows:

```sql
-- First: delete any today rows from test account to start clean
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

-- Insert 399 rows with today's UTC timestamp
INSERT INTO email_send_log (category, account_id, provider, sent_at)
SELECT 'other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW()
FROM generate_series(1, 399);
```

_Then verify count:_
```sql
SELECT COUNT(*) FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
-- Expect: 399
```

_After the "OK send" test (count = 399 → allow), bump to 400:_
```sql
INSERT INTO email_send_log (category, account_id, provider, sent_at)
VALUES ('other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW());
-- Count is now 400 → next send attempt must refuse
```

_Clean up test rows after quota UAT:_
```sql
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
```

**G. Force trial banner urgency (<=3 days)**

```sql
UPDATE accounts
SET trial_ends_at = NOW() + INTERVAL '2 days'
WHERE slug = 'nsi';
```

**H. Reset nsi to clean trialing (grand restoration)**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

**Confidence:** HIGH — all column names confirmed from source SQL migrations, quota logic confirmed from `lib/email-sender/quota-guard.ts`.

---

## 3. `schema_migrations` Dormant-Entry Repair

### Confirmed table shape

From deepwiki.com/supabase/cli and official CLI docs (HIGH confidence):

**`supabase_migrations.schema_migrations` columns:**

| Column | Type | Notes |
|--------|------|-------|
| `version` | text | Matches migration filename timestamp prefix (e.g. `20260507120000`) |
| `name` | text | Matches migration filename suffix (e.g. `phase36_resend_provider`) |
| `statements` | text[] | Array of SQL statements |
| `created_at` | timestamp | Applied-at timestamp |

### Confirmed dormant migration files on disk

From `ls supabase/migrations/` (HIGH confidence — files verified on disk):

| Phase | File | Version | Name |
|-------|------|---------|------|
| 36 | `20260507120000_phase36_resend_provider.sql` | `20260507120000` | `phase36_resend_provider` |
| 37 | `20260508120000_phase37_last_upgrade_request_at.sql` | `20260508120000` | `phase37_last_upgrade_request_at` |
| 41 | `20260510120000_phase41_stripe_billing_foundation.sql` | `20260510120000` | `phase41_stripe_billing_foundation` |

Phases 42.5 and 44 also have migration files. The sub-plan should SELECT to confirm which versions are missing from production before any INSERT/repair.

### SELECT-first verification (dry-run)

```sql
-- Run via MCP execute_sql before any repair:
SELECT version, name, created_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Compare output against the list of `supabase/migrations/*.sql` files. Any migration whose
timestamp prefix (`version`) is absent from the SELECT result is a dormant entry.

### Repair command (canonical — no raw INSERT needed)

**Use `supabase migration repair` instead of raw SQL INSERT.** This is the official CLI
tool designed for this exact use case (verified at https://supabase.com/docs/reference/cli/supabase-migration-repair):

```bash
# Mark a migration as applied (inserts into schema_migrations without re-running SQL)
npx supabase migration repair 20260507120000 --linked --status applied
npx supabase migration repair 20260508120000 --linked --status applied
npx supabase migration repair 20260510120000 --linked --status applied
```

**Why not raw INSERT:** `supabase migration repair` handles the `statements` array and
`name` column correctly; a manual INSERT risks misformatting the `statements` text[] or
missing the `name` column, which could confuse future `db push --linked` comparisons.

**Safety protocol for sub-plan 46-01:**
1. Run SELECT dry-run first to confirm which versions are absent
2. Run `supabase migration repair` only for missing versions
3. Re-run SELECT to confirm entries now appear
4. Do NOT run `supabase db push --linked` after — that would attempt to apply the SQL
   that is already live in production

**Known constraint (from `FUTURE_DIRECTIONS.md` §2):** `supabase db push --linked` is
already broken due to 3 orphan timestamps in remote schema_migrations (pre-existing from
before Phase 9). The locked workaround is `supabase db query --linked -f`. The repair
sub-plan should NOT attempt to fix the pre-existing orphan issue — only register the 3-5
dormant Phase 36/37/41 entries.

**Confidence:** HIGH for `migration repair` command syntax; HIGH for file-to-version
mapping; MEDIUM for exact production state (SELECT dry-run will confirm).

---

## 4. VERIFICATION.md Frontmatter + Structure

### Exact frontmatter from Phase 43 VERIFICATION.md (verified by file read)

```yaml
---
phase: 43-paywall-enforcement-locked-state-ux-trial-banners
verified: 2026-05-11T16:00:00Z
status: passed
score: 9/9 must-haves verified (all automated gates pass; all 7 live scenarios verified by Andrew on production deploy 2026-05-11)
signoff_by: Andrew
signoff_at: 2026-05-11
post_signoff_corrections:
  - commit: <sha>
    fix: <description>
  - migration: <timestamp> <name> applied via MCP to live DB
    fix: <description>
human_verification_results:
  - test: <test name>
    result: PASS/FAIL - <note>
---
```

### Exact frontmatter from Phase 45 VERIFICATION.md (verified by file read)

```yaml
---
phase: 45-login-ux-polish-and-gmail-quota-raise
verified: 2026-05-12T01:19:21Z
status: passed
score: 6/6 must-haves verified
---
```

Phase 45 is a lighter-weight variant (code-only verification; no live human section).

### Phase 46 must mirror Phase 43 pattern

Phase 46 is a live UAT phase like Phase 43 (not code-only like Phase 45). The frontmatter
must include:

```yaml
---
phase: 46-andrew-ship-sign-off
verified: <ISO timestamp when Andrew completes UAT>
status: in_progress | passed | failed
score: N/M scenarios passed
signoff_by: Andrew
signoff_at: <date>
post_signoff_corrections: []
human_verification_results:
  - test: <scenario name>
    result: PASS | FAIL - <note>
---
```

**Status field values observed:** `passed`, `human_needed` (Phase 43 initial), `in_progress`
(Phase 46 pre-UAT state). Use `in_progress` as the initial value; update to `passed` when
all scenarios check out.

**Confidence:** HIGH — read directly from source files.

---

## 5. Git Tag Mechanics

### All prior tags are annotated (HIGH confidence)

Verified via `git cat-file -t v1.0` and `git cat-file -t v1.7` — both return `tag` (not
`commit`). The tag annotation format (from `git tag -v v1.7`):

```
tagger Andrew.J.Wegner <ajwegner3@gmail.com> <unix timestamp> -0500

<summary line>

<multi-line body with key accomplishments>

See .planning/MILESTONES.md for full details.
```

### v1.8.0 tag command

Use an annotated tag (must match the prior pattern):

```bash
git tag -a v1.8.0 -m "$(cat <<'EOF'
v1.8 Stripe Paywall + Login UX Polish

Delivered: Full Stripe paywall (3-tier: Basic, Widget, Branding consult),
multi-tier Checkout + Customer Portal, widget feature gating, trial banners,
login UX polish (OAuth-below-Card, password-first tab, 3-fail magic-link nudge),
Gmail quota raise to 400/day, and dormant schema_migrations repair.

Key accomplishments:
- Stripe SDK (stripe@22.1.1, apiVersion 2026-04-22.dahlia) with 6-event webhook + idempotency
- 4-SKU pricing (Basic-Monthly/Annual, Widget-Monthly/Annual) via single Product
- Customer Portal cancel-at-period-end + plan-switching
- Widget gating via plan_tier='widget' | subscription_status='trialing' helper
- 3-fail counter advances on credentials-only (AUTH-38); magic-link nudge pre-fills email
- AUTH-29 4-way enumeration safety locked by test suite
- schema_migrations repaired for Phases 36/37/41

See .planning/MILESTONES.md for full details.
EOF
)"
```

**The tag should be placed on the sign-off commit** (the commit that writes 46-VERIFICATION.md
as `passed`). Andrew may prefer to run this command himself — flag it as a manual step in
the plan.

**Confidence:** HIGH — tag type confirmed from git object store.

---

## 6. ROADMAP Collapse Pattern

### Observed one-liner format from ROADMAP.md (verified by file read)

```markdown
- ✅ **v1.7 Auth Expansion + Per-Account Email + Polish + Dead Code** — Phases 34-40 (32 plans across 7 phases) — shipped 2026-05-09. Full archive: [`milestones/v1.7-ROADMAP.md`](./milestones/v1.7-ROADMAP.md).
```

Pattern: `- ✅ **v{N} {Title}** — {Phase range} ({plan count} across {phase count}) — shipped {date}. Full archive: [{path}]({relative-link}).`

### v1.8 one-liner to produce

```markdown
- ✅ **v1.8 Stripe Paywall + Login UX Polish** — Phases 41-46 + 42.5 + 42.6 (N plans across 8 phases) — shipped 2026-05-12. Full archive: [`milestones/v1.8-ROADMAP.md`](./milestones/v1.8-ROADMAP.md).
```

The exact plan count must be tallied from the phase plan counts in ROADMAP.md before
collapsing. From reading ROADMAP.md:
- Phase 41: 4 plans
- Phase 42: 4 plans (1 superseded)
- Phase 42.5: 6 plans
- Phase 42.6: 3 plans
- Phase 43: (not shown in snippet — check ROADMAP.md)
- Phase 44: (check)
- Phase 45: 3 plans (from ROADMAP title)
- Phase 46: 1 plan (VERIFICATION only)

**The `🚧` in-progress entry at the top of Milestones must also be updated to ✅.**

**Confidence:** HIGH — format read directly from ROADMAP.md source lines.

---

## 7. `milestones/v1.8-ROADMAP.md` Archive Shape

### Observed structure from v1.7-ROADMAP.md (verified by file read)

```markdown
# Milestone v1.7: Auth Expansion + Per-Account Email + Polish + Dead Code

**Status:** ✅ SHIPPED 2026-05-09
**Phases:** 34-40
**Total Plans:** 32

## Overview

[3-paragraph narrative summary of the milestone...]

**Manual Prerequisites (Andrew action; gated phases):**
- **PREREQ-XX** (gated PhaseNN): [description]. **Status**.

## Phases

### Phase N: [Name]

**Goal:** [description]
**Depends on:** [...]
**Requirements:** [req IDs]
**Plans:** N plans

Plans:
- [x] NN-01-PLAN.md — [description] ✓ shipped YYYY-MM-DD [(notes)]
...

**Completed:** YYYY-MM-DD — [completion note]
**Details:**
[optional additional detail]
```

### v1.8 archive must mirror this structure exactly

The archive document is a straight copy of the v1.8 section from ROADMAP.md (the full
`<details>` block content), reformatted as a standalone file with the top-level `#` heading.

**Confidence:** HIGH — structure read directly from `milestones/v1.7-ROADMAP.md`.

---

## 8. FUTURE_DIRECTIONS.md Current State

### File confirmed to exist at project root (HIGH confidence)

Path: `FUTURE_DIRECTIONS.md` (verified via `ls` output).

### Current structure

The file has these top-level sections:
1. How to Use This File (header)
2. `## 1. Known Limitations`
3. `## 2. Assumptions & Constraints`
4. `## 3. Future Improvements`
5. `## 4. Technical Debt`
6. `## 5. Untested Email Clients`
7. `## 6. Commit Reference`
8. `## 7. v1.1 Phase 10 — Multi-User Signup + Onboarding (Carry-overs)`
9. `## 8. v1.1 Phase 13 — Marathon QA Waiver + Carry-overs`
10. `## Phase 36: Resend Backend — Activation Steps (Deferred from Phase 36)` (appended unnumbered)

### v1.8 append point

Append a new section **at the end of the file** after `## Phase 36: Resend Backend...`. Do
NOT renumber or rewrite prior sections. The CONTEXT.md decisions specify four Known Limitation
categories for the v1.8 section:

```markdown
## v1.8 Stripe Paywall + Login UX Polish — Delta

**Shipped:** 2026-05-12
**Phases:** 41-46 + 42.5 + 42.6

### Known Limitations

1. **Branding tier non-Stripe path (consult-only):** No `plan_tier = 'branding'` in DB.
   Branding card CTA links to `NSI_BRANDING_BOOKING_URL`. No in-app upgrade flow. Activation
   requires personal onboarding by Andrew; v1.9+ scope.

2. **BILL-24 partial (account-locked + welcome-to-paid emails deferred):** The trial-ending
   email (3 days out) and payment-failed email ship in Phase 44. Welcome-to-paid email and
   account-locked email are deferred to v1.9.

3. **PREREQ-03 Resend DNS activation deferred:** Framework shipped in Phase 36. Live
   activation gated on DNS verification via Namecheap (SPF/DKIM/DMARC) + Resend domain
   approval. See FUTURE_DIRECTIONS.md § Phase 36: Resend Backend for step-by-step.

4. **Stripe API version pin LD-01:** `stripe@22.1.1` + `apiVersion '2026-04-22.dahlia'`
   pinned forever in `lib/stripe/client.ts`. Revisit trigger = when Stripe SDK forces an
   upgrade or `2026-04-22.dahlia` is sunset. Do NOT upgrade without auditing
   `invoice.parent.subscription_details.subscription` structural changes (this API version
   moved `invoice.subscription` to `invoice.parent.subscription_details.subscription`).

### Technical Debt

- **schema_migrations dormant entries:** Phases 36/37/41 were applied via MCP `apply_migration`
  without going through `supabase db push`. Repaired in Phase 46 sub-plan 46-01 via
  `supabase migration repair --linked --status applied`. Pre-existing orphan rows
  (20251223162516, 20260419144234, 20260419144302) remain — they are a known pre-Phase-9
  issue; the `db query --linked -f` workaround is locked.
```

**Confidence:** HIGH — file existence and structure verified by direct read.

---

## 9. Andrew (Manual) vs Claude (Automated) Boundary

### Items Andrew must do personally (Claude cannot automate)

| Item | When | Notes |
|------|------|-------|
| **PREREQ-C Stripe Portal config** | Before any billing UAT | Dashboard → Settings → Billing → Customer Portal. Enable: cancel-at-period-end, plan switching across all 4 Prices, payment method updates, invoice history |
| **Stripe Checkout card entry** | During checkout path scenarios | Use card `4242 4242 4242 4242` in Stripe-hosted Checkout page |
| **Stripe Customer Portal navigation** | During portal scenarios | Click "Manage subscription" → authenticate → cancel / plan-switch / reactivate |
| **Gmail inbox checks** | trial-will-end + payment-failed email scenarios | Check `ajwegner3@gmail.com` inbox for email arrival |
| **All /app/* browser navigation** | Every live UAT scenario | Requires Andrew's authenticated session |
| **Git tag push** | After sign-off | `git tag -a v1.8.0` + `git push origin v1.8.0` (or Claude can tag if Andrew authorizes in session) |
| **Stripe Dashboard to find cus_ID** | Before email trigger scenarios | Dashboard → Customers → search for nsi account email |

### Items Claude can do (automated)

| Item | When |
|------|------|
| SQL state-flip stubs via Supabase MCP `execute_sql` | During live UAT between Andrew's browser steps |
| `supabase migration repair --linked --status applied` | Sub-plan 46-01 |
| Write FUTURE_DIRECTIONS.md v1.8 section | After UAT passes |
| Write `milestones/v1.8-ROADMAP.md` | After UAT passes |
| Update ROADMAP.md (collapse + one-liner) | After UAT passes |
| Commit all archival documents | After UAT passes |
| Draft annotated tag message | Claude drafts; Andrew (or Claude with approval) runs `git tag -a` |

---

## Architecture Patterns

### Linear UAT checklist layout

Mirror Phase 43 VERIFICATION.md body structure:

```
## Prerequisite Block (PREREQ-C)
Hard block — Andrew must complete before any billing scenario.

## Scenario Group 1: Trial State + Banners
## Scenario Group 2: Checkout (4 paths)
## Scenario Group 3: Customer Portal
## Scenario Group 4: Lifecycle (past_due, reactivation, lockout)
## Scenario Group 5: Public Booker + Widget Gating
## Scenario Group 6: Email UAT (Phase 44 deferred)
## Scenario Group 7: Login UX (Phase 45 deferred)
## Scenario Group 8: Webhook Idempotency
## Scenario Group 9: Static Invariants (AUTH-29, Turnstile, Gmail quota)

## Sign-Off Section
## ROADMAP + Tag Instructions (for Claude to execute after Andrew's ✅)
```

Each scenario: **numbered**, with `- [ ]` checkbox, SQL stub pre-printed, expected result,
pass/fail field, and a note field. Andrew checks boxes; Claude records results in
`human_verification_results` frontmatter.

### Failure handling

- Any `FAIL` → open sub-plan (e.g., 46-01 for migration repair already planned; 46-02,
  46-03 etc. for UAT failures). Ship is blocked until all green.
- Sub-plan numbering: 46-01 = migration repair (pre-planned). 46-02+ = on-failure.
  Use integer suffixes, not decimals (per CONTEXT.md decision).

---

## Common Pitfalls

### Pitfall 1: `stripe trigger` fires against wrong customer
**What goes wrong:** Event webhook arrives but `handleSubscriptionEvent` logs `account_not_found`
because the synthetic customer doesn't match any `accounts.stripe_customer_id`.
**Prevention:** Use Stripe Dashboard test clock OR accept that for email UAT, inbox arrival
alone is the evidence (email fires before the `account_not_found` error — it's inside the
`try/catch` that never propagates to the outer handler). Verify from Vercel logs.
**Warning sign:** Webhook returns 200 but Vercel logs show `account_not_found`.

### Pitfall 2: `email_send_log` quota test burns real sends
**What goes wrong:** Andrew triggers a real signup email to test the 400th-send refuse path,
leaving 400 logged rows that block all subsequent test sends today.
**Prevention:** Use the synthetic INSERT approach (SQL stub F above). Never trigger 400 real
emails. Clean up rows after the quota scenario.

### Pitfall 3: Applying `supabase migration repair` for already-registered migrations
**What goes wrong:** If a migration version already exists in `schema_migrations`, `migration
repair --status applied` will try to INSERT a duplicate PK → error (or worse, silent failure).
**Prevention:** Always SELECT first. Only repair versions absent from the SELECT result.

### Pitfall 4: `supabase db push --linked` run after migration repair
**What goes wrong:** The pre-existing orphan rows (20251223...) still exist; `db push`
will fail with "Remote migration versions not found" as before. The repair does not fix
the pre-existing orphan issue.
**Prevention:** Never run `db push --linked`. Use `db query --linked -f` for any future
migration applies. This is locked per `FUTURE_DIRECTIONS.md` §2.

### Pitfall 5: Annotating the wrong commit with v1.8.0 tag
**What goes wrong:** Tag is created before the ROADMAP archive + FUTURE_DIRECTIONS commits
land, so the tagged commit doesn't include all archival work.
**Prevention:** Tag must be placed on (or after) the commit that closes 46-VERIFICATION.md
with `status: passed`. Sequence: UAT → archival commits → tag.

### Pitfall 6: `cancel_at_period_end` not reset between scenarios
**What goes wrong:** After testing the cancel-scheduled scenario, the `cancel_at_period_end =
TRUE` row persists, causing the amber status card to appear during subsequent unrelated
scenarios.
**Prevention:** Include reset stubs (back to FALSE) at the end of each cancel scenario block.

---

## State of the Art

| Old Approach | Current Approach | Applies to |
|--------------|------------------|------------|
| Raw SQL INSERT into `schema_migrations` | `supabase migration repair --linked --status applied` | Migration repair (Phase 36/37/41) |
| `supabase db push --linked` | `supabase db query --linked -f <file>` (locked workaround) | All future migration applies |
| Lightweight git tag | Annotated git tag (matches v1.0..v1.7 pattern) | v1.8.0 tag |

---

## Open Questions

1. **Exact plan count for v1.8 milestone one-liner**
   - What we know: Phase 41 (4), Phase 42 (4), Phase 42.5 (6), Phase 42.6 (3), Phase 45 (3) confirmed. Phase 43 and 44 plan counts not captured in research.
   - What's unclear: need the Phase 43 + 44 plan counts from ROADMAP.md to write the one-liner.
   - Recommendation: Planner reads ROADMAP.md Phase 43 + 44 sections before writing the one-liner. From ROADMAP.md snippet, Phase 43 had no numbered plan list visible in the read range.

2. **Stripe Customer ID for nsi in production**
   - What we know: written to `accounts.stripe_customer_id` after Phase 42.5 checkout. The nsi account went through checkout in Phase 42.5 UAT (Andrew approved 2026-05-10).
   - What's unclear: the exact `cus_XXXXX` value — it lives in the live DB, not in code.
   - Recommendation: Surface as the very first SQL in the UAT checklist — Andrew must read it from Supabase and use it when looking up the customer in Stripe Dashboard.

3. **`stripe trigger` customer override reliability**
   - What we know: GitHub issue #1119 documents that `--add customer` param doesn't reliably thread through to subscription events.
   - What's unclear: whether the `--override` variant works for `customer.subscription.trial_will_end`.
   - Recommendation: Plan for Dashboard test clock approach as primary; note `stripe trigger` as a fallback to test webhook parsing only (not DB row updates).

---

## Sources

### Primary (HIGH confidence)
- Source files read directly:
  - `supabase/migrations/20260510120000_phase41_stripe_billing_foundation.sql` — accounts billing columns
  - `supabase/migrations/20260510130000_phase42_5_plan_tier.sql` — plan_tier column
  - `supabase/migrations/20260511120000_phase44_cancel_at_period_end.sql` — cancel_at_period_end column
  - `supabase/migrations/20260507120000_phase36_resend_provider.sql` — email_send_log.provider column
  - `supabase/migrations/20260428120003_phase10_email_send_log.sql` — email_send_log base schema
  - `lib/email-sender/quota-guard.ts` — quota logic, account_id filter, UTC midnight boundary
  - `.planning/phases/43-*/43-VERIFICATION.md` — frontmatter pattern
  - `.planning/phases/45-*/45-VERIFICATION.md` — lightweight frontmatter variant
  - `FUTURE_DIRECTIONS.md` — file existence and section structure
  - `.planning/ROADMAP.md` lines 1-250 — one-liner format, v1.8 in-progress status
  - `.planning/milestones/v1.7-ROADMAP.md` — archive file structure
  - `git cat-file -t v1.0` / `v1.7` — annotated tag confirmation
  - `git tag -v v1.7` — tag message format confirmed
- Official Stripe CLI docs: https://docs.stripe.com/cli/trigger
- Official Supabase CLI migration repair: https://supabase.com/docs/reference/cli/supabase-migration-repair
- DeepWiki Supabase CLI migration management: https://deepwiki.com/supabase/cli/4.2-migration-management

### Secondary (MEDIUM confidence)
- Stripe billing testing docs (https://docs.stripe.com/billing/testing) — test card numbers, trial_will_end timing
- Stripe test clocks docs (https://docs.stripe.com/billing/testing/test-clocks/api-advanced-usage) — Dashboard simulation workflow

### Tertiary (LOW confidence)
- GitHub issue #1119 (stripe/stripe-cli) — `stripe trigger --add customer` param threading issue. Confirmed pattern but is a filed bug, not official behavior spec.

---

## Metadata

**Confidence breakdown:**
- SQL stubs: HIGH — all columns verified from source migrations
- VERIFICATION.md structure: HIGH — read from source files
- Git tag type: HIGH — verified from git object store
- ROADMAP one-liner format: HIGH — read from source file
- Milestone archive structure: HIGH — read from v1.7-ROADMAP.md
- FUTURE_DIRECTIONS append point: HIGH — file read in full
- Stripe CLI `trigger` syntax: HIGH — official docs
- Stripe customer override via CLI: LOW — known bug (#1119)
- `supabase migration repair` command: HIGH — official CLI docs
- schema_migrations column shape: MEDIUM — deepwiki (not official Supabase docs page)

**Research date:** 2026-05-11
**Valid until:** 2026-06-10 (stable domain; migration filenames are fixed on disk)
