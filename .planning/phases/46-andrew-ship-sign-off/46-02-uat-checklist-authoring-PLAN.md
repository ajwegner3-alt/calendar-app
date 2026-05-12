---
phase: 46-andrew-ship-sign-off
plan: "46-02"
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md
autonomous: true
must_haves:
  truths:
    - "46-VERIFICATION.md exists and is a single linear checklist Andrew can work top-to-bottom in one session"
    - "PREREQ-C Stripe Customer Portal Dashboard config appears as the FIRST item (hard block) before any UAT scenario"
    - "All 14 ROADMAP QA scenarios are present and individually checkable"
    - "All Phase 44 deferred items (Portal end-to-end cancel, trial-will-end email delivery, payment-failed email delivery) are interleaved by domain"
    - "All Phase 45 deferred items (OAuth-below-Card visual on /app/login + /app/signup, 3-fail nudge end-to-end, Gmail quota 400-cap transition) are interleaved by domain"
    - "Every state-flip scenario has its SQL stub inlined verbatim from 46-RESEARCH.md §2 so Claude can paste into MCP execute_sql without re-derivation"
    - "Frontmatter mirrors Phase 43 pattern (phase, verified, status=in_progress, score, signoff_by, signoff_at, post_signoff_corrections, human_verification_results)"
    - "A 'Read nsi Stripe Customer ID' SQL appears as the very first scenario SQL (RESEARCH.md §9 Open Question 2)"
  artifacts:
    - path: ".planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md"
      provides: "Single linear UAT checklist for Andrew with embedded SQL stubs, Stripe trigger instructions, and per-scenario pass/fail checkboxes"
      contains: "PREREQ-C"
      min_lines: 200
  key_links:
    - from: "46-VERIFICATION.md PREREQ-C block"
      to: "Stripe Dashboard → Settings → Billing → Customer Portal config"
      via: "explicit numbered checklist Andrew confirms before any scenario runs"
      pattern: "PREREQ-C"
    - from: "46-VERIFICATION.md state-flip scenarios"
      to: "Supabase MCP execute_sql"
      via: "inlined SQL stubs A..H from RESEARCH.md §2"
      pattern: "UPDATE accounts"
    - from: "46-VERIFICATION.md email UAT scenarios"
      to: "Stripe Dashboard test clock + Gmail inbox check"
      via: "step-by-step trigger + inbox-confirmation instructions"
      pattern: "test clock|inbox"
---

<objective>
Author `46-VERIFICATION.md`: the single linear UAT checklist Andrew will work through to sign off on v1.8. This is a doc-only plan — no code is touched. The checklist must roll up the 14 ROADMAP QA scenarios + Phase 44 deferred items + Phase 45 deferred items, with PREREQ-C as a hard-block first item.

Purpose: 46-VERIFICATION.md IS the UAT artifact. It is the single source of truth for v1.8 sign-off and the only audit trail (no separate v1.8-SIGNOFF.md per CONTEXT.md). Each scenario must be self-contained — embedded SQL stubs, Stripe instructions, expected behavior, and a `- [ ]` checkbox.

Output: One file at `.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md` ready for the live UAT plan (46-03) to drive.
</objective>

<execution_context>
@C:\Users\andre\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\andre\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/46-andrew-ship-sign-off/46-CONTEXT.md
@.planning/phases/46-andrew-ship-sign-off/46-RESEARCH.md

@.planning/phases/43-paywall-enforcement-locked-state-ux-trial-banners/43-VERIFICATION.md
@.planning/phases/45-login-ux-polish-and-gmail-quota-raise/45-VERIFICATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write 46-VERIFICATION.md with frontmatter + PREREQ-C block + 9 scenario groups</name>
  <files>.planning/phases/46-andrew-ship-sign-off/46-VERIFICATION.md</files>
  <action>
Create the file with the following structure (do not deviate from the section order — execution plan 46-03 depends on it).

### Frontmatter (mirror Phase 43 pattern per RESEARCH.md §4)

```yaml
---
phase: 46-andrew-ship-sign-off
verified: <leave as TBD until UAT completes>
status: in_progress
score: "0/28 scenarios passed (14 ROADMAP QA + 3 Phase 44 deferred + 4 Phase 45 deferred + 7 supporting)"
signoff_by: Andrew
signoff_at: <TBD>
post_signoff_corrections: []
human_verification_results: []
---
```

### Body sections (top-to-bottom)

**1. Introduction (~10 lines)**
- One paragraph: this is v1.8 ship sign-off; Andrew works top-to-bottom; Claude runs MCP SQL flips on request; PREREQ-C must be complete before any scenario runs.
- Single ground rule: any FAIL blocks ship and triggers a 46-NN sub-plan.

**2. PREREQ-C — HARD BLOCK (must be first scenario)**

```markdown
## PREREQ-C: Stripe Customer Portal Dashboard Config (BLOCKS ALL UAT)

- [ ] PREREQ-C.1 — Stripe Dashboard → Settings → Billing → Customer portal: cancel-at-period-end ENABLED
- [ ] PREREQ-C.2 — Plan switching ENABLED with all 4 Prices visible (Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual)
- [ ] PREREQ-C.3 — Payment method updates ENABLED
- [ ] PREREQ-C.4 — Invoice history ENABLED

**Andrew action only. Claude cannot complete this step. Do not proceed past this block until all four boxes are checked.**
```

**3. Setup SQL — Read nsi Stripe Customer ID** (first SQL Andrew runs; surfaces the `cus_XXXXX` needed for Stripe Dashboard lookups in later scenarios; RESEARCH.md §9 Open Question 2).

> **Run ONLY after all four PREREQ-C boxes are confirmed checked.** Do not proceed to this Setup SQL until Section 2 (PREREQ-C) is fully complete.

```sql
SELECT stripe_customer_id, stripe_subscription_id, subscription_status, plan_tier, trial_ends_at, cancel_at_period_end
FROM accounts
WHERE slug = 'nsi';
```

Record `stripe_customer_id` value here: `cus_____________` (Andrew fills in)

**4. Scenario Group 1 — Trial State + Banners**

Each scenario uses this template:

```markdown
### Scenario 1.1: Trial flow + 14-day counter
**SQL flip (run via MCP execute_sql):**
```sql
UPDATE accounts SET subscription_status='trialing', trial_ends_at=NOW() + INTERVAL '14 days', cancel_at_period_end=FALSE, plan_tier='widget' WHERE slug='nsi';
```
**Andrew action:** Log in at production, visit `/app`, observe trial banner.
**Expected:** Banner shows "14 days left in trial" (or current day-count); no lockout.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 1.2: Urgent trial banner (≤3 days)
**SQL flip:**
```sql
UPDATE accounts SET trial_ends_at = NOW() + INTERVAL '2 days' WHERE slug='nsi';
```
**Andrew action:** Reload `/app/*`.
**Expected:** Banner upgrades to urgent style ("2 days left — upgrade now").
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

Scenarios in Group 1: 1.1 trial counter, 1.2 urgent banner.

**5. Scenario Group 2 — Checkout (4 paths, all live)**

```markdown
### Scenario 2.1: Basic-Monthly checkout
**SQL reset:**
```sql
UPDATE accounts SET subscription_status='trialing', trial_ends_at=NOW() + INTERVAL '14 days', cancel_at_period_end=FALSE WHERE slug='nsi';
```
**Andrew action:** Visit `/app/billing` → click "Choose Basic — Monthly" → Stripe Checkout → enter card `4242 4242 4242 4242` → complete → return URL polls.
**Expected:** `subscription_status='active'`, `plan_tier='basic'`, `plan_interval='monthly'` (verify via Claude SQL):
```sql
SELECT subscription_status, plan_tier, plan_interval FROM accounts WHERE slug='nsi';
```
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 2.2: Basic-Annual checkout — (mirror 2.1, expect plan_interval='annual')
### Scenario 2.3: Widget-Monthly checkout — (mirror 2.1, expect plan_tier='widget', plan_interval='monthly')
### Scenario 2.4: Widget-Annual checkout — (mirror 2.1, expect plan_tier='widget', plan_interval='annual')
### Scenario 2.5: Branding card CTA
**Andrew action:** Visit `/app/billing` → click Branding card CTA.
**Expected:** Redirects to `https://booking.nsintegrations.com/nsi/branding-consultation`; no DB write to `accounts.plan_tier='branding'`.
**Verify (Claude SQL):**
```sql
SELECT plan_tier FROM accounts WHERE slug='nsi';
-- Must NOT be 'branding'
```
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**6. Scenario Group 3 — Customer Portal (Phase 44 deferred items interleaved)**

```markdown
### Scenario 3.1: Manage subscription opens Portal
**Andrew action:** `/app/billing` → "Manage subscription" → Stripe Customer Portal loads.
**Expected:** Portal shows current plan, payment method, invoice history.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 3.2: Cancel-at-period-end (Phase 44 deferred — Portal end-to-end cancel)
**Andrew action:** Portal → Cancel subscription → confirm → return to app.
**Expected:** Portal shows "Cancels on <date>"; app shows amber cancel-scheduled banner.
**Verify (Claude SQL):**
```sql
SELECT cancel_at_period_end, subscription_status FROM accounts WHERE slug='nsi';
-- Expect: cancel_at_period_end=true, subscription_status='active'
```
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 3.3: Plan-switching visible across all 4 Prices
**Andrew action:** Portal → "Update plan" → confirm all 4 Prices (Basic-Monthly, Basic-Annual, Widget-Monthly, Widget-Annual) appear.
**Expected:** All 4 selectable; switching writes new `plan_tier` + `plan_interval` after webhook.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 3.4: Reactivation (after cancel)
**Andrew action:** Portal → Reactivate subscription → return to app.
**Expected:** `cancel_at_period_end=false`; amber banner clears.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**7. Scenario Group 4 — Lifecycle (past_due, lockout, redirect-loop)**

```markdown
### Scenario 4.1: past_due banner (non-blocking)
**SQL flip:**
```sql
UPDATE accounts SET subscription_status='past_due' WHERE slug='nsi';
```
**Andrew action:** Visit `/app/*`.
**Expected:** Non-blocking past_due banner; NO redirect to `/app/billing`.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 4.2: Lockout on expired trial
**SQL flip:**
```sql
UPDATE accounts SET subscription_status='canceled', trial_ends_at=NOW() - INTERVAL '1 day' WHERE slug='nsi';
```
**Andrew action:** Visit `/app/dashboard`.
**Expected:** Redirected to `/app/billing` with locked-state UX. `/app/billing` does NOT redirect-loop.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**8. Scenario Group 5 — Public Booker + Widget Gating**

```markdown
### Scenario 5.1: Public booker /{nsi}/{slug} works in every subscription state
**Andrew action:** Visit `/nsi/<event-slug>` while account is in each of: trialing, active, canceled.
**Expected:** Returns 200, booking form loads, booking can be submitted, in ALL three states.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 5.2: Widget gating — Basic tier
**SQL flip:**
```sql
UPDATE accounts SET plan_tier='basic', subscription_status='active' WHERE slug='nsi';
```
**Andrew action:** Visit `/embed/nsi/<event-slug>` and `/app/embed-code`.
**Expected:** `/embed/...` shows gated message (NOT 404 — per LD-17); `/app/embed-code` shows upgrade CTA.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 5.3: Widget access — Widget tier
**SQL flip:**
```sql
UPDATE accounts SET plan_tier='widget' WHERE slug='nsi';
```
**Andrew action:** Visit `/embed/nsi/<event-slug>` and `/app/embed-code`.
**Expected:** Both work normally.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 5.4: Widget access — Trialing
**SQL flip:**
```sql
UPDATE accounts SET plan_tier='basic', subscription_status='trialing', trial_ends_at=NOW() + INTERVAL '14 days' WHERE slug='nsi';
```
**Andrew action:** Visit `/embed/nsi/<event-slug>`.
**Expected:** Loads normally (trialing override per LD-04).
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**9. Scenario Group 6 — Email UAT (Phase 44 deferred)**

```markdown
### Scenario 6.1: trial_will_end email delivers (Phase 44 deferred)
**Andrew action:** Stripe Dashboard → Billing → Subscriptions → create Simulation (test clock) with nsi customer + trial ending in 4 days → advance clock to 3 days before trial-end. Stripe fires `customer.subscription.trial_will_end` → webhook hits production → check `ajwegner3@gmail.com` inbox.
**Expected:** Trial-ending email arrives in inbox (proves V18-CP-12 inner try/catch did not swallow a real error).
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 6.2: invoice.payment_failed email delivers (Phase 44 deferred)
**Andrew action:** Attach test card `4000 0000 0000 0341` to nsi customer as default in Stripe Dashboard. Within test clock, advance past trial → invoice opens → payment fails. OR: Dashboard → manually create invoice for nsi → finalize → 0341 declines.
**Expected:** payment-failed email arrives in `ajwegner3@gmail.com` inbox.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**10. Scenario Group 7 — Login UX UAT (Phase 45 deferred)**

```markdown
### Scenario 7.1: OAuth button BELOW Card on /app/login (Phase 45 deferred)
**Andrew action:** Open production `/app/login` in fresh incognito.
**Expected:** Email/password Card sits ABOVE the "or continue with" divider and Google OAuth button.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 7.2: OAuth button BELOW Card on /app/signup (Phase 45 deferred)
**Andrew action:** Open production `/app/signup` in fresh incognito.
**Expected:** Same vertical order — Card on top, divider + Google below.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 7.3: 3-fail magic-link nudge (Phase 45 deferred)
**Andrew action:** `/app/login` → enter nsi email + 3 wrong passwords.
**Expected:** After 3rd failure, inline magic-link nudge appears. Clicking nudge switches tab to magic-link AND pre-fills the email.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 7.4: Gmail quota 400/day cap transition (Phase 45 deferred + ROADMAP QA item)
**Setup SQL (Claude runs via MCP):**
```sql
-- Clean any prior test rows
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');

-- Insert 399 synthetic sends for today
INSERT INTO email_send_log (category, account_id, provider, sent_at)
SELECT 'other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW()
FROM generate_series(1, 399);

-- Confirm count
SELECT COUNT(*) FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
-- Expect: 399
```
**Andrew action (send #400):** Trigger a booking flow that sends one email through the nsi account.
**Expected:** Send #400 succeeds (still ≤ cap).
**SQL bump to 400:**
```sql
INSERT INTO email_send_log (category, account_id, provider, sent_at)
VALUES ('other', 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60', 'gmail', NOW());
```
**Andrew action (send #401):** Trigger another booking flow send.
**Expected:** `RefusedSend` with quota-exhausted reason.
**Cleanup SQL (Claude runs after):**
```sql
DELETE FROM email_send_log
WHERE account_id = 'ba8e712d-28b7-4071-b3d4-361fb6fb7a60'
  AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
```
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**11. Scenario Group 8 — Webhook Idempotency**

```markdown
### Scenario 8.1: Duplicate event ID replay
**Andrew action:** Stripe Dashboard → Developers → Events → pick any recent nsi webhook event → "Resend".
**Expected (Claude verifies via MCP):** No duplicate row written; idempotency key prevents replay. Check via webhook log:
```sql
SELECT COUNT(*) FROM stripe_webhook_events WHERE event_id = '<event_id from dashboard>';
-- Expect: 1
```
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**12. Scenario Group 9 — Static Invariants**

```markdown
### Scenario 9.1: AUTH-29 four-way invariant
**Andrew action:** Open `/app/login` in two fresh incognito windows. In window A, enter a known email; in window B, enter an unknown email. Switch both to magic-link tab.
**Expected:** Byte-identical DOM on both windows in the magic-link tab section.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 9.2: V15-MP-05 Turnstile single-fetch on tab switch
**Andrew action:** `/app/login` → DevTools Network → switch Password ↔ Magic-link tab 5 times.
**Expected:** Exactly one Turnstile token fetch per page load (not one per tab switch).
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 9.3: 3-fail counter advances only on Supabase 400
**Andrew action:** Trigger one network error (Network throttling=Offline, attempt login) — confirm counter does NOT advance. Then re-enable network, type wrong password — confirm counter advances.
**Expected:** Counter only advances on real 400 auth-rejection, not on network/5xx.
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________

### Scenario 9.4: Gmail quota constants
**Static check (Claude greps):**
```bash
grep -n "SIGNUP_DAILY_EMAIL_CAP\s*=\s*400" lib/email-sender/quota-guard.ts
grep -n "WARN_THRESHOLD_PCT" lib/email-sender/quota-guard.ts
```
**Expected:** `SIGNUP_DAILY_EMAIL_CAP = 400`; warn threshold computes to 320 (400 × 0.8).
**Result:** - [ ] PASS  - [ ] FAIL — _note: __________________
```

**13. Final Restoration SQL (cleanup before sign-off)**

```sql
UPDATE accounts
SET subscription_status = 'trialing',
    trial_ends_at = NOW() + INTERVAL '14 days',
    cancel_at_period_end = FALSE,
    plan_tier = 'widget'
WHERE slug = 'nsi';
```

**14. Sign-Off Section**

```markdown
## Sign-Off

- [ ] All 14 ROADMAP QA scenarios PASS
- [ ] All Phase 44 deferred items (Portal cancel, trial-will-end email, payment-failed email) PASS
- [ ] All Phase 45 deferred items (OAuth-below-Card login + signup, 3-fail nudge, Gmail 400 cap) PASS
- [ ] PREREQ-C confirmed complete
- [ ] No FAIL items remaining (any FAIL → opened 46-NN sub-plan and re-ran)

**Andrew sign-off:** _________________ Date: _________________
```

**15. Tag + Archive Instructions (for Claude to execute after Andrew's sign-off)**

```markdown
## Post-Sign-Off Actions (Claude executes)

1. Run plan 46-04 (FUTURE_DIRECTIONS.md v1.8 append + milestones/v1.8-ROADMAP.md archive + ROADMAP.md collapse).
2. Run plan 46-05 (commit archival changes + flip 46-VERIFICATION.md status=passed + draft `git tag -a v1.8.0` annotated tag).
```

---

End of 46-VERIFICATION.md content.

When writing the file, use real markdown — the SQL stubs inside fenced code blocks must be copy-pasteable. Andrew checks boxes by editing the file inline during UAT.
  </action>
  <verify>
- File exists at the path.
- Frontmatter mirrors Phase 43 (verified via `head -20`).
- PREREQ-C appears as the first checklist block after intro.
- The 14 ROADMAP QA scenarios + 3 Phase 44 deferred items + 4 Phase 45 deferred items are all present and individually checkable.
- Every state-flip scenario has an inlined SQL stub matching RESEARCH.md §2.
- The "Read nsi Stripe Customer ID" SQL appears before any other scenario SQL.
- Final restoration SQL appears before the Sign-Off section.
  </verify>
  <done>
46-VERIFICATION.md is a complete, copy-pasteable, single-session UAT checklist. Plan 46-03 can drive Andrew through it without further authoring.
  </done>
</task>

</tasks>

<verification>
- Andrew can open 46-VERIFICATION.md and work top-to-bottom without referencing any other file (SQL is inlined, instructions are inlined).
- Every CONTEXT.md decision is honored: nsi-only, single linear checklist, integer sub-plan numbering note, PREREQ-C hard block first.
- No new code touched; this is a doc-only plan.
</verification>

<success_criteria>
1. 46-VERIFICATION.md exists with status `in_progress` frontmatter.
2. PREREQ-C is the first actionable block.
3. All 14 ROADMAP QA scenarios + all Phase 44/45 deferred items have `- [ ] PASS` / `- [ ] FAIL` checkboxes with one-line note slots.
4. All required SQL stubs from RESEARCH.md §2 are inlined verbatim.
5. Sign-off section + post-sign-off action pointer (to 46-04 + 46-05) appear at the end.
</success_criteria>

<output>
After completion, create `.planning/phases/46-andrew-ship-sign-off/46-02-SUMMARY.md` per the GSD summary template noting that the UAT checklist is authored and ready for Andrew to work in plan 46-03.
</output>
